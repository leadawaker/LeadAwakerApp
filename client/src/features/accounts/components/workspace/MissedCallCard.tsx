// Missed-Call Text-Back provisioning card (Accounts → Integrations).
// A forwarded missed call → instant WhatsApp text-back from the client's own number → AI chat.
// Spec: specs/missed-call-textback. Config is read by the engine voice webhook at call time.
import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PhoneMissed, Copy, Check, Loader2, Mic, Square, Upload, Trash2, Sparkles, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ConnectedPill } from "./atoms";
import {
  fetchMissedCallStatus, saveMissedCall, uploadGreeting, generateGreetingTts, deleteGreeting,
  greetingPreviewUrl, type MissedCallStatus,
} from "../../api/missedCallApi";
import { apiFetch } from "@/lib/apiUtils";

const TTS_LOCALES = ["nl", "en", "pt"] as const;
const MONO = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)" } as const;

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)" }}>
      {children}
    </span>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="row" style={{ gap: 12, padding: "6px 0" }}>
      <div style={{ width: 110, flexShrink: 0, ...MONO }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--ink-soft)", fontFamily: "var(--mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      <button className="la-btn la-btn--icon" onClick={copy} style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)" }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

export function MissedCallCard({ accountId }: { accountId: number }) {
  const { t } = useTranslation("accounts");
  const [status, setStatus] = useState<MissedCallStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Greeting authoring state.
  const [recording, setRecording] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [ttsLocale, setTtsLocale] = useState<(typeof TTS_LOCALES)[number]>("nl");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accountId) return;
    fetchMissedCallStatus(accountId).then(setStatus).catch(() => {}).finally(() => setLoaded(true));
  }, [accountId]);

  // Load the greeting preview as an authenticated blob (works cross-origin on Vercel).
  const refreshPreview = useCallback(async (has: boolean) => {
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (!has) return;
    try {
      const res = await apiFetch(`${greetingPreviewUrl(accountId)}?t=${Date.now()}`);
      if (res.ok) setPreviewUrl(URL.createObjectURL(await res.blob()));
    } catch { /* ignore */ }
  }, [accountId]);

  useEffect(() => { if (status) void refreshPreview(status.hasGreeting); }, [status?.hasGreeting]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (fn: () => Promise<MissedCallStatus>) => {
    setBusy(true); setError(null);
    try { setStatus(await fn()); }
    catch (e: any) { setError(e.message || t("missedCall.saveFailed")); }
    finally { setBusy(false); }
  };

  const save = (p: Parameters<typeof saveMissedCall>[1]) => patch(() => saveMissedCall(accountId, p));

  // ── Greeting: record in browser ────────────────────────────────────────────
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((tk) => tk.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const dataUrl = await blobToDataUrl(blob);
        await patch(() => uploadGreeting(accountId, dataUrl, "recording.webm"));
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError(t("missedCall.micDenied"));
    }
  };
  const stopRecording = () => { mediaRef.current?.stop(); setRecording(false); };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) { setError(t("missedCall.notAudio")); return; }
    const dataUrl = await blobToDataUrl(file);
    await patch(() => uploadGreeting(accountId, dataUrl, file.name));
  };

  if (!loaded || !status) return null;

  const noCampaign = status.campaigns.length === 0;
  const voiceMode = status.greetingMode === "voice";

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <IconTile><PhoneMissed size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("missedCall.title")}</span>
        <ConnectedPill on={status.enabled} connectedLabel={t("missedCall.on")} notSetLabel={t("missedCall.off")} />
        <Switch checked={status.enabled} disabled={busy} onCheckedChange={(v) => save({ enabled: v })} />
      </div>

      <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: status.enabled ? 18 : 0, lineHeight: 1.5 }}>
        {t("missedCall.explainer")}
      </p>

      {status.enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Number + forwarding instructions */}
          <div>
            <div style={{ ...MONO, marginBottom: 8 }}>{t("missedCall.forwardingTitle")}</div>
            {status.number ? (
              <>
                <CopyRow label={t("missedCall.voiceNumber")} value={status.number} />
                {status.forwardCode && <CopyRow label={t("missedCall.forwardCode")} value={status.forwardCode} />}
                <p style={{ fontSize: 10.5, color: "var(--mute)", fontStyle: "italic", marginTop: 6 }}>{t("missedCall.forwardingHint")}</p>
              </>
            ) : (
              <p style={{ fontSize: 11.5, color: "var(--wine)" }}>{t("missedCall.noNumber")}</p>
            )}
          </div>

          {/* Campaign selector */}
          <div>
            <div style={{ ...MONO, marginBottom: 5 }}>{t("missedCall.campaign")}</div>
            {noCampaign ? (
              <p style={{ fontSize: 11.5, color: "var(--wine)" }}>{t("missedCall.noCampaign")}</p>
            ) : (
              <select
                className="neu-input"
                style={{ fontSize: 12, padding: "8px 11px", width: "100%" }}
                value={status.campaignId ?? ""}
                disabled={busy}
                onChange={(e) => save({ campaignId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">{t("missedCall.selectCampaign")}</option>
                {status.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {/* Greeting mode */}
          <div>
            <div style={{ ...MONO, marginBottom: 8 }}>{t("missedCall.greeting")}</div>
            <div className="row" style={{ gap: 8, marginBottom: voiceMode ? 12 : 0 }}>
              {(["silent", "voice"] as const).map((m) => (
                <button
                  key={m}
                  className={`la-btn ${status.greetingMode === m ? "la-btn--wine" : "la-btn--soft"}`}
                  disabled={busy}
                  onClick={() => save({ greetingMode: m })}
                  style={{ fontSize: 11.5 }}
                >
                  {t(`missedCall.mode.${m}`)}
                </button>
              ))}
            </div>

            {voiceMode && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 13px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
                {/* record / upload */}
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {recording ? (
                    <button className="la-btn la-btn--wine" onClick={stopRecording} style={{ fontSize: 11.5 }}>
                      <Square size={12} />{t("missedCall.stop")}
                    </button>
                  ) : (
                    <button className="la-btn la-btn--soft" disabled={busy} onClick={startRecording} style={{ fontSize: 11.5 }}>
                      <Mic size={12} />{t("missedCall.record")}
                    </button>
                  )}
                  <button className="la-btn la-btn--soft" disabled={busy || recording} onClick={() => fileRef.current?.click()} style={{ fontSize: 11.5 }}>
                    <Upload size={12} />{t("missedCall.upload")}
                  </button>
                  {status.hasGreeting && (
                    <button className="la-btn la-btn--soft" disabled={busy} onClick={() => patch(() => deleteGreeting(accountId))} style={{ fontSize: 11.5 }}>
                      <Trash2 size={12} />{t("missedCall.removeGreeting")}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onPickFile} />
                </div>

                {/* preview */}
                {status.hasGreeting && previewUrl && (
                  <audio controls src={previewUrl} style={{ width: "100%", height: 32, borderRadius: 6, colorScheme: "light" }} />
                )}
                {status.hasGreeting && status.greetingFileName && (
                  <div style={{ fontSize: 10.5, color: "var(--mute)", fontStyle: "italic" }}>{status.greetingFileName}</div>
                )}

                {/* TTS from cloned voice */}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                    <Sparkles size={12} style={{ color: "var(--wine)" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)" }}>{t("missedCall.ttsTitle")}</span>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      className="neu-input"
                      style={{ flex: 1, minWidth: 0, fontSize: 11.5, padding: "8px 11px" }}
                      value={ttsText}
                      placeholder={t("missedCall.ttsPlaceholder")}
                      onChange={(e) => setTtsText(e.target.value)}
                    />
                    <select className="neu-input" style={{ fontSize: 11.5, padding: "8px 9px" }} value={ttsLocale} onChange={(e) => setTtsLocale(e.target.value as any)}>
                      {TTS_LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                    </select>
                    <button
                      className="la-btn la-btn--soft"
                      disabled={busy || !ttsText.trim()}
                      onClick={() => patch(() => generateGreetingTts(accountId, ttsText.trim(), ttsLocale))}
                      style={{ fontSize: 11.5 }}
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}{t("missedCall.generate")}
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: "var(--mute)", fontStyle: "italic", marginTop: 6 }}>{t("missedCall.ttsHint")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Voicemail (Tier 2) */}
          <div className="row" style={{ gap: 12, justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid var(--line)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{t("missedCall.voicemailTitle")}</div>
              <div style={{ fontSize: 10.5, color: "var(--mute)", lineHeight: 1.5 }}>{t("missedCall.voicemailHint")}</div>
            </div>
            <Switch checked={status.voicemailEnabled} disabled={busy} onCheckedChange={(v) => save({ voicemailEnabled: v })} />
          </div>

          {error && <span style={{ fontSize: 11.5, color: "var(--wine)" }}>{error}</span>}
        </div>
      )}
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}
