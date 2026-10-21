/** Base URL for API calls — set via VITE_API_URL in Vercel, empty locally */
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

/**
 * Authenticated fetch helper. Prefixes URL with API_BASE for cross-origin
 * deployment (Vercel → Pi). Locally API_BASE is empty so paths stay relative.
 *
 * Automatically redirects to /login on 401 (expired or invalid session).
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.headers || {}),
    },
  });

  if (res.status === 401 && !url.includes("/api/auth/")) {
    localStorage.removeItem("leadawaker_auth");
    window.location.href = "/login";
  }

  // The require-2FA policy locks the rest of the API until the user enrolls: send them to Settings.
  if (res.status === 403 && !url.includes("/api/auth/") && !window.location.pathname.startsWith("/platform/settings")) {
    const body = await res.clone().json().catch(() => null);
    if (body?.code === "2FA_ENROLL_REQUIRED") window.location.href = "/platform/settings?tab=profile";
  }

  return res;
}
