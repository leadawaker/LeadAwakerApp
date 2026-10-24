// Prompt Library tabs: every prompt belongs to one area (Prompt_Library.category)
// and can be tagged as serving a demo (Prompt_Library.is_demo). Rows without a
// category (older rows, or ones auto-created by the server) fall back to their
// use_case, so a prompt always lands on a tab.

import { PROMPT_CATEGORIES, isPromptCategory, type PromptCategory } from "@shared/promptCategories";

// The list lives in shared/ so the server validates against the same areas.
export { PROMPT_CATEGORIES, isPromptCategory, type PromptCategory };

/** The Prompt Library's top tabs: the areas plus the Niche Words manager. */
export type PromptListTab = PromptCategory | "niche";

export function isPromptListTab(v: unknown): v is PromptListTab {
  return v === "niche" || isPromptCategory(v);
}

/** Voice agents' prompts: the GPT Live / Grok / ElevenLabs layers, greetings and backend rows. */
export function isVoiceUseCase(useCase: string | null | undefined): boolean {
  return /^(voice|eleven)_/.test(String(useCase ?? ""));
}

function useCaseOf(p: any): string {
  return String(p?.useCase ?? p?.use_case ?? "").trim();
}

/** Where a row without a saved category belongs, from its use_case. */
export function categoryFromUseCase(useCase: string): PromptCategory {
  const uc = useCase.toLowerCase();
  if (isVoiceUseCase(uc)) return "voice";
  if (uc === "conversation" || uc === "customer-support" || uc === "universal_demo_recap_summary") return "chat";
  if (uc === "review-reply" || uc.startsWith("reputation")) return "reputation";
  if (uc.startsWith("social")) return "social";
  if (uc === "test" || uc === "whatsap") return "test";
  return "crm";
}

export function promptCategory(p: any): PromptCategory {
  const saved = String(p?.category ?? "").trim().toLowerCase();
  return isPromptCategory(saved) ? saved : categoryFromUseCase(useCaseOf(p));
}

export function isDemoPrompt(p: any): boolean {
  return Boolean(p?.isDemo ?? p?.is_demo);
}

/** The color of a prompt's icon tile, per area (tokens only). */
export const CATEGORY_COLOR: Record<PromptCategory, string> = {
  chat: "var(--wine)",
  voice: "var(--stage-contacted)",
  crm: "var(--stage-responded)",
  social: "var(--stage-new)",
  test: "var(--stage-dnd)",
  reputation: "var(--stage-booked)",
};

/** A soft wash of a category color, for hover states. */
export function categoryTint(category: PromptCategory, pct = 12): string {
  return `color-mix(in srgb, ${CATEGORY_COLOR[category]} ${pct}%, transparent)`;
}
