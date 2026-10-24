// The one page topbar. Every CRM page's header is built from this so the pages
// cannot drift: a 60px flush bar (.la-page-header) with the page title in the
// 20px bold heading face (Manrope; the CRM has no serif), an optional "#count", left controls (TopbarTabs, a PillSwitch, the
// list fold button), a flexible spacer, then right actions (ExpandingSearch,
// TopbarIconButton menus, the wine + button). See UI_PATTERNS.md §0.
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageTopbarProps {
  /** Page title. Use the same i18n string as the page's nav label. */
  title?: ReactNode;
  /** Optional count after the title, rendered as "#12". */
  count?: number | string | null;
  /** Controls right after the title: tabs, mode switches, the list fold button. */
  left?: ReactNode;
  /** Actions after the spacer: search, menu buttons, the + button. */
  right?: ReactNode;
  /** Free content between `left` and the spacer, for the rare page that needs it. */
  children?: ReactNode;
  /** Hide below 768px, for pages that render their own mobile header. */
  desktopOnly?: boolean;
  /** Let a crowded bar scroll sideways instead of squeezing its controls (phones). */
  scroll?: boolean;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

const GROUP: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minWidth: 0 };

export function PageTopbar({ title, count, left, right, children, desktopOnly, scroll, className, style, testId }: PageTopbarProps) {
  return (
    <div
      className={cn("la-page-header", desktopOnly && "max-md:!hidden", scroll && "[scrollbar-width:none]", className)}
      style={{ gap: 12, padding: "0 17px", ...(scroll ? { overflowX: "auto" } : null), ...style }}
      data-testid={testId}
    >
      {title != null && (
        <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0, whiteSpace: "nowrap" }}>
          {title}
        </span>
      )}
      {count != null && (
        <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)", flexShrink: 0 }}>#{count}</span>
      )}
      {left && <div style={{ ...GROUP, flexShrink: 0 }}>{left}</div>}
      {children}
      <div style={{ flex: 1, minWidth: 8 }} />
      {right && <div style={{ ...GROUP, flexShrink: scroll ? 0 : 1, justifyContent: "flex-end" }}>{right}</div>}
    </div>
  );
}
