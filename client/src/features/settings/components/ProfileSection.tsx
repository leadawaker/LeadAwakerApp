import { MyProfileGate } from "./MyProfileGate";
import { PreferencesTab } from "./PreferencesTab";
import { ProfileTab } from "./ProfileTab";

/**
 * Everything personal in one stack: the Profile tab followed by the Preferences
 * tab. Used by the mobile More page sheet; desktop Settings renders the two tabs
 * separately (`/platform/settings?tab=profile|preferences`).
 *
 * Notifications are left out by default because the mobile sheet renders
 * <NotificationsSection /> right after this; pass `includeNotifications` to add them.
 */
export function ProfileSection({ includeNotifications = false }: { includeNotifications?: boolean } = {}) {
  return (
    <MyProfileGate testId="section-profile">
      {(profile, setProfile) => (
        <>
          <ProfileTab profile={profile} onProfileUpdated={setProfile} />
          <PreferencesTab profile={profile} onProfileUpdated={setProfile} showNotifications={includeNotifications} />
        </>
      )}
    </MyProfileGate>
  );
}
