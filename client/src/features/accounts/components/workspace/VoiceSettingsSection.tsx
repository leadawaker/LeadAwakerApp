import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Play, RefreshCw, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useVoiceSettings, GEMINI_VOICES, type VoiceLang } from "./useVoiceSettings";
import type { AccountRow, VoiceSlot } from "./types";

const DEFAULT_TEST: Record<VoiceLang, string> = {
  en: "Hi, this is a test of the new voice.",
  nl: "Hoi, dit is een test van de nieuwe stem.",
};

// Matches the defaults the migration writes into Accounts.tts_voice_id_{en,nl} —
// only used as a display fallback if a row somehow has no value (shouldn't happen post-migration,
// since the column also gets a DB-level DEFAULT, but keeps the UI honest if it ever does).
const DEFAULT_VOICE: Record<VoiceLang, string> = { en: "Kore", nl: "Aoede" };

function VoiceRow({ v, vs, account, t }: {
  v: VoiceSlot;
  vs: ReturnType<typeof useVoiceSettings>;
  account: AccountRow;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const lang = v.langKey as VoiceLang;
  const voiceField = `tts_voice_id_${lang}`;
  const styleField = `tts_style_${lang}`;
  const [voiceName, setVoiceName] = useState(account[voiceField] || DEFAULT_VOICE[lang]);
  const [style, setStyleText] = useState(account[styleField] || "");
  const [testText, setTestText] = useState(DEFAULT_TEST[lang]);
  const [savingVoice, setSavingVoice] = useState(false);
  const [savingStyle, setSavingStyle] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const testing = vs.testingLang === lang;
  const testUrl = vs.testAudio[lang];
  const testError = vs.testError[lang];

  const onVoiceChange = (name: string) => {
    setVoiceName(name);
    setSavingVoice(true);
    vs.setVoice(lang, name).finally(() => setSavingVoice(false));
  };

  const onStyleBlur = () => {
    setSavingStyle(true);
    vs.setStyle(lang, style).finally(() => setSavingStyle(false));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 13px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
      <div className="row" style={{ gap: 13 }}>
        <span style={{ width: 34, height: 34, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{v.flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-soft)" }}>{v.lang}</span>
        </div>
        <select
          className="neu-input"
          style={{ fontSize: 11, padding: "6px 8px" }}
          value={voiceName}
          disabled={savingVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
        >
          {GEMINI_VOICES.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <textarea
        className="neu-input"
        style={{ fontSize: 11, padding: "7px 10px", minHeight: 44, resize: "vertical" }}
        value={style}
        disabled={savingStyle}
        onChange={(e) => setStyleText(e.target.value)}
        onBlur={onStyleBlur}
        placeholder={t("voice.stylePlaceholder")}
      />

      <div className="row" style={{ gap: 8 }}>
        <input
          className="neu-input"
          style={{ flex: 1, minWidth: 0, fontSize: 11, padding: "7px 10px" }}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && vs.test(lang, testText, voiceName, style)}
          placeholder={DEFAULT_TEST[lang]}
        />
        <button className="la-btn la-btn--soft" disabled={testing || !testText.trim()} onClick={() => vs.test(lang, testText, voiceName, style)}>
          {testing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}{t("voice.generate")}
        </button>
        <button className="la-btn la-btn--soft" disabled={!testUrl || testing} onClick={() => audioRef.current?.play()} title={t("voice.play")}>
          <Play size={12} />{t("voice.play")}
        </button>
      </div>
      {testError && (
        <span style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--danger, #b3261e)" }}>
          {t("voice.generateFailed")}: {testError}
        </span>
      )}
      {testUrl && <audio ref={audioRef} autoPlay src={testUrl} style={{ display: "none" }} />}
    </div>
  );
}

export function VoiceSettingsSection({ account, voices, onSave, stacked = false }: {
  account: AccountRow;
  voices: VoiceSlot[];
  onSave: (field: string, value: string, opts?: { silent?: boolean }) => Promise<void>;
  stacked?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const [expanded, setExpanded] = useState(false);
  const vs = useVoiceSettings(account.Id ?? account.id ?? 0, onSave);

  return (
    <div style={{ marginTop: 4, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: expanded ? 12 : 0 }}>
        <div className="row" style={{ gap: 9 }}>
          <span style={{ color: "var(--wine)", display: "flex" }}><Mic size={16} /></span>
          <h4 className="serif" style={{ margin: 0, fontSize: 18, color: "var(--ink-soft)", fontWeight: 400 }}>{t("panels.voiceClone")}</h4>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ background: "transparent", boxShadow: "none", border: "none", cursor: "pointer", color: "var(--mute-2)", display: "flex", padding: 4 }}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>
      {expanded && (
        <div style={{ display: "grid", gridTemplateColumns: stacked ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {voices.map((v) => <VoiceRow key={v.lang} v={v} vs={vs} account={account} t={t} />)}
        </div>
      )}
    </div>
  );
}
