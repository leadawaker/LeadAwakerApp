// Lead data accessor utilities extracted from LeadsCardView.tsx

import { getInitials as getInitialsUtil } from "@/lib/avatarUtils";
import { AVATAR_PASTELS } from "./constants";

// ── Public accessors ──────────────────────────────────────────────────────────

export function getLeadId(lead: Record<string, any>): number {
  return lead.Id ?? lead.id ?? 0;
}

export function getFullName(lead: Record<string, any>): string {
  return lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}

export function getInitials(name: string): string {
  return getInitialsUtil(name);
}

export function getScore(lead: Record<string, any>): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}

export function getStatus(lead: Record<string, any>): string {
  return lead.conversion_status || lead.Conversion_Status || "";
}

export function getAvatarPastel(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PASTELS[Math.abs(hash) % AVATAR_PASTELS.length];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

export function getPhone(lead: Record<string, any>): string {
  return lead.phone || lead.Phone || "";
}

export function getLastMessage(lead: Record<string, any>): string {
  return lead.last_message || lead.last_message_received || lead.last_reply || lead.last_message_sent || "";
}

export function getLastMessageSender(lead: Record<string, any>): string {
  const received = lead.last_message_received || lead.last_reply || "";
  const sent = lead.last_message_sent || "";
  const last = lead.last_message || "";
  // If the last message matches the inbound field → from lead → show nothing
  if (received && (last === received || (!last && !sent))) return "";
  // Outbound → AI (most outbound in this system is AI-driven)
  if (sent || last) return "AI";
  return "";
}
