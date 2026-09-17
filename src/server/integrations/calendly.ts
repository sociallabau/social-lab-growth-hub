// Calendly bookings and cancellations, and the one-off webhook registration.
import type { SupabaseClient } from "@supabase/supabase-js";
import { channelFromSource, env, recordRun, type SyncResult } from "./shared";

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  text_reminder_number?: string | null;
  questions_and_answers?: { question: string; answer: string }[];
  tracking?: { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null };
  scheduled_event: { uri: string; name: string; start_time: string };
  cancellation?: { reason?: string | null };
}

/** Calendly signs each webhook: header "t=<unix>,v1=<hmac sha256 of `t.body`>". */
export async function verifyCalendlySignature(header: string | null, body: string, signingKey: string): Promise<void> {
  // Without a configured key an empty-key HMAC would be forgeable, so fail closed.
  if (!signingKey) throw new Error("Calendly signing key is not configured");
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.split("=") as [string, string]));
  if (!parts['t'] || !parts['v1']) throw new Error("Missing Calendly signature");
  if (Math.abs(Date.now() / 1000 - Number(parts['t'])) > 300) throw new Error("Stale Calendly signature");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts['t']}.${body}`));
  const hex = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== parts['v1']) throw new Error("Bad Calendly signature");
}

const answerTo = (qa: CalendlyInvitee["questions_and_answers"], pattern: RegExp) =>
  qa?.find((q) => pattern.test(q.question))?.answer ?? null;

export async function handleCalendlyEvent(db: SupabaseClient, event: string, payload: CalendlyInvitee): Promise<SyncResult> {
  return recordRun(db, "calendly", async () => {
    const email = payload.email.toLowerCase();
    const { data: existing } = await db.from("leads")
      .select("id, status")
      .ilike("email", email)
      .not("status", "in", "(rejected,won,lost)")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (event === "invitee.canceled") {
      if (existing) {
        await db.from("leads").update({
          meeting_at: null,
          status: existing.status === "meeting_booked" ? "contacted" : existing.status,
        }).eq("id", existing.id);
        await db.from("lead_activities").insert({
          lead_id: existing.id,
          kind: "calendly",
          body: `Cancelled ${payload.scheduled_event.name}${payload.cancellation?.reason ? `: ${payload.cancellation.reason}` : ""}`,
        });
      }
      return { items: existing ? 1 : 0, message: "cancellation" };
    }

    const qa = payload.questions_and_answers;
    const details = {
      meeting_at: payload.scheduled_event.start_time,
      phone: payload.text_reminder_number ?? answerTo(qa, /phone|mobile/i),
      company: answerTo(qa, /company|agency|business/i),
      number_of_agents: answerTo(qa, /agents|listings|team size/i),
      monthly_marketing_budget: answerTo(qa, /budget/i),
    };
    const notes = (qa ?? []).map((q) => `${q.question}: ${q.answer}`).join("\n");

    let leadId = existing?.id;
    if (existing) {
      const { error } = await db.from("leads").update({
        ...Object.fromEntries(Object.entries(details).filter(([, v]) => v)),
        status: ["pending", "new", "contacted"].includes(existing.status) ? "meeting_booked" : existing.status,
      }).eq("id", existing.id);
      if (error) throw error;
    } else {
      // A booked call is genuinely a lead, so it skips the approval inbox.
      const { data, error } = await db.from("leads").insert({
        ...details,
        source: "calendly",
        source_ref: `calendly:${payload.uri}`,
        name: payload.name,
        email,
        channel: channelFromSource(payload.tracking?.utm_source, payload.tracking?.utm_medium),
        subject: payload.scheduled_event.name,
        message: notes || null,
        status: "meeting_booked",
        first_response_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      leadId = data.id;
    }

    await db.from("lead_activities").insert({
      lead_id: leadId,
      kind: "calendly",
      body: `Booked ${payload.scheduled_event.name} for ${payload.scheduled_event.start_time}` +
        (payload.tracking?.utm_campaign ? ` (campaign: ${payload.tracking.utm_campaign})` : ""),
    });
    return { items: 1, message: "booking" };
  });
}

/** Registers the webhook with Calendly. Run once from Settings > Integrations. */
export async function registerCalendlyWebhook(webhookUrl: string) {
  const token = env("CALENDLY_TOKEN");
  const signingKey = env("CALENDLY_WEBHOOK_SIGNING_KEY");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const me = await fetch("https://api.calendly.com/users/me", { headers }).then((r) => r.json());
  if (!me.resource) throw new Error("Calendly rejected the token");

  const res = await fetch("https://api.calendly.com/webhook_subscriptions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: webhookUrl,
      events: ["invitee.created", "invitee.canceled"],
      organization: me.resource.current_organization,
      user: me.resource.uri,
      scope: "user",
      signing_key: signingKey,
    }),
  });
  const data = await res.json();
  if (!res.ok && res.status !== 409) throw new Error(`Calendly refused the webhook: ${JSON.stringify(data)}`);
  return { url: webhookUrl, calendlyUser: me.resource.name as string, alreadyRegistered: res.status === 409 };
}
