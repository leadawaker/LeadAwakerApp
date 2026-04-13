import type { TFunction } from "i18next";
import type { Interaction } from "../../hooks/useConversationsData";
import type { ThreadGroup, MsgMeta, SenderKey } from "./types";
import { AI_TRIGGERED_BY, _STATUS_LOWER, CONVERSION_STATUS_TAGS, THREAD_GAP_MS } from "./constants";

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getDateKey(ts: string | null | undefined, timezone?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  if (timezone) {
    return d.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD in target tz
  }
  return d.toDateString();
}

export function formatDateLabel(ts: string, t: TFunction, timezone?: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  // Use Intl to get the date parts in the target timezone
  const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
  if (timezone) opts.timeZone = timezone;
  const fmt = new Intl.DateTimeFormat("en-CA", opts); // en-CA gives YYYY-MM-DD
  const msgDateStr = fmt.format(d);
  const nowDateStr = fmt.format(new Date());
  if (msgDateStr === nowDateStr) return t("chat.dateLabels.today");
  // Check yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = fmt.format(yesterday);
  if (msgDateStr === yesterdayStr) return t("chat.dateLabels.yesterday");
  const displayOpts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  if (timezone) displayOpts.timeZone = timezone;
  return d.toLocaleDateString([], displayOpts);
}

export function formatBubbleTime(ts: string | null | undefined, timezone?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (timezone) opts.timeZone = timezone;
  return d.toLocaleTimeString([], opts);
}

// ─── AI / sender detection ────────────────────────────────────────────────────

/** Returns true if this interaction was generated/sent by the AI/automation system */
export function isAiMessage(item: Interaction): boolean {
  if ((item.ai_generated ?? item.aiGenerated) === true) return true;
  if ((item.is_bump ?? item.isBump) === true) return true;
  const triggeredBy = (item.triggered_by ?? item.triggeredBy ?? "").toLowerCase();
  if (AI_TRIGGERED_BY.has(triggeredBy)) return true;
  const who = (item.Who ?? item.who ?? "").toLowerCase();
  if (who === "ai" || who === "bot" || who === "automation") return true;
  if (/^bump\s*\d/.test(who)) return true;
  if (who === "start") return true;
  return false;
}

/** Returns true if this interaction was sent manually by a human agent */
export function isHumanAgentMessage(item: Interaction): boolean {
  if (item.direction?.toLowerCase() !== "outbound") return false;
  if (isAiMessage(item)) return false;
  return true;
}

/** Derive a readable sender label for the message */
export function getSenderLabel(item: Interaction, inbound: boolean, aiMsg: boolean, leadName: string, t: TFunction): string {
  if (inbound) return leadName || t("chat.senderLabels.lead");
  if (aiMsg) {
    const who = (item.Who ?? item.who ?? "").trim();
    const genericWho = /^(ai|bot|automation|start|bump\s*\d*)$/i;
    if (who && !genericWho.test(who)) return `${t("chat.senderLabels.ai")} ${who}`;
    if (item.ai_model ?? item.aiModel) return `${t("chat.senderLabels.ai")} ${item.ai_model ?? item.aiModel}`;
    return t("chat.senderLabels.ai");
  }
  const who = (item.Who ?? item.who ?? "").trim();
  if (who && who.toLowerCase() !== "human" && who.toLowerCase() !== "agent") return who;
  return t("chat.senderLabels.you");
}

// ─── Sender run tracking ──────────────────────────────────────────────────────

