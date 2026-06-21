import { useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/apiUtils";

/**
 * Module-level singleton (not React state) so a recording survives SPA
 * navigation — every page wraps itself in its own <CrmShell>, so any state
 * held inside a page component (including RightSidebar) is torn down on
 * route change. Living outside the component tree is the only way the mic
 * can keep recording while the owner moves between pages.
 */

export const MAX_RECORDING_SECONDS = 300;

export type VoiceRecorderState = {
  recording: boolean;
  transcribing: boolean;
  elapsedSeconds: number;
};

let state: VoiceRecorderState = { recording: false, transcribing: false, elapsedSeconds: 0 };
const listeners = new Set<() => void>();

function setState(partial: Partial<VoiceRecorderState>) {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): VoiceRecorderState {
  return state;
}

export function useVoiceRecorderState(): VoiceRecorderState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let activeStream: MediaStream | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function emitResult(detail: { text?: string; error?: string }) {
  window.dispatchEvent(new CustomEvent("leadawaker-voice-note-result", { detail }));
}

async function transcribeAndCopy(blob: Blob, mimeType: string) {
  setState({ transcribing: true });
  try {
    const audio_data = await blobToBase64(blob);
    const res = await apiFetch("/api/user/voice-note/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_data, mime_type: mimeType }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      emitResult({ error: data.message || data.error || "Transcription failed" });
      return;
    }
    const text = (data.transcription || "").trim();
    if (!text) {
      emitResult({ error: "No speech detected" });
      return;
    }
    await navigator.clipboard.writeText(text);
    emitResult({ text });
  } catch {
    emitResult({ error: "Transcription failed" });
  } finally {
    setState({ transcribing: false });
  }
}

export async function startVoiceRecording() {
  if (state.recording) return;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    emitResult({ error: "Microphone access denied" });
    return;
  }

  activeStream = stream;
  audioChunks = [];
  const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
  mediaRecorder = new MediaRecorder(stream, { mimeType });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(audioChunks, { type: mimeType });
    activeStream?.getTracks().forEach((t) => t.stop());
    activeStream = null;
    void transcribeAndCopy(blob, mimeType);
  };
  mediaRecorder.start();
  setState({ recording: true, elapsedSeconds: 0 });

  timerInterval = setInterval(() => {
    const next = state.elapsedSeconds + 1;
    if (next >= MAX_RECORDING_SECONDS) {
      setState({ elapsedSeconds: MAX_RECORDING_SECONDS });
      stopVoiceRecording();
    } else {
      setState({ elapsedSeconds: next });
    }
  }, 1000);
}

export function stopVoiceRecording() {
  clearTimer();
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  setState({ recording: false });
}

export function toggleVoiceRecording() {
  if (state.recording) stopVoiceRecording();
  else void startVoiceRecording();
}
