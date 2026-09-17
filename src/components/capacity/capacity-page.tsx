import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Plus, TrendingUp, UserX } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StaffSheet } from "@/components/capacity/staff-sheet";
import {
  useClients,
  useListValues,
  useLocationDefaults,
  usePackages,
  useSaveLocationDefaults,
  useSavePackage,
  useSettings,
  useStaff,
  type LocationDefault,
  type Package as PackageRow,
  type Staff as StaffRow,
} from "@/hooks/use-data";
import {
  capacityByRole,
  headroomByPackage,
  marginOutlook,
  productionHoursPerMonth,
  volumeUsed,
  type LocationDefaults,
  type Package as CapacityPackage,
  type RoleCapacity,
  type Staff as CapacityStaff,
} from "@/lib/capacity";
import { clientStatus } from "@/lib/metrics";
import { formatMoney, formatPercent } from "@/lib/format";

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

const toCapacityPackage = (p: PackageRow): CapacityPackage => ({
  tier: p.tier,
  price: p.price,
  planned_volume: p.planned_volume,
  hours_by_role: (p.hours_by_role ?? {}) as Record<string, number>,
});

function StatusBadge({ status }: { status: RoleCapacity["status"] }) {
  if (status === "-") return <span className="text-muted-foreground">—</span>;
  if (status === "Nobody on the team has this role")
    return (
      <Badge variant="secondary" className="gap-1">
        <UserX className="size-3.5" aria-hidden /> Nobody has this role
      </Badge>
    );
  if (status.startsWith("Over capacity"))
    return (
      <Badge className="gap-1 bg-alert-soft text-alert">
        <AlertTriangle className="size-3.5" aria-hidden /> Over capacity
      </Badge>
    );
  if (status.startsWith("Stretched"))
    return (
      <Badge className="gap-1 bg-warning-soft text-warning">
        <AlertTriangle className="size-3.5" aria-hidden /> Stretched
      </Badge>
    );
  return (
    <Badge className="gap-1 bg-good-soft text-good">
      <CheckCircle2 className="size-3.5" aria-hidden /> Room to grow
    </Badge>
  );
}

