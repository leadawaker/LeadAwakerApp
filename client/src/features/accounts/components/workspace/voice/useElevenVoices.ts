// The ElevenLabs voices for the Voice tab picker, with their audio previews.
// The engine's GET /voice/eleven/voices carries age, accent and a description; an
// engine that does not have it yet falls back to the options list (id, label,
// gender) with the preview file we ship in /public/voice-samples/eleven.
import { useQuery } from "@tanstack/react-query";
import { ENGINE_BASE_URL } from "@/features/voiceDemo/engine";
import type { EngineOptions, EngineVoice } from "@/features/demos/api/demoSettingsApi";

export interface ElevenVoice extends EngineVoice {
  age?: string | null;
  accent?: string | null;
  description?: string | null;
  /** A path under /voice-samples/eleven, or null when there is none. */
  preview: string | null;
}

export const elevenPreviewUrl = (id: string) => `/voice-samples/eleven/${id}.mp3`;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${ENGINE_BASE_URL}${path}`);
  if (!res.ok) throw new Error("Could not reach the voice engine.");
  return (await res.json()) as T;
}

export async function fetchElevenVoices(): Promise<ElevenVoice[]> {
  try {
    const { voices } = await get<{ voices: (EngineVoice & Partial<ElevenVoice>)[] }>("/voice/eleven/voices");
    if (Array.isArray(voices) && voices.length) return voices.map((v) => ({ ...v, preview: v.preview ?? elevenPreviewUrl(v.id) }));
  } catch { /* the engine may not have the route yet: use the options list */ }
  const opts = await get<EngineOptions>("/voice/xai/options");
  return (opts.voices.elevenlabs ?? []).map((v) => ({ ...v, preview: elevenPreviewUrl(v.id) }));
}

export function useElevenVoices(enabled: boolean) {
  return useQuery({ queryKey: ["voice-eleven-voices"], queryFn: fetchElevenVoices, enabled, staleTime: 60_000 });
}
