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

/** Margin now, in 12 and in 24 months, with known pay rises and a planned yearly price increase. */
export function marginOutlook(revenueNow: number, staff: Staff[], priceIncreaseYearly: number, targetLabourPct: number) {
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
