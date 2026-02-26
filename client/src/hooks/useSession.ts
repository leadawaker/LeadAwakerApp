import { useEffect, useState } from "react";

export type SessionUser = {
  id: number;
  email: string | null;
  fullName: string | null;
  role: string | null;
  accountsId: number | null;
  avatarUrl: string | null;
  notificationEmail: boolean | null;
  notificationSms: boolean | null;
};

type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; user: SessionUser }
  | { status: "unauthenticated" };

/**
 * Fetches the current server session from /api/auth/me.
 * Keeps localStorage in sync so existing hooks keep working.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const { user } = await res.json();
          setState({ status: "authenticated", user });
          // Keep localStorage in sync for backward-compat hooks
          localStorage.setItem("leadawaker_auth", "session");
          localStorage.setItem("leadawaker_user_email", user.email ?? "");
          localStorage.setItem("leadawaker_user_role", user.role ?? "Viewer");
          if (user.fullName) {
            localStorage.setItem("leadawaker_user_name", user.fullName);
          }
          localStorage.setItem("leadawaker_user_avatar", user.avatarUrl ?? "");
          window.dispatchEvent(new Event("leadawaker-avatar-changed"));
          localStorage.setItem(
            "leadawaker_current_account_id",
            String(user.accountsId ?? 1),
          );
        } else {
          localStorage.removeItem("leadawaker_auth");
          setState({ status: "unauthenticated" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "unauthenticated" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Programmatic logout: calls the server endpoint and clears localStorage. */
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  localStorage.removeItem("leadawaker_auth");
  localStorage.removeItem("leadawaker_user_email");
  localStorage.removeItem("leadawaker_user_role");
  localStorage.removeItem("leadawaker_current_account_id");
}
