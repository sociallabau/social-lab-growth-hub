// Lead detail: contact, source, qualifying answers, fit, owner, meeting and
// the activity timeline.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Instagram, Phone, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useAddLeadActivity,
  useLeadActivities,
  useLeadChange,
  useSettings,
  useTeamMembers,
  type Lead,
} from "@/hooks/use-data";
import { formatDateTime } from "@/lib/format";
import { FIT_OPTIONS, LEAD_STATUSES, STATUS_LABELS, notFitReply } from "@/lib/leads";
import { useLeadActions } from "./lead-actions";

const NONE = "__none";

function SourceIcon({ source }: { source: string }) {
  if (source === "instagram") return <Instagram className="size-4" aria-hidden />;
  if (source === "manual") return <Phone className="size-4" aria-hidden />;
  return <Mail className="size-4" aria-hidden />;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadSheet({ lead, onOpenChange }: { lead: Lead | null; onOpenChange: (open: boolean) => void }) {
  const settings = useSettings();
  const team = useTeamMembers();
  const activities = useLeadActivities(lead?.id ?? null);
  const change = useLeadChange();
  const addActivity = useAddLeadActivity();
  const { requestStatus, markResponded } = useLeadActions();

  const [note, setNote] = useState("");
  const [agents, setAgents] = useState("");
  const [budget, setBudget] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [firstResponse, setFirstResponse] = useState("");

  useEffect(() => {
    if (!lead) return;
    setAgents(lead.number_of_agents ?? "");
    setBudget(lead.monthly_marketing_budget ?? "");
    setMeetingAt(toLocalInput(lead.meeting_at));
    setFirstResponse(toLocalInput(lead.first_response_at));
    setNote("");
  }, [lead?.id]);

  if (!lead) return null;

  async function patch(p: Record<string, unknown>, body: string) {
    try {
      await change.mutateAsync({ id: lead!.id, patch: p, activity: { kind: "note", body } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the change");
    }
  }

  async function setFit(value: string) {
    await patch({ fit: value }, `Fit set to ${FIT_OPTIONS.find((f) => f.value === value)?.label ?? value}`);
    if (value === "not_fit") {
      toast("Not a fit — move to Nurture?", {
        action: {
          label: "Move & copy reply",
          onClick: () => {
            requestStatus(lead!, "nurture");
            navigator.clipboard
              .writeText(notFitReply(lead!.name, settings.data?.not_fit_resource_url))
              .then(() => toast.success("Reply copied"))
              .catch(() => toast.error("Could not copy the reply"));
          },
        },
      });
    }
  }

  async function saveNote() {
    if (!note.trim()) return;
    try {
      await addActivity.mutateAsync({ lead_id: lead!.id, kind: "note", body: note.trim() });
      setNote("");
      toast.success("Note added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the note");
    }
  }

  return (
    <Sheet open={!!lead} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SourceIcon source={lead.source} />
            {lead.name || lead.company || lead.instagram_handle || "Lead"}
          </SheetTitle>
          <SheetDescription>
            {STATUS_LABELS[lead.status] ?? lead.status} · received {formatDateTime(lead.received_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4 pt-0">
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Contact</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd>{lead.company ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">{lead.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{lead.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Instagram</dt>
                <dd>{lead.instagram_handle ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Channel</dt>
                <dd>{lead.channel ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Service line</dt>
                <dd>{lead.service_line ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Original enquiry</h3>
            <p className="text-sm font-medium">{lead.subject ?? "No subject"}</p>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{lead.message ?? "No message captured."}</p>
            {lead.ai_summary ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <CircleAlert className="size-4" aria-hidden /> AI summary
                </p>
                <p>{lead.ai_summary}</p>
                {lead.ai_reason ? <p className="mt-1 text-muted-foreground">{lead.ai_reason}</p> : null}
                {lead.ai_is_lead !== null ? (
                  <Badge variant="outline" className="mt-2">
                    {lead.ai_is_lead ? "AI: likely a lead" : "AI: probably not a lead"}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-status">Status</Label>
              <Select value={lead.status} onValueChange={(v) => requestStatus(lead, v as (typeof LEAD_STATUSES)[number])}>
                <SelectTrigger id="s-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-fit">Fit</Label>
              <Select value={lead.fit} onValueChange={setFit}>
                <SelectTrigger id="s-fit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-owner">Owner</Label>
              <Select
                value={lead.owner_email ?? NONE}
                onValueChange={(v) => patch({ owner_email: v === NONE ? null : v }, v === NONE ? "Owner cleared" : `Owner set to ${v}`)}
              >
                <SelectTrigger id="s-owner">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {(team.data ?? []).map((m) => (
                    <SelectItem key={m.email} value={m.email}>
                      {m.full_name ?? m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-meeting">Meeting time</Label>
              <div className="flex gap-2">
                <Input id="s-meeting" type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} />
                <Button
                  variant="outline"
                  onClick={() => patch({ meeting_at: meetingAt ? new Date(meetingAt).toISOString() : null }, meetingAt ? `Meeting set for ${formatDateTime(new Date(meetingAt))}` : "Meeting cleared")}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-agents">Number of agents</Label>
              <div className="flex gap-2">
                <Input id="s-agents" value={agents} onChange={(e) => setAgents(e.target.value)} />
                <Button variant="outline" onClick={() => patch({ number_of_agents: agents || null }, `Agents: ${agents || "—"}`)}>
                  Save
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-budget">Monthly marketing budget</Label>
              <div className="flex gap-2">
                <Input id="s-budget" value={budget} onChange={(e) => setBudget(e.target.value)} />
                <Button variant="outline" onClick={() => patch({ monthly_marketing_budget: budget || null }, `Budget: ${budget || "—"}`)}>
                  Save
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-response">First response</Label>
              <div className="flex gap-2">
                <Input id="s-response" type="datetime-local" value={firstResponse} onChange={(e) => setFirstResponse(e.target.value)} />
                <Button
                  variant="outline"
                  onClick={() => patch({ first_response_at: firstResponse ? new Date(firstResponse).toISOString() : null }, "First response time edited")}
                >
                  Save
                </Button>
                {!lead.first_response_at ? (
                  <Button onClick={() => markResponded(lead)}>Mark responded</Button>
                ) : null}
              </div>
            </div>
          </section>

          {lead.fit === "not_fit" ? (
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard
                  .writeText(notFitReply(lead.name, settings.data?.not_fit_resource_url))
                  .then(() => toast.success("Reply copied"))
                  .catch(() => toast.error("Could not copy the reply"))
              }
            >
              <Copy className="mr-1.5 size-4" aria-hidden />
              Copy the free resource reply
            </Button>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Activity</h3>
            <div className="flex gap-2">
              <Textarea rows={2} placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button onClick={saveNote} disabled={addActivity.isPending || !note.trim()}>
                Add
              </Button>
            </div>
            <ol className="space-y-2">
              {(activities.data ?? []).map((a) => (
                <li key={a.id} className="rounded-md border p-2 text-sm">
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(a.at)} · {a.kind}
                  </p>
                  <p>{a.body}</p>
                </li>
              ))}
              {activities.data?.length === 0 ? <li className="text-muted-foreground text-sm">No activity yet.</li> : null}
            </ol>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
