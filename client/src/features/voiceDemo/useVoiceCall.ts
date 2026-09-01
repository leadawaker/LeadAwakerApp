import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Booking,
  CallSetup,
  CallState,
  CallSummary,
  CrmReceipt,
  EndedReason,
  Floor,
  Turn,
  VoiceLang,
  VoiceOptions,
} from "./types";

/**
 * The automation engine's /voice/* routes. The engine runs on the Pi while
 * this app is served from Vercel, so this is always cross-origin (the
 * engine's CORS allows it).
 */
const ENGINE_BASE_URL =
  import.meta.env.VITE_VOICE_ENGINE_URL ?? "https://webhooks.leadawaker.com";

/** Browser side of the OpenAI Realtime WebRTC handshake: SDP offer in, answer out. */
const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

const DEMO_ACCOUNT_ID = 52;
const DEMO_CAMPAIGN_ID = 60;

/**
 * Each language has its own seeded persona with its own demo brand, and the
 * engine swaps that brand for whatever is typed here. Defaulting every
 * language to the English brand would rewrite Zonnedak as "Brightside Solar"
 * on a Dutch call.
 */
export const DEMO_COMPANY: Record<VoiceLang, string> = {
  en: "Brightside Solar",
  nl: "Zonnedak",
  pt: "Sol Maior",
};

export const PHONE_STORAGE_KEY = "leadawaker.voiceDemo.callerNumber";

/**
 * Shown until /voice/options answers. The engine is the authority on what this
 * account can use — a model it does not have is accepted when the token is
 * minted and only rejected later at the SDP exchange, i.e. mid-call.
 */
export const FALLBACK_OPTIONS: VoiceOptions = {
  models: ["gpt-realtime-2.1"],
  voices: ["marin", "cedar"],
};

/** Reads as pace rather than as a number, which is what is being judged. */
export const SPEED_CHOICES = [
  { value: 0.9, label: "Unhurried" },
  { value: 1.0, label: "Natural" },
  { value: 1.1, label: "Brisk" },
];

interface RealtimeEvent {
  type?: string;
  delta?: string;
  transcript?: string;
  name?: string;
  call_id?: string;
  /** Identifies WHICH conversation item a transcript belongs to. */
  item_id?: string;
  item?: { id?: string; role?: string };
}

/** How long a demo call may run before it wraps itself up. */
export const MAX_CALL_MS = 5 * 60 * 1000;
/** She starts closing the conversation this long before the hard cut-off. */
const WRAP_UP_MS = 40 * 1000;
/**
 * Silence from the caller, measured from the moment she stops speaking. A
 * shared demo link gets opened and then abandoned with the tab still live, and
 * an open realtime session bills by the minute whether anyone is talking or not.
 */
const SILENCE_MS = 30 * 1000;
/** One line to sign off after the silence, then the line drops. */
const SILENCE_GRACE_MS = 7 * 1000;
/**
 * Generation runs well ahead of playback, so audio is still coming out of the
 * speakers when an event arrives on the data channel. Hanging up on the event
 * itself cuts her off mid-sentence — the one moment of a demo everybody in the
 * room remembers. The farewell's own length drives the real wait; this is the
 * backstop that guarantees the call ends even if the farewell never arrives.
 */
const END_CALL_BACKSTOP_MS = 20 * 1000;
/** Roughly how long a spoken word takes, for sizing the farewell's playout. */
const MS_PER_WORD = 400;
const MIN_FAREWELL_MS = 3500;
const MAX_FAREWELL_MS = 9000;

