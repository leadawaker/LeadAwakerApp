import { useCallback, useEffect, useRef, useState } from "react";
import type { AIState } from "@/components/siriOrb/aiCore";
import { useCallLevels } from "./useCallLevels";
import { ENGINE_BASE_URL } from "./engine";
import { createReplyGapTracker } from "./replyGap";
import { apiFetch } from "@/lib/apiUtils";
import type {
  Booking,
  CallState,
  CallSummary,
  CrmReceipt,
  EndedReason,
  LiveOptions,
  LiveSetup,
  LiveToolRun,
  Turn,
  VoiceLocale,
} from "./types";

/**
 * One GPT-Live call, from the browser.
 *
 * The Realtime hook this replaces spent most of its length reconstructing turns
 * from a stream of `response.*` events: reserving bubbles, merging split
 * response items, estimating when she had finished speaking so the farewell
 * could land before the hangup. None of that is here, because none of it is
 * expressible: GPT-Live is full duplex and emits neither a turn-completed nor
 * an audio-done event. Transcripts arrive as deltas that simply stop.
 *
 * So a "turn" here is a working definition rather than something the API hands
 * us: text accumulates per side and is closed after a pause (see TURN_GAP_MS).
 * That boundary is only ever used for the CRM and the transcript bubbles. It is
 * never used to decide when to speak, which is entirely the model's business
 * now.
 */

export { ENGINE_BASE_URL };

export const DEMO_ACCOUNT_ID = 1;
export const DEMO_CAMPAIGN_ID = 60;

/**
 * A side's turn is closed this long after its last transcript delta. Long
 * enough to ride out the gap between clauses, short enough that the CRM row
 * appears while the prospect is still watching the panel. Tuned by eye, not by
 * anything the API tells us.
 */
const TURN_GAP_MS = 1400;

// The car tools a staff test of a dealer line gets (engine browser_stock.py): their
// result is the engine's, passed back to the backend as is.
const STOCK_TOOLS = new Set(["car_details", "rdw_plate_lookup", "search_stock"]);

/** Hard stop, so an abandoned tab cannot bill a session indefinitely. */
export const MAX_CALL_MS = 5 * 60 * 1000;

/** The limit the Demos page set, if the options call answered before this one. */
const limitMsRef = { current: MAX_CALL_MS };

/**
 * A landing-page website demo carries its own per-session limit, which the
 * engine also enforces with a server-side hangup; this keeps the page's timer
 * in step with it.
 */
export function setCallLimitMinutes(mins: number): void {
  if (mins >= 1 && mins <= 30) limitMsRef.current = mins * 60_000;
}

/** The limit in force right now: the configured one, else the built-in five minutes. */
export function callLimitMs(): number {
  return limitMsRef.current;
}

/**
 * Hang up after this long with neither side saying anything.
 *
 * The only reliable way to end a GPT-Live call. She says goodbye readily and
 * then does nothing: the voice layer cannot call `end_call` itself, it can only
 * choose to delegate, and at the end of a call it reliably does not. So the
 * line stayed open after she had already signed off. Long enough that a caller
 * thinking about their answer is not cut off, short enough that a goodbye is
 * not followed by an awkward wait.
 */
const SILENCE_MS = 12 * 1000;
const SILENCE_TICK_MS = 2000;

/**
 * How long to wait after she has actually said goodbye.
 *
 * Twelve seconds of dead air after "até breve" reads as a call that failed to
 * end, which is the last thing a prospect should be left with. Once a farewell
 * is on the transcript the call is over in every sense except the connection,
 * so the only thing left to wait for is the caller saying something that takes
 * it back ("actually, one more thing"). Three seconds covers that; more is just
 * the prospect staring at a live call nobody is on.
 */
const FAREWELL_SILENCE_MS = 3000;

/**
 * How long the microphone stays muted at the start of a call, so she can get
 * her greeting out.
 *
 * GPT-Live is full duplex and exposes no turn-detection settings at all: there
 * is no VAD threshold, no silence duration, nothing. She simply does not take
 * the floor while she can hear a caller, and a real room is never silent, so
 * the greeting we ask for is heard as an interruption of someone already
 * talking and never arrives. Demos opened with the prospect saying "hello?"
 * into a void.
 *
 * Muting the caller for the first moment of the call gives her the true silence
 * she is waiting for. It ends the instant she starts speaking, so in practice
 * the mic is live again before anyone has drawn breath.
 */
const GREETING_FLOOR_MS = 2500;

