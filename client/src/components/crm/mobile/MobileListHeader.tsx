import { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { Search, SlidersHorizontal, ArrowDownUp, Layers, X, Check, MoreHorizontal } from "lucide-react";
import { useBackButtonClose } from "./MobileSheet";

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
  /** Custom leading element (e.g. a colored avatar circle) — takes priority over `icon`. */
  iconNode?: React.ReactNode;
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
            {tab.iconNode ?? (Icon && <span className="flex items-center"><Icon size={14} /></span>)}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** A single selectable row inside a drill-in option panel (filter/sort/group
 *  content). Pages build their `filterPanel`/`sortPanel`/`groupPanel` nodes
 *  out of these instead of DropdownMenuItem. */
export function MobileDrawerOption({
  label,
  icon: Icon,
  selected,
  danger,
  onClick,
}: {
  label: React.ReactNode;
  icon?: LucideIcon;
  selected?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  const textColor = danger ? "var(--bad)" : selected ? "var(--wine)" : "var(--ink)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="row"
      style={{
        width: "100%",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        padding: "12px 4px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        borderBottom: "1px solid var(--line)",
        textAlign: "left",
      }}
    >
      <span className="row" style={{ gap: 10, alignItems: "center", minWidth: 0 }}>
        {Icon && <Icon size={15} style={{ color: danger ? "var(--bad)" : "var(--mute)", flexShrink: 0 }} />}
        <span style={{ fontSize: 14, fontWeight: selected ? 700 : 600, color: textColor }}>{label}</span>
      </span>
      {selected && <Check size={15} style={{ color: "var(--wine)", flexShrink: 0 }} />}
    </button>
  );
}

/** Small uppercase label that groups rows within a drill-in panel. */
export function MobileDrawerSubheading({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute-2)", padding: "12px 4px 4px" }}>
      {children}
    </span>
  );
}

/** Narrow raised-crisp button in the drawer's main view (Filter / Sort / Group
 *  triggers, plus any page-specific `extraActions`). Exported so pages can
 *  build their own toggle-style buttons (e.g. a peek/chat toggle) that match. */
