// One Gemini Live test call from the Voice tab's test panel (Robben experiment only).
// The engine (/voice/gemini/session) builds the prompt and mints a single-use token
// with prompt, tools and voice locked in; this hook talks to Gemini over a WebSocket
// itself. Transcripts and tool calls go to /voice/relay as the GPT Live events do
// (live.caller_turn, live.ai_turn, live.function_call), so the CRM side, the demo
// diary and the dealer stock answer exactly as they do for GPT Live.
// Spec: docs/superpowers/specs/2026-10-31-gemini-live-robben-browser-test-design.md
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { ENGINE_BASE_URL } from "../engine";
import { DEMO_ACCOUNT_ID, DEMO_CAMPAIGN_ID, browserTimezone } from "../useLiveCall";
import type { CallState, LiveToolRun, Turn } from "../types";
import { createPlayer, startMic, type MicCapture, type PcmPlayer } from "./geminiAudio";

export interface GeminiSetup {
  account: number;
  voice: string;
  callerNumber: string;
  password: string;
}

interface SessionAnswer {
  token: string;
  ws_url: string;
  model: string;
  session_id: string;
  language: string;
  greeting: string;
  max_seconds: number;
}

interface FunctionCall { id: string; name: string; args?: Record<string, unknown> }

const STOCK_TOOLS = new Set(["search_stock", "car_details"]);

