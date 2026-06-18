import { forwardRef, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { Search, SlidersHorizontal, ArrowDownUp, Settings2, X, ChevronRight } from "lucide-react";
import { MobileSheet } from "./MobileSheet";

interface HeaderIconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  dot?: boolean;
  badge?: number;
  active?: boolean;
}

/**
 * Round 44×44 icon button matching the prototype's IconBtn (mobile-shell.jsx).
 * Forwards its ref + extra props so it can act as a Radix dropdown trigger.
 */
export const MobileHeaderIconBtn = forwardRef<HTMLButtonElement, HeaderIconBtnProps>(function HeaderIconBtn(
  { dot, badge, active, children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      style={{
        width: 44,
        height: 44,
        borderRadius: "var(--r-pill)",
        position: "relative",
        border: "none",
        cursor: "pointer",
        background: active ? "var(--wine-tint)" : "var(--surface)",
        boxShadow: "var(--sh-raised-crisp)",
        color: active ? "var(--wine)" : "var(--mute)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
      {dot && !badge && (
        <span style={{ position: "absolute", top: 9, right: 9, width: 6, height: 6, borderRadius: "50%", background: "var(--wine)" }} />
      )}
      {!!badge && badge > 0 && (
        <span
          style={{
            position: "absolute", top: 4, right: 4, minWidth: 15, height: 15, padding: "0 3px",
            borderRadius: "var(--r-pill)", background: "var(--wine)", color: "#fff",
            fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--bg)",
          }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
});

export interface MobileTabDef<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * Premium segmented tab switcher (la-seg) for the header's title row.
 * Use as the `tabSwitcher` slot so every page's view tabs share one look.
 */
export function MobileTabSeg<T extends string>({
  tabs,
  activeId,
  onChange,
}: {
  tabs: MobileTabDef<T>[];
  activeId: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="la-seg la-seg--fill" style={{ flexShrink: 0 }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`la-seg-btn${activeId === tab.id ? " on" : ""}`}
            style={{ padding: "8px 13px", fontSize: 12.5, letterSpacing: "0.08em" }}
          >
            {Icon && <span className="flex items-center"><Icon size={14} /></span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** One labeled row inside the Settings sheet. Either renders a page-provided
 *  control (e.g. a dropdown trigger) on the right, or a chevron button that
 *  fires `onClick` (and closes the sheet). */
function SettingsRow({
  label,
  icon: Icon,
  control,
  onClick,
  dot,
}: {
  label: string;
  icon: LucideIcon;
  control?: React.ReactNode;
  onClick?: () => void;
  dot?: boolean;
}) {
  return (
    <div
      className="row"
      style={{ justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 2px", borderBottom: "1px solid var(--line)" }}
    >
      <span className="row" style={{ gap: 11, alignItems: "center", minWidth: 0 }}>
        <Icon size={17} style={{ color: "var(--mute)", flexShrink: 0 }} />
        <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
        {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--wine)", flexShrink: 0 }} />}
      </span>
      {control ? (
        <span className="row" style={{ gap: 8, flexShrink: 0 }}>{control}</span>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          style={{ width: 36, height: 36, flexShrink: 0, borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

export interface MobileListHeaderProps {
  title: string;
  /** Premium view-tab switcher rendered between the title and the buttons. */
  tabSwitcher?: React.ReactNode;
  /** Expandable inline search. Omit both to hide the search button. */
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  onFilterClick?: () => void;
  filterActive?: boolean;
  /** Alternatively, render a custom filter control (e.g. a dropdown trigger). */
  filterControl?: React.ReactNode;
  /** Simple sort button. */
  onSortClick?: () => void;
  /** Alternatively, render a custom sort control (e.g. a dropdown trigger). */
  sortControl?: React.ReactNode;
  /** Extra action buttons (e.g. add / group / toggle) — surfaced in the Settings sheet. */
  extraActions?: React.ReactNode;
}

/**
 * MobileListHeader — shared single-row header for every mobile list page.
 *
 * Layout: serif page title (left) · view-tab switcher (middle) · Search + Settings
 * buttons (right). The header only ever shows two icon buttons; filter, sort,
 * group, add and any page-specific actions are consolidated behind the Settings
 * (gear) button, which opens a bottom sheet. Notifications live in the More page,
 * not here.
 */
export function MobileListHeader({
  title,
  tabSwitcher,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onFilterClick,
  filterActive,
  filterControl,
  onSortClick,
  sortControl,
  extraActions,
}: MobileListHeaderProps) {
  const { t } = useTranslation("crm");
  const hasSearch = typeof onSearchChange === "function";
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => {
    onSearchChange?.("");
    setSearchOpen(false);
  };

  const hasFilter = !!filterControl || typeof onFilterClick === "function";
  const hasSort = !!sortControl || typeof onSortClick === "function";
  const hasSettings = hasFilter || hasSort || !!extraActions;

  return (
    <div
      className="md:hidden"
      style={{ flexShrink: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)", paddingTop: "var(--safe-top)" }}
      data-testid="mobile-list-header"
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 16px" }}>
        {hasSearch && searchOpen ? (
          <>
            <div
              className="row"
              style={{
                flex: 1, minWidth: 0, gap: 8, padding: "7px 12px",
                background: "var(--surface)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-pill)",
              }}
            >
              <Search size={15} style={{ color: "var(--mute)", flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder ?? t("topbar.search", "Search")}
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--ink)" }}
                data-testid="mobile-header-search-input"
              />
            </div>
            <MobileHeaderIconBtn onClick={closeSearch} aria-label="Close search" data-testid="mobile-header-search-close">
              <X size={16} />
            </MobileHeaderIconBtn>
          </>
        ) : (
          <>
            {/* Title (left) — raised, ellipsises so the tabs + buttons keep their space */}
            <span
              className="serif"
              style={{ fontSize: 27, lineHeight: 1.05, color: "var(--ink)", letterSpacing: "-0.02em", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              data-testid="mobile-header-title"
            >
              {title}
            </span>
            {/* Right cluster — tabs sit between the title and the buttons */}
            <div className="row" style={{ gap: 8, alignItems: "center", flexShrink: 0 }}>
              {tabSwitcher}
              {hasSearch && (
                <MobileHeaderIconBtn onClick={() => setSearchOpen(true)} aria-label={t("topbar.search", "Search")} data-testid="mobile-header-search-open">
                  <Search size={16} />
                </MobileHeaderIconBtn>
              )}
              {hasSettings && (
                <MobileHeaderIconBtn
                  onClick={() => setSettingsOpen(true)}
                  dot={filterActive}
                  active={filterActive}
                  aria-label={t("settings.title", "Settings")}
                  data-testid="mobile-header-settings"
                >
                  <Settings2 size={16} />
                </MobileHeaderIconBtn>
              )}
            </div>
          </>
        )}
      </div>

      {/* Settings bottom sheet — holds filter / sort / group / add and any
          page-specific actions, keeping the header itself to two buttons. */}
      {hasSettings && (
        <MobileSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} data-testid="mobile-header-settings-sheet">
          <div style={{ padding: "2px 18px calc(18px + var(--safe-bottom))", display: "flex", flexDirection: "column" }}>
            <span className="serif" style={{ fontSize: 21, color: "var(--ink)", letterSpacing: "-0.02em", padding: "0 2px 8px" }}>
              {t("settings.title", "Settings")}
            </span>
            {hasFilter && (
              <SettingsRow
                label={t("filter.title", "Filter")}
                icon={SlidersHorizontal}
                control={filterControl}
                onClick={onFilterClick ? () => { setSettingsOpen(false); onFilterClick(); } : undefined}
                dot={filterActive}
              />
            )}
            {hasSort && (
              <SettingsRow
                label={t("sort.title", "Sort")}
                icon={ArrowDownUp}
                control={sortControl}
                onClick={onSortClick ? () => { setSettingsOpen(false); onSortClick(); } : undefined}
              />
            )}
            {extraActions && (
              <div className="row" style={{ gap: 10, paddingTop: 14, flexWrap: "wrap" }}>
                {extraActions}
              </div>
            )}
          </div>
        </MobileSheet>
      )}
    </div>
  );
}
