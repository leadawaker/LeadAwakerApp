// Canonical structure for the Communication Profile onboarding wizard.
// Keys only — all human-facing labels live in the `communicationProfile` i18n namespace.
// Q7 (preferred words) values are literal Dutch terms that flow into prompts later,
// so they are rendered verbatim (not translated).

export const OPENING_STYLE = ["personal", "project", "business"] as const;
export const ADDRESS_FORM = ["je", "u"] as const;
export const STATUS_QUESTION = ["traject", "project", "besluitvorming"] as const;
export const BRAND_FEEL = ["warm", "professional", "direct"] as const;
export const CONTACT_APPROACH = ["awaiting", "neutral", "proactive"] as const;

export const DISTINCTIVE = [
  "persoonlijke_aandacht", "vakmanschap", "design", "kwaliteit", "ontzorgen",
  "meedenken", "exclusiviteit", "snelheid", "transparantie", "betrouwbaarheid",
  "familiebedrijf",
] as const;

export const PERCEPTION = [
  "persoonlijk", "deskundig", "rustig", "betrokken", "exclusief", "creatief",
  "praktisch", "vertrouwd", "hoogwaardig", "toegankelijk", "direct", "geduldig",
] as const;

export const AGENT_NAMES = ["thomas", "mark", "sophie", "lisa"] as const;
export const AGENT_GENDER: Record<(typeof AGENT_NAMES)[number], "male" | "female"> = {
  thomas: "male", mark: "male", sophie: "female", lisa: "female",
};

// Q7 — grouped single-selects. Values are the literal words shown to the client.
export const PREFERRED_WORD_GROUPS = {
  projectTerm: ["keukenproject", "keuken", "project"],
  proposalTerm: ["ontwerp", "verbouwing", "voorstel", "offerte", "ontwerpvoorstel", "plan"],
  decisionTerm: ["beslissing", "besluit", "keuze", "besluitvorming", "afweging"],
} as const;
export type PreferredWordGroup = keyof typeof PREFERRED_WORD_GROUPS;

export const FORMALITY_MIN = 1;
export const FORMALITY_MAX = 5;
export const PERCEPTION_MAX = 3;

// Phase 1 — communication style. Reordered so brand feel + formality come first:
// they drive the expert recommendation we pre-select for the tactical questions
// (status question, contact approach), which clients shouldn't have to decide.
export const STYLE_STEPS = [
  "brandFeel",
  "formality",
  "addressForm",
  "openingStyle",
  "statusQuestion",
  "contactApproach",
  "preferredWords",
  "distinctive",
  "perception",
  "agentName",
] as const;
export type WizardStep = (typeof STYLE_STEPS)[number];

// Which steps carry an illustrative Dutch sample sentence (rendered under the option).
export const STEPS_WITH_EXAMPLES: WizardStep[] = ["openingStyle", "statusQuestion", "contactApproach"];

// Tactical questions where we pre-select an expert default (derived from brand
// feel) so the client confirms rather than decides.
export const RECOMMENDED_STEPS = ["statusQuestion", "contactApproach"] as const;
export type RecommendedStep = (typeof RECOMMENDED_STEPS)[number];

export function recommendFor(field: RecommendedStep, brandFeel: string | null): string {
  const bf = brandFeel ?? "professional";
  if (field === "statusQuestion") {
    return bf === "warm" ? "traject" : bf === "direct" ? "besluitvorming" : "project";
  }
  return bf === "warm" ? "awaiting" : bf === "direct" ? "proactive" : "neutral";
}

// Phase 2 — key facts. Each step is a free-text question whose answer is written
// to the existing Knowledge Base (Company Intel), matched by category + title.
// Titles are stable identifiers used to upsert the KB entry, so they are NOT
// translated (the AI conversation pipeline reads facts from the KB).
export interface FactQuestion { id: string; category: string; title: string; }
export const FACT_STEPS: FactQuestion[] = [
  { id: "pricing", category: "pricing", title: "Pricing approach" },
  { id: "discounts", category: "pricing", title: "Discounts" },
  { id: "financing", category: "pricing", title: "Financing & payment terms" },
  { id: "leadTimes", category: "services", title: "Lead times" },
  { id: "guarantees", category: "policies", title: "Guarantees & warranty" },
  { id: "serviceArea", category: "location", title: "Service area" },
  { id: "included", category: "services", title: "What is included" },
  { id: "objection", category: "faq", title: "Common objection & response" },
  { id: "faq", category: "faq", title: "Frequently asked questions" },
];
export type FactValues = Record<string, string>;

// The in-memory answer shape the wizard edits.
export interface ProfileAnswers {
  openingStyle: string | null;
  addressForm: string | null;
  statusQuestion: string | null;
  brandFeel: string | null;
  contactApproach: string | null;
  distinctive: string[];
  distinctiveOther: string;
  preferredWords: { projectTerm?: string; proposalTerm?: string; decisionTerm?: string };
  formality: number | null;
  perception: string[];
  agentName: string | null;
  agentNameNote: string;
}

export const EMPTY_ANSWERS: ProfileAnswers = {
  openingStyle: null,
  addressForm: null,
  statusQuestion: null,
  brandFeel: null,
  contactApproach: null,
  distinctive: [],
  distinctiveOther: "",
  preferredWords: {},
  formality: null,
  perception: [],
  agentName: null,
  agentNameNote: "",
};
