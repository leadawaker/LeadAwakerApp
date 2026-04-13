import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, Upload, RefreshCw, X, Link, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiUtils";

// ── Constants ─────────────────────────────────────────────────────────────────

export const VOICE_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const VOICE_ACCEPT = "audio/*";

const VOICE_LANGUAGES = ["en", "pt", "nl"] as const;
type VoiceLang = (typeof VOICE_LANGUAGES)[number];
const LANG_LABELS: Record<VoiceLang, string> = { en: "EN", pt: "PT", nl: "NL" };
const LANG_FLAGS: Record<VoiceLang, string> = { en: "🇬🇧", pt: "🇧🇷", nl: "🇳🇱" };
const DEFAULT_TEST_TEXT: Record<VoiceLang, string> = {
  en: "Hi, this is a test of my cloned voice.",
  pt: "Oi, este é um teste da minha voz clonada.",
  nl: "Hoi, dit is een test van mijn gekloonde stem.",
};

// ── VoiceLanguageRow ──────────────────────────────────────────────────────────

type VoiceSample = { data: string; name: string };

function parseVoiceSamples(
  raw: string | null,
  legacyName: string | null,
  voiceIds: Record<VoiceLang, string | null>,
): Partial<Record<VoiceLang, VoiceSample>> {
  if (!raw) return {};

  // New format: JSON blob keyed by language.
  if (raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  // Legacy format: single raw data URL. Infer language from voice_file_name
  // prefix ("en:filename.m4a") or, as a fallback, from the only cloned language.
  if (raw.startsWith("data:")) {
    let lang: VoiceLang | null = null;
    let name = legacyName || "Cloned sample";
    const prefixMatch = legacyName?.match(/^(en|pt|nl):(.*)$/);
    if (prefixMatch) {
      lang = prefixMatch[1] as VoiceLang;
      name = prefixMatch[2];
    } else {
      const cloned = VOICE_LANGUAGES.filter((l) => voiceIds[l]);
      if (cloned.length === 1) lang = cloned[0];
    }
    if (lang) return { [lang]: { data: raw, name } };
  }

  return {};
}

function VoiceLanguageRow({
  lang,
  voiceId,
  sample,
  accountId,
  onSave,
  onSaveSamples,
}: {
  lang: VoiceLang;
  voiceId: string | null;
  sample: VoiceSample | undefined;
  accountId: number;
  onSave: (field: string, value: string) => Promise<void>;
  onSaveSamples: (next: Partial<Record<VoiceLang, VoiceSample>>) => Promise<void>;
}) {
  const { t } = useTranslation("accounts");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState("");
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT[lang]);
  const [testing, setTesting] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasVoice = Boolean(voiceId);

  const handleTest = useCallback(async () => {
    const trimmed = testText.trim();
    if (!trimmed) return;
    setTesting(true);
    setTestAudioUrl(null);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/test-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, language: lang }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert(`Voice test failed: ${result.message || result.error || "Unknown error"}`);
        return;
      }
      if (result.audio_url) {
        setTestAudioUrl(`${result.audio_url}?t=${Date.now()}`);
      }
    } catch (e) {
      console.error("Voice test failed", e);
      alert("Voice test failed. Check console for details.");
    } finally {
      setTesting(false);
    }
  }, [accountId, lang, testText]);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      alert(t("detail.pleaseUploadAudio"));
      return;
    }
    if (file.size > VOICE_MAX_SIZE) {
      alert(t("detail.fileSizeLimit"));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const res = await apiFetch(`/api/accounts/${accountId}/clone-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioDataUrl: dataUrl, language: lang, fileName: file.name }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        alert(`Voice cloning failed: ${result.message || result.error || "Unknown error"}`);
        return;
      }

      // Persist the sample for in-UI playback (per-language JSON blob).
      await onSaveSamples({ [lang]: { data: dataUrl, name: file.name } });

      // Trigger parent refetch so the new voice ID appears immediately.
      // Server already persisted it, but onSave invalidates the account query.
      if (result.model_id) {
        await onSave(`tts_voice_id_${lang}`, result.model_id);
      }
    } catch (e) {
      console.error("Voice upload failed", e);
      alert("Voice upload failed. Check console for details.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [t, accountId, lang, onSave, onSaveSamples]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleManualSave = useCallback(async () => {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    setUploading(true);
    try {
      await onSave(`tts_voice_id_${lang}`, trimmed);
      setManualId("");
      setShowManualInput(false);
    } catch (e) {
      console.error("Manual voice ID save failed", e);
    } finally {
      setUploading(false);
    }
  }, [onSave, lang, manualId]);

  const handleRemove = useCallback(async () => {
    setUploading(true);
    try {
      await onSaveSamples({ [lang]: undefined });
      await onSave(`tts_voice_id_${lang}`, "");
    } catch (e) {
      console.error("Voice remove failed", e);
    } finally {
      setUploading(false);
    }
  }, [onSave, onSaveSamples, lang]);

  return (
    <div className="rounded-lg bg-foreground/[0.02] border border-foreground/[0.06] p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          hasVoice ? "bg-green-500" : "bg-foreground/20"
        )} />
        <span className="text-[12px] font-semibold text-foreground/80">
          <span className="mr-1">{LANG_FLAGS[lang]}</span>
          {LANG_LABELS[lang]}
        </span>
        {hasVoice && (
          <span className="text-[10px] font-mono text-brand-indigo/70 truncate ml-auto max-w-[140px]">
            {voiceId}
          </span>
        )}
      </div>

      {hasVoice ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-foreground/60 truncate flex-1" title={sample?.name}>
              {sample?.name || "Cloned sample"}
            </span>
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="p-1 rounded hover:bg-red-50 text-foreground/40 hover:text-red-500 transition-colors"
              title={t("detail.removeVoice")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {sample?.data && (
            <audio
              controls
              src={sample.data}
              className="w-full h-7 rounded"
              style={{ colorScheme: "light" }}
            />
          )}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
              placeholder={DEFAULT_TEST_TEXT[lang]}
              className="flex-1 text-[11px] bg-white dark:bg-white/5 border border-foreground/[0.08] rounded px-2 py-1 text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-brand-indigo/40"
            />
            <button
              onClick={handleTest}
              disabled={testing || !testText.trim()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-brand-indigo/10 text-brand-indigo rounded hover:bg-brand-indigo/20 disabled:opacity-40 transition-colors"
              title="Test this voice"
            >
              {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              <span>Test</span>
            </button>
          </div>
          {testAudioUrl && (
            <audio
              autoPlay
              controls
              src={testAudioUrl}
              className="w-full h-7 rounded"
              style={{ colorScheme: "light" }}
            />
          )}
        </div>
      ) : showManualInput ? (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSave()}
            placeholder="Fish.audio voice ID"
            className="flex-1 text-[12px] font-mono bg-white dark:bg-white/5 border border-foreground/[0.1] rounded-md px-2 py-1 text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-brand-indigo/40"
          />
          <button
            onClick={handleManualSave}
            disabled={!manualId.trim() || uploading}
            className="px-2 py-1 text-[11px] font-medium bg-brand-indigo text-white rounded-md hover:bg-brand-indigo/90 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => { setShowManualInput(false); setManualId(""); }}
            className="p-1 text-foreground/30 hover:text-foreground/60"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 cursor-pointer transition-colors",
              dragOver
                ? "border-brand-indigo bg-brand-indigo/5"
                : "border-foreground/[0.12] hover:border-foreground/25 hover:bg-foreground/[0.02]",
              uploading && "pointer-events-none opacity-50",
            )}
          >
            {uploading ? (
              <>
                <RefreshCw className="w-3 h-3 text-brand-indigo/60 animate-spin" />
                <span className="text-[11px] text-foreground/50">Cloning...</span>
              </>
            ) : (
              <>
                <Upload className="w-3 h-3 text-foreground/30" />
                <span className="text-[11px] text-foreground/50">Upload audio sample</span>
              </>
            )}
          </div>
          <button
            onClick={() => setShowManualInput(true)}
            className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-foreground/[0.04]"
            title="Paste existing voice ID"
          >
            <Link className="w-3 h-3" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={VOICE_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

// ── VoiceCloneWidget ──────────────────────────────────────────────────────────

export function VoiceCloneWidget({
  ttsVoiceIdEn,
  ttsVoiceIdPt,
  ttsVoiceIdNl,
  voiceFileData,
  voiceFileName,
  accountId,
  onSave,
}: {
  ttsVoiceIdEn: string | null;
  ttsVoiceIdPt: string | null;
  ttsVoiceIdNl: string | null;
  voiceFileData?: string | null;
  voiceFileName?: string | null;
  accountId: number;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const { t } = useTranslation("accounts");

  // voice_file_data is excluded from the list query (large base64).
  // Fetch it directly from the single-account endpoint on mount.
  const [fullVoiceFileData, setFullVoiceFileData] = useState<string | null>(voiceFileData ?? null);

  useEffect(() => {
    if (fullVoiceFileData) return; // already have it (e.g. optimistic update)
    apiFetch(`/api/accounts/${accountId}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = data?.voice_file_data ?? data?.voiceFileData ?? null;
        if (raw) setFullVoiceFileData(raw);
      })
      .catch(() => {}); // non-fatal — player just won't show
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const voiceIds: Record<VoiceLang, string | null> = {
    en: ttsVoiceIdEn,
    pt: ttsVoiceIdPt,
    nl: ttsVoiceIdNl,
  };

  const samples = parseVoiceSamples(fullVoiceFileData, voiceFileName ?? null, voiceIds);

  const handleSaveSamples = useCallback(async (patch: Partial<Record<VoiceLang, VoiceSample>>) => {
    const next = { ...samples, ...patch };
    // Drop empty entries to keep the JSON tidy
    (Object.keys(next) as VoiceLang[]).forEach((k) => {
      if (!next[k]) delete next[k];
    });
    const json = JSON.stringify(next);
    setFullVoiceFileData(json); // optimistic update so player appears immediately
    await onSave("voice_file_data", json);
  }, [samples, onSave]);

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-voice">
      <div className="flex items-center gap-2 mb-3">
        <Mic className="w-5 h-5 text-foreground/50" />
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("detail.voiceClone")}</p>
      </div>

      <div className="space-y-2">
        {VOICE_LANGUAGES.map((lang) => (
          <VoiceLanguageRow
            key={lang}
            lang={lang}
            voiceId={voiceIds[lang]}
            sample={samples[lang]}
            accountId={accountId}
            onSave={onSave}
            onSaveSamples={handleSaveSamples}
          />
        ))}
      </div>
    </div>
  );
}
