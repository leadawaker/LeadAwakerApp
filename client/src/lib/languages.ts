/**
 * UI languages offered in the nav bar menu, the mobile More page and Settings >
 * Preferences. Native names are shown as-is in every locale.
 */
export const APP_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
] as const;

export type AppLanguageCode = (typeof APP_LANGUAGES)[number]["code"];
