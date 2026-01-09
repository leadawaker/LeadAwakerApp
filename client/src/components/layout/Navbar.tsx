import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import logoSrc from "@/assets/SIDE LOGO Minus Top.svg";

const languages = [
  { code: "en", label: "English", flag: "https://flagcdn.com/w40/gb.png", display: "EN" },
  { code: "pt", label: "Português", flag: "https://flagcdn.com/w40/br.png", display: "PT" },
  { code: "nl", label: "Nederlands", flag: "https://flagcdn.com/w40/nl.png", display: "NL" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const { t, i18n } = useTranslation("common");

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  const changeLanguage = (lang: typeof languages[0]) => {
    i18n.changeLanguage(lang.code);
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
          <Link href="/" className="flex items-center">
            <img src={logoSrc} alt="Lead Awaker Logo" className="h-5 object-contain" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 font-medium h-9 px-2 hover:opacity-80 transition-opacity focus:outline-none" data-testid="button-language-selector">
                  <img src={currentLang.flag} alt={currentLang.display} className="h-4 w-[1.35rem] rounded-none object-cover shadow-sm -translate-y-[1px]" />
                  <span className="text-[15px] font-bold tracking-wide text-muted-foreground uppercase">{currentLang.display}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 p-1">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => changeLanguage(lang)}
                    className="cursor-pointer flex items-center justify-between px-3 py-2 text-[15px] font-medium focus:bg-primary focus:text-white rounded-md transition-all"
                    data-testid={`menu-item-lang-${lang.code}`}
                  >
                    <span className="flex items-center gap-3">
                      <img src={lang.flag} alt={lang.label} className="h-4 w-[1.35rem] rounded-none object-cover shadow-sm -translate-y-[1px]" />
                      {lang.label}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`text-[15px] font-bold transition-colors hover:text-primary ${
                  location === link.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login">
              <Button variant="ghost" className="font-heading font-bold text-[15px]">
                {t("nav.login")}
              </Button>
            </Link>
            <Link href="/book-demo">
              <Button className="font-heading font-bold bg-primary hover:bg-yellow-400 hover:text-black text-white shadow-lg shadow-primary/20 hover:shadow-yellow-400/35 transition-all text-[15px]">
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

      {/* Mobile Nav - MOVED OUTSIDE */}
      {isOpen && (
        <div 
          className="md:hidden fixed left-0 right-0 bg-background/70 backdrop-blur-lg border-b border-border p-4 flex flex-col gap-4 shadow-xl z-40 transition-all duration-300"
          style={{ 
            top: scrolled ? '68px' : '80px'
          }}
        >
          {/* Language Selector - Mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-end gap-1.5 font-medium h-9 px-2 hover:opacity-80 transition-opacity focus:outline-none w-full" data-testid="button-language-selector-mobile">
                <img src={currentLang.flag} alt={currentLang.display} className="h-4 w-[1.35rem] rounded-none object-cover shadow-sm -translate-y-[1px]" />
                <span className="text-[15px] font-bold tracking-wide text-muted-foreground uppercase">{currentLang.display}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 p-1">
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => changeLanguage(lang)}
                  className="cursor-pointer flex items-center justify-between px-3 py-2 text-[15px] font-medium focus:bg-primary focus:text-white rounded-md transition-all"
                  data-testid={`menu-item-lang-mobile-${lang.code}`}
                >
                  <span className="flex items-center gap-3">
                    <img src={lang.flag} alt={lang.label} className="h-4 w-[1.35rem] rounded-none object-cover shadow-sm -translate-y-[1px]" />
                    {lang.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className="text-lg font-medium p-2 hover:bg-muted rounded-md text-right"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col items-end gap-2 mt-2">
            <Link href="/login" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-32 text-center">
                {t("nav.login")}
              </Button>
            </Link>
            <Link href="/book-demo">
              <Button className="w-32 text-center hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/35 transition-all" onClick={() => setIsOpen(false)}>
                {t("nav.bookDemo")}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
