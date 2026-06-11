import { Switch, Route, useRoute, useLocation, Redirect } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import i18n from "./i18n";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { WhatsAppBubbleProvider } from "@/components/layout/WhatsAppBubble";
import Seo from "./Seo";

// Top-level routes are lazy so visitors don't download the CRM and CRM users
// don't download the marketing/legacy site — they live in separate chunks.
const FAQ = lazy(() => import("@/pages/faq"));
const BookCall = lazy(() => import("@/pages/book-call"));
const Cases = lazy(() => import("@/pages/cases"));
const IntakeDemo = lazy(() => import("@/pages/intake-demo"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const LegacyHome = lazy(() => import("@/legacy/LegacyRoute"));

const AppArea = lazy(() => import("@/pages/app"));
const Canvas = lazy(() => import("@/pages/canvas"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const Accounts = lazy(() => import("@/pages/Accounts"));
const NotFound = lazy(() => import("@/pages/not-found"));

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
 * Keep i18n language in sync.
 * For marketing pages: uses the URL-based lang.
 * For CRM pages (/platform): respects the user's stored preference.
 */
function useSyncLanguage(lang: Lang) {
  useEffect(() => {
    // CRM pages: use stored preference instead of URL-derived lang
    const isCrmPage = window.location.pathname.startsWith("/platform");
    const effectiveLang = isCrmPage ? (getStoredLang() ?? lang) : lang;

    if (i18n.language !== effectiveLang) {
      i18n.changeLanguage(effectiveLang);
    }

    // Only store lang for non-CRM pages (CRM stores via the language toggle)
    if (!isCrmPage) {
      storeLang(effectiveLang);
    }
  }, [lang]);
}



/* ------------------------------------------------------------------ */
/* Routes (English, no prefix)                                         */
/* ------------------------------------------------------------------ */

/**
 * Redirects the retired /agency and /subaccount CRM prefixes to the unified
 * /platform area, preserving the rest of the path and the query string.
 */
function LegacyAppRedirect() {
  const [location] = useLocation();
  const tail = location.replace(/^\/(agency|subaccount)/, "");
  return <Redirect to={`/platform${tail}${window.location.search}`} />;
}

function AppRoutes() {
  useSyncLanguage("en");

  return (
    <Suspense fallback={null}>
    <Switch>
      <Route path="/" component={() => <Redirect to="/platform" />} />
      <Route path="/legacy" component={LegacyHome} />
      <Route path="/faq" component={FAQ} />
      <Route path="/about" component={() => <Redirect to="/faq" />} />
      <Route path="/services" component={() => <Redirect to="/cases" />} />
      <Route path="/book-call" component={BookCall} />
      <Route path="/cases" component={Cases} />
      <Route path="/intake/:token" component={IntakeDemo} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/platform" component={AppArea} />
      <Route path="/platform/:rest*" component={AppArea} />
      {/* Legacy CRM prefixes — redirect to the unified /platform area */}
      <Route path="/agency/:rest*" component={LegacyAppRedirect} />
      <Route path="/agency" component={LegacyAppRedirect} />
      <Route path="/subaccount/:rest*" component={LegacyAppRedirect} />
      <Route path="/subaccount" component={LegacyAppRedirect} />
      <Route path="/app/agency" component={() => <Redirect to="/platform/campaigns" />} />
      <Route path="/app/subaccount" component={() => <Redirect to="/platform/campaigns" />} />
      <Route path="/canvas" component={Canvas} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/test-table" component={Accounts} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/* Language-prefixed router                                            */
/* ------------------------------------------------------------------ */

function LanguageRouter({ lang }: { lang: Lang }) {
  useSyncLanguage(lang);

  return (
    <Suspense fallback={null}>
    <Switch>
      <Route path={`/${lang}/faq`} component={FAQ} />
      <Route path={`/${lang}/about`} component={() => <Redirect to={`/${lang}/faq`} />} />
      <Route path={`/${lang}/services`} component={() => <Redirect to={`/${lang}/cases`} />} />
      <Route path={`/${lang}/book-call`} component={BookCall} />
      <Route path={`/${lang}/cases`} component={Cases} />
      <Route path={`/${lang}/accept-invite`} component={AcceptInvite} />
      <Route path={`/${lang}/canvas`} component={Canvas} />
      <Route path={`/${lang}/privacy-policy`} component={PrivacyPolicy} />
      <Route path={`/${lang}/terms-of-service`} component={TermsOfService} />
      <Route path={`/${lang}/legacy`} component={LegacyHome} />

      {/* Home MUST be last */}
      <Route path={`/${lang}`} component={() => <Redirect to={`/${lang}/faq`} />} />

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/* Main Router                                                         */
/* ------------------------------------------------------------------ */

function Router() {
  const [location, setLocation] = useLocation();
  const { setPublicMode } = useTheme();

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

    // 1️⃣ Stored preference (explicit user choice, including "en")
    const storedLang = getStoredLang();
    if (storedLang) {
      if (storedLang !== "en") setLocation(`/${storedLang}`);
      return;
    }

    // 2️⃣ Browser language (first visit, no stored preference yet)
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

  const isAppArea =
    location.startsWith("/platform") ||
    location.startsWith("/agency") ||
    location.startsWith("/subaccount") ||
    location.startsWith("/intake/");

  /* Public pages follow system preference; CRM follows the manual toggle */
  useEffect(() => {
    setPublicMode(!isAppArea);
  }, [isAppArea, setPublicMode]);

  return (
    <div className="flex flex-col min-h-svh">
      <ScrollToTop />

      {isAppArea ? (
        /* CRM app — no navbar/footer */
        <main className="flex-grow">
          {!lang && <AppRoutes />}
        </main>
      ) : (
        /* All public pages (/, /legacy, /faq, /cases, etc.) — wrapped in
           legacy-app so indigo --primary applies to Navbar/Footer buttons
           on every public page, not just the /legacy route. */
        <div className="legacy-app flex flex-col min-h-svh">
          <WhatsAppBubbleProvider>
            <Navbar />
            <main className="flex-grow">
              {!lang && <AppRoutes />}
              {lang && <LanguageRouter lang={lang} />}
            </main>
            <Footer />
          </WhatsAppBubbleProvider>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <TooltipProvider>
        <Seo />
        <Toaster />
        <Router />
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;