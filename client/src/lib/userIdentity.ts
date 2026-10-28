/**
 * Who is signed in, as the nav bar and the mobile More page show it (photo, name).
 * The source is always the server user from /api/auth/me. The localStorage keys
 * below are only a same-user mirror for older readers (support chat, tasks, home);
 * they are rewritten from the server user and cleared on logout, so a browser
 * shared by two people never shows the first person's photo or name to the second.
 */

export const AVATAR_KEY = "leadawaker_user_avatar";
export const NAME_KEY = "leadawaker_user_name";
export const EMAIL_KEY = "leadawaker_user_email";
export const USER_ID_KEY = "leadawaker_user_id";
export const AVATAR_CHANGED_EVENT = "leadawaker-avatar-changed";

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SessionIdentityUser = {
  id?: number | null;
  fullName1?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export type Identity = { userId: string; name: string; email: string; avatar: string };

/** The identity of the server user, or null when nobody is signed in (or not loaded yet). */
export function identityFromUser(user: SessionIdentityUser | null | undefined): Identity | null {
  if (!user || user.id == null) return null;
  return {
    userId: String(user.id),
    name: user.fullName1?.trim() || "",
    email: user.email?.trim() || "",
    avatar: user.avatarUrl || "",
  };
}

/** Name, then email, then "User". */
export function displayName(identity: Identity | null): string {
  return identity?.name || identity?.email || "User";
}

/** Up to two initials from the first two words of a name. */
export function initialsFor(name: string): string {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

/** "Gabriel Fronza" becomes "Gabriel F.": first name plus initials of the rest. */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "User";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts
    .slice(1)
    .map((p) => p[0].toUpperCase() + ".")
    .join(" ")}`;
}

function put(s: KV, key: string, value: string) {
  if (value) s.setItem(key, value);
  else s.removeItem(key);
}

/**
 * Mirror the current server user into the legacy keys, replacing whatever a
 * previous user left there. Returns true when the stored photo changed.
 */
export function syncIdentityCache(s: KV, user: SessionIdentityUser | null | undefined): boolean {
  const identity = identityFromUser(user);
  if (!identity) return false;
  const before = s.getItem(AVATAR_KEY) || "";
  put(s, USER_ID_KEY, identity.userId);
  put(s, NAME_KEY, identity.name);
  put(s, EMAIL_KEY, identity.email);
  put(s, AVATAR_KEY, identity.avatar);
  return before !== identity.avatar;
}

/** Drop the mirrored identity (logout, expired session). Returns true when something was removed. */
export function clearIdentityCache(s: KV): boolean {
  let removed = false;
  for (const k of [AVATAR_KEY, NAME_KEY, EMAIL_KEY, USER_ID_KEY]) {
    if (s.getItem(k) !== null) removed = true;
    s.removeItem(k);
  }
  return removed;
}

type MeShape = { user?: ({ id?: number | null } & Record<string, unknown>) | null } & Record<string, unknown>;

/**
 * Patch the cached /api/auth/me with a saved profile so the nav updates at once.
 * Only the signed-in user's own record is merged; anything else returns `me` as is.
 */
export function mergeProfileIntoMe<T extends MeShape>(
  me: T | null | undefined,
  updated: SessionIdentityUser,
): T | null | undefined {
  if (!me?.user || me.user.id == null || me.user.id !== updated.id) return me;
  return {
    ...me,
    user: { ...me.user, fullName1: updated.fullName1, email: updated.email, avatarUrl: updated.avatarUrl },
  };
}
