// Canonical structure for the Communication Profile onboarding wizard.
// One merged, ordered list: style answers write to the profile table, fact
// answers and the Q&A grids (objections, FAQ) write to the Knowledge Base.
// Keys only — labels live in the `communicationProfile` i18n namespace.

export const AI_STYLE = ["personal", "project", "business"] as const;
export const STATUS_QUESTION = ["traject", "project", "besluitvorming"] as const;

// Formality replaces the separate je/u question: 3 levels, each implying an
// address form (formal → u, otherwise je).
export const FORMALITY_LEVELS = [
  { key: "informal", value: 1, address: "je" },
  { key: "neutral", value: 2, address: "je" },
  { key: "formal", value: 3, address: "u" },
] as const;
export function formalityKey(value: number | null): string | null {
  return FORMALITY_LEVELS.find((l) => l.value === value)?.key ?? null;
}
export function addressFor(value: number | null): string | null {
  return FORMALITY_LEVELS.find((l) => l.value === value)?.address ?? null;
}

// Perception: 6 options, max 3 picks.
export const PERCEPTION = [
  "persoonlijk", "deskundig", "betrokken", "exclusief", "hoogwaardig", "toegankelijk",
] as const;
export const PERCEPTION_MAX = 3;

export const AGENT_NAMES = ["thomas", "mark", "sophie", "lisa"] as const;
export const AGENT_GENDER: Record<(typeof AGENT_NAMES)[number], "male" | "female"> = {
  thomas: "male", mark: "male", sophie: "female", lisa: "female",
};

export const AVATAR_CHOICES = ["logo", "avatar", "avatarLogo"] as const;

// Portrait photos used for the assistant avatar, by gender (served from /public).
export const AGENT_AVATAR_URL: Record<"male" | "female", string> = {
  male: "/avatars/male.webp",
  female: "/avatars/female.webp",
};

// Which gender's portrait to show: a known name carries its own gender; a custom
// name has no implied gender, so the operator toggles it (defaults to female).
export function effectiveGender(a: { agentName: string | null; agentNameCustom: string; avatarGender: string | null }): "male" | "female" {
  if (a.agentNameCustom.trim()) return a.avatarGender === "male" ? "male" : "female";
  if (a.agentName && a.agentName in AGENT_GENDER) return AGENT_GENDER[a.agentName as (typeof AGENT_NAMES)[number]];
  return "female";
}

export const PREFERRED_WORD_GROUPS = {
  projectTerm: ["keukenproject", "keuken", "project"],
  proposalTerm: ["ontwerp", "verbouwing", "voorstel", "offerte", "ontwerpvoorstel", "plan"],
  decisionTerm: ["beslissing", "besluit", "keuze", "besluitvorming", "afweging"],
} as const;
export type PreferredWordGroup = keyof typeof PREFERRED_WORD_GROUPS;

// Expert recommendation for the status question, derived from the chosen AI style.
export function recommendStatus(aiStyle: string | null): string {
  return aiStyle === "personal" ? "traject" : aiStyle === "business" ? "besluitvorming" : "project";
}

// ── Sections (chapters) ──────────────────────────────────────────────────────
// The wizard keeps one-question-per-screen but groups steps into named sections
// so the facilitator can say "now we're on part 3 of 4". Labels live in i18n
// (`sections.<key>`).
export type SectionKey = "tone" | "identity" | "availability" | "sales" | "facts" | "booking";
export const SECTIONS: SectionKey[] = ["tone", "identity", "availability", "sales", "facts", "booking"];

// ── Merged step list ─────────────────────────────────────────────────────────
export type StepKind = "style" | "fact" | "qagrid" | "custom";
export interface StepDef { key: string; kind: StepKind; section: SectionKey }

export const STEPS: StepDef[] = [
  { key: "openingStyle", kind: "style", section: "tone" },     // AI style
  { key: "formality", kind: "style", section: "tone" },        // 3 levels, sets je/u
  { key: "perception", kind: "style", section: "tone" },
  { key: "preferredWords", kind: "style", section: "identity" },
  { key: "agentName", kind: "style", section: "identity" },    // name + custom + avatar
  { key: "availabilityHours", kind: "custom", section: "availability" }, // open days/hours/duration/notice (account-level)
  { key: "objections", kind: "qagrid", section: "sales" },     // → KB "objections"
  { key: "negotiation", kind: "fact", section: "facts" },
  { key: "financing", kind: "fact", section: "facts" },
  { key: "installments", kind: "fact", section: "facts" },
  { key: "deliveryTime", kind: "fact", section: "facts" },
  { key: "guarantees", kind: "fact", section: "facts" },
  { key: "faq", kind: "qagrid", section: "facts" },            // → KB "faq"
  { key: "differentiator", kind: "style", section: "facts" },  // USP arguments: after FAQ, before sensitive topics
  { key: "sensitiveTopics", kind: "fact", section: "facts" },  // → KB "policies"
  { key: "meetingType", kind: "custom", section: "booking" },  // how the booked call happens (account-level)
];

