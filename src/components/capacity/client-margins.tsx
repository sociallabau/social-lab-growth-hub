import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useClientCosts,
  useSaveClientCost,
  useUpdateClient,
  useUpdateSettings,
  type Client,
  type ClientCost,
  type Settings,
} from "@/hooks/use-data";
import {
  clientMargin,
  COST_AREAS,
  flagClient,
  marginTotals,
  NO_TIER,
  tierMargins,
  type ClientMargin,
  type CostArea,
  type DefaultRates,
  type MarginTotals,
  type TierMargin,
} from "@/lib/client-margins";
import { clientStatus } from "@/lib/metrics";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const AREA_LABEL: Record<CostArea, string> = {
  filming: "Filming + travel",
  editing: "Editing",
  social: "Social (scheduling, posting, ads)",
};
const AREA_SHORT: Record<CostArea, string> = { filming: "Filming", editing: "Editing", social: "Social" };

type CostField = `${CostArea}_hours` | `${CostArea}_rate` | "other_cost";

const hours = (value: number) => `${Math.round(value * 10) / 10} h`;
const pct = (value: number | null) => formatPercent(value);

/** Parses a cost input: blank clears it, anything else must be a number of 0 or more. */
function parseAmount(raw: string): number | null | undefined {
  const trimmed = raw.replace(/[$,\s]/g, "");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isNaN(value) || value < 0 ? undefined : value;
}

export function ClientMargins({ settings, clients, tiers }: { settings: Settings; clients: Client[]; tiers: string[] }) {
  const { data: costs = [] } = useClientCosts();
  const [sort, setSort] = useState<"tier" | "margin">("tier");

  const defaults: DefaultRates = {
    filming: settings.default_filming_rate,
    editing: settings.default_editing_rate,
    social: settings.default_social_rate,
  };

  const costsById = useMemo(() => new Map(costs.map((c) => [c.client_id, c])), [costs]);
  const active = useMemo(() => clients.filter((c) => clientStatus(c) === "Active"), [clients]);

  const rows = useMemo(
    () => active.map((c) => clientMargin(c, costsById.get(c.id), defaults)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, costsById, defaults.filming, defaults.editing, defaults.social],
  );
  const tierRows = useMemo(() => tierMargins(rows, tiers), [rows, tiers]);
  const totals = useMemo(() => marginTotals(rows), [rows]);

  // Falls back to 50% until the target_net_margin column exists.
  const target = Number(settings.target_net_margin ?? 0.5);

  const ranked = tierRows.filter((t) => t.marginPct !== null && t.costedClients > 0);
  const best = ranked.length > 1 ? ranked[0] : null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const sorted = useMemo(() => {
    const order = (tier: string) => (tiers.includes(tier) ? tiers.indexOf(tier) : tiers.length);
    return [...rows].sort((a, b) => {
      if (sort === "margin") {
        if (a.costed !== b.costed) return a.costed ? -1 : 1;
        return (a.marginPct ?? 0) - (b.marginPct ?? 0);
      }
      return order(a.tier) - order(b.tier) || a.name.localeCompare(b.name);
    });
  }, [rows, sort, tiers]);

  const flags = useMemo(() => new Map(rows.map((r) => [r.id, flagClient(r, tierRows)])), [rows, tierRows]);
  const flagged = rows.filter((r) => flags.get(r.id)!.reasons.length);

  return (
    <section className="space-y-6">
      <MarginHeadline totals={totals} target={target} />

      <Card>
        <CardHeader>
          <CardTitle>Net margin by tier</CardTitle>
          <CardDescription>
            Monthly averages per client, best tier first. Only clients with costs entered count
            ({totals.costedClients} of {totals.clients} active). The range shows the gap between the easiest and hardest
            client in each tier.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                  <TableHead className="text-right">Avg revenue</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead className="text-right">Avg net margin</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Margin range</TableHead>
                  <TableHead className="text-right">Avg hours</TableHead>
                  <TableHead className="text-right">Profit / hour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tierRows.map((t) => (
                  <TierRow key={t.tier} row={t} best={t === best} worst={t === worst} target={target} />
                ))}
                {!tierRows.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                      No active clients yet. Add them on the Clients page.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {flagged.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-alert" aria-hidden /> Clients costing more than their tier
            </CardTitle>
            <CardDescription>
              Candidates for a scope review or price conversation. Flagged when losing money, more than 10 points below
              their tier's margin, or taking 25%+ more hours than the tier average.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {flagged.map((r) => {
              const f = flags.get(r.id)!;
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-2 text-muted-foreground">{r.tier}</span>
                  </span>
                  <span className="text-right text-muted-foreground">
                    {pct(r.marginPct)} margin
                    {f.marginVsTier !== null ? ` (${f.marginVsTier > 0 ? "+" : ""}${Math.round(f.marginVsTier * 100)} pts vs tier)` : ""}
                    {f.hoursVsTier !== null ? ` · ${hours(r.hours)}, ${Math.round((f.hoursVsTier - 1) * 100)}% vs tier avg` : ""}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <DefaultRatesCard settings={settings} />

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">Net margin per client</CardTitle>
            <CardDescription>
              Monthly hours and hourly cost for each part of delivery. A blank rate uses the default above. Revenue is the
              monthly fee from the Clients page.
            </CardDescription>
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as "tier" | "margin")}>
            <SelectTrigger className="w-44" aria-label="Sort clients">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tier">Sort by tier</SelectItem>
              <SelectItem value="margin">Lowest margin first</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Client</TableHead>
                  <TableHead rowSpan={2}>Tier</TableHead>
                  <TableHead rowSpan={2} className="text-right">Revenue</TableHead>
                  {COST_AREAS.map((area) => (
                    <TableHead key={area} colSpan={2} className="border-l text-center" title={AREA_LABEL[area]}>
                      {AREA_SHORT[area]}
                    </TableHead>
                  ))}
                  <TableHead rowSpan={2} className="border-l text-right">Other $</TableHead>
                  <TableHead rowSpan={2} className="text-right">Total cost</TableHead>
                  <TableHead rowSpan={2} className="text-right">Net margin</TableHead>
                  <TableHead rowSpan={2} className="text-right">Margin</TableHead>
                </TableRow>
                <TableRow>
                  {COST_AREAS.map((area) => (
                    <Fragment key={area}>
                      <TableHead className="border-l text-right text-xs">Hours</TableHead>
                      <TableHead className="text-right text-xs">$/hour</TableHead>
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <ClientRow
                    key={row.id}
                    row={row}
                    cost={costsById.get(row.id)}
                    client={active.find((c) => c.id === row.id)!}
                    defaults={defaults}
                    tiers={tiers}
                    flagged={flags.get(row.id)!.reasons.length > 0}
                  />
                ))}
                {!sorted.length ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-6 text-center text-sm text-muted-foreground">
                      No active clients yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/** The one number that matters: net margin across costed clients, against the target. */
function MarginHeadline({ totals, target }: { totals: MarginTotals; target: number }) {
  const known = totals.costedClients > 0 && totals.marginPct !== null;
  const onTrack = known && totals.marginPct! >= target;
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-label">Net margin</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <strong className={cn("text-5xl font-bold tracking-tight tabular-nums", known && !onTrack && "text-alert")}>
          {known ? pct(totals.marginPct) : "—"}
        </strong>
        {known ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm font-medium uppercase tracking-wide",
              onTrack ? "text-good" : "text-alert",
            )}
          >
            {onTrack ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
            {onTrack ? "On track" : `${Math.round((target - totals.marginPct!) * 100)} pts below target`}
          </span>
        ) : null}
        <span className="text-sm text-muted-foreground">Target {pct(target)} (set in Settings)</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {known
          ? `${formatMoney(totals.netMargin)} a month on ${formatMoney(totals.revenue)} revenue · ${formatMoney(totals.avgNetMargin)} per client`
          : "Enter hours for each client below to see your margin."}
        {known && totals.costedClients < totals.clients
          ? ` · ${totals.clients - totals.costedClients} of ${totals.clients} clients still need costs`
          : ""}
      </p>
    </div>
  );
}

