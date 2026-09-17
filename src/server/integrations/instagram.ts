// Checks Instagram DMs. New conversations land in the Log today approval inbox,
// and our first reply is timestamped for speed to lead.
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyEnquiry, env, getState, recordRun, setState, type SyncResult } from "./shared";

const GRAPH = "https://graph.facebook.com/v23.0";

export interface IgMessage {
  id: string;
  created_time: string;
  message?: string;
  from: { id: string; username?: string };
}

interface IgConversation {
  id: string;
  updated_time: string;
  participants: { data: { id: string; username?: string }[] };
  messages?: { data: IgMessage[] };
}

/** The first message they sent, and our first reply after it. */
export function responseTimes(messages: IgMessage[], ourId: string) {
  const ordered = messages
    .map((m) => ({ ...m, created_time: new Date(m.created_time).toISOString() }))
    .sort((a, b) => a.created_time.localeCompare(b.created_time));
  const firstIn = ordered.find((m) => m.from.id !== ourId);
  const firstReply = firstIn ? ordered.find((m) => m.from.id === ourId && m.created_time > firstIn.created_time) : undefined;
  return { firstIn, firstReply, inbound: ordered.filter((m) => m.from.id !== ourId) };
}

export async function syncInstagram(db: SupabaseClient): Promise<SyncResult> {
  const pageId = env("META_PAGE_ID");
  const pageToken = env("META_PAGE_ACCESS_TOKEN");
  const igId = env("INSTAGRAM_BUSINESS_ACCOUNT_ID");

  return recordRun(db, "instagram", async () => {
    const since = await getState<string>(db, "instagram.updated_since", new Date(Date.now() - 3 * 86_400_000).toISOString());
    const params = new URLSearchParams({
      platform: "instagram",
      fields: "id,updated_time,participants,messages.limit(25){id,created_time,message,from}",
      limit: "50",
      access_token: pageToken,
    });
    let next: string | null = `${GRAPH}/${pageId}/conversations?${params}`;
    let newest = since;
    let created = 0;
    let updated = 0;

    pages: while (next) {
      const page: { data?: IgConversation[]; paging?: { next?: string }; error?: { message: string } } =
        await fetch(next).then((r) => r.json());
      if (page.error) throw new Error(`Instagram: ${page.error.message}`);

      for (const convo of page.data ?? []) {
        // Meta sends "+0000" offsets; normalise so string comparisons are safe
        const updatedAt = new Date(convo.updated_time).toISOString();
        if (updatedAt <= since) break pages; // most recently updated first
        if (updatedAt > newest) newest = updatedAt;

        const { firstIn, firstReply, inbound } = responseTimes(convo.messages?.data ?? [], igId);
        if (!firstIn) continue;

        const sourceRef = `instagram:${convo.id}`;
        const { data: existing } = await db.from("leads").select("id, first_response_at").eq("source_ref", sourceRef).maybeSingle();
        if (existing) {
          if (!existing.first_response_at && firstReply) {
            await db.from("leads").update({ first_response_at: firstReply.created_time }).eq("id", existing.id);
            updated++;
          }
          continue;
        }

        const handle = convo.participants.data.find((p) => p.id !== igId)?.username ?? firstIn.from.username ?? null;
        const text = inbound.map((m) => m.message ?? "").filter(Boolean).join("\n");
        const ai = await classifyEnquiry({ from: `@${handle}`, body: text, channel: "Instagram DM" });
        const { error } = await db.from("leads").insert({
          source: "instagram",
          source_ref: sourceRef,
          received_at: firstIn.created_time,
          instagram_handle: handle,
          name: ai.name,
          company: ai.company,
          phone: ai.phone,
          channel: "Instagram (organic)",
          service_line: ai.service_line,
          subject: "Instagram DM",
          message: text.slice(0, 4000),
          ai_summary: ai.summary,
          ai_is_lead: ai.is_lead,
          ai_reason: ai.reason,
          number_of_agents: ai.number_of_agents,
          monthly_marketing_budget: ai.monthly_marketing_budget,
          first_response_at: firstReply?.created_time ?? null,
          status: "pending",
        });
        if (error) throw error;
        created++;
      }
      next = page.paging?.next ?? null;
    }

    await setState(db, "instagram.updated_since", newest);
    return { items: created + updated, message: `${created} new conversation(s), ${updated} reply time(s) recorded` };
  });
}
