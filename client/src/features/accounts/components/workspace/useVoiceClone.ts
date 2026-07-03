import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiUtils";

export const VOICE_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export type VoiceLang = "en" | "pt" | "nl";
export type VoiceSample = { data: string; name: string };
export type VoiceQuality = { passed: boolean | null; reason: string | null };

const LANGS: VoiceLang[] = ["en", "pt", "nl"];

// Port of VoiceCloneWidget.parseVoiceSamples (new JSON blob + legacy single URL).
function parseVoiceSamples(raw: string | null, legacyName: string | null, voiceIds: Record<VoiceLang, string | null>): Partial<Record<VoiceLang, VoiceSample>> {
  if (!raw) return {};
  if (raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {}; }
  }
  if (raw.startsWith("data:")) {
    let lang: VoiceLang | null = null;
    let name = legacyName || "Cloned sample";
    const prefixMatch = legacyName?.match(/^(en|pt|nl):(.*)$/);
    if (prefixMatch) { lang = prefixMatch[1] as VoiceLang; name = prefixMatch[2]; }
    else { const cloned = LANGS.filter((l) => voiceIds[l]); if (cloned.length === 1) lang = cloned[0]; }
    if (lang) return { [lang]: { data: raw, name } };
  }
  return {};
}

export function useVoiceClone(
  accountId: number,
  voiceIds: Record<VoiceLang, string | null>,
  voiceFileName: string | null,
  onSave: (field: string, value: string) => Promise<void>,
) {
  const [fullVoiceFileData, setFullVoiceFileData] = useState<string | null>(null);
  const [busyLang, setBusyLang] = useState<VoiceLang | null>(null);
  const [testingLang, setTestingLang] = useState<VoiceLang | null>(null);
  const [testAudio, setTestAudio] = useState<Partial<Record<VoiceLang, string>>>({});
  const [quality, setQuality] = useState<Partial<Record<VoiceLang, VoiceQuality | "checking">>>({});

  useEffect(() => {
    if (fullVoiceFileData) return;
    apiFetch(`/api/accounts/${accountId}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = data?.voice_file_data ?? data?.voiceFileData ?? null;
        if (raw) setFullVoiceFileData(raw);
      })
      .catch(() => {});
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const samples = parseVoiceSamples(fullVoiceFileData, voiceFileName, voiceIds);

  const saveSamples = useCallback(async (patch: Partial<Record<VoiceLang, VoiceSample | undefined>>) => {
    const next: Partial<Record<VoiceLang, VoiceSample>> = { ...samples, ...patch };
    (Object.keys(next) as VoiceLang[]).forEach((k) => { if (!next[k]) delete next[k]; });
    const json = JSON.stringify(next);
    setFullVoiceFileData(json);
    await onSave("voice_file_data", json);
  }, [samples, onSave]);

  const checkQuality = useCallback(async (lang: VoiceLang) => {
    setQuality((prev) => ({ ...prev, [lang]: "checking" }));
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/voice-quality/${lang}`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        setQuality((prev) => ({ ...prev, [lang]: { passed: null, reason: result.message || result.error || null } }));
        return;
      }
      setQuality((prev) => ({ ...prev, [lang]: { passed: result.quality_passed, reason: result.quality_reason } }));
    } catch (e) {
      console.error("Voice quality check failed", e);
      setQuality((prev) => ({ ...prev, [lang]: { passed: null, reason: null } }));
    }
  }, [accountId]);

  const upload = useCallback(async (lang: VoiceLang, file: File): Promise<string | null> => {
    if (!file.type.startsWith("audio/")) return "audio";
    if (file.size > VOICE_MAX_SIZE) return "size";
    setBusyLang(lang);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch(`/api/accounts/${accountId}/clone-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioDataUrl: dataUrl, language: lang, fileName: file.name }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) return result.message || result.error || "Voice cloning failed";
      await saveSamples({ [lang]: { data: dataUrl, name: file.name } });
      if (result.model_id) {
        await onSave(`tts_voice_id_${lang}`, result.model_id);
        void checkQuality(lang);
      }
      return null;
    } catch (e) {
      console.error("Voice upload failed", e);
      return "Voice upload failed";
    } finally {
      setBusyLang(null);
    }
  }, [accountId, onSave, saveSamples, checkQuality]);

  const remove = useCallback(async (lang: VoiceLang) => {
    setBusyLang(lang);
    try {
      await saveSamples({ [lang]: undefined });
      await onSave(`tts_voice_id_${lang}`, "");
    } finally {
      setBusyLang(null);
    }
  }, [onSave, saveSamples]);

  const saveManualId = useCallback(async (lang: VoiceLang, id: string): Promise<string | null> => {
    const trimmed = id.trim();
    if (!trimmed) return "empty";
    setBusyLang(lang);
    try {
      await onSave(`tts_voice_id_${lang}`, trimmed);
      return null;
    } catch (e) {
      console.error("Manual voice ID save failed", e);
      return "Voice ID save failed";
    } finally {
      setBusyLang(null);
    }
  }, [onSave]);

  const test = useCallback(async (lang: VoiceLang, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTestingLang(lang);
    setTestAudio((prev) => ({ ...prev, [lang]: undefined }));
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/test-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, language: lang }),
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

  return { samples, busyLang, testingLang, testAudio, quality, upload, remove, saveManualId, test, checkQuality };
}
