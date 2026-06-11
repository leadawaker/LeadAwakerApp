// Pure formatting + score-context helpers for the Lead detail panel.
// Extracted verbatim from LeadDetailPanel.tsx (structural split — no change).

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

// ── Pipeline Stages ────────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Responded",
  "Multiple Responses",
  "Qualified",
  "Booked",
  "Lost",
  "DND",
] as const;

// ── AI Memory Display ──────────────────────────────────────────────────────

export function formatAiMemory(raw: string): string {
  if (!raw) return "";
  // Try to parse as JSON and pretty-print
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      // Format key-value pairs as readable lines
      return Object.entries(parsed)
        .map(([k, v]) => {
          const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const value = typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
          return `${label}: ${value}`;
        })
        .join("\n");
    }
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
  } catch {
    return raw; // return as-is if not JSON
  }
}

// ── Score context helpers ────────────────────────────────────────────────────

export function engagementContext(lead: Record<string, any> | null): string {
  if (!lead) return "";
  const parts: string[] = [];

  // Reply recency
  const lastReceived = lead.lastMessageReceivedAt ?? lead.last_message_received_at;
  if (lastReceived) {
    const hours = (Date.now() - new Date(lastReceived).getTime()) / 3600000;
    if (hours < 1) parts.push("Replied just now");
    else if (hours < 24) parts.push(`Replied ${Math.round(hours)}h ago`);
    else {
      const days = Math.floor(hours / 24);
      parts.push(days === 1 ? "Replied yesterday" : `Replied ${days}d ago`);
      if (days >= 7) parts.push("Score decaying");
    }
  } else {
    parts.push("No replies yet");
  }

  // Sentiment
  const sentiment = (lead.aiSentiment ?? lead.ai_sentiment ?? "").toString().toLowerCase();
  if (sentiment === "positive") parts.push("Positive sentiment");
  else if (sentiment === "neutral") parts.push("Neutral sentiment");
  else if (sentiment === "negative") parts.push("Negative sentiment");

  // Intent signals
  const intentRaw = (lead.aiIntentSignals ?? lead.ai_intent_signals ?? "").toString();
  if (intentRaw) {
    const intents = intentRaw.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const labels: Record<string, string> = {
      asked_pricing: "Asked pricing",
      mentioned_timeline: "Has timeline",
      requested_callback: "Wants callback",
      asked_features: "Asked features",
      expressed_objection: "Objection raised",
      not_interested: "Not interested",
    };
    for (const intent of intents) {
      if (labels[intent]) { parts.push(labels[intent]); break; }
    }
  }

  // Bump stage penalty
  const bumpStage = Number(lead.currentBumpStage ?? lead.current_bump_stage ?? 0);
  if (bumpStage >= 2) parts.push(`Bumped ${bumpStage}x, no reply`);

  return parts.join(" · ");
}

export function activityContext(lead: Record<string, any> | null): string {
  if (!lead) return "";
  const received = Number(lead.messageCountReceived ?? lead.message_count_received ?? 0);
  const sent = Number(lead.messageCountSent ?? lead.message_count_sent ?? 0);
  const parts: string[] = [];
  parts.push(`${received} ${received === 1 ? "reply" : "replies"} received`);
  if (sent > 0 && received > 0) {
    const ratio = Math.round((received / sent) * 100);
    parts.push(`${ratio}% reply rate`);
  } else if (sent > 0 && received === 0) {
    parts.push("No replies yet");
  }

  // Message frequency
  const firstSent = lead.firstMessageSentAt ?? lead.first_message_sent_at;
  if (firstSent && received >= 2) {
    const daysSinceFirst = (Date.now() - new Date(firstSent).getTime()) / 86400000;
    if (daysSinceFirst >= 1) {
      const perDay = received / daysSinceFirst;
      if (perDay >= 1) parts.push(`~${Math.round(perDay)}/day`);
      else parts.push(`~${Math.round(perDay * 7)}/week`);
    }
  }

  return parts.join(" · ");
}

export const FUNNEL_STAGE_ORDER = [
  "New", "Queued", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "DND", "Lost",
];

export const FUNNEL_NEXT_ACTION: Record<string, string> = {
  New: "Waiting to be contacted",
  Queued: "Queued for outreach",
  Contacted: "Waiting for first reply",
  Responded: "Engage to qualify",
  "Multiple Responses": "Ready to qualify",
  Qualified: "Schedule a call",
  Booked: "Call scheduled",
  DND: "Do not contact",
  Lost: "Lead lost",
};

export function funnelContext(lead: Record<string, any> | null): string {
  if (!lead) return "";
  const status = lead.conversionStatus ?? lead.conversion_status ?? lead.Conversion_Status ?? "";
  if (!status) return "Not set";

  const parts: string[] = [];

  // Next action hint
  const hint = FUNNEL_NEXT_ACTION[status];
  if (hint) parts.push(hint);

  // Time at current stage
  const lastActivity = lead.last_interaction_at ?? lead.lastMessageReceivedAt ?? lead.last_message_received_at ?? lead.lastMessageSentAt ?? lead.last_message_sent_at;
  if (lastActivity) {
    const days = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
    if (days >= 1) parts.push(`${days}d at this stage`);
  }

  return parts.join(" · ");
}
