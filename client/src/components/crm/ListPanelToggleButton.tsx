import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { TopbarIconButton } from "@/components/crm/primitives/TopbarIconButton";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useActiveListPanelFold } from "@/hooks/useListPanelFold";

/**
 * The list-panel fold button (desktop only): full size <-> small rail. A list never folds away.
 *
 * - `ListPanelFooter`: place it as the last child of the list column, right after the scrolling
 *   list (`flex-1 min-h-0 overflow-y-auto`). Without footer content it takes no room: the button
 *   floats at the panel's bottom corner, and the list before it gets the padding that keeps its
 *   last row clear of the button (`.la-fold-float` in design-system.css). A list's own footer
 *   content (pagination, "x of y") goes in as children and gets a row, the button at its right end.
 * - `ListPanelFoldButton`: the bare button.
 *
 * Both render nothing unless the page on screen registered through `useListPanelFold`
 * (the footer still shows its children).
 */

/** Height of the row a list's own footer content gets. */
export const LIST_FOOTER_H = 44;

export function ListPanelFoldButton() {
  const { t } = useTranslation("crm");
  const registered = useActiveListPanelFold();
  const { state, setState } = useListPanelState();
  if (!registered) return null;
  const folded = state === "compact";
  return (
    <TopbarIconButton
      label={folded ? t("sidebar.listPanelExpand") : t("sidebar.listPanelMinimize")}
      onClick={() => setState(folded ? "full" : "compact")}
      data-testid="list-panel-fold"
      style={{ background: "var(--card)", boxShadow: "var(--sh-raised-crisp)" }}
    >
      {folded ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </TopbarIconButton>
  );
}

/** The foot of a list panel: the fold button, floating or beside the list's own footer content. */
export function ListPanelFooter({ compact = false, children }: {
  /** The panel is the small rail: drop the children, center the button. */
  compact?: boolean;
  /** The list's own footer content (pagination, counts), placed left of the button. */
  children?: ReactNode;
}) {
  const registered = useActiveListPanelFold();
  const content = compact ? null : children;
  if (!content) {
    if (!registered) return null;
    return (
      <div className={compact ? "la-fold-float la-fold-float--center" : "la-fold-float"} data-testid="list-panel-footer">
        <ListPanelFoldButton />
      </div>
    );
  }
  return (
    <div
      className="flex shrink-0 items-center gap-2"
      style={{ height: LIST_FOOTER_H, padding: "0 6px 0 12px", justifyContent: "flex-end" }}
      data-testid="list-panel-footer"
    >
      <div className="flex flex-1 min-w-0 items-center justify-between gap-2">{content}</div>
      {registered && <ListPanelFoldButton />}
    </div>
  );
}
