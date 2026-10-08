import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { UserProfile } from "../types";
import { AppearanceCard } from "./AppearanceCard";
import { LandingPageCard } from "./LandingPageCard";
import { NotificationsSection } from "./NotificationsSection";
import { OwnerToolsCard } from "./OwnerToolsCard";
import { SettingsCard } from "./SettingsCard";
import { TimezoneCard } from "./TimezoneCard";

/**
 * Settings > Preferences: how the app behaves for you. Landing page, timezone,
 * theme + language, notifications, and (owner only) Owner tools.
 */
export function PreferencesTab({
  profile,
  onProfileUpdated,
  showNotifications = true,
}: {
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
  /** Hide the Notifications card when the host renders NotificationsSection itself. */
  showNotifications?: boolean;
}) {
  const { t } = useTranslation("settings");
  const { isOwner } = useWorkspace();

  return (
    <div className="space-y-4" data-testid="tab-preferences-content">
      <LandingPageCard profile={profile} onProfileUpdated={onProfileUpdated} />
      <TimezoneCard profile={profile} onProfileUpdated={onProfileUpdated} />
      <AppearanceCard />
      {showNotifications && (
        <SettingsCard icon={Bell} title={t("notifications.title")} data-testid="section-notifications-card">
          <NotificationsSection />
        </SettingsCard>
      )}
      {isOwner && <OwnerToolsCard profile={profile} onProfileUpdated={onProfileUpdated} />}
    </div>
  );
}
