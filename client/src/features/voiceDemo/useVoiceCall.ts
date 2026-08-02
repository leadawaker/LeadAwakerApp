import { useCallback, useRef, useState } from "react";
import type { CallSetup, CallState, CrmReceipt, Floor, Turn } from "./types";

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

export const DEFAULT_COMPANY = "Brightside Solar";
export const PHONE_STORAGE_KEY = "leadawaker.voiceDemo.callerNumber";

interface RealtimeEvent {
  type?: string;
  delta?: string;
  transcript?: string;
  name?: string;
  call_id?: string;
}

export function useVoiceCall() {
  const [state, setState] = useState<CallState>("idle");
  const [floor, setFloor] = useState<Floor>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [receipts, setReceipts] = useState<CrmReceipt[]>([]);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string>("");
  const callerNumberRef = useRef<string>("");
  // Index of the bubble each side is still streaming into, so deltas append
  // to one turn instead of spawning a turn per fragment.
  const openTurnRef = useRef<{ them: string | null; you: string | null }>({
    them: null,
    you: null,
  });

  const appendDelta = useCallback((side: "them" | "you", delta: string) => {
    if (!delta) return;
    setTurns((prev) => {
      const openId = openTurnRef.current[side];
      if (openId) {
        return prev.map((t) => (t.id === openId ? { ...t, text: t.text + delta } : t));
      }
      const id = `${side}-${Date.now()}-${Math.random()}`;
      openTurnRef.current[side] = id;
      return [...prev, { id, side, text: delta, pending: true }];
    });
  }, []);

  const commitTurn = useCallback((side: "them" | "you", finalText?: string) => {
    setTurns((prev) => {
      const openId = openTurnRef.current[side];
      if (!openId) {
        if (!finalText) return prev;
        return [
          ...prev,
          { id: `${side}-${Date.now()}`, side, text: finalText, pending: false },
        ];
      }
      return prev.map((t) =>
        t.id === openId
          ? { ...t, text: finalText ?? t.text, pending: false }
          : t,
      );
    });
    openTurnRef.current[side] = null;
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
          event,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { crm: CrmReceipt | null };
      if (data.crm) {
        setReceipts((prev) => [...prev, data.crm as CrmReceipt]);
        if (data.crm.lead_id) setLeadId(data.crm.lead_id);
      }
      return data;
    } catch {
      // A dropped relay must never disturb a live call.
      return null;
    }
  }, []);

  /**
   * A tool call stalls the session until it is answered, so every
   * book_appointment call gets a result, including failures. Emma's prompt
   * covers how to recover from each outcome out loud.
   */
  const answerBookingCall = useCallback(
    (fnCallId: string | undefined, receipt: CrmReceipt | null | undefined) => {
      const channel = channelRef.current;
      if (!channel || channel.readyState !== "open" || !fnCallId) return;
      const outcome = receipt?.booked_slot
        ? { status: "booked", slot: receipt.booked_slot }
        : {
            status: "not_booked",
            detail:
              "The diary could not confirm this slot. Take it as a message and promise a callback.",
          };
      channel.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: fnCallId,
            output: JSON.stringify(outcome),
          },
        }),
      );
      channel.send(JSON.stringify({ type: "response.create" }));
    },
    [],
  );

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case "response.output_audio_transcript.delta":
          setFloor("speaking");
          appendDelta("them", event.delta ?? "");
          break;
        case "response.output_audio_transcript.done":
          commitTurn("them", event.transcript);
          break;
        case "conversation.item.input_audio_transcription.delta":
          appendDelta("you", event.delta ?? "");
          break;
        case "conversation.item.input_audio_transcription.completed":
          commitTurn("you", event.transcript);
          break;
        case "input_audio_buffer.speech_started":
        case "response.done":
          setFloor("listening");
          break;
      }
    },
    [appendDelta, commitTurn],
  );

  const teardown = useCallback(() => {
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

  const hangup = useCallback(() => {
    teardown();
    commitTurn("them");
    commitTurn("you");
    setState("ended");
    setFloor("listening");
  }, [teardown, commitTurn]);

  const reset = useCallback(() => {
    teardown();
    setTurns([]);
    setReceipts([]);
    setLeadId(null);
    setStartedAt(null);
    setError(null);
    openTurnRef.current = { them: null, you: null };
    setState("idle");
  }, [teardown]);

  const start = useCallback(
    async (setup: CallSetup) => {
      setError(null);
      setTurns([]);
      setReceipts([]);
      setLeadId(null);
      openTurnRef.current = { them: null, you: null };

      const companyName = setup.companyName.trim() || DEFAULT_COMPANY;
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
        };

        channel.onmessage = (e) => {
          let event: RealtimeEvent;
          try {
            event = JSON.parse(e.data);
          } catch {
            return;
          }
          const isBooking =
            event.type === "response.function_call_arguments.done" &&
            event.name === "book_appointment";
          void relay(event).then((result) => {
            if (isBooking) answerBookingCall(event.call_id, result?.crm);
          });
          handleEvent(event);
        };

        channel.onclose = () => {
          if (pcRef.current) hangup();
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
    [teardown, relay, handleEvent, hangup, answerBookingCall],
  );

  return {
    state,
    floor,
    error,
    turns,
    receipts,
    leadId,
    company,
    startedAt,
    audioRef,
    start,
    hangup,
    reset,
  };
}
