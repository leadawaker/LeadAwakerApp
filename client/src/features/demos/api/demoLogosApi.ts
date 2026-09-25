// Client logos for the Instagram and Reputation demos (server/routes/demoLogos.ts).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

/** Mirrors view() in server/routes/demoLogos.ts. `logoUrl` is the stored file
 *  whether or not it is switched on, so the popover can preview it. */
export interface ClientLogo {
  logoUrl: string | null;
  source: "site" | "upload" | null;
  enabled: boolean;
  websiteUrl: string | null;
  company: string;
}

const KEY = ["demo-client-logos"];

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || `Request failed (${res.status})`);
  return body as T;
}

export function useClientLogos() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await json<{ logos: Record<string, ClientLogo> }>(await apiFetch("/api/demo/client-logos"))).logos,
    staleTime: 60_000,
  });
}

function useLogoMutation<A>(niche: string, call: (arg: A) => Promise<Response>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arg: A) => json<ClientLogo>(await call(arg)),
    onSuccess: (next) => qc.setQueryData<Record<string, ClientLogo>>(KEY, (prev) => ({ ...(prev || {}), [niche]: next })),
  });
}

const base = (niche: string) => `/api/demo/clients/${encodeURIComponent(niche)}`;
const put = (url: string, body: unknown) =>
  apiFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Re-read the logo from the Client's website (replaces an upload). */
export const useFetchClientLogo = (niche: string) =>
  useLogoMutation<void>(niche, () => apiFetch(`${base(niche)}/logo/fetch`, { method: "POST" }));

/** Upload a replacement (data URL), or null to remove the logo. */
export const useUploadClientLogo = (niche: string) =>
  useLogoMutation<string | null>(niche, (dataUrl) => put(`${base(niche)}/logo`, { dataUrl }));

/** The switch: off shows the initials in every demo of this Client. */
export const useSetClientLogoEnabled = (niche: string) =>
  useLogoMutation<boolean>(niche, (enabled) => put(`${base(niche)}/logo-enabled`, { enabled }));
