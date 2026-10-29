// Small pieces shared by the Leads page topbars (Table + Pipeline).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExpandingSearch } from "@/components/crm/primitives";

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
 * Search used in the topbars: a round icon that opens into a field on click and
 * folds back once it is empty and loses focus (every screen size, so the desktop
 * topbar has room for the quick view and channel switches). On a phone the open
 * field takes the free space in the row. A thin wrapper over ExpandingSearch.
 */
export function TopbarSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <ExpandingSearch value={value} onChange={onChange} placeholder={placeholder} width={180} fillOnMobile testId="leads-topbar-search" />;
}

/** Wine dot under a topbar icon button when its menu holds a non-default value. */
export function ActiveDot() {
  return (
    <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", display: "block", pointerEvents: "none" }} />
  );
}

/** The quick view ("Show": All / Needs reply / Next appointments) handed to a topbar's Filter menu. */
export type ViewFilterSlot = {
  /** The folded "Show" group (QuickViewFilterGroup). */
  group: React.ReactNode;
  /** Not on "All": lights the Filter dot. */
  active: boolean;
  /** Back to "All" (Clear filters). */
  clear: () => void;
};
