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

/**
 * Keep i18n language in sync with URL
 */
function useSyncLanguage(lang?: string) {
  useEffect(() => {
    const nextLang: Lang = SUPPORTED_LANGS.includes(lang as Lang)
      ? (lang as Lang)
      : "en";

    if (i18n.language !== nextLang) {
      i18n.changeLanguage(nextLang);
    }
  }, [lang]);
}

/* ------------------------------------------------------------------ */
/* Routes (language-agnostic)                                          */
/* ------------------------------------------------------------------ */

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/services" component={Services} />
      <Route path="/book-demo" component={BookDemo} />
      <Route path="/login" component={Login} />
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
      <Route path={`/${lang}`} component={Home} />

      <Route path={`/${lang}/about`} component={About} />
      <Route path={`/${lang}/services`} component={Services} />
      <Route path={`/${lang}/book-demo`} component={BookDemo} />
      <Route path={`/${lang}/login`} component={Login} />
      <Route path={`/${lang}/canvas`} component={Canvas} />
      <Route path={`/${lang}/privacy-policy`} component={PrivacyPolicy} />
      <Route path={`/${lang}/terms-of-service`} component={TermsOfService} />

      <Route component={NotFound} />
    </Switch>
  );
}

/* ------------------------------------------------------------------ */
/* Main Router                                                         */
/* ------------------------------------------------------------------ */

function Router() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/:rest*");

  /* -------- Static redirect: /en -> / -------- */
  useEffect(() => {
    const redirect = stripEnPrefix(location);
    if (redirect) {
      setLocation(redirect);
    }
  }, [location, setLocation]);

  const lang = params?.lang as Lang | undefined;

  return (
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      <Navbar />

      <main className="flex-grow">
        {/* Default English (no prefix) */}
        {!lang && (
          <>
            {useSyncLanguage("en")}
            <AppRoutes />
          </>
        )}

        {/* Language-prefixed routes */}
        {lang && SUPPORTED_LANGS.includes(lang) && (
          <LanguageRouter lang={lang} />
        )}

        {/* Invalid language */}
        {lang && !SUPPORTED_LANGS.includes(lang) && <NotFound />}
      </main>

      <Footer />
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
        <Toaster />
        <Router />
        <Seo />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;