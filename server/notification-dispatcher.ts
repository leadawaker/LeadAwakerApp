/**
 * Notification Dispatcher
 *
 * Creates an in-app notification and dispatches it through configured channels:
 * - Web Push (via web-push / VAPID)
 * - Telegram (via Bot API)
 *
 * Channel delivery is based on the user's Notification_Preferences and per-type overrides.
 */

import webpush from "web-push";
import { storage } from "./storage";
import { broadcast } from "./sse";
import type { InsertNotifications, Notifications } from "../shared/schema";

// ── VAPID setup (lazy, only if env vars are present) ───────────────────────

const vapidConfigured =
  !!process.env.VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY &&
  !!process.env.VAPID_SUBJECT;

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

console.log("[notifications] VAPID configured:", vapidConfigured);

// ── Telegram config ──────────────────────────────────────────────────────
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_WEBHOOK_URL;
const telegramConfigured = !!telegramBotToken && !telegramBotToken.startsWith("http");
console.log("[notifications] Telegram configured:", telegramConfigured);

// ── Helpers ────────────────────────────────────────────────────────────────

function isChannelEnabled(
  prefs: { telegramEnabled: boolean; webPushEnabled: boolean; typeOverrides: any } | undefined,
  channel: "telegram" | "web_push",
  notificationType: string,
): boolean {
  if (!prefs) return true; // no prefs row means defaults (both enabled)

  // Check per-type override first
  const overrides = (prefs.typeOverrides ?? {}) as Record<string, Record<string, boolean>>;
  const typeOverride = overrides[notificationType];
  if (typeOverride && typeof typeOverride[channel] === "boolean") {
    return typeOverride[channel];
  }

  // Fall back to global channel toggle
  if (channel === "telegram") return prefs.telegramEnabled;
  if (channel === "web_push") return prefs.webPushEnabled;
  return true;
}

// ── Web Push ───────────────────────────────────────────────────────────────

async function sendWebPush(
  userId: number,
  accountId: number | null,
  title: string,
  body: string | null,
  link: string | null,
): Promise<void> {
  if (!vapidConfigured) return;
  if (!accountId) return; // push subscriptions require an accountId

  const subs = await storage.getPushSubscriptionsByUser(userId, accountId);
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title,
    body: body ?? "",
    link: link ?? "/",
    icon: "/icon-192.png",
  });

  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s.subscription as webpush.PushSubscription, payload)),
  );

  // Clean up expired/invalid subscriptions (410 Gone)
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected") {
      const statusCode = (r.reason as any)?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        try {
          await storage.deletePushSubscriptionByEndpoint(subs[i].endpoint);
        } catch (_) {
          // ignore cleanup errors
        }
      }
      console.error(`[notification-dispatcher] Web push failed for sub ${subs[i].id}:`, r.reason);
    }
  }
}

// ── Telegram ───────────────────────────────────────────────────────────────

async function sendTelegram(
  chatId: string,
  title: string,
  body: string | null,
): Promise<void> {
  if (!telegramBotToken || !telegramConfigured) return;

  const text = body ? `${title}\n${body}` : title;
  const telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;

  try {
    const resp = await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[notification-dispatcher] Telegram send failed (${resp.status}):`, errBody);
    } else {
      console.log(`[notification-dispatcher] Telegram sent to chatId=${chatId}`);
    }
  } catch (err) {
    console.error("[notification-dispatcher] Telegram send error:", err);
  }
}

// ── Main dispatcher ────────────────────────────────────────────────────────

/**
 * Create an in-app notification and dispatch through configured channels.
 * This is a drop-in replacement for `storage.createNotification`.
 */
export async function createAndDispatchNotification(
  data: InsertNotifications,
): Promise<Notifications> {
  // 1. Create the in-app notification
  const notif = await storage.createNotification(data);

  // 2. Emit SSE event so the frontend receives it in real-time
  if (notif.accountId) {
    broadcast(notif.accountId, "notification", notif);
  }

  // 3. Load user preferences (fire-and-forget for external channels)
  dispatchExternal(notif).catch((err) => {
    console.error("[notification-dispatcher] External dispatch error:", err);
  });

  return notif;
}

async function dispatchExternal(notif: Notifications): Promise<void> {
  const accountId = notif.accountId;
  const userId = notif.userId;

  // Load preferences (needs accountId)
  let prefs: Awaited<ReturnType<typeof storage.getNotificationPreferences>> | undefined;
  if (accountId) {
    prefs = await storage.getNotificationPreferences(userId, accountId);
  }

  const title = notif.title;
  const body = notif.body;
  const link = notif.link;
  const type = notif.type;

  // Web Push
  if (isChannelEnabled(prefs, "web_push", type)) {
    sendWebPush(userId, accountId, title, body, link).catch((err) => {
      console.error("[notification-dispatcher] Web push dispatch error:", err);
    });
  }

  // Telegram
  const telegramChatId = prefs?.telegramChatId;
  if (telegramChatId && isChannelEnabled(prefs, "telegram", type)) {
    sendTelegram(telegramChatId, title, body).catch((err) => {
      console.error("[notification-dispatcher] Telegram dispatch error:", err);
    });
  }
}
