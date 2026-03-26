// Score insight utilities extracted from LeadsCardView.tsx

import type { ScoreInsight } from "./types";
import { CARD_FUNNEL_HINTS } from "./constants";
import { getStatus } from "./leadUtils";

// ── Score insights builder ─────────────────────────────────────────────────────
export function buildInsights(lead: Record<string, any>, score: number, t?: (key: string) => string): { text: string; value: string }[] {
  const out: { text: string; value: string }[] = [];
  const _t = (key: string, fallback: string) => t ? t(key) : fallback;

  const status = getStatus(lead);
  if (status) out.push({ text: _t("score.insights.pipelineStageIs", "Pipeline stage is"), value: status });

  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.created_at;
  if (lastActivity) {
    try {
      const days = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000);
      const label = days === 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? "this week" : days < 30 ? "this month" : "over a month ago";
      out.push({ text: _t("score.insights.lastInteractionWas", "Last interaction was"), value: label });
    } catch {}
  }

  const source = lead.source || lead.Source;
  if (source) out.push({ text: _t("score.insights.leadSourceIs", "Lead source is"), value: source });

  const campaign = lead.Campaign || lead.campaign || lead.campaign_name;
  if (campaign && campaign !== "—") out.push({ text: _t("score.insights.activeCampaignIs", "Active campaign is"), value: campaign });

  const bump = lead.bump_stage;
  if (bump !== undefined && bump !== null && Number(bump) > 0) {
    out.push({ text: _t("score.insights.bumpSequenceAtStage", "Bump sequence at stage"), value: String(bump) });
  }

  if (out.length < 3) {
    const potential = score >= 70
      ? _t("score.insights.highPotential", "high potential")
      : score >= 40
        ? _t("score.insights.moderate", "moderate")
        : _t("score.insights.needsNurturing", "needs nurturing");
    out.push({ text: _t("score.insights.leadPotentialIs", "Lead potential is"), value: potential });
  }

  return out.slice(0, 4);
}

// ── Score insights — scripted rules tied to the real scoring formula ──────────
// Formula: Lead Score = 40% Funnel + 30% Engagement + 30% Activity
export function buildScoreInsights(lead: Record<string, any>, t?: (key: string) => string): ScoreInsight[] {
  const out: ScoreInsight[] = [];

  const status = (lead.conversion_status || lead.Conversion_Status || "").toString();
  const sentimentRaw = (lead.ai_sentiment || lead.aiSentiment || "").toString().toLowerCase();
  const received = Number(lead.message_count_received ?? lead.messageCountReceived ?? 0);
  const sent = Number(lead.message_count_sent ?? lead.messageCountSent ?? 0);
  const bumps = Number(lead.current_bump_stage ?? lead.currentBumpStage ?? 0);
  const optedOut = !!(lead.opted_out ?? lead.optedOut);
  const bookingConfirmed = !!(lead.booking_confirmed_at_ || lead.bookingConfirmedAt);

  const now = Date.now();
  const lastReceivedAt = lead.last_message_received_at || lead.lastMessageReceivedAt;
  const lastReceivedMs = lastReceivedAt ? new Date(lastReceivedAt).getTime() : null;
  const lastReceivedDays = lastReceivedMs !== null ? (now - lastReceivedMs) / 86_400_000 : null;

  const _t = (key: string, fallback: string) => t ? t(key) : fallback;

  // ── Funnel column ─────────────────────────────────────────────────────────
  if (bookingConfirmed || status === "Booked") {
    out.push({ direction: "up", label: _t("score.insights.callBooked", "Call successfully booked"), column: "funnel" });
  } else if (status === "Qualified") {
    out.push({ direction: "up", label: _t("score.insights.leadQualified", "Lead is qualified"), column: "funnel" });
  } else if (status === "Multiple Responses") {
    out.push({ direction: "up", label: _t("score.insights.multipleResponses", "Multiple responses received"), column: "funnel" });
  } else if (status === "Responded") {
    out.push({ direction: "up", label: _t("score.insights.leadResponded", "Lead has responded"), column: "funnel" });
  }
  if (optedOut) {
    out.push({ direction: "down", label: _t("score.insights.leadOptedOut", "Lead opted out"), column: "funnel" });
  } else if (status === "DND") {
    out.push({ direction: "down", label: _t("score.insights.dndStatus", "Do-not-disturb status"), column: "funnel" });
  } else if (status === "Lost") {
    out.push({ direction: "down", label: _t("score.insights.leadLost", "Lead marked as lost"), column: "funnel" });
  }

  // ── Engagement column ─────────────────────────────────────────────────────
  if (sentimentRaw === "positive") {
    out.push({ direction: "up", label: _t("score.insights.positiveSentiment", "Positive sentiment detected"), column: "engagement" });
  } else if (sentimentRaw === "negative") {
    out.push({ direction: "down", label: _t("score.insights.negativeSentiment", "Negative sentiment detected"), column: "engagement" });
  } else if (sentimentRaw === "neutral") {
    out.push({ direction: "down", label: _t("score.insights.neutralSentiment", "Neutral sentiment detected"), column: "engagement" });
  }
  if (lastReceivedDays !== null) {
    if (lastReceivedDays < 1) {
      out.push({ direction: "up", label: _t("score.insights.repliedLast24h", "Replied in last 24h"), column: "engagement" });
    } else if (lastReceivedDays < 2) {
      out.push({ direction: "up", label: _t("score.insights.repliedWithin48h", "Replied within 48h"), column: "engagement" });
    } else if (lastReceivedDays < 7) {
      out.push({ direction: "up", label: _t("score.insights.repliedThisWeek", "Replied this week"), column: "engagement" });
    } else if (lastReceivedDays > 30) {
      out.push({ direction: "down", label: _t("score.insights.noReply30Days", "No reply in 30+ days"), column: "engagement" });
    } else if (lastReceivedDays > 14) {
      out.push({ direction: "down", label: _t("score.insights.quiet2Weeks", "Quiet for 2+ weeks"), column: "engagement" });
    }
  }

  // ── Activity column ───────────────────────────────────────────────────────
  if (received === 0 && sent > 0) {
    out.push({ direction: "down", label: _t("score.insights.noReplyYet", "Lead hasn't replied yet"), column: "activity" });
  } else if (received >= 4) {
    out.push({ direction: "up", label: _t("score.insights.highActivity", "High message activity"), column: "activity" });
  } else if (received >= 2) {
    out.push({ direction: "up", label: _t("score.insights.repliedMultiple", "Replied multiple times"), column: "activity" });
  }
  if (received > 0 && sent > 0 && received / sent >= 1.0) {
    out.push({ direction: "up", label: _t("score.insights.repliesMoreThanPinged", "Replies more than pinged"), column: "activity" });
  }
  if (bumps >= 3) {
    out.push({ direction: "down", label: _t("score.insights.manyFollowUps", "Many follow-ups sent"), column: "activity" });
  }

  return out.slice(0, 4);
}

