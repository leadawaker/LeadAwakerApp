/**
 * Authenticated fetch helper. All API calls go through the Vite proxy
 * (which forwards /api/* to the Express server on port 5001).
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.headers || {}),
    },
  });
}
