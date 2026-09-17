// Status changes for a lead in one place: every change writes a
// lead_activities row, and Proposal / Won / Lost ask for their extra details.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateClient, useLeadChange, useLeads, useSettings, type Lead } from "@/hooks/use-data";
import { nextPriceBand } from "@/lib/metrics";
import { formatMoney, todayInBrisbane } from "@/lib/format";
import {
  LOST_REASONS,
  PRICE_BANDS,
  PRICE_BAND_LABELS,
  STATUS_LABELS,
  priceBandAmount,
  type LeadStatus,
  type PriceBand,
} from "@/lib/leads";

type Ctx = {
  requestStatus: (lead: Lead, status: LeadStatus) => void;
  markResponded: (lead: Lead) => void;
  busy: boolean;
};

const LeadActionsContext = createContext<Ctx | null>(null);

export function useLeadActions() {
  const ctx = useContext(LeadActionsContext);
  if (!ctx) throw new Error("useLeadActions must be used inside LeadActionsProvider");
  return ctx;
}

export function LeadActionsProvider({ children }: { children: ReactNode }) {
  const leads = useLeads();
  const settings = useSettings();
  const change = useLeadChange();
  const createClient = useCreateClient();

  const [pending, setPending] = useState<{ lead: Lead; status: LeadStatus } | null>(null);
  const [band, setBand] = useState<PriceBand>("current");
  const [quoted, setQuoted] = useState("");
  const [wonValue, setWonValue] = useState("");
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [wonLead, setWonLead] = useState<{ lead: Lead; value: number } | null>(null);
  const [clientDraft, setClientDraft] = useState({ name: "", service_line: "", lead_channel: "", start_date: todayInBrisbane(), monthly_fee: "" });

  const apply = useCallback(
    async (lead: Lead, status: LeadStatus, patch: Record<string, unknown>, note: string) => {
      try {
        await change.mutateAsync({
          id: lead.id,
          patch: { status, ...patch },
          activity: { kind: "status", body: note },
        });
        toast.success(`Moved to ${STATUS_LABELS[status]}`);
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update the lead");
        return false;
      }
    },
    [change],
  );

  const requestStatus = useCallback(
    (lead: Lead, status: LeadStatus) => {
      if (lead.status === status) return;
      if (status === "proposal") {
        const suggested = nextPriceBand(leads.data ?? []);
        setBand(suggested);
        setQuoted(String(priceBandAmount(suggested, settings.data ?? undefined) ?? ""));
        setPending({ lead, status });
        return;
      }
      if (status === "won") {
        setWonValue(String(lead.quoted_value ?? ""));
        setPending({ lead, status });
        return;
      }
      if (status === "lost") {
        setLostReason(LOST_REASONS[0]);
        setPending({ lead, status });
        return;
      }
      void apply(lead, status, {}, `Status → ${STATUS_LABELS[status]}`);
    },
    [apply, leads.data, settings.data],
  );

  const markResponded = useCallback(
    async (lead: Lead) => {
      const now = new Date().toISOString();
      try {
        await change.mutateAsync({
          id: lead.id,
          patch: { first_response_at: now },
          activity: { kind: "response", body: "First response recorded" },
        });
        toast.success("Marked as responded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not mark the response");
      }
    },
    [change],
  );

  async function confirmPending() {
    if (!pending) return;
    const { lead, status } = pending;
    if (status === "proposal") {
      const value = Number(quoted);
      if (!Number.isFinite(value) || value < 0) {
        toast.error("Enter a quoted value");
        return;
      }
      const ok = await apply(
        lead,
        status,
        { price_band: band, quoted_value: value },
        `Proposal sent · ${PRICE_BAND_LABELS[band]} price band · ${formatMoney(value)}`,
      );
      if (ok) setPending(null);
      return;
    }
    if (status === "won") {
      const value = Number(wonValue);
      if (!Number.isFinite(value) || value <= 0) {
        toast.error("Enter the won value");
        return;
      }
      const ok = await apply(lead, status, { won_value: value, won_at: new Date().toISOString() }, `Won · ${formatMoney(value)} per month`);
      if (ok) {
        setPending(null);
        setClientDraft({
          name: lead.company || lead.name || "",
          service_line: lead.service_line ?? "",
          lead_channel: lead.channel ?? "",
          start_date: todayInBrisbane(),
          monthly_fee: String(value),
        });
        setWonLead({ lead, value });
      }
      return;
    }
    if (status === "lost") {
      const ok = await apply(lead, status, { lost_reason: lostReason }, `Lost · ${lostReason}`);
      if (ok) setPending(null);
    }
  }

  async function createClientFromLead() {
    if (!wonLead) return;
    try {
      const client = await createClient.mutateAsync({
        name: clientDraft.name,
        service_line: clientDraft.service_line || null,
        lead_channel: clientDraft.lead_channel || null,
        start_date: clientDraft.start_date,
        monthly_fee: Number(clientDraft.monthly_fee) || null,
      });
      await change.mutateAsync({
        id: wonLead.lead.id,
        patch: { client_id: client.id },
        activity: { kind: "note", body: `Client created: ${client.name}` },
      });
      toast.success("Client created and linked");
      setWonLead(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the client");
    }
  }

  const ctx = useMemo<Ctx>(() => ({ requestStatus, markResponded, busy: change.isPending }), [requestStatus, markResponded, change.isPending]);

  return (
    <LeadActionsContext.Provider value={ctx}>
      {children}

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md">
          {pending?.status === "proposal" ? (
            <>
              <DialogHeader>
                <DialogTitle>Send a proposal</DialogTitle>
                <DialogDescription>Proposals rotate through the three price points, so each gets a fair test.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Price band</Label>
                  <Select
                    value={band}
                    onValueChange={(v) => {
                      const next = v as PriceBand;
                      setBand(next);
                      setQuoted(String(priceBandAmount(next, settings.data ?? undefined) ?? ""));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICE_BANDS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {PRICE_BAND_LABELS[b]} · {formatMoney(priceBandAmount(b, settings.data ?? undefined))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quoted">Quoted value ($/month)</Label>
                  <Input id="quoted" type="number" min={0} value={quoted} onChange={(e) => setQuoted(e.target.value)} />
                </div>
              </div>
            </>
          ) : pending?.status === "won" ? (
            <>
              <DialogHeader>
                <DialogTitle>Mark as won</DialogTitle>
                <DialogDescription>Confirm what they signed for each month.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="won">Won value ($/month)</Label>
                <Input id="won" type="number" min={0} value={wonValue} onChange={(e) => setWonValue(e.target.value)} />
              </div>
            </>
          ) : pending?.status === "lost" ? (
            <>
              <DialogHeader>
                <DialogTitle>Mark as lost</DialogTitle>
                <DialogDescription>Why did it not go ahead?</DialogDescription>
              </DialogHeader>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={confirmPending} disabled={change.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!wonLead} onOpenChange={(open) => !open && setWonLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create the client?</DialogTitle>
            <DialogDescription>Prefilled from the lead. You can change anything before saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Client name</Label>
              <Input id="c-name" value={clientDraft.name} onChange={(e) => setClientDraft({ ...clientDraft, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-service">Service line</Label>
                <Input id="c-service" value={clientDraft.service_line} onChange={(e) => setClientDraft({ ...clientDraft, service_line: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-channel">Lead channel</Label>
                <Input id="c-channel" value={clientDraft.lead_channel} onChange={(e) => setClientDraft({ ...clientDraft, lead_channel: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-start">Start date</Label>
                <Input id="c-start" type="date" value={clientDraft.start_date} onChange={(e) => setClientDraft({ ...clientDraft, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-fee">Monthly fee</Label>
                <Input id="c-fee" type="number" min={0} value={clientDraft.monthly_fee} onChange={(e) => setClientDraft({ ...clientDraft, monthly_fee: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWonLead(null)}>
              Not now
            </Button>
            <Button onClick={createClientFromLead} disabled={createClient.isPending || !clientDraft.name}>
              Create client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LeadActionsContext.Provider>
  );
}
