// Shared lead constants and label helpers. All calculations come from
// src/lib/metrics.ts — nothing numeric is reimplemented here.
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "meeting_booked",
  "meeting_held",
  "proposal",
  "won",
  "lost",
  "nurture",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  meeting_booked: "Meeting booked",
  meeting_held: "Meeting held",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
  pending: "Pending review",
  rejected: "Rejected",
};

export const HIDDEN_STATUSES = ["pending", "rejected"];

export const LOST_REASONS = [
  "Price",
  "Timing",
  "Chose another agency",
  "No response",
  "Not a fit",
  "Other",
] as const;

export const FIT_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "fit", label: "Fit" },
  { value: "not_fit", label: "Not a fit" },
] as const;

export const PRICE_BANDS = ["current", "mid", "high"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];

export const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  current: "Current",
  mid: "Mid",
  high: "High",
};

export function priceBandAmount(
  band: PriceBand,
  settings: { price_point_current: number; price_point_mid: number; price_point_high: number } | undefined,
): number | null {
  if (!settings) return null;
  if (band === "current") return Number(settings.price_point_current);
  if (band === "mid") return Number(settings.price_point_mid);
  return Number(settings.price_point_high);
}

/** Minutes a lead has been waiting for a first response. */
export function minutesWaiting(receivedAt: string, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(receivedAt).getTime()) / 60_000);
}

export function notFitReply(name: string | null, resourceUrl: string | null | undefined): string {
  return `Hi ${name ?? "there"},\n\nThanks for reaching out to Social Lab. Based on what you've shared we're not the right fit right now, but here's a free resource that should help you get moving: ${resourceUrl ?? "(add the resource link in Settings)"}\n\nIf things change, we'd love to hear from you.\n\nSocial Lab`;
}