/**
 * How long to wait for her to open the call before asking a second time.
 *
 * The opening instruction is appended when the data channel opens, about half
 * a second before `session.started`, and an append that lands before the
 * session is running is simply lost: the call then sits in silence until the
 * prospect says "hello?". Long enough that she is genuinely not coming rather
 * than merely slow, so a greeting already under way is never doubled.
 */
const GREETING_RETRY_MS = 2500;

/**
 * How many times to ask before leaving the opening to the caller. One retry
 * was not enough: on 2026-10-21 a vesper call never acked the first append,
 * the retry cued commentary for instructions she had never accepted, and the
 * call sat silent. Each retry now re-sends the append too when no ack came.
 */
const GREETING_MAX_ATTEMPTS = 4;

/** Correlates the greeting's ack (and any refusal) with the event that asked. */
const GREETING_EVENT_ID = "greeting_1";

/**
 * Her signing off, in the six languages the demo speaks.
 *
 * Deliberately only the unambiguous forms. Dutch "dag" is both "goodbye" and
 * "day", and Portuguese "boa tarde" is a greeting as often as a farewell, so
 * neither is here: hanging up on a caller mid-sentence is a far worse failure
 * than waiting out the silence timer, and the timer is already the safety net
 * behind this.
 */
const FAREWELL_RE =
  /\b(goodbye|bye now|take care|have a (good|great|lovely) (day|evening)|speak soon|até breve|ate breve|até logo|ate logo|até mais|ate mais|tchau|tenha um (bom|ótimo) dia|tot ziens|tot snel|fijne dag|prettige dag|hasta luego|adiós|adios|que tenga un buen día)\b/i;

function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** A tool call's arguments as the object the model sent; the raw string if it is not JSON. */
function parseToolArgs(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return { raw: (raw ?? "").slice(0, 1000) };
  }
}

interface LiveEvent {
  type?: string;
  delta?: string;
  reason?: string;
  session?: { id?: string };
  usage?: { seconds?: number };
  error?: { message?: string; type?: string; code?: string; client_event_id?: string };
  /** On an ack, the `event_id` of the client event it answers. */
  client_event_id?: string;
  event?: { type?: string; item?: ToolItem; response?: { usage?: TokenUsage } };
}

/** A Responses-API usage block, as the backend reports it on response.completed. */
interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
}

interface ToolItem {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
}

