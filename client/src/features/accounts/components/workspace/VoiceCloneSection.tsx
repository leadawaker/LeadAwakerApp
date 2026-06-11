import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Play, Upload, X, RefreshCw } from "lucide-react";
import { PanelAction } from "./atoms";
import { useVoiceClone, type VoiceLang } from "./useVoiceClone";
import type { AccountRow, VoiceSlot } from "./types";

const DEFAULT_TEST: Record<VoiceLang, string> = {
  en: "Hi, this is a test of my cloned voice.",
  pt: "Oi, este é um teste da minha voz clonada.",
  nl: "Hoi, dit is een test van mijn gekloonde stem.",
};

function VoiceRow({ v, vc, t }: { v: VoiceSlot; vc: ReturnType<typeof useVoiceClone>; t: ReturnType<typeof useTranslation>["t"] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [testText, setTestText] = useState(DEFAULT_TEST[v.langKey]);
  const sample = vc.samples[v.langKey];
  const busy = vc.busyLang === v.langKey;
  const testing = vc.testingLang === v.langKey;
  const testUrl = vc.testAudio[v.langKey];

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      vc.upload(v.langKey, file).then((err) => {
        if (err === "audio") alert(t("detail.pleaseUploadAudio"));
        else if (err === "size") alert(t("detail.fileSizeLimit"));
      });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 13px", borderRadius: "var(--r-surface)", background: v.ready ? "var(--surface)" : "var(--bg)", boxShadow: v.ready ? "var(--sh-raised-crisp)" : "var(--sh-inset-crisp)" }}>
      <div className="row" style={{ gap: 13 }}>
        <span style={{ width: 34, height: 34, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{v.flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-soft)" }}>{v.lang}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: v.ready ? "var(--good)" : "var(--mute-2)" }}>{v.ready ? `● ${t("voice.ready")}` : `○ ${t("voice.noSample")}`}</span>
          </div>
          {v.ready && sample?.name && <div style={{ fontSize: 11.5, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>{sample.name}</div>}
        </div>
        {v.ready ? (
          <button className="la-btn la-btn--soft la-btn--icon" disabled={busy} onClick={() => vc.remove(v.langKey)} title={t("detail.removeVoice")}>
            {busy ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
          </button>
        ) : (
          <button className="la-btn la-btn--soft" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}{t("voice.upload")}
          </button>
        )}
      </div>

      {v.ready && sample?.data && (
        <audio controls src={sample.data} style={{ width: "100%", height: 30, borderRadius: 6, colorScheme: "light" }} />
      )}

      {v.ready && (
        <div className="row" style={{ gap: 8 }}>
          <input
            className="neu-input"
            style={{ flex: 1, minWidth: 0, fontSize: 11, padding: "7px 10px" }}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && vc.test(v.langKey, testText)}
            placeholder={DEFAULT_TEST[v.langKey]}
          />
          <button className="la-btn la-btn--soft" disabled={testing || !testText.trim()} onClick={() => vc.test(v.langKey, testText)}>
            {testing ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}{t("voice.test")}
          </button>
        </div>
      )}
      {testUrl && <audio autoPlay controls src={testUrl} style={{ width: "100%", height: 30, borderRadius: 6, colorScheme: "light" }} />}

      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onPick} />
    </div>
  );
}

export function VoiceCloneSection({ account, voices, onSave, stacked = false }: {
  account: AccountRow;
  voices: VoiceSlot[];
  onSave: (field: string, value: string) => Promise<void>;
  stacked?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const voiceIds = {
    en: account.tts_voice_id_en ?? null,
    pt: account.tts_voice_id_pt ?? null,
    nl: account.tts_voice_id_nl ?? null,
  };
  const vc = useVoiceClone(account.Id ?? account.id ?? 0, voiceIds, account.voice_file_name ?? null, onSave);
  const ready = voices.filter((v) => v.ready).length;

  return (
    <div style={{ marginTop: 4, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div className="row" style={{ gap: 9 }}>
          <span style={{ color: "var(--wine)", display: "flex" }}><Mic size={16} /></span>
          <h4 className="serif" style={{ margin: 0, fontSize: 18, color: "var(--ink-soft)", fontWeight: 400 }}>{t("panels.voiceClone")}</h4>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t("voice.ratioReady", { ready, total: voices.length })}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: stacked ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        {voices.map((v) => <VoiceRow key={v.lang} v={v} vc={vc} t={t} />)}
      </div>
    </div>
  );
}
