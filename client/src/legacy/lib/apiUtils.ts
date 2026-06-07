// TODO: set your backend base URL here (e.g. "https://api.yourapp.com")
export const API_BASE = "REPLACE_WITH_YOUR_API";

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.headers || {}),
    },
  });

  if (res.status === 401 && !url.includes("/api/auth/")) {
    localStorage.removeItem("app_auth");
    window.location.href = "/login";
  }

  return res;
}
