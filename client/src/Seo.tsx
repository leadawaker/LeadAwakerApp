import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

const SITE_URL = "https://leadawaker.com";

const LANGS = ["en", "pt", "nl"] as const;
type Lang = typeof LANGS[number];

const OG_LOCALES: Record<Lang, string> = {
  en: "en_US",
  pt: "pt_BR",
  nl: "nl_NL",
};

function upsertMeta(name: string, content: string, property = false) {
  const selector = property
    ? `meta[property="${name}"]`
    : `meta[name="${name}"]`;

  let meta = document.head.querySelector<HTMLMetaElement>(selector);

  if (!meta) {
    meta = document.createElement("meta");
    if (property) meta.setAttribute("property", name);
    else meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;

  let link = document.head.querySelector<HTMLLinkElement>(selector);

  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    if (hreflang) link.hreflang = hreflang;
    document.head.appendChild(link);
  }

  link.href = href;
}

export default function Seo() {
  const [location] = useLocation();
  const { t, i18n } = useTranslation("common");

  useEffect(() => {
    const lang = (i18n.language as Lang) || "en";

    const canonicalPath =
      location === "/"
        ? "/"
        : location.replace(/^\/(pt|nl)(?=\/|$)/, "");

    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    /* ---------------- Canonical ---------------- */
    upsertLink("canonical", canonicalUrl);

    /* ---------------- hreflang ---------------- */
    LANGS.forEach((l) => {
      const path = l === "en" ? canonicalPath : `/${l}${canonicalPath}`;
      upsertLink("alternate", `${SITE_URL}${path}`, l);
    });

    upsertLink("alternate", canonicalUrl, "x-default");

    /* ---------------- Title & Meta ---------------- */
    const title = t("seo.defaultTitle");
    const description = t("seo.defaultDescription");

    document.title = title;
    upsertMeta("description", description);

    /* ---------------- OpenGraph ---------------- */
    upsertMeta("og:title", title, true);
    upsertMeta("og:description", description, true);
    upsertMeta("og:url", `${SITE_URL}${location}`, true);
    upsertMeta("og:type", "website", true);
    upsertMeta("og:site_name", "Lead Awaker", true);
    upsertMeta("og:locale", OG_LOCALES[lang], true);

    LANGS.filter((l) => l !== lang).forEach((alt) => {
      upsertMeta("og:locale:alternate", OG_LOCALES[alt], true);
    });
  }, [location, i18n.language, t]);

  return null;
}