export function useLiveCall() {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [receipts, setReceipts] = useState<CrmReceipt[]>([]);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [endedReason, setEndedReason] = useState<EndedReason>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  /**
   * State, not just the ref, because the recording link is rendered: OpenAI
   * keeps a stereo WAV of each call (caller left, her right) for 30 days when
   * `store` is on, which it is.
   */
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [options, setOptions] = useState<LiveOptions | null>(null);
  /** For the Voice tab's test panel: the call's id, the tools run and her reply delays so far. */
  const [callId, setCallId] = useState<string | null>(null);
  const [tools, setTools] = useState<LiveToolRun[]>([]);
  const [replyGaps, setReplyGaps] = useState<number[]>([]);
  /**
   * Bumped by every start, by a hang up while connecting and on unmount: a start
   * whose run is no longer current stops at its next await and closes what it opened.
   */
  const runRef = useRef(0);
  /** From `start` until its session answer is in: a hang up then cancels the start. */
  const connectingRef = useRef(false);
  /** Drives the orb. Derived from what is happening, not from an API event. */
  const [orbState, setOrbState] = useState<AIState>("idle");

  const { attach, read: readLevels, reset: resetAmplitude } = useCallLevels();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string>("");
  /** A staff test (setup.staff, or an old ?line= / ?account= Test link): only then is each tool relayed for the review. */
  const staffTestRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const localeRef = useRef<VoiceLocale>("en-GB");
  const languageRef = useRef<string>("en");
  const callerRef = useRef<string>("");
  /** Held so the wrap-up call after hangup can authenticate like any other. */
  const passwordRef = useRef<string>("");
  const limitRef = useRef<number | null>(null);
  const silenceRef = useRef<number | null>(null);
  const lastHeardRef = useRef<number>(0);
  /** Set once she has signed off, so the hangup no longer waits out SILENCE_MS. */
  const farewellRef = useRef<boolean>(false);
  /** The caller's own track, held so the greeting can have the floor. */
  const micRef = useRef<MediaStreamTrack | null>(null);
  const unmuteRef = useRef<number | null>(null);
  /**
   * The transcript as of right now. `hangup` runs from timers and from the
   * data channel, where a captured `turns` would be whatever it was when the
   * handler was created.
   */
  const turnsRef = useRef<Turn[]>([]);
  const summaryRef = useRef<CallSummary | null>(null);
  /** Guards wrapUp against running twice (the hangup timer and session.closed can both call it). */
  const wrappedUpRef = useRef(false);
  /**
   * The opening line, composed by the engine because it needs the company and
   * what the company does. Arrives with the SDP answer, i.e. always before the
   * data channel opens, so it is in place by the time session.started fires.
   */
  const greetingRef = useRef<string>("");
  /** The engine's greeting cue, in the call's language (English if absent). */
  const cueRef = useRef<string>("");
  /** Set once the opening instruction has gone out, so it is sent only once. */
  const greetedRef = useRef(false);
  /** Set the moment she says anything, which is what tells us the greeting landed. */
  const spokeRef = useRef(false);
  /** Set once the commentary cue has gone out, so it goes out only once. */
  const cuedRef = useRef(false);
  /** Set when `session.instructions.appended` acks the opening instruction. */
  const ackedRef = useRef(false);
  const retryRef = useRef<number | null>(null);

  /**
   * What a staff test reviews afterwards (reply delays, tool latency, price). Sent
   * with the relay posts and the wrap-up; the engine keeps them only for a staff
   * test and ignores them on a prospect demo.
   */
  const startedAtRef = useRef<number>(0);
  const liveUsageRef = useRef<{ seconds: number } | null>(null);
  const backendUsageRef = useRef<Required<Pick<TokenUsage, "input_tokens" | "output_tokens">> & {
    input_tokens_details: { cached_tokens: number };
  }>({ input_tokens: 0, output_tokens: 0, input_tokens_details: { cached_tokens: 0 } });
  /** When the caller's transcript last grew, until her next turn begins (replyGap.ts). */
  const replyTrackerRef = useRef(createReplyGapTracker());
  /** Caller's last transcript to her first words, held until her turn is relayed. */
  const replyGapRef = useRef<number | null>(null);
  /** When each side's current turn began (its first delta). */
  const turnAtRef = useRef<{ you: number; them: number }>({ you: 0, them: 0 });
  /** The caller spoke while she was still talking. Held until her turn is relayed. */
  const interruptedRef = useRef(false);
  const lastThemAtRef = useRef<number>(0);

  /** Text accumulating for each side, plus the timer that will close it. */
  const bufRef = useRef<{ you: string; them: string }>({ you: "", them: "" });
  const timerRef = useRef<{ you: number | null; them: number | null }>({ you: null, them: null });
  /** The transcript bubble currently being written into, per side. */
  const bubbleRef = useRef<{ you: string | null; them: string | null }>({ you: null, them: null });

  useEffect(() => {
    fetch(`${ENGINE_BASE_URL}/voice/live/options`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const opts = d as LiveOptions;
        setOptions(opts);
        const mins = opts.max_call_minutes;
        if (typeof mins === "number" && mins >= 1 && mins <= 30) limitMsRef.current = mins * 60_000;
      })
      .catch(() => {
        // The setup screen falls back to its own defaults; a demo that cannot
        // reach the options endpoint should still be able to place a call.
      });
  }, []);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const send = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify(event));
  }, []);

  // --- CRM ------------------------------------------------------------------

  const relay = useCallback(async (event: Record<string, unknown>) => {
    try {
      const res = await fetch(`${ENGINE_BASE_URL}/voice/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callIdRef.current,
          account_id: DEMO_ACCOUNT_ID,
          campaign_id: DEMO_CAMPAIGN_ID,
          phone: callerRef.current || "web",
          language: languageRef.current,
          timezone: browserTimezone(),
          session_id: sessionIdRef.current,
          event: { at: Date.now(), ...event },
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { crm: CrmReceipt | null };
      const crm = data.crm;
      if (!crm) return null;
      setReceipts((prev) => [...prev, crm]);
      if (crm.lead_id) setLeadId(crm.lead_id);
      if (crm.summary) {
        const incoming = crm.summary;
        setSummary((prev) => {
          const next = {
            name: incoming.name ?? prev?.name,
            items: incoming.items ?? prev?.items ?? [],
          };
          summaryRef.current = next;
          return next;
        });
      }
      if (crm.booked_slot) {
        setBooking({ spoken: crm.booked_slot, iso: crm.booked_iso ?? null });
      }
      return crm;
    } catch {
      // The CRM panel is a demo surface: losing a row to a flaky network must
      // never take the call down with it.
      return null;
    }
  }, []);

  /** Hand the microphone back, whether she greeted or not. */
  const openMic = useCallback(() => {
    if (unmuteRef.current) window.clearTimeout(unmuteRef.current);
    unmuteRef.current = null;
    if (micRef.current) micRef.current.enabled = true;
  }, []);

  /**
   * Ask her to open the call, the way the GPT-Live guide documents it.
   *
   * Two events, not one. `session.instructions.append` carries the wording and
   * is acked with `session.instructions.appended`; the ack means "accepted",
   * not "spoken". What makes her take the floor is a second event,
   * `session.commentary.append`, sent once that ack arrives.
   *
   * Sent on `session.started`, not on the data channel opening. The guide is
   * explicit: wait for `session.started` before sending application commands.
   * This used to fire about half a second earlier, on `dc.onopen`, to save
   * dead air, which is outside the contract and has no ack path: that is why
   * she opened the call on some calls and sat in silence on others until the
   * caller said hello.
   *
   * GPT-Live has no `response.create` for speech (it exists, but drives the
   * delegated backend) and no turn-detection settings at all, so this pair is
   * the whole mechanism.
   */
  const greet = useCallback(() => {
    if (greetedRef.current || !greetingRef.current) return;
    greetedRef.current = true;
    if (micRef.current) {
      micRef.current.enabled = false;
      unmuteRef.current = window.setTimeout(openMic, GREETING_FLOOR_MS);
    }
    // GPT-Live has no response.create-to-greet. The documented way to make
    // her open the call is to append an instruction naming the language
    // explicitly: OpenAI's guidance is not to let her infer it from a name or
    // a number.
    send({
      type: "session.instructions.append",
      event_id: GREETING_EVENT_ID,
      delegation_id: null,
      content: greetingRef.current,
    });
    void relay({ type: "live.greeting_sent", attempt: 1, chars: greetingRef.current.length });
  }, [openMic, relay, send]);

  /**
   * The cue that turns accepted instructions into a spoken turn. Commentary is
   * "information the model should say aloud", which it may reword; the wording
   * it should keep went in the instructions above.
   */
  const cueGreeting = useCallback(() => {
    if (cuedRef.current || spokeRef.current) return;
    cuedRef.current = true;
    send({
      type: "session.commentary.append",
      event_id: `${GREETING_EVENT_ID}_cue`,
      delegation_id: null,
      content: cueRef.current || "Begin the conversation now, following the instructions provided.",
    });
    void relay({ type: "live.greeting_cued" });
  }, [relay, send]);

  // --- transcript -----------------------------------------------------------

  const flush = useCallback(
    (side: "you" | "them") => {
      const text = bufRef.current[side].trim();
      bufRef.current[side] = "";
      bubbleRef.current[side] = null;
      timerRef.current[side] = null;
      if (!text) return;
      if (side === "them") {
        // Tested on the whole turn rather than each delta, which can split a
        // word across two frames.
        if (FAREWELL_RE.test(text)) farewellRef.current = true;
      } else {
        // They spoke again, so it was not the end after all.
        farewellRef.current = false;
      }
      if (side === "you") {
        void relay({ type: "live.caller_turn", transcript: text, at: turnAtRef.current.you });
      } else {
        void relay({
          type: "live.ai_turn",
          transcript: text,
          at: turnAtRef.current.them,
          // Absent on her opening line: nobody had spoken yet.
          ...(replyGapRef.current !== null ? { reply_gap_ms: replyGapRef.current } : {}),
          interrupted: interruptedRef.current,
        });
        replyGapRef.current = null;
        interruptedRef.current = false;
      }
    },
    [relay],
  );

  const appendDelta = useCallback(
    (side: "you" | "them", delta: string) => {
      if (!delta) return;
      // She has the floor: the greeting is under way, so the caller can have
      // their microphone back well before they would ever need it.
      if (side === "them") {
        spokeRef.current = true;
        if (retryRef.current) {
          window.clearTimeout(retryRef.current);
          retryRef.current = null;
        }
        openMic();
      }
      const now = Date.now();
      lastHeardRef.current = now;
      if (!bufRef.current[side]) turnAtRef.current[side] = now;
      if (side === "you") {
        // Spoke over her: her last words were a moment ago and her turn is still open.
        if (bufRef.current.them && now - lastThemAtRef.current < 700) interruptedRef.current = true;
        replyTrackerRef.current.caller(now);
      } else {
        // Only the first delta of her turn measures a gap (a lagging caller
        // transcript mid-reply must not give her next delta one). A transcript-
        // based approximation: caller's last transcript delta to her first
        // reply delta, since the data channel exposes no audio-start event.
        if (!bufRef.current.them) {
          replyGapRef.current = replyTrackerRef.current.agentTurnStart(now);
          const gap = replyGapRef.current;
          if (gap !== null) setReplyGaps((prev) => [...prev, gap]);
        }
        lastThemAtRef.current = now;
      }
      bufRef.current[side] += delta;

      const id = bubbleRef.current[side];
      if (id) {
        setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, text: t.text + delta } : t)));
      } else {
        const next = `${side}-${Date.now()}-${Math.random()}`;
        bubbleRef.current[side] = next;
        setTurns((prev) => [...prev, { id: next, side, text: delta, pending: true }]);
      }

      if (timerRef.current[side]) window.clearTimeout(timerRef.current[side] as number);
      const closing = bubbleRef.current[side];
      timerRef.current[side] = window.setTimeout(() => {
        setTurns((prev) => prev.map((t) => (t.id === closing ? { ...t, pending: false } : t)));
        flush(side);
      }, TURN_GAP_MS);
    },
    [flush, openMic],
  );

  /**
   * Close the call's record and, if `update_call_summary` did not already
   * produce a recap, write one from the transcript.
   */
  const wrapUp = useCallback(async () => {
    const turnsNow = turnsRef.current;
    if (!callIdRef.current || turnsNow.length === 0) return;
    if (wrappedUpRef.current) return;
    wrappedUpRef.current = true;
    const generate = !summaryRef.current?.outcome && turnsNow.length >= 3;
    try {
      const res = await fetch(`${ENGINE_BASE_URL}/voice/live/wrap-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordRef.current,
          language: languageRef.current,
          turns: turnsNow.map((t) => ({ side: t.side, text: t.text })),
          call_id: callIdRef.current,
          session_id: sessionIdRef.current,
          account_id: DEMO_ACCOUNT_ID,
          generate,
          duration_s: startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : null,
          live_usage: liveUsageRef.current,
          backend_usage: backendUsageRef.current,
        }),
      });
      if (!res.ok || !generate) return;
      const data = (await res.json()) as { summary: CallSummary | null };
      if (data.summary) {
        summaryRef.current = data.summary;
        setSummary(data.summary);
      }
    } catch {
      // The call is already over. A missing recap is a worse demo than a
      // present one, but a thrown error here would be worse than both.
    }
  }, []);

  // --- teardown -------------------------------------------------------------

  const teardown = useCallback(() => {
    (["you", "them"] as const).forEach((side) => {
      if (timerRef.current[side]) window.clearTimeout(timerRef.current[side] as number);
      timerRef.current[side] = null;
      flush(side);
    });
    if (limitRef.current) window.clearTimeout(limitRef.current);
    limitRef.current = null;
    if (silenceRef.current) window.clearInterval(silenceRef.current);
    silenceRef.current = null;
    if (unmuteRef.current) window.clearTimeout(unmuteRef.current);
    unmuteRef.current = null;
    if (retryRef.current) window.clearTimeout(retryRef.current);
    retryRef.current = null;
    micRef.current = null;
    try {
      dcRef.current?.close();
    } catch {
      /* already gone */
    }
    try {
      localRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    } catch {
      /* already gone */
    }
    dcRef.current = null;
    pcRef.current = null;
    localRef.current = null;
    resetAmplitude();
  }, [flush, resetAmplitude]);

  const hangup = useCallback(
    (reason: EndedReason = null) => {
      if (connectingRef.current) {
        // Not on the call yet: cancel the start and go back to the setup.
        runRef.current++;
        connectingRef.current = false;
        teardown();
        setEndedReason(reason);
        setState("idle");
        setOrbState("idle");
        return;
      }
      if (!pcRef.current) return;
      // Send the close and give the server a beat to answer with its usage
      // total: tearing the connection down immediately loses that event.
      send({ type: "session.close" });
      setEndedReason(reason);
      setOrbState("done");
      window.setTimeout(() => {
        teardown();
        setState("ended");
        void wrapUp();
      }, 800);
    },
    [send, teardown, wrapUp],
  );

  // --- tools ----------------------------------------------------------------

  const handleTool = useCallback(
    async (item: ToolItem) => {
      if (!item.call_id) return;
      setOrbState("thinking");

      const toolAt = Date.now();
      // Show it at once (pending) instead of when it is done: the test panel lists tools
      // as they start. The row is filled in below.
      const lastTurn = turnsRef.current[turnsRef.current.length - 1];
      setTools((prev) => [
        ...prev,
        {
          name: item.name ?? "", result: null, ms: null, at: toolAt, callId: item.call_id,
          args: parseToolArgs(item.arguments), pending: true, afterTurnId: lastTurn?.id ?? null,
        },
      ]);
      const crm = await relay({
        type: "live.function_call",
        name: item.name,
        arguments: item.arguments ?? "{}",
        call_id: item.call_id,
      });
      const toolMs = Date.now() - toolAt;

      let output: Record<string, unknown> = { ok: true };
      if (item.name && STOCK_TOOLS.has(item.name)) {
        // A staff test of a dealer line: the engine looked the car up (browser_stock.py).
        output = crm?.tool_output ?? { status: "unavailable" };
      } else if (item.name === "book_appointment") {
        output = crm?.booked_slot
          ? { status: "booked", slot: crm.booked_slot }
          : {
              status: "not_booked",
              detail:
                "The diary could not confirm this slot. Take it as a message and promise someone will ring them straight back.",
            };
      }

      setTools((prev) => prev.map((x) => (x.callId === item.call_id ? { ...x, result: output, ms: toolMs, pending: false } : x)));
      send({
        type: "response.item.create",
        item: { type: "function_call_output", call_id: item.call_id, output: JSON.stringify(output) },
      });
      // Every pending result must be in before this. It does not itself give
      // her permission to speak; it releases the backend to continue.
      send({ type: "response.create" });
      // The review's tool marker: a prospect demo on /voice-demo sends exactly what it did before.
      if (staffTestRef.current) void relay({
        type: "tool",
        name: item.name,
        args: parseToolArgs(item.arguments),
        result: output,
        ms: toolMs,
        at: toolAt,
      });

      if (item.name === "end_call") hangup("completed");
    },
    [relay, send, hangup],
  );

  // --- events ---------------------------------------------------------------

  const onEvent = useCallback(
    (ev: LiveEvent) => {
      switch (ev.type) {
        case "session.started": {
          sessionIdRef.current = ev.session?.id ?? sessionIdRef.current;
          setState("live");
          setStartedAt(Date.now());
          startedAtRef.current = Date.now();
          // The clock on screen starts here, so the cut-off is timed from here
          // too: it ends at exactly the maximum the caller was shown.
          if (limitRef.current) window.clearTimeout(limitRef.current);
          limitRef.current = window.setTimeout(() => hangup("time_limit"), limitMsRef.current);
          setOrbState("listening");
          lastHeardRef.current = Date.now();
          // The documented moment to send application commands.
          greet();
          // Ask again, up to GREETING_MAX_ATTEMPTS, until she speaks. Cleared
          // the instant she does, so a slow greeting is never doubled.
          if (retryRef.current) window.clearTimeout(retryRef.current);
          const retry = (attempt: number) => {
            retryRef.current = window.setTimeout(() => {
              retryRef.current = null;
              if (spokeRef.current || !greetingRef.current) {
                void relay({
                  type: "live.greeting_retry_skipped",
                  spoke: spokeRef.current,
                  had_greeting: !!greetingRef.current,
                });
                return;
              }
              // No ack means the instructions themselves were lost, and a cue
              // for wording she never received makes her say nothing.
              if (!ackedRef.current) {
                send({
                  type: "session.instructions.append",
                  event_id: GREETING_EVENT_ID,
                  delegation_id: null,
                  content: greetingRef.current,
                });
              }
              cuedRef.current = false;
              cueGreeting();
              void relay({
                type: "live.greeting_sent",
                attempt,
                acked: ackedRef.current,
                chars: greetingRef.current.length,
              });
              if (attempt < GREETING_MAX_ATTEMPTS) retry(attempt + 1);
            }, GREETING_RETRY_MS);
          };
          retry(2);
          silenceRef.current = window.setInterval(() => {
            const quietFor = Date.now() - lastHeardRef.current;
            const limit = farewellRef.current ? FAREWELL_SILENCE_MS : SILENCE_MS;
            if (quietFor > limit) hangup(farewellRef.current ? "completed" : "silence");
          }, SILENCE_TICK_MS);
          // Normally already sent when the channel opened; this is the
          // fallback if it was not.
          greet();
          break;
        }

        case "session.instructions.appended":
          // Accepted. Now ask her to actually say it.
          if (!ev.client_event_id || ev.client_event_id === GREETING_EVENT_ID) {
            ackedRef.current = true;
            cueGreeting();
          }
          break;

        case "session.input_transcript.delta":
          appendDelta("you", ev.delta ?? "");
          setOrbState("listening");
          break;

        case "session.output_transcript.delta":
          appendDelta("them", ev.delta ?? "");
          setOrbState("streaming");
          break;

        case "session.delegation.created":
          // She has handed the question to the backend and is waiting on it.
          // The wave breathes through this gap instead of lying flat.
          setOrbState("thinking");
          break;

        case "response.event":
          // Everything from the backend arrives wrapped. Dispatch on the INNER
          // type: OpenAI's guide is explicit that treating these as top-level
          // response.* events is how this goes wrong.
          if (ev.event?.type === "response.output_item.done" && ev.event.item?.type === "function_call") {
            void handleTool(ev.event.item);
          } else if (
            (ev.event?.type === "response.completed" || ev.event?.type === "response.done") &&
            ev.event.response?.usage
          ) {
            // Billed apart from her minutes: the backend answers once per turn.
            const u: TokenUsage = ev.event?.response?.usage ?? {};
            const total = backendUsageRef.current;
            total.input_tokens += Number(u.input_tokens) || 0;
            total.output_tokens += Number(u.output_tokens) || 0;
            total.input_tokens_details.cached_tokens += Number(u.input_tokens_details?.cached_tokens) || 0;
          }
          break;

        case "session.usage.updated":
          // GPT-Live's own meter, which is what OpenAI bills her minutes from.
          if (typeof ev.usage?.seconds === "number") liveUsageRef.current = { seconds: ev.usage.seconds };
          break;

        case "session.closed":
          if (typeof ev.usage?.seconds === "number") liveUsageRef.current = { seconds: ev.usage.seconds };
          setEndedReason((prev) => prev ?? (ev.reason === "remote_hangup" ? "completed" : "dropped"));
          teardown();
          setState("ended");
          setOrbState("done");
          void wrapUp();
          break;

        case "error":
          // Moderation can cut her off and emit this WITHOUT ending the
          // session, so this reports but never tears the call down. Relayed as
          // well as shown: a rejected greeting would land here, and the screen
          // is not where we can read one back later.
          void relay({ type: "live.client_error", error: ev.error ?? null });
          setError(ev.error?.message ?? "Something went wrong on the call.");
          setOrbState("error");
          break;
      }
    },
    [appendDelta, cueGreeting, greet, handleTool, hangup, relay, send, teardown, wrapUp],
  );

  // --- connect --------------------------------------------------------------

  const start = useCallback(
    async (setup: LiveSetup, password: string) => {
      setError(null);
      setState("connecting");
      setOrbState("thinking");
      setTurns([]);
      setReceipts([]);
      setSummary(null);
      setBooking(null);
      setEndedReason(null);
      setLeadId(null);
      summaryRef.current = null;
      setSessionId(null);
      farewellRef.current = false;
      callIdRef.current = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setCallId(callIdRef.current);
      const link = new URLSearchParams(window.location.search);
      staffTestRef.current = !!setup.staff || !!Number(link.get("line")) || !!Number(link.get("account"));
      setTools([]);
      setReplyGaps([]);
      wrappedUpRef.current = false;
      startedAtRef.current = 0;
      liveUsageRef.current = null;
      backendUsageRef.current = { input_tokens: 0, output_tokens: 0, input_tokens_details: { cached_tokens: 0 } };
      replyTrackerRef.current.reset();
      replyGapRef.current = null;
      interruptedRef.current = false;
      greetedRef.current = false;
      spokeRef.current = false;
      cuedRef.current = false;
      ackedRef.current = false;
      localeRef.current = setup.locale;
      callerRef.current = setup.callerNumber;
      passwordRef.current = password;
      sessionIdRef.current = null;

      const run = ++runRef.current;
      const stale = () => runRef.current !== run;
      connectingRef.current = true;
      // This run's own microphone and connection, closed if it is cancelled. Not the
      // refs: those may already belong to a newer run.
      let ownStream: MediaStream | null = null;
      let ownPc: RTCPeerConnection | null = null;
      const abandon = () => {
        ownStream?.getTracks().forEach((t) => t.stop());
        try { ownPc?.close(); } catch { /* already closed */ }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        ownStream = stream;
        if (stale()) { abandon(); return; }
        localRef.current = stream;
        micRef.current = stream.getAudioTracks()[0] ?? null;
        attach(stream, "you");

        const pc = new RTCPeerConnection();
        ownPc = pc;
        pcRef.current = pc;
        pc.ontrack = (e) => {
          if (audioRef.current) audioRef.current.srcObject = e.streams[0];
          attach(e.streams[0], "them");
        };
        pc.onconnectionstatechange = () => {
          if (["failed", "disconnected"].includes(pc.connectionState)) {
            teardown();
            setState("ended");
            setEndedReason("dropped");
          }
        };

        // Must exist before createOffer, and must carry this exact label.
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        // Deliberately not greeting here: see `greet`. The session is not
        // ready until `session.started` arrives on this channel.
        dc.onopen = null;
        dc.onmessage = (e) => {
          try {
            onEvent(JSON.parse(e.data) as LiveEvent);
          } catch {
            /* a frame we cannot parse is not worth ending a call over */
          }
        };

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // No trickle ICE: the offer crosses in one HTTP round trip, so it has
        // to be complete before it is sent.
        await iceComplete(pc);
        if (stale()) { abandon(); return; }

        // Staff get no rate limit. Fetched per call (a pass is cheap and
        // expires), and a failure just means we are treated as anyone else.
        let adminPass: string | null = null;
        try {
          const r = await apiFetch("/api/voice-demo/pass");
          if (r.ok) adminPass = ((await r.json()) as { pass: string | null }).pass;
        } catch {
          /* no pass: the ordinary limit applies */
        }
        if (stale()) { abandon(); return; }

        const res = await fetch(`${ENGINE_BASE_URL}/voice/live/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password,
            admin_pass: adminPass,
            locale: setup.locale,
            company_name: setup.companyName,
            caller_number: setup.callerNumber,
            voice: setup.voice || null,
            token: setup.staff ? null : new URLSearchParams(window.location.search).get("token") || null,
            // Staff only: ?line=<Voice_Numbers id> or ?account=<Accounts id> (an old
            // Test link), or setup.staff (the Voice tab's test panel), answers as
            // that client's phone line.
            line: setup.staff ? setup.staff.line ?? null : Number(new URLSearchParams(window.location.search).get("line")) || null,
            account: setup.staff ? setup.staff.account ?? null : Number(new URLSearchParams(window.location.search).get("account")) || null,
            // The test panel's LLM pick (test only); /voice-demo sends none.
            llm: setup.staff?.llm ?? null,
            timezone: browserTimezone(),
            sdp: pc.localDescription?.sdp,
          }),
        });
        const data = await res.json();
        if (stale()) { abandon(); return; }
        if (!res.ok) throw new Error(data?.detail || "Could not start the call.");

        sessionIdRef.current = data.session_id ?? null;
        setSessionId(data.session_id ?? null);
        languageRef.current = data.language ?? "en";
        greetingRef.current = data.greeting ?? "";
        cueRef.current = data.cue ?? "";
        setCompany(data.company ?? setup.companyName);
        await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        if (stale()) { abandon(); return; }
        connectingRef.current = false;

        // Fallback if session.started has not armed it yet.
        if (!limitRef.current) limitRef.current = window.setTimeout(() => hangup("time_limit"), limitMsRef.current);
      } catch (err) {
        if (stale()) { abandon(); return; }
        connectingRef.current = false;
        teardown();
        setState("idle");
        setOrbState("error");
        setError(err instanceof Error ? err.message : "Could not start the call.");
      }
    },
    [attach, greet, hangup, onEvent, teardown],
  );

  const reset = useCallback(() => {
    teardown();
    setState("idle");
    setOrbState("idle");
    setTurns([]);
    setReceipts([]);
    setSummary(null);
    setBooking(null);
    setEndedReason(null);
    setError(null);
    setLeadId(null);
    setStartedAt(null);
    setCallId(null);
    setTools([]);
    setReplyGaps([]);
  }, [teardown]);

  useEffect(() => teardown, [teardown]);
  // Leaving the page mid-connect: the start in flight closes its microphone and connection.
  useEffect(() => () => { runRef.current++; connectingRef.current = false; }, []);

  return {
    state,
    orbState,
    readLevels,
    error,
    turns,
    receipts,
    leadId,
    company,
    startedAt,
    summary,
    booking,
    endedReason,
    options,
    audioRef,
    sessionId,
    callId,
    tools,
    replyGaps,
    recordingUrl: sessionId ? `${ENGINE_BASE_URL}/voice/live/recording/${sessionId}` : null,
    start,
    hangup,
    reset,
  };
}

function iceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (pc.iceGatheringState !== "complete") return;
      pc.removeEventListener("icegatheringstatechange", done);
      resolve();
    };
    pc.addEventListener("icegatheringstatechange", done);
    // Some networks never report "complete". A stalled gather must not hang
    // the Call button forever.
    window.setTimeout(resolve, 2500);
  });
}
