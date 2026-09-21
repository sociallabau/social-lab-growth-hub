import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StaffSheet } from "@/components/capacity/staff-sheet";
import { ClientMargins } from "@/components/capacity/client-margins";
import {
  useClientCosts,
  useClients,
  useListValues,
  useLocationDefaults,
  useSettings,
  useStaff,
  type Staff as StaffRow,
} from "@/hooks/use-data";
import {
  marginOutlook,
  productionHoursPerMonth,
  type LocationDefaults,
  type Staff as CapacityStaff,
} from "@/lib/capacity";
import { clientStatus } from "@/lib/metrics";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const hours = (value: number) => `${Math.round(value)} h`;

const toCapacityStaff = (s: StaffRow): CapacityStaff => ({
  name: s.name,
  role: s.role,
  location: s.location,
  hours_per_week: s.hours_per_week,
  annual_leave_weeks: s.annual_leave_weeks,
  public_holidays_days: s.public_holidays_days,
  sick_days: s.sick_days,
  training_days: s.training_days,
  utilisation: s.utilisation,
  annual_cost: s.annual_cost,
  pay_rise_per_year: s.pay_rise_per_year,
});

export function CapacityPage() {
  const { data: settings } = useSettings();
  const { data: clients = [] } = useClients();
  const { data: tiers = [] } = useListValues("tier");

  if (!settings) return <p className="text-sm text-muted-foreground">Loading capacity…</p>;

  return (
    <>
      <PageHeader title="Capacity" description="Net margin per client and tier, and whether we're on track." />

      <div className="space-y-6">
        <ClientMargins settings={settings} clients={clients} tiers={tiers.filter((t) => t !== "Unallocated")} />
        <TeamPlanning />
      </div>
    </>
  );
}

/** Team hours and payroll, tucked away below the margins. */
function TeamPlanning() {
  const { data: settings } = useSettings();
  const { data: staff = [] } = useStaff();
  const { data: locations = [] } = useLocationDefaults();
  const { data: clients = [] } = useClients();
  const { data: costs = [] } = useClientCosts();
  const { data: roles = [] } = useListValues("role");

  const [open, setOpen] = useState(false);
  const [sheetStaff, setSheetStaff] = useState<StaffRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const defaults = useMemo(() => {
    const map: Record<string, LocationDefaults> = {};
    for (const l of locations) map[l.location] = l as LocationDefaults;
    return map;
  }, [locations]);

  const roleList = useMemo(() => {
    const set = new Set<string>(roles);
    for (const s of staff) if (s.role) set.add(s.role);
    return [...set];
  }, [roles, staff]);

  const productionHours = (s: StaffRow) => {
    const def = defaults[s.location] ?? defaults["Australia"];
    return def ? productionHoursPerMonth(toCapacityStaff(s), def) : 0;
  };

  const active = useMemo(() => clients.filter((c) => clientStatus(c) === "Active"), [clients]);
  const mrr = active.reduce((s, c) => s + (Number(c.monthly_fee) || 0), 0);

  // Hours the team has in a month against the hours entered for active clients.
  const teamHours = staff.reduce((s, x) => s + productionHours(x), 0);
  const activeIds = new Set(active.map((c) => c.id));
  const clientHours = costs
    .filter((c) => activeIds.has(c.client_id))
    .reduce((s, c) => s + (Number(c.filming_hours) || 0) + (Number(c.editing_hours) || 0) + (Number(c.social_hours) || 0), 0);
  const planCeiling = Number(settings?.plan_ceiling ?? 0.85);
  const used = teamHours ? clientHours / teamHours : 0;

  const priceIncrease =
    settings && Number(settings.price_point_current) > 0
      ? Number(settings.price_point_mid) / Number(settings.price_point_current) - 1
      : 0;
  const outlook = settings
    ? marginOutlook(mrr, staff.map(toCapacityStaff), priceIncrease, Number(settings.target_labour_pct))
    : [];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left">
          <span>
            <span className="block font-semibold">Team capacity and planning</span>
            <span className="block text-sm text-muted-foreground">
              Team hours and cost, client hours against them, and payroll over the next two years.
            </span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-6 border-t p-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client hours against team hours</CardTitle>
            <CardDescription>
              Monthly hours entered for active clients above, against the team's production hours. Plan to stay under{" "}
              {formatPercent(planCeiling)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span>
                <strong className="text-lg tabular-nums">{hours(clientHours)}</strong> needed of{" "}
                <span className="tabular-nums">{hours(teamHours)}</span> available
              </span>
              <span className={cn("tabular-nums", used > planCeiling && "text-alert")}>{formatPercent(used)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  used > 1 ? "bg-alert" : used > planCeiling ? "bg-warning" : "bg-good",
                )}
                style={{ width: `${Math.min(100, used * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-base">Team</CardTitle>
              <CardDescription>Cost per production hour is a good guide for the hourly rates above.</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setSheetStaff(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="size-4" /> Add someone
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Hours/week</TableHead>
                    <TableHead className="text-right">Annual cost</TableHead>
                    <TableHead className="text-right">Production h/month</TableHead>
                    <TableHead className="text-right">Cost per production hour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => {
                    const def = defaults[s.location] ?? defaults["Australia"];
                    const production = productionHours(s);
                    const costPerHour = production ? (Number(s.annual_cost) || 0) / 12 / production : 0;
                    return (
                      <TableRow
                        key={s.id}
                        className="cursor-pointer"
                        onClick={() => {
                          setSheetStaff(s);
                          setSheetOpen(true);
                        }}
                      >
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.role ?? "—"}</TableCell>
                        <TableCell className="text-right">{s.hours_per_week ?? def?.hours_per_week ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatMoney(Number(s.annual_cost) || 0)}</TableCell>
                        <TableCell className="text-right">{hours(production)}</TableCell>
                        <TableCell className="text-right">{costPerHour ? formatMoney(costPerHour) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!staff.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nobody on the team yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payroll outlook</CardTitle>
            <CardDescription>
              Current client fees against total team cost, assuming a {formatPercent(priceIncrease)} price rise a year and
              known pay rises.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Revenue/mo</TableHead>
                  <TableHead className="text-right">Team cost/mo</TableHead>
                  <TableHead className="text-right">Labour %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outlook.map((m) => {
                  const over = m.labourPct > m.targetLabourPct;
                  return (
                    <TableRow key={m.period}>
                      <TableCell className="font-medium">{m.period}</TableCell>
                      <TableCell className="text-right">{formatMoney(m.monthlyRevenue)}</TableCell>
                      <TableCell className="text-right">{formatMoney(m.monthlyTeamCost)}</TableCell>
                      <TableCell className={`text-right ${over ? "text-alert" : "text-good"}`}>
                        <span className="inline-flex items-center gap-1">
                          {over ? <AlertTriangle className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
                          {formatPercent(m.labourPct)}
                          <span className="text-xs text-muted-foreground">/ {formatPercent(m.targetLabourPct)}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </CollapsibleContent>

      <StaffSheet
        staff={sheetStaff}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        roles={roleList}
        locations={locations}
      />
    </Collapsible>
  );
}
