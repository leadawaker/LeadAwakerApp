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
  // the reply it prompted — the transcript then reads as two of Emma's turns
  // stacked together with the caller's answer below them. Reserving the
  // caller's slot the moment their audio is committed fixes the order at the
  // point the turn actually happened, not the point its text came back.
  const reservedRef = useRef<Map<string, string>>(new Map());

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

  /** Hold this turn's place in the transcript before its text exists. */
  const reserveTurn = useCallback((side: "them" | "you", itemId?: string) => {
    if (!itemId || reservedRef.current.has(itemId)) return;
    const id = `${side}-${itemId}`;
    reservedRef.current.set(itemId, id);
    openTurnRef.current[side] = id;
    setTurns((prev) => [...prev, { id, side, text: "", pending: true }]);
  }, []);

  /** Fill a reserved bubble, wherever it now sits in the transcript. */
  const fillTurn = useCallback(
    (side: "them" | "you", itemId: string | undefined, text: string) => {
      const id = itemId && reservedRef.current.get(itemId);
      if (!id) return false;
      reservedRef.current.delete(itemId!);
      if (openTurnRef.current[side] === id) openTurnRef.current[side] = null;
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, text, pending: false } : t)),
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
        // Merge rather than replace: a later update that only carries a name
        // must not wipe the interest recorded three turns ago.
        if (data.crm.summary) {
          setSummary((prev) => ({ ...(prev ?? {}), ...data.crm!.summary }));
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
   * EVERY call gets a result — including failures, and including the silent
   * `update_call_summary` bookkeeping calls, which would otherwise freeze the
   * conversation mid-sentence the first time she noted down an intent.
   *
   * `respond` is false for the summary tool: it is background note-taking, and
   * asking for a fresh response after one would make her say something for no
   * reason, in the middle of the caller's turn.
   */
  const answerTool = useCallback(
    (fnCallId: string | undefined, output: unknown, respond: boolean) => {
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
      if (respond) channel.send(JSON.stringify({ type: "response.create" }));
    },
    [],
  );

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        // The caller stopped talking and their audio became a conversation
        // item. Its transcription is still in flight, so claim the slot now.
        case "input_audio_buffer.committed":
          reserveTurn("you", event.item_id);
          break;
        case "response.output_item.added":
          if (event.item?.role === "assistant") reserveTurn("them", event.item?.id);
          break;
        case "response.output_audio_transcript.delta":
          setFloor("speaking");
          appendDelta("them", event.delta ?? "");
          break;
        case "response.output_audio_transcript.done":
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
        case "input_audio_buffer.speech_started":
        case "response.done":
          setFloor("listening");
          break;
      }
    },
    [appendDelta, commitTurn, fillTurn, reserveTurn],
  );

  const teardown = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
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
      setEndedReason(reason);
      setState("ended");
      setFloor("listening");
    },
    [teardown, commitTurn],
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
          void relay(event).then((result) => {
            if (!isTool) return;
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
              );
            } else {
              answerTool(event.call_id, { ok: true }, false);
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
        setError(err instanceof Error ? err.message : "Could not connect to Emma. Try again.");
      }
    },
    [teardown, relay, handleEvent, hangup, answerTool],
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
