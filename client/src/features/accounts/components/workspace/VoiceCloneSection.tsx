import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Play, Upload, X, RefreshCw, ChevronDown, ChevronRight, Link, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PanelAction } from "./atoms";
import { useVoiceClone, type VoiceLang } from "./useVoiceClone";
import type { AccountRow, VoiceSlot } from "./types";

const DEFAULT_TEST: Record<VoiceLang, string> = {
  en: "Hi, this is a test of my cloned voice.",
  nl: "Hoi, dit is een test van mijn gekloonde stem.",
};

function VoiceRow({ v, vc, account, onSave, t }: {
  v: VoiceSlot;
  vc: ReturnType<typeof useVoiceClone>;
  account: AccountRow;
  onSave: (field: string, value: string) => Promise<void>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [testText, setTestText] = useState(DEFAULT_TEST[v.langKey]);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState("");
  const sample = vc.samples[v.langKey];
  const busy = vc.busyLang === v.langKey;
  const testing = vc.testingLang === v.langKey;
  const testUrl = vc.testAudio[v.langKey];
  const quality = vc.quality[v.langKey];

  useEffect(() => {
    if (v.ready && quality === undefined) vc.checkQuality(v.langKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.ready, v.langKey]);

  const saveManualId = () => {
    if (busy || !manualId.trim()) return;
    vc.saveManualId(v.langKey, manualId).then((err) => {
      if (err) return;
      setManualId("");
      setShowManualInput(false);
    });
  };

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 13px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
      <div className="row" style={{ gap: 13 }}>
        <span style={{ width: 34, height: 34, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{v.flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-soft)" }}>{v.lang}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: v.ready ? "var(--good)" : "var(--mute-2)" }}>{v.ready ? `● ${t("voice.ready")}` : `○ ${t("voice.noSample")}`}</span>
          </div>
          {v.ready && sample?.name && <div style={{ fontSize: 11.5, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>{sample.name}</div>}
          {v.ready && quality === "checking" && (
            <div style={{ fontSize: 10.5, color: "var(--mute-2)", fontFamily: "var(--mono)" }}>{t("voice.qualityChecking")}</div>
          )}
          {v.ready && quality && quality !== "checking" && quality.passed !== null && (
            <div className="row" style={{ gap: 4, fontSize: 10.5, fontFamily: "var(--mono)", color: quality.passed ? "var(--good)" : "var(--warn)" }} title={quality.reason ?? undefined}>
              {quality.passed ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {quality.passed ? t("voice.qualityGood") : `${t("voice.qualityPoor")}${quality.reason ? `: ${quality.reason}` : ""}`}
              </span>
            </div>
          )}
        </div>
        {v.ready ? (
          <button className="la-btn la-btn--soft la-btn--icon" disabled={busy} onClick={() => vc.remove(v.langKey)} title={t("detail.removeVoice")}>
            {busy ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
          </button>
        ) : (
          <>
            <button className="la-btn la-btn--soft" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}{t("voice.upload")}
            </button>
            <button className="la-btn la-btn--soft la-btn--icon" disabled={busy} onClick={() => setShowManualInput((s) => !s)} title={t("voice.pasteId")}>
              <Link size={12} />
            </button>
          </>
        )}
      </div>

      {!v.ready && showManualInput && (
        <div className="row" style={{ gap: 8 }}>
          <input
            className="neu-input"
            style={{ flex: 1, minWidth: 0, fontSize: 11, fontFamily: "var(--mono)", padding: "7px 10px" }}
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveManualId()}
            placeholder={t("voice.pasteIdPlaceholder")}
          />
          <button className="la-btn la-btn--soft" disabled={busy || !manualId.trim()} onClick={saveManualId}>
            {busy ? <RefreshCw size={12} className="animate-spin" /> : t("voice.save")}
          </button>
          <button className="la-btn la-btn--soft la-btn--icon" onClick={() => { setShowManualInput(false); setManualId(""); }} title={t("voice.cancel")}>
            <X size={12} />
          </button>
        </div>
      )}

      {v.ready && sample?.data && (
        <audio controls src={sample.data} style={{ width: "100%", height: 30, borderRadius: 6, colorScheme: "light" }} />
      )}

      {v.ready && <VoiceTuning account={account} langKey={v.langKey} onSave={onSave} t={t} />}

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

const PACE_STEPS = [
  { value: 0.85, key: "slower" },
  { value: 1, key: "normal" },
  { value: 1.15, key: "faster" },
] as const;

function VoiceTuning({ account, langKey, onSave, t }: {
  account: AccountRow;
  langKey: VoiceLang;
  onSave: (field: string, value: string, opts?: { silent?: boolean }) => Promise<void>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const speedField = `tts_speed_${langKey}`;
  const temperatureField = `tts_temperature_${langKey}`;
  const savedSpeed = account[speedField] ? parseFloat(account[speedField]) : 1;
  const savedTemp = account[temperatureField] ? parseFloat(account[temperatureField]) : 0.7;
  const [temp, setTemp] = useState(savedTemp);
  const [savingSpeed, setSavingSpeed] = useState(false);
  const [savingTemp, setSavingTemp] = useState(false);

  const commitTemp = (value: number) => {
    setSavingTemp(true);
    onSave(temperatureField, value.toFixed(2), { silent: true }).finally(() => setSavingTemp(false));
  };

  const expressivenessLabel = temp <= 0.5 ? t("voice.expressiveness.calm") : temp >= 0.85 ? t("voice.expressiveness.animated") : t("voice.expressiveness.balanced");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 13px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-soft)" }}>{t("voice.paceLabel")}</span>
        <div className="row" style={{ gap: 6 }}>
          {PACE_STEPS.map((step) => (
            <button
              key={step.key}
              disabled={savingSpeed}
              onClick={() => { setSavingSpeed(true); onSave(speedField, step.value.toFixed(2), { silent: true }).finally(() => setSavingSpeed(false)); }}
              className={`la-btn la-btn--soft${Math.abs(savedSpeed - step.value) < 0.01 ? " on" : ""}`}
              style={{ fontSize: 10.5, padding: "4px 10px" }}
            >
              {t(`voice.pace.${step.key}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-soft)" }}>{t("voice.expressivenessLabel")}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)" }}>{expressivenessLabel}</span>
      </div>
      <input
        type="range"
        min={0.3}
        max={1}
        step={0.05}
        value={temp}
        disabled={savingTemp}
        onChange={(e) => setTemp(parseFloat(e.target.value))}
        onMouseUp={(e) => commitTemp(parseFloat((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => commitTemp(parseFloat((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => commitTemp(parseFloat((e.target as HTMLInputElement).value))}
        style={{ width: "100%", accentColor: "var(--wine)" }}
      />
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
  const [expanded, setExpanded] = useState(false);
  const voiceIds = {
    en: account.tts_voice_id_en ?? null,
    nl: account.tts_voice_id_nl ?? null,
  };
  const vc = useVoiceClone(account.Id ?? account.id ?? 0, voiceIds, account.voice_file_name ?? null, onSave);
  const ready = voices.filter((v) => v.ready).length;

  return (
    <div style={{ marginTop: 4, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: expanded ? 12 : 0 }}>
        <div className="row" style={{ gap: 9 }}>
          <span style={{ color: "var(--wine)", display: "flex" }}><Mic size={16} /></span>
          <h4 className="serif" style={{ margin: 0, fontSize: 18, color: "var(--ink-soft)", fontWeight: 400 }}>{t("panels.voiceClone")}</h4>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)", background: "var(--bg)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t("voice.ratioReady", { ready, total: voices.length })}</span>
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
          {voices.map((v) => <VoiceRow key={v.lang} v={v} vc={vc} account={account} onSave={onSave} t={t} />)}
        </div>
      )}
    </div>
  );
}