function TierRow({ row, best, worst, target }: { row: TierMargin; best: boolean; worst: boolean; target: number }) {
  const costed = row.costedClients > 0;
  const dash = <span className="text-muted-foreground">—</span>;
  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-2">
          {row.tier}
          {best ? (
            <Badge className="gap-1 bg-good-soft text-good">
              <ArrowUp className="size-3" aria-hidden /> Best
            </Badge>
          ) : null}
          {worst ? (
            <Badge className="gap-1 bg-alert-soft text-alert">
              <ArrowDown className="size-3" aria-hidden /> Lowest
            </Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {row.costedClients === row.clients ? row.clients : `${row.costedClients} of ${row.clients}`}
      </TableCell>
      <TableCell className="text-right">{costed ? formatMoney(row.avgRevenue) : dash}</TableCell>
      <TableCell className="text-right">{costed ? formatMoney(row.avgCost) : dash}</TableCell>
      <TableCell className={cn("text-right font-medium", row.avgNetMargin < 0 && "text-alert")}>
        {costed ? formatMoney(row.avgNetMargin) : dash}
      </TableCell>
      <TableCell className={cn("text-right", row.marginPct !== null && row.marginPct < target && "text-alert")}>
        {costed ? pct(row.marginPct) : dash}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {row.lowestMarginPct === null
          ? "—"
          : row.costedClients < 2
            ? pct(row.lowestMarginPct)
            : `${pct(row.lowestMarginPct)} – ${pct(row.highestMarginPct)}`}
      </TableCell>
      <TableCell className="text-right">{costed ? hours(row.avgHours) : dash}</TableCell>
      <TableCell className="text-right">{row.profitPerHour === null ? dash : formatMoney(row.profitPerHour)}</TableCell>
    </TableRow>
  );
}

function ClientRow({
  row,
  cost,
  client,
  defaults,
  tiers,
  flagged,
}: {
  row: ClientMargin;
  cost: ClientCost | undefined;
  client: Client;
  defaults: DefaultRates;
  tiers: string[];
  flagged: boolean;
}) {
  const save = useSaveClientCost();
  const updateClient = useUpdateClient();

  const commit = (field: CostField, raw: string) => {
    const value = parseAmount(raw);
    if (value === undefined) {
      toast.error("Enter a number of 0 or more");
      return;
    }
    const current = cost?.[field] ?? null;
    if ((current === null ? null : Number(current)) === value) return;
    save.mutate({ client_id: row.id, [field]: value }, { onError: (error) => toast.error(error.message) });
  };

  const tierOptions = client.tier && !tiers.includes(client.tier) ? [...tiers, client.tier] : tiers;

  const numberCell = (field: CostField, opts: { placeholder?: string; border?: boolean; label: string }) => (
    <TableCell className={cn("text-right", opts.border && "border-l")}>
      <Input
        aria-label={`${row.name} ${opts.label}`}
        className="ml-auto h-8 w-20 text-right"
        inputMode="decimal"
        placeholder={opts.placeholder}
        defaultValue={cost?.[field] == null ? "" : String(cost[field])}
        onBlur={(e) => commit(field, e.target.value)}
      />
    </TableCell>
  );

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-1.5">
          {flagged ? <AlertTriangle className="size-3.5 text-alert" aria-label="Costing more than their tier" /> : null}
          {row.name}
        </span>
      </TableCell>
      <TableCell>
        <Select
          value={client.tier ?? ""}
          onValueChange={(tier) =>
            updateClient.mutate({ id: client.id, patch: { tier } }, { onError: (error) => toast.error(error.message) })
          }
        >
          <SelectTrigger className="h-8 w-32" aria-label={`${row.name} tier`}>
            <SelectValue placeholder={NO_TIER} />
          </SelectTrigger>
          <SelectContent>
            {tierOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {client.monthly_fee == null ? <span className="text-alert">No fee</span> : formatMoney(row.revenue)}
      </TableCell>
      {COST_AREAS.map((area) => (
        <Fragment key={area}>
          {numberCell(`${area}_hours`, { border: true, label: `${AREA_SHORT[area]} hours` })}
          {numberCell(`${area}_rate`, {
            placeholder: defaults[area] == null ? "rate" : String(defaults[area]),
            label: `${AREA_SHORT[area]} hourly rate`,
          })}
        </Fragment>
      ))}
      {numberCell("other_cost", { border: true, label: "other monthly cost" })}
      <TableCell className="text-right tabular-nums">
        {row.costed ? formatMoney(row.totalCost) : <span className="text-muted-foreground">—</span>}
        {row.missingRates.length ? (
          <span className="block text-xs text-alert">No {row.missingRates.map((a) => AREA_SHORT[a].toLowerCase()).join(", ")} rate</span>
        ) : null}
      </TableCell>
      <TableCell className={cn("text-right font-medium tabular-nums", row.costed && row.netMargin < 0 && "text-alert")}>
        {row.costed ? formatMoney(row.netMargin) : <span className="font-normal text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", row.costed && (row.marginPct ?? 0) < 0 && "text-alert")}>
        {row.costed ? pct(row.marginPct) : <span className="text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}

function DefaultRatesCard({ settings }: { settings: Settings }) {
  const update = useUpdateSettings();
  const fields: { key: "default_filming_rate" | "default_editing_rate" | "default_social_rate"; area: CostArea }[] = [
    { key: "default_filming_rate", area: "filming" },
    { key: "default_editing_rate", area: "editing" },
    { key: "default_social_rate", area: "social" },
  ];

  const commit = (key: (typeof fields)[number]["key"], raw: string) => {
    const value = parseAmount(raw);
    if (value === undefined) {
      toast.error("Enter a number of 0 or more");
      return;
    }
    if ((settings[key] === null ? null : Number(settings[key])) === value) return;
    update.mutate({ [key]: value }, { onError: (error) => toast.error(error.message) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Default hourly rates</CardTitle>
        <CardDescription>What an hour of each costs you, including super. Used wherever a client's rate is blank.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {fields.map(({ key, area }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={key}>
              {AREA_LABEL[area]} ($/hour)
            </label>
            <Input
              id={key}
              inputMode="decimal"
              defaultValue={settings[key] == null ? "" : String(settings[key])}
              onBlur={(e) => commit(key, e.target.value)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
