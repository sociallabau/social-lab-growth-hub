// Run with: deno test tests/
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { type ByteStream, ImapClient, imapDate, quote } from "../src/server/integrations/imap.ts";
import { extractText, parseHeaders, parseMessage } from "../src/server/integrations/mime.ts";
import { channelFromSource, keywordClassify } from "../src/server/integrations/shared.ts";
import { firstActionValue } from "../src/server/integrations/meta-ads.ts";
import { responseTimes } from "../src/server/integrations/instagram.ts";
import { verifyCalendlySignature } from "../src/server/integrations/calendly.ts";

/** Fake IMAP server: scripted replies, delivered in small chunks to exercise buffering. */
function fakeStream(greeting: string, replies: Record<string, (tag: string) => string>) {
  const enc = new TextEncoder();
  let outbox = enc.encode(greeting);
  const sent: string[] = [];
  const conn: ByteStream = {
    read(p) {
      if (!outbox.length) return Promise.resolve(null);
      const n = Math.min(7, outbox.length, p.length);
      p.set(outbox.subarray(0, n));
      outbox = outbox.slice(n);
      return Promise.resolve(n);
    },
    write(p) {
      const line = new TextDecoder().decode(p).trim();
      sent.push(line);
      const [tag, ...rest] = line.split(" ");
      const command = rest.join(" ");
      const key = Object.keys(replies).find((k) => command.startsWith(k));
      const reply = key ? replies[key](tag) : `${tag} BAD unknown\r\n`;
      const merged = new Uint8Array(outbox.length + enc.encode(reply).length);
      merged.set(outbox);
      merged.set(enc.encode(reply), outbox.length);
      outbox = merged;
      return Promise.resolve(p.length);
    },
    close() {},
  };
  return { conn, sent };
}

const RAW_EMAIL = [
  "From: Jane Smith <jane@harbourside.com.au>",
  "Subject: =?UTF-8?B?Q29udGVudCBwYWNrYWdlcw==?=",
  "Date: Wed, 16 Sep 2026 09:12:03 +1000",
  "Message-ID: <abc123@harbourside.com.au>",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Hi team, we have 12 agents and want a quote for monthly video content.=",
  "Budget is around $4,000 =E2=80=93 can you help?",
  "",
].join("\r\n");

Deno.test("IMAP: login, search and fetch with literals", async () => {
  const bytes = new TextEncoder().encode(RAW_EMAIL).length;
  const { conn, sent } = fakeStream("* OK IMAP ready\r\n", {
    "LOGIN": (t) => `${t} OK logged in\r\n`,
    "EXAMINE": (t) => `* 3 EXISTS\r\n* OK [UIDVALIDITY 777] ok\r\n${t} OK [READ-ONLY] done\r\n`,
    "UID SEARCH": (t) => `* SEARCH 41 42\r\n${t} OK search done\r\n`,
    "UID FETCH 42": (t) => `* 2 FETCH (UID 42 BODY[] {${bytes}}\r\n${RAW_EMAIL})\r\n${t} OK fetch done\r\n`,
    "LOGOUT": (t) => `* BYE\r\n${t} OK bye\r\n`,
  });
  const imap = await ImapClient.fromStream(conn);
  await imap.login("enquiries@sociallab.com.au", 'pa"ss');
  assertEquals(sent[0], 'A1 LOGIN "enquiries@sociallab.com.au" "pa\\"ss"');
  const selected = await imap.select("INBOX");
  assertEquals(selected.text.match(/UIDVALIDITY (\d+)/)?.[1], "777");
  assertEquals(await imap.searchSince(new Date("2026-09-14T00:00:00Z")), [41, 42]);
  assertEquals(sent[2], "A3 UID SEARCH SINCE 14-Sep-2026");
  const raw = await imap.fetch(42, "BODY.PEEK[]");
  assertEquals(new TextDecoder().decode(raw!), RAW_EMAIL);
  await imap.logout();
});

Deno.test("IMAP: server errors surface", async () => {
  const { conn } = fakeStream("* OK ready\r\n", { "LOGIN": (t) => `${t} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n` });
  const imap = await ImapClient.fromStream(conn);
  let message = "";
  try {
    await imap.login("x", "y");
  } catch (e) {
    message = (e as Error).message;
  }
  assertEquals(message, "IMAP LOGIN failed: NO [AUTHENTICATIONFAILED] Invalid credentials");
});

Deno.test("email parsing: encoded subject, quoted-printable body", () => {
  const mail = parseMessage(new TextEncoder().encode(RAW_EMAIL));
  assertEquals(mail.headers.from.address, "jane@harbourside.com.au");
  assertEquals(mail.headers.from.name, "Jane Smith");
  assertEquals(mail.headers.subject, "Content packages");
  assertEquals(mail.headers.messageId, "abc123@harbourside.com.au");
  assertEquals(mail.headers.date?.toISOString(), "2026-09-15T23:12:03.000Z");
  assertStringIncludes(mail.text, "12 agents and want a quote for monthly video content.");
  assertStringIncludes(mail.text, "$4,000 – can you help?"); // =E2=80=93 decoded to an en dash
});

