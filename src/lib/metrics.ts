// Growth dashboard calculations. Pure functions, no database access, so the
// same numbers come out in the app, in tests and in edge functions.
//
// Formulas (from the mentor brief and the Growth Tracker spreadsheet):
//   Conversion        = clients won / new leads
//   Speed to lead     = responded within 30 min / new leads
//   Average order val = value won / clients won
//   CAC               = (marketing spend + fixed acquisition cost) / clients won
//   Churn             = clients lost in month / active clients at start of month
//   LTV               = avg monthly revenue per active client x gross margin x avg lifetime (months)

export type ISODate = string; // "YYYY-MM-DD"

export interface DailyEntry {
  date: ISODate;
  channel: string;
  service_line: string;
  new_leads: number;
  responded_within_30_min: number;
  meetings_held: number;
  clients_won: number;
  value_won_monthly: number;
  marketing_spend: number;
}

export interface Client {
  id?: string;
  name: string;
  service_line: string | null;
  tier?: string | null;
  lead_channel?: string | null;
  start_date: ISODate | null;
  monthly_fee: number | null;
  end_date: ISODate | null;
}

export interface Settings {
  tracking_start_month: ISODate;
  gross_margin: number;
  avg_client_lifetime_months: number;
  fixed_monthly_acquisition_cost: number;
  target_leads_per_week: number;
  target_conversion: number;
  target_aov: number;
  target_responded_30: number;
  target_ltv_cac: number;
}

export const ALL = "All";

// ---------------------------------------------------------------------------
// Dates (string based so there are no timezone surprises)
// ---------------------------------------------------------------------------

export function todayInBrisbane(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(now);
}

function toUTC(d: ISODate): Date {
  return new Date(`${d.slice(0, 10)}T00:00:00Z`);
}

