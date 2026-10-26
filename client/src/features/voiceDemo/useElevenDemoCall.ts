import { useCallback, useEffect, useRef, useState } from "react";
import type { PartialOptions } from "@elevenlabs/client";
import type { AIState } from "@/components/siriOrb/aiCore";
import { apiFetch } from "@/lib/apiUtils";
import { ENGINE_BASE_URL, demoTokenFromUrl } from "./engine";
import { fetchElevenDemoOptions } from "./elevenDemoOptions";
import { ease, silent, type CallLevels, type SideLevel } from "./useCallLevels";
import { browserTimezone } from "./useLiveCall";
import type {
  Booking, CallState, CallSummary, CrmReceipt, ElevenDemoOptions, EndedReason, LiveSetup, LiveToolRun, Turn,
} from "./types";

/**
 * One /voice-demo call on ElevenLabs, from the browser.
 *
 * The engine builds the call from the demo's persona and mints a WebRTC token
 * (POST /voice/eleven/demo/session, public and token-gated like the GPT-Live
 * session); the browser then talks to ElevenLabs directly with the SDK, the
 * way the Voice tab's staff test does (useElevenTestCall). Returns the same
 * shape as useLiveCall so the page's phone, transcript and CRM panels stay.
 *
 * The SDK has its own turn events, so none of useLiveCall's turn guessing is
 * needed: each message is a turn. The CRM panel stays empty: ElevenLabs calls
 * are written by the engine's post-call wrap-up, not relayed turn by turn.
 */

interface DemoSession {
  conversation_token: string;
  conversation_id: string;
  call_id: string;
  session_key: string;
  overrides: PartialOptions["overrides"];
  agent_name: string | null;
  max_seconds: number;
}

interface LiveConversation {
  endSession(): Promise<void>;
  getInputVolume(): number;
  getOutputVolume(): number;
  getInputByteFrequencyData(): Uint8Array;
  getOutputByteFrequencyData(): Uint8Array;
}

/** Only if the engine ever omits max_seconds: the minted demo default is ten minutes. */
const FALLBACK_MAX_SECONDS = 600;

/** Mean of a slice of the byte spectrum as 0..1. The SDK's bins are not labelled in Hz, so thirds of the voice half. */
function bands(freq: Uint8Array): { low: number; mid: number; high: number } {
  const n = Math.max(3, Math.floor(freq.length / 2));
  const mean = (a: number, b: number) => {
    let sum = 0;
    for (let i = a; i < b; i += 1) sum += freq[i] ?? 0;
    return b > a ? sum / ((b - a) * 255) : 0;
  };
  const third = Math.floor(n / 3);
  return { low: mean(1, third), mid: mean(third, 2 * third), high: mean(2 * third, n) };
}

