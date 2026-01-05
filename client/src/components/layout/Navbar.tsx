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

const languages = [
  { code: "EN", label: "ENGLISH", flag: "https://flagcdn.com/w20/gb.png" },
  { code: "PT", label: "PORTUGEUÊS", flag: "https://flagcdn.com/w20/br.png" },
  { code: "NL", label: "NEDERLANDS", flag: "https://flagcdn.com/w20/nl.png" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const [currentLang, setCurrentLang] = useState(languages[0]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Use Cases" },
    { href: "/about", label: "About" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm py-4"
          : "bg-transparent py-6"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img src="/SIDE LOGO Minus Top.svg" alt="Lead Awaker Logo" className="h-5 object-contain" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 font-medium h-9 px-2 hover:opacity-80 transition-opacity focus:outline-none" data-testid="button-language-selector">
                <img src={currentLang.flag} alt={currentLang.code} className="h-3.5 w-6 rounded-none object-cover shadow-sm -translate-y-[1px]" />
                <span className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{currentLang.code}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 p-1">
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setCurrentLang(lang)}
                  className="cursor-pointer flex items-center justify-between px-3 py-2 text-sm font-medium focus:bg-primary focus:text-white rounded-md transition-all"
                  data-testid={`menu-item-lang-${lang.code}`}
                >
                  <span className="flex items-center gap-3">
                    <img src={lang.flag} alt={lang.label} className="h-3.5 w-6 rounded-none object-cover shadow-sm -translate-y-[1px]" />
                    {lang.label}
                  </span>
                  {currentLang.code === lang.code && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={`text-sm font-bold transition-colors hover:text-primary ${
                location === link.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login">
            <Button variant="ghost" className="font-heading font-bold">
              Login
            </Button>
          </Link>
          <Link href="/book-demo">
            <Button className="font-heading font-bold bg-primary hover:bg-yellow-400 hover:text-black text-white shadow-lg shadow-primary/20 hover:shadow-yellow-400/35 transition-all">
              Book a Demo
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

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border p-4 flex flex-col gap-4 shadow-xl">
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className="text-lg font-medium p-2 hover:bg-muted rounded-md"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setIsOpen(false)}>
            <Button variant="ghost" className="w-full mt-2">
              Login
            </Button>
          </Link>
          <Link href="/book-demo">
            <Button className="w-full mt-2 hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/35 transition-all" onClick={() => setIsOpen(false)}>
              Book a Demo
            </Button>
          </Link>
        </div>
      )}
    </nav>
  );
}