export function computeMsgMeta(msgs: Interaction[]): MsgMeta[] {
  const result: MsgMeta[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const sk: SenderKey = m.direction?.toLowerCase() !== "outbound"
      ? "inbound"
      : isAiMessage(m) ? "ai" : "human";
    const prevSk: SenderKey | "" = i > 0
      ? (msgs[i - 1].direction?.toLowerCase() !== "outbound" ? "inbound" : isAiMessage(msgs[i - 1]) ? "ai" : "human")
      : "";
    const nextSk: SenderKey | "" = i < msgs.length - 1
      ? (msgs[i + 1].direction?.toLowerCase() !== "outbound" ? "inbound" : isAiMessage(msgs[i + 1]) ? "ai" : "human")
      : "";
    result.push({
      senderKey: sk,
      isFirstInRun: sk !== prevSk,
      isLastInRun: sk !== nextSk,
    });
  }
  return result;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

/** Case-insensitive lookup: returns the canonical status name or null */
export function canonicalStatus(tagName: string): string | null {
  return CONVERSION_STATUS_TAGS.has(tagName) ? tagName : (_STATUS_LOWER.get(tagName.toLowerCase()) ?? null);
}

// ─── Thread grouping ──────────────────────────────────────────────────────────

export function groupMessagesByThread(msgs: Interaction[]): ThreadGroup[] {
  if (msgs.length === 0) return [];

  const groups: ThreadGroup[] = [];
  let currentGroup: ThreadGroup | null = null;
  let groupIndex = 0;

  function getThreadKey(m: Interaction): string | null {
    const tid = m.conversation_thread_id ?? m.conversationThreadId;
    if (tid) return `thread-${tid}`;
    if ((m.bump_number ?? m.bumpNumber) != null) return `bump-${m.bump_number ?? m.bumpNumber}`;
    if ((m.is_bump ?? m.isBump) && m.Who) return `bump-who-${m.Who.toLowerCase().replace(/\s+/g, "-")}`;
    return null;
  }

  let lastTimestamp: number | null = null;

  for (const m of msgs) {
    const key = getThreadKey(m);
    const ts = m.created_at || m.createdAt;
    const currentTimestamp = ts ? new Date(ts).getTime() : null;

    let startNew = false;

    if (!currentGroup) {
      startNew = true;
    } else if (key !== null) {
      if (key !== currentGroup.threadId) startNew = true;
    } else {
      if (
        currentTimestamp !== null &&
        lastTimestamp !== null &&
        currentTimestamp - lastTimestamp > THREAD_GAP_MS
      ) {
        startNew = true;
      }
    }

    if (startNew) {
      const tid: string = key ?? `session-${groupIndex}`;
      currentGroup = { threadId: tid, threadIndex: groupIndex++, msgs: [] };
      groups.push(currentGroup);
    }

    currentGroup!.msgs.push(m);
    if (currentTimestamp !== null) lastTimestamp = currentTimestamp;
  }

  return groups;
}

export function formatThreadLabel(group: ThreadGroup, total: number, t: TFunction): string {
  const { threadId, threadIndex } = group;
  if (threadId.startsWith("bump-who-")) {
    const who = threadId.replace("bump-who-", "").replace(/-/g, " ");
    return who.charAt(0).toUpperCase() + who.slice(1);
  }
  if (threadId.startsWith("bump-")) {
    const n = threadId.replace("bump-", "");
    return t("chat.thread.bump", { number: n });
  }
  if (threadId.startsWith("thread-")) {
    const id = threadId.replace("thread-", "");
    return id.length > 12 ? t("chat.thread.thread", { id: threadIndex + 1 }) : t("chat.thread.thread", { id });
  }
  if (total === 1) return t("chat.thread.conversation");
  return t("chat.thread.conversationNumber", { number: threadIndex + 1 });
}

// ─── Attachment helpers ───────────────────────────────────────────────────────

export function getAttachmentType(url: string): "image" | "video" | "audio" | "document" {
  // Data URLs
  if (url.startsWith("data:audio/")) return "audio";
  if (url.startsWith("data:video/")) return "video";
  if (url.startsWith("data:image/")) return "image";
  const lower = url.toLowerCase().split("?")[0];
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/.test(lower)) return "image";
  if (/\.(mp3|ogg|wav|m4a|aac|opus|flac)$/.test(lower)) return "audio";
  if (/\.(mp4|mov|avi|webm|mkv)$/.test(lower)) return "video";
  return "document";
}
