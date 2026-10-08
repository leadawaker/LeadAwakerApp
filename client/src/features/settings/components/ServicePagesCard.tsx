import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  PREFS_CHANGED_EVENT,
  SERVICE_PAGE_KEYS,
  SERVICE_PAGE_PREF_KEYS,
  writeServicePageToggle,
  type ServicePageKey,
} from "@/hooks/useServicePageToggles";
import type { UserProfile } from "../types";
import { parsePrefs, patchPreferences } from "./prefsSave";

const LABEL_KEYS: Record<ServicePageKey, string> = {
  speed: "profile.servicePageSpeed",
  reputation: "profile.servicePageReputation",
  missedcall: "profile.servicePageMissedCalls",
};

/**
 * Owner-only card: switches for the service pages that are hidden by default
 * (Speed to Lead, Reputation, Missed Calls). Same persistence as "Outreach pages":
 * users.preferences + localStorage mirror + `leadawaker-prefs-changed`.
 */
export function ServicePagesCard({
  profile,
  onProfileUpdated,
}: {
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
}) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [values, setValues] = useState<Record<ServicePageKey, boolean>>(() => {
    const prefs = parsePrefs(profile.preferences);
    return {
      speed: !!prefs[SERVICE_PAGE_PREF_KEYS.speed],
      reputation: !!prefs[SERVICE_PAGE_PREF_KEYS.reputation],
      missedcall: !!prefs[SERVICE_PAGE_PREF_KEYS.missedcall],
    };
  });
  const [saving, setSaving] = useState(false);

  const handleToggle = async (key: ServicePageKey, checked: boolean) => {
    const prev = values[key];
    setValues((v) => ({ ...v, [key]: checked }));
    setSaving(true);
    try {
      const updated = await patchPreferences(profile, { [SERVICE_PAGE_PREF_KEYS[key]]: checked });
      onProfileUpdated(updated);
      writeServicePageToggle(key, checked);
      window.dispatchEvent(new Event(PREFS_CHANGED_EVENT));
    } catch {
      setValues((v) => ({ ...v, [key]: prev }));
      toast({ variant: "destructive", title: t("profile.saveFailed"), description: t("profile.saveFailedDescription") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3" data-testid="card-service-pages">
      <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        {t("profile.servicePages")}
      </div>
      <p className="text-xs text-muted-foreground">{t("profile.servicePagesDescription")}</p>
      <div className="space-y-2 pt-1">
        {SERVICE_PAGE_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between">
            <label htmlFor={`switch-service-page-${key}`} className="text-xs font-medium text-foreground">{t(LABEL_KEYS[key])}</label>
            <Switch
              id={`switch-service-page-${key}`}
              aria-label={t(LABEL_KEYS[key])}
              checked={values[key]}
              onCheckedChange={(c) => handleToggle(key, c)}
              disabled={saving}
              data-testid={`switch-service-page-${key}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
