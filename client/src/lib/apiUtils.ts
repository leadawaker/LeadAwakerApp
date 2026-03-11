/** Base URL for API calls — set via VITE_API_URL in Vercel, empty locally */
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

/**
 * Authenticated fetch helper. Prefixes URL with API_BASE for cross-origin
 * deployment (Vercel → Pi). Locally API_BASE is empty so paths stay relative.
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.headers || {}),
    },
  });
}
