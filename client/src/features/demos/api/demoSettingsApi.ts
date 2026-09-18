import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, apiFetch } from "@/lib/apiUtils";

/** Mirrors GET /api/demo-settings (server/routes/demoSettings.ts). */
export interface DemoSettingsResponse {
  settings: Record<string, Record<string, unknown>>;
  /** The photo widget demos show: the uploaded one, else the bundled default. */
  widgetAvatarUrl: string;
  defaultWidgetAvatarUrl: string;
}

const KEY = ["demo-settings"];

/** Avatar paths are relative to the API origin, which is not this page's
 *  origin on the Vercel build. */
export function apiAsset(path: string): string {
  return path.startsWith("/api/") ? `${API_BASE}${path}` : path;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || `Request failed (${res.status})`);
  return body as T;
}

export function useDemoSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => json<DemoSettingsResponse>(await apiFetch("/api/demo-settings")),
  });
}

/** Upload (a data URL) or reset (null) the widget demo's agent photo. */
export function useSetWidgetAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dataUrl: string | null) =>
      json<{ widgetAvatarUrl: string }>(await apiFetch("/api/demo-settings/widget/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Launcher colour per Client (niche). `color` is what the widget demo shows:
 *  the hand-picked one, else the one detected from the screenshot. Null on
 *  both means black. */
export interface WidgetColor {
  color: string | null;
  manual: string | null;
  auto: string | null;
}

const COLORS_KEY = ["demo-widget-colors"];

export function useWidgetColors() {
  return useQuery({
    queryKey: COLORS_KEY,
    queryFn: async () =>
      (await json<{ colors: Record<string, WidgetColor> }>(await apiFetch("/api/demo/widget-colors"))).colors,
    staleTime: 60_000,
  });
}

/** Pick a colour for one Client, or null to go back to the detected one. */
export function useSetWidgetColor(niche: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (color: string | null) =>
      json<WidgetColor>(await apiFetch(`/api/demo/clients/${encodeURIComponent(niche)}/widget-color`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      })),
    onSuccess: (next) => {
      qc.setQueryData<Record<string, WidgetColor>>(COLORS_KEY, (prev) => ({ ...(prev || {}), [niche]: next }));
    },
  });
}
