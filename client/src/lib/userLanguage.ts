export type CrmLang = "en" | "nl" | "pt";

const LANGS: readonly string[] = ["en", "nl", "pt"];
export const LANG_LS_KEY = "leadawaker_lang";

/**
 * The language saved in Users.preferences (a JSON string or an object).
 * accept-invite stores `language`, the invite stores `lang`; `language` wins.
 */
export function languageFromPrefs(raw: unknown): CrmLang | null {
  let prefs: unknown = raw;
  if (typeof raw === "string") {
    try {
      prefs = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!prefs || typeof prefs !== "object") return null;
  const p = prefs as Record<string, unknown>;
  for (const v of [p.language, p.lang]) {
    if (typeof v === "string" && LANGS.includes(v)) return v as CrmLang;
  }
  return null;
}

/** The language to apply from saved prefs, or null when a choice already exists. */
export function shouldHydrateLanguage(stored: string | null, fromPrefs: CrmLang | null): CrmLang | null {
  return !stored && fromPrefs ? fromPrefs : null;
}

/** Apply the user's saved language only when no explicit choice is stored. */
export function hydrateUserLanguage(rawPrefs: unknown): void {
  try {
    const lang = shouldHydrateLanguage(localStorage.getItem(LANG_LS_KEY), languageFromPrefs(rawPrefs));
    if (!lang) return;
    localStorage.setItem(LANG_LS_KEY, lang);
    void import("../i18n").then((m) => m.default.changeLanguage(lang));
  } catch {
    /* storage unavailable */
  }
}
