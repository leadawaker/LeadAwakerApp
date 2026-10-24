// "Test ElevenLabs in the browser": the engine prepares the call a phone call
// on this line gets (POST /api/voice/eleven-test), then the
// browser talks to ElevenLabs over WebRTC with that token and opening. No
// Telnyx minute. The SDK is loaded only when a test starts, so the Voice tab
// bundle stays small.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PartialOptions } from "@elevenlabs/client";
import { apiFetch } from "@/lib/apiUtils";
import { testCallsKey } from "./voiceApi";
import { replyDelay } from "./test/liveMetrics";
import {
  elevenTestReducer, errorKeyForStatus, initialElevenTestState,
  type ElevenTestLine, type ElevenTestStatus,
} from "./elevenTestState";

interface BrowserSession {
  conversation_token: string;
  conversation_id: string;
  call_id: string;
  overrides: PartialOptions["overrides"];
  agent_name: string | null;
  max_seconds: number;
  /** USD per minute of each engine (call_costs.rates), for the live price. */
  rates?: ElevenTestRates;
}

export interface ElevenTestRates { gptLivePerMin: number; elevenPerMin: number }

interface LiveConversation { endSession(): Promise<void>; getId(): string }

/** The engine's wrap-up loads the transcript and recording first; then the test calls list refreshes. */
const REFRESH_AFTER_MS = 8_000;
/** Only if the engine ever omits max_seconds: its client call limit is 20 minutes. */
const FALLBACK_MAX_SECONDS = 1200;

function isMicDenied(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "SecurityError" || name === "NotFoundError" || name === "NotReadableError";
}

