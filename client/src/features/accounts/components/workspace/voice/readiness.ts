// Maps each server-provided readiness item to the card that fixes it, and
// scrolls/focuses that card. Readiness itself is computed server-side.
import type { ReadinessKey } from "./voiceApi";

export type VoiceCard =
  | "number" | "persona" | "knowledge" | "agent" | "transfer" | "hours" | "extra" | "test" | "docs" | "screening" | "followUp"
  | "line" | "conversation" | "promptGreeting" | "promptExtra" | "promptLayer" | "promptBackend";

/** The Voice tab's menu: each section shows its own cards, one section at a time. */
export const VOICE_SECTIONS = ["overview", "prompt", "knowledge", "call", "after"] as const;
export type VoiceSection = (typeof VOICE_SECTIONS)[number];

/** The section a card lives in, so the readiness checklist can open it before focusing the card. */
export const CARD_SECTION: Record<VoiceCard, VoiceSection> = {
  number: "overview", docs: "overview",
  test: "prompt", agent: "prompt", extra: "prompt",
  persona: "knowledge", knowledge: "knowledge", hours: "knowledge",
  line: "call", conversation: "call", transfer: "call", screening: "call",
  followUp: "after",
  promptGreeting: "prompt", promptExtra: "prompt", promptLayer: "prompt", promptBackend: "prompt",
};

/** The card that fixes each readiness item (voice + agent name share the Agent card). */
export const READINESS_CARD: Record<ReadinessKey, VoiceCard> = {
  number: "number",
  persona: "persona",
  kb: "knowledge",
  voice: "agent",
  agent: "agent",
  transfer: "transfer",
  hours: "hours",
};

/** Display order of the checklist rows. */
export const READINESS_ORDER: ReadinessKey[] = ["number", "persona", "kb", "voice", "agent", "transfer", "hours"];

export const cardAnchorId = (card: VoiceCard) => `voice-card-${card}`;

/** Scroll the card into view and focus its first control. */
export function focusCard(card: VoiceCard) {
  const el = document.getElementById(cardAnchorId(card));
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  const target = el.querySelector<HTMLElement>("input, textarea, select, button:not([disabled])");
  // Wait for the smooth scroll to start so focus does not cancel it.
  window.setTimeout(() => target?.focus({ preventScroll: true }), 250);
}