export function useVoiceCall() {
  const [state, setState] = useState<CallState>("idle");
  const [options, setOptions] = useState<VoiceOptions>(FALLBACK_OPTIONS);
  const [floor, setFloor] = useState<Floor>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [receipts, setReceipts] = useState<CrmReceipt[]>([]);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [company, setCompany] = useState(DEMO_COMPANY.en);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [endedReason, setEndedReason] = useState<EndedReason>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string>("");
  const callerNumberRef = useRef<string>("");
  const languageRef = useRef<VoiceLang>("en");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Restarted every time she stops speaking, cancelled the moment the caller
  // makes a sound, so it only ever measures *their* silence.
  const silenceRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const endCallRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The closing sequence, as a tiny state machine. `end_call` only REQUESTS
  // the end; the line stays open until she has actually said goodbye out loud,
  // because the model reliably announces the wrap-up ("let me just wrap this
  // up properly for you") instead of performing it, and a demo that ends on
  // that line ends on a non-sequitur.
  const endingRef = useRef<null | "requested" | "speaking">(null);
  const farewellTextRef = useRef("");
  // True between the caller starting an utterance and it being committed.
  const callerSpeakingRef = useRef(false);
  // Consecutive turns handed back to her by a summary tool call alone. A loop
  // guard: without it, a model that answers every prompted turn with another
  // silent note-taking call would talk to itself until the time cap.
  const summaryChainRef = useRef(0);
  // Which bubble each side is still streaming into, so deltas append to one
  // turn instead of spawning a turn per fragment.
  const openTurnRef = useRef<{ them: string | null; you: string | null }>({
    them: null,
    you: null,
  });
  // Bubbles reserved by conversation-item id but not yet filled in.
  //
  // The caller's words are transcribed by a SEPARATE pass that runs alongside
  // the model's own reply, so its `...transcription.completed` can land after
  // the reply it prompted — the transcript then reads as two of Alex's turns
  // stacked together with the caller's answer below them. Reserving the
  // caller's slot the moment their audio is committed fixes the order at the
  // point the turn actually happened, not the point its text came back.
  const reservedRef = useRef<Map<string, string>>(new Map());
  // Bubble ids that have EVER had a second item merged onto them by
  // reserveTurn. Once true, no contributing item's `.done` transcript may be
  // used to overwrite the bubble's text — it covers only that one item, not
  // the merged whole — regardless of which item's `.done` happens to arrive
  // last; only pending gets cleared, trusting what the streamed deltas built.
  const mergedBubblesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`${ENGINE_BASE_URL}/voice/options`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: VoiceOptions | null) => {
        if (!cancelled && data?.models?.length && data?.voices?.length) setOptions(data);
      })
      .catch(() => {
        // Keep the fallback list; the picker still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Hold this turn's place in the transcript before its text exists.
   *
   * A function call ends the response item it interrupts, so a reply that
   * pauses mid-sentence to call `update_call_summary` produces TWO assistant
   * conversation items for what was, out loud, one uninterrupted reply — the
   * second bubble then reads as a non sequitur sitting under the first. When
   * this new item is her side again with nothing from the caller in between,
   * it is the same spoken turn continuing, so it is folded into the bubble
   * already on screen instead of starting a new one.
   */
  const reserveTurn = useCallback((side: "them" | "you", itemId?: string) => {
    if (!itemId || reservedRef.current.has(itemId)) return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      // Deliberately NOT gated on `!last.pending`. `response.output_item.added`
      // for item N+1 routinely arrives before item N's OWN
      // `output_audio_transcript.done` — content generation for N is finished
      // (that's why the model moved on to N+1), but N's transcript
      // finalization is a separate, slightly lagging event. Requiring the
      // previous bubble to already be filled in missed almost every real
      // split, since it almost never was yet: two assistant items with
      // nothing from the caller between them are still one continuous turn
      // regardless of which of their two events happened to arrive first.
      if (side === "them" && last?.side === "them") {
        reservedRef.current.set(itemId, last.id);
        mergedBubblesRef.current.add(last.id);
        openTurnRef.current[side] = last.id;
        return prev.map((t) =>
          t.id === last.id ? { ...t, pending: true, text: `${t.text} ` } : t,
        );
      }
      const id = `${side}-${itemId}`;
      reservedRef.current.set(itemId, id);
      openTurnRef.current[side] = id;
      return [...prev, { id, side, text: "", pending: true }];
    });
  }, []);

  /** Fill a reserved bubble, wherever it now sits in the transcript. */
  const fillTurn = useCallback(
    (side: "them" | "you", itemId: string | undefined, text: string) => {
      const id = itemId && reservedRef.current.get(itemId);
      if (!id) return false;
      // A continuation's `.done` transcript covers only its OWN item, not the
      // merged bubble it landed in — streaming deltas already built the full
      // text, so here we only clear "pending", never overwrite it.
      const isMerged = mergedBubblesRef.current.has(id);
      reservedRef.current.delete(itemId!);
      if (openTurnRef.current[side] === id) openTurnRef.current[side] = null;
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, text: isMerged ? t.text : text, pending: false } : t,
        ),
      );
      return true;
    },
    [],
  );

  const appendDelta = useCallback((side: "them" | "you", delta: string) => {
    if (!delta) return;
    const openId = openTurnRef.current[side];
    if (openId) {
      setTurns((prev) =>
        prev.map((t) => (t.id === openId ? { ...t, text: t.text + delta } : t)),
      );
      return;
    }
    // The id is claimed HERE, not inside the updater. React may invoke an
    // updater more than once for the same logical update (it re-runs them when
    // it rebases queued work), so a ref written inside one is written a
    // different number of times than the state it is meant to track — which
    // strands a bubble or spawns a second one.
    const id = `${side}-${Date.now()}-${Math.random()}`;
    openTurnRef.current[side] = id;
    setTurns((prev) => [...prev, { id, side, text: delta, pending: true }]);
  }, []);

  const commitTurn = useCallback((side: "them" | "you", finalText?: string) => {
    const openId = openTurnRef.current[side];
    openTurnRef.current[side] = null;
    setTurns((prev) => {
      if (openId) {
        return prev.map((t) =>
          t.id === openId ? { ...t, text: finalText ?? t.text, pending: false } : t,
        );
      }
      if (!finalText) return prev;
      // No open bubble means no delta stream to fold into — the transcript
      // arrived whole. Check it against what is already on screen: a `.done`
      // seen twice for one turn would otherwise print the same words twice.
      // Only the immediately preceding bubble counts, so the same short answer
      // given again later in the call ("Yes.") still renders.
      const last = prev[prev.length - 1];
      if (last && last.side === side && last.text === finalText) return prev;
      return [
        ...prev,
        { id: `${side}-${Date.now()}-${Math.random()}`, side, text: finalText, pending: false },
      ];
    });
  }, []);

  const relay = useCallback(async (event: RealtimeEvent) => {
    try {
      const res = await fetch(`${ENGINE_BASE_URL}/voice/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callIdRef.current,
          account_id: DEMO_ACCOUNT_ID,
          campaign_id: DEMO_CAMPAIGN_ID,
          phone: callerNumberRef.current || "web",
          language: languageRef.current,
          event,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { crm: CrmReceipt | null };
      if (data.crm) {
        setReceipts((prev) => [...prev, data.crm as CrmReceipt]);
        if (data.crm.lead_id) setLeadId(data.crm.lead_id);
        // Called once, at the end of the call — see the type's own comment
        // for why. A defensive merge on `name` in case a future build ever
        // calls it more than once; `items` is the complete list either way.
        if (data.crm.summary) {
          const incoming = data.crm.summary;
          setSummary((prev) => ({
            name: incoming.name ?? prev?.name,
            items: incoming.items ?? prev?.items ?? [],
          }));
        }
        if (data.crm.booked_slot) {
          setBooking({ spoken: data.crm.booked_slot, iso: data.crm.booked_iso ?? null });
        }
      }
      return data;
    } catch {
      // A dropped relay must never disturb a live call.
      return null;
    }
  }, []);

  /**
   * Answer a tool call.
   *
   * An unanswered function call stalls the session until it times out, so
   * EVERY call gets a result — including failures.
   *
   * `respond` decides whether she gets the turn back afterwards. A function
   * call ENDS her turn, so withholding `response.create` after one leaves her
   * silent until the caller speaks again — that stalled a live demo twice,
   * back when `update_call_summary` fired mid-answer and got no response.
   * It now only fires once, after her goodbye, with nothing left to say, so
   * it is the one call answered with `respond: false` on purpose. Every other
   * tool defaults to getting the turn back; a call that lands while the
   * caller is mid-utterance is the one exception, because their own turn will
   * prompt a response a moment later anyway.
   */
  const answerTool = useCallback(
    (
      fnCallId: string | undefined,
      output: unknown,
      respond: boolean,
      /**
       * How to carry on after the result. Worth setting: the turn a tool call
       * interrupts is one she has usually already opened with a lead-in
       * ("let me get that Monday slot lined up"), and left to itself the
       * continuation starts over from scratch — greeting and thanking a caller
       * it just greeted and thanked, two seconds earlier. This is the only
       * point in the exchange where we get to say how she resumes.
       */
      instructions?: string,
    ) => {
      const channel = channelRef.current;
      if (!channel || channel.readyState !== "open" || !fnCallId) return;
      channel.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: fnCallId,
            output: JSON.stringify(output),
          },
        }),
      );
      if (respond) {
        channel.send(
          JSON.stringify(
            instructions
              ? { type: "response.create", response: { instructions } }
              : { type: "response.create" },
          ),
        );
      }
    },
    [],
  );

  const teardown = useCallback(() => {
    [...timersRef.current, ...silenceRef.current].forEach(clearTimeout);
    timersRef.current = [];
    silenceRef.current = [];
    if (endCallRef.current) clearTimeout(endCallRef.current);
    endCallRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    try {
      channelRef.current?.close();
    } catch {
      /* already closed */
    }
    channelRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      /* already closed */
    }
    pcRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const hangup = useCallback(
    (reason: EndedReason = null) => {
      teardown();
      commitTurn("them");
      commitTurn("you");
      reservedRef.current.clear();
      mergedBubblesRef.current.clear();
      endingRef.current = null;
      setEndedReason(reason);
      setState("ended");
      setFloor("listening");
    },
    [teardown, commitTurn],
  );

  /** Ask her to say one specific thing, without changing the session. */
  const speak = useCallback((instructions: string) => {
    const ch = channelRef.current;
    if (!ch || ch.readyState !== "open") return;
    ch.send(JSON.stringify({ type: "response.create", response: { instructions } }));
  }, []);

  const clearSilence = useCallback(() => {
    silenceRef.current.forEach(clearTimeout);
    silenceRef.current = [];
  }, []);

  /**
   * Restart the "is anyone still there?" clock.
   *
   * She signs off before the line drops rather than the call simply going
   * dead, for the same reason the five-minute cap does: a demo that cuts out
   * silently reads as a crash, and the prospect blames the product.
   */
  const armSilence = useCallback(() => {
    clearSilence();
    silenceRef.current.push(
      setTimeout(() => {
        speak(
          "The caller has gone quiet and has not answered. In ONE short sentence, " +
            "warmly say you will let them go, that everything you discussed is " +
            "already saved, and that someone will follow up. Do not ask a question.",
        );
      }, SILENCE_MS),
      setTimeout(() => hangup("silence"), SILENCE_MS + SILENCE_GRACE_MS),
    );
  }, [clearSilence, speak, hangup]);

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          // Somebody is still there, so the silence clock resets.
          callerSpeakingRef.current = true;
          summaryChainRef.current = 0;
          clearSilence();
          // The hang-up, though, is NOT cancelled once the close has started.
          // It used to be, so that a caller saying "wait, actually…" was not
          // cut off — but what callers actually say into a goodbye is "yes"
          // and "bye-bye", and each one cancelled the queued hang-up. The call
          // then never ended: she re-announced the wrap-up, the caller
          // acknowledged again, and round it went. Committing to the close is
          // the lesser evil; the Hang up button and the time cap remain.
          if (!endingRef.current && endCallRef.current) {
            clearTimeout(endCallRef.current);
            endCallRef.current = null;
          }
          setFloor("listening");
          break;
        // The caller stopped talking and their audio became a conversation
        // item. Its transcription is still in flight, so claim the slot now.
        case "input_audio_buffer.committed":
          callerSpeakingRef.current = false;
          reserveTurn("you", event.item_id);
          break;
        case "response.output_item.added":
          if (event.item?.role === "assistant") {
            // Anything spoken after `end_call` was requested IS the farewell
            // turn: the items of the response that carried the tool call all
            // arrived before it.
            if (endingRef.current === "requested") endingRef.current = "speaking";
            reserveTurn("them", event.item?.id);
          }
          break;
        case "response.output_audio_transcript.delta":
          setFloor("speaking");
          appendDelta("them", event.delta ?? "");
          break;
        case "response.output_audio_transcript.done":
          if (endingRef.current === "speaking") farewellTextRef.current = event.transcript ?? "";
          if (!fillTurn("them", event.item_id, event.transcript ?? "")) {
            commitTurn("them", event.transcript);
          }
          break;
        case "conversation.item.input_audio_transcription.delta":
          appendDelta("you", event.delta ?? "");
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (!fillTurn("you", event.item_id, event.transcript ?? "")) {
            commitTurn("you", event.transcript);
          }
          break;
        case "response.done":
          if (endingRef.current === "speaking") {
            // The farewell is generated but still playing out. Wait for its
            // own length rather than a fixed guess, then drop the line.
            const words = farewellTextRef.current.trim().split(/\s+/).filter(Boolean).length;
            const playout = Math.min(
              MAX_FAREWELL_MS,
              Math.max(MIN_FAREWELL_MS, words * MS_PER_WORD),
            );
            if (endCallRef.current) clearTimeout(endCallRef.current);
            endCallRef.current = setTimeout(() => hangup("completed"), playout);
            setFloor("listening");
            break;
          }
          // She has finished her turn, so the floor — and the silence clock —
          // is the caller's.
          setFloor("listening");
          armSilence();
          break;
      }
    },
    [appendDelta, armSilence, clearSilence, commitTurn, fillTurn, hangup, reserveTurn],
  );

  const reset = useCallback(() => {
    teardown();
    setTurns([]);
    setReceipts([]);
    setLeadId(null);
    setStartedAt(null);
    setError(null);
    setSummary(null);
    setBooking(null);
    setEndedReason(null);
    openTurnRef.current = { them: null, you: null };
    reservedRef.current.clear();
    mergedBubblesRef.current.clear();
    endingRef.current = null;
    callerSpeakingRef.current = false;
    summaryChainRef.current = 0;
    setState("idle");
  }, [teardown]);

  const start = useCallback(
    async (setup: CallSetup) => {
      setError(null);
      setTurns([]);
      setReceipts([]);
      setLeadId(null);
      setSummary(null);
      setBooking(null);
      setEndedReason(null);
      openTurnRef.current = { them: null, you: null };
      reservedRef.current.clear();
      mergedBubblesRef.current.clear();
      endingRef.current = null;
      callerSpeakingRef.current = false;
      summaryChainRef.current = 0;
      languageRef.current = setup.language;

      const companyName = setup.companyName.trim() || DEMO_COMPANY[setup.language];
      setCompany(companyName);
      callerNumberRef.current = setup.callerNumber.trim();
      callIdRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      setState("connecting");
      setFloor("connecting");

      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        micRef.current = mic;
      } catch {
        setState("idle");
        setError("Microphone access was blocked. Allow the mic in your browser, then call again.");
        return;
      }

      let token: string;
      try {
        const res = await fetch(`${ENGINE_BASE_URL}/voice/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: setup.language,
            company_name: companyName,
            caller_number: callerNumberRef.current || null,
            model: setup.model,
            voice: setup.voice,
            speed: setup.speed,
          }),
        });
        if (!res.ok) throw new Error(`Could not reach the voice engine (HTTP ${res.status}).`);
        const data = await res.json();
        if (!data?.value) throw new Error("The voice engine did not return a usable token.");
        token = data.value;
      } catch (err) {
        teardown();
        setState("idle");
        setError(err instanceof Error ? err.message : "Could not start the call. Try again.");
        return;
      }

      try {
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (audioRef.current) audioRef.current.srcObject = event.streams[0];
        };
        mic.getAudioTracks().forEach((track) => {
          pc.addTrack(track, mic);
        });

        const channel = pc.createDataChannel("oai-events");
        channelRef.current = channel;

        channel.onopen = () => {
          // Speak first, so she greets like someone picking up a phone.
          channel.send(JSON.stringify({ type: "response.create" }));
          setState("live");
          setFloor("listening");
          setStartedAt(Date.now());

          // A shared demo link will be left open on somebody's desk with the
          // mic live, so the call ends itself. She gets told to wrap up first,
          // because a line that simply goes dead reads as a crash rather than
          // a demo that finished.
          timersRef.current.push(
            setTimeout(() => {
              const ch = channelRef.current;
              if (!ch || ch.readyState !== "open") return;
              ch.send(
                JSON.stringify({
                  type: "response.create",
                  response: {
                    instructions:
                      "You have about thirty seconds left of this demo call. In ONE short sentence, warmly wrap up: say the demo is out of time, that everything discussed is already saved, and that a colleague will follow up. Do not start a new topic and do not ask a question.",
                  },
                }),
              );
            }, MAX_CALL_MS - WRAP_UP_MS),
            setTimeout(() => hangup("time_limit"), MAX_CALL_MS),
          );
        };

        channel.onmessage = (e) => {
          let event: RealtimeEvent;
          try {
            event = JSON.parse(e.data);
          } catch {
            return;
          }
          const isTool = event.type === "response.function_call_arguments.done";

          // Answered here rather than after the relay round-trip: the engine
          // writes nothing for this tool, so waiting on the network only
          // delays the close.
          //
          // `end_call` is treated as a REQUEST to end, not the end itself. The
          // model announces the wrap-up rather than performing it — a proven
          // preamble habit, not something prompt wording fixes — so the line
          // would otherwise drop on "let me just wrap this up properly for
          // you". Instead she is handed one final turn whose only job is the
          // farewell, and the call ends when that has actually been said.
          if (isTool && event.name === "end_call") {
            answerTool(event.call_id, { ok: true }, false);
            clearSilence();
            if (!endingRef.current) {
              endingRef.current = "requested";
              farewellTextRef.current = "";
              speak(
                "Say your farewell now, and nothing else: thank them by name if " +
                  "you know it and wish them a good day, in one short warm " +
                  "sentence. This is the last thing you will say on this call. " +
                  "Do not mention wrapping up, notes, or ending the call, and " +
                  "do not ask a question.",
              );
              // Backstop: the line ends even if that farewell never arrives.
              endCallRef.current = setTimeout(
                () => hangup("completed"),
                END_CALL_BACKSTOP_MS,
              );
            }
          }

          void relay(event).then((result) => {
            if (!isTool || event.name === "end_call") return;
            if (event.name === "book_appointment") {
              const crm = result?.crm;
              answerTool(
                event.call_id,
                crm?.booked_slot
                  ? { status: "booked", slot: crm.booked_slot }
                  : {
                      status: "not_booked",
                      detail:
                        "The diary could not confirm this slot. Take it as a message and promise someone will ring them straight back.",
                    },
                true,
                "Carry straight on from what you were already saying — you are " +
                  "mid-turn, so do not greet them, thank them, or say their name " +
                  "back to them again. In one or two sentences: confirm the day " +
                  "and time, say what happens next, and keep your usual warmth.",
              );
            } else if (event.name === "update_call_summary") {
              // Called once, at the very end of the call, on a turn she has
              // already finished speaking — nothing left to hand back to her.
              answerTool(event.call_id, { ok: true }, false);
            } else {
              // A tool this build does not know about yet: hand the turn back
              // by default, since a withheld response is what left her stuck
              // mid-answer before book_appointment was special-cased. Capped
              // so an unexpected tool cannot loop her into talking to herself.
              const respond = !callerSpeakingRef.current && summaryChainRef.current < 2;
              if (respond) summaryChainRef.current += 1;
              answerTool(event.call_id, { ok: true }, respond);
            }
          });
          handleEvent(event);
        };

        channel.onclose = () => {
          if (pcRef.current) hangup("dropped");
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp",
          },
        });
        if (!sdpResponse.ok) {
          throw new Error(`OpenAI rejected the call setup (HTTP ${sdpResponse.status}).`);
        }
        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (err) {
        teardown();
        setState("idle");
        setError(err instanceof Error ? err.message : "Could not connect to Alex. Try again.");
      }
    },
    [teardown, relay, handleEvent, hangup, answerTool, clearSilence, speak],
  );

  return {
    state,
    options,
    floor,
    error,
    turns,
    receipts,
    leadId,
    company,
    startedAt,
    summary,
    booking,
    endedReason,
    audioRef,
    start,
    hangup,
    reset,
  };
}
