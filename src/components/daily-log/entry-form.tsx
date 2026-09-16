import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/daily-log/number-input";
import { useListItems, useSaveDailyEntry } from "@/hooks/use-data";
import { rowError } from "@/lib/daily-log";
import { todayInBrisbane } from "@/lib/format";

const blank = {
  new_leads: 0,
  responded_within_30_min: 0,
  meetings_held: 0,
  clients_won: 0,
  value_won_monthly: 0,
  marketing_spend: 0,
};

export function DailyEntryForm({ defaultServiceLine }: { defaultServiceLine?: string | undefined }) {
  const lists = useListItems();
  const save = useSaveDailyEntry();
  const [date, setDate] = useState(todayInBrisbane());
  const [channel, setChannel] = useState("");
  const [serviceLine, setServiceLine] = useState(defaultServiceLine ?? "");
  const [numbers, setNumbers] = useState(blank);
  const [notes, setNotes] = useState("");

  const set = (key: keyof typeof blank) => (value: number) => setNumbers((n) => ({ ...n, [key]: value }));

  async function submit() {
    const error = rowError({ channel, service_line: serviceLine, ...numbers });
    if (error) {
      toast.error(error);
      return;
    }
    try {
      await save.mutateAsync({ date, channel, service_line: serviceLine, ...numbers, notes: notes || null });
      toast.success("Entry saved");
      setNumbers(blank);
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the entry");
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Quick entry</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="entry-date">Date</Label>
            <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="entry-channel">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="entry-channel">
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
            <Label htmlFor="entry-service">Service line</Label>
            <Select value={serviceLine} onValueChange={setServiceLine}>
              <SelectTrigger id="entry-service">
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
          <div className="grid gap-1.5">
            <Label>New leads</Label>
            <NumberInput label="New leads" value={numbers.new_leads} onChange={set("new_leads")} />
          </div>
          <div className="grid gap-1.5">
            <Label>Responded within 30 min</Label>
            <NumberInput
              label="Responded within 30 min"
              value={numbers.responded_within_30_min}
              onChange={set("responded_within_30_min")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Meetings held</Label>
            <NumberInput label="Meetings held" value={numbers.meetings_held} onChange={set("meetings_held")} />
          </div>
          <div className="grid gap-1.5">
            <Label>Clients won</Label>
            <NumberInput label="Clients won" value={numbers.clients_won} onChange={set("clients_won")} />
          </div>
          <div className="grid gap-1.5">
            <Label>Value won ($/month)</Label>
            <NumberInput
              label="Value won per month"
              step={50}
              value={numbers.value_won_monthly}
              onChange={set("value_won_monthly")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Marketing spend</Label>
            <NumberInput
              label="Marketing spend"
              step={10}
              value={numbers.marketing_spend}
              onChange={set("marketing_spend")}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="entry-notes">Notes</Label>
            <Textarea
              id="entry-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering about today"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save entry"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Saving the same date, channel and service line again updates that row.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
