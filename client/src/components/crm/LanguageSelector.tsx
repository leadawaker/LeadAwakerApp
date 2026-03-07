import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
] as const;

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.split("-")[0] || "en";
  const current = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0];

  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("leadawaker_lang", lang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-9 min-w-[160px] px-4 rounded-lg border border-border bg-background text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
          data-testid="language-selector-trigger"
        >
          <span className="text-base leading-none">{current.flag}</span>
          <span className="flex-1 text-left">{current.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className="flex items-center gap-2 text-[13px] cursor-pointer"
            data-testid={`language-option-${lang.code}`}
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
