import { useState, useCallback } from "react";
import { Mic, RefreshCw, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiUtils";

const VOICE_LANGUAGES = ["en", "nl"] as const;
type VoiceLang = (typeof VOICE_LANGUAGES)[number];
const LANG_LABELS: Record<VoiceLang, string> = { en: "EN", nl: "NL" };
const LANG_FLAGS: Record<VoiceLang, string> = { en: "🇬🇧", nl: "🇳🇱" };
const DEFAULT_TEST_TEXT: Record<VoiceLang, string> = {
  en: "Hi, this is a test of the new voice.",
  nl: "Hoi, dit is een test van de nieuwe stem.",
};
const DEFAULT_VOICE: Record<VoiceLang, string> = { en: "Kore", nl: "Aoede" };
export const GEMINI_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
] as const;

function VoiceLanguageRow({
  lang,
  voiceId,
  style,
  accountId,
  onSave,
}: {
  lang: VoiceLang;
  voiceId: string | null;
  style: string | null;
  accountId: number;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const [voiceName, setVoiceName] = useState(voiceId || DEFAULT_VOICE[lang]);
  const [styleText, setStyleText] = useState(style || "");
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT[lang]);
  const [testing, setTesting] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

  const handleVoiceChange = useCallback((name: string) => {
    setVoiceName(name);
    void onSave(`tts_voice_id_${lang}`, name);
  }, [lang, onSave]);

  const handleStyleBlur = useCallback(() => {
    void onSave(`tts_style_${lang}`, styleText);
  }, [lang, onSave, styleText]);

  const handleTest = useCallback(async () => {
    const trimmed = testText.trim();
    if (!trimmed) return;
    setTesting(true);
    setTestAudioUrl(null);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/test-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, language: lang, voiceName, style: styleText }),
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
  }, [accountId, lang, testText, voiceName, styleText]);

  return (
    <div className="rounded-lg bg-foreground/[0.02] border border-foreground/[0.06] p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] font-semibold text-foreground/80">
          <span className="mr-1">{LANG_FLAGS[lang]}</span>
          {LANG_LABELS[lang]}
        </span>
        <select
          value={voiceName}
          onChange={(e) => handleVoiceChange(e.target.value)}
          className="ml-auto text-[11px] bg-white dark:bg-white/5 border border-foreground/[0.08] rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:border-brand-indigo/40"
        >
          {GEMINI_VOICES.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <textarea
        value={styleText}
        onChange={(e) => setStyleText(e.target.value)}
        onBlur={handleStyleBlur}
        placeholder="e.g. Speak warmly, at a relaxed conversational pace"
        className="w-full text-[11px] bg-white dark:bg-white/5 border border-foreground/[0.08] rounded px-2 py-1 mb-1.5 text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-brand-indigo/40 resize-y min-h-[36px]"
      />

      <div className="flex items-center gap-1.5">
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
          className="w-full h-7 rounded mt-1.5"
          style={{ colorScheme: "light" }}
        />
      )}
    </div>
  );
}

export function VoiceCloneWidget({
  ttsVoiceIdEn,
  ttsVoiceIdNl,
  ttsStyleEn,
  ttsStyleNl,
  accountId,
  onSave,
}: {
  ttsVoiceIdEn: string | null;
  ttsVoiceIdNl: string | null;
  ttsStyleEn: string | null;
  ttsStyleNl: string | null;
  accountId: number;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const { t } = useTranslation("accounts");
  const voiceIds: Record<VoiceLang, string | null> = { en: ttsVoiceIdEn, nl: ttsVoiceIdNl };
  const styles: Record<VoiceLang, string | null> = { en: ttsStyleEn, nl: ttsStyleNl };

  return (
    <div className="bg-card shadow-[var(--card-glow)] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-voice">
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
            style={styles[lang]}
            accountId={accountId}
            onSave={onSave}
          />
        ))}
      </div>
    </div>
  );
}
