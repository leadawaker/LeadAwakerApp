import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, apiFetch } from "@/lib/apiUtils";
import { ENGINE_BASE_URL } from "@/features/voiceDemo/engine";

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

/** What the voice demo tab edits. Everything is optional: the engine keeps its
 *  own default for anything not set here. */
export interface VoiceDemoSettings {
  /** Locale id (en-GB, nl, pt-BR, ...) to voice id. An empty pick is removed. */
  defaultVoices?: Record<string, string>;
  passwords?: string[];
  maxCallMinutes?: number;
}

/** The locales and voices the engine actually offers, for the pickers. */
export interface EngineVoiceOptions {
  locales: { id: string; label: string; voice: string; needs_listening_test?: boolean }[];
  voices: { id: string; label: string }[];
  max_call_minutes?: number;
}

export function useEngineVoiceOptions() {
  return useQuery({
    queryKey: ["voice-live-options"],
    queryFn: async () => {
      const res = await fetch(`${ENGINE_BASE_URL}/voice/live/options`);
      if (!res.ok) throw new Error("Could not reach the voice engine.");
      return (await res.json()) as EngineVoiceOptions;
    },
    staleTime: 60_000,
  });
}

export function useSaveVoiceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: VoiceDemoSettings) =>
      json<{ settings: VoiceDemoSettings }>(await apiFetch("/api/demo-settings/voice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      // The engine caches this row for 30s, so the pickers catch up on their own.
      qc.invalidateQueries({ queryKey: ["voice-live-options"] });
    },
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
