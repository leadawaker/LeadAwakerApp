import type { ChangeTarget } from "@shared/automationTypes";
import { setPersistedSelection } from "@/hooks/usePersistedSelection";

/** Navigate to where a setting lives. Returns false when it cannot be linked (show the hint instead). */
export function goToChangeTarget(target: ChangeTarget, accountId: number, setLocation: (to: string) => void, currentAccountId: number): boolean {
  if (target.kind === "account_tab") {
    setPersistedSelection("selected-account-id", String(accountId));
    // Fallback only: the workspace passes onOpenTab, which switches tabs without navigating.
    setLocation(`/platform/accounts?tab=${target.tab}`);
    return true;
  }
  if (target.kind === "campaign_section") {
    setPersistedSelection("selected-campaign-id", String(target.campaignId));
    setLocation(`/platform/campaigns?campaign=${target.campaignId}&section=${target.section}`);
    return true;
  }
  if (target.kind === "settings_account") {
    if (currentAccountId !== accountId) return false;
    setLocation("/platform/settings?tab=account");
    return true;
  }
  return false;
}
