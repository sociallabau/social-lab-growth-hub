// Logging ad spend for a week or a month, rather than day by day.
//
// Spend is stored on daily_entries like everything else, so CAC, cost per lead
// and the trends all keep working. A weekly figure is spread evenly across the
// days, which keeps the 7-day and month-to-date totals exact without inventing
// a spike on one day.
import { addDays, monthEnd, monthStart, type ISODate } from "@/lib/metrics";

/** Spend that is not tied to one tier sits here, so tier filters stay honest. */
export const UNALLOCATED_TIER = "Unallocated";

export type PeriodKind = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

export interface Period {
  from: ISODate;
  to: ISODate;
}

/** Monday of the week containing `date`. */
export function weekStart(date: ISODate): ISODate {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sun, 1 Mon
  return addDays(date, -((weekday + 6) % 7));
}

export function periodFor(kind: PeriodKind, today: ISODate, custom?: Period): Period {
  switch (kind) {
    case "this_week": {
      const from = weekStart(today);
      return { from, to: addDays(from, 6) };
    }
    case "last_week": {
      const from = addDays(weekStart(today), -7);
      return { from, to: addDays(from, 6) };
    }
    case "this_month":
      return { from: monthStart(today), to: monthEnd(today) };
    case "last_month": {
      const from = monthStart(addDays(monthStart(today), -1));
      return { from, to: monthEnd(from) };
    }
    case "custom":
      return custom ?? { from: today, to: today };
  }
}

export function datesIn(period: Period): ISODate[] {
  const out: ISODate[] = [];
  for (let day = period.from; day <= period.to; day = addDays(day, 1)) out.push(day);
  return out;
}

/**
 * Splits an amount across days to the cent. Every day gets the same amount
 * except the last, which carries the rounding remainder, so the parts always
 * add back up to the total.
 */
export function spreadAmount(amount: number, days: number): number[] {
  if (days <= 0) return [];
  const totalCents = Math.round(Number(amount) * 100);
  const each = Math.floor(totalCents / days);
  const parts = Array<number>(days).fill(each);
  parts[days - 1] = each + (totalCents - each * days);
  return parts.map((cents) => cents / 100);
}

export interface SpendRow {
  channel: string;
  amount: number;
}

export interface ExistingEntry {
  date: ISODate;
  channel: string;
  tier: string;
  new_leads: number;
  responded_within_30_min: number;
  meetings_held: number;
  clients_won: number;
  value_won_monthly: number;
  marketing_spend: number;
  notes?: string | null;
}

export interface PlannedEntry extends ExistingEntry {
  notes: string | null;
}

/**
 * The daily_entries rows to write. Existing rows keep their leads, meetings and
 * wins: only the spend is replaced, so logging spend twice does not double it.
 */
export function planSpendEntries(
  rows: SpendRow[],
  period: Period,
  tier: string,
  existing: ExistingEntry[],
): PlannedEntry[] {
  const days = datesIn(period);
  const byKey = new Map(existing.map((e) => [`${e.date}|${e.channel}|${e.tier}`, e]));
  const planned: PlannedEntry[] = [];

  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (!row.channel || amount <= 0) continue;
    const parts = spreadAmount(amount, days.length);
    days.forEach((date, index) => {
      const current = byKey.get(`${date}|${row.channel}|${tier}`);
      planned.push({
        date,
        channel: row.channel,
        tier,
        new_leads: current?.new_leads ?? 0,
        responded_within_30_min: current?.responded_within_30_min ?? 0,
        meetings_held: current?.meetings_held ?? 0,
        clients_won: current?.clients_won ?? 0,
        value_won_monthly: current?.value_won_monthly ?? 0,
        marketing_spend: parts[index] ?? 0,
        notes: current?.notes ?? null,
      });
    });
  }
  return planned;
}

/** What is already logged for these channels over the period, for the "already logged" note. */
export function spendAlreadyLogged(existing: ExistingEntry[], period: Period, channel: string): number {
  return existing
    .filter((e) => e.channel === channel && e.date >= period.from && e.date <= period.to)
    .reduce((sum, e) => sum + (Number(e.marketing_spend) || 0), 0);
}

export function describePeriod(period: Period): string {
  const days = datesIn(period).length;
  return `${days} day${days === 1 ? "" : "s"}`;
}
