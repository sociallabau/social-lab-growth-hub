// Run with: deno task test
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { averageTenureMonths, revenueSummary, suggestedLifetimeMonths, type Client } from "../src/lib/metrics.ts";
import { tierEconomics, weakestTier } from "../src/lib/capacity.ts";

const client = (name: string, tier: string, fee: number, start: string, end: string | null = null): Client => ({
  id: name, name, tier, start_date: start, monthly_fee: fee, end_date: end,
});

// A slice of the real book: Tier 1 at $3-4k, Tier 2 at $2.5k, Tier 3 at $1.8k
const book: Client[] = [
  client("Coast Modular", "Tier 1", 3000, "2025-09-01"),
  client("Image Property GC", "Tier 1", 4000, "2025-08-01"),
  client("Sproule", "Tier 1", 4090, "2025-09-01"),
  client("Max Kenny", "Tier 2", 2500, "2026-04-01"),
  client("Davey", "Tier 2", 2250, "2025-09-01"),
  client("Cameron Thomas", "Tier 3", 1800, "2025-09-01"),
  client("Marc Layzell", "Tier 3", 1500, "2025-09-01", "2026-07-01"),
  client("Simar Singh", "Ad Only", 500, "2026-03-01", "2026-07-01"),
  client("Milestone", "Ad Only", 500, "2025-08-01", "2026-09-01"),
];

const targets = [
  { tier: "Tier 1", revenue_target: 45000 },
  { tier: "Tier 2", revenue_target: 40000 },
  { tier: "Tier 3", revenue_target: 20000 },
  { tier: "Ad Only", revenue_target: 10000 },
];

Deno.test("revenue against the monthly target", () => {
  const r = revenueSummary(book, targets, 125000, "2026-09-17");
  assertEquals(r.activeClients, 6); // three left
  assertEquals(r.mrr, 17640);
  assertEquals(r.target, 125000);
  assertEquals(r.gap, 107360);
  assertAlmostEquals(r.progress, 17640 / 125000, 1e-9);
  assertEquals(r.averageFee, 2940);
  assertEquals(r.clientsToTarget, Math.ceil(107360 / 2940)); // 37 more at today's average fee
});

Deno.test("revenue by tier, ranked, with each tier's own goal", () => {
  const r = revenueSummary(book, targets, 125000, "2026-09-17");
  const tier1 = r.byTier[0];
  assertEquals(tier1.tier, "Tier 1");
  assertEquals(tier1.clients, 3);
  assertEquals(tier1.mrr, 11090);
  assertEquals(tier1.target, 45000);
  assertEquals(tier1.gap, 33910);
  const adOnly = r.byTier.find((t) => t.tier === "Ad Only")!;
  assertEquals(adOnly.clients, 0); // both churned, but the tier still shows with its goal
  assertEquals(adOnly.target, 10000);
});

Deno.test("client lifetime comes from history instead of a guess", () => {
  const s = suggestedLifetimeMonths(book, "2026-09-17");
  assertEquals(s.sampleSize, 3);
  assertEquals(s.basis, "average tenure of clients who have left");
  // Marc Layzell 10 months, Simar Singh 4, Milestone 13 => 9
  assertEquals(s.months, 9);

  const noneLost = suggestedLifetimeMonths([client("A", "Tier 1", 3000, "2026-01-01")], "2026-09-17");
  assertEquals(noneLost.months, null);
  assertEquals(noneLost.basis, "not enough history yet: no clients have left");

  assertEquals(Math.round(averageTenureMonths(book, "2026-09-17")), 11);
});

Deno.test("tier economics: planned hours when nothing is logged yet", () => {
  const packages = [
    { tier: "Tier 1", price: 4000, hours_by_role: { Editor: 12, Videographer: 6 } },
    { tier: "Tier 2", price: 2500, hours_by_role: { Editor: 8, Videographer: 3 } },
    { tier: "Tier 3", price: 1800, hours_by_role: { Editor: 6 } },
  ];
  const cost = { Editor: 20, Videographer: 45 };
  const rows = tierEconomics(book.filter((c) => !c.end_date), packages, [], cost);
  const tier1 = rows.find((r) => r.tier === "Tier 1")!;
  assertEquals(tier1.clients, 3);
  assertEquals(tier1.plannedHours, 54); // 3 clients x 18 hours
  assertEquals(tier1.actualHours, null);
  assertEquals(tier1.deliveryCost, 3 * (12 * 20 + 6 * 45)); // $1,530
  assertAlmostEquals(tier1.marginPct, (11090 - 1530) / 11090, 1e-9);
  assertAlmostEquals(tier1.revenuePerHour!, 11090 / 54, 1e-9);
});

Deno.test("tier economics: logged hours win, and reveal the tier eating the most time", () => {
  const packages = [
    { tier: "Tier 1", price: 4000, hours_by_role: { Editor: 12 } },
    { tier: "Tier 3", price: 1800, hours_by_role: { Editor: 6 } },
  ];
  const cost = { Editor: 20 };
  // Tier 3 logs 20 hours a week against a 6 hour/month package: the classic trap
  const hours = [
    { client_id: "Cameron Thomas", role: "Editor", hours: 20 },
    { client_id: "Coast Modular", role: "Editor", hours: 10 },
  ];
  const rows = tierEconomics(book.filter((c) => !c.end_date), packages, hours, cost, 1);
  const tier3 = rows.find((r) => r.tier === "Tier 3")!;
  assertAlmostEquals(tier3.actualHours!, 20 * (52 / 12), 1e-9); // about 86.7 hours a month
  assertEquals(Math.round(tier3.overPlanHoursPerClient!), 81); // 81 hours a month over the package
  assertEquals(Math.round(tier3.deliveryCost), 1733); // $1,800 fee against $1,733 of editing
  assertEquals(tier3.marginPct < 0.05, true); // basically working for nothing
  assertEquals(weakestTier(rows)!.tier, "Tier 3");
});