export function DrawerMainButton({
  label,
  icon: Icon,
  active,
  onClick,
  variant = "tint",
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  /** "tint" (default) = wine-tint bg + wine text when active, used for Filter/Sort/Group.
   *  "solid" = solid wine bg + cream text when active, used for toggle-style buttons (e.g. Chats). */
  variant?: "tint" | "solid";
}) {
  const solidActive = variant === "solid" && active;
  return (
    <button
      type="button"
      onClick={onClick}
      className="row"
      style={{
        gap: 7,
        alignItems: "center",
        padding: "9px 14px",
        borderRadius: "var(--r-pill)",
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
        background: solidActive ? "var(--wine)" : active ? "var(--wine-tint)" : "var(--surface)",
        boxShadow: "var(--sh-raised-crisp)",
        color: solidActive ? "var(--surface)" : active ? "var(--wine)" : "var(--ink)",
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={14} />
      {label}
      {active && variant === "tint" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--wine)" }} />}
    </button>
  );
}

type DrillId = "filter" | "sort" | "group" | "more";

/**
 * The drawer that lowers from the top of the header, sized to its content.
 * The Filter / Sort / Group (+ leftActions/mainRowTrailing) button row stays
 * fixed at the top; tapping a button extends the drawer downward to show
 * that control's option list in the same panel (no view-swap). Phone Back
 * closes the whole drawer (reuses MobileSheet's history-sentinel pattern).
 */
function TopDrawer({
  open,
  onClose,
  filterPanel,
  filterActive,
  filterLabel,
  sortPanel,
  sortActive,
  sortLabel,
  groupPanel,
  groupActive,
  groupLabel,
  morePanel,
  moreLabel,
  onMoreClose,
  leftActions,
  mainRowTrailing,
  extraActions,
}: {
  open: boolean;
  onClose: () => void;
  filterPanel?: React.ReactNode;
  filterActive?: boolean;
  filterLabel: string;
  sortPanel?: React.ReactNode;
  sortActive?: boolean;
  sortLabel: string;
  groupPanel?: React.ReactNode;
  groupActive?: boolean;
  groupLabel: string;
  /** Drill-in panel for the auto-rendered "..." button (bulk/extra actions). */
  morePanel?: React.ReactNode;
  moreLabel?: string;
  /** Called when the "more" drill closes so callers can reset transient state (e.g. delete confirm). */
  onMoreClose?: () => void;
  /** Extra toggle-style buttons rendered in the same row as Filter/Sort/Group (left side). */
  leftActions?: React.ReactNode;
  /** Buttons pinned to the right edge of the Filter/Sort/Group row (e.g. + and ...). */
  mainRowTrailing?: React.ReactNode;
  extraActions?: React.ReactNode;
}) {
  const [drill, setDrill] = useState<DrillId | null>(null);
  const prevDrillRef = useRef<DrillId | null>(null);

  const close = () => {
    setDrill(null);
    onClose();
  };
  useBackButtonClose(open, close);

  useEffect(() => {
    if (!open) setDrill(null);
  }, [open]);

  useEffect(() => {
    if (prevDrillRef.current === "more" && drill !== "more") onMoreClose?.();
    prevDrillRef.current = drill;
  }, [drill, onMoreClose]);

  const drillPanel = drill === "filter" ? filterPanel : drill === "sort" ? sortPanel : drill === "group" ? groupPanel : drill === "more" ? morePanel : null;
  const drillLabel = drill === "filter" ? filterLabel : drill === "sort" ? sortLabel : drill === "group" ? groupLabel : drill === "more" ? (moreLabel ?? "") : "";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="md:hidden" style={{ position: "fixed", inset: 0, zIndex: 200 }} data-testid="mobile-header-drawer">
          <motion.div
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ position: "absolute", inset: 0, background: "rgba(31,26,20,0.32)" }}
          />
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: "0 0 var(--r-panel) var(--r-panel)",
              overflow: "hidden",
              background: "var(--bg)",
              boxShadow: "0 10px 40px rgba(60,45,25,0.20)",
              paddingTop: "var(--safe-top)",
            }}
          >
            {/* Button row stays put as a fixed header; tapping a button extends
                the drawer downward to show that control's options in the same
                panel (Gabriel, 2026-06-21) — no view-swap, no back arrow. */}
            <div style={{ flexShrink: 0, padding: "4px 6px 0" }}>
              <div className="row" style={{ gap: 8, flexWrap: "nowrap", justifyContent: mainRowTrailing ? "space-between" : "flex-start" }}>
                <div className="row" style={{ gap: 8, flexWrap: "nowrap", overflowX: "auto", minWidth: 0, padding: "10px 12px" }}>
                  {leftActions}
                  {filterPanel && (
                    <DrawerMainButton label={filterLabel} icon={SlidersHorizontal} active={filterActive || drill === "filter"} onClick={() => setDrill(drill === "filter" ? null : "filter")} />
                  )}
                  {sortPanel && (
                    <DrawerMainButton label={sortLabel} icon={ArrowDownUp} active={sortActive || drill === "sort"} onClick={() => setDrill(drill === "sort" ? null : "sort")} />
                  )}
                  {groupPanel && (
                    <DrawerMainButton label={groupLabel} icon={Layers} active={groupActive || drill === "group"} onClick={() => setDrill(drill === "group" ? null : "group")} />
                  )}
                </div>
                {(mainRowTrailing || morePanel) && (
                  <div className="row" style={{ gap: 8, flexWrap: "nowrap", flexShrink: 0, padding: "10px 12px 10px 0" }}>
                    {mainRowTrailing}
                    {morePanel && (
                      <MobileHeaderIconBtn
                        onClick={() => setDrill(drill === "more" ? null : "more")}
                        active={drill === "more"}
                        aria-label={moreLabel ?? "More"}
                        style={{ width: 36, height: 36 }}
                      >
                        <MoreHorizontal size={16} />
                      </MobileHeaderIconBtn>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "0 18px calc(16px + var(--safe-bottom))" }}>
              {drill && (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginBottom: extraActions ? 14 : 0 }}>
                  <div className="row" style={{ alignItems: "center", justifyContent: "space-between", padding: "0 4px 6px" }}>
                    <span className="serif" style={{ fontSize: 17, color: "var(--ink)", letterSpacing: "-0.02em" }}>{drillLabel}</span>
                    <button
                      type="button"
                      onClick={() => setDrill(null)}
                      aria-label="Close"
                      style={{ width: 26, height: 26, flexShrink: 0, borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", background: "var(--surface)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>{drillPanel}</div>
                </div>
              )}
              {extraActions && (
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  {extraActions}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
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
  /** Drill-in option list (built from MobileDrawerOption rows). Omit to hide the Filter button. */
  filterPanel?: React.ReactNode;
  filterActive?: boolean;
  filterLabel?: string;
  /** Drill-in option list. Omit to hide the Sort button. */
  sortPanel?: React.ReactNode;
  sortActive?: boolean;
  sortLabel?: string;
  /** Drill-in option list. Omit to hide the Group button. */
  groupPanel?: React.ReactNode;
  groupActive?: boolean;
  groupLabel?: string;
  /** Drill-in panel for the auto-rendered "..." button. Omit to hide the "..." button. */
  morePanel?: React.ReactNode;
  moreLabel?: string;
  /** Called when the "more" drill panel closes (use to reset transient state like delete confirm). */
  onMoreClose?: () => void;
  /** Extra toggle-style buttons rendered in the same row as Filter/Sort/Group (left side). */
  leftActions?: React.ReactNode;
  /** Buttons pinned to the right edge of the Filter/Sort/Group row (e.g. + and ...). */
  mainRowTrailing?: React.ReactNode;
  /** Extra action buttons (e.g. add / chats) — rendered in the drawer's main view. */
  extraActions?: React.ReactNode;
}

/**
 * MobileListHeader — shared single-row header for every mobile list page.
 *
 * Layout: serif page title (left) · view-tab switcher (middle) · Search +
 * Settings buttons (right). Settings opens a drawer that lowers from the top
 * of the header, sized to its content: Filter / Sort / Group buttons (+ any
 * page-specific extraActions) on the main view, drilling in to that control's
 * option list with a title + back arrow. Notifications live in the More page.
 */
export function MobileListHeader({
  title,
  tabSwitcher,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filterPanel,
  filterActive,
  filterLabel,
  sortPanel,
  sortActive,
  sortLabel,
  groupPanel,
  groupActive,
  groupLabel,
  morePanel,
  moreLabel,
  onMoreClose,
  leftActions,
  mainRowTrailing,
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

  const hasSettings = !!filterPanel || !!sortPanel || !!groupPanel || !!morePanel || !!extraActions || !!leftActions || !!mainRowTrailing;
  const settingsActive = !!filterActive || !!sortActive || !!groupActive;

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
                background: "var(--surface)", boxShadow: "var(--sh-inset-super-crisp)", borderRadius: "var(--r-pill)",
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
                  dot={settingsActive}
                  active={settingsActive}
                  aria-label={t("settings.title", "Settings")}
                  data-testid="mobile-header-settings"
                >
                  <SlidersHorizontal size={16} />
                </MobileHeaderIconBtn>
              )}
            </div>
          </>
        )}
      </div>

      {hasSettings && (
        <TopDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          filterPanel={filterPanel}
          filterActive={filterActive}
          filterLabel={filterLabel ?? t("filter.title", "Filter")}
          sortPanel={sortPanel}
          sortActive={sortActive}
          sortLabel={sortLabel ?? t("sort.title", "Sort")}
          groupPanel={groupPanel}
          groupActive={groupActive}
          groupLabel={groupLabel ?? t("groupBy.title", "Group")}
          morePanel={morePanel}
          moreLabel={moreLabel ?? t("more.title", "More")}
          onMoreClose={onMoreClose}
          leftActions={leftActions}
          mainRowTrailing={mainRowTrailing}
          extraActions={extraActions}
        />
      )}
    </div>
  );
}
