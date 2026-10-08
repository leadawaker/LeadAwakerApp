import type { ReactNode } from "react";
import { SkeletonSettingsSection } from "@/components/ui/skeleton";
import type { UserProfile } from "../types";
import { useMyProfile } from "../hooks/useMyProfile";

/**
 * Loads the logged-in user's profile, shows a skeleton / error while it is not
 * ready, then renders `children` with the profile and its setter.
 */
export function MyProfileGate({
  testId,
  children,
}: {
  testId?: string;
  children: (profile: UserProfile, setProfile: (p: UserProfile) => void) => ReactNode;
}) {
  const { profile, setProfile, loading, error } = useMyProfile();

  return (
    <div className="space-y-4" data-testid={testId}>
      {loading ? (
        <SkeletonSettingsSection rows={4} />
      ) : error || !profile ? (
        <div className="text-sm text-destructive py-4">{error}</div>
      ) : (
        children(profile, setProfile)
      )}
    </div>
  );
}
