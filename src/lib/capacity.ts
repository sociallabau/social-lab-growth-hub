// Capacity planner, ported from the "Team" and "Capacity Planner" tabs.

export interface LocationDefaults {
  location: string;
  hours_per_week: number;
  annual_leave_weeks: number;
  public_holidays_days: number;
  sick_days: number;
  training_days: number;
  utilisation: number;
}

export interface Staff {
  name: string;
  role: string | null;
  location: string;
  hours_per_week?: number | null;
  annual_leave_weeks?: number | null;
  public_holidays_days?: number | null;
  sick_days?: number | null;
  training_days?: number | null;
  utilisation?: number | null;
  annual_cost?: number | null;
  pay_rise_per_year?: number | null;
}

export interface Package {
  tier: string;
  price: number | null;
  planned_volume?: number | null;
  hours_by_role: Record<string, number>;
}

const pick = (v: number | null | undefined, fallback: number) => (v === null || v === undefined ? fallback : Number(v));
const div = (a: number, b: number) => (b ? a / b : 0);

/** Hours worked per year after leave, public holidays, sick and training days. */
export function hoursWorkedPerYear(s: Staff, d: LocationDefaults): number {
  const hpw = pick(s.hours_per_week, d.hours_per_week);
  const days = pick(s.public_holidays_days, d.public_holidays_days) + pick(s.sick_days, d.sick_days) + pick(s.training_days, d.training_days);
  return Math.max(0, hpw * 52 - pick(s.annual_leave_weeks, d.annual_leave_weeks) * hpw - (days * hpw) / 5);
}

export function productionHoursPerMonth(s: Staff, d: LocationDefaults): number {
  return (hoursWorkedPerYear(s, d) * pick(s.utilisation, d.utilisation)) / 12;
}

export type CapacityStatus = "-" | "Nobody on the team has this role" | "Over capacity: reprice, cut scope or hire" | "Stretched: above your planning ceiling" | "Room to grow";

export interface RoleCapacity {
  role: string;
  people: number;
  availableHours: number;
  plannableHours: number;
  requiredHours: number;
  utilisation: number;
  spareHours: number;
  costPerHour: number;
  extraFteNeeded: number;
  status: CapacityStatus;
}

export function capacityByRole(
  roles: string[],
  staff: Staff[],
  packages: Package[],
  activeClientsByTier: Record<string, number>,
  defaults: Record<string, LocationDefaults>,
  planCeiling: number,
): RoleCapacity[] {
  const au = defaults["Australia"];
  const newHireHours = au ? productionHoursPerMonth({ name: "", role: null, location: "Australia" }, au) : 0;
  return roles.map((role) => {
    const team = staff.filter((s) => s.role === role && s.name);
    const availableHours = team.reduce((sum, s) => sum + productionHoursPerMonth(s, defaults[s.location] ?? au!), 0);
    const annualCost = team.reduce((sum, s) => sum + (Number(s.annual_cost) || 0), 0);
    const requiredHours = packages.reduce((sum, p) => sum + (Number(p.hours_by_role[role]) || 0) * volumeUsed(p, activeClientsByTier), 0);
    const plannableHours = availableHours * planCeiling;
    const spareHours = plannableHours - requiredHours;
    const hoursPerPerson = team.length ? availableHours / team.length : newHireHours;
    let status: CapacityStatus;
    if (!availableHours && !requiredHours) status = "-";
    else if (!availableHours) status = "Nobody on the team has this role";
    else if (requiredHours > availableHours) status = "Over capacity: reprice, cut scope or hire";
    else if (requiredHours > plannableHours) status = "Stretched: above your planning ceiling";
    else status = "Room to grow";
    return {
      role,
      people: team.length,
      availableHours,
      plannableHours,
      requiredHours,
      utilisation: div(requiredHours, availableHours),
      spareHours,
      costPerHour: div(annualCost, availableHours * 12),
      extraFteNeeded: spareHours >= 0 ? 0 : div(-spareHours, hoursPerPerson * planCeiling),
      status,
    };
  });
}

export function volumeUsed(p: Package, activeClientsByTier: Record<string, number>): number {
  return p.planned_volume ?? activeClientsByTier[p.tier] ?? 0;
}

/** Extra clients of each package the current team could take; the bottleneck role runs out first. */
export function headroomByPackage(packages: Package[], roles: RoleCapacity[]) {
  return packages.map((p) => {
    const perRole = roles
      .filter((r) => Number(p.hours_by_role[r.role]) > 0)
      .map((r) => ({ role: r.role, clients: Math.max(0, r.spareHours / Number(p.hours_by_role[r.role])) }));
    const bottleneck = perRole.length ? perRole.reduce((a, b) => (b.clients < a.clients ? b : a)) : null;
    return { tier: p.tier, extraClients: bottleneck ? Math.floor(bottleneck.clients) : null, bottleneckRole: bottleneck?.role ?? null };
  });
}

