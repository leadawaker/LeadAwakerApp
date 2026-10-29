// The Voice tab's test call, above the section switch so changing sections never
// drops a call or its review (specs/voice-test-panel/design.md, "Panel scope").
// One provider holds both engines: GPT Live (useLiveCall, the /voice-demo hook,
// started as a staff test of this account's line) and ElevenLabs (useElevenTestCall).
// The engine tab and the GPT Live LLM are test-only picks
// (testPanelPrefs). Starting first waits for pending autosaves, so the call runs on
// the saved prompt. Leaving the account hangs up.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLiveCall } from "@/features/voiceDemo/useLiveCall";
import { demoCallerNumber } from "@/features/voiceDemo/demoNumber";
import { PHONE_STORAGE_KEY, VOICE_DEMO_PASSWORDS, storedVoicePassword } from "@/features/voiceDemo/door";
import type { CallState, VoiceLocale } from "@/features/voiceDemo/types";
import { flushAllAutosaves } from "../autosaveRegistry";
import { useElevenTestCall } from "../useElevenTestCall";
import type { ElevenTestError, ElevenTestStatus } from "../elevenTestState";
import type { LlmKey } from "../llmOptions";
import { SHOW_ELEVEN } from "../lineEngine";
import { testCallsKey, type VoiceLine } from "../voiceApi";
import {
  browserStorage, defaultTestPrefs, loadTestPrefs, prefsKey, saveTestPrefs,
  type TestEngine, type TestPrefs, type TestPrompt,
} from "./testPanelPrefs";

export type TestPhase = "idle" | "connecting" | "live" | "ending" | "review";

/** What the live view (Task 10) draws. ElevenLabs tools come from polling the call, not from here. */
export interface LiveView {
  startedAt: number | null;
  transcript: { role: "user" | "agent"; text: string }[];
  /** GPT Live's tools (ElevenLabs': polled). `pending` until the backend answers; `afterLines` = transcript lines when it fired. */
  tools: { id: number; name: string; result: string; ms: number | null; pending: boolean; args: unknown; afterLines: number }[];
  delaysMs: number[];
  callId: string | null;
  rates: { gptLivePerMin: number; elevenPerMin: number } | null;
}

export type TestError =
  | { engine: "elevenlabs"; key: ElevenTestError }
  | { engine: "gpt-live"; message: string };

export interface VoiceTestValue {
  /** The engine tab (GPT Live when ElevenLabs is not available here). */
  engine: TestEngine;
  setEngine(e: TestEngine): void;
  llm: LlmKey;
  setLlm(k: LlmKey): void;
  /** The voice layer this test runs on: the account's live pick, or one tried here only. */
  testPrompt: TestPrompt;
  setTestPrompt(p: TestPrompt): void;
  /** ElevenLabs tests need the agency (the relay is agency only) and a number on the line. */
  elevenAvailable: boolean;
  phase: TestPhase;
  /** The engine of the call in progress, or of the last one. */
  callEngine: TestEngine;
  /** The call in progress, or the last one, is a draft test: the ElevenLabs draft prompt, writes faked. */
  callDraft: boolean;
  /** `draft: true` (ElevenLabs only) tests the saved draft prompt instead of the live one. */
  start(opts?: { draft?: boolean }): Promise<void>;
  hangup(): void;
  reviewCallId: string | null;
  openReview(callId: string): void;
  newTest(): void;
  live: LiveView;
  error: TestError | null;
  /** The panel is the sticky right column (wide screens), not inline in Prompt & test. */
  column: boolean;
}

const VoiceTestContext = createContext<VoiceTestValue | null>(null);

export function useVoiceTest(): VoiceTestValue {
  const v = useContext(VoiceTestContext);
  if (!v) throw new Error("useVoiceTest needs a VoiceTestProvider (VoiceTab)");
  return v;
}

/** The same, or null outside a provider (the Voice tab without Prompt & test). */
export function useOptionalVoiceTest(): VoiceTestValue | null {
  return useContext(VoiceTestContext);
}

