// Daily Log helpers: prefilling today's numbers from the CRM and validating rows.
// All maths that the dashboard also uses lives in src/lib/metrics.ts.
import { responseMinutes, type ISODate } from "@/lib/metrics";

export const DEFAULT_SERVICE_LINE = "Digital & Brand";
export const META_CHANNEL = "Meta Ads";
export const OTHER_CHANNEL = "Other";

const brisbaneFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" });

/** Calendar date (yyyy-mm-dd) of a timestamp in Brisbane time. */
export function brisbaneDate(ts: string | null | undefined): ISODate | null {
  if (!ts) return null;
  return brisbaneFmt.format(new Date(ts));
}

export type AutoField =
  | "new_leads"
  | "responded_within_30_min"
  | "meetings_held"
  | "clients_won"
  | "value_won_monthly"
  | "marketing_spend";

export interface DraftRow {
  key: string;
  channel: string;
  service_line: string;
  new_leads: number;
  responded_within_30_min: number;
  meetings_held: number;
  clients_won: number;
  value_won_monthly: number;
  marketing_spend: number;
  notes: string;
  /** Cells that came from the CRM rather than being typed in. */
  auto: AutoField[];
}

export interface PrefillLead {
  status: string;
  channel: string | null;
  service_line: string | null;
  received_at: string;
  first_response_at: string | null;
  meeting_at: string | null;
  won_at: string | null;
  won_value: number | null;
}

const EXCLUDED_STATUSES = new Set(["pending", "rejected"]);

function emptyRow(channel: string, service_line: string): DraftRow {
  return {
    key: `${channel}|||${service_line}`,
    channel,
    service_line,
    new_leads: 0,
    responded_within_30_min: 0,
    meetings_held: 0,
    clients_won: 0,
    value_won_monthly: 0,
    marketing_spend: 0,
    notes: "",
    auto: [],
  };
}

/** Today's numbers, derived from the CRM and Meta Ads spend for one date. */
export function prefillFromCrm(leads: PrefillLead[], metaSpend: number, date: ISODate): DraftRow[] {
  const rows = new Map<string, DraftRow>();
  const row = (channel: string | null, service_line: string | null) => {
    const c = channel || OTHER_CHANNEL;
    const s = service_line || DEFAULT_SERVICE_LINE;
    const key = `${c}|||${s}`;
    let existing = rows.get(key);
    if (!existing) {
      existing = emptyRow(c, s);
      rows.set(key, existing);
    }
    return existing;
  };

  for (const lead of leads) {
    if (!EXCLUDED_STATUSES.has(lead.status) && brisbaneDate(lead.received_at) === date) {
      const r = row(lead.channel, lead.service_line);
      r.new_leads += 1;
      const minutes = responseMinutes(lead.received_at, lead.first_response_at);
      if (minutes !== null && minutes <= 30) r.responded_within_30_min += 1;
    }
    if (lead.status === "meeting_held" && brisbaneDate(lead.meeting_at) === date) {
      row(lead.channel, lead.service_line).meetings_held += 1;
    }
    if (brisbaneDate(lead.won_at) === date) {
      const r = row(lead.channel, lead.service_line);
      r.clients_won += 1;
      r.value_won_monthly += Number(lead.won_value) || 0;
    }
  }

  if (metaSpend > 0) {
    const metaRows = [...rows.values()].filter((r) => r.channel === META_CHANNEL);
    const target = metaRows.length
      ? metaRows.reduce((a, b) => (b.new_leads > a.new_leads ? b : a))
      : row(META_CHANNEL, DEFAULT_SERVICE_LINE);
    target.marketing_spend = metaSpend;
  }

  for (const r of rows.values()) {
    r.auto = (
      [
        "new_leads",
        "responded_within_30_min",
        "meetings_held",
        "clients_won",
        "value_won_monthly",
        "marketing_spend",
      ] as AutoField[]
    ).filter((f) => Number(r[f]) > 0);
  }

  return [...rows.values()].sort((a, b) => b.new_leads - a.new_leads || a.channel.localeCompare(b.channel));
}

export function newDraftRow(channel = "", service_line = ""): DraftRow {
  const r = emptyRow(channel, service_line);
  r.key = `new-${Math.random().toString(36).slice(2)}`;
  return r;
}

export interface RowValues {
  channel: string;
  service_line: string;
  new_leads: number;
  responded_within_30_min: number;
  meetings_held: number;
  clients_won: number;
  value_won_monthly: number;
  marketing_spend: number;
}

/** Null when the row is valid, otherwise a message for the person entering it. */
export function rowError(r: RowValues): string | null {
  if (!r.channel) return "Choose a channel";
  if (!r.service_line) return "Choose a service line";
  const numbers: (keyof RowValues)[] = [
    "new_leads",
    "responded_within_30_min",
    "meetings_held",
    "clients_won",
    "value_won_monthly",
    "marketing_spend",
  ];
  for (const key of numbers) {
    const value = Number(r[key]);
    if (!Number.isFinite(value) || value < 0) return "Numbers cannot be negative";
  }
  if (Number(r.responded_within_30_min) > Number(r.new_leads))
    return "Responded within 30 min cannot be more than new leads";
  return null;
}

export function sumRows(rows: RowValues[]) {
  const total = {
    new_leads: 0,
    responded_within_30_min: 0,
    meetings_held: 0,
    clients_won: 0,
    value_won_monthly: 0,
    marketing_spend: 0,
  };
  for (const r of rows) {
    total.new_leads += Number(r.new_leads) || 0;
    total.responded_within_30_min += Number(r.responded_within_30_min) || 0;
    total.meetings_held += Number(r.meetings_held) || 0;
    total.clients_won += Number(r.clients_won) || 0;
    total.value_won_monthly += Number(r.value_won_monthly) || 0;
    total.marketing_spend += Number(r.marketing_spend) || 0;
  }
  return total;
}
