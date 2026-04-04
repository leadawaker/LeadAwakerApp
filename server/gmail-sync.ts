import { gmail_v1 } from "googleapis";
import { storage } from "./storage";
import { getGmailClient, encryptTokens } from "./gmail";
import { broadcast } from "./sse";
import type { InsertInteractions } from "@shared/schema";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const INITIAL_SYNC_DAYS = 30;
const ACCOUNT_EMAIL = "leadawaker@gmail.com";
const SEND_AS = ["gabriel@leadawaker.com", "leadawaker@gmail.com"];

let syncTimer: ReturnType<typeof setInterval> | null = null;

// ─── Email Parsing ──────────────────────────────────────────────────────────

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

function isOutbound(from: string): boolean {
  const addr = extractEmailAddress(from);
  return SEND_AS.some((a) => addr === a.toLowerCase());
}

function extractBody(payload: gmail_v1.Schema$MessagePart): { html: string; text: string } {
  let html = "";
  let text = "";

  if (payload.mimeType === "text/html" && payload.body?.data) {
    html = Buffer.from(payload.body.data, "base64url").toString("utf8");
  } else if (payload.mimeType === "text/plain" && payload.body?.data) {
    text = Buffer.from(payload.body.data, "base64url").toString("utf8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const sub = extractBody(part);
      if (!html && sub.html) html = sub.html;
      if (!text && sub.text) text = sub.text;
    }
  }

  return { html, text };
}

function countAttachments(payload: gmail_v1.Schema$MessagePart): number {
  let count = 0;
  if (payload.filename && payload.body?.attachmentId) count++;
  if (payload.parts) {
    for (const part of payload.parts) count += countAttachments(part);
  }
  return count;
}

interface ParsedEmail {
  messageId: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  toEmail: string;
  cc: string;
  subject: string;
  date: Date;
  snippet: string;
  labels: string[];
  body: string;
  bodyHtml: string;
  direction: "inbound" | "outbound";
  attachmentCount: number;
  inReplyTo: string;
  references: string;
}

function parseGmailMessage(msg: gmail_v1.Schema$Message): ParsedEmail {
  const headers = msg.payload?.headers || [];
  const from = getHeader(headers, "From");
  const to = getHeader(headers, "To");
  const { html, text } = extractBody(msg.payload!);

  return {
    messageId: msg.id || "",
    threadId: msg.threadId || "",
    from,
    fromEmail: extractEmailAddress(from),
    to,
    toEmail: extractEmailAddress(to),
    cc: getHeader(headers, "Cc"),
    subject: getHeader(headers, "Subject"),
    date: new Date(parseInt(msg.internalDate || "0")),
    snippet: msg.snippet || "",
    labels: msg.labelIds || [],
    body: text,
    bodyHtml: html,
    direction: isOutbound(from) ? "outbound" : "inbound",
    attachmentCount: countAttachments(msg.payload!),
    inReplyTo: getHeader(headers, "In-Reply-To"),
    references: getHeader(headers, "References"),
  };
}

// ─── Prospect Matching ──────────────────────────────────────────────────────

async function matchProspectByEmail(email: string): Promise<number | null> {
  if (!email) return null;
  const lc = email.toLowerCase();

  // Query all prospects and match by any email field (case-insensitive)
  const result = await import("./db").then((m) => m.pool.query(
    `SELECT id FROM p2mxx34fvbf3ll6."Prospects"
     WHERE LOWER(email) = $1
        OR LOWER(contact_email) = $1
        OR LOWER(contact2_email) = $1
     LIMIT 1`,
    [lc]
  ));

  return result.rows[0]?.id ?? null;
}

// ─── Deduplication ──────────────────────────────────────────────────────────

async function isAlreadySynced(gmailMessageId: string): Promise<boolean> {
  const { pool } = await import("./db");
  const result = await pool.query(
    `SELECT 1 FROM p2mxx34fvbf3ll6."Interactions"
     WHERE metadata->>'gmailMessageId' = $1
     LIMIT 1`,
    [gmailMessageId]
  );
  return result.rows.length > 0;
}

// ─── Create Interaction from Email ──────────────────────────────────────────

async function createEmailInteraction(parsed: ParsedEmail, prospectId: number): Promise<void> {
  const data: InsertInteractions = {
    type: "email",
    direction: parsed.direction,
    content: parsed.bodyHtml || parsed.body,
    who: parsed.direction === "outbound" ? parsed.toEmail : parsed.fromEmail,
    prospectId,
    status: parsed.direction === "outbound" ? "delivered" : "received",
    sentAt: parsed.date,
    conversationThreadId: parsed.threadId,
    isRead: parsed.direction === "inbound" ? false : true,
    metadata: {
      gmailMessageId: parsed.messageId,
      gmailThreadId: parsed.threadId,
      subject: parsed.subject,
      from: parsed.from,
      to: parsed.to,
      cc: parsed.cc,
      snippet: parsed.snippet,
      labels: parsed.labels,
      attachmentCount: parsed.attachmentCount,
      fromEmail: parsed.fromEmail,
      toEmail: parsed.toEmail,
    } as any,
  };

  const interaction = await storage.createInteraction(data);

  // Broadcast via SSE (use accountsId 1 for agency-level)
  broadcast(1, "new_interaction", interaction);

  console.log(
    `[Gmail Sync] ${parsed.direction} email: "${parsed.subject}" (${parsed.fromEmail} → ${parsed.toEmail}) → prospect #${prospectId}`
  );
}

