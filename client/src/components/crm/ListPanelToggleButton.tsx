import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { TopbarIconButton } from "@/components/crm/primitives/TopbarIconButton";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useActiveListPanelFold } from "@/hooks/useListPanelFold";

/**
 * The list-panel fold controls. They sit at the bottom of the panel they fold (desktop only):
 *
 * - `ListPanelFooter`: the slim bottom bar of a list panel (44px, top hairline). The
 *   fold button sits at its right end; a list's own footer content (pagination,
 *   "x of y") goes in as children on the left. In the compact rail only the button
 *   shows, centered. Place it as the last child of the list column, after the
 *   scrolling list (`flex-1 min-h-0 overflow-y-auto`), so it stays pinned.
 * - `ListPanelFoldButton`: the bare button, for a list footer that is built by hand.
 * - `ListPanelUnfoldButton`: a slim edge strip where the list was. Renders only while
 *   the list is hidden and brings it back, its button at the bottom (footer height).
 *   Place it as the sibling right after the list panel, inside the same flex row.
 *
 * All render nothing unless the page on screen registered through `useListPanelFold`
 * (the footer still shows its children). They keep each page's behavior: "cycle" =
 * full → compact → hidden, "compact" = full ↔ compact (never hidden), or the page's
 * own `{ hidden, onToggle }`.
 */

/** Height of the list panel footer; the unfold strip lines its button up with it. */
export const LIST_FOOTER_H = 44;
const STRIP_W = 48;

function useFoldControl() {
  const { t } = useTranslation("crm");
  const fold = useActiveListPanelFold();
  const { state, setState, cycle } = useListPanelState();
  if (!fold) return null;

  if (fold.toggle) {
    const hidden = !!fold.hidden;
    return {
      hidden,
      folded: hidden,
      label: hidden ? t("sidebar.listPanelShow") : t("sidebar.listPanelHide"),
      onClick: fold.toggle,
      unfold: fold.toggle,
    };
  }
  if (fold.mode === "compact") {
    const folded = state === "compact";
    return {
      hidden: false,
      folded,
      label: folded ? t("sidebar.listPanelExpand") : t("sidebar.listPanelMinimize"),
      onClick: () => setState(folded ? "full" : "compact"),
      unfold: () => setState("full"),
    };
  }
  return {
    hidden: state === "hidden",
    folded: state !== "full",
    label: state === "full" ? t("sidebar.listPanelCompact") : state === "compact" ? t("sidebar.listPanelHide") : t("sidebar.listPanelShow"),
    onClick: cycle,
    unfold: () => setState("full"),
  };
}

/** Fold button for the right end of a list panel footer. */
export function ListPanelFoldButton() {
  const c = useFoldControl();
  if (!c || c.hidden) return null;
  return (
    <TopbarIconButton label={c.label} onClick={c.onClick} data-testid="list-panel-fold">
      {c.folded ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </TopbarIconButton>
  );
}

/** Slim strip at the list's former edge, shown only while the list is hidden. */
export function ListPanelUnfoldButton() {
  const { t } = useTranslation("crm");
  const c = useFoldControl();
  if (!c || !c.hidden) return null;
  const label = t("sidebar.listPanelShow");
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-end bg-panel-list-bg border-r border-[var(--line)]"
      style={{ width: STRIP_W }}
    >
      <div className="flex w-full items-center justify-center shrink-0 border-t border-[var(--line)]" style={{ height: LIST_FOOTER_H }}>
        <TopbarIconButton label={label} onClick={c.unfold} data-testid="list-panel-unfold">
          <PanelLeft className="h-4 w-4" />
        </TopbarIconButton>
      </div>
    </div>
  );
}

/**
 * Bottom bar of a list panel: optional footer content on the left, the fold button at
 * the right end. In the compact rail only the button shows (centered). Without a
 * registered page (phones, narrow layouts) it shows only its children, or nothing.
 */
export function ListPanelFooter({ compact = false, children }: {
  /** The panel is the compact rail: drop the children, center the button. */
  compact?: boolean;
  /** The list's own footer content (pagination, counts), placed left of the button. */
  children?: ReactNode;
}) {
  const registered = !!useActiveListPanelFold();
  const content = compact ? null : children;
  if (!registered && !content) return null;
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-t border-[var(--line)]"
      style={{ height: LIST_FOOTER_H, padding: compact ? 0 : "0 6px 0 12px", justifyContent: compact ? "center" : "flex-end" }}
      data-testid="list-panel-footer"
    >
      {content && <div className="flex flex-1 min-w-0 items-center justify-between gap-2">{content}</div>}
      {registered && <ListPanelFoldButton />}
    </div>
  );
}

/** @deprecated Old name. Use `ListPanelFoldButton`. */
export const ListPanelToggleButton = ListPanelFoldButton;
