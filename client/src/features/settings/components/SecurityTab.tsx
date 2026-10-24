import { useWorkspace } from "@/hooks/useWorkspace";
import type { UserProfile } from "../types";
import { SecurityCard } from "./SecurityCard";
import { SecurityLogCard } from "./SecurityLogCard";
import { TwoFactorCard } from "./TwoFactorCard";
import { TwoFactorPolicyCard } from "./TwoFactorPolicyCard";

/**
 * Settings > Security: how you sign in. Password, two-factor (folded to one
 * line), and for the Owner the team's 2FA policy and the security log.
 */
export function SecurityTab({ profile }: { profile: UserProfile }) {
  const { isOwner } = useWorkspace();
  return (
    <div className="space-y-4" data-testid="tab-security-content">
      <SecurityCard email={profile.email ?? ""} />
      <TwoFactorCard />
      {isOwner && <TwoFactorPolicyCard />}
      {isOwner && <SecurityLogCard />}
    </div>
  );
}
