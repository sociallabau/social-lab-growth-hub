// Run with: deno task test
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  clientMargin,
  type DefaultRates,
  flagClient,
  marginTotals,
  NO_TIER,
  tierMargins,
} from "../src/lib/client-margins.ts";

const defaults: DefaultRates = { filming: 60, editing: 45, social: 35 };

Deno.test("a client's margin is fee minus hours x rate, with blank rates using the defaults", () => {
  const row = clientMargin(
    { id: "a", name: "A", tier: "Tier 2", monthly_fee: 4000 },
    { client_id: "a", filming_hours: 10, filming_rate: 80, editing_hours: 12, social_hours: 8, other_cost: 100 },
    defaults,
  );
  assertEquals(row.costByArea, { filming: 800, editing: 540, social: 280 });
  assertEquals(row.totalCost, 1720);
  assertEquals(row.netMargin, 2280);
  assertAlmostEquals(row.marginPct!, 0.57, 1e-9);
  assertEquals(row.hours, 30);
  assertEquals(row.profitPerHour, 76);
  assertEquals(row.costed, true);
});

Deno.test("a client with nothing entered is not counted as 100% margin", () => {
  const row = clientMargin({ id: "b", name: "B", tier: null, monthly_fee: 3000 }, undefined, defaults);
  assertEquals(row.costed, false);
  assertEquals(row.tier, NO_TIER);
  assertEquals(marginTotals([row]).costedClients, 0);
  assertEquals(marginTotals([row]).marginPct, null);
});

Deno.test("hours with no rate anywhere are flagged instead of silently costing nothing", () => {
  const row = clientMargin(
    { id: "c", name: "C", tier: "Tier 1", monthly_fee: 2000 },
    { client_id: "c", editing_hours: 5 },
    { filming: 60, editing: null, social: 35 },
  );
  assertEquals(row.missingRates, ["editing"]);
  assertEquals(row.totalCost, 0);
});

Deno.test("tiers average their costed clients and rank best margin first", () => {
  const rows = [
    clientMargin({ id: "1", name: "Easy", tier: "Tier 2", monthly_fee: 4000 }, { client_id: "1", filming_hours: 20 }, defaults), // 1200 cost
    clientMargin({ id: "2", name: "Hard", tier: "Tier 2", monthly_fee: 4000 }, { client_id: "2", filming_hours: 40 }, defaults), // 2400 cost
    clientMargin({ id: "3", name: "Small", tier: "Tier 1", monthly_fee: 2000 }, { client_id: "3", filming_hours: 25 }, defaults), // 1500 cost
    clientMargin({ id: "4", name: "Blank", tier: "Tier 1", monthly_fee: 2000 }, undefined, defaults),
  ];
  const tiers = tierMargins(rows, ["Tier 1", "Tier 2"]);
  assertEquals(tiers.map((t) => t.tier), ["Tier 2", "Tier 1"]);

  const t2 = tiers[0]!;
  assertEquals(t2.costedClients, 2);
  assertEquals(t2.avgNetMargin, 2200);
  assertAlmostEquals(t2.marginPct!, 0.55, 1e-9); // (8000 - 3600) / 8000
  assertAlmostEquals(t2.lowestMarginPct!, 0.4, 1e-9);
  assertAlmostEquals(t2.highestMarginPct!, 0.7, 1e-9);
  assertEquals(t2.avgHours, 30);

  const t1 = tiers[1]!;
  assertEquals([t1.clients, t1.costedClients], [2, 1]);
  assertEquals(t1.avgNetMargin, 500);

  // Same tier, same fee: the hard client sits 15 points under the tier and takes a third more hours.
  const hard = flagClient(rows[1]!, tiers);
  assertEquals(hard.reasons, ["below tier margin", "more hours than tier"]);
  assertAlmostEquals(hard.marginVsTier!, -0.15, 1e-9);
  assertEquals(flagClient(rows[0]!, tiers).reasons, []);
  // A tier with one costed client has nothing to compare against.
  assertEquals(flagClient(rows[2]!, tiers).marginVsTier, null);
});

Deno.test("a client losing money is always flagged", () => {
  const row = clientMargin({ id: "x", name: "X", tier: "Tier 3", monthly_fee: 1000 }, { client_id: "x", filming_hours: 30 }, defaults);
  assertEquals(flagClient(row, tierMargins([row])).reasons, ["losing money"]);
});

Deno.test("a 0 is a real 0: ads-only clients with no hours are costed, not blank", () => {
  const row = clientMargin(
    { id: "ads", name: "Ads", tier: "Ad Only", monthly_fee: 1500 },
    { client_id: "ads", filming_hours: 0, editing_hours: 0, social_hours: 0, other_cost: 0 },
    { filming: null, editing: null, social: null },
  );
  assertEquals(row.costed, true);
  assertEquals(row.totalCost, 0);
  assertEquals(row.netMargin, 1500);
  assertEquals(row.marginPct, 1);
  assertEquals(row.missingRates, []); // no rate needed for zero hours
  assertEquals(marginTotals([row]).costedClients, 1);

  // A rate typed as 0 is used as 0, not swapped for the default.
  const free = clientMargin(
    { id: "f", name: "F", tier: "Tier 1", monthly_fee: 1000 },
    { client_id: "f", editing_hours: 10, editing_rate: 0 },
    defaults,
  );
  assertEquals(free.costByArea.editing, 0);
});
