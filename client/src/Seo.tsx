import { useEffect } from "react";
import { useLocation } from "wouter";

const SITE_URL = "https://leadawaker.com";
const LANGS = ["en", "pt", "nl"];

function upsertLink(
  rel: string,
  href: string,
  hreflang?: string
) {
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

  useEffect(() => {
    const canonicalPath =
      location === "/"
        ? "/"
        : location.replace(/^\/(pt|nl)(?=\/|$)/, "");

    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    // Canonical
    upsertLink("canonical", canonicalUrl);

    // hreflang
    LANGS.forEach(lang => {
      const path =
        lang === "en"
          ? canonicalPath
          : `/${lang}${canonicalPath}`;

      upsertLink(
        "alternate",
        `${SITE_URL}${path}`,
        lang
      );
    });

    // x-default
    upsertLink(
      "alternate",
      canonicalUrl,
      "x-default"
    );
  }, [location]);

  return null;
}