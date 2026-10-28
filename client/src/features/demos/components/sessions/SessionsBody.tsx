import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { ProspectRow } from "../../prospectRows";
import { DEFAULT_FILTERS, groupsByDate, isFilterActive, nextSort, visibleRows, type SortKey } from "../../sessionsView";
import type { useDemoDraft } from "../../useDemoDraft";
import { TOUCH_ROW } from "../../touchTargets";
import { DemosLoading } from "../DemosLoading";
import { CreateDemoPanel } from "../create/CreateDemoPanel";
import { ProspectDetailPanel } from "../detail/ProspectDetailPanel";
import { ProspectCards } from "../cards/ProspectCards";
import { SessionsTable } from "../table/SessionsTable";
import { useDateGroups } from "../table/useDateGroups";
import type { SessionsState } from "./useSessionsState";

/** A centred message with an optional action: the empty, no-match and error states share it. */
function StateMessage({ title, body, children }: { title?: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex flex-col gap-1">
        {title && <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{title}</span>}
        {body && <span style={{ fontSize: 12.5, color: "var(--mute-2)" }}>{body}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * The right-hand column (R10): one panel at a time, mounted beside the content so the
 * full-height chain stays intact. `create` renders CreateDemoPanel with the draft DemosPage
 * owns (R22); `detail` renders ProspectDetailPanel over every row, so a filter never closes it.
 */
function PanelSlot({ state, draft, rows }: { state: SessionsState; draft: ReturnType<typeof useDemoDraft>; rows: ProspectRow[] }) {
  const close = () => state.setPanel(null);
  if (state.panel?.kind === "create") {
    return (
      <CreateDemoPanel
        draft={draft.draft}
        update={draft.update}
        updateIf={draft.updateIf}
        isCurrent={draft.isCurrent}
        clear={draft.clear}
        markAdded={draft.markAdded}
        onClose={close}
        onAdded={state.flash}
      />
    );
  }
  if (state.panel?.kind === "detail") {
    // Keyed by prospect: the panel's forms hold edits that must not carry over to the next one.
    return <ProspectDetailPanel key={state.panel.key} rowKey={state.panel.key} rows={rows} onClose={close} />;
  }
  return null;
}

/** The Sessions tab: the table or the cards (or the loading, error, empty and no-match states) and the right-hand panel. */
export function SessionsBody({ state, draft, rows, isLoading, error, onRetry, onOpenClient }: {
  state: SessionsState;
  /** The create panel's draft, owned by DemosPage (R22): tab switches unmount this component. */
  draft: ReturnType<typeof useDemoDraft>;
  /** Every prospect row; this component applies the search, filters and sort. */
  rows: ProspectRow[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpenClient: (niche: string) => void;
}) {
  const { t } = useTranslation("demos");
  const { search, filters, sort } = state;
  const visible = useMemo(() => visibleRows(rows, filters, search, sort), [rows, filters, search, sort]);
  // The cards always sit under date headings; the table only while it is sorted by Sent.
  const cards = state.view === "cards";
  const groups = useDateGroups(visible, sort, cards || groupsByDate(sort));
  const onSort = (key: SortKey) => state.setSort(nextSort(sort, key));
  const openRow = (key: string) => state.setPanel({ kind: "detail", key });
  const narrowed = isFilterActive(filters) || search.trim() !== "";
  const clearFilters = () => {
    state.setSearch("");
    state.setFilters(DEFAULT_FILTERS);
  };

  let content: ReactNode;
  if (isLoading) {
    content = <DemosLoading />;
  } else if (error) {
    content = (
      <StateMessage body={t("error.load")}>
        <button type="button" className={`la-btn la-btn--soft ${TOUCH_ROW}`} onClick={onRetry}>
          {t("common.retry")}
        </button>
      </StateMessage>
    );
  } else if (!rows.length) {
    content = (
      <StateMessage title={t("empty.title")} body={t("empty.body")}>
        <button type="button" className={`la-btn la-btn--wine ${TOUCH_ROW}`} onClick={() => state.setPanel({ kind: "create" })}>
          <Plus size={14} />
          {t("sessions.newDemo")}
        </button>
      </StateMessage>
    );
  } else if (!visible.length) {
    content = (
      <StateMessage title={t("sessions.noMatches")} body={narrowed ? undefined : t("sessions.expiredHidden")}>
        {narrowed && (
          <button type="button" className={`la-btn la-btn--soft ${TOUCH_ROW}`} onClick={clearFilters}>
            {t("sessions.clearFilters")}
          </button>
        )}
      </StateMessage>
    );
  } else {
    content = cards ? (
      <ProspectCards groups={groups ?? []} highlightKey={state.highlightKey} onOpenRow={openRow} />
    ) : (
      <SessionsTable
        rows={visible}
        groups={groups}
        sort={sort}
        onSort={onSort}
        highlightKey={state.highlightKey}
        onOpenRow={openRow}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ padding: "14px 24px 0" }}>
        <div className="la-page-center flex h-full min-h-0 flex-col">{content}</div>
      </div>
      <PanelSlot state={state} draft={draft} rows={rows} />
    </div>
  );
}
