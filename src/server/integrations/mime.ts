// Just enough MIME parsing to read an enquiry: who sent it, when, the subject,
// and a plain-text version of the body for triage and display.

export interface MailHeaders {
  from: { name: string | null; address: string | null };
  subject: string | null;
  date: Date | null;
  messageId: string | null;
  contentType: string | null;
  encoding: string | null;
}

/** Joins folded header lines ("\r\n " continuations) and reads one header. */
export function headerValue(raw: string, name: string): string | null {
  const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
  const match = unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  return match ? match[1]!.trim() : null;
}

export function parseHeaders(raw: string): MailHeaders {
  const fromRaw = headerValue(raw, "From") ?? "";
  const address = fromRaw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  let name: string | null = fromRaw.replace(/<[^>]*>/, "").replace(/"/g, "").trim() || null;
  if (name && address && name.toLowerCase() === address.toLowerCase()) name = null;
  const dateRaw = headerValue(raw, "Date");
  const date = dateRaw ? new Date(dateRaw) : null;
  return {
    from: { name: name ? decodeWords(name) : null, address: address?.toLowerCase() ?? null },
    subject: decodeWords(headerValue(raw, "Subject") ?? "") || null,
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    messageId: headerValue(raw, "Message-ID")?.replace(/[<>]/g, "") ?? null,
    contentType: headerValue(raw, "Content-Type"),
    encoding: headerValue(raw, "Content-Transfer-Encoding")?.toLowerCase() ?? null,
  };
}

/** RFC 2047 encoded words, e.g. =?UTF-8?B?...?= in subjects. */
export function decodeWords(input: string): string {
  return input.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_m, charset: string, kind: string, text: string) => {
    try {
      const bytes = kind.toLowerCase() === "b"
        ? base64ToBytes(text)
        : decodeQuotedPrintable(text.replace(/_/g, " "), true);
      return new TextDecoder(charset.toLowerCase().replace("windows-", "windows-")).decode(bytes);
    } catch {
      return text;
    }
  }).trim();
}

export function decodeQuotedPrintable(input: string, asBytes = false): Uint8Array {
  const text = input.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "=" && /^[0-9a-f]{2}$/i.test(text.slice(i + 1, i + 3))) {
      out.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(text.charCodeAt(i));
    }
  }
  void asBytes;
  return new Uint8Array(out);
}

export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, "");
  const binary = atob(clean);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function decodePart(body: string, encoding: string | null, charset: string): string {
  try {
    if (encoding === "base64") return new TextDecoder(charset).decode(base64ToBytes(body));
    if (encoding === "quoted-printable") return new TextDecoder(charset).decode(decodeQuotedPrintable(body));
  } catch {
    // fall through to the raw text
  }
  return body;
}

const charsetOf = (contentType: string | null) =>
  (contentType?.match(/charset="?([\w-]+)"?/i)?.[1] ?? "utf-8").toLowerCase();

const stripHtml = (html: string) =>
  html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');

/**
 * Plain text for a message body. Handles single-part messages and multipart ones
 * (preferring text/plain over text/html), including one level of nesting.
 */
export function extractText(body: string, headers: Pick<MailHeaders, "contentType" | "encoding">): string {
  const boundary = headers.contentType?.match(/boundary="?([^";\s]+)"?/i)?.[1];
  if (!boundary) {
    const text = decodePart(body, headers.encoding, charsetOf(headers.contentType));
    return tidy(/html/i.test(headers.contentType ?? "") ? stripHtml(text) : text);
  }

  const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?\\r?\\n?`));
  const parsed = parts.slice(1).map((part) => {
    const split = part.indexOf("\r\n\r\n") >= 0 ? part.indexOf("\r\n\r\n") : part.indexOf("\n\n");
    if (split < 0) return null;
    const rawHeaders = part.slice(0, split);
    const partBody = part.slice(split).replace(/^(\r?\n){1,2}/, "");
    const partHeaders = {
      contentType: headerValue(rawHeaders, "Content-Type"),
      encoding: headerValue(rawHeaders, "Content-Transfer-Encoding")?.toLowerCase() ?? null,
    };
    return { headers: partHeaders, body: partBody };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  for (const part of parsed) {
    if (/multipart\//i.test(part.headers.contentType ?? "")) {
      const nested = extractText(part.body, part.headers);
      if (nested) return nested;
    }
  }
  const plain = parsed.find((p) => /text\/plain/i.test(p.headers.contentType ?? ""));
  const html = parsed.find((p) => /text\/html/i.test(p.headers.contentType ?? ""));
  const chosen = plain ?? html;
  if (!chosen) return "";
  const text = decodePart(chosen.body, chosen.headers.encoding, charsetOf(chosen.headers.contentType));
  return tidy(chosen === html ? stripHtml(text) : text);
}

const tidy = (s: string) => s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** Splits a raw RFC822 message into its headers and body. */
export function parseMessage(raw: Uint8Array): { headers: MailHeaders; text: string } {
  const full = new TextDecoder("utf-8").decode(raw);
  const split = full.search(/\r?\n\r?\n/);
  const rawHeaders = split < 0 ? full : full.slice(0, split);
  const body = split < 0 ? "" : full.slice(split).replace(/^(\r?\n){1,2}/, "");
  const headers = parseHeaders(rawHeaders);
  return { headers, text: extractText(body, headers) };
}
