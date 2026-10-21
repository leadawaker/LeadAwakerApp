/**
 * Meta's Instagram webhook for comment-to-DM: /api/social/instagram/webhook.
 * GET: the subscription handshake (hub.mode, hub.verify_token from env INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
 * hub.challenge). POST: X-Hub-Signature-256 is an HMAC-SHA256 of the raw body with the app secret
 * (same style as signedRequest.ts); a bad or missing signature is refused. A good delivery gets 200
 * at once and is processed afterwards, one delivery at a time (dmEngine.ts).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request } from "express";

export const WEBHOOK_PATH = "/api/social/instagram/webhook";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** "sha256=<hex>" over the exact bytes Meta sent. */
export function verifyHubSignature(rawBody: Buffer | undefined | null, header: string | undefined, appSecret: string): boolean {
  if (!rawBody || !header || !appSecret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(header.slice("sha256=".length).toLowerCase(), expected);
}

export interface WebhookDeps {
  verifyToken(): string | undefined;
  appSecret(): string | undefined;
  /** Processes one verified delivery. Runs after the 200 was sent. */
  process(body: unknown): Promise<void>;
}

export function registerInstagramWebhook(app: Express, deps: WebhookDeps): { idle(): Promise<void> } {
  // One delivery at a time: the hourly cap and the "first reply" check see each other's writes.
  let queue: Promise<void> = Promise.resolve();

  app.get(WEBHOOK_PATH, (req, res) => {
    const token = deps.verifyToken();
    const mode = req.query["hub.mode"];
    const given = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (!token || mode !== "subscribe" || typeof given !== "string" || !safeEqual(given, token) || typeof challenge !== "string") {
      return res.sendStatus(403);
    }
    res.type("text/plain").send(challenge);
  });

  app.post(WEBHOOK_PATH, (req: Request, res) => {
    const secret = deps.appSecret();
    if (!secret) {
      console.error("[social-webhook] INSTAGRAM_APP_SECRET is not set: delivery refused");
      return res.sendStatus(503);
    }
    const raw = (req as Request & { rawBody?: unknown }).rawBody;
    const header = req.headers["x-hub-signature-256"];
    if (!verifyHubSignature(Buffer.isBuffer(raw) ? raw : null, typeof header === "string" ? header : undefined, secret)) {
      return res.sendStatus(401);
    }
    res.sendStatus(200);
    const body = req.body;
    queue = queue.then(() => deps.process(body)).catch((err) => console.error(`[social-webhook] processing failed: ${err?.message ?? err}`));
  });

  return { idle: () => queue };
}