export type StyleField =
  | "openingStyle" | "formality" | "perception"
  | "preferredWords" | "agentName" | "differentiator" | "bookingUrl";

export const STEPS_WITH_EXAMPLES: StyleField[] = [];

// ── Fixed facts → KB entries (matched by category + title, NOT translated). ──
export interface FactDef { category: string; title: string }
export const FACT_DEFS: Record<string, FactDef> = {
  negotiation: { category: "pricing", title: "Negotiation room" },
  financing: { category: "pricing", title: "Financing" },
  installments: { category: "pricing", title: "Installments" },
  deliveryTime: { category: "services", title: "Delivery time" },
  guarantees: { category: "policies", title: "Guarantees & warranty" },
  sensitiveTopics: { category: "policies", title: "Sensitive topics" },
};

export const FACTS_WITH_NOPE = ["negotiation", "financing", "installments", "deliveryTime", "guarantees"];
export type FactValues = Record<string, string>;

// ── Q&A grids (objections + FAQ) → KB rows by category. ──────────────────────
export const QA_CATEGORY: Record<string, string> = { objections: "objections", faq: "faq" };
export const QA_MIN_ROWS = 2;
export interface QARow { id?: number; question: string; answer: string }

// ── In-memory style answers ──────────────────────────────────────────────────
export interface ProfileAnswers {
  openingStyle: string | null;   // AI style
  addressForm: string | null;    // derived from formality (je | u)
  statusQuestion: string | null;
  formality: number | null;      // 1 informal | 2 neutral | 3 formal
  perception: string[];
  preferredWords: { projectTerm?: string; proposalTerm?: string; decisionTerm?: string };
  agentName: string | null;
  agentNameCustom: string;
  avatarChoice: string | null;
  avatarGender: string | null;   // "male" | "female" — gender of the assistant portrait (for custom names)
  differentiator: string;        // why customers choose them (sales argument)
  bookingUrl: string;            // calendar / booking link the AI sends to leads
}

export const EMPTY_ANSWERS: ProfileAnswers = {
  openingStyle: null,
  addressForm: null,
  statusQuestion: null,
  formality: null,
  perception: [],
  preferredWords: {},
  agentName: null,
  agentNameCustom: "",
  avatarChoice: null,
  avatarGender: null,
  differentiator: "",
  bookingUrl: "",
};

// ── Recommended defaults + badge map ─────────────────────────────────────────
// Global, industry-agnostic sensible picks so a NEW profile arrives pre-filled
// and the call is "confirm, not cold-ask". Per-niche overrides can be layered
// later via RECOMMENDED_BY_NICHE without refactoring callers.
export const RECOMMENDED_DEFAULTS: Partial<ProfileAnswers> = {
  openingStyle: "personal",
  formality: 2,
  addressForm: "je",
  perception: ["persoonlijk", "deskundig", "betrokken"],
  avatarChoice: "logo",
};

export const RECOMMENDED_BY_NICHE: Record<string, Partial<ProfileAnswers>> = {};

export function recommendedDefaults(niche?: string | null): Partial<ProfileAnswers> {
  const override = niche ? RECOMMENDED_BY_NICHE[niche] : undefined;
  return { ...RECOMMENDED_DEFAULTS, ...(override ?? {}) };
}

// Which option key(s) carry the "Aanbevolen" badge for each choice question.
export const RECOMMENDED_OPTION: Record<string, string | string[]> = {
  openingStyle: "personal",
  formality: "neutral",
  avatarChoice: "logo",
};

export function isRecommended(field: string, optionKey: string): boolean {
  const rec = RECOMMENDED_OPTION[field];
  if (!rec) return false;
  return Array.isArray(rec) ? rec.includes(optionKey) : rec === optionKey;
}