// ── Card-view score context helpers ────────────────────────────────────────────
export function cardEngagementContext(lead?: Record<string, any>): string {
  if (!lead) return "";
  const parts: string[] = [];
  const lastReceived = lead.lastMessageReceivedAt ?? lead.last_message_received_at;
  if (lastReceived) {
    const hours = (Date.now() - new Date(lastReceived).getTime()) / 3600000;
    if (hours < 1) parts.push("Replied just now");
    else if (hours < 24) parts.push(`Replied ${Math.round(hours)}h ago`);
    else {
      const days = Math.floor(hours / 24);
      parts.push(days === 1 ? "Replied yesterday" : `Replied ${days}d ago`);
      if (days >= 7) parts.push("Decaying");
    }
  } else {
    parts.push("No replies yet");
  }
  const sentiment = (lead.aiSentiment ?? lead.ai_sentiment ?? "").toString().toLowerCase();
  if (sentiment === "positive") parts.push("Positive");
  else if (sentiment === "negative") parts.push("Negative");

  const intentRaw = (lead.aiIntentSignals ?? lead.ai_intent_signals ?? "").toString();
  if (intentRaw) {
    const intents = intentRaw.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const labels: Record<string, string> = {
      asked_pricing: "Asked pricing", mentioned_timeline: "Has timeline",
      requested_callback: "Wants callback", not_interested: "Not interested",
    };
    for (const intent of intents) {
      if (labels[intent]) { parts.push(labels[intent]); break; }
    }
  }
  const bumpStage = Number(lead.currentBumpStage ?? lead.current_bump_stage ?? 0);
  if (bumpStage >= 2) parts.push(`Bumped ${bumpStage}x`);
  return parts.join(" · ");
}

export function cardActivityContext(lead?: Record<string, any>): string {
  if (!lead) return "";
  const received = Number(lead.messageCountReceived ?? lead.message_count_received ?? 0);
  const sent = Number(lead.messageCountSent ?? lead.message_count_sent ?? 0);
  const parts: string[] = [];
  parts.push(`${received} ${received === 1 ? "reply" : "replies"}`);
  if (sent > 0 && received > 0) {
    parts.push(`${Math.round((received / sent) * 100)}% rate`);
  }
  return parts.join(" · ");
}

export function cardFunnelContext(lead?: Record<string, any>): string {
  if (!lead) return "";
  const status = lead.conversionStatus ?? lead.conversion_status ?? lead.Conversion_Status ?? "";
  return CARD_FUNNEL_HINTS[status] || status || "Not set";
}
