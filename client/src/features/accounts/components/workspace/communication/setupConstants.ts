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

// Natural (recorded) feminine voices the phone receptionist can use. Mirrors
// FEMININE_VOICES in the engine's live_session_config.py, natural ones only:
// a generated voice sounded synthetic on Dutch calls.
export const VOICE_OPTIONS = ["marin", "gleam", "willow", "bossa"] as const;
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
    afterHours: string | null;
  };
  whatsapp: { numberChoice: string | null; appType: string | null };
  stock: { feedUrl: string; notes: string };
}

export const EMPTY_SETUP: ReceptionistSetup = {
  handoff: { name: "", number: "", ringWhen: null, recap: true, recapTime: "18:00" },
  voice: {
    lines: [], landlineNumber: "", landlineProvider: "", mobileNumber: "", forwardWhen: ["noAnswer"],
    voice: null, locale: null, greeting: "", pronunciation: [], afterHours: null,
  },
  whatsapp: { numberChoice: null, appType: null },
  stock: { feedUrl: "", notes: "" },
};

// Merge a stored (possibly partial or older) setup over the empty shape, so a
// field added later never arrives undefined.
export function normalizeSetup(raw: unknown): ReceptionistSetup {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ReceptionistSetup, object>>;
  return {
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
    { key: "voiceAfterHours", kind: "custom", section: "voice" },
  ],
  widget: [{ key: "widgetSetup", kind: "custom", section: "widget" }],
  whatsapp: [
    { key: "whatsappNumber", kind: "custom", section: "whatsapp" },
    { key: "whatsappConnect", kind: "custom", section: "whatsapp" },
  ],
};
