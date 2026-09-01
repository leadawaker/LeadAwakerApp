/**
 * Tells Gabriel when a prospect actually replies to a demo.
 *
 * The open itself is deliberately NOT notified: most links get opened and
 * abandoned, and a ping for every one of those trains you to ignore the ping.
 * The first reply is the moment a prospect is genuinely engaging, and that is
 * worth interrupting for. Opens are still visible on the Demos page, where you
 * go looking rather than being told.
 *
 * A poller rather than a hook on the message route, for two reasons: it covers
 * BOTH surfaces with one code path (browser replies come through the Express
 * proxy, but WhatsApp demo replies go straight to the Python engine and Express
 * never sees them), and it keeps the request path free of extra work. Sixty
 * seconds late is immaterial for something you will answer in minutes.
 *
 * Delivery, preferences and channels are entirely the dispatcher's job: adding
 * "demo_replied" to NOTIF_TYPE_KEYS is what puts the Telegram/email/push
 * checkboxes on the Settings page.
 */

import { db } from "./db";
import { leads, interactions, notifications } from "@shared/schema";
import { and, eq, gte, inArray, like, or, min } from "drizzle-orm";
import { storage } from "./storage";
import { createAndDispatchNotification } from "./notification-dispatcher";

const NOTIFICATION_TYPE = "demo_replied";
const POLL_MS = 60 * 1000;

/**
 * How far back each pass looks. Comfortably wider than the poll interval so a
 * restart cannot drop a reply that landed while the process was down, and the
 * duplicate that overlap would otherwise cause is prevented by the
 * already-notified check against the Notifications table rather than by an
 * in-memory set, which a restart would forget.
 */
const WINDOW_MS = 15 * 60 * 1000;

function isDemoChannel(identifier: string | null | undefined): boolean {
  const s = String(identifier || "");
  return s.startsWith("web-demo:") || s.startsWith("wa-demo:");
}

function surfaceOf(identifier: string | null | undefined): "browser" | "WhatsApp" {
  return String(identifier || "").startsWith("web-demo:") ? "browser" : "WhatsApp";
}

async function checkDemoReplies(): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);

  // Driven from interactions, not from leads: the set of demo leads only grows,
  // while the set of leads that said something in the last quarter of an hour
  // is nearly always empty.
  const recent = await db
    .selectDistinct({ leadsId: interactions.leadsId })
    .from(interactions)
    .where(and(eq(interactions.direction, "inbound"), gte(interactions.createdAt, since)));

  const leadIds = recent.map((r) => r.leadsId).filter((id): id is number => typeof id === "number");
  if (!leadIds.length) return;

  const candidates = (await db.select().from(leads).where(inArray(leads.id, leadIds))).filter((l) =>
    isDemoChannel(l.channelIdentifier),
  );
  if (!candidates.length) return;

  const candidateIds = candidates.map((l) => l.id as number);

  // The FIRST inbound per lead, which is what decides "they just started
  // replying". Counting messages instead would miss anyone who sent two in the
  // same minute, since by the time a pass ran the count would no longer be one.
  const firsts = await db
    .select({ leadsId: interactions.leadsId, first: min(interactions.createdAt) })
    .from(interactions)
    .where(and(inArray(interactions.leadsId, candidateIds), eq(interactions.direction, "inbound")))
    .groupBy(interactions.leadsId);
  const firstByLead = new Map<number, Date | null>();
  for (const f of firsts) firstByLead.set(f.leadsId as number, (f.first as Date) ?? null);

  // Already told, possibly by a previous process. Persistent dedup is what
  // lets the window overlap the interval safely. Keyed by (lead, user), not
  // just lead: createAndDispatchNotification fans out per agency user inside
  // an un-guarded loop below, so a transient DB error partway through that
  // loop must not make a lead look "already notified" for a user who never
  // actually got a row written.
  const alreadyNotified = new Set(
    (
      await db
        .select({ leadId: notifications.leadId, userId: notifications.userId })
        .from(notifications)
        .where(and(eq(notifications.type, NOTIFICATION_TYPE), inArray(notifications.leadId, candidateIds)))
    )
      .filter((n): n is { leadId: number; userId: number } => typeof n.leadId === "number" && typeof n.userId === "number")
      .map((n) => `${n.leadId}:${n.userId}`),
  );

  const fresh = candidates.filter((l) => {
    const first = firstByLead.get(l.id as number);
    return !!first && first.getTime() >= since.getTime();
  });
  if (!fresh.length) return;

  // Same recipients the booking reminder uses: the agency account's users.
  const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
  if (!agencyUsers.length) return;

  for (const lead of fresh) {
    const pending = agencyUsers.filter((u: any) => !alreadyNotified.has(`${lead.id}:${u.id}`));
    if (!pending.length) continue;

    const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "A demo lead";
    const surface = surfaceOf(lead.channelIdentifier);

    // Their actual words, because "someone replied" makes you go and look while
    // "is this available in oak?" tells you whether to drop what you are doing.
    const [firstReply] = await db
      .select({ content: interactions.content })
      .from(interactions)
      .where(and(eq(interactions.leadsId, lead.id as number), eq(interactions.direction, "inbound")))
      .orderBy(interactions.createdAt)
      .limit(1);
    const said = String(firstReply?.content || "").replace(/^\[Voice Note\]:\s*/, "").trim();
    const snippet = said.length > 140 ? `${said.slice(0, 137)}…` : said;

    for (const user of pending) {
      try {
        await createAndDispatchNotification({
          type: NOTIFICATION_TYPE,
          title: `${name} replied to your demo`,
          body: snippet ? `“${snippet}” (${surface})` : `They answered on ${surface}.`,
          userId: user.id!,
          accountId: lead.accountsId ?? null,
          read: false,
          link: "/platform/demos",
          leadId: lead.id,
        });
      } catch (err) {
        // One user's failure must not stop the rest of this loop (the next
        // user would otherwise never be tried) and must not bubble up past
        // this pass: the caller's top-level .catch would just log it, having
        // already skipped every user still left in `pending`.
        console.error("[DemoReplyNotifier] failed to notify user", user.id, "for lead", lead.id, err);
      }
    }
  }
}

export function startDemoReplyNotifier(): void {
  const run = () => {
    checkDemoReplies().catch((err) => console.error("[DemoReplyNotifier]", err));
  };
  // Not on startup: a restart would re-scan the whole window and, on the very
  // first deploy, announce replies that arrived before the feature existed.
  setInterval(run, POLL_MS);
  console.log("[DemoReplyNotifier] started (every 60s)");
}
