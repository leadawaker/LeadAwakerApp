import { apiFetch } from "@/lib/apiUtils";
import type { UserProfile } from "../types";

export { parsePrefs } from "@/lib/userPrefs";

/**
 * Save only the changed preference keys; the server merges `patch` into the
 * current DB value, so concurrent saves of different keys never overwrite each
 * other. Returns the updated user. Throws on a failed save so callers can revert
 * their optimistic state.
 */
export async function patchPreferences(profile: UserProfile, patch: Record<string, unknown>): Promise<UserProfile> {
  const res = await apiFetch(`/api/users/${profile.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferencesPatch: patch }),
  });
  if (!res.ok) throw new Error("Failed to save preferences");
  return res.json();
}
