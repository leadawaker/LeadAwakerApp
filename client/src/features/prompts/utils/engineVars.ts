// Small ports of the engine's prompt-variable rules (automations
// tools/ai_service.py build_conversation_prompt and src/automations/_helpers.py),
// so the preview resolves a variable the way a real conversation does.
// Keep these in step with the engine when it changes.

// _LEAD_STAGE_KEYWORDS: first match wins, "" when nothing matches.
const LEAD_STAGE_KEYWORDS: [string, string[]][] = [
  ["inquired", ["inquired", "aangevraagd", "pediu", "request a quote", "offerte aangevraagd"]],
  ["deciding", ["decision phase", "beslissingsfase", "fase de decis", "decision"]],
  ["quoted", ["received a quote", "offerte ontvangen", "recebeu", "received"]],
  ["owner", ["installed by us", "door ons geinstalleerd", "door ons geïnstalleerd", "door ons laten installeren",
    "bestaande klant", "existing customer", "instalado por nos", "instalado por nós", "cliente existente"]],
];

/** derive_lead_stage: the stage token the prompt branches on, from what the lead did. */
export function deriveLeadStage(whatLeadDid: string | null | undefined): string {
  const low = (whatLeadDid || "").toLowerCase();
  if (!low) return "";
  for (const [stage, words] of LEAD_STAGE_KEYWORDS) {
    if (words.some((w) => low.includes(w))) return stage;
  }
  return "";
}

/** derive_conversation_mode: "scoping" (no quote yet) or "decision". */
export function deriveConversationMode(leadStage: string, override?: string | null): string {
  if (override === "scoping" || override === "decision") return override;
  return leadStage === "inquired" || leadStage === "" ? "scoping" : "decision";
}

const AI_DISCLOSURE_MODES = new Set(["off", "opener", "second_message"]);

/** normalize_ai_disclosure: "on" is the old name for "opener"; anything unknown is "off". */
export function normalizeAiDisclosure(value: string | null | undefined): string {
  const v = String(value || "").trim().toLowerCase();
  if (v === "on") return "opener";
  return AI_DISCLOSURE_MODES.has(v) ? v : "off";
}

/** resolve_language_name: the full name the AI writes in ("pt" is always Brazilian). */
export function languageName(raw: string | null | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "English";
  const map: Record<string, string> = {
    en: "English", english: "English",
    nl: "Dutch", dutch: "Dutch",
    pt: "Brazilian Portuguese", "pt-br": "Brazilian Portuguese", portuguese: "Brazilian Portuguese",
  };
  return map[v.toLowerCase()] || v;
}

/** {call_mode}: the channel noun for the booking call, from the account's meeting type. */
export function callModeName(meetingType: string | null | undefined): string {
  const map: Record<string, string> = { whatsapp_call: "WhatsApp", phone_call: "phone", video_call: "video" };
  return map[meetingType || "phone_call"] || "phone";
}

/** The engine's {today_date}: dd-mm-yyyy. */
export function engineToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Campaigns whose leads carry their own demo persona (demo_campaigns.py _DEFAULT_IDS). */
export const PERSONA_DEMO_CAMPAIGN_IDS: readonly number[] = [60, 67, 68, 69, 70];
