import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, apiFetch } from "@/lib/apiUtils";
import { ENGINE_BASE_URL } from "@/features/voiceDemo/engine";
import { fetchElevenDemoOptions } from "@/features/voiceDemo/elevenDemoOptions";
import type { DemoEngine, ElevenDemoLocale } from "@/features/voiceDemo/types";

export type { DemoEngine, ElevenDemoLocale };

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
  /** null (on a save) clears it back to the engine's default. */
  maxCallMinutes?: number | null;
  /** Numbers never greeted as returning callers (engine demo_settings.forgotten_numbers). */
  forgetNumbers?: string[];
  /** Per tester phone: which engine answers, with which voice and prompt (engine voice_engines.py). */
  engineTests?: EngineTest[];
  /** The engine per demo locale, minted and homepage demos alike. Missing = DEFAULT_DEMO_ENGINES. */
  engines?: Partial<Record<ElevenDemoLocale, DemoEngine>>;
  /** The ElevenLabs voice per demo locale. Missing = that locale's default. */
  elevenVoices?: Partial<Record<ElevenDemoLocale, string>>;
  /** "Call me + prospect" rings one of these first (E.164; null clears on a save). */
  ownerPhone?: string | null;
  ownerPhoneBackup?: string | null;
  ownerPhoneUse?: "primary" | "backup";
  /** How "Call me + prospect" puts Sara on the call (engine demo_settings.call_me_style). Missing = handoff. */
  callMeStyle?: "handoff" | "barge" | "conference";
  /** Telnyx's jitter buffer on the browser line: off, 60 to 200 ms, or 100 to 400 ms. */
  browserJitter?: "off" | "standard" | "large";
  /** Sara's line through the jitter-buffer route number; off dials her directly. */
  saraJitter?: "off" | "standard" | "large";
}

/** The engine per demo locale when nothing is saved (engine demo_settings.DEFAULT_ENGINES):
 *  ElevenLabs only wins in Dutch. */
export const DEFAULT_DEMO_ENGINES: Record<ElevenDemoLocale, DemoEngine> = {
  nl: "elevenlabs", "en-GB": "gpt-live", "en-US": "gpt-live", "pt-BR": "gpt-live",
};

/** The engine a demo in this locale runs on, from the saved voice settings. */
export function demoEngineFor(settings: VoiceDemoSettings | undefined, locale: ElevenDemoLocale): DemoEngine {
  const saved = settings?.engines?.[locale];
  return saved === "elevenlabs" || saved === "gpt-live" ? saved : DEFAULT_DEMO_ENGINES[locale];
}

/** Gabriel's phones until the settings say otherwise (server demoVoiceSchemas.ts). */
export const DEFAULT_OWNER_PHONE = "+31684446349";
export const DEFAULT_OWNER_PHONE_BACKUP = "+31737044356";

const ELEVEN_OPTIONS_KEY = ["voice-eleven-demo-options"];

/** The ElevenLabs demo voices per locale (engine GET /voice/eleven/demo/options). `enabled: false` skips the request. */
export function useElevenDemoOptions(enabled = true) {
  return useQuery({
    queryKey: ELEVEN_OPTIONS_KEY,
    queryFn: fetchElevenDemoOptions,
    staleTime: 60_000,
    enabled,
  });
}

export type VoiceEngine = "gpt-live" | "xai" | "elevenlabs";

/** One tester's engine choice. Their calls on a conference-route line only;
 *  every other caller keeps the line's own setup. */
export interface EngineTest {
  number: string;
  label?: string;
  enabled?: boolean;
  engine: VoiceEngine;
  /** That engine's own voice id; empty keeps the line's voice. */
  voice?: string;
  /** Grok only: the shared GPT-Live prompt, or the lean Grok-style one. */
  prompt?: "standard" | "lean";
  /** Grok only: empty is xAI's default ("high"). */
  reasoning?: "high" | "none";
  /** Memory off, any engine: heard as a first-time caller. Bookings still go to the diary. */
  freshCaller?: boolean;
}

export interface EngineVoice {
  id: string;
  label: string;
  gender: "female" | "male" | "neutral" | null;
}

/** GET /voice/xai/options on the engine (src/webhooks/xai_voice_routes.py). */
export interface EngineOptions {
  engines: VoiceEngine[];
  xai: { ready: boolean; missing: string[]; numbers: string[] };
  /** Optional until the engine ships ElevenLabs: the card works without it. */
  eleven?: { ready: boolean; missing: string[]; numbers: string[] };
  voices: Partial<Record<VoiceEngine, EngineVoice[]>>;
}

export function useEngineOptions() {
  return useQuery({
    queryKey: ["voice-engine-options"],
    queryFn: async () => {
      const res = await fetch(`${ENGINE_BASE_URL}/voice/xai/options`);
      if (!res.ok) throw new Error("Could not reach the voice engine.");
      return (await res.json()) as EngineOptions;
    },
    staleTime: 60_000,
  });
}

/** The locales and voices the engine actually offers, for the pickers. */
export interface EngineVoiceOptions {
  locales: { id: string; label: string; voice: string; needs_listening_test?: boolean }[];
  voices: { id: string; label: string; gender?: "female" | "male" }[];
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
      qc.invalidateQueries({ queryKey: ELEVEN_OPTIONS_KEY });
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
