// Loads the week's data, builds the Monday email and sends it through Resend.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, type ISODate } from "@/lib/metrics";
import { brisbaneDate, env, recordRun, type SyncResult } from "@/server/integrations/shared";
import { buildWeeklyReport, lastWeekStart, type ReportLead } from "./weekly-report";

export interface WeeklyOptions {
  /** Monday of the week to report on. Defaults to the week that just finished. */
  weekStart?: ISODate;
  /** Build the email and return it without sending. */
  preview?: boolean;
  /** Override the recipients; defaults to every active team member. */
  to?: string[];
}

export async function buildWeekly(db: SupabaseClient, options: WeeklyOptions = {}) {
  const today = brisbaneDate(0);
  const weekStart = options.weekStart ?? lastWeekStart(today);
  const weekEnd = addDays(weekStart, 6);

  const [settingsRes, entriesRes, clientsRes, leadsRes, checkinsRes, teamRes] = await Promise.all([
    db.from("settings").select("*").eq("id", 1).single(),
    db.from("daily_entries").select("*").gte("date", addDays(weekStart, -7)).lte("date", today),
    db.from("clients").select("*"),
    db.from("leads").select("id, name, company, status, channel, received_at, first_response_at, meeting_at"),
    db.from("daily_checkins").select("date").gte("date", weekStart).lte("date", weekEnd),
    db.from("team_members").select("email").eq("active", true),
  ]);

  const failure = [settingsRes, entriesRes, clientsRes, leadsRes, checkinsRes, teamRes].find((r) => r.error);
  if (failure?.error) throw new Error(failure.error.message);

  const report = buildWeeklyReport({
    weekStart,
    today,
    settings: settingsRes.data,
    entries: entriesRes.data ?? [],
    clients: clientsRes.data ?? [],
    leads: (leadsRes.data ?? []) as ReportLead[],
    checkinDates: (checkinsRes.data ?? []).map((c) => c.date as ISODate),
    appUrl: process.env["APP_URL"]?.trim() ?? "",
  });

  const team = (teamRes.data ?? []).map((t) => (t.email as string).toLowerCase());
  // A caller can narrow the recipients for a test send, but only to people on the team
  const requested = options.to?.map((email) => email.trim().toLowerCase()).filter(Boolean);
  const recipients = requested?.length ? requested.filter((email) => team.includes(email)) : team;
  if (requested?.length && !recipients.length) throw new Error("Those addresses are not on the team list");
  return { report, recipients, weekStart, weekEnd };
}

interface Email {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends through whichever transport is configured: the Gmail relay (an Apps
 * Script in our own Google account, see docs/gmail-relay.gs) or Resend.
 */
async function deliver(email: Email): Promise<string> {
  const relayUrl = process.env["GMAIL_RELAY_URL"]?.trim();
  if (relayUrl) {
    const res = await fetch(relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Apps Script answers the redirect with the JSON body
      redirect: "follow",
      body: JSON.stringify({
        secret: env("GMAIL_RELAY_SECRET"),
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        fromName: process.env["REPORT_FROM_NAME"]?.trim() || "Social Lab Growth Hub",
      }),
    });
    const raw = await res.text();
    let body: { ok?: boolean; error?: string } = {};
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      throw new Error(`Gmail relay returned something unexpected: ${raw.slice(0, 200)}`);
    }
    if (!res.ok || body.ok === false) throw new Error(`Gmail relay: ${body.error ?? res.status}`);
    return "Gmail";
  }

  const apiKey = env("RESEND_API_KEY");
  const from = env("REPORT_FROM_EMAIL");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: email.to, subject: email.subject, html: email.html, text: email.text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return "Resend";
}

export async function sendWeeklyReport(db: SupabaseClient, options: WeeklyOptions = {}): Promise<SyncResult & { subject: string; html?: string }> {
  const { report, recipients, weekStart } = await buildWeekly(db, options);
  if (options.preview) {
    return { items: 0, message: `Preview for the week of ${weekStart}`, subject: report.subject, html: report.html };
  }

  return {
    ...(await recordRun(db, "weekly_report", async () => {
      if (!recipients.length) throw new Error("No active team members to send to");
      const via = await deliver({ to: recipients, subject: report.subject, html: report.html, text: report.text });
      return { items: recipients.length, message: `Sent via ${via} to ${recipients.join(", ")}` };
    })),
    subject: report.subject,
  };
}
