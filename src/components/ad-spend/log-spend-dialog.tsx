// "Log ad spend": a week's Meta and Google spend in one go, spread across the
// days so CAC, cost per lead and the trends all stay right.
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/daily-log/number-input";
import { useDailyEntries, useListItems, useSaveDailyEntries } from "@/hooks/use-data";
import {
  datesIn,
  periodFor,
  planSpendEntries,
  spendAlreadyLogged,
  UNALLOCATED_TIER,
  type PeriodKind,
} from "@/lib/ad-spend";
import { formatDate, formatMoney, todayInBrisbane } from "@/lib/format";

const PERIODS: { value: PeriodKind; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom dates" },
];

const PAID_CHANNELS = ["Meta Ads", "Google Ads"];

interface Row {
  key: string;
  channel: string;
  amount: number;
}

const newRow = (channel = ""): Row => ({ key: `spend-${Math.random().toString(36).slice(2)}`, channel, amount: 0 });

export function LogSpendDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const today = todayInBrisbane();
  const lists = useListItems();
  const saveEntries = useSaveDailyEntries();

  const [kind, setKind] = useState<PeriodKind>("this_week");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [tier, setTier] = useState(UNALLOCATED_TIER);
  const [rows, setRows] = useState<Row[]>(PAID_CHANNELS.map(newRow));
  const [saving, setSaving] = useState(false);

  const period = useMemo(() => periodFor(kind, today, { from, to }), [kind, today, from, to]);
  const entries = useDailyEntries({ from: period.from, to: period.to });

  useEffect(() => {
    if (!open) {
      setKind("this_week");
      setRows(PAID_CHANNELS.map(newRow));
      setTier(UNALLOCATED_TIER);
    }
  }, [open]);

  // Show what is already logged, so a second visit corrects rather than adds
  useEffect(() => {
    if (!open || entries.isLoading) return;
    const existing = (entries.data ?? []).map((e) => ({ ...e, notes: e.notes ?? null }));
    setRows((prev) =>
      prev.map((row) =>
        row.channel && row.amount === 0
          ? { ...row, amount: Math.round(spendAlreadyLogged(existing, period, row.channel) * 100) / 100 }
          : row,
      ),
    );
    // Only refill when the period or the loaded data changes
  }, [open, entries.isLoading, entries.data, period.from, period.to]);

  const channels = (lists.data?.channel ?? []).map((c) => c.value);
  const tiers = [UNALLOCATED_TIER, ...(lists.data?.tier ?? []).map((t) => t.value).filter((t) => t !== UNALLOCATED_TIER)];
  const days = datesIn(period).length;
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  async function save() {
    if (period.from > period.to) {
      toast.error("The end date is before the start date");
      return;
    }
    const filled = rows.filter((row) => row.channel && Number(row.amount) > 0);
    if (!filled.length) {
      toast.error("Add an amount for at least one channel");
      return;
    }
    const duplicate = filled.find((row, i) => filled.findIndex((r) => r.channel === row.channel) !== i);
    if (duplicate) {
      toast.error(`${duplicate.channel} appears twice`);
      return;
    }

    try {
      setSaving(true);
      const existing = (entries.data ?? []).map((e) => ({ ...e, notes: e.notes ?? null }));
      const planned = planSpendEntries(filled, period, tier, existing);
      await saveEntries.mutateAsync(
        planned.map((p) => ({
          date: p.date,
          channel: p.channel,
          tier: p.tier,
          new_leads: p.new_leads,
          responded_within_30_min: p.responded_within_30_min,
          meetings_held: p.meetings_held,
          clients_won: p.clients_won,
          value_won_monthly: p.value_won_monthly,
          marketing_spend: p.marketing_spend,
          notes: p.notes,
        })),
      );
      toast.success(`${formatMoney(total)} logged across ${days} day${days === 1 ? "" : "s"}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the spend");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log ad spend</DialogTitle>
          <DialogDescription>
            Enter what each channel spent over a period. It is spread evenly across the days, which is what CAC and
            cost per lead are worked out from.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Period</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as PeriodKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formatDate(period.from)} to {formatDate(period.to)} · {days} day{days === 1 ? "" : "s"}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave as {UNALLOCATED_TIER} unless the spend was for one tier only.
              </p>
            </div>
          </div>

          {kind === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="spend-from">From</Label>
                <Input id="spend-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="spend-to">To</Label>
                <Input id="spend-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                <div className="grid gap-1.5">
                  <Label>Channel</Label>
                  <Select value={row.channel} onValueChange={(value) => update(row.key, { channel: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Spend</Label>
                  <NumberInput
                    label={`${row.channel || "Channel"} spend`}
                    step={50}
                    value={row.amount}
                    onChange={(value) => update(row.key, { amount: value })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this channel"
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRows((prev) => [...prev, newRow()])}>
              <Plus className="size-4" aria-hidden="true" />
              Add a channel
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p>
              <strong>{formatMoney(total)}</strong> over {days} day{days === 1 ? "" : "s"}
              {days > 0 ? ` · about ${formatMoney(total / days)} a day` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Saving replaces whatever spend is already logged for these channels in this period, so it is safe to
              correct a figure by entering it again.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || entries.isLoading}>
            {saving ? "Saving…" : "Save spend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
