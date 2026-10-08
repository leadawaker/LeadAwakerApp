import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import type { UserProfile } from "../types";
import { SettingsCard } from "./SettingsCard";

const SELECT_CHEVRON =
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

/**
 * Timezone picker (Preferences tab). Saves on change through the same
 * `PATCH /api/users/:id` the profile form uses, reverting on failure.
 */
export function TimezoneCard({
  profile,
  onProfileUpdated,
}: {
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
}) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [timezone, setTimezone] = useState(profile.timezone ?? "");
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: string) => {
    const prev = timezone;
    setTimezone(next);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: next.trim() || null }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Save failed (${res.status})`);
      }
      const updated: UserProfile = await res.json();
      onProfileUpdated(updated);
      setTimezone(updated.timezone ?? "");
    } catch (err: any) {
      setTimezone(prev);
      toast({ variant: "destructive", title: t("profile.saveFailed"), description: err.message || t("profile.saveFailedDescription") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard
      icon={Globe}
      title={t("profile.timezone")}
      description={t("preferences.timezoneDescription")}
      data-testid="input-profile-timezone-wrap"
      data-onboarding="profile-timezone"
    >
      <label htmlFor="profile-timezone-select" className="sr-only" data-testid="input-profile-timezone-label">
        {t("profile.timezone")}
      </label>
      <select
        id="profile-timezone-select"
        value={timezone}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        style={{ borderRadius: "var(--r-button)", backgroundColor: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}
        className={`h-10 w-full md:max-w-sm text-foreground px-3 pr-8 text-sm appearance-none ${SELECT_CHEVRON} focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 disabled:opacity-50`}
        data-testid="select-profile-timezone"
        aria-label={t("profile.timezone")}
      >
        <option value="">{t("profile.selectTimezone")}</option>
        <option value="America/Sao_Paulo">America/Sao Paulo</option>
        <option value="Europe/Amsterdam">Europe/Amsterdam</option>
      </select>
      {timezone && (
        <p className="text-xs text-muted-foreground">
          {t("profile.currentTimezone")} <span className="font-medium text-foreground">{timezone.replace(/_/g, " ")}</span>
        </p>
      )}
    </SettingsCard>
  );
}
