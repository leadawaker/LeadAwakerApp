import { useRef, useState, useCallback } from "react";
import { Camera, X, Building2 } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useTranslation } from "react-i18next";
import { LogoCropModal } from "../accountDetailWidgets";
import { AccountStatusPill } from "./atoms";
import { STATUS_I18N_KEY } from "../listWidgets/accountListConstants";
import type { AccountDetail, MetaChip as MetaChipData } from "./types";

/** One header figure. `small` when the header is narrow: the figures shrink
 *  instead of dropping onto a second line under the name. */
function MetaChip({ m, small }: { m: MetaChipData; small: boolean }) {
  if (!m.detail) return <MetaChipBody m={m} small={small} />;
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <div style={{ cursor: "default", borderRadius: "var(--r-button)" }} data-testid={`meta-${m.key}`}>
          <MetaChipBody m={m} small={small} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="end" style={{ width: 300, background: "var(--card)", borderColor: "var(--line)", padding: 14 }}>
        {m.detail}
      </HoverCardContent>
    </HoverCard>
  );
}

function MetaChipBody({ m, small }: { m: MetaChipData; small: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: small ? 7 : 10, padding: small ? "6px 6px" : "8px 12px 8px 10px", minWidth: 0 }}>
      <span style={{ width: 3, height: small ? 22 : 26, borderRadius: 2, background: m.accent, flexShrink: 0 }} />
      <div style={{ lineHeight: 1, minWidth: 0 }}>
        <div className="row" style={{ alignItems: "baseline", gap: 5 }}>
          <span style={{ fontSize: small ? 16 : 20, fontWeight: 700, color: "var(--ink)", lineHeight: 1, whiteSpace: "nowrap" }}>{m.value}</span>
          {!small && m.sub && <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--mute-2)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{m.sub}</span>}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: small ? 7.5 : 8.5, letterSpacing: small ? "0.08em" : "0.13em", textTransform: "uppercase", color: "var(--mute)", marginTop: 4, whiteSpace: "nowrap" }} title={m.sub || undefined}>{m.label}</div>
      </div>
    </div>
  );
}

/** True while the element is narrower than `px`. */
function useNarrow(px: number) {
  const [narrow, setNarrow] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!node || typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver((entries) => setNarrow((entries[0]?.contentRect.width ?? px) < px));
    observer.current.observe(node);
  }, [px]);
  return { ref, narrow };
}

export function IdentityCard({ d, metrics, onSave, compact = false, clientView = false }: {
  d: AccountDetail;
  metrics: MetaChipData[];
  onSave: (field: string, value: string) => Promise<void>;
  /** Compact mode: tighter padding, no metrics row (used in mobile sheet). */
  compact?: boolean;
  /** A client login: no logo upload, and a subtitle without type, niche or id. */
  clientView?: boolean;
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
  const { ref: cardRef, narrow } = useNarrow(980);
  const logoSize = compact ? 40 : narrow ? 48 : 56;
  const nameFontSize = compact ? 22 : narrow ? 25 : 31;
  const outerPad = compact ? "14px 16px" : "22px 26px";

  return (
    // One row: name on the left, figures on the right. When space runs out the
    // figures shrink (useNarrow) and the name truncates; nothing wraps below.
    <div ref={cardRef} className="neu-raised" style={{ borderRadius: compact ? "var(--r-card)" : "var(--r-panel)", padding: outerPad, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: compact ? "wrap" : "nowrap" }}>
      <div className="row" style={{ gap: 12, minWidth: 0, flex: "1 1 auto" }}>
        {/* Logo circle — click to upload */}
        <div className="group" style={{ position: "relative", flexShrink: 0 }}>
          <div
            onClick={clientView ? undefined : () => logoInputRef.current?.click()}
            title={clientView ? undefined : t("detail.clickToUploadLogo")}
            style={{
              width: logoSize, height: logoSize, borderRadius: "var(--r-card)", overflow: "hidden", cursor: clientView ? "default" : "pointer",
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
          {!clientView && <div className="opacity-0 group-hover:opacity-100" style={{ position: "absolute", inset: 0, borderRadius: "var(--r-card)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 150ms", pointerEvents: "none" }}>
            <Camera className={compact ? "w-4 h-4" : "w-5 h-5"} style={{ color: "#fff" }} />
          </div>}
          {!clientView && d.logoUrl && !cropSrc && (
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
            <h1 style={{ margin: 0, fontSize: nameFontSize, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1, letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={d.name}>{d.name}</h1>
            <AccountStatusPill status={d.status} label={statusLabel} />
          </div>
          {!clientView && <div className="row" style={{ gap: 9, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)" }}>
            {d.type && <><span>{d.type}</span><span style={{ color: "var(--mute-2)" }}>·</span></>}
            {d.niche && <><span>{d.niche}</span><span style={{ color: "var(--mute-2)" }}>·</span></>}
            <span style={{ color: "var(--mute-2)" }}>#{d.id}</span>
          </div>}
        </div>
      </div>

      {/* Metrics row: hidden on mobile/compact (request 2) */}
      {!compact && (
        <div className="row" style={{ gap: narrow ? 2 : 6, flexWrap: "nowrap", flexShrink: 0 }}>
          {metrics.map((m) => <MetaChip key={m.key} m={m} small={narrow} />)}
        </div>
      )}

      {cropSrc && <LogoCropModal srcUrl={cropSrc} onSave={handleCropSave} onCancel={handleCropCancel} />}
    </div>
  );
}
