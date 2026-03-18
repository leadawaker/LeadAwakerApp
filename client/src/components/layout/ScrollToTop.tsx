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

export function ScrollToTop() {
  const [pathname] = useLocation();
  const prevPath = useRef(stripLang(pathname));

  useEffect(() => {
    const currentPath = stripLang(pathname);
    // Only scroll to top if the actual page changed, not just the language prefix
    if (currentPath !== prevPath.current) {
      window.scrollTo(0, 0);
    }
    prevPath.current = currentPath;
  }, [pathname]);

  return null;
}
