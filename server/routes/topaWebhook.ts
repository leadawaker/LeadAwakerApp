import type { Express } from "express";
import { timingSafeEqual } from "crypto";
import { wrapAsync } from "./_helpers";

// ─── topa.io "Positive reply / Connection accepted" webhook (public) ──────
// topa.io POSTs here when a LinkedIn lead replies positively or accepts a
// connection request. We forward a short summary to the founder on Telegram.
// Payload shape is not documented, so the raw body is logged and the summary
// picks common field names, falling back to a JSON dump. The secret lives in
// the URL because topa.io only lets us set the endpoint, not headers.

const MAX_TEXT = 3500;

function pick(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function summarize(body: any): string {
  const data = body?.data && typeof body.data === "object" ? body.data : body;
  const event = pick(body, ["event", "type", "event_type", "trigger"]);
  const first = pick(data, ["first_name", "firstName"]);
  const last = pick(data, ["last_name", "lastName"]);
  const name = pick(data, ["name", "full_name", "fullName"]) || `${first} ${last}`.trim();
  const company = pick(data, ["company", "company_name", "companyName"]);
  const url = pick(data, ["linkedin_url", "linkedinUrl", "profile_url", "profileUrl", "url"]);
  const reply = pick(data, ["message", "reply", "text", "last_message"]);

  const lines = [`topa.io${event ? `: ${event}` : ""}`];
  if (name || company) lines.push([name, company].filter(Boolean).join(" @ "));
  if (url) lines.push(url);
  if (reply) lines.push(`"${reply}"`);
  if (lines.length === 1) lines.push(JSON.stringify(body ?? {}, null, 2));
  return lines.join("\n").slice(0, MAX_TEXT);
}

export function registerTopaWebhookRoutes(app: Express) {
  app.post("/api/webhooks/topa/:secret", wrapAsync(async (req, res) => {
    const expected = process.env.TOPA_WEBHOOK_SECRET;
    if (!expected || !secretMatches(String(req.params.secret), expected)) {
      return res.status(404).json({ message: "Not found" });
    }

    console.log("[topa-webhook] received:", JSON.stringify(req.body));

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID;
    if (botToken && chatId) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ chat_id: chatId, text: summarize(req.body) }),
      }).catch((err) => console.error("[topa-webhook] Telegram error:", err));
    }

    res.json({ ok: true });
  }));
}
