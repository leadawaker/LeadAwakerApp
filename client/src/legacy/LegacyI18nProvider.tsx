import { useLayoutEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";

const SUPPORTED_LANGS = ["en", "pt", "nl"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

/* The URL is the source of truth for language on the marketing site:
   /legacy is English, /nl/legacy and /pt/legacy the translated versions. */
function langFromPath(path: string): Lang {
  const first = path.split("/").filter(Boolean)[0];
  return SUPPORTED_LANGS.includes(first as Lang) ? (first as Lang) : "en";
}

/* The legacy pages run their own isolated i18next instance, which detects the
   language once, at module load. The Navbar sits outside this provider and
   drives the app's global instance, so its language switcher used to change
   only the header: it rewrites the URL through wouter (no page reload), and
   the legacy instance never heard about it. Re-read the language from the URL
   on every client-side navigation so the page body follows the header. */
export default function LegacyI18nProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const lang = langFromPath(location);

  useLayoutEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
