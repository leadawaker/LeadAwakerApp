import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Mail, MessageSquare, Building2,
  User, Receipt, CheckCircle,
  Phone, Bot,
  Users, ChevronRight, ArrowLeft, Sun, Moon, Instagram, Facebook, BookOpen,
  Palette, Languages, Cpu, ExternalLink,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme } from "@/hooks/useTheme";
import { ProfileSection } from "./ProfileSection";

type MobileHubItem = {
  id: string;
  labelKey: string;
  descKey?: string;
  icon: React.ElementType;
  agencyOnly?: boolean;
  action: "section" | "navigate" | "toggle";
  target?: string;
};

const MOBILE_HUB_ITEMS: MobileHubItem[] = [
  { id: "profile",   labelKey: "hub.profile",   descKey: "hub.profileDesc",   icon: User,        action: "section" },
  { id: "theme",     labelKey: "hub.theme",     descKey: "hub.themeDesc",     icon: Palette,     action: "section" },
  { id: "language",  labelKey: "hub.language",  descKey: "hub.languageDesc",  icon: Languages,   action: "section" },
  { id: "billing",   labelKey: "hub.billing",   descKey: "hub.billingDesc",   icon: Receipt,     action: "navigate", target: "invoices" },
  { id: "social",    labelKey: "hub.social",    descKey: "hub.socialDesc",    icon: MessageSquare, action: "section" },
  { id: "docs",      labelKey: "hub.docs",      descKey: "hub.docsDesc",      icon: BookOpen,    action: "navigate", target: "docs" },
  { id: "accounts",  labelKey: "hub.accounts",  descKey: "hub.accountsDesc",  icon: Building2,   action: "navigate", target: "accounts",      agencyOnly: true },
  { id: "prospects", labelKey: "hub.prospects", descKey: "hub.prospectsDesc", icon: Users,       action: "navigate", target: "prospects",      agencyOnly: true },
  { id: "automations", labelKey: "hub.automations", descKey: "hub.automationsDesc", icon: Cpu,   action: "navigate", target: "automation-logs", agencyOnly: true },
  { id: "prompts",   labelKey: "hub.prompts",   descKey: "hub.promptsDesc",   icon: Bot,         action: "navigate", target: "prompt-library", agencyOnly: true },
];

const SOCIAL_HUB_LINKS = [
  { label: "Instagram", handle: "@leadawaker", href: "https://www.instagram.com/leadawaker/", Icon: Instagram, color: "text-pink-600" },
  { label: "Facebook",  handle: "Lead Awaker",  href: "https://www.facebook.com/profile.php?id=61552291063345", Icon: Facebook, color: "text-blue-600" },
  { label: "Email",     handle: "gabriel@leadawaker.com", href: "mailto:gabriel@leadawaker.com", Icon: Mail, color: "text-foreground/70" },
  { label: "WhatsApp",  handle: "+(55) 84 8111-8224", href: "https://wa.me/558481118224", Icon: Phone, color: "text-emerald-600" },
];

const routePrefix = "/platform";

