import { useState } from "react";
import { useTranslation } from "react-i18next";
import { House } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PREFS_CHANGED_EVENT } from "@/hooks/useServicePageToggles";
import { useNavGateContext } from "@/components/crm/navVisibility";
import {
  LANDING_PREF_KEY,
  defaultLandingPath,
  getAllowedLandingOptions,
  getSavedLandingPath,
  writeLandingPage,
} from "@/lib/landingPage";
import type { UserProfile } from "../types";
import { patchPreferences } from "./prefsSave";
import { SettingsCard } from "./SettingsCard";

/**
 * Per-user landing page picker (all roles). Lists only pages this user can open
 * right now; saved to users.preferences.landingPage and mirrored to localStorage
 * so the `/platform` redirect resolves with no flash.
 */
export function LandingPageCard({
  profile,
  onProfileUpdated,
}: {
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
}) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  // Same visibility context as the nav bar (respects impersonation).
  const navCtx = useNavGateContext();
  const options = getAllowedLandingOptions(navCtx);
  const [value, setValue] = useState<string>(() => getSavedLandingPath(navCtx) ?? defaultLandingPath(navCtx));
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: string) => {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const updated = await patchPreferences(profile, { [LANDING_PREF_KEY]: next });
      onProfileUpdated(updated);
      writeLandingPage(next);
      window.dispatchEvent(new Event(PREFS_CHANGED_EVENT));
    } catch {
      setValue(prev);
      toast({ variant: "destructive", title: t("profile.saveFailed"), description: t("profile.saveFailedDescription") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard
      icon={House}
      title={t("profile.landingPage")}
      description={t("profile.landingPageDescription")}
      data-testid="section-landing-page"
    >
      <label htmlFor="profile-landing-page-select" className="sr-only">
        {t("profile.landingPage")}
      </label>
      <select
        id="profile-landing-page-select"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        style={{ borderRadius: "var(--r-button)", backgroundColor: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}
        className="h-10 w-full md:max-w-sm text-foreground px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 disabled:opacity-50"
        data-testid="select-landing-page"
        aria-label={t("profile.landingPage")}
      >
        {options.map((o) => (
          <option key={o.href} value={o.href}>
            {t(o.labelKey, { ns: "crm" })}
          </option>
        ))}
      </select>
    </SettingsCard>
  );
}
