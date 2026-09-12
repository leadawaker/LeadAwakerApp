import { useCallback, useEffect, useRef, useState } from "react";
import type { AIState } from "@/components/siriOrb/aiCore";
import { useCallAmplitude } from "./useCallAmplitude";
import type {
  Booking,
  CallState,
  CallSummary,
  CrmReceipt,
  EndedReason,
  LiveOptions,
  LiveSetup,
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

export const ENGINE_BASE_URL =
  import.meta.env.VITE_VOICE_ENGINE_URL ?? "https://webhooks.leadawaker.com";

export const DEMO_ACCOUNT_ID = 1;
export const DEMO_CAMPAIGN_ID = 60;

/**
 * A side's turn is closed this long after its last transcript delta. Long
 * enough to ride out the gap between clauses, short enough that the CRM row
 * appears while the prospect is still watching the panel. Tuned by eye, not by
 * anything the API tells us.
 */
const TURN_GAP_MS = 1400;

/** Hard stop, so an abandoned tab cannot bill a session indefinitely. */
const MAX_CALL_MS = 5 * 60 * 1000;

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

function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

interface LiveEvent {
  type?: string;
  delta?: string;
  reason?: string;
  session?: { id?: string };
  usage?: { seconds?: number };
  error?: { message?: string };
  event?: { type?: string; item?: ToolItem };
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
  /** Drives the orb. Derived from what is happening, not from an API event. */
  const [orbState, setOrbState] = useState<AIState>("idle");

  const { amplitude, attach, reset: resetAmplitude } = useCallAmplitude();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string>("");
  const sessionIdRef = useRef<string | null>(null);
  const localeRef = useRef<VoiceLocale>("en-GB");
  const languageRef = useRef<string>("en");
  const callerRef = useRef<string>("");
  /** Held so the wrap-up call after hangup can authenticate like any other. */
  const passwordRef = useRef<string>("");
  const limitRef = useRef<number | null>(null);
  const silenceRef = useRef<number | null>(null);
  const lastHeardRef = useRef<number>(0);
  /**
   * The transcript as of right now. `hangup` runs from timers and from the
   * data channel, where a captured `turns` would be whatever it was when the
   * handler was created.
   */
  const turnsRef = useRef<Turn[]>([]);
  const summaryRef = useRef<CallSummary | null>(null);
  /**
   * The opening line, composed by the engine because it needs the company and
   * what the company does. Arrives with the SDP answer, i.e. always before the
   * data channel opens, so it is in place by the time session.started fires.
   */
  const greetingRef = useRef<string>("");

  /** Text accumulating for each side, plus the timer that will close it. */
  const bufRef = useRef<{ you: string; them: string }>({ you: "", them: "" });
  const timerRef = useRef<{ you: number | null; them: number | null }>({ you: null, them: null });
  /** The transcript bubble currently being written into, per side. */
  const bubbleRef = useRef<{ you: string | null; them: string | null }>({ you: null, them: null });

  useEffect(() => {
    fetch(`${ENGINE_BASE_URL}/voice/live/options`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOptions(d as LiveOptions))
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
          event,
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

  // --- transcript -----------------------------------------------------------

  const flush = useCallback(
    (side: "you" | "them") => {
      const text = bufRef.current[side].trim();
      bufRef.current[side] = "";
      bubbleRef.current[side] = null;
      timerRef.current[side] = null;
      if (!text) return;
      void relay({
        type: side === "you" ? "live.caller_turn" : "live.ai_turn",
        transcript: text,
      });
    },
    [relay],
  );

  const appendDelta = useCallback(
    (side: "you" | "them", delta: string) => {
      if (!delta) return;
      lastHeardRef.current = Date.now();
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
    [flush],
  );

  /**
   * Write the recap from the transcript, now the call is over.
   *
   * Only runs if `update_call_summary` did not already produce one. That tool
   * still exists and still wins when she delegates; this is what makes a recap
   * certain rather than likely.
   */
  const wrapUp = useCallback(async () => {
    if (summaryRef.current) return;
    const turnsNow = turnsRef.current;
    if (turnsNow.length < 3) return;
    try {
      const res = await fetch(`${ENGINE_BASE_URL}/voice/live/wrap-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordRef.current,
          language: languageRef.current,
          turns: turnsNow.map((t) => ({ side: t.side, text: t.text })),
        }),
      });
      if (!res.ok) return;
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

      const crm = await relay({
        type: "live.function_call",
        name: item.name,
        arguments: item.arguments ?? "{}",
        call_id: item.call_id,
      });

      let output: Record<string, unknown> = { ok: true };
      if (item.name === "book_appointment") {
        output = crm?.booked_slot
          ? { status: "booked", slot: crm.booked_slot }
          : {
              status: "not_booked",
              detail:
                "The diary could not confirm this slot. Take it as a message and promise someone will ring them straight back.",
            };
      }

      send({
        type: "response.item.create",
        item: { type: "function_call_output", call_id: item.call_id, output: JSON.stringify(output) },
      });
      // Every pending result must be in before this. It does not itself give
      // her permission to speak; it releases the backend to continue.
      send({ type: "response.create" });

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
          setOrbState("listening");
          lastHeardRef.current = Date.now();
          silenceRef.current = window.setInterval(() => {
            if (Date.now() - lastHeardRef.current > SILENCE_MS) hangup("silence");
          }, SILENCE_TICK_MS);
          // GPT-Live has no response.create-to-greet. The documented way to
          // make her open the call is to append an instruction once the
          // session is up, naming the language explicitly: OpenAI's guidance
          // is not to let her infer it from a name or a number.
          if (greetingRef.current) {
            send({
              type: "session.instructions.append",
              delegation_id: null,
              content: greetingRef.current,
            });
          }
          break;
        }

        case "session.input_transcript.delta":
          appendDelta("you", ev.delta ?? "");
          setOrbState("listening");
          break;

        case "session.output_transcript.delta":
          appendDelta("them", ev.delta ?? "");
          setOrbState("streaming");
          break;

        case "response.event":
          // Everything from the backend arrives wrapped. Dispatch on the INNER
          // type: OpenAI's guide is explicit that treating these as top-level
          // response.* events is how this goes wrong.
          if (ev.event?.type === "response.output_item.done" && ev.event.item?.type === "function_call") {
            void handleTool(ev.event.item);
          }
          break;

        case "session.closed":
          setEndedReason((prev) => prev ?? (ev.reason === "remote_hangup" ? "completed" : "dropped"));
          teardown();
          setState("ended");
          setOrbState("done");
          void wrapUp();
          break;

        case "error":
          // Moderation can cut her off and emit this WITHOUT ending the
          // session, so this reports but never tears the call down.
          setError(ev.error?.message ?? "Something went wrong on the call.");
          setOrbState("error");
          break;
      }
    },
    [appendDelta, handleTool, hangup, send, teardown, wrapUp],
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
      callIdRef.current = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localeRef.current = setup.locale;
      callerRef.current = setup.callerNumber;
      passwordRef.current = password;
      sessionIdRef.current = null;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        localRef.current = stream;
        attach(stream);

        const pc = new RTCPeerConnection();
        pcRef.current = pc;
        pc.ontrack = (e) => {
          if (audioRef.current) audioRef.current.srcObject = e.streams[0];
          attach(e.streams[0]);
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

        const res = await fetch(`${ENGINE_BASE_URL}/voice/live/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password,
            locale: setup.locale,
            company_name: setup.companyName,
            caller_number: setup.callerNumber,
            voice: setup.voice || null,
            token: new URLSearchParams(window.location.search).get("token") || null,
            timezone: browserTimezone(),
            sdp: pc.localDescription?.sdp,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Could not start the call.");

        sessionIdRef.current = data.session_id ?? null;
        setSessionId(data.session_id ?? null);
        languageRef.current = data.language ?? "en";
        greetingRef.current = data.greeting ?? "";
        setCompany(data.company ?? setup.companyName);
        await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });

        limitRef.current = window.setTimeout(() => hangup("time_limit"), MAX_CALL_MS);
      } catch (err) {
        teardown();
        setState("idle");
        setOrbState("error");
        setError(err instanceof Error ? err.message : "Could not start the call.");
      }
    },
    [attach, hangup, onEvent, teardown],
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
  }, [teardown]);

  useEffect(() => teardown, [teardown]);

  return {
    state,
    orbState,
    amplitude,
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
