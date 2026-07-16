import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Load all locale modules eagerly. Vite treats .ts imports as ES modules,
// so edits to any locale file trigger HMR without a full page reload.
const localeModules = import.meta.glob("./locales/**/*.ts", { eager: true });

// Strips optional number prefix so "01-chat3d" → namespace "chat3d"
function parseLocalePath(path: string): [string, string] | null {
  const m = path.match(/\/locales\/(\w+)\/(?:\d+-)?(.+)\.ts$/);
  return m ? [m[1], m[2]] : null;
}

const resources: Record<string, Record<string, unknown>> = {};
for (const [path, mod] of Object.entries(localeModules)) {
  const parsed = parseLocalePath(path);
  if (!parsed) continue;
  const [lang, ns] = parsed;
  if (!resources[lang]) resources[lang] = {};
  resources[lang][ns] = (mod as { default: unknown }).default;
}

// Use createInstance so the legacy app's i18n is fully isolated from the
// CRM's global i18n instance — no namespace collisions, no re-init conflicts.
const i18n = createInstance();

// Do NOT use initReactI18next here — it calls setI18n() globally and would
// overwrite the CRM's i18n as the default for all useTranslation() calls.
// I18nextProvider in LegacyRoute.tsx handles the React integration instead.
i18n
  .use(LanguageDetector)
  .init({
    resources: resources as any,
    fallbackLng: "en",
    defaultNS: "common",
    ns: [
      "common",
      "home",
      "services",
      "chat3d",
      "steps",
      "pipeline",
      "workflow",
      "about",
      "login",
      "privacyPolicy",
      "termsOfService",
    ],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "path"],
      lookupLocalStorage: "app_lang",
      lookupFromPathIndex: 0,
      caches: ["localStorage"],
    },
  });

// HMR: when any locale .ts file changes, update i18next in-place and
// re-render the current language without a full page reload.
if (import.meta.hot) {
  const localePaths = Object.keys(import.meta.glob("./locales/**/*.ts"));
  import.meta.hot.accept(localePaths, (newMods) => {
    localePaths.forEach((path, i) => {
      const mod = newMods?.[i];
      if (!mod) return;
      const parsed = parseLocalePath(path);
      if (!parsed) return;
      const [lang, ns] = parsed;
      i18n.addResourceBundle(
        lang,
        ns,
        (mod as unknown as { default: unknown }).default,
        true,  // deep merge
        true   // overwrite existing keys
      );
    });
    i18n.emit("languageChanged", i18n.language);
  });
}

export default i18n;