export function isCallBusy(phase: TestPhase): boolean {
  return phase === "connecting" || phase === "live" || phase === "ending";
}

type CallPhase = "idle" | "connecting" | "live" | "ending" | "ended";

function gptPhase(state: CallState, orb: string): CallPhase {
  if (state === "live") return orb === "done" ? "ending" : "live";
  return state;
}

function elevenPhase(status: ElevenTestStatus, callId: string | null): CallPhase {
  if (status === "listening" || status === "speaking") return "live";
  // Dropped after it opened: there is a call to review. Failed before: back to idle.
  if (status === "error") return callId ? "ended" : "idle";
  return status;
}

const LOCALES: VoiceLocale[] = ["en-GB", "en-US", "nl", "pt-BR", "pt-PT"];

/** The line's locale as a /voice-demo locale. The engine answers in the line's own language anyway. */
function staffLocale(locale: string | null): VoiceLocale {
  const l = (locale ?? "").trim();
  if ((LOCALES as string[]).includes(l)) return l as VoiceLocale;
  const lang = l.slice(0, 2).toLowerCase();
  return lang === "nl" ? "nl" : lang === "pt" ? "pt-BR" : "en-GB";
}

/** As /voice-demo: the number this browser last called as, else its made-up local one. */
function callerNumber(locale: VoiceLocale): string {
  try {
    const saved = localStorage.getItem(PHONE_STORAGE_KEY)?.trim();
    if (saved) return saved;
  } catch {
    /* private mode */
  }
  return demoCallerNumber(locale);
}

const RESULT_MAX = 120;
function shortResult(v: unknown): string {
  let s: string;
  try { s = typeof v === "string" ? v : JSON.stringify(v) ?? ""; } catch { s = String(v); }
  return s.length > RESULT_MAX ? `${s.slice(0, RESULT_MAX - 1)}…` : s;
}

/** The GPT Live wrap-up writes the call's transcript and recap first; then the list refreshes. */
const LIST_REFRESH_MS = 8_000;

/** After the call ends the live view stays this long, so the last tools (end_call, the recap) are seen before the review. */
export const END_HOLD_MS = 2_000;

