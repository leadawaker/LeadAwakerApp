import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiUtils";

export type VoiceLang = "en" | "nl";

export const GEMINI_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
] as const;

export function useVoiceSettings(
  accountId: number,
  onSave: (field: string, value: string, opts?: { silent?: boolean }) => Promise<void>,
) {
  const [testingLang, setTestingLang] = useState<VoiceLang | null>(null);
  const [testAudio, setTestAudio] = useState<Partial<Record<VoiceLang, string>>>({});

  const setVoice = useCallback(async (lang: VoiceLang, voiceName: string) => {
    await onSave(`tts_voice_id_${lang}`, voiceName, { silent: true });
  }, [onSave]);

  const setStyle = useCallback(async (lang: VoiceLang, style: string) => {
    await onSave(`tts_style_${lang}`, style, { silent: true });
  }, [onSave]);

  const test = useCallback(async (lang: VoiceLang, text: string, voiceName: string, style: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTestingLang(lang);
    setTestAudio((prev) => ({ ...prev, [lang]: undefined }));
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/test-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, language: lang, voiceName, style }),
      });
      const result = await res.json();
      if (res.ok && result.success && result.audio_url) {
        setTestAudio((prev) => ({ ...prev, [lang]: `${result.audio_url}?t=${Date.now()}` }));
      }
    } catch (e) {
      console.error("Voice test failed", e);
    } finally {
      setTestingLang(null);
    }
  }, [accountId]);

  return { testingLang, testAudio, setVoice, setStyle, test };
}