/** `micMessage`: what the phone says when the browser refuses the microphone, in the call's language. */
export function useElevenDemoCall(micMessage = "Microphone access is needed for the call.") {
  const micRef = useRef(micMessage);
  micRef.current = micMessage;
  const [state, setState] = useState<CallState>("idle");
  const [orbState, setOrbState] = useState<AIState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [endedReason, setEndedReason] = useState<EndedReason>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [elevenOptions, setElevenOptions] = useState<ElevenDemoOptions | null>(null);

  const conv = useRef<LiveConversation | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const levelsRef = useRef<CallLevels>({ you: silent(), them: silent() });
  const limitTimer = useRef<number | null>(null);
  /** Why the call is ending, set before endSession so onDisconnect reports it. */
  const reasonRef = useRef<EndedReason>(null);
  /** The minted session not reported started yet: released if the run fails or is hung up. */
  const pending = useRef<{ run: number; id: string; key: string } | null>(null);
  const runId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    fetchElevenDemoOptions().then(setElevenOptions).catch(() => {
      // The gear falls back to the default voice; the call itself does not need the list.
    });
  }, []);

  const clearLimit = () => {
    if (limitTimer.current) window.clearTimeout(limitTimer.current);
    limitTimer.current = null;
  };

  const post = (path: string, body: unknown) =>
    fetch(`${ENGINE_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  /** Frees the engine's slot (and a public reservation) of a session that never opened. Fire and forget. */
  const releasePending = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    if (p) void post(`/voice/eleven/demo/session/${encodeURIComponent(p.id)}/release`, { session_key: p.key }).catch(() => {});
  }, []);
  const releaseRef = useRef(releasePending);
  releaseRef.current = releasePending;

  const readLevels = useCallback((): CallLevels => {
    const levels = levelsRef.current;
    const c = conv.current;
    if (!c) {
      levels.you = { level: ease(levels.you.level, 0), low: 0, mid: 0, high: 0 };
      levels.them = { level: ease(levels.them.level, 0), low: 0, mid: 0, high: 0 };
      return levels;
    }
    try {
      const read = (prev: SideLevel, volume: number, freq: Uint8Array): SideLevel => {
        const b = bands(freq);
        return {
          level: ease(prev.level, Math.min(1, volume)),
          low: ease(prev.low, b.low),
          mid: ease(prev.mid, b.mid),
          high: ease(prev.high, b.high),
        };
      };
      levels.you = read(levels.you, c.getInputVolume(), c.getInputByteFrequencyData());
      levels.them = read(levels.them, c.getOutputVolume(), c.getOutputByteFrequencyData());
    } catch {
      // A reading the SDK cannot give costs the wave its reactivity, never the call.
    }
    return levels;
  }, []);

  const addTurn = (side: Turn["side"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTurns((prev) => [...prev, { id: `${side}-${Date.now()}-${prev.length}`, side, text: clean, pending: false }]);
  };

  const start = useCallback(async (setup: LiveSetup, password: string) => {
    if (conv.current) return;
    const run = ++runId.current;
    const stopped = () => runId.current !== run || !mounted.current;
    setError(null);
    setState("connecting");
    setOrbState("thinking");
    setTurns([]);
    setEndedReason(null);
    setStartedAt(null);
    setCallId(null);
    reasonRef.current = null;
    try {
      // The microphone first: a denial then costs no session.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        throw new Error("mic");
      }
      if (stopped()) return;

      // Staff get no rate limit; a failure just means the ordinary limit applies.
      let adminPass: string | null = null;
      try {
        const r = await apiFetch("/api/voice-demo/pass");
        if (r.ok) adminPass = ((await r.json()) as { pass: string | null }).pass;
      } catch {
        /* no pass */
      }
      if (stopped()) return;

      const res = await post("/voice/eleven/demo/session", {
        token: demoTokenFromUrl(),
        password,
        admin_pass: adminPass,
        locale: setup.locale,
        voice: setup.voice || null,
        caller_number: setup.callerNumber || null,
        timezone: browserTimezone() ?? "Europe/Amsterdam",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (stopped()) return;
        throw new Error((data as { detail?: string })?.detail || "Could not start the call.");
      }
      const session = data as DemoSession;
      pending.current = { run, id: session.call_id, key: session.session_key };
      if (stopped()) return; // the finally releases it
      setCompany(setup.companyName);

      const { Conversation } = await import("@elevenlabs/client");
      if (stopped()) return;
      let ended = false;
      const c = await Conversation.startSession({
        conversationToken: session.conversation_token,
        connectionType: "webrtc",
        overrides: session.overrides,
        onModeChange: ({ mode }) => {
          if (stopped()) return;
          setOrbState(mode === "speaking" ? "streaming" : "listening");
        },
        onMessage: ({ message, role }) => {
          if (stopped()) return;
          addTurn(role === "user" ? "you" : "them", message);
        },
        onError: (message) => console.warn("[eleven-demo]", message),
        onDisconnect: (details) => {
          ended = true;
          if (runId.current !== run) return;
          clearLimit();
          conv.current = null;
          // An agent that ends the call itself has said goodbye.
          const reason: EndedReason = reasonRef.current
            ?? (details.reason === "error" ? "dropped" : details.reason === "agent" ? "completed" : null);
          setEndedReason(reason);
          setOrbState("done");
          setState("ended");
        },
      });
      if (stopped()) {
        if (!ended) void c.endSession();
        return;
      }
      if (ended) return;
      conv.current = c as unknown as LiveConversation;
      pending.current = null; // open: the engine's /started takes over
      setCallId(session.call_id);
      setStartedAt(Date.now());
      setState("live");
      setOrbState("listening");
      void post(`/voice/eleven/demo/session/${encodeURIComponent(session.call_id)}/started`, { session_key: session.session_key }).catch(() => {});
      clearLimit();
      const secs = session.max_seconds > 0 ? session.max_seconds : FALLBACK_MAX_SECONDS;
      limitTimer.current = window.setTimeout(() => {
        reasonRef.current = "time_limit";
        void conv.current?.endSession();
      }, secs * 1000);
    } catch (err) {
      if (stopped()) return;
      console.warn("[eleven-demo] start failed", err);
      const msg = err instanceof Error ? err.message : "";
      setState("idle");
      setOrbState("error");
      setError(msg === "mic" ? micRef.current : msg || "Could not start the call.");
    } finally {
      if (pending.current?.run === run) releasePending();
    }
  }, [releasePending]);

  const hangup = useCallback((reason: EndedReason = null) => {
    if (conv.current) {
      reasonRef.current = reason;
      setOrbState("done");
      void conv.current.endSession();
      return;
    }
    // Still connecting: cancel the start and go back to the setup.
    releasePending();
    runId.current++;
    setState("idle");
    setOrbState("idle");
  }, [releasePending]);

  const reset = useCallback(() => {
    clearLimit();
    void conv.current?.endSession();
    conv.current = null;
    setState("idle");
    setOrbState("idle");
    setTurns([]);
    setEndedReason(null);
    setError(null);
    setStartedAt(null);
    setCallId(null);
    levelsRef.current = { you: silent(), them: silent() };
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearLimit();
      releaseRef.current();
      void conv.current?.endSession();
      conv.current = null;
    };
  }, []);

  return {
    state,
    orbState,
    readLevels,
    error,
    turns,
    receipts: [] as CrmReceipt[],
    leadId: null as number | null,
    company,
    startedAt,
    summary: null as CallSummary | null,
    booking: null as Booking | null,
    endedReason,
    /** The gear's options are built by the page from these (elevenAsLiveOptions). */
    elevenOptions,
    audioRef,
    sessionId: null as string | null,
    callId,
    tools: [] as LiveToolRun[],
    replyGaps: [] as number[],
    recordingUrl: null as string | null,
    start,
    hangup,
    reset,
  };
}
