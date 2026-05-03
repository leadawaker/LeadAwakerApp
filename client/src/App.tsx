import { Switch, Route, useRoute, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
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

import Home from "@/pages/home";
import FAQ from "@/pages/faq";
import BookCall from "@/pages/book-call";
import TryDemo from "@/pages/try-demo";
import IntakeDemo from "@/pages/intake-demo";
import Login from "@/pages/login";
import AcceptInvite from "@/pages/AcceptInvite";

import AppArea from "@/pages/app";
import Canvas from "@/pages/canvas";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import Accounts from "@/pages/Accounts";
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
 * Keep i18n language in sync.
 * For marketing pages: uses the URL-based lang.
 * For CRM pages (agency/subaccount): respects the user's stored preference.
 */
function useSyncLanguage(lang: Lang) {
  useEffect(() => {
    // CRM pages: use stored preference instead of URL-derived lang
    const isCrmPage = window.location.pathname.startsWith("/agency") || window.location.pathname.startsWith("/subaccount");
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

function AppRoutes() {
  useSyncLanguage("en");

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/faq" component={FAQ} />
      <Route path="/about" component={() => <Redirect to="/faq" />} />
      <Route path="/services" component={() => <Redirect to="/try" />} />
      <Route path="/book-call" component={BookCall} />
      <Route path="/try" component={TryDemo} />
      <Route path="/intake/:token" component={IntakeDemo} />
      <Route path="/login" component={Login} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/agency" component={AppArea} />
      <Route path="/agency/:rest*" component={AppArea} />
      <Route path="/subaccount" component={AppArea} />
      <Route path="/subaccount/:rest*" component={AppArea} />
      <Route path="/app/agency" component={() => <Redirect to="/agency/campaigns" />} />
      <Route path="/app/subaccount" component={() => <Redirect to="/subaccount/campaigns" />} />
      <Route path="/canvas" component={Canvas} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/test-table" component={Accounts} />
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
      <Route path={`/${lang}/faq`} component={FAQ} />
      <Route path={`/${lang}/about`} component={() => <Redirect to={`/${lang}/faq`} />} />
      <Route path={`/${lang}/services`} component={() => <Redirect to={`/${lang}/try`} />} />
      <Route path={`/${lang}/book-call`} component={BookCall} />
      <Route path={`/${lang}/try`} component={TryDemo} />
      <Route path={`/${lang}/login`} component={Login} />
      <Route path={`/${lang}/accept-invite`} component={AcceptInvite} />
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
        /* Public pages — theme follows system preference. The provider wraps
           everything so pages can call useWhatsAppBubble() to hide the bubble
           (e.g. the /try success view where a stacked WA icon would be ugly). */
        <WhatsAppBubbleProvider>
          <Navbar />
          <main className="flex-grow">
            {!lang && <AppRoutes />}
            {lang && <LanguageRouter lang={lang} />}
          </main>
          <Footer />
        </WhatsAppBubbleProvider>
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