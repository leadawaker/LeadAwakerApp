// Browser MediaRecorder voice-memo capture for LeadDetailPanel notes.
// Records audio, sends it to the transcribe endpoint, and appends the
// transcription into the notes field via the passed-in notes setters.
// Extracted verbatim from LeadDetailPanel.tsx (Session C).
import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface NotesSink {
  setLocalNotes: React.Dispatch<React.SetStateAction<string>>;
  setNotesDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setNotesSaved: React.Dispatch<React.SetStateAction<boolean>>;
  notesOriginalRef: React.MutableRefObject<string>;
}

export function useVoiceRecording(
  leadId: number | string | undefined,
  { setLocalNotes, setNotesDirty, setNotesSaved, notesOriginalRef }: NotesSink,
) {
  const { toast } = useToast();
  const { t } = useTranslation("leads");

  // ── Voice recording state ──
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  // Cleanup voice recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch {} }
    };
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (!leadId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus" : "audio/webm",
      });
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: mr.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          setTranscribing(true);
          try {
            console.log("[voice] Sending audio:", dataUrl.length, "chars, mime:", mr.mimeType);
            const httpRes = await apiFetch(`/api/leads/${leadId}/transcribe-voice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio_data: dataUrl, mime_type: mr.mimeType }),
            });
            const res = await httpRes.json() as any;
            if (!httpRes.ok || res.error) {
              const desc = res.error === "NO_GROQ_API_KEY"
                ? "Groq API key not configured."
                : res.detail || res.error || t("toast.networkError");
              console.error("[voice] Transcription error:", res);
              toast({
                title: t("toast.transcriptionFailed"),
                description: String(desc).slice(0, 200),
                variant: "destructive",
              });
              return;
            }
            if (res.transcription) {
              setLocalNotes((prev) => {
                const separator = prev.trim() ? "\n\n" : "";
                const updated = prev + separator + res.transcription;
                setNotesDirty(updated !== notesOriginalRef.current);
                setNotesSaved(false);
                return updated;
              });
            }
          } catch {
            toast({
              title: t("toast.transcriptionFailed"),
              description: t("toast.networkError"),
              variant: "destructive",
            });
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({
        title: t("toast.microphoneDenied"),
        description: t("toast.microphoneDescription"),
        variant: "destructive",
      });
    }
  }, [leadId, toast]);

  const stopVoiceRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }, []);

  return {
    isRecordingVoice,
    recordingSeconds,
    transcribing,
    startVoiceRecording,
    stopVoiceRecording,
  };
}
