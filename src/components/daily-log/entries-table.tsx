import { useMemo, useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NumberInput } from "@/components/daily-log/number-input";
import {
  useDailyEntries,
  useDeleteDailyEntry,
  useListItems,
  useSaveDailyEntry,
  type DailyEntry,
} from "@/hooks/use-data";
import { rowError, sumRows } from "@/lib/daily-log";
import { formatDate, formatMoney } from "@/lib/format";

const ALL = "All";

type Draft = Pick<
  DailyEntry,
  | "new_leads"
  | "responded_within_30_min"
  | "meetings_held"
  | "clients_won"
  | "value_won_monthly"
  | "marketing_spend"
>;

export function DailyEntriesTable({ tier }: { tier: string | undefined }) {
  const lists = useListItems();
  const entries = useDailyEntries();
  const save = useSaveDailyEntry();
  const remove = useDeleteDailyEntry();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [channel, setChannel] = useState(ALL);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const rows = useMemo(() => {
    const all = entries.data ?? [];
    return all.filter(
      (e) =>
        (!from || e.date >= from) &&
        (!to || e.date <= to) &&
        (channel === ALL || e.channel === channel) &&
        (!tier || e.tier === tier),
    );
  }, [entries.data, from, to, channel, tier]);

  const totals = sumRows(rows.map((r) => ({ ...r, channel: r.channel, tier: r.tier })));

  function startEdit(entry: DailyEntry) {
    setEditingId(entry.id);
    setDraft({
      new_leads: entry.new_leads,
      responded_within_30_min: entry.responded_within_30_min,
      meetings_held: entry.meetings_held,
      clients_won: entry.clients_won,
      value_won_monthly: Number(entry.value_won_monthly),
      marketing_spend: Number(entry.marketing_spend),
    });
  }

  async function commit(entry: DailyEntry) {
    if (!draft) return;
    const error = rowError({ channel: entry.channel, tier: entry.tier, ...draft });
    if (error) {
      toast.error(error);
      return;
    }
    try {
      await save.mutateAsync({
        id: entry.id,
        date: entry.date,
        channel: entry.channel,
        tier: entry.tier,
        notes: entry.notes,
        ...draft,
      });
      setEditingId(null);
      setDraft(null);
      toast.success("Entry updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the entry");
    }
  }

  const set = (key: keyof Draft) => (value: number) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <Card>
      <CardHeader className="gap-4">
        <CardTitle className="text-base">Past entries</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
          <div className="grid gap-1.5">
            <Label htmlFor="filter-from">From</Label>
            <Input id="filter-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="filter-to">To</Label>
            <Input id="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="filter-channel">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="filter-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All channels</SelectItem>
                {(lists.data?.channel ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.value}>
                    {c.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">≤30 min</TableHead>
              <TableHead className="text-right">Meetings</TableHead>
              <TableHead className="text-right">Won</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  {entries.isLoading ? "Loading…" : "No entries yet."}
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((entry) => {
              const editing = editingId === entry.id && draft;
              return (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(entry.date)}</TableCell>
                  <TableCell>{entry.channel}</TableCell>
                  <TableCell>{entry.tier}</TableCell>
                  {editing ? (
                    <>
                      <TableCell className="w-24">
                        <NumberInput label="New leads" value={draft.new_leads} onChange={set("new_leads")} />
                      </TableCell>
                      <TableCell className="w-24">
                        <NumberInput
                          label="Responded within 30 min"
                          value={draft.responded_within_30_min}
                          onChange={set("responded_within_30_min")}
                        />
                      </TableCell>
                      <TableCell className="w-24">
                        <NumberInput label="Meetings held" value={draft.meetings_held} onChange={set("meetings_held")} />
                      </TableCell>
                      <TableCell className="w-24">
                        <NumberInput label="Clients won" value={draft.clients_won} onChange={set("clients_won")} />
                      </TableCell>
                      <TableCell className="w-28">
                        <NumberInput
                          label="Value won per month"
                          step={50}
                          value={draft.value_won_monthly}
                          onChange={set("value_won_monthly")}
                        />
                      </TableCell>
                      <TableCell className="w-28">
                        <NumberInput
                          label="Marketing spend"
                          step={10}
                          value={draft.marketing_spend}
                          onChange={set("marketing_spend")}
                        />
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-right">{entry.new_leads}</TableCell>
                      <TableCell className="text-right">{entry.responded_within_30_min}</TableCell>
                      <TableCell className="text-right">{entry.meetings_held}</TableCell>
                      <TableCell className="text-right">{entry.clients_won}</TableCell>
                      <TableCell className="text-right">{formatMoney(Number(entry.value_won_monthly))}</TableCell>
                      <TableCell className="text-right">{formatMoney(Number(entry.marketing_spend))}</TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editing ? (
                        <>
                          <Button size="icon" variant="ghost" aria-label="Save row" onClick={() => commit(entry)}>
                            <Check className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Cancel edit"
                            onClick={() => {
                              setEditingId(null);
                              setDraft(null);
                            }}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </>
                      ) : (
                        <Button size="icon" variant="ghost" aria-label="Edit row" onClick={() => startEdit(entry)}>
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Delete row">
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {formatDate(entry.date)} · {entry.channel} · {entry.tier}. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await remove.mutateAsync(entry.id);
                                  toast.success("Entry deleted");
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Could not delete the entry");
                                }
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Totals</TableCell>
              <TableCell className="text-right">{totals.new_leads}</TableCell>
              <TableCell className="text-right">{totals.responded_within_30_min}</TableCell>
              <TableCell className="text-right">{totals.meetings_held}</TableCell>
              <TableCell className="text-right">{totals.clients_won}</TableCell>
              <TableCell className="text-right">{formatMoney(totals.value_won_monthly)}</TableCell>
              <TableCell className="text-right">{formatMoney(totals.marketing_spend)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