export function CapacityPage() {
  const { data: settings } = useSettings();
  const { data: staff = [] } = useStaff();
  const { data: packages = [] } = usePackages();
  const { data: locations = [] } = useLocationDefaults();
  const { data: clients = [] } = useClients();
  const { data: roles = [] } = useListValues("role");
  const { data: tiers = [] } = useListValues("tier");

  const [sheetStaff, setSheetStaff] = useState<StaffRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const defaults = useMemo(() => {
    const map: Record<string, LocationDefaults> = {};
    for (const l of locations) map[l.location] = l as LocationDefaults;
    return map;
  }, [locations]);

  const activeClientsByTier = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of clients) {
      if (clientStatus(c) !== "Active" || !c.tier) continue;
      map[c.tier] = (map[c.tier] ?? 0) + 1;
    }
    return map;
  }, [clients]);

  const capacityStaff = useMemo(() => staff.map(toCapacityStaff), [staff]);
  const capacityPackages = useMemo(() => packages.map(toCapacityPackage), [packages]);

  const roleList = useMemo(() => {
    const set = new Set<string>(roles);
    for (const s of staff) if (s.role) set.add(s.role);
    for (const p of capacityPackages) for (const key of Object.keys(p.hours_by_role)) set.add(key);
    return [...set];
  }, [roles, staff, capacityPackages]);

  const roleCapacity = useMemo(
    () =>
      settings && locations.length
        ? capacityByRole(roleList, capacityStaff, capacityPackages, activeClientsByTier, defaults, Number(settings.plan_ceiling))
        : [],
    [settings, locations.length, roleList, capacityStaff, capacityPackages, activeClientsByTier, defaults],
  );

  const headroom = useMemo(() => headroomByPackage(capacityPackages, roleCapacity), [capacityPackages, roleCapacity]);

  const priceIncrease = settings && Number(settings.price_point_current) > 0
    ? Number(settings.price_point_mid) / Number(settings.price_point_current) - 1
    : 0;

  const margin = useMemo(
    () =>
      settings
        ? marginOutlook(capacityPackages, activeClientsByTier, capacityStaff, priceIncrease, Number(settings.target_labour_pct))
        : [],
    [settings, capacityPackages, activeClientsByTier, capacityStaff, priceIncrease],
  );

  if (!settings) return <p className="text-sm text-muted-foreground">Loading capacity…</p>;

  return (
    <>
      <PageHeader title="Capacity" description="Team hours, packages and delivery headroom." />

      <p className="mb-6 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>If a role is over capacity and conversion is above 40%, reprice or tighten scope before you hire.</span>
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-base">Team</CardTitle>
              <CardDescription>Blank overrides use the location defaults.</CardDescription>
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
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Hours/week</TableHead>
                    <TableHead className="text-right">Utilisation</TableHead>
                    <TableHead className="text-right">Annual cost</TableHead>
                    <TableHead className="text-right">Production h/month</TableHead>
                    <TableHead className="text-right">Cost per production hour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => {
                    const def = defaults[s.location] ?? defaults["Australia"];
                    const production = def ? productionHoursPerMonth(toCapacityStaff(s), def) : 0;
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
                        <TableCell>{s.location}</TableCell>
                        <TableCell className="text-right">{s.hours_per_week ?? def?.hours_per_week ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatPercent(Number(s.utilisation ?? def?.utilisation ?? 0))}</TableCell>
                        <TableCell className="text-right">{formatMoney(Number(s.annual_cost) || 0)}</TableCell>
                        <TableCell className="text-right">{hours(production)}</TableCell>
                        <TableCell className="text-right">{costPerHour ? formatMoney(costPerHour) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!staff.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Nobody on the team yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <LocationDefaultsCard locations={locations} />

        <PackagesCard packages={packages} roles={roleList} tiers={tiers} activeClientsByTier={activeClientsByTier} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Capacity by role</CardTitle>
            <CardDescription>Planning ceiling {formatPercent(Number(settings.plan_ceiling))} of available hours.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">People</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Plannable</TableHead>
                    <TableHead className="text-right">Required</TableHead>
                    <TableHead>Utilisation</TableHead>
                    <TableHead className="text-right">Spare</TableHead>
                    <TableHead className="text-right">Extra FTE</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleCapacity.map((r) => (
                    <TableRow key={r.role}>
                      <TableCell className="font-medium">{r.role}</TableCell>
                      <TableCell className="text-right">{r.people}</TableCell>
                      <TableCell className="text-right">{hours(r.availableHours)}</TableCell>
                      <TableCell className="text-right">{hours(r.plannableHours)}</TableCell>
                      <TableCell className="text-right">{hours(r.requiredHours)}</TableCell>
                      <TableCell className="min-w-32">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={
                                r.utilisation > 1
                                  ? "h-full rounded-full bg-alert"
                                  : r.utilisation > Number(settings.plan_ceiling)
                                    ? "h-full rounded-full bg-warning"
                                    : "h-full rounded-full bg-good"
                              }
                              style={{ width: `${Math.min(100, r.utilisation * 100)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs text-muted-foreground">{formatPercent(r.utilisation)}</span>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right ${r.spareHours < 0 ? "text-alert" : ""}`}>{hours(r.spareHours)}</TableCell>
                      <TableCell className="text-right">{r.extraFteNeeded ? r.extraFteNeeded.toFixed(1) : "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Headroom</CardTitle>
              <CardDescription>Extra clients the current team could take.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {headroom.map((h) => (
                <div key={h.tier} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{h.tier}</span>
                  <span className="text-right">
                    {h.extraClients === null ? "No hours planned" : `+${h.extraClients} clients`}
                    {h.bottleneckRole ? (
                      <span className="block text-xs text-muted-foreground">Bottleneck: {h.bottleneckRole}</span>
                    ) : null}
                  </span>
                </div>
              ))}
              {!headroom.length ? <p className="text-sm text-muted-foreground">Add packages to see headroom.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4" aria-hidden /> Margin outlook
              </CardTitle>
              <CardDescription>Assumes {formatPercent(priceIncrease)} price rise a year and known pay rises.</CardDescription>
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
                  {margin.map((m) => {
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
        </div>
      </div>

      <StaffSheet
        staff={sheetStaff}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        roles={roleList}
        locations={locations}
      />
    </>
  );
}

const DEFAULT_FIELDS: { key: keyof LocationDefault; label: string; percent?: boolean }[] = [
  { key: "hours_per_week", label: "Hours/week" },
  { key: "annual_leave_weeks", label: "Leave (weeks)" },
  { key: "public_holidays_days", label: "Public holidays" },
  { key: "sick_days", label: "Sick days" },
  { key: "training_days", label: "Training days" },
  { key: "utilisation", label: "Utilisation (%)", percent: true },
];

function LocationDefaultsCard({ locations }: { locations: LocationDefault[] }) {
  const save = useSaveLocationDefaults();

  const commit = (row: LocationDefault, key: keyof LocationDefault, raw: string, percent?: boolean) => {
    const value = Number(raw);
    if (raw.trim() === "" || Number.isNaN(value) || value < 0) {
      toast.error("Enter a number of 0 or more");
      return;
    }
    const next = percent ? value / 100 : value;
    if (Number(row[key]) === next) return;
    save.mutate({ ...row, [key]: next }, { onError: (error) => toast.error(error.message) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Location defaults</CardTitle>
        <CardDescription>Used whenever a person's override is blank.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {locations.map((row) => (
          <div key={row.location} className="space-y-2">
            <p className="text-sm font-medium">{row.location}</p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {DEFAULT_FIELDS.map((field) => (
                <div key={field.key as string} className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`${row.location}-${String(field.key)}`}>
                    {field.label}
                  </label>
                  <Input
                    id={`${row.location}-${String(field.key)}`}
                    inputMode="decimal"
                    defaultValue={String(field.percent ? Number(row[field.key]) * 100 : row[field.key])}
                    onBlur={(e) => commit(row, field.key, e.target.value, field.percent)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PackagesCard({
  packages,
  roles,
  tiers,
  activeClientsByTier,
}: {
  packages: PackageRow[];
  roles: string[];
  tiers: string[];
  activeClientsByTier: Record<string, number>;
}) {
  const save = useSavePackage();

  const commitNumber = (id: string, key: "price" | "planned_volume", raw: string) => {
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      toast.error("Enter a number of 0 or more");
      return;
    }
    save.mutate({ id, patch: { [key]: value } }, { onError: (error) => toast.error(error.message) });
  };

  const commitHours = (row: PackageRow, role: string, raw: string) => {
    const trimmed = raw.trim();
    const current = { ...((row.hours_by_role ?? {}) as Record<string, number>) };
    if (trimmed === "") delete current[role];
    else {
      const value = Number(trimmed);
      if (Number.isNaN(value) || value < 0) {
        toast.error("Enter a number of 0 or more");
        return;
      }
      current[role] = value;
    }
    save.mutate({ id: row.id, patch: { hours_by_role: current } }, { onError: (error) => toast.error(error.message) });
  };

  const tierOrder = tiers.length ? tiers : packages.map((p) => p.tier);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Packages</CardTitle>
        <CardDescription>Blank planned volume uses active clients on that tier.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Price ($/mo)</TableHead>
                <TableHead className="text-right">Planned volume</TableHead>
                {roles.map((role) => (
                  <TableHead key={role} className="text-right">
                    {role} h/client
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...packages]
                .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))
                .map((row) => {
                  const hoursByRole = (row.hours_by_role ?? {}) as Record<string, number>;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.tier}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="ml-auto w-28 text-right"
                          inputMode="decimal"
                          defaultValue={row.price === null ? "" : String(row.price)}
                          onBlur={(e) => commitNumber(row.id, "price", e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="ml-auto w-24 text-right"
                          inputMode="numeric"
                          placeholder={String(activeClientsByTier[row.tier] ?? 0)}
                          defaultValue={row.planned_volume === null ? "" : String(row.planned_volume)}
                          onBlur={(e) => commitNumber(row.id, "planned_volume", e.target.value)}
                        />
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Using {volumeUsed(toCapacityPackage(row), activeClientsByTier)}
                        </span>
                      </TableCell>
                      {roles.map((role) => (
                        <TableCell key={role} className="text-right">
                          <Input
                            className="ml-auto w-20 text-right"
                            inputMode="decimal"
                            defaultValue={hoursByRole[role] === undefined ? "" : String(hoursByRole[role])}
                            onBlur={(e) => commitHours(row, role, e.target.value)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
