// "Call me + prospect" ringing this browser instead of the owner's phone: a
// Telnyx WebRTC client (@telnyx/webrtc) logged in with a short-lived token from
// the engine (GET /api/voice/demo-calls/browser-token). The engine dials it like
// a phone; the call it rings is answered here at once, since the owner asked for
// it seconds before. Lives outside React: the call controls sit in a popover, and
// closing it must not drop the call. One client per tab, gone when the call ends.
import { useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/apiUtils";

export type BrowserPhoneState = "idle" | "connecting" | "waiting" | "active";

interface Snapshot { state: BrowserPhoneState; muted: boolean }

// Minimal shapes of the SDK's client and call, so its types stay in the lazy chunk.
interface RtcCall {
  state: string;
  direction: string;
  answer(params?: { audio?: boolean; video?: boolean }): Promise<void>;
  hangup(): void;
  muteAudio(): void;
  unmuteAudio(): void;
}
interface RtcClient {
  remoteElement: HTMLMediaElement | string | Function;
  on(event: string, cb: (arg: any) => void): void;
  connect(): Promise<void> | void;
  disconnect(): Promise<void> | void;
}

const READY_TIMEOUT_MS = 10_000;
// The owner's leg rings within a few seconds of the start; past this an unanswered client lets go.
const WAIT_TIMEOUT_MS = 90_000;

let client: RtcClient | null = null;
let call: RtcCall | null = null;
let audio: HTMLAudioElement | null = null;
let waitTimer: ReturnType<typeof setTimeout> | null = null;
let snap: Snapshot = { state: "idle", muted: false };
const listeners = new Set<() => void>();

function set(next: Partial<Snapshot>) {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
}

function remoteAudio(): HTMLAudioElement {
  if (!audio) {
    audio = document.createElement("audio");
    audio.autoplay = true;
    audio.style.display = "none";
    document.body.appendChild(audio);
  }
  return audio;
}

/** Lets go of the call and the client (the call ended, failed, or was never rung). */
export function hangUpBrowserPhone() {
  if (waitTimer) clearTimeout(waitTimer);
  waitTimer = null;
  const c = client;
  client = null;
  try { call?.hangup(); } catch { /* already gone */ }
  call = null;
  try { void c?.disconnect(); } catch { /* already closed */ }
  if (audio) audio.srcObject = null;
  set({ state: "idle", muted: false });
}

/**
 * Asks for the microphone, then logs this browser in and waits for the owner's
 * leg to ring it. Resolves once it is ready to be dialed; throws with a readable
 * message when the microphone is refused or the login fails. Called from the
 * click that starts the call, so the browser lets the audio play.
 */
export async function readyBrowserPhone(messages: { mic: string; login: string }): Promise<void> {
  hangUpBrowserPhone();
  set({ state: "connecting" });
  try {
    // Asked now, inside the click, so the prompt shows before anyone rings and audio may play.
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.getTracks().forEach((t) => t.stop());
    remoteAudio().play().catch(() => { /* nothing to play yet: this only unlocks playback */ });
  } catch {
    set({ state: "idle" });
    throw new Error(messages.mic);
  }
  try {
    const res = await apiFetch("/api/voice/demo-calls/browser-token");
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.login_token) throw new Error(body.message || messages.login);
    const { TelnyxRTC } = await import("@telnyx/webrtc");
    const rtc = new TelnyxRTC({ login_token: body.login_token }) as unknown as RtcClient;
    rtc.remoteElement = remoteAudio();
    client = rtc;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(messages.login)), READY_TIMEOUT_MS);
      rtc.on("telnyx.ready", () => { clearTimeout(timer); resolve(); });
      rtc.on("telnyx.error", () => { clearTimeout(timer); reject(new Error(messages.login)); });
      rtc.on("telnyx.notification", (n: { type?: string; call?: RtcCall }) => {
        if (client !== rtc || n.type !== "callUpdate" || !n.call) return;
        const c = n.call;
        if (c.state === "ringing" && c.direction === "inbound" && !call) {
          call = c;
          if (waitTimer) clearTimeout(waitTimer);
          void c.answer({ audio: true, video: false });
        } else if (c === call && c.state === "active") {
          set({ state: "active" });
        } else if (c === call && (c.state === "hangup" || c.state === "destroy")) {
          hangUpBrowserPhone();
        }
      });
      void rtc.connect();
    });
  } catch (e) {
    hangUpBrowserPhone();
    throw e instanceof Error ? e : new Error(messages.login);
  }
  set({ state: "waiting" });
  waitTimer = setTimeout(() => { if (!call) hangUpBrowserPhone(); }, WAIT_TIMEOUT_MS);
}

export function toggleBrowserMute() {
  if (!call) return;
  if (snap.muted) call.unmuteAudio();
  else call.muteAudio();
  set({ muted: !snap.muted });
}

export function useBrowserPhone(): Snapshot {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => snap,
  );
}
