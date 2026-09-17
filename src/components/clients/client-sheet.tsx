import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useClientHours,
  useCreateClient,
  useDeleteClient,
  useListItems,
  useLogClientHours,
  usePackages,
  useUpdateClient,
  type ClientWithStats,
} from "@/hooks/use-data";
import { clientHoursSummary, packageTotalHours } from "@/lib/metrics";
import { formatDate, formatMoney, todayInBrisbane } from "@/lib/format";

export const PRICE_REVIEW_OPTIONS = ["none", "planned", "notice given", "accepted", "transitioning out"] as const;

type Draft = {
  name: string;
  service_line: string;
  tier: string;
  lead_channel: string;
  start_date: string;
  end_date: string;
  monthly_fee: string;
  last_scope_review: string;
  price_review_status: string;
  notes: string;
};

const emptyDraft: Draft = {
  name: "",
  service_line: "",
  tier: "",
  lead_channel: "",
  start_date: todayInBrisbane(),
  end_date: "",
  monthly_fee: "",
  last_scope_review: "",
  price_review_status: "none",
  notes: "",
};

function toDraft(client: ClientWithStats): Draft {
  return {
    name: client.name ?? "",
    service_line: client.service_line ?? "",
    tier: client.tier ?? "",
    lead_channel: client.lead_channel ?? "",
    start_date: client.start_date ?? "",
    end_date: client.end_date ?? "",
    monthly_fee: client.monthly_fee == null ? "" : String(client.monthly_fee),
    last_scope_review: client.last_scope_review ?? "",
    price_review_status: client.price_review_status ?? "none",
    notes: client.notes ?? "",
  };
}

