// Record a spoken topic and turn it into text, for the topic box. Same MediaRecorder and base64 path as
// the nav-bar voice note (lib/voiceRecorder.ts), but local to the component and sent to the Socials
// endpoint, which Managers may use and which transcribes in the account's language. Saves nothing.
import { useEffect, useRef, useState } from "react";
import { SocialApiError } from "../api/socialApi";
import { transcribeTopic } from "../api/studioApi";

export const MAX_TOPIC_SECONDS = 120;

export type RecorderState = "idle" | "recording" | "transcribing";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useTopicRecorder(accountId: number, onText: (text: string) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  // Leaving the screen mid-recording releases the microphone and sends nothing.
  useEffect(() => () => {
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    stopTracks();
  }, []);

  async function start() {
    if (state !== "idle") return;
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("mic_denied");
      return;
    }
    const chunks: Blob[] = [];
    let mimeType = "audio/webm";
    let rec: MediaRecorder;
    try {
      // Some in-app browsers have no MediaRecorder, or not for these types: release the mic and say so.
      mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      rec = new MediaRecorder(stream.current, { mimeType });
    } catch {
      stopTracks();
      setError("no_recorder");
      return;
    }
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      stopTracks();
      setState("transcribing");
      try {
        const { text } = await transcribeTopic(accountId, await blobToBase64(new Blob(chunks, { type: mimeType })), mimeType);
        onTextRef.current(text);
      } catch (err) {
        setError(err instanceof SocialApiError ? err.reason : "transcribe_failed");
      } finally {
        setState("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setElapsed(0);
    setState("recording");
    timer.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= MAX_TOPIC_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }

  return { state, elapsed, error, start, stop };
}
