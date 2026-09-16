import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Instagram, Mail, Plus, Sparkles, Globe, CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NumberInput } from "@/components/daily-log/number-input";
import {
  useDailyEntries,
  useListItems,
  useMetaAds,
  useSaveDailyCheckin,
  useSaveDailyEntries,
  useSettings,
  useUpdateLead,
  useLeads,
  type Lead,
} from "@/hooks/use-data";
import {
  brisbaneDate,
  newDraftRow,
  prefillFromCrm,
  rowError,
  sumRows,
  type AutoField,
  type DraftRow,
} from "@/lib/daily-log";
import { formatDateTime, formatMoney, formatPercent, todayInBrisbane } from "@/lib/format";

type DecisionKind = "lead" | "not_lead" | "not_fit";
type Decision = { kind: DecisionKind; channel: string; service_line: string };

const SOURCE_ICON = {
  email: Mail,
  instagram: Instagram,
  calendly: CalendarClock,
  website: Globe,
  meta_lead_form: Sparkles,
  manual: Sparkles,
} as const;

export function LogTodayDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const lists = useListItems();
  const settings = useSettings();
  const leads = useLeads();
  const [date, setDate] = useState(todayInBrisbane());
  const entries = useDailyEntries({ from: date, to: date });
  const metaAds = useMetaAds({ from: date, to: date });
  const updateLead = useUpdateLead();
  const saveEntries = useSaveDailyEntries();
  const saveCheckin = useSaveDailyCheckin();

  const [step, setStep] = useState(1);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [meetingAnswers, setMeetingAnswers] = useState<Record<string, "yes" | "no">>({});
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [highlights, setHighlights] = useState("");
  const [blockers, setBlockers] = useState("");
  const [saving, setSaving] = useState(false);

  const pending = useMemo(() => (leads.data ?? []).filter((l) => l.status === "pending"), [leads.data]);
  const meetingsDue = useMemo(() => {
    const now = Date.now();
    return (leads.data ?? []).filter(
      (l) => l.status === "meeting_booked" && l.meeting_at && new Date(l.meeting_at).getTime() < now,
    );
  }, [leads.data]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setDecisions({});
      setMeetingAnswers({});
      setRows([]);
      setSeededFor(null);
      setHighlights("");
      setBlockers("");
    }
  }, [open]);

  // Seed step 2 from existing entries for the date, otherwise from the CRM.
  useEffect(() => {
    if (step !== 2 || seededFor === date) return;
    if (entries.isLoading || metaAds.isLoading || leads.isLoading) return;
    const existing = (entries.data ?? []).filter((e) => e.date === date);
    if (existing.length) {
      setRows(
        existing.map((e) => ({
          key: `${e.channel}|||${e.service_line}`,
          channel: e.channel,
          service_line: e.service_line,
          new_leads: e.new_leads,
          responded_within_30_min: e.responded_within_30_min,
          meetings_held: e.meetings_held,
          clients_won: e.clients_won,
          value_won_monthly: Number(e.value_won_monthly),
          marketing_spend: Number(e.marketing_spend),
          notes: e.notes ?? "",
          auto: [],
        })),
      );
    } else {
      const spend = (metaAds.data ?? [])
        .filter((m) => m.date === date)
        .reduce((s, m) => s + (Number(m.spend) || 0), 0);
      setRows(prefillFromCrm(leads.data ?? [], spend, date));
    }
    setSeededFor(date);
  }, [step, date, seededFor, entries.data, entries.isLoading, metaAds.data, metaAds.isLoading, leads.data, leads.isLoading]);

  const inboxComplete =
    pending.every((l) => {
      const d = decisions[l.id];
      if (!d) return false;
      return d.kind !== "lead" || (d.channel && d.service_line);
    }) && meetingsDue.every((l) => meetingAnswers[l.id]);

  function setDecision(lead: Lead, kind: DecisionKind) {
    setDecisions((prev) => ({
      ...prev,
      [lead.id]: {
        kind,
        channel: prev[lead.id]?.channel ?? lead.channel ?? "",
        service_line: prev[lead.id]?.service_line ?? lead.service_line ?? "",
      },
    }));
  }

  async function applyInbox() {
    const { data } = await supabase.auth.getUser();
    const reviewer = data.user?.id ?? null;
    const now = new Date().toISOString();
    for (const lead of pending) {
      const d = decisions[lead.id];
      if (!d) continue;
      const patch =
        d.kind === "lead"
          ? {
              status: "new",
              channel: d.channel,
              service_line: d.service_line,
              reviewed_by: reviewer,
              reviewed_at: now,
            }
          : d.kind === "not_lead"
            ? { status: "rejected", reviewed_by: reviewer, reviewed_at: now }
            : { status: "nurture", fit: "not_fit", reviewed_by: reviewer, reviewed_at: now };
      await updateLead.mutateAsync({ id: lead.id, patch });
    }
    for (const lead of meetingsDue) {
      const answer = meetingAnswers[lead.id];
      if (!answer) continue;
      await updateLead.mutateAsync({
        id: lead.id,
        patch: { status: answer === "yes" ? "meeting_held" : "contacted" },
      });
    }
  }

  async function goToStep2() {
    if (!inboxComplete) return;
    try {
      setSaving(true);
      await applyInbox();
      await leads.refetch();
      setSeededFor(null);
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the inbox decisions");
    } finally {
      setSaving(false);
    }
  }

  const totals = sumRows(rows);
  const leadTargetToday = (Number(settings.data?.target_leads_per_week) || 0) / 5;
  const speedToLead = totals.new_leads ? totals.responded_within_30_min / totals.new_leads : 0;
  const speedTarget = Number(settings.data?.target_responded_30) || 0.9;

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const isAuto = (r: DraftRow, field: AutoField) => r.auto.includes(field);

  async function save() {
    const bad = rows.map((r) => rowError(r)).find((m) => m);
    if (bad) {
      toast.error(bad);
      return;
    }
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.channel}|||${r.service_line}`;
      if (seen.has(key)) {
        toast.error(`${r.channel} · ${r.service_line} appears twice`);
        return;
      }
      seen.add(key);
    }
    try {
      setSaving(true);
      await saveEntries.mutateAsync(
        rows.map((r) => ({
          date,
          channel: r.channel,
          service_line: r.service_line,
          new_leads: r.new_leads,
          responded_within_30_min: r.responded_within_30_min,
          meetings_held: r.meetings_held,
          clients_won: r.clients_won,
          value_won_monthly: r.value_won_monthly,
          marketing_spend: r.marketing_spend,
          notes: r.notes || null,
        })),
      );
      await saveCheckin.mutateAsync({
        date,
        highlights: highlights || null,
        blockers: blockers || null,
        leads_reviewed: Object.keys(decisions).length + Object.keys(meetingAnswers).length,
        completed_at: new Date().toISOString(),
      });
      toast.success("Today is logged");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the check-in");
    } finally {
      setSaving(false);
    }
  }

  function copyNotFitReply(lead: Lead) {
    const url = settings.data?.not_fit_resource_url;
    const text = `Hi ${lead.name ?? "there"},\n\nThanks for reaching out to Social Lab. Based on what you've shared we're not the right fit right now, but here's a free resource that should help you get moving: ${url ?? "(add the resource link in Settings)"}\n\nIf things change, we'd love to hear from you.\n\nSocial Lab`;
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Reply copied"))
      .catch(() => toast.error("Could not copy the reply"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log today · step {step} of 3</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Clear the inbox: decide on every new enquiry."
              : step === 2
                ? "Check today's numbers. Prefilled cells are marked auto."
                : "Wrap up with highlights, blockers and today's totals."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            {pending.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nothing waiting in the inbox.
              </p>
            ) : null}
            {pending.map((lead) => {
              const Icon = SOURCE_ICON[(lead.source as keyof typeof SOURCE_ICON) ?? "manual"] ?? Sparkles;
              const decision = decisions[lead.id];
              return (
                <div key={lead.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <Icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{lead.name ?? lead.instagram_handle ?? "Unknown sender"}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(lead.received_at)}</span>
                        {lead.ai_is_lead === null ? null : (
                          <Badge variant={lead.ai_is_lead ? "default" : "secondary"}>
                            {lead.ai_is_lead ? "AI: looks like a lead" : "AI: probably not a lead"}
                          </Badge>
                        )}
                      </div>
                      {lead.subject ? <p className="mt-1 text-sm">{lead.subject}</p> : null}
                      {lead.ai_summary ? (
                        <p className="mt-1 text-sm text-muted-foreground">{lead.ai_summary}</p>
                      ) : null}
                      {lead.ai_reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">Why: {lead.ai_reason}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={decision?.kind === "lead" ? "default" : "outline"}
                      onClick={() => setDecision(lead, "lead")}
                    >
                      Lead
                    </Button>
                    <Button
                      size="sm"
                      variant={decision?.kind === "not_lead" ? "default" : "outline"}
                      onClick={() => setDecision(lead, "not_lead")}
                    >
                      Not a lead
                    </Button>
                    <Button
                      size="sm"
                      variant={decision?.kind === "not_fit" ? "default" : "outline"}
                      onClick={() => setDecision(lead, "not_fit")}
                    >
                      Not a fit
                    </Button>
                  </div>

                  {decision?.kind === "lead" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Channel</Label>
                        <Select
                          value={decision.channel}
                          onValueChange={(value) =>
                            setDecisions((p) => ({ ...p, [lead.id]: { ...decision, channel: value } }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a channel" />
                          </SelectTrigger>
                          <SelectContent>
                            {(lists.data?.channel ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.value}>
                                {c.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Service line</Label>
                        <Select
                          value={decision.service_line}
                          onValueChange={(value) =>
                            setDecisions((p) => ({ ...p, [lead.id]: { ...decision, service_line: value } }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a service line" />
                          </SelectTrigger>
                          <SelectContent>
                            {(lists.data?.service_line ?? []).map((s) => (
                              <SelectItem key={s.id} value={s.value}>
                                {s.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}

                  {decision?.kind === "not_fit" ? (
                    <Button size="sm" variant="secondary" className="mt-3 gap-1.5" onClick={() => copyNotFitReply(lead)}>
                      <Copy className="size-4" aria-hidden="true" />
                      Copy the free resource reply
                    </Button>
                  ) : null}
                </div>
              );
            })}

            {meetingsDue.length ? (
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium">Did it happen?</h3>
                <div className="mt-3 space-y-2">
                  {meetingsDue.map((lead) => (
                    <div key={lead.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">
                        {lead.name ?? lead.company ?? "Meeting"} · {formatDateTime(lead.meeting_at)}
                      </span>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant={meetingAnswers[lead.id] === "yes" ? "default" : "outline"}
                          onClick={() => setMeetingAnswers((p) => ({ ...p, [lead.id]: "yes" }))}
                        >
                          Yes
                        </Button>
                        <Button
                          size="sm"
                          variant={meetingAnswers[lead.id] === "no" ? "default" : "outline"}
                          onClick={() => setMeetingAnswers((p) => ({ ...p, [lead.id]: "no" }))}
                        >
                          No
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="grid max-w-xs gap-1.5">
              <Label htmlFor="checkin-date">Date</Label>
              <Input
                id="checkin-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSeededFor(null);
                }}
              />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Service line</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>≤30 min</TableHead>
                    <TableHead>Meetings</TableHead>
                    <TableHead>Won</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="min-w-40">
                        <Select value={r.channel} onValueChange={(value) => updateRow(r.key, { channel: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Channel" />
                          </SelectTrigger>
                          <SelectContent>
                            {(lists.data?.channel ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.value}>
                                {c.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-40">
                        <Select
                          value={r.service_line}
                          onValueChange={(value) => updateRow(r.key, { service_line: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Service line" />
                          </SelectTrigger>
                          <SelectContent>
                            {(lists.data?.service_line ?? []).map((s) => (
                              <SelectItem key={s.id} value={s.value}>
                                {s.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="w-28">
                        <NumberInput
                          label="New leads"
                          auto={isAuto(r, "new_leads")}
                          value={r.new_leads}
                          onChange={(v) => updateRow(r.key, { new_leads: v })}
                        />
                      </TableCell>
                      <TableCell className="w-28">
                        <NumberInput
                          label="Responded within 30 min"
                          auto={isAuto(r, "responded_within_30_min")}
                          value={r.responded_within_30_min}
                          onChange={(v) => updateRow(r.key, { responded_within_30_min: v })}
                        />
                      </TableCell>
                      <TableCell className="w-28">
                        <NumberInput
                          label="Meetings held"
                          auto={isAuto(r, "meetings_held")}
                          value={r.meetings_held}
                          onChange={(v) => updateRow(r.key, { meetings_held: v })}
                        />
                      </TableCell>
                      <TableCell className="w-28">
                        <NumberInput
                          label="Clients won"
                          auto={isAuto(r, "clients_won")}
                          value={r.clients_won}
                          onChange={(v) => updateRow(r.key, { clients_won: v })}
                        />
                      </TableCell>
                      <TableCell className="w-32">
                        <NumberInput
                          label="Value won per month"
                          step={50}
                          auto={isAuto(r, "value_won_monthly")}
                          value={r.value_won_monthly}
                          onChange={(v) => updateRow(r.key, { value_won_monthly: v })}
                        />
                      </TableCell>
                      <TableCell className="w-32">
                        <NumberInput
                          label="Marketing spend"
                          step={10}
                          auto={isAuto(r, "marketing_spend")}
                          value={r.marketing_spend}
                          onChange={(v) => updateRow(r.key, { marketing_spend: v })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                        Nothing from the CRM for {date}. Add a row for calls and referrals.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRows((p) => [...p, newDraftRow()])}>
              <Plus className="size-4" aria-hidden="true" />
              Add a row
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="highlights">Highlights</Label>
              <Textarea id="highlights" rows={2} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="blockers">Blockers</Label>
              <Textarea id="blockers" rows={2} value={blockers} onChange={(e) => setBlockers(e.target.value)} />
            </div>
            <div className="rounded-lg border border-border p-4 text-sm">
              <h3 className="mb-2 font-medium">Today vs target</h3>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  {totals.new_leads >= leadTargetToday ? (
                    <Check className="size-4 text-[var(--good)]" aria-hidden="true" />
                  ) : null}
                  <span>
                    Leads: {totals.new_leads} of {leadTargetToday.toFixed(1)} target
                    {totals.new_leads >= leadTargetToday ? " — on target" : " — below target"}
                  </span>
                </li>
                <li>
                  Speed to lead: {formatPercent(speedToLead)} (target {formatPercent(speedTarget)})
                  {speedToLead >= speedTarget ? " — on target" : " — below target"}
                </li>
                <li>Meetings held: {totals.meetings_held}</li>
                <li>
                  Clients won: {totals.clients_won} · {formatMoney(totals.value_won_monthly)} per month
                </li>
                <li>Marketing spend: {formatMoney(totals.marketing_spend)}</li>
                <li>
                  Inbox decisions: {Object.keys(decisions).length + Object.keys(meetingAnswers).length} for{" "}
                  {brisbaneDate(new Date().toISOString())}
                </li>
              </ul>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || saving}>
            Back
          </Button>
          {step === 1 ? (
            <Button onClick={goToStep2} disabled={!inboxComplete || saving}>
              {saving ? "Saving…" : "Continue"}
            </Button>
          ) : step === 2 ? (
            <Button onClick={() => setStep(3)} disabled={rows.length === 0}>
              Continue
            </Button>
          ) : (
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save check-in"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