Deno.test("email parsing: multipart prefers text/plain, falls back to stripped HTML", () => {
  const multipart = [
    "Content-Type: multipart/alternative; boundary=\"XYZ\"",
    "",
    "--XYZ",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Plain version of the enquiry",
    "--XYZ",
    "Content-Type: text/html; charset=utf-8",
    "",
    "<p>HTML version</p>",
    "--XYZ--",
  ].join("\r\n");
  const headers = parseHeaders(multipart);
  const body = multipart.slice(multipart.search(/\r?\n\r?\n/)).replace(/^(\r?\n){1,2}/, "");
  assertEquals(extractText(body, headers), "Plain version of the enquiry");

  const htmlOnly = [
    "Content-Type: multipart/alternative; boundary=\"XYZ\"",
    "",
    "--XYZ",
    "Content-Type: text/html; charset=utf-8",
    "",
    "<div>Hi <b>team</b>, what are your prices?</div>",
    "--XYZ--",
  ].join("\r\n");
  const h2 = parseHeaders(htmlOnly);
  const b2 = htmlOnly.slice(htmlOnly.search(/\r?\n\r?\n/)).replace(/^(\r?\n){1,2}/, "");
  assertStringIncludes(extractText(b2, h2), "Hi  team , what are your prices?");
});

Deno.test("email parsing: base64 body", () => {
  const raw = [
    "From: bob@example.com",
    "Subject: Quote",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa("Can we get pricing for podcast production?"),
    "",
  ].join("\r\n");
  assertEquals(parseMessage(new TextEncoder().encode(raw)).text, "Can we get pricing for podcast production?");
});

Deno.test("Meta: takes the first matching action type, never the sum", () => {
  const actions = [
    { action_type: "lead", value: "4" },
    { action_type: "onsite_conversion.lead_grouped", value: "4" },
    { action_type: "schedule_total", value: "2" },
  ];
  assertEquals(firstActionValue(actions, ["lead", "onsite_conversion.lead_grouped"]), 4);
  assertEquals(firstActionValue(actions, ["schedule_total", "schedule_website"]), 2);
  assertEquals(firstActionValue(actions, ["nothing_here"]), 0);
  assertEquals(firstActionValue(undefined, ["lead"]), 0);
});

Deno.test("Instagram: first inbound message and our first reply", () => {
  const us = "ig_social_lab";
  const messages = [
    { id: "3", created_time: "2026-09-16T09:40:00+0000", message: "Sure, here are our packages", from: { id: us } },
    { id: "2", created_time: "2026-09-16T09:05:00+0000", message: "for our agency", from: { id: "them", username: "harbourside_re" } },
    { id: "1", created_time: "2026-09-16T09:00:00+0000", message: "Hey, how much for reels?", from: { id: "them", username: "harbourside_re" } },
  ];
  const { firstIn, firstReply, inbound } = responseTimes(messages, us);
  assertEquals(firstIn?.id, "1");
  assertEquals(firstReply?.id, "3");
  assertEquals(inbound.length, 2);
  assertEquals(responseTimes([messages[0]], us).firstIn, undefined); // only our own message
});

Deno.test("Calendly: signature must match and be recent", async () => {
  const key = "signing-key";
  const body = JSON.stringify({ event: "invitee.created" });
  const t = Math.floor(Date.now() / 1000);
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${t}.${body}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");

  await verifyCalendlySignature(`t=${t},v1=${hex}`, body, key); // valid: does not throw

  let unconfigured = "";
  try {
    await verifyCalendlySignature(`t=${t},v1=${hex}`, body, "");
  } catch (e) {
    unconfigured = (e as Error).message;
  }
  assertEquals(unconfigured, "Calendly signing key is not configured");

  for (const [header, expected] of [
    [`t=${t},v1=deadbeef`, "Bad Calendly signature"],
    [`t=${t - 600},v1=${hex}`, "Stale Calendly signature"],
    [null, "Missing Calendly signature"],
  ] as const) {
    let message = "";
    try {
      await verifyCalendlySignature(header, body, key);
    } catch (e) {
      message = (e as Error).message;
    }
    assertEquals(message, expected);
  }
});

Deno.test("helpers", () => {
  assertEquals(quote("a\\b"), '"a\\\\b"');
  assertEquals(imapDate(new Date("2026-01-05T10:00:00Z")), "5-Jan-2026");
  assertEquals(channelFromSource("facebook", "paid"), "Meta Ads");
  assertEquals(channelFromSource("instagram", "social"), "Instagram (organic)");
  assertEquals(channelFromSource("google", "cpc"), "Google Ads");
  assertEquals(channelFromSource(null, null), null);
  assertEquals(keywordClassify("Hi, keen to get a quote for video content for our agency").is_lead, true);
  assertEquals(keywordClassify("We offer SEO services and backlinks for your site").is_lead, false);
});
