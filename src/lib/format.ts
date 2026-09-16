export const TIME_ZONE = "Australia/Brisbane";

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const dateTimeFmt = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

/** AUD, e.g. $4,500 */
export function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return currency.format(value);
}

/** dd/mm/yyyy in Brisbane time */
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseDateInput(value) : value;
  return dateFmt.format(date);
}

/** dd/mm/yyyy hh:mm in Brisbane time */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseDateInput(value) : value;
  return dateTimeFmt.format(date);
}

export function formatPercent(value: number | null | undefined, digits = 0) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** Today's date in Brisbane as yyyy-mm-dd (matches date columns) */
export function todayInBrisbane() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date());
  return parts;
}

function parseDateInput(value: string) {
  // Plain date columns (yyyy-mm-dd) must not shift across time zones.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+10:00`);
  return new Date(value);
}

/** "17/09/2026" -> "2026-09-17"; null when the text isn't a real date */
export function parseAUDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}
