import { Switch, Route, useRoute, useLocation } from "wouter";
import { useEffect } from "react";
import i18n from "./i18n";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import Seo from "./Seo";

import Home from "@/pages/home";
import About from "@/pages/about";
import Services from "@/pages/services";
import BookDemo from "@/pages/book-demo";
import Login from "@/pages/login";
import AppArea from "@/pages/app";
import Canvas from "@/pages/canvas";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import NotFound from "@/pages/not-found";

/* ------------------------------------------------------------------ */
/* Language setup                                                      */
/* ------------------------------------------------------------------ */

const SUPPORTED_LANGS = ["en", "pt", "nl"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

/**
 * Strip /en prefix (static-host safe redirect)
 * /en        -> /
 * /en/about  -> /about
 */
function stripEnPrefix(path: string): string | null {
  if (path === "/en") return "/";
  if (path.startsWith("/en/")) return path.replace(/^\/en/, "");
  return null;
}
const LANG_STORAGE_KEY = "leadawaker_lang";

function getStoredLang(): Lang | null {
  const lang = localStorage.getItem(LANG_STORAGE_KEY);
  return SUPPORTED_LANGS.includes(lang as Lang) ? (lang as Lang) : null;
}

function storeLang(lang: Lang) {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

function getBrowserLang(): Lang | null {
  const navLang = navigator.language.split("-")[0];
  return SUPPORTED_LANGS.includes(navLang as Lang)
    ? (navLang as Lang)
    : null;
}
/**
 * Keep i18n language in sync with URL
 */
function useSyncLanguage(lang: Lang) {
  useEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }

    storeLang(lang);
  }, [lang]);
}



/* ------------------------------------------------------------------ */
/* Routes (English, no prefix)                                         */
/* ------------------------------------------------------------------ */

function AppRoutes() {
  useSyncLanguage("en");

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/services" component={Services} />
      <Route path="/book-demo" component={BookDemo} />
      <Route path="/login" component={Login} />
      <Route path="/agency" component={AppArea} />
      <Route path="/agency/:rest*" component={AppArea} />
      <Route path="/subaccount" component={AppArea} />
      <Route path="/subaccount/:rest*" component={AppArea} />
      <Route path="/canvas" component={Canvas} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route component={NotFound} />
    </Switch>
  );
}

/* ------------------------------------------------------------------ */
/* Language-prefixed router                                            */
/* ------------------------------------------------------------------ */

function LanguageRouter({ lang }: { lang: Lang }) {
  useSyncLanguage(lang);

  return (
    <Switch>
      <Route path={`/${lang}/about`} component={About} />
      <Route path={`/${lang}/services`} component={Services} />
      <Route path={`/${lang}/book-demo`} component={BookDemo} />
      <Route path={`/${lang}/login`} component={Login} />
      <Route path={`/${lang}/canvas`} component={Canvas} />
      <Route path={`/${lang}/privacy-policy`} component={PrivacyPolicy} />
      <Route path={`/${lang}/terms-of-service`} component={TermsOfService} />

      {/* Home MUST be last */}
      <Route path={`/${lang}`} component={Home} />

      <Route component={NotFound} />
    </Switch>
  );
}

/* ------------------------------------------------------------------ */
/* Main Router                                                         */
/* ------------------------------------------------------------------ */

function Router() {
  const [location, setLocation] = useLocation();

  // Get first path segment
  const firstSegment = location.split("/").filter(Boolean)[0] as
    | Lang
    | undefined;

  const lang = SUPPORTED_LANGS.includes(firstSegment as Lang)
    ? (firstSegment as Lang)
    : undefined;

  /* -------- Auto-redirect on homepage only -------- */
  useEffect(() => {
    if (location !== "/") return;

    // 1️⃣ Stored preference
    const storedLang = getStoredLang();
    if (storedLang && storedLang !== "en") {
      setLocation(`/${storedLang}`);
      return;
    }

    // 2️⃣ Browser language (first visit)
    const browserLang = getBrowserLang();
    if (browserLang && browserLang !== "en") {
      storeLang(browserLang);
      setLocation(`/${browserLang}`);
    }
  }, [location, setLocation]);

  /* -------- Static redirect: /en -> / -------- */
  useEffect(() => {
    const redirect = stripEnPrefix(location);
    if (redirect) {
      setLocation(redirect);
    }
  }, [location, setLocation]);

  const isAppArea = location.startsWith("/agency") || location.startsWith("/subaccount");

  return (
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      {!isAppArea && <Navbar />}

      <main className="flex-grow">
        {/* English routes (no prefix) */}
        {!lang && <AppRoutes />}

        {/* Language-prefixed routes */}
        {lang && <LanguageRouter lang={lang} />}
      </main>

      {!isAppArea && <Footer />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Seo />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;