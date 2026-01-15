import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { queryClient } from "./lib/queryClient";
import i18n from "@/i18n";

import Home from "@/pages/home";
import About from "@/pages/about";
import Services from "@/pages/services";
import BookDemo from "@/pages/book-demo";
import Login from "@/pages/login";
import Canvas from "@/pages/canvas";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import NotFound from "@/pages/not-found";

const SUPPORTED_LANGS = ["en", "pt", "nl"];

function LanguageSync({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const lang = location.split("/")[1];

  if (!SUPPORTED_LANGS.includes(lang)) {
    return <Redirect to="/en" />;
  }

  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }

  return <>{children}</>;
}

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      <Navbar />

      <main className="flex-grow">
        <LanguageSync>
          <Switch>
            <Route path="/">
              <Redirect to="/en" />
            </Route>

            <Route path="/:lang" component={Home} />
            <Route path="/:lang/about" component={About} />
            <Route path="/:lang/services" component={Services} />
            <Route path="/:lang/book-demo" component={BookDemo} />
            <Route path="/:lang/login" component={Login} />
            <Route path="/:lang/canvas" component={Canvas} />
            <Route path="/:lang/privacy-policy" component={PrivacyPolicy} />
            <Route path="/:lang/terms-of-service" component={TermsOfService} />

            <Route component={NotFound} />
          </Switch>
        </LanguageSync>
      </main>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;