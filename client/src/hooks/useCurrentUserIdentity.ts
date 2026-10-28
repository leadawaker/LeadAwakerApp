import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import {
  AVATAR_CHANGED_EVENT,
  clearIdentityCache,
  identityFromUser,
  syncIdentityCache,
  type Identity,
  type SessionIdentityUser,
} from "@/lib/userIdentity";

type Me = { user: SessionIdentityUser | null } | null;

/**
 * The signed-in user's photo, name and email, read from the server user (the
 * shared /api/auth/me query), never from the browser's localStorage. Null until
 * the session answers, so another person's photo cannot flash up first.
 * Also mirrors the user into the legacy localStorage keys (and clears them when
 * the session is gone) for the readers that have not moved over yet.
 */
export function useCurrentUserIdentity(): Identity | null {
  const { data } = useQuery<Me>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 30_000,
  });
  const user = data?.user ?? null;
  const identity = useMemo(
    () => identityFromUser(user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.fullName1, user?.email, user?.avatarUrl],
  );

  useEffect(() => {
    try {
      if (user) {
        if (syncIdentityCache(localStorage, user)) window.dispatchEvent(new Event(AVATAR_CHANGED_EVENT));
      } else if (data === null && clearIdentityCache(localStorage)) {
        window.dispatchEvent(new Event(AVATAR_CHANGED_EVENT));
      }
    } catch {
      /* storage unavailable */
    }
  }, [data, user]);

  return identity;
}