function fromUTC(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

export function monthStart(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

export function addMonths(d: ISODate, n: number): ISODate {
  const x = toUTC(monthStart(d));
  x.setUTCMonth(x.getUTCMonth() + n);
  return fromUTC(x);
}

export function monthEnd(d: ISODate): ISODate {
  return addDays(addMonths(d, 1), -1);
}

export function daysBetweenInclusive(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000) + 1;
}

/** Whole months between two dates, like Excel DATEDIF(start, end, "m"). */
export function wholeMonths(start: ISODate, end: ISODate): number {
  const s = toUTC(start), e = toUTC(end);
  let m = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  if (e.getUTCDate() < s.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

const div = (a: number, b: number) => (b ? a / b : 0);

// ---------------------------------------------------------------------------
// Scorecards
// ---------------------------------------------------------------------------

export interface Totals {
  leads: number;
  responded: number;
  meetings: number;
  wins: number;
  value: number;
  spend: number;
  fixedCost: number;
  speedToLead: number;
  conversion: number;
  meetingToClose: number;
  aov: number;
  cac: number;
}

export function filterByService<T extends { service_line: string | null }>(rows: T[], service: string): T[] {
  return service === ALL ? rows : rows.filter((r) => r.service_line === service);
}

export function totals(entries: DailyEntry[], from: ISODate, to: ISODate, fixedCost = 0): Totals {
  let leads = 0, responded = 0, meetings = 0, wins = 0, value = 0, spend = 0;
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    leads += Number(e.new_leads) || 0;
    responded += Number(e.responded_within_30_min) || 0;
    meetings += Number(e.meetings_held) || 0;
    wins += Number(e.clients_won) || 0;
    value += Number(e.value_won_monthly) || 0;
    spend += Number(e.marketing_spend) || 0;
  }
  return {
    leads, responded, meetings, wins, value, spend, fixedCost,
    speedToLead: div(responded, leads),
    conversion: div(wins, leads),
    meetingToClose: div(wins, meetings),
    aov: div(value, wins),
    cac: div(spend + fixedCost, wins),
  };
}

/** Fixed monthly acquisition cost spread across the days of a period. */
export function proratedFixedCost(monthly: number, from: ISODate, to: ISODate): number {
  if (!monthly) return 0;
  let cost = 0;
  let cursor = from;
  while (cursor <= to) {
    const end = monthEnd(cursor) < to ? monthEnd(cursor) : to;
    const daysInMonth = daysBetweenInclusive(monthStart(cursor), monthEnd(cursor));
    cost += (monthly * daysBetweenInclusive(cursor, end)) / daysInMonth;
    cursor = addDays(end, 1);
  }
  return cost;
}

export type PeriodKey = "today" | "last7" | "mtd";

export function scorecards(entries: DailyEntry[], settings: Settings, today: ISODate): Record<PeriodKey, Totals> {
  const periods: Record<PeriodKey, [ISODate, ISODate]> = {
    today: [today, today],
    last7: [addDays(today, -6), today],
    mtd: [monthStart(today), today],
  };
  const out = {} as Record<PeriodKey, Totals>;
  for (const [key, [from, to]] of Object.entries(periods) as [PeriodKey, [ISODate, ISODate]][]) {
    out[key] = totals(entries, from, to, proratedFixedCost(Number(settings.fixed_monthly_acquisition_cost), from, to));
  }
  return out;
}

/** Lead targets scaled to each scorecard period (weekly target / 5 working days). */
export function leadTargets(settings: Settings, today: ISODate): Record<PeriodKey, number> {
  const perWeek = Number(settings.target_leads_per_week) || 0;
  const daysSoFar = daysBetweenInclusive(monthStart(today), today);
  return {
    today: Math.round((perWeek / 5) * 10) / 10,
    last7: perWeek,
    mtd: Math.round((perWeek * daysSoFar) / 7),
  };
}

export type SignalLevel = "neutral" | "good" | "warning" | "critical";

export function conversionFlag(conversion: number, leads: number): { level: SignalLevel; note: string } | null {
  if (leads > 0 && conversion > 0.4) return { level: "warning", note: "Above 40%: test a price increase" };
  return null;
}

export function pricingSignal(mtd: Totals): { level: SignalLevel; text: string } {
  if (mtd.leads === 0) return { level: "neutral", text: "No leads logged yet this month" };
  if (mtd.wins < 3) return { level: "neutral", text: "Fewer than 3 wins so far this month: too early to read" };
  if (mtd.conversion > 0.4) return { level: "warning", text: "Converting above 40%: you have room to test a price increase" };
  if (mtd.conversion < 0.2) return { level: "critical", text: "Converting below 20%: check lead quality, speed to lead and the sales call" };
  return { level: "good", text: "In the sweet spot: keep testing price in thirds" };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export function isActiveOn(c: Client, day: ISODate): boolean {
  return !!c.start_date && c.start_date <= day && (!c.end_date || c.end_date > day);
}

export function clientStatus(c: Client): "Active" | "Lost" {
  return c.end_date ? "Lost" : "Active";
}

export function monthsActive(c: Client, today: ISODate): number | null {
  if (!c.start_date) return null;
  return wholeMonths(c.start_date, c.end_date ?? today);
}

export function revenueToDate(c: Client, today: ISODate): number | null {
  const m = monthsActive(c, today);
  if (m === null || c.monthly_fee == null) return null;
  return Number(c.monthly_fee) * (m + 1);
}

// ---------------------------------------------------------------------------
// 12 month trend
// ---------------------------------------------------------------------------

export interface MonthRow extends Totals {
  month: ISODate;
  label: string;
  isFuture: boolean;
  activeClients: number;
  mrr: number;
  arpc: number;
  clientsLost: number;
  churn: number;
  ltv: number;
  ltvToCac: number;
  paybackMonths: number;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" });

export function monthlyTrend(entries: DailyEntry[], clients: Client[], settings: Settings, today: ISODate, months = 12): MonthRow[] {
  const start = monthStart(settings.tracking_start_month || today);
  const gm = Number(settings.gross_margin) || 0;
  const lifetime = Number(settings.avg_client_lifetime_months) || 0;
  const rows: MonthRow[] = [];
  for (let i = 0; i < months; i++) {
    const m0 = addMonths(start, i);
    const m1 = monthEnd(m0);
    const isFuture = m0 > today;
    const fixed = isFuture ? 0 : Number(settings.fixed_monthly_acquisition_cost) || 0;
    const t = totals(entries, m0, m1, fixed);
    const active = isFuture ? [] : clients.filter((c) => isActiveOn(c, m1));
    const activeAtStart = clients.filter((c) => isActiveOn(c, addDays(m0, -1))).length;
    const mrr = active.reduce((s, c) => s + (Number(c.monthly_fee) || 0), 0);
    const arpc = div(mrr, active.length);
    const clientsLost = clients.filter((c) => c.end_date && c.end_date >= m0 && c.end_date <= m1).length;
    const ltv = arpc * gm * lifetime;
    rows.push({
      ...t,
      month: m0,
      label: MONTH_LABEL.format(toUTC(m0)),
      isFuture,
      activeClients: active.length,
      mrr,
      arpc,
      clientsLost,
      churn: div(clientsLost, activeAtStart),
      ltv,
      ltvToCac: div(ltv, t.cac),
      paybackMonths: div(t.cac, arpc * gm),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Channel table for a selected month
// ---------------------------------------------------------------------------

export interface ChannelRow {
  channel: string;
  leads: number;
  responded: number;
  meetings: number;
  wins: number;
  conversion: number;
  value: number;
  spend: number;
  cacDirect: number;
  shareOfLeads: number;
}

export function channelTable(entries: DailyEntry[], channels: string[], month: ISODate): ChannelRow[] {
  const m0 = monthStart(month), m1 = monthEnd(month);
  const all = totals(entries, m0, m1);
  const known = new Set(channels);
  const names = [...channels, ...new Set(entries.map((e) => e.channel).filter((c) => !known.has(c)))];
  return names.map((channel) => {
    const t = totals(entries.filter((e) => e.channel === channel), m0, m1);
    return {
      channel,
      leads: t.leads,
      responded: t.responded,
      meetings: t.meetings,
      wins: t.wins,
      conversion: t.conversion,
      value: t.value,
      spend: t.spend,
      cacDirect: div(t.spend, t.wins),
      shareOfLeads: div(t.leads, all.leads),
    };
  });
}

// ---------------------------------------------------------------------------
// Pricing and client selection
// ---------------------------------------------------------------------------

/** Cheapest 30% of active clients, the group for the price conversation. */
export function bottomThirtyPercent<T extends Client>(clients: T[], today: ISODate): T[] {
  const active = clients.filter((c) => isActiveOn(c, today)).sort((a, b) => (Number(a.monthly_fee) || 0) - (Number(b.monthly_fee) || 0));
  if (!active.length) return [];
  return active.slice(0, Math.max(1, Math.round(active.length * 0.3)));
}

export interface PriceBandLead {
  price_band: "current" | "mid" | "high" | null;
  status: string;
  won_value?: number | null;
}

export function priceTestResults(leads: PriceBandLead[]) {
  return (["current", "mid", "high"] as const).map((band) => {
    const quoted = leads.filter((l) => l.price_band === band);
    const won = quoted.filter((l) => l.status === "won");
    const lost = quoted.filter((l) => l.status === "lost");
    return {
      band,
      quoted: quoted.length,
      won: won.length,
      lost: lost.length,
      winRate: div(won.length, won.length + lost.length),
      avgWonValue: div(won.reduce((s, l) => s + (Number(l.won_value) || 0), 0), won.length),
    };
  });
}

/** Rotate proposals through the three price points so each gets a third. */
export function nextPriceBand(leads: PriceBandLead[]): "current" | "mid" | "high" {
  const counts = priceTestResults(leads).map((r) => r.quoted);
  const order = ["current", "mid", "high"] as const;
  return order[counts.indexOf(Math.min(...counts))];
}

// ---------------------------------------------------------------------------
// Speed to lead from CRM timestamps
// ---------------------------------------------------------------------------

export function responseMinutes(receivedAt: string, firstResponseAt: string | null): number | null {
  if (!firstResponseAt) return null;
  return Math.max(0, (new Date(firstResponseAt).getTime() - new Date(receivedAt).getTime()) / 60_000);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
