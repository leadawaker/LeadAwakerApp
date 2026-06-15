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

// ── Merged step list ─────────────────────────────────────────────────────────
export type StepKind = "style" | "fact" | "qagrid";
export interface StepDef { key: string; kind: StepKind }

export const STEPS: StepDef[] = [
  { key: "openingStyle", kind: "style" },     // AI style
  { key: "statusQuestion", kind: "style" },   // recommendation derived from AI style
  { key: "formality", kind: "style" },        // 3 levels, sets je/u
  { key: "perception", kind: "style" },
  { key: "objections", kind: "qagrid" },      // → KB "objections"
  { key: "faq", kind: "qagrid" },             // → KB "faq"
  { key: "preferredWords", kind: "style" },
  { key: "agentName", kind: "style" },        // name + custom + avatar
  { key: "negotiation", kind: "fact" },
  { key: "financing", kind: "fact" },
  { key: "installments", kind: "fact" },
  { key: "deliveryTime", kind: "fact" },
  { key: "guarantees", kind: "fact" },
];

export type StyleField =
  | "openingStyle" | "statusQuestion" | "formality" | "perception"
  | "preferredWords" | "agentName";

export const STEPS_WITH_EXAMPLES: StyleField[] = ["openingStyle", "statusQuestion"];

// ── Fixed facts → KB entries (matched by category + title, NOT translated). ──
export interface FactDef { category: string; title: string }
export const FACT_DEFS: Record<string, FactDef> = {
  negotiation: { category: "pricing", title: "Negotiation room" },
  financing: { category: "pricing", title: "Financing" },
  installments: { category: "pricing", title: "Installments" },
  deliveryTime: { category: "services", title: "Delivery time" },
  guarantees: { category: "policies", title: "Guarantees & warranty" },
};
export type FactValues = Record<string, string>;

// ── Q&A grids (objections + FAQ) → KB rows by category. ──────────────────────
export const QA_CATEGORY: Record<string, string> = { objections: "objections", faq: "faq" };
export const QA_MIN_ROWS = 5;
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
};
