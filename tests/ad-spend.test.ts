// Run with: deno task test
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  datesIn,
  type ExistingEntry,
  periodFor,
  planSpendEntries,
  spendAlreadyLogged,
  spreadAmount,
  UNALLOCATED_TIER,
  weekStart,
} from "../src/lib/ad-spend.ts";
import { totals } from "../src/lib/metrics.ts";

Deno.test("periods start on Monday and cover whole months", () => {
  assertEquals(weekStart("2026-09-17"), "2026-09-14"); // a Thursday
  assertEquals(weekStart("2026-09-14"), "2026-09-14"); // Monday itself
  assertEquals(weekStart("2026-09-20"), "2026-09-14"); // Sunday belongs to that week
  assertEquals(periodFor("this_week", "2026-09-17"), { from: "2026-09-14", to: "2026-09-20" });
  assertEquals(periodFor("last_week", "2026-09-17"), { from: "2026-09-07", to: "2026-09-13" });
  assertEquals(periodFor("this_month", "2026-09-17"), { from: "2026-09-01", to: "2026-09-30" });
  assertEquals(periodFor("last_month", "2026-09-17"), { from: "2026-08-01", to: "2026-08-31" });
  assertEquals(datesIn({ from: "2026-09-14", to: "2026-09-20" }).length, 7);
});

Deno.test("a weekly amount splits to the cent and always adds back up", () => {
  const parts = spreadAmount(1000, 7);
  assertEquals(parts.length, 7);
  assertAlmostEquals(parts.reduce((a, b) => a + b, 0), 1000, 1e-9);
  assertEquals(parts[0], 142.85);
  assertEquals(parts[6], 142.9); // the remainder lands on the last day

  assertAlmostEquals(spreadAmount(0.07, 3).reduce((a, b) => a + b, 0), 0.07, 1e-9);
  assertEquals(spreadAmount(500, 0), []);
});

Deno.test("spend is written across the week without touching leads or wins", () => {
  const existing: ExistingEntry[] = [
    {
      date: "2026-09-15", channel: "Meta Ads", tier: UNALLOCATED_TIER,
      new_leads: 3, responded_within_30_min: 3, meetings_held: 1, clients_won: 1,
      value_won_monthly: 4500, marketing_spend: 0, notes: "busy day",
    },
  ];
  const period = periodFor("this_week", "2026-09-17");
  const planned = planSpendEntries(
    [{ channel: "Meta Ads", amount: 700 }, { channel: "Google Ads", amount: 350 }],
    period, UNALLOCATED_TIER, existing,
  );

  assertEquals(planned.length, 14); // two channels x seven days
  const touched = planned.find((p) => p.date === "2026-09-15" && p.channel === "Meta Ads")!;
  assertEquals(touched.new_leads, 3); // the day's real numbers survive
  assertEquals(touched.clients_won, 1);
  assertEquals(touched.notes, "busy day");
  assertEquals(touched.marketing_spend, 100);

  const week = totals(planned.map((p) => ({ ...p, service_line: p.tier })), period.from, period.to);
  assertAlmostEquals(week.spend, 1050, 1e-9);
  assertEquals(week.leads, 3); // untouched rows are carried through, not duplicated
});

Deno.test("logging the same week twice replaces the spend rather than doubling it", () => {
  const period = periodFor("this_week", "2026-09-17");
  const first = planSpendEntries([{ channel: "Meta Ads", amount: 700 }], period, UNALLOCATED_TIER, []);
  const second = planSpendEntries([{ channel: "Meta Ads", amount: 900 }], period, UNALLOCATED_TIER, first);
  const total = second.reduce((sum, row) => sum + row.marketing_spend, 0);
  assertAlmostEquals(total, 900, 1e-9);
});

Deno.test("empty or zero rows are ignored, and existing spend is reported", () => {
  const period = periodFor("this_week", "2026-09-17");
  assertEquals(planSpendEntries([{ channel: "Meta Ads", amount: 0 }], period, UNALLOCATED_TIER, []).length, 0);
  assertEquals(planSpendEntries([{ channel: "", amount: 500 }], period, UNALLOCATED_TIER, []).length, 0);

  const logged = planSpendEntries([{ channel: "Meta Ads", amount: 700 }], period, UNALLOCATED_TIER, []);
  assertAlmostEquals(spendAlreadyLogged(logged, period, "Meta Ads"), 700, 1e-9);
  assertEquals(spendAlreadyLogged(logged, period, "Google Ads"), 0);
});
