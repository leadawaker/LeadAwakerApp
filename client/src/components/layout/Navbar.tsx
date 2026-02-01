import { Link, useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";

const languages = [
  { code: "en", label: "English", flag: "https://flagcdn.com/w40/gb.png", display: "EN" },
  { code: "pt", label: "Português", flag: "https://flagcdn.com/w40/br.png", display: "PT" },
  { code: "nl", label: "Nederlands", flag: "https://flagcdn.com/w40/nl.png", display: "NL" },
] as const;

type LangCode = typeof languages[number]["code"];

const SUPPORTED_LANGS: LangCode[] = ["en", "pt", "nl"];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location, setLocation] = useLocation();
  const { t, i18n } = useTranslation("common");

  /**
   * Detect language from URL
   * /pt/about -> pt
   * /about -> en
   */
  const { currentLang, pathWithoutLang } = useMemo(() => {
    const segments = location.split("/").filter(Boolean);
    const first = segments[0];

    if (SUPPORTED_LANGS.includes(first as LangCode)) {
      return {
        currentLang: first as LangCode,
        pathWithoutLang: "/" + segments.slice(1).join("/"),
      };
    }

    return {
      currentLang: "en" as LangCode,
      pathWithoutLang: location,
    };
  }, [location]);

  /**
   * Keep i18n in sync with URL
   */
  useEffect(() => {
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang);
    }
  }, [currentLang, i18n]);

  const currentLangConfig =
    languages.find((l) => l.code === currentLang) || languages[0];

  /**
   * Build language-aware links
   */
  const withLang = (path: string) => {
    if (currentLang === "en") return path;
    return `/${currentLang}${path === "/" ? "" : path}`;
  };

  /**
   * Change language + URL
   */
  const changeLanguage = (lang: LangCode) => {
    const newPath =
      lang === "en"
        ? pathWithoutLang || "/"
        : `/${lang}${pathWithoutLang === "/" ? "" : pathWithoutLang}`;

    if (lang === "en") {
      localStorage.removeItem("leadawaker_lang");
    } else {
      localStorage.setItem("leadawaker_lang", lang);
    }

    i18n.changeLanguage(lang);
    setLocation(newPath);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/services", label: t("nav.services") },
    { href: "/about", label: t("nav.about") },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
          <Link href={withLang("/")} className="flex items-center -ml-4">
            <img src="/5.SideLogo.svg" alt="Lead Awaker Logo" className="h-10 md:h-10 object-contain" data-testid="img-navbar-logo" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 font-medium h-9 px-2 hover:opacity-80 transition-opacity focus:outline-none">
                  <img
                    src={currentLangConfig.flag}
                    alt={currentLangConfig.display}
                    className="h-4 w-[1.35rem] object-cover shadow-sm"
                  />
                  <span className="text-[15px] font-bold tracking-wide text-muted-foreground uppercase">
                    {currentLangConfig.display}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 p-1">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className="cursor-pointer flex items-center gap-3 px-3 py-2 text-[15px] font-medium rounded-md"
                  >
                    <img
                      src={lang.flag}
                      alt={lang.label}
                      className="h-4 w-[1.35rem] object-cover shadow-sm"
                    />
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinks.map((link) => {
              const href = withLang(link.href);
              return (
                <Link
                  key={link.href}
                  href={href}
                  className={`text-[15px] font-bold transition-colors hover:text-primary ${
                    location === href ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <Link href={withLang("/login")}>
              <Button variant="ghost" className="font-heading font-bold text-[15px]">
                {t("nav.login")}
              </Button>
            </Link>

            <Link href={withLang("/book-demo")}>
              <Button className="font-heading font-bold bg-primary hover:bg-yellow-400 hover:text-black text-white shadow-lg shadow-primary/20 transition-all text-[15px]">
                {t("nav.bookDemo")}
              </Button>
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Nav */}
      {isOpen && (
        <div
          className="md:hidden fixed left-0 right-0 bg-background/70 backdrop-blur-lg border-b border-border p-4 flex flex-col gap-2 shadow-xl z-40"
          style={{ top: scrolled ? "68px" : "80px" }}
        >
          {/* Language Picker in Mobile Menu */}
          <div className="flex justify-end px-2 py-2 mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 transition-all hover:bg-muted">
                  <img
                    src={currentLangConfig.flag}
                    alt={currentLangConfig.display}
                    className="h-4 w-6 object-cover shadow-sm rounded-sm"
                  />
                  <span className="text-sm font-bold uppercase text-foreground">{currentLangConfig.display}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 p-1">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className="cursor-pointer flex items-center gap-3 px-3 py-2 text-[15px] font-medium rounded-md"
                  >
                    <img
                      src={lang.flag}
                      alt={lang.label}
                      className="h-4 w-[1.35rem] object-cover shadow-sm"
                    />
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {[...navLinks, { href: "/login", label: t("nav.login") }, { href: "/book-demo", label: t("nav.bookDemo") }].map((link) => (
            <Link
              key={link.href}
              href={withLang(link.href)}
              className="text-lg font-medium p-2 hover:bg-muted rounded-md text-right"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}