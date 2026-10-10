// The music a caller can hear on hold while a screened transfer rings the
// owner. Ids mirror HOLD_TRACKS in the engine's hold_music.py, which also
// serves the files: the picker plays the very mp3 Telnyx plays. Titles live in
// the voiceTab namespace (transfer.holdMusic.tracks).
import { ENGINE_BASE_URL } from "@/features/voiceDemo/engine";

export const HOLD_TRACKS = [
  { id: "satie-gymnopedie-1", seconds: 55 },
  { id: "bach-air-g-string", seconds: 55 },
  { id: "pachelbel-canon-d", seconds: 58 },
  { id: "chopin-nocturne-op9-2", seconds: 55 },
  { id: "grieg-morning-mood", seconds: 45 },
  { id: "vivaldi-winter-largo", seconds: 55 },
  { id: "romance-anonimo-guitar", seconds: 55 },
] as const;

export const DEFAULT_HOLD_TRACK = "satie-gymnopedie-1";

/** How long the owner's phone rings (OWNER_RING_S in the engine's telnyx_screen.py). */
export const RING_SECONDS = 20;

// Cloudflare caches these for hours by full URL. Bump the version when a
// track's file is replaced, so nobody is played the cached old one.
const TRACKS_VERSION = 1;
export const holdTrackUrl = (id: string) => `${ENGINE_BASE_URL}/voice/phone/hold/${id}.mp3?v=${TRACKS_VERSION}`;

/** A saved id that is still on the list, else the default. */
export const holdTrack = (id: string | null | undefined) =>
  HOLD_TRACKS.some((t) => t.id === id) ? (id as string) : DEFAULT_HOLD_TRACK;