// ─── Sync Logic ─────────────────────────────────────────────────────────────

async function processMessage(gmail: gmail_v1.Gmail, messageId: string): Promise<void> {
  // Dedup check first
  if (await isAlreadySynced(messageId)) return;

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const parsed = parseGmailMessage(msg.data);

  // Skip drafts — only log actually sent/received messages
  if (parsed.labels.includes("DRAFT")) return;

  // Match: for outbound, match by recipient; for inbound, match by sender
  const matchEmail = parsed.direction === "outbound" ? parsed.toEmail : parsed.fromEmail;
  const prospectId = await matchProspectByEmail(matchEmail);

  if (!prospectId) return; // No matching prospect, skip

  await createEmailInteraction(parsed, prospectId);
}

async function initialSync(gmail: gmail_v1.Gmail): Promise<string | undefined> {
  const after = Math.floor(Date.now() / 1000) - INITIAL_SYNC_DAYS * 86400;
  console.log(`[Gmail Sync] Initial sync: fetching emails from last ${INITIAL_SYNC_DAYS} days...`);

  let pageToken: string | undefined;
  let total = 0;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: `after:${after}`,
      maxResults: 100,
      pageToken,
    });

    const messages = res.data.messages || [];
    for (const m of messages) {
      try {
        await processMessage(gmail, m.id!);
        total++;
      } catch (err: any) {
        console.error(`[Gmail Sync] Error processing message ${m.id}:`, err.message);
      }
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  console.log(`[Gmail Sync] Initial sync complete: processed ${total} messages`);

  // Get current historyId for incremental sync
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.historyId || undefined;
}

async function incrementalSync(gmail: gmail_v1.Gmail, startHistoryId: string): Promise<string | undefined> {
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;
  let processed = 0;

  try {
    do {
      const res = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        pageToken,
      });

      latestHistoryId = res.data.historyId || latestHistoryId;
      const history = res.data.history || [];

      for (const record of history) {
        const added = record.messagesAdded || [];
        for (const item of added) {
          if (!item.message?.id) continue;
          try {
            await processMessage(gmail, item.message.id);
            processed++;
          } catch (err: any) {
            console.error(`[Gmail Sync] Error processing message ${item.message.id}:`, err.message);
          }
        }
      }

      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  } catch (err: any) {
    // historyId expired (404): fall back to initial sync
    if (err.code === 404 || err.status === 404) {
      console.warn("[Gmail Sync] History expired, falling back to initial sync");
      return initialSync(gmail);
    }
    throw err;
  }

  if (processed > 0) {
    console.log(`[Gmail Sync] Incremental sync: processed ${processed} new messages`);
  }

  return latestHistoryId;
}

// ─── Main Sync Function ─────────────────────────────────────────────────────

export async function syncEmails(): Promise<void> {
  const syncState = await storage.getGmailSyncState(ACCOUNT_EMAIL);
  if (!syncState?.oauthTokensEncrypted) {
    return; // Not connected
  }

  const { gmail, getUpdatedTokens } = await getGmailClient(syncState.oauthTokensEncrypted);

  let newHistoryId: string | undefined;

  if (syncState.lastHistoryId) {
    newHistoryId = await incrementalSync(gmail, syncState.lastHistoryId);
  } else {
    newHistoryId = await initialSync(gmail);
  }

  // Persist sync cursor and any refreshed tokens
  const updatedTokens = getUpdatedTokens();
  await storage.upsertGmailSyncState({
    accountEmail: ACCOUNT_EMAIL,
    lastHistoryId: newHistoryId || syncState.lastHistoryId || "",
    lastFullSyncAt: !syncState.lastHistoryId ? new Date() : syncState.lastFullSyncAt,
    oauthTokensEncrypted: encryptTokens(updatedTokens),
  });
}

// ─── Polling ────────────────────────────────────────────────────────────────

export function startGmailSync(): void {
  // Run immediately on startup
  syncEmails().catch((err) =>
    console.error("[Gmail Sync] Startup sync error:", err.message)
  );

  // Then every 5 minutes
  syncTimer = setInterval(() => {
    syncEmails().catch((err) =>
      console.error("[Gmail Sync] Periodic sync error:", err.message)
    );
  }, SYNC_INTERVAL_MS);

  console.log(`[Gmail Sync] Polling started (every ${SYNC_INTERVAL_MS / 1000}s)`);
}

export function stopGmailSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log("[Gmail Sync] Polling stopped");
  }
}
