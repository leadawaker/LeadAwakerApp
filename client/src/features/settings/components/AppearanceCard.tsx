import { useTranslation } from "react-i18next";
import { Languages, Moon, Palette, Sun, SunMoon } from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { APP_LANGUAGES } from "@/lib/languages";
import { SettingsCard } from "./SettingsCard";

const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { mode: "light", icon: Sun, labelKey: "preferences.themeLight" },
  { mode: "dark", icon: Moon, labelKey: "preferences.themeDark" },
  { mode: "system", icon: SunMoon, labelKey: "preferences.themeSystem" },
];

/**
 * Theme (Light / Dark / System) and Language. Uses the same mechanisms as the
 * nav bar profile menu: `useTheme().setThemeMode` and `i18n.changeLanguage`
 * mirrored to `localStorage.leadawaker_lang`.
 */
export function AppearanceCard() {
  const { t, i18n } = useTranslation("settings");
  const { themeMode, setThemeMode } = useTheme();
  const currentLang = i18n.language?.split("-")[0] || "en";

  const handleChangeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("leadawaker_lang", lang);
  };

  return (
    <SettingsCard
      icon={Palette}
      title={t("preferences.appearance")}
      description={t("preferences.appearanceDescription")}
      data-testid="section-appearance"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 sm:w-24 shrink-0">
          <SunMoon className="h-3 w-3" />
          {t("preferences.theme")}
        </div>
        <div className="la-seg self-start sm:self-auto max-w-full overflow-x-auto" role="radiogroup" aria-label={t("preferences.theme")}>
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.mode}
              type="button"
              role="radio"
              aria-checked={themeMode === o.mode}
              className={cn("la-seg-btn", themeMode === o.mode && "on")}
              onClick={() => setThemeMode(o.mode)}
              data-testid={`settings-theme-${o.mode}`}
            >
              <o.icon className="h-3.5 w-3.5" />
              {t(o.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 sm:w-24 shrink-0">
          <Languages className="h-3 w-3" />
          {t("language.label")}
        </div>
        <div className="la-seg self-start sm:self-auto max-w-full overflow-x-auto" role="radiogroup" aria-label={t("language.label")}>
          {APP_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="radio"
              aria-checked={currentLang === lang.code}
              className={cn("la-seg-btn", currentLang === lang.code && "on")}
              onClick={() => handleChangeLanguage(lang.code)}
              data-testid={`settings-language-${lang.code}`}
            >
              <span className="text-sm leading-none">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </SettingsCard>
  );
}
