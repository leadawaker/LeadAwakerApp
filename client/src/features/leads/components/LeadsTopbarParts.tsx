// Small pieces shared by the Leads page topbars (Table + Pipeline).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

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

/**
 * Inset search field used in the topbars. On phones it is an icon button that
 * expands on tap and collapses again when it is empty and loses focus.
 */
export function TopbarSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { t } = useTranslation("leads");
  const isPhone = useIsMobile(768);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  if (isPhone && !open && !value) {
    return (
      <button type="button" className="la-btn la-btn--soft la-btn--icon la-hit" aria-label={placeholder} title={placeholder}
        onClick={() => setOpen(true)} data-testid="leads-topbar-search-open">
        <Search className="h-4 w-4" />
      </button>
    );
  }
  return (
    <div className="relative max-md:flex-1 max-md:min-w-0" style={{ width: isPhone ? undefined : 180 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { if (!value) setOpen(false); }}
        placeholder={placeholder}
        className="la-input la-m-crisp"
        data-testid="leads-topbar-search"
        style={{ background: "var(--surface)", paddingLeft: 27, paddingTop: 7, paddingBottom: 7, paddingRight: 24, height: isPhone ? 36 : 32, fontSize: isPhone ? 14 : 11, width: "100%" }}
      />
      <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
        <Search className="h-3 w-3" />
      </span>
      {value && (
        <button type="button" onClick={() => { onChange(""); if (isPhone) setOpen(false); }} aria-label={t("toolbar.clearAll")} className="absolute right-[7px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] hover:text-foreground">
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
