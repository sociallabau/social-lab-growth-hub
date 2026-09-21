import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Instagram, Mail, Plus, Sparkles, Globe, CalendarClock, Trash2, Trophy } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NumberInput } from "@/components/daily-log/number-input";
import {
  useCreateClient,
  useCreateLead,
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
  applyWinToRows,
  brisbaneDate,
  brisbaneTimestamp,
  enquiryError,
  enquiryToLead,
  newDraftRow,
  newEnquiryDraft,
  prefillFromCrm,
  rowError,
  sumRows,
  winError,
  winToClient,
  type AutoField,
  type DraftRow,
  type EnquiryDraft,
  type WinDraft,
} from "@/lib/daily-log";
import { formatDateTime, formatMoney, formatPercent, todayInBrisbane } from "@/lib/format";

type DecisionKind = "lead" | "not_lead" | "not_fit";
type Decision = { kind: DecisionKind; channel: string; tier: string };

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
  const createLead = useCreateLead();
  const createClient = useCreateClient();
  const saveEntries = useSaveDailyEntries();
  const saveCheckin = useSaveDailyCheckin();

  const [step, setStep] = useState(1);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [meetingAnswers, setMeetingAnswers] = useState<Record<string, "yes" | "no">>({});
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryDraft[]>([]);
  const [win, setWin] = useState<WinDraft | null>(null);
  const [winsRecorded, setWinsRecorded] = useState<string[]>([]);
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
      setEnquiries([]);
      setWin(null);
      setWinsRecorded([]);
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
          key: `${e.channel}|||${e.tier}`,
          channel: e.channel,
          tier: e.tier,
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
      return d.kind !== "lead" || (d.channel && d.tier);
    }) && meetingsDue.every((l) => meetingAnswers[l.id]);

  function setDecision(lead: Lead, kind: DecisionKind) {
    setDecisions((prev) => ({
      ...prev,
      [lead.id]: {
        kind,
        channel: prev[lead.id]?.channel ?? lead.channel ?? "",
        tier: prev[lead.id]?.tier ?? lead.tier ?? "",
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
              tier: d.tier,
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

  async function saveEnquiries() {
    for (const draft of enquiries) {
      await createLead.mutateAsync(enquiryToLead(draft, date));
    }
    setEnquiries([]);
  }

  async function goToStep2() {
    if (!inboxComplete) return;
    const badEnquiry = enquiries.map((e) => enquiryError(e)).find((m) => m);
    if (badEnquiry) {
      toast.error(badEnquiry);
      return;
    }
    try {
      setSaving(true);
      await applyInbox();
      await saveEnquiries();
      await leads.refetch();
      setSeededFor(null);
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the inbox decisions");
    } finally {
      setSaving(false);
    }
  }

  const openLeads = useMemo(
    () => (leads.data ?? []).filter((l) => !["pending", "rejected", "won", "lost"].includes(l.status)),
    [leads.data],
  );

  async function recordWin() {
    if (!win) return;
    const problem = winError(win);
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      setSaving(true);
      const wonAt = brisbaneTimestamp(date, "17:00");
      if (win.lead_id) {
        await updateLead.mutateAsync({
          id: win.lead_id,
          patch: { status: "won", won_at: wonAt, won_value: Number(win.monthly_fee), channel: win.channel, tier: win.tier },
        });
      }
      await createClient.mutateAsync(winToClient(win, date));
      setRows((prev) => applyWinToRows(prev, win));
      setWinsRecorded((prev) => [...prev, `${win.client_name.trim()} · ${formatMoney(Number(win.monthly_fee))}/mo`]);
      setWin(null);
      await leads.refetch();
      toast.success("Client added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the win");
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
    // Ignore completely untouched rows (e.g. an "Add a row" left blank on a zero-lead day).
    const filled = rows.filter(
      (r) =>
        r.channel ||
        r.tier ||
        r.notes.trim() ||
        r.new_leads > 0 ||
        r.responded_within_30_min > 0 ||
        r.meetings_held > 0 ||
        r.clients_won > 0 ||
        r.value_won_monthly > 0 ||
        r.marketing_spend > 0,
    );
    const bad = filled.map((r) => rowError(r)).find((m) => m);
    if (bad) {
      toast.error(bad);
      return;
    }
    const seen = new Set<string>();
    for (const r of filled) {
      const key = `${r.channel}|||${r.tier}`;
      if (seen.has(key)) {
        toast.error(`${r.channel} · ${r.tier} appears twice`);
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
          tier: r.tier,
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
              ? "Log every enquiry that came in today, and clear anything waiting for review."
              : step === 2
                ? "Check today's numbers and record anyone who signed. Prefilled cells are marked auto."
                : "Wrap up with highlights, blockers and today's totals."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">Today&rsquo;s enquiries</h3>
                  <p className="text-xs text-muted-foreground">
                    Every call, DM, email or referral. Each one becomes a lead on the Leads board.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    setEnquiries((prev) => {
                      const last = prev[prev.length - 1];
                      return [...prev, newEnquiryDraft(last?.channel ?? "", last?.tier ?? "")];
                    })
                  }
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add enquiry
                </Button>
              </div>

              {enquiries.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No enquiries logged yet for {date}. Add them as they come in, or all at once now.
                </p>
              ) : null}

              <div className="mt-3 space-y-3">
                {enquiries.map((draft) => {
                  const update = (patch: Partial<EnquiryDraft>) =>
                    setEnquiries((prev) => prev.map((e) => (e.key === draft.key ? { ...e, ...patch } : e)));
                  return (
                    <div key={draft.key} className="rounded-md border border-border/70 bg-muted/30 p-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="grid gap-1.5">
                          <Label htmlFor={`name-${draft.key}`}>Name</Label>
                          <Input
                            id={`name-${draft.key}`}
                            value={draft.name}
                            placeholder="Who got in touch"
                            onChange={(e) => update({ name: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`company-${draft.key}`}>Company</Label>
                          <Input
                            id={`company-${draft.key}`}
                            value={draft.company}
                            onChange={(e) => update({ company: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Channel</Label>
                          <Select value={draft.channel} onValueChange={(value) => update({ channel: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Where from" />
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
                          <Label>Tier</Label>
                          <Select value={draft.tier} onValueChange={(value) => update({ tier: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="What for" />
                            </SelectTrigger>
                            <SelectContent>
                              {(lists.data?.tier ?? []).map((sl) => (
                                <SelectItem key={sl.id} value={sl.value}>
                                  {sl.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="grid gap-1.5">
                          <Label htmlFor={`time-${draft.key}`}>Came in at</Label>
                          <Input
                            id={`time-${draft.key}`}
                            type="time"
                            value={draft.time}
                            onChange={(e) => update({ time: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`email-${draft.key}`}>Email</Label>
                          <Input
                            id={`email-${draft.key}`}
                            type="email"
                            value={draft.email}
                            onChange={(e) => update({ email: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`phone-${draft.key}`}>Phone</Label>
                          <Input
                            id={`phone-${draft.key}`}
                            value={draft.phone}
                            onChange={(e) => update({ phone: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`note-${draft.key}`}>Note</Label>
                          <Input
                            id={`note-${draft.key}`}
                            value={draft.note}
                            placeholder="What they asked for"
                            onChange={(e) => update({ note: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`replied-${draft.key}`}
                            checked={draft.replied_within_30}
                            onCheckedChange={(checked) => update({ replied_within_30: checked })}
                          />
                          <Label htmlFor={`replied-${draft.key}`} className="font-normal">
                            Replied within 30 minutes
                          </Label>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto gap-1.5 text-muted-foreground"
                          onClick={() => setEnquiries((prev) => prev.filter((e) => e.key !== draft.key))}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {pending.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nothing waiting for review in the inbox.
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
                        <Label>Tier</Label>
                        <Select
                          value={decision.tier}
                          onValueChange={(value) =>
                            setDecisions((p) => ({ ...p, [lead.id]: { ...decision, tier: value } }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a tier" />
                          </SelectTrigger>
                          <SelectContent>
                            {(lists.data?.tier ?? []).map((s) => (
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
                    <TableHead>Tier</TableHead>
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
                          value={r.tier}
                          onValueChange={(value) => updateRow(r.key, { tier: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tier" />
                          </SelectTrigger>
                          <SelectContent>
                            {(lists.data?.tier ?? []).map((s) => (
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

            <div className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    <Trophy className="size-4 text-[var(--good)]" aria-hidden="true" />
                    Did anyone sign today?
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Recording a win marks the lead won and creates the client, so MRR and churn stay right.
                  </p>
                </div>
                {win === null ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      setWin({
                        lead_id: null,
                        client_name: "",
                        monthly_fee: 0,
                        tier: "",
                        channel: "",
                      })
                    }
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add a win
                  </Button>
                ) : null}
              </div>

              {winsRecorded.length ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {winsRecorded.map((w) => (
                    <li key={w} className="flex items-center gap-1.5">
                      <Check className="size-4 text-[var(--good)]" aria-hidden="true" />
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}

              {win ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Which lead?</Label>
                      <Select
                        value={win.lead_id ?? "new"}
                        onValueChange={(value) => {
                          const lead = openLeads.find((l) => l.id === value);
                          setWin({
                            ...win,
                            lead_id: value === "new" ? null : value,
                            client_name: lead ? (lead.company ?? lead.name ?? "") : win.client_name,
                            channel: lead?.channel ?? win.channel,
                            tier: lead?.tier ?? win.tier,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a lead" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Not in the CRM</SelectItem>
                          {openLeads.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.company ?? l.name ?? "Unnamed lead"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="win-client">Client name</Label>
                      <Input
                        id="win-client"
                        value={win.client_name}
                        onChange={(e) => setWin({ ...win, client_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="win-fee">Monthly fee</Label>
                      <NumberInput
                        label="Monthly fee"
                        step={50}
                        value={win.monthly_fee}
                        onChange={(v) => setWin({ ...win, monthly_fee: v })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Tier</Label>
                      <Select value={win.tier} onValueChange={(value) => setWin({ ...win, tier: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Package" />
                        </SelectTrigger>
                        <SelectContent>
                          {(lists.data?.tier ?? []).map((t) => (
                            <SelectItem key={t.id} value={t.value}>
                              {t.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Tier</Label>
                      <Select
                        value={win.tier}
                        onValueChange={(value) => setWin({ ...win, tier: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tier" />
                        </SelectTrigger>
                        <SelectContent>
                          {(lists.data?.tier ?? []).map((sl) => (
                            <SelectItem key={sl.id} value={sl.value}>
                              {sl.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Lead channel</Label>
                      <Select value={win.channel} onValueChange={(value) => setWin({ ...win, channel: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Where they came from" />
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
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={recordWin} disabled={saving}>
                      {saving ? "Saving…" : "Record win"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setWin(null)} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
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
            <Button onClick={() => setStep(3)} disabled={saving}>
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
