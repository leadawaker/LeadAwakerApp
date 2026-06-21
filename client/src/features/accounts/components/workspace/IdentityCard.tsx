import { useRef, useState, useCallback } from "react";
import { Camera, X, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LogoCropModal } from "../accountDetailWidgets";
import { AccountStatusPill } from "./atoms";
import { STATUS_I18N_KEY } from "../listWidgets/accountListConstants";
import type { AccountDetail, MetaChip as MetaChipData } from "./types";

function MetaChip({ m }: { m: MetaChipData }) {
  return (
    <div className="" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 12px", borderRadius: "var(--r-button)", minWidth: 0 }}>
      <span style={{ width: 3, height: 26, borderRadius: 2, background: m.accent, flexShrink: 0 }} />
      <div style={{ lineHeight: 1 }}>
        <div className="row" style={{ alignItems: "baseline", gap: 5 }}>
          <span className="serif" style={{ fontSize: 21, color: "var(--ink)", lineHeight: 1 }}>{m.value}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--mute-2)", letterSpacing: "0.04em" }}>{m.sub}</span>
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute)", marginTop: 4 }}>{m.label}</div>
      </div>
    </div>
  );
}

export function IdentityCard({ d, metrics, onSave, compact = false }: {
  d: AccountDetail;
  metrics: MetaChipData[];
  onSave: (field: string, value: string) => Promise<void>;
  /** Compact mode: tighter padding, no metrics row (used in mobile sheet). */
  compact?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const statusLabel = d.status ? t(STATUS_I18N_KEY[d.status] ?? d.status) : "";

  const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoInputRef.current) logoInputRef.current.value = "";
    setCropSrc(URL.createObjectURL(file));
  }, []);

  const handleCropSave = useCallback(async (dataUrl: string) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    await onSave("logo_url", dataUrl);
  }, [cropSrc, onSave]);

  const handleCropCancel = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const handleRemoveLogo = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onSave("logo_url", "");
  }, [onSave]);

  // Compact mode (mobile sheet): smaller logo, tighter padding, no metrics.
  const logoSize = compact ? 40 : 56;
  const nameFontSize = compact ? 22 : 31;
  const outerPad = compact ? "14px 16px" : "22px 26px";

  return (
    <div className="neu-raised" style={{ borderRadius: compact ? "var(--r-card)" : "var(--r-panel)", padding: outerPad, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div className="row" style={{ gap: 12, minWidth: 0 }}>
        {/* Logo circle — click to upload */}
        <div className="group" style={{ position: "relative", flexShrink: 0 }}>
          <div
            onClick={() => logoInputRef.current?.click()}
            title={t("detail.clickToUploadLogo")}
            style={{
              width: logoSize, height: logoSize, borderRadius: "var(--r-card)", overflow: "hidden", cursor: "pointer",
              background: d.logoUrl ? "var(--bg)" : "var(--wine-grad)",
              boxShadow: "var(--sh-raised-medium), inset 0 1px 0 rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--paper)", fontFamily: '"Yeseva One", serif', fontSize: compact ? 18 : 25, paddingBottom: d.logoUrl ? 0 : 2,
            }}
          >
            {d.logoUrl ? (
              <img src={d.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              d.mono || <Building2 className={compact ? "w-4 h-4" : "w-6 h-6"} />
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100" style={{ position: "absolute", inset: 0, borderRadius: "var(--r-card)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 150ms", pointerEvents: "none" }}>
            <Camera className={compact ? "w-4 h-4" : "w-5 h-5"} style={{ color: "#fff" }} />
          </div>
          {d.logoUrl && !cropSrc && (
            <button
              onClick={handleRemoveLogo}
              title={t("detail.removeLogo")}
              className="opacity-0 group-hover:opacity-100"
              style={{ position: "absolute", top: -4, right: -4, height: 20, width: 20, borderRadius: "50%", background: "var(--card)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute)", transition: "opacity 150ms", zIndex: 10 }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />

        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 10, marginBottom: 4 }}>
            <h1 className="serif" style={{ margin: 0, fontSize: nameFontSize, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.015em" }}>{d.name}</h1>
            <AccountStatusPill status={d.status} label={statusLabel} />
          </div>
          <div className="row" style={{ gap: 9, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)" }}>
            {d.type && <><span>{d.type}</span><span style={{ color: "var(--mute-2)" }}>·</span></>}
            {d.niche && <><span>{d.niche}</span><span style={{ color: "var(--mute-2)" }}>·</span></>}
            <span style={{ color: "var(--mute-2)" }}>#{d.id}</span>
          </div>
        </div>
      </div>

      {/* Metrics row: hidden on mobile/compact (request 2) */}
      {!compact && (
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {metrics.map((m) => <MetaChip key={m.key} m={m} />)}
        </div>
      )}

      {cropSrc && <LogoCropModal srcUrl={cropSrc} onSave={handleCropSave} onCancel={handleCropCancel} />}
    </div>
  );
}
