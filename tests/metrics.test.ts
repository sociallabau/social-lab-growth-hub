// Run with: deno test tests/
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  bottomThirtyPercent, channelTable, checkinCalendar, checkinStreak, clientSummary, conversionFlag, type DailyEntry,
  metaAdsSummary, monthlyTrend, monthsActive, nextPriceBand, pipelineSummary, pricingSignal, proratedFixedCost,
  revenueToDate, scorecards, type Settings, targetStatus, totals, wholeMonths,
} from "../src/lib/metrics.ts";
import { capacityByRole, headroomByPackage, hoursWorkedPerYear, productionHoursPerMonth } from "../src/lib/capacity.ts";
import { formatMoney, formatDate, parseAUDate } from "../src/lib/format.ts";

const settings: Settings = {
  tracking_start_month: "2026-09-01",
  gross_margin: 0.5,
  avg_client_lifetime_months: 18,
  fixed_monthly_acquisition_cost: 3000,
  target_leads_per_week: 10,
  target_conversion: 0.3,
  target_aov: 4500,
  target_responded_30: 0.9,
  target_ltv_cac: 3,
};

const e = (date: string, channel: string, tier: string, leads: number, responded: number, meetings: number, wins: number, value: number, spend: number): DailyEntry => ({
  date, channel, tier, new_leads: leads, responded_within_30_min: responded, meetings_held: meetings,
  clients_won: wins, value_won_monthly: value, marketing_spend: spend,
});

const entries = [
  // Example row from the spreadsheet's Start Here tab
  e("2026-09-15", "Meta Ads", "Tier 1", 3, 3, 2, 1, 4500, 250),
  e("2026-09-16", "Client referral", "Tier 2", 2, 1, 1, 1, 3600, 0),
  e("2026-09-17", "Meta Ads", "Tier 1", 4, 4, 1, 1, 3000, 300),
  e("2026-08-30", "Google Ads", "Tier 3", 5, 2, 0, 0, 0, 500),
];

Deno.test("scorecard formulas", () => {
  const t = totals(entries, "2026-09-01", "2026-09-17", 0);
  assertEquals(t.leads, 9);
  assertEquals(t.wins, 3);
  assertAlmostEquals(t.conversion, 3 / 9);
  assertAlmostEquals(t.speedToLead, 8 / 9);
  assertEquals(t.aov, 3700);
  assertAlmostEquals(t.cac, 550 / 3);
});

Deno.test("CAC includes fixed acquisition cost, prorated for partial months", () => {
  assertAlmostEquals(proratedFixedCost(3000, "2026-09-01", "2026-09-30"), 3000);
  assertAlmostEquals(proratedFixedCost(3000, "2026-09-01", "2026-09-15"), 1500);
  const s = scorecards(entries, settings, "2026-09-17");
  assertEquals(s.today.leads, 4);
  assertEquals(s.last7.leads, 9);
  assertAlmostEquals(s.mtd.cac, (550 + 3000 * 17 / 30) / 3);
});

Deno.test("amber conversion flag above 40% and the pricing signal", () => {
  assertEquals(conversionFlag(0.41, 10)?.note, "Above 40%: test a price increase");
  assertEquals(conversionFlag(0.4, 10), null);
  assertEquals(pricingSignal(totals([], "2026-09-01", "2026-09-30")).text, "No leads logged yet this month");
  const hot = totals([e("2026-09-02", "Meta Ads", "Tier 2", 7, 7, 5, 4, 12000, 0)], "2026-09-01", "2026-09-30");
  assertEquals(pricingSignal(hot).level, "warning");
});

Deno.test("clients: months active and revenue to date match DATEDIF formulas", () => {
  const c = { name: "Harbourside Realty", tier: "Tier 1", start_date: "2026-01-15", monthly_fee: 4500, end_date: null };
  assertEquals(wholeMonths("2026-01-15", "2026-09-14"), 7);
  assertEquals(monthsActive(c, "2026-09-15"), 8);
  assertEquals(revenueToDate(c, "2026-09-15"), 4500 * 9);
});

Deno.test("trend: active clients, MRR, churn and LTV", () => {
  const clients = [
    { name: "A", tier: "Tier 2", start_date: "2026-01-01", monthly_fee: 3000, end_date: null },
    { name: "B", tier: "Tier 2", start_date: "2026-02-01", monthly_fee: 3000, end_date: "2026-10-10" },
    { name: "C", tier: "Tier 3", start_date: "2026-10-05", monthly_fee: 6000, end_date: null },
  ];
  const trend = monthlyTrend(entries, clients, settings, "2026-10-20");
  const sep = trend[0], oct = trend[1];
  assertEquals(sep.activeClients, 2);
  assertEquals(sep.mrr, 6000);
  assertEquals(oct.activeClients, 2); // A and C; B left in October
  assertEquals(oct.clientsLost, 1);
  assertAlmostEquals(oct.churn, 1 / 2);
  assertEquals(oct.ltv, 4500 * 0.5 * 18);
  assertEquals(trend[2].isFuture, true);
  assertEquals(trend[2].activeClients, 0);
});

