// Net margin per client and per tier: what each client pays each month, less what
// it costs to film (incl. travel), edit and run their socials. Costs are entered
// on the Capacity page as hours x an hourly rate; a blank rate uses the default.

export type CostArea = "filming" | "editing" | "social";
export const COST_AREAS: CostArea[] = ["filming", "editing", "social"];

export interface MarginClient {
  id: string;
  name: string;
  tier: string | null;
  monthly_fee: number | null;
}

export interface ClientCosts {
  client_id: string;
  filming_hours?: number | null;
  filming_rate?: number | null;
  editing_hours?: number | null;
  editing_rate?: number | null;
  social_hours?: number | null;
  social_rate?: number | null;
  other_cost?: number | null;
}

export type DefaultRates = Record<CostArea, number | null>;

export interface ClientMargin {
  id: string;
  name: string;
  tier: string;
  revenue: number;
  hours: number;
  costByArea: Record<CostArea, number>;
  otherCost: number;
  totalCost: number;
  netMargin: number;
  /** Net margin as a share of revenue; null when the client pays nothing. */
  marginPct: number | null;
  profitPerHour: number | null;
  /** False until any hours or other cost are entered, so blank clients don't show 100%. */
  costed: boolean;
  /** Hours entered for an area with no rate of its own and no default. */
  missingRates: CostArea[];
}

export const NO_TIER = "No tier";

const num = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));
const div = (a: number, b: number) => (b ? a / b : 0);

export function clientMargin(client: MarginClient, costs: ClientCosts | undefined, defaults: DefaultRates): ClientMargin {
  const costByArea = { filming: 0, editing: 0, social: 0 } as Record<CostArea, number>;
  const missingRates: CostArea[] = [];
  let hours = 0;
  let costed = false;

  for (const area of COST_AREAS) {
    const h = num(costs?.[`${area}_hours`]);
    if (h === null) continue;
    costed = true;
    hours += h;
    const rate = num(costs?.[`${area}_rate`]) ?? defaults[area];
    if (rate === null) {
      if (h > 0) missingRates.push(area);
      continue;
    }
    costByArea[area] = h * rate;
  }

  const other = num(costs?.other_cost);
  if (other !== null) costed = true;
  const otherCost = other ?? 0;

  const revenue = Number(client.monthly_fee) || 0;
  const totalCost = costByArea.filming + costByArea.editing + costByArea.social + otherCost;
  const netMargin = revenue - totalCost;

  return {
    id: client.id,
    name: client.name,
    tier: client.tier || NO_TIER,
    revenue,
    hours,
    costByArea,
    otherCost,
    totalCost,
    netMargin,
    marginPct: revenue ? netMargin / revenue : null,
    profitPerHour: hours ? netMargin / hours : null,
    costed,
    missingRates,
  };
}

export interface TierMargin {
  tier: string;
  clients: number;
  /** Clients with costs entered; only these count towards the averages. */
  costedClients: number;
  avgRevenue: number;
  avgCost: number;
  avgNetMargin: number;
  /** Total net margin over total revenue for the costed clients. */
  marginPct: number | null;
  avgHours: number;
  profitPerHour: number | null;
  lowestMarginPct: number | null;
  highestMarginPct: number | null;
}

/** Per-tier averages over costed clients, best margin first; tiers not yet costed go last. */
export function tierMargins(rows: ClientMargin[], tierOrder: string[] = []): TierMargin[] {
  const tiers = [...new Set(rows.map((r) => r.tier))];
  return tiers
    .map((tier) => {
      const all = rows.filter((r) => r.tier === tier);
      const costed = all.filter((r) => r.costed);
      const n = costed.length;
      const revenue = costed.reduce((s, r) => s + r.revenue, 0);
      const cost = costed.reduce((s, r) => s + r.totalCost, 0);
      const hours = costed.reduce((s, r) => s + r.hours, 0);
      const pcts = costed.map((r) => r.marginPct).filter((p): p is number => p !== null);
      return {
        tier,
        clients: all.length,
        costedClients: n,
        avgRevenue: div(revenue, n),
        avgCost: div(cost, n),
        avgNetMargin: div(revenue - cost, n),
        marginPct: revenue ? (revenue - cost) / revenue : null,
        avgHours: div(hours, n),
        profitPerHour: hours ? (revenue - cost) / hours : null,
        lowestMarginPct: pcts.length ? Math.min(...pcts) : null,
        highestMarginPct: pcts.length ? Math.max(...pcts) : null,
      };
    })
    .sort((a, b) => {
      if ((a.marginPct === null) !== (b.marginPct === null)) return a.marginPct === null ? 1 : -1;
      if (a.marginPct !== null && b.marginPct !== null && a.marginPct !== b.marginPct) return b.marginPct - a.marginPct;
      return rank(tierOrder, a.tier) - rank(tierOrder, b.tier);
    });
}

const rank = (order: string[], tier: string) => {
  const i = order.indexOf(tier);
  return i === -1 ? order.length : i;
};

export type AttentionReason = "losing money" | "below tier margin" | "more hours than tier";

export interface ClientFlag {
  reasons: AttentionReason[];
  /** Client margin % minus their tier's margin %, in points (e.g. -0.12). */
  marginVsTier: number | null;
  /** Client hours over their tier's average hours (e.g. 1.4 = 40% more). */
  hoursVsTier: number | null;
}

/**
 * Flags clients costing more than their tier-mates: a net loss, a margin more than
 * `marginGap` below the tier's, or hours more than `hoursOver` above the tier's average.
 * Tier comparisons need at least two costed clients in the tier.
 */
export function flagClient(row: ClientMargin, tiers: TierMargin[], marginGap = 0.1, hoursOver = 0.25): ClientFlag {
  const tier = tiers.find((t) => t.tier === row.tier);
  const comparable = row.costed && !!tier && tier.costedClients >= 2;
  const marginVsTier =
    comparable && row.marginPct !== null && tier!.marginPct !== null ? row.marginPct - tier!.marginPct : null;
  const hoursVsTier = comparable && tier!.avgHours > 0 ? row.hours / tier!.avgHours : null;

  const reasons: AttentionReason[] = [];
  if (row.costed && row.netMargin < 0) reasons.push("losing money");
  if (marginVsTier !== null && marginVsTier < -marginGap) reasons.push("below tier margin");
  if (hoursVsTier !== null && hoursVsTier > 1 + hoursOver) reasons.push("more hours than tier");
  return { reasons, marginVsTier, hoursVsTier };
}

export interface MarginTotals {
  clients: number;
  costedClients: number;
  revenue: number;
  cost: number;
  netMargin: number;
  marginPct: number | null;
  avgNetMargin: number;
  hours: number;
}

/** Totals across costed clients only, so blanks don't inflate the margin. */
export function marginTotals(rows: ClientMargin[]): MarginTotals {
  const costed = rows.filter((r) => r.costed);
  const revenue = costed.reduce((s, r) => s + r.revenue, 0);
  const cost = costed.reduce((s, r) => s + r.totalCost, 0);
  return {
    clients: rows.length,
    costedClients: costed.length,
    revenue,
    cost,
    netMargin: revenue - cost,
    marginPct: revenue ? (revenue - cost) / revenue : null,
    avgNetMargin: div(revenue - cost, costed.length),
    hours: costed.reduce((s, r) => s + r.hours, 0),
  };
}