export function SettingsMobileHub() {
  const { t, i18n } = useTranslation("settings");
  const { isAgencyUser } = useWorkspace();
  const { isDark, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  // Mobile hub state: null = hub list, string = open section
  const [mobileSection, setMobileSection] = useState<string | null>(null);

  const renderMobileHubSectionContent = () => {
    switch (mobileSection) {
      case "profile":
        return <ProfileSection />;
      case "language": {
        const LANG_OPTIONS = [
          { code: "en", label: "English",    nativeLabel: "English",    flag: "🇬🇧" },
          { code: "pt", label: "Portuguese", nativeLabel: "Português",  flag: "🇧🇷" },
          { code: "nl", label: "Dutch",      nativeLabel: "Nederlands", flag: "🇳🇱" },
        ] as const;
        const currentLangCode = i18n.language?.split("-")[0] || "en";
        return (
          <div className="px-4 pt-4 space-y-3" data-testid="section-language">
            <p className="text-sm text-muted-foreground">{t("hub.languageDesc")}</p>
            <div className="flex flex-col gap-3">
              {LANG_OPTIONS.map((lang) => {
                const isActive = currentLangCode === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      i18n.changeLanguage(lang.code);
                      localStorage.setItem("leadawaker_lang", lang.code);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-4 rounded-2xl border-2 transition-all text-left",
                      isActive
                        ? "border-brand-indigo bg-brand-indigo/5 text-brand-indigo"
                        : "border-border text-foreground"
                    )}
                    data-testid={`language-option-${lang.code}`}
                  >
                    <span className="text-2xl leading-none">{lang.flag}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{lang.nativeLabel}</p>
                      <p className="text-xs text-muted-foreground">{lang.label}</p>
                    </div>
                    {isActive && (
                      <CheckCircle className="h-5 w-5 text-brand-indigo shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case "theme":
        return (
          <div className="px-4 pt-4 space-y-3" data-testid="section-theme">
            <p className="text-sm text-muted-foreground">{t("hub.themeDesc")}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { if (isDark) toggleTheme(); }}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all",
                  !isDark ? "border-brand-indigo bg-brand-indigo/5 text-brand-indigo" : "border-border text-muted-foreground"
                )}
                data-testid="theme-option-light"
              >
                <Sun className="h-6 w-6" />
                <span className="text-sm font-medium">{t("hub.themeLight")}</span>
              </button>
              <button
                type="button"
                onClick={() => { if (!isDark) toggleTheme(); }}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all",
                  isDark ? "border-brand-indigo bg-brand-indigo/5 text-brand-indigo" : "border-border text-muted-foreground"
                )}
                data-testid="theme-option-dark"
              >
                <Moon className="h-6 w-6" />
                <span className="text-sm font-medium">{t("hub.themeDark")}</span>
              </button>
            </div>
          </div>
        );
      case "social":
        return (
          <div className="px-4 pt-4 space-y-2" data-testid="section-social">
            {SOCIAL_HUB_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                className="flex items-center gap-3 rounded-2xl border border-border/40 px-4 py-4 hover:bg-muted/30 transition-colors min-h-[56px]"
              >
                <div className={cn("w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0", link.color)}>
                  <link.Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{link.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{link.handle}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const visibleItems = MOBILE_HUB_ITEMS.filter((item) => {
    if (item.agencyOnly && !isAgencyUser) return false;
    return true;
  });

  if (mobileSection !== null) {
    // Show section detail with back button
    const activeItem = MOBILE_HUB_ITEMS.find((i) => i.id === mobileSection);
    const Icon = activeItem?.icon ?? User;
    return (
      <div className="h-full flex flex-col overflow-hidden" data-testid="mobile-settings-section">
        {/* Section header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20 bg-background shrink-0">
          <button
            type="button"
            onClick={() => setMobileSection(null)}
            className="icon-circle-lg icon-circle-base"
            aria-label={t("hub.back")}
            data-testid="mobile-settings-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">{t(activeItem?.labelKey ?? "")}</h2>
          </div>
        </div>
        {/* Section content */}
        <div className="flex-1 overflow-y-auto pb-8">
          {mobileSection === "profile" && (
            <div className="px-4 max-w-2xl">
              <ProfileSection />
            </div>
          )}
          {mobileSection !== "profile" && renderMobileHubSectionContent()}
        </div>
      </div>
    );
  }

  // Hub list view
  return (
    <div className="h-full overflow-y-auto" data-testid="mobile-settings-hub">
      {/* Header */}
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-2xl font-semibold font-heading">{t("title")}</h1>
      </div>
      {/* Menu rows */}
      <div className="px-3 space-y-1 pb-8">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isToggle = item.action === "toggle";
          const isNav = item.action === "navigate";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (isNav && item.target) {
                  setLocation(`${routePrefix}/${item.target}`);
                } else if (isToggle) {
                  toggleTheme();
                } else {
                  setMobileSection(item.id);
                }
              }}
              className="w-full flex items-center gap-3 rounded-2xl px-4 bg-card hover:bg-card-hover transition-colors min-h-[56px] border border-border/30"
              data-testid={`mobile-hub-row-${item.id}`}
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground">
                {item.id === "theme" ? (isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />) : <Icon className="h-4 w-4" />}
              </div>
              {/* Label + desc */}
              <div className="flex-1 min-w-0 text-left py-3.5">
                <div className="text-sm font-medium text-foreground">{t(item.labelKey)}</div>
                {item.descKey && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {item.id === "theme" ? (isDark ? t("hub.themeDark") : t("hub.themeLight")) : t(item.descKey)}
                  </div>
                )}
              </div>
              {/* Right indicator */}
              {isNav ? (
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
