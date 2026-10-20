import { useCallback, useEffect, useMemo } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMyProfile } from "@/features/settings/hooks/useMyProfile";
import { parsePrefs, patchPreferences } from "@/features/settings/components/prefsSave";
import { useAlertSettings } from "@/features/accounts/components/workspace/alerts/alertsApi";
import { buildChecklist, type OnboardingPrefs } from "./checklist";

function isStandalone(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  } catch {
    return false;
  }
}

/** Reads and writes `preferences.onboarding`. Always sends the whole merged object (the server merges top-level keys only). */
function useOnboardingPrefs() {
  const { profile, setProfile } = useMyProfile();
  const prefs = useMemo(() => (parsePrefs(profile?.preferences).onboarding ?? {}) as OnboardingPrefs, [profile?.preferences]);

  const write = useCallback(async (next: OnboardingPrefs) => {
    if (!profile) return;
    try { setProfile(await patchPreferences(profile, { onboarding: next })); } catch { /* retried on the next visit */ }
  }, [profile, setProfile]);

  return { profile, prefs, write };
}

/** Records that a client opened My receptionist or a call. No-op for the agency and once recorded. */
export function useMarkVisited(k: "receptionist" | "call") {
  const { isAgencyUser } = useWorkspace();
  const { profile, prefs, write } = useOnboardingPrefs();
  const already = !!prefs.visited?.[k];
  useEffect(() => {
    if (isAgencyUser || !profile || already) return;
    void write({ ...prefs, visited: { ...prefs.visited, [k]: true } });
  }, [isAgencyUser, profile, already]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useOnboarding() {
  const { currentAccountId } = useWorkspace();
  const { profile, prefs, write } = useOnboardingPrefs();
  const { settings, loading, error } = useAlertSettings(currentAccountId);

  const recipients = useMemo(() => [
    ...(settings?.alerts.recipients.emails ?? []).map((e) => ({ email: e.address })),
    ...(settings?.alerts.recipients.whatsapp ?? []).map((w) => ({ phone: w.number })),
  ], [settings]);

  const checklist = useMemo(() => buildChecklist({
    prefs, recipients, userEmail: profile?.email ?? null, userPhone: profile?.phone ?? null, standalone: isStandalone(),
  }), [prefs, recipients, profile?.email, profile?.phone]);

  return {
    checklist,
    // Render once the recipients query settled, even with an error (alerts then count as not done).
    ready: !!profile && (!!settings || (!loading && !!error)),
    markVisited: (k: "receptionist" | "call") => write({ ...prefs, visited: { ...prefs.visited, [k]: true } }),
    markInstalled: () => write({ ...prefs, installed: true }),
    dismiss: () => write({ ...prefs, dismissed: true }),
  };
}
