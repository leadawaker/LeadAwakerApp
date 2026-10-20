// Small pieces shared by the Leads page topbars (Table + Pipeline).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

/** Raised icon button that asks "Label? Yes / No" inline before acting. */
export function ConfirmToolbarButton({
  icon: Icon, label, onConfirm, variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  onConfirm: () => Promise<void> | void;
  variant?: "default" | "danger";
}) {
  const { t } = useTranslation("leads");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (confirming) {
    return (
      <div className="h-9 flex items-center gap-1 rounded-full bg-card px-2.5 text-[12px] shrink-0" style={{ boxShadow: "var(--sh-raised-crisp)" }}>
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setConfirming(false); } }}
          disabled={busy}
        >
          {busy ? "…" : t("common.yes")}
        </button>
        <button className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground" onClick={() => setConfirming(false)}>
          {t("common.no")}
        </button>
      </div>
    );
  }
  return (
    <button
      className="la-btn la-btn--soft la-btn--icon"
      style={variant === "danger" ? { color: "hsl(var(--destructive))" } : undefined}
      title={label}
      aria-label={label}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** Inset search field used in the topbars. */
export function TopbarSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative" style={{ width: 180 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="la-input"
        data-testid="leads-topbar-search"
        style={{ background: "var(--surface)", paddingLeft: 27, paddingTop: 7, paddingBottom: 7, paddingRight: 24, height: 32, fontSize: 11 }}
      />
      <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg>
      </span>
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-[7px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Wine dot under a topbar icon button when its menu holds a non-default value. */
export function ActiveDot() {
  return (
    <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", display: "block", pointerEvents: "none" }} />
  );
}