export function useGeminiLiveCall() {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [tools, setTools] = useState<LiveToolRun[]>([]);
  const [replyGaps, setReplyGaps] = useState<number[]>([]);
  const [callId, setCallId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const limitRef = useRef<number | null>(null);
  const runRef = useRef(0);
  const callIdRef = useRef("");
  const sessionRef = useRef<SessionAnswer | null>(null);
  const setupRef = useRef<GeminiSetup | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  /** The turn being spoken right now, per side (its id in `turns`). */
  const openRef = useRef<{ you: string | null; them: string | null }>({ you: null, them: null });
  const callerSpokeAtRef = useRef<number | null>(null);
  const gapRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  const commitTurns = useCallback((next: Turn[]) => {
    turnsRef.current = next;
    setTurns(next);
  }, []);

  const relay = useCallback(async (event: Record<string, unknown>) => {
    try {
      const res = await fetch(`${ENGINE_BASE_URL}/voice/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callIdRef.current,
          account_id: DEMO_ACCOUNT_ID,
          campaign_id: DEMO_CAMPAIGN_ID,
          phone: setupRef.current?.callerNumber || "web",
          language: sessionRef.current?.language ?? "nl",
          timezone: browserTimezone(),
          session_id: sessionRef.current?.session_id ?? null,
          event: { at: Date.now(), ...event },
        }),
      });
      if (!res.ok) return null;
      return ((await res.json()) as { crm: Record<string, unknown> | null }).crm;
    } catch {
      return null;
    }
  }, []);

  // --- transcript -------------------------------------------------------------

  const append = useCallback((side: "you" | "them", text: string) => {
    if (!text) return;
    const open = openRef.current[side];
    if (open) {
      commitTurns(turnsRef.current.map((t) => (t.id === open ? { ...t, text: t.text + text } : t)));
      return;
    }
    const id = `${side}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    openRef.current[side] = id;
    commitTurns([...turnsRef.current, { id, side, text, pending: true }]);
  }, [commitTurns]);

  /** A turn is done: mark it and log it on the call. */
  const close = useCallback((side: "you" | "them", interrupted = false) => {
    const id = openRef.current[side];
    if (!id) return;
    openRef.current[side] = null;
    const turn = turnsRef.current.find((t) => t.id === id);
    commitTurns(turnsRef.current.map((t) => (t.id === id ? { ...t, pending: false } : t)));
    const text = turn?.text.trim();
    if (!text) return;
    if (side === "you") {
      void relay({ type: "live.caller_turn", transcript: text });
    } else {
      void relay({
        type: "live.ai_turn", transcript: text, interrupted,
        ...(gapRef.current !== null ? { reply_gap_ms: gapRef.current } : {}),
      });
      gapRef.current = null;
    }
  }, [commitTurns, relay]);

  // --- teardown and wrap-up -----------------------------------------------------

  const teardown = useCallback(() => {
    if (limitRef.current) window.clearTimeout(limitRef.current);
    limitRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onmessage = null; ws.onclose = null; ws.onerror = null;
      try { ws.close(); } catch { /* already closed */ }
    }
  }, []);

  const wrapUp = useCallback(async () => {
    const all = turnsRef.current.filter((t) => t.text.trim());
    if (!callIdRef.current || all.length === 0) return;
    try {
      await fetch(`${ENGINE_BASE_URL}/voice/live/wrap-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: setupRef.current?.password,
          language: sessionRef.current?.language ?? "nl",
          turns: all.map((t) => ({ side: t.side, text: t.text })),
          call_id: callIdRef.current,
          session_id: sessionRef.current?.session_id,
          account_id: DEMO_ACCOUNT_ID,
          generate: all.length >= 3,
          duration_s: startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : null,
        }),
      });
    } catch {
      /* the call is over; a missing recap is not worth an error */
    }
  }, []);

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    close("you");
    close("them");
    teardown();
    setState("ended");
    void wrapUp();
  }, [close, teardown, wrapUp]);

  const hangup = useCallback(() => {
    if (!startedAtRef.current) {
      // Not on the call yet (minting the token, opening the mic) or nothing running:
      // cancel any start in flight and go back to idle.
      runRef.current++;
      teardown();
      setState((s) => (s === "connecting" ? "idle" : s));
      return;
    }
    finish();
  }, [finish, teardown]);

  // --- tools ------------------------------------------------------------------

  const runTool = useCallback(async (fc: FunctionCall) => {
    const at = Date.now();
    const args = fc.args ?? {};
    const lastTurn = turnsRef.current[turnsRef.current.length - 1];
    setTools((prev) => [...prev, {
      name: fc.name, result: null, ms: null, at, callId: fc.id, args, pending: true, afterTurnId: lastTurn?.id ?? null,
    }]);
    const crm = await relay({ type: "live.function_call", name: fc.name, arguments: JSON.stringify(args), call_id: fc.id });
    let result: unknown;
    if (STOCK_TOOLS.has(fc.name)) {
      result = crm?.tool_output ?? { status: "unavailable" };
    } else if (fc.name === "book_appointment") {
      result = crm?.booked_slot
        ? { status: "booked", slot: crm.booked_slot }
        : { status: "not_booked", detail: "De agenda kon dit moment niet bevestigen. Neem een boodschap aan en zeg dat het team direct terugbelt." };
    } else {
      result = { status: "unavailable" };
    }
    const ms = Date.now() - at;
    setTools((prev) => prev.map((x) => (x.callId === fc.id ? { ...x, result, ms, pending: false } : x)));
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ toolResponse: { functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] } }));
    }
  }, [relay]);

  // --- Gemini messages ----------------------------------------------------------

  const onMessage = useCallback((msg: Record<string, any>, ws: WebSocket) => {
    if (msg.setupComplete) {
      const s = sessionRef.current!;
      const now = Date.now();
      startedAtRef.current = now;
      setStartedAt(now);
      setState("live");
      // She opens the call: the same greeting instruction GPT Live gets.
      ws.send(JSON.stringify({ realtimeInput: { text: s.greeting } }));
      limitRef.current = window.setTimeout(finish, s.max_seconds * 1000);
      return;
    }
    if (msg.toolCall?.functionCalls) {
      close("you");
      (msg.toolCall.functionCalls as FunctionCall[]).forEach((fc) => { void runTool(fc); });
    }
    if (msg.goAway) {
      // The connection is about to close (its time is up): end the call cleanly.
      window.setTimeout(finish, 1500);
    }
    const sc = msg.serverContent;
    if (!sc) return;
    if (sc.inputTranscription?.text) {
      append("you", sc.inputTranscription.text);
      callerSpokeAtRef.current = Date.now();
    }
    if (sc.interrupted) {
      playerRef.current?.flush();
      close("them", true);
    }
    const parts = sc.modelTurn?.parts as { inlineData?: { data?: string } }[] | undefined;
    if (parts?.length) {
      if (callerSpokeAtRef.current !== null) {
        const gap = Date.now() - callerSpokeAtRef.current;
        gapRef.current = gap;
        setReplyGaps((prev) => [...prev, gap]);
        callerSpokeAtRef.current = null;
      }
      close("you");
      parts.forEach((p) => { if (p.inlineData?.data) playerRef.current?.play(p.inlineData.data); });
    }
    if (sc.outputTranscription?.text) {
      close("you");
      append("them", sc.outputTranscription.text);
    }
    if (sc.turnComplete) close("them");
  }, [append, close, finish, runTool]);

  // --- start ----------------------------------------------------------------------

  const start = useCallback(async (setup: GeminiSetup) => {
    const run = ++runRef.current;
    const stale = () => run !== runRef.current;
    teardown();
    endedRef.current = false;
    setupRef.current = setup;
    sessionRef.current = null;
    openRef.current = { you: null, them: null };
    callerSpokeAtRef.current = null;
    gapRef.current = null;
    commitTurns([]);
    setTools([]);
    setReplyGaps([]);
    setError(null);
    setStartedAt(null);
    startedAtRef.current = null;
    callIdRef.current = `gem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCallId(callIdRef.current);
    setState("connecting");
    try {
      let adminPass: string | null = null;
      try {
        const r = await apiFetch("/api/voice-demo/pass");
        if (r.ok) adminPass = ((await r.json()) as { pass: string | null }).pass;
      } catch { /* the engine refuses without it */ }
      if (stale()) return;
      const res = await fetch(`${ENGINE_BASE_URL}/voice/gemini/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: setup.password, admin_pass: adminPass, account: setup.account,
          voice: setup.voice, timezone: browserTimezone(), caller_number: setup.callerNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Could not start the Gemini call.");
      if (stale()) return;
      sessionRef.current = data as SessionAnswer;

      playerRef.current = createPlayer();
      const ws = new WebSocket(`${data.ws_url}?access_token=${encodeURIComponent(data.token)}`);
      wsRef.current = ws;
      ws.onopen = async () => {
        ws.send(JSON.stringify({ setup: { model: data.model } }));
        try {
          micRef.current = await startMic((pcm) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ realtimeInput: { audio: { data: pcm, mimeType: "audio/pcm;rate=16000" } } }));
            }
          });
        } catch (err) {
          if (stale()) return;
          teardown();
          setState("idle");
          setError(err instanceof Error ? err.message : "No microphone.");
        }
      };
      ws.onmessage = async (e) => {
        try {
          const text = typeof e.data === "string" ? e.data : await (e.data as Blob).text();
          onMessage(JSON.parse(text), ws);
        } catch { /* a frame we cannot parse is not worth ending a call over */ }
      };
      ws.onerror = () => { /* onclose follows */ };
      ws.onclose = (e) => {
        if (stale() || endedRef.current) return;
        if (!startedAtRef.current) {
          teardown();
          setState("idle");
          setError(e.reason || `Gemini closed the connection (${e.code}).`);
          return;
        }
        finish();
      };
    } catch (err) {
      if (stale()) return;
      teardown();
      setState("idle");
      setError(err instanceof Error ? err.message : "Could not start the Gemini call.");
    }
  }, [commitTurns, finish, onMessage, teardown]);

  const reset = useCallback(() => {
    teardown();
    setState("idle");
    commitTurns([]);
    setTools([]);
    setReplyGaps([]);
    setError(null);
    setStartedAt(null);
    setCallId(null);
  }, [commitTurns, teardown]);

  useEffect(() => () => { runRef.current++; teardown(); }, [teardown]);

  return { state, error, turns, tools, replyGaps, callId, startedAt, start, hangup, reset };
}