Deno.test("channel table for a month", () => {
  const rows = channelTable(entries, ["Meta Ads", "Client referral", "Google Ads"], "2026-09-10");
  const meta = rows.find((r) => r.channel === "Meta Ads")!;
  assertEquals(meta.leads, 7);
  assertAlmostEquals(meta.shareOfLeads, 7 / 9);
  assertEquals(rows.find((r) => r.channel === "Google Ads")!.leads, 0);
});

Deno.test("bottom 30% and price test rotation", () => {
  const clients = Array.from({ length: 10 }, (_, i) => ({ name: `C${i}`, tier: "Tier 2", start_date: "2026-01-01", monthly_fee: 2000 + i * 500, end_date: null }));
  assertEquals(bottomThirtyPercent(clients, "2026-09-17").map((c) => c.name), ["C0", "C1", "C2"]);
  assertEquals(nextPriceBand([{ price_band: "current", status: "won" }, { price_band: "high", status: "lost" }]), "mid");
});

Deno.test("capacity matches the spreadsheet's Team tab defaults", () => {
  const au = { location: "Australia", hours_per_week: 38, annual_leave_weeks: 4, public_holidays_days: 11, sick_days: 5, training_days: 5, utilisation: 0.75 };
  const ph = { location: "Philippines", hours_per_week: 40, annual_leave_weeks: 1, public_holidays_days: 18, sick_days: 5, training_days: 5, utilisation: 0.8 };
  const editor = { name: "Editor 1", role: "Editor", location: "Philippines", annual_cost: 28000 };
  // 40*52 - 1*40 - (18+5+5)*40/5 = 1816 hours
  assertEquals(hoursWorkedPerYear(editor, ph), 1816);
  assertAlmostEquals(productionHoursPerMonth(editor, ph), 1816 * 0.8 / 12);
  const roles = capacityByRole(["Editor", "Videographer"], [editor], [{ tier: "Tier 2", price: 4500, hours_by_role: { Editor: 12, Videographer: 6 } }],
    { "Tier 2": 8 }, { Australia: au, Philippines: ph }, 0.85);
  assertEquals(roles[0].requiredHours, 96);
  assertEquals(roles[0].status, "Room to grow");
  assertEquals(roles[1].status, "Nobody on the team has this role");
  assertEquals(headroomByPackage([{ tier: "Tier 2", price: 4500, hours_by_role: { Editor: 12 } }], roles)[0].extraClients, Math.floor((1816 * 0.8 / 12 * 0.85 - 96) / 12));
});

Deno.test("Australian formats", () => {
  assertEquals(formatDate("2026-09-17"), "17/09/2026");
  assertEquals(parseAUDate("7/9/2026"), "2026-09-07");
  assertEquals(parseAUDate("31/02/2026"), null);
  assertEquals(formatMoney(4500), "$4,500");
});

Deno.test("dashboard check-ins and target bands", () => {
  assertEquals(targetStatus(10, 10), "On target");
  assertEquals(targetStatus(8, 10), "Close");
  assertEquals(targetStatus(7, 10), "Off target");
  assertEquals(checkinStreak(["2026-09-17", "2026-09-16"], "2026-09-17"), 2);
  assertEquals(checkinCalendar(["2026-09-17"], "2026-09-17", 2)[1].state, "logged");
});

Deno.test("dashboard pipeline, clients and Meta summaries", () => {
  const now = new Date("2026-09-17T02:00:00Z");
  const pipeline = pipelineSummary([
    { status: "pending", received_at: "2026-09-17T00:00:00Z", first_response_at: null, meeting_at: null },
    { status: "new", received_at: "2026-09-17T00:00:00Z", first_response_at: "2026-09-17T00:10:00Z", meeting_at: null },
  ], now, "2026-09-17");
  assertEquals(pipeline.pending, 1);
  assertEquals(pipeline.medianResponseMinutes, 10);
  const summary = clientSummary([{ name: "A", tier: "Tier 2", start_date: "2026-01-01", monthly_fee: 3000, end_date: null, last_scope_review: null }], "2026-09-17");
  assertEquals(summary.mrr, 3000);
  assertEquals(summary.overdueScopeReviews.length, 1);
  assertEquals(metaAdsSummary([{ date: "2026-09-17", spend: 100, leads: 2, schedules: 1 }], "2026-09-17").costPerLead, 50);
});
