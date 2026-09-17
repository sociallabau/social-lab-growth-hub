// Run with: deno task test
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { buildWeeklyReport, lastWeekStart, type ReportInput } from "../src/server/reports/weekly-report.ts";
import type { DailyEntry, Settings } from "../src/lib/metrics.ts";

const settings: Settings = {
  tracking_start_month: "2026-04-01",
  gross_margin: 0.5,
  avg_client_lifetime_months: 18,
  fixed_monthly_acquisition_cost: 0,
  target_leads_per_week: 10,
  target_conversion: 0.3,
  target_aov: 4500,
  target_responded_30: 0.9,
  target_ltv_cac: 3,
};

const entry = (date: string, leads: number, responded: number, meetings = 0, wins = 0, value = 0, spend = 0): DailyEntry => ({
  date, channel: "Meta Ads", service_line: "Media",
  new_leads: leads, responded_within_30_min: responded, meetings_held: meetings,
  clients_won: wins, value_won_monthly: value, marketing_spend: spend,
});

const base: ReportInput = {
  weekStart: "2026-09-07",
  today: "2026-09-14",
  settings,
  entries: [
    // week being reported: 11 leads, 9 answered fast, 2 wins
    entry("2026-09-07", 3, 3, 1, 0, 0, 120),
    entry("2026-09-09", 5, 4, 2, 1, 4500, 200),
    entry("2026-09-11", 3, 2, 1, 1, 3000, 180),
    // the week before: 6 leads, 3 answered fast
    entry("2026-08-31", 6, 3, 1, 1, 3000, 150),
  ],
  clients: [
    { name: "Coast Modular", service_line: "Media", start_date: "2025-09-01", monthly_fee: 3000, end_date: null },
    { name: "Cheap Co", service_line: "Media", start_date: "2026-01-01", monthly_fee: 1500, end_date: null },
    { name: "Gone Co", service_line: "Media", start_date: "2025-06-01", monthly_fee: 2000, end_date: "2026-09-05" },
  ],
  leads: [
    { id: "1", name: "Slow Reply", company: "Waiting Co", status: "new", channel: "Meta Ads", received_at: "2026-09-11T01:00:00Z", first_response_at: null, meeting_at: null },
    { id: "2", name: "Met", company: "Past Meeting Co", status: "meeting_booked", channel: "Meta Ads", received_at: "2026-09-08T01:00:00Z", first_response_at: "2026-09-08T01:10:00Z", meeting_at: "2026-09-10" },
  ],
  checkinDates: ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-11"], // Thursday missed
  appUrl: "https://hub.example.com",
};

Deno.test("headline numbers and verdicts", () => {
  const r = buildWeeklyReport(base);
  const [leads, speed, conversion] = r.headlines;
  assertEquals(leads.value, "11");
  assertEquals(leads.verdict, "on_target"); // 11 against a target of 10
  assertEquals(leads.change, "up from 6 the week before");
  assertEquals(speed.value, "82%"); // 9 of 11
  assertEquals(speed.verdict, "watch"); // short of 90% but within 70% of it
  assertEquals(conversion.value, "18%"); // 2 of 11
  assertEquals(conversion.verdict, "off_target"); // well short of the 30% sweet spot
  assertStringIncludes(r.subject, "11 leads, 82% speed to lead, 18% conversion");
});

Deno.test("a quiet week reads as off target, not as an error", () => {
  const r = buildWeeklyReport({ ...base, entries: [] });
  assertEquals(r.headlines[0].value, "0");
  assertEquals(r.headlines[0].verdict, "off_target");
  assertEquals(r.headlines[1].value, "no leads");
  assertStringIncludes(r.text, "Leads: 0 (target 10 a week)");
});

Deno.test("above 40% conversion asks for a price rise rather than praise", () => {
  const hot = buildWeeklyReport({
    ...base,
    entries: [entry("2026-09-08", 6, 6, 5, 3, 13500, 0)],
  });
  assertEquals(hot.headlines[2].verdict, "watch");
  assertStringIncludes(hot.attention.join(" | "), "time to test a price increase");
});

Deno.test("attention list catches the things a person must act on", () => {
  const r = buildWeeklyReport(base);
  const all = r.attention.join(" | ");
  assertStringIncludes(all, "Waiting Co"); // unanswered past 30 minutes
  assertStringIncludes(all, "meeting has been and gone");
  assertStringIncludes(all, "Daily log missed on 10 Sept");
  assertStringIncludes(all, "Cheap Co"); // cheapest 30% of the book
});

Deno.test("money and book summary", () => {
  const r = buildWeeklyReport(base);
  assertEquals(r.activeClients, 2);
  assertEquals(r.mrr, 4500);
  assertEquals(r.lostThisMonth, 1);
  assertStringIncludes(r.html, "$4,500");
  assertStringIncludes(r.html, "Open the dashboard");
  assertStringIncludes(r.text, "Clients won: 2 worth $7,500 a month");
});

Deno.test("reports on the week that just finished", () => {
  assertEquals(lastWeekStart("2026-09-14"), "2026-09-07"); // Monday
  assertEquals(lastWeekStart("2026-09-20"), "2026-09-07"); // Sunday still reports that week
  assertEquals(lastWeekStart("2026-09-21"), "2026-09-14"); // next Monday moves on
});

Deno.test("html escapes client names", () => {
  const r = buildWeeklyReport({
    ...base,
    clients: [{ name: "A & B <Realty>", service_line: "Media", start_date: "2026-01-01", monthly_fee: 900, end_date: null }],
  });
  assertStringIncludes(r.html, "A &amp; B &lt;Realty&gt;");
});