/** Margin now, in 12 and in 24 months, with known pay rises and a planned yearly price increase. */
export function marginOutlook(packages: Package[], activeClientsByTier: Record<string, number>, staff: Staff[], priceIncreaseYearly: number, targetLabourPct: number) {
  const revenueNow = packages.reduce((s, p) => s + (Number(p.price) || 0) * volumeUsed(p, activeClientsByTier), 0);
  const baseCost = staff.reduce((s, x) => s + (Number(x.annual_cost) || 0), 0);
  const rises = staff.reduce((s, x) => s + (Number(x.pay_rise_per_year) || 0), 0);
  return [0, 1, 2].map((years) => {
    const revenue = revenueNow * Math.pow(1 + priceIncreaseYearly, years);
    const teamCost = (baseCost + rises * years) / 12;
    return {
      period: years === 0 ? "Now" : `In ${years * 12} months`,
      monthlyRevenue: revenue,
      monthlyTeamCost: teamCost,
      labourPct: div(teamCost, revenue),
      targetLabourPct,
      grossProfit: revenue - teamCost,
    };
  });
}

// ---------------------------------------------------------------------------
// Economics per tier: what each tier earns, what it costs in delivery hours,
// and whether the cheap tiers are quietly eating the expensive ones.
// ---------------------------------------------------------------------------

export interface TierClient {
  id?: string;
  tier: string | null;
  monthly_fee: number | null;
}

export interface HoursEntry {
  client_id: string;
  role: string | null;
  hours: number;
}

export interface TierEconomics {
  tier: string;
  clients: number;
  mrr: number;
  averageFee: number;
  plannedHours: number;
  actualHours: number | null;
  hoursPerClient: number | null;
  deliveryCost: number;
  grossProfit: number;
  marginPct: number;
  revenuePerHour: number | null;
  overPlanHoursPerClient: number | null;
}

const hoursSum = (h: Record<string, number>) => Object.values(h).reduce((s, v) => s + (Number(v) || 0), 0);

/**
 * Per tier, using logged hours where they exist and package hours otherwise.
 * `hours` covers `weeks` of logging and is scaled to a month.
 */
export function tierEconomics(
  clients: TierClient[],
  packages: Package[],
  hours: HoursEntry[],
  roleCostPerHour: Record<string, number>,
  weeks = 4,
): TierEconomics[] {
  const tiers = [...new Set([...packages.map((p) => p.tier), ...clients.map((c) => c.tier ?? "No tier")])];
  const clientTier = new Map(clients.map((c) => [c.id ?? "", c.tier ?? "No tier"]));
  const monthFactor = weeks > 0 ? 52 / 12 / weeks : 0;

  return tiers.map((tier) => {
    const rows = clients.filter((c) => (c.tier ?? "No tier") === tier);
    const pkg = packages.find((p) => p.tier === tier);
    const planPerClient = pkg ? hoursSum(pkg.hours_by_role) : 0;
    const mrr = rows.reduce((s, c) => s + (Number(c.monthly_fee) || 0), 0);

    const logged = hours.filter((h) => clientTier.get(h.client_id) === tier);
    const actualHours = logged.length ? logged.reduce((s, h) => s + (Number(h.hours) || 0), 0) * monthFactor : null;
    const hoursUsed = actualHours ?? planPerClient * rows.length;

    // Cost the hours actually logged at each role's rate; fall back to the package mix.
    let deliveryCost = 0;
    if (logged.length) {
      for (const h of logged) {
        deliveryCost += (Number(h.hours) || 0) * monthFactor * (roleCostPerHour[h.role ?? ""] ?? 0);
      }
    } else if (pkg) {
      for (const [role, roleHours] of Object.entries(pkg.hours_by_role)) {
        deliveryCost += (Number(roleHours) || 0) * rows.length * (roleCostPerHour[role] ?? 0);
      }
    }

    const grossProfit = mrr - deliveryCost;
    return {
      tier,
      clients: rows.length,
      mrr,
      averageFee: div(mrr, rows.length),
      plannedHours: planPerClient * rows.length,
      actualHours,
      hoursPerClient: actualHours === null ? (planPerClient || null) : div(actualHours, rows.length),
      deliveryCost,
      grossProfit,
      marginPct: div(grossProfit, mrr),
      revenuePerHour: hoursUsed > 0 ? div(mrr, hoursUsed) : null,
      overPlanHoursPerClient:
        actualHours !== null && planPerClient > 0 ? div(actualHours, rows.length) - planPerClient : null,
    };
  }).sort((a, b) => b.mrr - a.mrr);
}

/** The tier returning the least revenue per delivery hour, which is where to look first. */
export function weakestTier(rows: TierEconomics[]): TierEconomics | null {
  const measurable = rows.filter((r) => r.clients > 0 && r.revenuePerHour !== null);
  if (!measurable.length) return null;
  return measurable.reduce((a, b) => ((b.revenuePerHour ?? 0) < (a.revenuePerHour ?? 0) ? b : a));
}