export function ClientSheet({
  open,
  client,
  onOpenChange,
}: {
  open: boolean;
  client: ClientWithStats | null;
  onOpenChange: (open: boolean) => void;
}) {
  const lists = useListItems();
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(client ? toDraft(client) : emptyDraft);
    setConfirmText("");
  }, [open, client]);

  const set = <K extends keyof Draft>(key: K) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    if (!draft.name.trim()) {
      toast.error("A client needs a name");
      return;
    }
    const patch = {
      name: draft.name.trim(),
      service_line: draft.service_line || null,
      tier: draft.tier || null,
      lead_channel: draft.lead_channel || null,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      monthly_fee: draft.monthly_fee === "" ? null : Number(draft.monthly_fee),
      last_scope_review: draft.last_scope_review || null,
      price_review_status: draft.price_review_status,
      notes: draft.notes || null,
    };
    try {
      if (client?.id) await update.mutateAsync({ id: client.id, patch });
      else await create.mutateAsync(patch);
      toast.success(client?.id ? "Client updated" : "Client added");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the client");
    }
  }

  async function destroy() {
    if (!client?.id) return;
    try {
      await remove.mutateAsync(client.id);
      toast.success("Client deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the client");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{client?.id ? client.name : "Add a client"}</SheetTitle>
          <SheetDescription>End date blank means the client is still active.</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="hours" disabled={!client?.id}>
              Hours
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p>Never delete a lost client, add an end date. Churn and LTV need them.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" id="client-name">
                <Input id="client-name" value={draft.name} onChange={(e) => set("name")(e.target.value)} />
              </Field>
              <Field label="Monthly fee" id="client-fee">
                <Input
                  id="client-fee"
                  type="number"
                  min={0}
                  step={50}
                  value={draft.monthly_fee}
                  onChange={(e) => set("monthly_fee")(e.target.value)}
                />
              </Field>
              <ListField
                label="Service line"
                value={draft.service_line}
                onChange={set("service_line")}
                options={(lists.data?.service_line ?? []).map((i) => i.value)}
              />
              <ListField
                label="Tier"
                value={draft.tier}
                onChange={set("tier")}
                options={(lists.data?.tier ?? []).map((i) => i.value)}
              />
              <ListField
                label="Lead channel"
                value={draft.lead_channel}
                onChange={set("lead_channel")}
                options={(lists.data?.channel ?? []).map((i) => i.value)}
              />
              <Field label="Price review" id="client-review">
                <Select value={draft.price_review_status} onValueChange={set("price_review_status")}>
                  <SelectTrigger id="client-review">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_REVIEW_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Start date" id="client-start">
                <Input
                  id="client-start"
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => set("start_date")(e.target.value)}
                />
              </Field>
              <Field label="End date (blank = active)" id="client-end">
                <Input
                  id="client-end"
                  type="date"
                  value={draft.end_date}
                  onChange={(e) => set("end_date")(e.target.value)}
                />
              </Field>
              <Field label="Last scope review" id="client-scope">
                <Input
                  id="client-scope"
                  type="date"
                  value={draft.last_scope_review}
                  onChange={(e) => set("last_scope_review")(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Notes" id="client-notes">
              <Textarea
                id="client-notes"
                rows={3}
                value={draft.notes}
                onChange={(e) => set("notes")(e.target.value)}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={create.isPending || update.isPending}>
                {create.isPending || update.isPending ? "Saving…" : "Save client"}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>

            {client?.id ? (
              <div className="rounded-md border border-destructive/40 p-3">
                <p className="text-sm font-medium">Delete this client</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Type <span className="font-medium">DELETE</span> to confirm. Prefer an end date instead.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    aria-label="Type DELETE to confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="max-w-40"
                  />
                  <Button
                    variant="destructive"
                    disabled={confirmText !== "DELETE" || remove.isPending}
                    onClick={destroy}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="hours" className="mt-4">
            {client?.id ? <HoursTab client={client} /> : null}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ListField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const id = `client-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <Field label={label} id={id}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={`Choose a ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function HoursTab({ client }: { client: ClientWithStats }) {
  const hours = useClientHours(client.id ?? null);
  const packages = usePackages();
  const lists = useListItems();
  const log = useLogClientHours();
  const today = todayInBrisbane();

  const [date, setDate] = useState(today);
  const [person, setPerson] = useState("");
  const [role, setRole] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  const packageHours = useMemo(() => {
    const pkg = (packages.data ?? []).find((p) => p.tier === client.tier);
    if (!pkg) return null;
    const total = packageTotalHours(pkg.hours_by_role as Record<string, unknown>);
    return total > 0 ? total : null;
  }, [packages.data, client.tier]);

  const summary = useMemo(
    () => clientHoursSummary(hours.data ?? [], today, client.monthly_fee, packageHours),
    [hours.data, today, client.monthly_fee, packageHours],
  );

  async function submit() {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Hours must be more than 0");
      return;
    }
    try {
      await log.mutateAsync({
        client_id: client.id!,
        date,
        person: person || null,
        role: role || null,
        hours: numeric,
        note: note || null,
      });
      toast.success("Hours logged");
      setValue("");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log the hours");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Last 4 weeks" value={`${summary.last4Weeks.toFixed(1)} h`} />
        <Stat label="Hours per month" value={`${summary.hoursPerMonth.toFixed(1)} h`} />
        <Stat label="Fee per hour" value={summary.hoursPerMonth ? formatMoney(summary.feePerHour) : "—"} />
      </div>

      {summary.overScope ? (
        <p className="flex items-center gap-2 rounded-md border border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10 p-3 text-sm">
          <AlertTriangle aria-hidden className="size-4 shrink-0 text-[var(--status-critical)]" />
          <span>Consistently over scope: have the conversation</span>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" id="hours-date">
          <Input id="hours-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Person" id="hours-person">
          <Input id="hours-person" value={person} onChange={(e) => setPerson(e.target.value)} />
        </Field>
        <ListField
          label="Role"
          value={role}
          onChange={setRole}
          options={(lists.data?.role ?? []).map((i) => i.value)}
        />
        <Field label="Hours" id="hours-value">
          <Input
            id="hours-value"
            type="number"
            min={0}
            step={0.25}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note" id="hours-note">
            <Input id="hours-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
      <Button onClick={submit} disabled={log.isPending}>
        {log.isPending ? "Saving…" : "Log hours"}
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(hours.data ?? []).slice(0, 20).map((row) => (
            <TableRow key={row.id}>
              <TableCell>{formatDate(row.date)}</TableCell>
              <TableCell>{row.person ?? "—"}</TableCell>
              <TableCell>{row.role ?? "—"}</TableCell>
              <TableCell className="text-right">{Number(row.hours).toFixed(2)}</TableCell>
            </TableRow>
          ))}
          {!(hours.data ?? []).length ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                No hours logged yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
