// Receptionist onboarding (specs/receptionist-onboarding): the services a client
// takes, and the answers for the sections those services add to the wizard.
// Keys only. Labels live in the `communicationProfile` i18n namespace.
import type { StepDef } from "./profileConstants";

export const SERVICES = ["voice", "widget", "whatsapp", "dbr"] as const;
export type ServiceKey = (typeof SERVICES)[number];

export const VOICE_LINES = ["landline", "mobile"] as const;
export const FORWARD_WHEN = ["noAnswer", "busy", "unreachable", "always"] as const;
export const RING_WHEN = ["anytime", "hours", "never"] as const;
export const AFTER_HOURS = ["message", "callback", "ringHot"] as const;
export const WA_NUMBER_CHOICE = ["new", "existing"] as const;
export const WA_APP_TYPE = ["business", "personal", "unknown"] as const;

// The voices the phone receptionist can use: mirrors FEMININE_VOICES and
// MASCULINE_VOICES in the engine's live_session_config.py, same order. OpenAI
// splits gpt-live-1 voices into natural (recorded from a person) and generated
// (synthesised) ones; a generated voice sounded synthetic on a Dutch call, so
// the natural ones come first and the picker labels each. The generated
// masculine voices (beacon, cinder) joined on 2026-10-15, last in their group.
export const FEMININE_VOICE_OPTIONS = [
  "marin", "gleam", "willow", "bossa", "quartz", "delta", "coral", "sage", "shimmer",
] as const;
export const MASCULINE_VOICE_OPTIONS = ["vesper", "stone", "meridian", "ripple", "tempo", "beacon", "cinder"] as const;
export const VOICE_OPTIONS = [...FEMININE_VOICE_OPTIONS, ...MASCULINE_VOICE_OPTIONS] as const;
/** The generated (synthesised) voices; every other option is natural. */
export const GENERATED_VOICES: readonly string[] = ["quartz", "delta", "coral", "sage", "shimmer", "beacon", "cinder"];
export const isGeneratedVoice = (voice: string) => GENERATED_VOICES.includes(voice);

// The default names, mirroring DEFAULT_AGENT_NAME / MALE_AGENT_NAMES in the engine.
export const DEFAULT_AGENT_NAME = "Sara";
export const MALE_AGENT_NAMES: Record<string, string> = { en: "Harry", nl: "Daan", pt: "Pedro" };

export const isMasculineVoice = (voice: string) => (MASCULINE_VOICE_OPTIONS as readonly string[]).includes(voice);

// The name after a voice or language change: a default name follows the
// voice's gender and language, a name the client typed themselves stays.
export function nameForVoice(current: string, voice: string, locale: string): string {
  const maleDefaults = Object.values(MALE_AGENT_NAMES);
  const isDefault = !current || current === DEFAULT_AGENT_NAME || maleDefaults.includes(current);
  if (!isDefault) return current;
  if (isMasculineVoice(voice)) return maleNameFor(locale);
  return maleDefaults.includes(current) ? DEFAULT_AGENT_NAME : current;
}

// No language set means the engine's default, Dutch.
const maleNameFor = (locale: string) => MALE_AGENT_NAMES[(locale || "nl").split("-")[0]] ?? MALE_AGENT_NAMES.en;

/** The name she answers to on a call, as the engine's agent_for decides it:
 *  a typed name wins, except a leftover Sara on a masculine voice. */
export function spokenAgentName(name: string, voice: string, locale: string): string {
  const n = name.trim();
  if (!n || (n === DEFAULT_AGENT_NAME && isMasculineVoice(voice))) {
    return isMasculineVoice(voice) ? maleNameFor(locale) : DEFAULT_AGENT_NAME;
  }
  return n;
}
export const VOICE_LOCALES = ["nl", "en-GB", "en-US", "pt-BR"] as const;

// GSM forwarding codes for a mobile line, by trigger. `{n}` is the AI number.
export const MOBILE_FORWARD_CODES: Record<(typeof FORWARD_WHEN)[number], string> = {
  noAnswer: "**61*{n}#",
  busy: "**67*{n}#",
  unreachable: "**62*{n}#",
  always: "**21*{n}#",
};

export interface PronunciationRow { word: string; sayAs: string }

export interface ReceptionistSetup {
  handoff: { name: string; number: string; ringWhen: string | null; recap: boolean; recapTime: string };
  voice: {
    lines: string[];
    landlineNumber: string;
    landlineProvider: string;
    mobileNumber: string;
    forwardWhen: string[];
    voice: string | null;
    locale: string | null;
    greeting: string;
    pronunciation: PronunciationRow[];
    /** What the team wants to know before an appointment, one item per line (shared/voiceIntake.ts). */
    intake: string;
    afterHours: string | null;
  };
  whatsapp: { numberChoice: string | null; appType: string | null };
  stock: { feedUrl: string; notes: string };
}

export const EMPTY_SETUP: ReceptionistSetup = {
  handoff: { name: "", number: "", ringWhen: null, recap: true, recapTime: "18:00" },
  voice: {
    lines: [], landlineNumber: "", landlineProvider: "", mobileNumber: "", forwardWhen: ["noAnswer"],
    voice: null, locale: null, greeting: "", pronunciation: [], intake: "", afterHours: null,
  },
  whatsapp: { numberChoice: null, appType: null },
  stock: { feedUrl: "", notes: "" },
};

// Merge a stored (possibly partial or older) setup over the empty shape, so a
// field added later never arrives undefined. Keys the wizard does not edit
// (the Voice tab's `screening`) ride along, so a wizard save keeps them.
export function normalizeSetup(raw: unknown): ReceptionistSetup {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ReceptionistSetup, object>>;
  return {
    ...r,
    handoff: { ...EMPTY_SETUP.handoff, ...(r.handoff ?? {}) },
    voice: { ...EMPTY_SETUP.voice, ...(r.voice ?? {}) },
    whatsapp: { ...EMPTY_SETUP.whatsapp, ...(r.whatsapp ?? {}) },
    stock: { ...EMPTY_SETUP.stock, ...(r.stock ?? {}) },
  } as ReceptionistSetup;
}

export function normalizeServices(raw: unknown): ServiceKey[] {
  if (!Array.isArray(raw)) return [];
  return SERVICES.filter((s) => raw.includes(s));
}

// ── Steps the receptionist sections add ─────────────────────────────────────
// Assembled into the wizard's step list by buildSteps() in profileConstants.
export const SERVICES_STEP: StepDef = { key: "services", kind: "custom", section: "services" };
export const STOCK_STEP: StepDef = { key: "stockFeed", kind: "custom", section: "facts" };
export const HANDOFF_STEPS: StepDef[] = [
  { key: "handoffContact", kind: "custom", section: "handoff" },
  { key: "handoffRules", kind: "custom", section: "handoff" },
];
export const SERVICE_STEPS: Partial<Record<ServiceKey, StepDef[]>> = {
  voice: [
    { key: "voiceForwarding", kind: "custom", section: "voice" },
    { key: "voiceSound", kind: "custom", section: "voice" },
    { key: "voicePronunciation", kind: "custom", section: "voice" },
    { key: "voiceIntake", kind: "custom", section: "voice" },
    { key: "voiceAfterHours", kind: "custom", section: "voice" },
  ],
  widget: [{ key: "widgetSetup", kind: "custom", section: "widget" }],
  whatsapp: [
    { key: "whatsappNumber", kind: "custom", section: "whatsapp" },
    { key: "whatsappConnect", kind: "custom", section: "whatsapp" },
  ],
};
