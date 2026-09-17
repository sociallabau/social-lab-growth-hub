// Shared helpers for the integrations (email, Instagram, Meta Ads, Calendly).
// Server-only: these read secrets from process.env and use the admin Supabase client.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyncResult {
  items: number;
  message: string;
}

export class MissingSecretError extends Error {
  constructor(name: string) {
    super(`Missing secret ${name}. Add it in Lovable Cloud, then try Sync now again.`);
  }
}

export function env(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new MissingSecretError(name);
}

/** Records every run so Settings > Integrations can show what happened. */
export async function recordRun(
  db: SupabaseClient,
  integration: string,
  fn: () => Promise<SyncResult>,
): Promise<SyncResult> {
  const { data: run } = await db.from("integration_runs").insert({ integration }).select("id").single();
  try {
    const result = await fn();
    await db.from("integration_runs").update({
      finished_at: new Date().toISOString(), ok: true, items: result.items, message: result.message,
    }).eq("id", run?.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("integration_runs").update({ finished_at: new Date().toISOString(), ok: false, message }).eq("id", run?.id);
    throw error;
  }
}

export async function getState<T>(db: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await db.from("integration_state").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

export async function setState(db: SupabaseClient, key: string, value: unknown) {
  await db.from("integration_state").upsert({ key, value, updated_at: new Date().toISOString() });
}

/** Maps UTM sources and referrers onto the channel list. */
export function channelFromSource(source?: string | null, medium?: string | null): string | null {
  const s = `${source ?? ""} ${medium ?? ""}`.toLowerCase();
  if (!s.trim()) return null;
  if (/(facebook|fb|meta|instagram|ig)/.test(s)) {
    return /(paid|cpc|ads?|paid_social)/.test(s) || /meta|fb/.test(s) ? "Meta Ads" : "Instagram (organic)";
  }
  if (/google/.test(s)) return /(cpc|paid|ads)/.test(s) ? "Google Ads" : "Website / SEO";
  if (/referr/.test(s)) return "Client referral";
  return null;
}

// ---------------------------------------------------------------------------
// Enquiry triage. Uses Lovable AI when a key is available, otherwise keywords.
// Either way a person approves every lead in the Log today inbox.
// ---------------------------------------------------------------------------

export interface Classification {
  is_lead: boolean;
  reason: string;
  summary: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  service_line: string | null;
  number_of_agents: string | null;
  monthly_marketing_budget: string | null;
}

const LEAD_WORDS =
  /(quote|pricing|price|packages?|proposal|enquir|inquir|interested|content|video|shoot|social media|marketing|podcast|brand|photograph|listing|campaign|help us|work with you|book a call|how much)/i;
const NOISE_WORDS =
  /(unsubscribe|newsletter|invoice|receipt|password|verify your|no-?reply|webinar|seo services|guest post|backlinks|out of office|delivery status)/i;

export function keywordClassify(text: string): Classification {
  const isLead = LEAD_WORDS.test(text) && !NOISE_WORDS.test(text);
  return {
    is_lead: isLead,
    reason: isLead ? "Mentions services or pricing" : "No clear enquiry language",
    summary: text.replace(/\s+/g, " ").slice(0, 240),
    name: null, company: null, phone: null, service_line: null,
    number_of_agents: null, monthly_marketing_budget: null,
  };
}

export async function classifyEnquiry(input: { from: string; subject?: string; body: string; channel: string }): Promise<Classification> {
  const text = `${input.subject ?? ""}\n${input.body}`.slice(0, 6000);
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return keywordClassify(text);
  const prompt = `You triage inbound messages for Social Lab, a Gold Coast content and marketing agency whose clients are mostly real estate agencies, builders and property businesses. Services: Media (video and photo content), Digital & Brand (social media, ads, branding), Podcast.

Decide whether this ${input.channel} message is a genuine new-business enquiry (someone who might buy) rather than spam, a vendor selling to us, existing-client admin, a recruiter, a newsletter or a notification.

Reply with only a JSON object with keys: is_lead (boolean), reason (short), summary (one sentence), name, company, phone, service_line (one of "Media", "Digital & Brand", "Podcast" or null), number_of_agents, monthly_marketing_budget. Use null when unknown.

From: ${input.from}
Message:
${text}`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
    return { ...keywordClassify(text), ...parsed, is_lead: Boolean(parsed.is_lead) };
  } catch (error) {
    console.warn("AI triage unavailable, using keywords", error);
    return keywordClassify(text);
  }
}

/** Today in Brisbane, offset by whole days, as yyyy-mm-dd. */
export function brisbaneDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(d);
}
