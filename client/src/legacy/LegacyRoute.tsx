import { useEffect } from "react";
import LegacyI18nProvider from "./LegacyI18nProvider";
import Home from "./pages/Home";

/* The browser chrome tint comes from a single static <meta name="theme-color">
   in app.html, which carries the wine color of the main site. The legacy page
   runs its own indigo palette, so swap the tag while this route is mounted and
   restore the original on the way out. */
const LEGACY_THEME_COLOR = "#4F46E5";

function useLegacyThemeColor() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = LEGACY_THEME_COLOR;
    return () => {
      meta.content = previous;
    };
  }, []);
}

export default function LegacyRoute() {
  useLegacyThemeColor();

  return (
    <LegacyI18nProvider>
      <Home />
    </LegacyI18nProvider>
  );
}
