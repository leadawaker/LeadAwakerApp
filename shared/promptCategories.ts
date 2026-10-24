// Prompt Library areas (Prompt_Library.category). Shared so the client tabs and
// the server's create/update check use the same list.

export const PROMPT_CATEGORIES = ["chat", "voice", "crm", "social", "test", "reputation"] as const;
export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export function isPromptCategory(v: unknown): v is PromptCategory {
  return typeof v === "string" && (PROMPT_CATEGORIES as readonly string[]).includes(v);
}

export type PromptCategoryInput =
  | { ok: true; value: PromptCategory | null | undefined }
  | { ok: false };

/**
 * Checks a category sent on create/update. Not sent (undefined) stays undefined
 * so an update leaves the stored value alone; null or blank clears it; any
 * other value must be one of the areas (trimmed, case-insensitive).
 */
export function parsePromptCategoryInput(v: unknown): PromptCategoryInput {
  if (v === undefined) return { ok: true, value: undefined };
  if (v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false };
  const c = v.trim().toLowerCase();
  if (c === "") return { ok: true, value: null };
  return isPromptCategory(c) ? { ok: true, value: c } : { ok: false };
}
