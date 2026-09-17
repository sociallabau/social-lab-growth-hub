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

  const recipients = options.to ?? (teamRes.data ?? []).map((t) => t.email as string);
  return { report, recipients, weekStart, weekEnd };
}

export async function sendWeeklyReport(db: SupabaseClient, options: WeeklyOptions = {}): Promise<SyncResult & { subject: string; html?: string }> {
  const { report, recipients, weekStart } = await buildWeekly(db, options);
  if (options.preview) {
    return { items: 0, message: `Preview for the week of ${weekStart}`, subject: report.subject, html: report.html };
  }

  return {
    ...(await recordRun(db, "weekly_report", async () => {
      if (!recipients.length) throw new Error("No active team members to send to");
      const apiKey = env("RESEND_API_KEY");
      const from = env("REPORT_FROM_EMAIL");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: recipients, subject: report.subject, html: report.html, text: report.text }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { items: recipients.length, message: `Sent to ${recipients.join(", ")}` };
    })),
    subject: report.subject,
  };
}
