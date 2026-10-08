import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { getQueryFn } from "@/lib/queryClient";
import type { UserProfile } from "../types";

type AuthMe = { user: { id?: number | null } | null } | null;

/**
 * Loads the logged-in user's own record (`GET /api/users/:id`). Shared by the
 * Profile and Preferences tabs through the react-query cache, so switching tabs
 * reuses the loaded profile instead of refetching. The id comes from the
 * authenticated session (the same cached `/api/auth/me` query useWorkspace
 * uses), never from a localStorage mirror that could belong to a previous user.
 */
export function useMyProfile() {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 30_000,
  });
  const userId = sessionQuery.data?.user?.id ?? null;

  const profileQuery = useQuery<UserProfile>({
    queryKey: ["/api/users", userId, "my-profile"],
    enabled: userId != null,
    queryFn: async () => {
      const res = await apiFetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const setProfile = useCallback(
    (p: UserProfile) => queryClient.setQueryData(["/api/users", userId, "my-profile"], p),
    [queryClient, userId],
  );

  const idError = sessionQuery.error ? (sessionQuery.error as Error).message : null;
  const loading = userId == null ? !idError && sessionQuery.isLoading : profileQuery.isLoading;
  const error = idError
    ?? (profileQuery.error ? (profileQuery.error as Error).message || "Failed to load profile" : null)
    ?? (userId == null && !loading ? "Not authenticated" : null);

  return { profile: profileQuery.data ?? null, setProfile, loading, error };
}