export function VoiceTestProvider({ line, column, children }: { line: VoiceLine; column: boolean; children: ReactNode }) {
  const qc = useQueryClient();
  const { isAgencyUser } = useWorkspace();
  // Declared before the call hooks so this cleanup runs before theirs (React runs a
  // component's cleanups in order): useLiveCall's own unmount tears the connection
  // down without its wrap-up; a hang up first sends the close and wraps up.
  const hangupOnLeave = useRef<() => void>(() => {});
  const mounted = useRef(true);
  const holdTimer = useRef<number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      hangupOnLeave.current();
    };
  }, []);

  const gpt = useLiveCall();
  const eleven = useElevenTestCall(line.accountId, line.number?.id ?? 0);

  // --- picks -----------------------------------------------------------------
  const defaultsKey = JSON.stringify(defaultTestPrefs(line.number));
  const defaults = useMemo<TestPrefs>(() => JSON.parse(defaultsKey), [defaultsKey]);
  const key = prefsKey(line.accountId, line.number?.id);
  const [prefs, setPrefs] = useState<TestPrefs>(() => loadTestPrefs(browserStorage(), key, defaults));
  // The line's own setting moved (saved in the line card): follow it for that field.
  const seen = useRef({ key, defaults });
  useEffect(() => {
    if (seen.current.key === key && seen.current.defaults === defaults) return;
    seen.current = { key, defaults };
    setPrefs(loadTestPrefs(browserStorage(), key, defaults));
  }, [key, defaults]);
  const pick = useCallback((patch: Partial<TestPrefs>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      saveTestPrefs(browserStorage(), key, next, defaults);
      return next;
    });
  }, [key, defaults]);

  const elevenAvailable = SHOW_ELEVEN && isAgencyUser && !!line.number;
  // Not stored: each visit starts on the live pick, so a test never quietly runs another prompt.
  const [testPrompt, setTestPromptState] = useState<TestPrompt>("live");
  const engine: TestEngine = elevenAvailable ? prefs.engine : "gpt-live";

  // --- phase -----------------------------------------------------------------
  const [callEngine, setCallEngine] = useState<TestEngine>(engine);
  const [callDraft, setCallDraft] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  /** The call is over; the live view stays END_HOLD_MS before the review opens. */
  const [holding, setHolding] = useState(false);
  const [reviewCallId, setReviewCallId] = useState<string | null>(null);
  const [errorCleared, setErrorCleared] = useState(false);
  const starting = useRef(false);
  // Hung up while the autosaves were still flushing: the call is never started.
  const cancelled = useRef(false);

  const active: CallPhase = callEngine === "elevenlabs" ? elevenPhase(eleven.status, eleven.callId) : gptPhase(gpt.state, gpt.orbState);
  const activeCallId = callEngine === "elevenlabs" ? eleven.callId : gpt.callId;
  const activeStartedAt = callEngine === "elevenlabs" ? eleven.startedAt : gpt.startedAt;
  /** When this panel last pressed Start: a startedAt older than that is the previous call's. */
  const runStartedAt = useRef(0);

  const phase: TestPhase =
    flushing || active === "connecting" ? "connecting"
      : active === "live" ? (hangingUp ? "ending" : "live")
        : active === "ending" || holding ? "ending"
          : reviewCallId ? "review" : "idle";

  // A call that ends opens its review. One that never started (hung up or dropped while
  // connecting, or no id yet) goes back to idle.
  const prev = useRef<CallPhase>(active);
  useEffect(() => {
    const was = prev.current;
    prev.current = active;
    if (active === "idle") setHangingUp(false);
    if (active !== "ended" || was === "ended" || was === "idle") return;
    setHangingUp(false);
    const neverStarted = was === "connecting" && !(activeStartedAt && activeStartedAt >= runStartedAt.current);
    if (neverStarted) return;
    // Hold the live view a moment (the last tools land just before the end), then open the review.
    setHolding(true);
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if (!mounted.current) return;
      setHolding(false);
      setReviewCallId(activeCallId);
    }, END_HOLD_MS);
    if (callEngine === "gpt-live") {
      window.setTimeout(() => { void qc.invalidateQueries({ queryKey: testCallsKey(line.accountId) }); }, LIST_REFRESH_MS);
    }
  }, [active, activeCallId, activeStartedAt, callEngine, qc, line.accountId]);

  // --- actions ---------------------------------------------------------------
  const busy = isCallBusy(phase);

  const start = useCallback(async (opts?: { draft?: boolean }) => {
    if (starting.current || busy || !line.persona) return;
    if (engine === "elevenlabs" && !line.number) return;
    starting.current = true;
    cancelled.current = false;
    setFlushing(true);
    setErrorCleared(false);
    setReviewCallId(null);
    setHangingUp(false);
    setCallEngine(engine);
    // A draft test exists on the ElevenLabs engine only.
    setCallDraft(engine === "elevenlabs" && opts?.draft === true);
    runStartedAt.current = Date.now();
    try {
      // The call runs on the saved prompt: anything still being typed is saved first
      // (at most FLUSH_TIMEOUT_MS, so a hung save never blocks the start).
      await flushAllAutosaves();
      if (!mounted.current || cancelled.current) return;
      if (engine === "elevenlabs") {
        const run = eleven.start(opts);
        setFlushing(false); // the hook is connecting now
        await run;
      } else {
        const locale = staffLocale(line.locale);
        const run = gpt.start(
          {
            locale,
            companyName: line.persona?.companyName ?? "",
            callerNumber: callerNumber(locale),
            voice: "",
            staff: { account: line.accountId, llm: prefs.llm, prompt: testPrompt === "live" ? undefined : testPrompt },
          },
          // The door's shared word (public, told to prospects); the staff pass is what opens a client line.
          storedVoicePassword() || VOICE_DEMO_PASSWORDS[0],
        );
        setFlushing(false);
        await run;
      }
    } finally {
      starting.current = false;
      if (mounted.current) setFlushing(false);
    }
  }, [busy, engine, eleven, gpt, line.accountId, line.locale, line.number, line.persona, prefs.llm, testPrompt]);

  const hangup = useCallback(() => {
    if (flushing) { cancelled.current = true; setFlushing(false); return; }
    if (active === "live") setHangingUp(true);
    if (callEngine === "elevenlabs") eleven.hangUp();
    else gpt.hangup();
  }, [active, callEngine, eleven, flushing, gpt]);

  // useElevenTestCall ends its own session on unmount.
  hangupOnLeave.current = () => { gpt.hangup(); };

  const openReview = useCallback((callId: string) => {
    if (busy) return;
    setReviewCallId(callId);
  }, [busy]);

  const newTest = useCallback(() => {
    if (busy) return;
    setReviewCallId(null);
    setErrorCleared(true);
    if (gpt.state === "ended") gpt.reset();
  }, [busy, gpt]);

  // --- what the views read ---------------------------------------------------
  const live = useMemo<LiveView>(() => {
    const fallbackRates = gpt.options?.rates ?? null;
    if (callEngine === "elevenlabs") {
      return {
        startedAt: eleven.startedAt,
        transcript: eleven.lines,
        tools: [],
        delaysMs: eleven.delaysMs,
        callId: eleven.callId,
        rates: eleven.rates ?? fallbackRates,
      };
    }
    const spoken = gpt.turns.filter((t) => t.text.trim());
    return {
      startedAt: gpt.startedAt,
      transcript: spoken.map((t) => ({ role: t.side === "you" ? "user" : "agent", text: t.text })),
      tools: gpt.tools.map((x, id) => {
        // Drawn right after the turn that was last when it fired (counted among the lines with words).
        const at = x.afterTurnId ? gpt.turns.findIndex((t) => t.id === x.afterTurnId) : -1;
        const afterLines = at < 0 ? 0 : gpt.turns.slice(0, at + 1).filter((t) => t.text.trim()).length;
        return { id, name: x.name, result: x.pending ? "" : shortResult(x.result), ms: x.ms, pending: x.pending === true, args: x.args, afterLines };
      }),
      delaysMs: gpt.replyGaps,
      callId: gpt.callId,
      rates: fallbackRates,
    };
  }, [callEngine, eleven.startedAt, eleven.lines, eleven.callId, eleven.rates, eleven.delaysMs, gpt.options, gpt.startedAt, gpt.turns, gpt.tools, gpt.replyGaps, gpt.callId]);

  const rawError: TestError | null = callEngine === "elevenlabs"
    ? (eleven.error ? { engine: "elevenlabs", key: eleven.error } : null)
    : (gpt.error ? { engine: "gpt-live", message: gpt.error } : null);

  const value: VoiceTestValue = {
    engine,
    setEngine: (e) => { if (!busy) pick({ engine: e }); },
    llm: prefs.llm,
    setLlm: (k) => { if (!busy) pick({ llm: k }); },
    testPrompt,
    setTestPrompt: (p) => { if (!busy) setTestPromptState(p); },
    elevenAvailable,
    phase,
    callEngine,
    callDraft,
    start,
    hangup,
    reviewCallId,
    openReview,
    newTest,
    live,
    error: errorCleared ? null : rawError,
    column,
  };

  return (
    <VoiceTestContext.Provider value={value}>
      {children}
      {/* GPT Live plays her voice through this (useLiveCall attaches the remote stream). */}
      <audio ref={gpt.audioRef} autoPlay className="hidden" />
    </VoiceTestContext.Provider>
  );
}
