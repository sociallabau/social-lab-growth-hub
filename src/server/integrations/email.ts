// Reads the enquiries mailbox over IMAP (read-only) and turns new messages into
// pending leads. Replies found in the Sent folder stamp first_response_at,
// which is what speed to lead is measured from.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ImapClient } from "./imap";
import { parseMessage } from "./mime";
import { classifyEnquiry, env, getState, recordRun, setState, type SyncResult } from "./shared";

interface Cursor {
  uidValidity?: string | undefined;
  lastUid: number;
}

const uidValidityOf = (text: string) => text.match(/UIDVALIDITY (\d+)/i)?.[1];

export async function syncEmail(db: SupabaseClient): Promise<SyncResult> {
  const host = env("IMAP_HOST");
  const port = Number(env("IMAP_PORT", "993"));
  const user = env("IMAP_USER");
  const password = env("IMAP_PASSWORD");
  const inbox = env("IMAP_INBOX", "INBOX");
  const sentFolder = env("IMAP_SENT_FOLDER", "Sent");
  const ignoreDomains = env("EMAIL_IGNORE_DOMAINS", "sociallab.com.au").toLowerCase().split(",").map((d) => d.trim()).filter(Boolean);
  const lookback = new Date(Date.now() - 3 * 86_400_000);

  return recordRun(db, "email", async () => {
    const imap = await ImapClient.connect(host, port);
    let created = 0;
    let replies = 0;
    try {
      await imap.login(user, password);

      // 1. New enquiries
      const selected = await imap.select(inbox);
      const validity = uidValidityOf(selected.text);
      let cursor = await getState<Cursor>(db, "email.inbox", { lastUid: 0 });
      if (cursor.uidValidity && cursor.uidValidity !== validity) cursor = { lastUid: 0 };

      for (const uid of (await imap.searchSince(lookback)).filter((u) => u > cursor.lastUid).slice(0, 40)) {
        const raw = await imap.fetch(uid, "BODY.PEEK[]");
        cursor = { uidValidity: validity, lastUid: uid };
        if (!raw) continue;
        const mail = parseMessage(raw);
        const from = mail.headers.from.address ?? "";
        if (!from || ignoreDomains.some((d) => from.endsWith(`@${d}`)) || /no-?reply|mailer-daemon/.test(from)) continue;

        const sourceRef = `email:${mail.headers.messageId ?? `${validity}:${uid}`}`;
        const { data: seen } = await db.from("leads").select("id").eq("source_ref", sourceRef).maybeSingle();
        if (seen) continue;

        const body = mail.text;
        const ai = await classifyEnquiry({ from: `${mail.headers.from.name ?? ""} <${from}>`, subject: mail.headers.subject ?? undefined, body, channel: "email" });
        const { error } = await db.from("leads").insert({
          source: "email",
          source_ref: sourceRef,
          received_at: (mail.headers.date ?? new Date()).toISOString(),
          name: ai.name ?? mail.headers.from.name,
          company: ai.company,
          email: from,
          phone: ai.phone,
          channel: "Email enquiry",
          tier: ai.tier,
          subject: mail.headers.subject,
          message: body.slice(0, 8000),
          ai_summary: ai.summary,
          ai_is_lead: ai.is_lead,
          ai_reason: ai.reason,
          number_of_agents: ai.number_of_agents,
          monthly_marketing_budget: ai.monthly_marketing_budget,
          status: "pending",
        });
        if (error) throw error;
        created++;
      }
      await setState(db, "email.inbox", cursor);

      // 2. When did we first reply to each open email lead?
      const { data: waiting } = await db.from("leads")
        .select("id, email, received_at")
        .is("first_response_at", null)
        .not("email", "is", null)
        .not("status", "in", "(rejected,won,lost)")
        .gte("received_at", new Date(Date.now() - 14 * 86_400_000).toISOString());

      if (waiting?.length) {
        const sentSelected = await imap.select(sentFolder);
        const sentValidity = uidValidityOf(sentSelected.text);
        let sentCursor = await getState<Cursor>(db, "email.sent", { lastUid: 0 });
        if (sentCursor.uidValidity && sentCursor.uidValidity !== sentValidity) sentCursor = { lastUid: 0 };
        const byEmail = new Map(waiting.filter((l) => l.email).map((l) => [l.email!.toLowerCase(), l]));

        for (const uid of (await imap.searchSince(lookback)).filter((u) => u > sentCursor.lastUid).slice(0, 200)) {
          const header = await imap.fetch(uid, "BODY.PEEK[HEADER.FIELDS (TO CC DATE)]");
          sentCursor = { uidValidity: sentValidity, lastUid: uid };
          if (!header) continue;
          const text = new TextDecoder().decode(header);
          const sentAt = new Date(text.match(/^Date:\s*(.+)$/im)?.[1] ?? "");
          if (Number.isNaN(sentAt.getTime())) continue;
          for (const address of text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []) {
            const lead = byEmail.get(address.toLowerCase());
            if (lead && sentAt.toISOString() > lead.received_at) {
              await db.from("leads").update({ first_response_at: sentAt.toISOString() }).eq("id", lead.id).is("first_response_at", null);
              byEmail.delete(address.toLowerCase());
              replies++;
            }
          }
        }
        await setState(db, "email.sent", sentCursor);
      }
    } finally {
      await imap.logout();
    }
    return { items: created + replies, message: `${created} new email(s), ${replies} reply time(s) recorded` };
  });
}
