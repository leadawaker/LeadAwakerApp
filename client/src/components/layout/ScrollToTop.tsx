import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const SUPPORTED_LANGS = ["en", "pt", "nl"];

/** Strip language prefix to get the "real" path */
function stripLang(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && SUPPORTED_LANGS.includes(segments[0])) {
    return "/" + segments.slice(1).join("/") || "/";
  }
  return pathname || "/";
}

function handleHashAfterMount() {
  const hash = window.location.hash;
  if (!hash) return;
  const id = hash.replace(/^#/, "");

  // Sections above the target may mount or expand (images, viewport-triggered animations),
  // pushing the target's real position down. Re-anchor repeatedly until its top stabilizes.
  let attempts = 0;
  let lastTop = Number.NaN;
  let stableTicks = 0;
  const tick = () => {
    attempts += 1;
    const el = document.getElementById(id);
    if (!el) {
      if (attempts < 30) setTimeout(tick, 100);
      return;
    }
    const currentTop = el.getBoundingClientRect().top + window.scrollY;
    if (Math.abs(currentTop - lastTop) < 1) {
      stableTicks += 1;
    } else {
      stableTicks = 0;
    }
    lastTop = currentTop;
    el.scrollIntoView({ behavior: attempts === 1 ? "auto" : "smooth", block: "start" });
    if (stableTicks < 3 && attempts < 30) setTimeout(tick, 120);
  };
  tick();
}

export function ScrollToTop() {
  const [pathname] = useLocation();
  const prevPath = useRef(stripLang(pathname));

  useEffect(() => {
    const currentPath = stripLang(pathname);
    if (currentPath !== prevPath.current) {
      if (window.location.hash) {
        handleHashAfterMount();
      } else {
        window.scrollTo(0, 0);
      }
    }
    prevPath.current = currentPath;
  }, [pathname]);

  useEffect(() => {
    if (window.location.hash) {
      handleHashAfterMount();
    }
    const onHashChange = () => handleHashAfterMount();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return null;
}
