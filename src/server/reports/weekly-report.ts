// The Monday email. Pure functions: data in, subject and HTML out, so the numbers
// can be tested and always match the dashboard (both use src/lib/metrics.ts).
import {
  addDays,
  bottomThirtyPercent,
  isActiveOn,
  monthStart,
  responseMinutes,
  totals,
  type Client,
  type DailyEntry,
  type ISODate,
  type Settings,
} from "@/lib/metrics";

export interface ReportLead {
  id: string;
  name: string | null;
  company: string | null;
  status: string;
  channel: string | null;
  received_at: string;
  first_response_at: string | null;
  meeting_at: string | null;
}

export interface ReportInput {
  weekStart: ISODate; // Monday of the week being reported (the one just finished)
  today: ISODate;
  settings: Settings;
  entries: DailyEntry[];
  clients: Client[];
  leads: ReportLead[];
  appUrl: string;
  checkinDates: ISODate[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const money = (v: number) =>
  `$${Math.round(v).toLocaleString("en-AU")}`;
const AU_DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
const day = (d: ISODate) => AU_DATE.format(new Date(`${d}T00:00:00Z`));

export type Verdict = "on_target" | "watch" | "off_target";

export interface Headline {
  label: string;
  value: string;
  target: string;
  verdict: Verdict;
  change: string;
}

const VERDICT_WORD: Record<Verdict, string> = {
  on_target: "On target",
  watch: "Watch",
  off_target: "Off target",
};

function verdictFor(actual: number, target: number): Verdict {
  if (!target) return "watch";
  const ratio = actual / target;
  if (ratio >= 1) return "on_target";
  if (ratio >= 0.7) return "watch";
  return "off_target";
}

function changeLabel(now: number, before: number, format: (v: number) => string): string {
  if (!before && !now) return "same as the week before";
  if (!before) return `up from ${format(0)} the week before`;
  const diff = now - before;
  if (Math.abs(diff) < 1e-9) return "same as the week before";
  return `${diff > 0 ? "up" : "down"} from ${format(before)} the week before`;
}

export function buildWeeklyReport(input: ReportInput) {
  const { settings, entries, clients, leads, weekStart } = input;
  const weekEnd = addDays(weekStart, 6);
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);

  const week = totals(entries, weekStart, weekEnd);
  const prev = totals(entries, prevStart, prevEnd);
  const mtd = totals(entries, monthStart(input.today), input.today);

  const leadTarget = Number(settings.target_leads_per_week) || 0;
  const speedTarget = Number(settings.target_responded_30) || 0;
  const conversionTarget = Number(settings.target_conversion) || 0;

  const headlines: Headline[] = [
    {
      label: "Leads",
      value: String(week.leads),
      target: `${leadTarget} a week`,
      verdict: verdictFor(week.leads, leadTarget),
      change: changeLabel(week.leads, prev.leads, (v) => String(Math.round(v))),
    },
    {
      label: "Speed to lead",
      value: week.leads ? pct(week.speedToLead) : "no leads",
      target: `${pct(speedTarget)} within 30 min`,
      verdict: week.leads ? verdictFor(week.speedToLead, speedTarget) : "watch",
      change: changeLabel(week.speedToLead, prev.speedToLead, pct),
    },
    {
      label: "Conversion",
      value: week.leads ? pct(week.conversion) : "no leads",
      // Above 40% is the signal to raise prices, so it is not simply "more is better"
      target: `${pct(conversionTarget)} sweet spot`,
      verdict: week.conversion > 0.4 ? "watch" : week.leads ? verdictFor(week.conversion, conversionTarget) : "watch",
      change: changeLabel(week.conversion, prev.conversion, pct),
    },
  ];

  const active = clients.filter((c) => isActiveOn(c, input.today));
  const mrr = active.reduce((s, c) => s + (Number(c.monthly_fee) || 0), 0);
  const lostThisMonth = clients.filter(
    (c) => c.end_date && c.end_date >= monthStart(input.today) && c.end_date <= input.today,
  );

  // What needs a person to do something
  const attention: string[] = [];
  const unanswered = leads.filter(
    (l) => l.status === "new" && !l.first_response_at && (responseMinutes(l.received_at, new Date().toISOString()) ?? 0) > 30,
  );
  if (unanswered.length) {
    attention.push(
      `${unanswered.length} lead${unanswered.length > 1 ? "s" : ""} still waiting on a first reply: ${unanswered
        .slice(0, 3)
        .map((l) => l.company ?? l.name ?? "unnamed")
        .join(", ")}`,
    );
  }
  const staleMeetings = leads.filter((l) => l.status === "meeting_booked" && l.meeting_at && l.meeting_at < input.today);
  if (staleMeetings.length) {
    attention.push(`${staleMeetings.length} meeting${staleMeetings.length > 1 ? "s have" : " has"} been and gone without an outcome logged`);
  }
  const missedDays = [0, 1, 2, 3, 4]
    .map((i) => addDays(weekStart, i))
    .filter((d) => !input.checkinDates.includes(d));
  if (missedDays.length) {
    attention.push(`Daily log missed on ${missedDays.map(day).join(", ")}`);
  }
  if (week.conversion > 0.4 && week.wins >= 3) {
    attention.push(`Converting at ${pct(week.conversion)}: time to test a price increase`);
  }
  if (week.leads < leadTarget) {
    attention.push(`Lead generation is ${leadTarget - week.leads} short of the weekly target: keep it switched on`);
  }
  const bottom = bottomThirtyPercent(clients, input.today);
  if (bottom.length) {
    const cheapest = bottom.slice(0, 3).map((c) => `${c.name} (${money(Number(c.monthly_fee) || 0)})`).join(", ");
    attention.push(`Cheapest 30% of the book to reprice or move on: ${cheapest}`);
  }

  const subject = `Social Lab week of ${day(weekStart)}: ${week.leads} leads, ${
    week.leads ? pct(week.speedToLead) : "0%"
  } speed to lead, ${week.leads ? pct(week.conversion) : "0%"} conversion`;

  return {
    subject,
    headlines,
    week,
    prev,
    mtd,
    mrr,
    activeClients: active.length,
    lostThisMonth: lostThisMonth.length,
    attention,
    weekStart,
    weekEnd,
    html: renderHtml({ input, headlines, week, mtd, mrr, activeCount: active.length, lostCount: lostThisMonth.length, attention, weekStart, weekEnd, subject }),
    text: renderText({ headlines, week, mtd, mrr, activeCount: active.length, attention, weekStart, weekEnd, appUrl: input.appUrl }),
  };
}

interface RenderArgs {
  input?: ReportInput;
  headlines: Headline[];
  week: ReturnType<typeof totals>;
  mtd: ReturnType<typeof totals>;
  mrr: number;
  activeCount: number;
  lostCount?: number;
  attention: string[];
  weekStart: ISODate;
  weekEnd: ISODate;
  subject?: string;
  appUrl?: string;
}

function renderText(a: RenderArgs): string {
  const lines = [
    `Social Lab growth, week of ${day(a.weekStart)} to ${day(a.weekEnd)}`,
    "",
    ...a.headlines.map((h) => `${h.label}: ${h.value} (target ${h.target}) - ${VERDICT_WORD[h.verdict]}, ${h.change}`),
    "",
    `Meetings held: ${a.week.meetings}`,
    `Clients won: ${a.week.wins} worth ${money(a.week.value)} a month`,
    `Marketing spend: ${money(a.week.spend)}`,
    `Month to date: ${a.mtd.leads} leads, ${a.mtd.wins} won, ${money(a.mtd.value)} new monthly revenue`,
    `Book: ${a.activeCount} active clients, ${money(a.mrr)} MRR`,
    "",
    "Needs attention:",
    ...(a.attention.length ? a.attention.map((t) => `- ${t}`) : ["- Nothing. Good week."]),
    "",
    `Open the dashboard: ${a.appUrl ?? ""}`,
  ];
  return lines.join("\n");
}

function renderHtml(a: RenderArgs): string {
  const appUrl = a.input?.appUrl ?? "";
  const card = (h: Headline) => `
    <td style="padding:0 8px 0 0;width:33.33%;vertical-align:top">
      <div style="border:1px solid #2a2a2a;border-radius:12px;padding:16px;background:#141414">
        <div style="font:600 11px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a1a1a1">${h.label}</div>
        <div style="font:700 32px/1.2 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#fafafa;margin:6px 0;font-variant-numeric:tabular-nums">${h.value}</div>
        <div style="font:400 12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#a1a1a1">Target ${h.target}</div>
        <div style="font:600 12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${h.verdict === "on_target" ? "#fafafa" : "#fab219"};margin-top:6px">${VERDICT_WORD[h.verdict]}</div>
        <div style="font:400 12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#6b6b6b">${h.change}</div>
      </div>
    </td>`;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 0;font:400 13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#a1a1a1">${label}</td>
      <td style="padding:6px 0;font:600 13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#fafafa;text-align:right;font-variant-numeric:tabular-nums">${value}</td>
    </tr>`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#0a0a0a">
  <div style="max-width:640px;margin:0 auto">
    <p style="font:600 12px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#6b6b6b;margin:0 0 4px">Social Lab growth hub</p>
    <h1 style="font:700 20px/1.3 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#fafafa;margin:0 0 4px">Week of ${day(a.weekStart)} to ${day(a.weekEnd)}</h1>
    <p style="font:400 13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#a1a1a1;margin:0 0 20px">The three numbers to talk about on Monday.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>${a.headlines.map(card).join("")}</tr></table>

    <div style="border:1px solid #2a2a2a;border-radius:12px;padding:16px;background:#141414;margin-bottom:20px">
      <div style="font:600 11px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a1a1a1;margin-bottom:8px">The rest of the week</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row("Meetings held", String(a.week.meetings))}
        ${row("Clients won", `${a.week.wins} · ${money(a.week.value)}/mo`)}
        ${row("Marketing spend", money(a.week.spend))}
        ${row("Month to date", `${a.mtd.leads} leads · ${a.mtd.wins} won · ${money(a.mtd.value)}/mo`)}
        ${row("Active clients", `${a.activeCount}${a.lostCount ? ` (${a.lostCount} lost this month)` : ""}`)}
        ${row("Monthly recurring revenue", money(a.mrr))}
      </table>
    </div>

    <div style="border:1px solid #2a2a2a;border-radius:12px;padding:16px;background:#141414;margin-bottom:20px">
      <div style="font:600 11px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a1a1a1;margin-bottom:8px">Needs attention</div>
      ${
        a.attention.length
          ? `<ul style="margin:0;padding-left:18px">${a.attention
              .map(
                (t) =>
                  `<li style="font:400 13px/1.7 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#fafafa">${escapeHtml(t)}</li>`,
              )
              .join("")}</ul>`
          : `<p style="font:400 13px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#fafafa;margin:0">Nothing. Good week.</p>`
      }
    </div>

    ${
      appUrl
        ? `<a href="${appUrl}" style="display:inline-block;background:#fafafa;color:#0a0a0a;text-decoration:none;font:600 13px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:12px 18px;border-radius:8px">Open the dashboard</a>`
        : ""
    }
    <p style="font:400 11px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#6b6b6b;margin:20px 0 0">Sent every Monday from the Social Lab Growth Hub.</p>
  </div>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Monday of the week that just finished, in Brisbane. */
export function lastWeekStart(today: ISODate): ISODate {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun ... 1 Mon
  const daysSinceMonday = (weekday + 6) % 7;
  return addDays(today, -daysSinceMonday - 7);
}