export function useElevenTestCall(accountId: number, lineId: number): {
  status: ElevenTestStatus;
  lines: ElevenTestLine[];
  error: ReturnType<typeof elevenTestReducer>["error"];
  /** The call's Voice_Calls id (`el_<conversation id>`), once the conversation has started. */
  callId: string | null;
  /** When the conversation opened (ms), for the live timer. */
  startedAt: number | null;
  rates: ElevenTestRates | null;
  /** Approximate reply delays so far (ms): the caller's last final transcript to the agent's next speech. */
  delaysMs: number[];
  start(): Promise<void>;
  hangUp(): void;
} {
  const [state, dispatch] = useReducer(elevenTestReducer, initialElevenTestState);
  const [callId, setCallId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [rates, setRates] = useState<ElevenTestRates | null>(null);
  const [delaysMs, setDelaysMs] = useState<number[]>([]);
  // When the caller's last final transcript arrived, until the agent answers it.
  const lastUserAt = useRef<number | null>(null);
  const qc = useQueryClient();
  const conv = useRef<LiveConversation | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The engine session minted by the current run that has not been reported open yet. If
  // the run fails or is hung up before that, the engine's slot is released (see release).
  const pending = useRef<{ run: number; id: string } | null>(null);
  // Bumped by every start and by a hang up while connecting: a start whose run is no
  // longer current stops at its next await (and ends a session that already opened).
  const runId = useRef(0);

  /** The agent started answering: closes the caller's open turn into one approximate delay. */
  const agentSpoke = () => {
    const ms = replyDelay(lastUserAt.current, Date.now());
    lastUserAt.current = null;
    if (ms !== null) setDelaysMs((prev) => [...prev, ms]);
  };

  const clearLimit = () => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    limitTimer.current = null;
  };

  /** Frees the engine's slot of a session that never opened, so a retry works at once instead of
   * after its 60 s deadline. Fire and forget; the engine ignores a session that already started. */
  const release = useCallback((id: string) => {
    void apiFetch(`/api/voice/eleven-test/${encodeURIComponent(id)}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    }).catch(() => {});
  }, [accountId]);

  const releasePending = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    if (p) release(p.id);
  }, [release]);
  // The unmount cleanup below runs once: it reads the latest releasePending through this.
  const releasePendingRef = useRef(releasePending);
  releasePendingRef.current = releasePending;

  const start = useCallback(async () => {
    if (busy.current || conv.current) return;
    busy.current = true;
    const run = ++runId.current;
    const stopped = () => runId.current !== run || !mounted.current;
    dispatch({ type: "start" });
    setCallId(null);
    setStartedAt(null);
    setDelaysMs([]);
    lastUserAt.current = null;
    try {
      // Ask for the microphone before the engine sets anything up: a denial then costs no session.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        if (!stopped()) dispatch({ type: "error", error: "mic" });
        return;
      }
      if (stopped()) return;

      const res = await apiFetch("/api/voice/eleven-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No caller number: the server rings "from" the tester's number on the Demos page.
        body: JSON.stringify({ accountId, lineId }),
      });
      if (stopped()) {
        // Hung up while the engine was answering: the session it minted is never used.
        if (res.ok) void res.json().then((s: BrowserSession) => release(s.conversation_id)).catch(() => {});
        return;
      }
      if (!res.ok) {
        dispatch({ type: "error", error: errorKeyForStatus(res.status) });
        return;
      }
      const session = (await res.json()) as BrowserSession;
      if (session.rates) setRates(session.rates);
      const opened = () => {
        setCallId(session.call_id || `el_${session.conversation_id}`);
        setStartedAt((v) => v ?? Date.now());
      };
      pending.current = { run, id: session.conversation_id };
      if (stopped()) return; // the finally releases the session

      const { Conversation } = await import("@elevenlabs/client");
      if (stopped()) return;
      // Set when the session drops before startSession resolves: it is then never stored.
      let ended = false;
      const c = await Conversation.startSession({
        conversationToken: session.conversation_token,
        connectionType: "webrtc",
        overrides: session.overrides,
        // A cancelled or replaced run's session must not move the panel.
        onConnect: () => { if (!stopped()) { opened(); dispatch({ type: "connected" }); } },
        onModeChange: ({ mode }) => {
          if (stopped()) return;
          if (mode === "speaking") agentSpoke();
          dispatch({ type: "mode", mode });
        },
        onMessage: ({ message, role }) => {
          if (stopped()) return;
          if (!message.trim()) return;
          if (role === "user") lastUserAt.current = Date.now();
          else agentSpoke(); // normally the speaking mode came first and this is a no-op
          dispatch({ type: "message", role, text: message });
        },
        onError: (message) => console.warn("[eleven-test]", message),
        onDisconnect: (details) => {
          ended = true;
          setTimeout(() => qc.invalidateQueries({ queryKey: testCallsKey(accountId) }), REFRESH_AFTER_MS);
          if (runId.current !== run) return; // hung up or replaced: the panel has moved on
          clearLimit();
          conv.current = null;
          dispatch(details.reason === "error" ? { type: "error", error: "dropped" } : { type: "disconnected" });
        },
      });
      if (stopped()) {
        if (!ended) void c.endSession();
        return;
      }
      if (ended) return;
      conv.current = c;
      pending.current = null; // open: the engine's /started below takes over
      opened();
      dispatch({ type: "connected" });
      // Starts the engine's time limit; the body carries the SDK's own id to compare.
      void apiFetch(`/api/voice/eleven-test/${encodeURIComponent(session.conversation_id)}/started`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: c.getId() }),
      }).catch(() => {});
      clearLimit();
      limitTimer.current = setTimeout(() => { void conv.current?.endSession(); }, (session.max_seconds > 0 ? session.max_seconds : FALLBACK_MAX_SECONDS) * 1000);
    } catch (err) {
      console.warn("[eleven-test] start failed", err);
      if (!stopped()) dispatch({ type: "error", error: isMicDenied(err) ? "mic" : "generic" });
    } finally {
      // Still pending: the session never opened (failure, hang up, or dropped before it did).
      if (pending.current?.run === run) releasePending();
      if (runId.current === run) busy.current = false;
    }
  }, [accountId, lineId, qc, release, releasePending]);

  const hangUp = useCallback(() => {
    if (conv.current) {
      void conv.current.endSession();
      return;
    }
    // Still connecting: cancel the start (it checks its run after every await) and free the button.
    if (busy.current) {
      releasePending();
      runId.current++;
      busy.current = false;
      dispatch({ type: "disconnected" });
    }
  }, [releasePending]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearLimit();
      releasePendingRef.current();
      void conv.current?.endSession();
      conv.current = null;
    };
  }, []);

  return { status: state.status, lines: state.lines, error: state.error, callId, startedAt, rates, delaysMs, start, hangUp };
}
