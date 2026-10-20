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
 * theme + language, notifications, and (owner only) Owner tools. The phone My
 * profile page drops Appearance (theme and language are More tiles) and passes
 * `flat` for one surface instead of a stack of cards.
 */
export function PreferencesTab({
  profile,
  onProfileUpdated,
  showNotifications = true,
  showAppearance = true,
  flat = false,
}: {
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
  /** Hide the Notifications card when the host renders NotificationsSection itself. */
  showNotifications?: boolean;
  /** Hide theme + language (the phone has them as More tiles). */
  showAppearance?: boolean;
  /** Sections on one surface, split by spacing and eyebrow headings. */
  flat?: boolean;
}) {
  const { t } = useTranslation("settings");
  const { isOwner } = useWorkspace();

  return (
    <div className={flat ? "space-y-7" : "space-y-4"} data-testid="tab-preferences-content">
      <LandingPageCard profile={profile} onProfileUpdated={onProfileUpdated} flat={flat} />
      <TimezoneCard profile={profile} onProfileUpdated={onProfileUpdated} flat={flat} />
      {showAppearance && <AppearanceCard />}
      {showNotifications && (
        <SettingsCard icon={Bell} title={t("notifications.title")} flat={flat} data-testid="section-notifications-card">
          <NotificationsSection flat={flat} />
        </SettingsCard>
      )}
      {isOwner && <OwnerToolsCard profile={profile} onProfileUpdated={onProfileUpdated} flat={flat} />}
    </div>
  );
}
