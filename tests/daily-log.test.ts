// Run with: deno task test
import { assertEquals } from "jsr:@std/assert@1";
import {
  applyWinToRows,
  brisbaneTimeNow,
  brisbaneTimestamp,
  enquiryError,
  enquiryToLead,
  newDraftRow,
  newEnquiryDraft,
  prefillFromCrm,
  winError,
  winToClient,
} from "../src/lib/daily-log.ts";
import { responseMinutes } from "../src/lib/metrics.ts";

const draft = (over: Partial<ReturnType<typeof newEnquiryDraft>> = {}) => ({
  ...newEnquiryDraft("Instagram (organic)", "Tier 2", "09:20"),
  name: "Jane Smith",
  ...over,
});

Deno.test("manual enquiry becomes a lead at the right Brisbane time", () => {
  const lead = enquiryToLead(draft({ company: "Harbourside", email: " Jane@Harbourside.com.au ", note: "Wants reels" }), "2026-09-17");
  assertEquals(lead.received_at, "2026-09-17T09:20:00+10:00");
  assertEquals(new Date(lead.received_at).toISOString(), "2026-09-16T23:20:00.000Z");
  assertEquals(lead.status, "new");
  assertEquals(lead.source, "manual");
  assertEquals(lead.email, "jane@harbourside.com.au");
  assertEquals(lead.channel, "Instagram (organic)");
  assertEquals(lead.message, "Wants reels");
  assertEquals(lead.first_response_at, null);
});

Deno.test("replied within 30 minutes counts toward speed to lead", () => {
  const lead = enquiryToLead(draft({ replied_within_30: true }), "2026-09-17");
  const minutes = responseMinutes(lead.received_at, lead.first_response_at);
  assertEquals(minutes, 15);
  assertEquals(minutes !== null && minutes <= 30, true);
});

Deno.test("enquiry validation", () => {
  assertEquals(enquiryError(draft()), null);
  assertEquals(enquiryError(draft({ name: "", company: "" })), "Add a name or a company");
  assertEquals(enquiryError(draft({ channel: "" })), "Choose a channel for each enquiry");
  assertEquals(enquiryError(draft({ tier: "" })), "Choose a tier for each enquiry");
  assertEquals(enquiryError(draft({ time: "9am" })), "Enter the time as hh:mm");
});

Deno.test("manual leads flow into the day's numbers", () => {
  const leads = [
    {
      status: "new", channel: "Instagram (organic)", tier: "Tier 2",
      received_at: "2026-09-17T09:20:00+10:00", first_response_at: "2026-09-17T09:35:00+10:00",
      meeting_at: null, won_at: null, won_value: null,
    },
    {
      status: "new", channel: "Instagram (organic)", tier: "Tier 2",
      received_at: "2026-09-17T14:00:00+10:00", first_response_at: null,
      meeting_at: null, won_at: null, won_value: null,
    },
  ];
  const rows = prefillFromCrm(leads, 0, "2026-09-17");
  assertEquals(rows.length, 1);
  assertEquals(rows[0].new_leads, 2);
  assertEquals(rows[0].responded_within_30_min, 1);
});

Deno.test("a win creates the client and lands on the right row", () => {
  const win = {
    lead_id: "lead-1", client_name: " Harbourside Realty ", monthly_fee: 4500,
    tier: "Tier 1", channel: "Client referral",
  };
  assertEquals(winError(win), null);
  assertEquals(winError({ ...win, monthly_fee: 0 }), "Add the monthly fee");
  assertEquals(winError({ ...win, client_name: "  " }), "Add the client name");

  const client = winToClient(win, "2026-09-17");
  assertEquals(client.name, "Harbourside Realty");
  assertEquals(client.start_date, "2026-09-17");
  assertEquals(client.monthly_fee, 4500);
  assertEquals(client.lead_id, "lead-1");

  const existing = newDraftRow("Client referral", "Tier 1");
  existing.new_leads = 2;
  const updated = applyWinToRows([existing], win);
  assertEquals(updated.length, 1);
  assertEquals(updated[0].clients_won, 1);
  assertEquals(updated[0].value_won_monthly, 4500);
  assertEquals(updated[0].new_leads, 2);

  const added = applyWinToRows([], win);
  assertEquals(added.length, 1);
  assertEquals(added[0].channel, "Client referral");
  assertEquals(added[0].clients_won, 1);
});

Deno.test("Brisbane time helpers", () => {
  assertEquals(brisbaneTimestamp("2026-09-17", "9:05"), "2026-09-17T09:05:00+10:00");
  assertEquals(brisbaneTimeNow(new Date("2026-09-17T03:07:00Z")), "13:07");
});
