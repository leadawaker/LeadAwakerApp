import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import type { ProspectRow } from "../../prospectRows";
import { compareRows, groupsByDate, type SessionSort, type SortKey } from "../../sessionsView";
import { TOUCH_ROW } from "../../touchTargets";
import { DemosLoading } from "../DemosLoading";
import { SessionsTable } from "../table/SessionsTable";
import { useDateGroups } from "../table/useDateGroups";

/** A centred message with an optional action: the empty and error states share it. */
function Message({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span style={{ fontSize: 13.5, color: "var(--mute)" }}>{text}</span>
      {children}
    </div>
  );
}

/**
 * The "Demos" tab of a persona (or of No persona / Website visitors): that card's prospects as
 * the Demos table, with "+ Add prospect". All rows show, expired ones too (their link pills say
 * so). Searching and filtering the cards happens on the list, not here.
 */
export function PersonaDemosTab({ rows, isLoading, error, onRetry, sort, onSort, highlightKey, onOpenRow, onAddProspect, emptyText }: {
  /** This card's rows, unsorted. */
  rows: ProspectRow[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  sort: SessionSort;
  onSort: (key: SortKey) => void;
  highlightKey: string | null;
  onOpenRow: (rowKey: string) => void;
  /** Omit for Website visitors: visitors start those demos themselves. */
  onAddProspect?: () => void;
  emptyText: string;
}) {
  const { t } = useTranslation("demos");
  const sorted = useMemo(() => [...rows].sort(compareRows(sort)), [rows, sort]);
  const groups = useDateGroups(sorted, sort, groupsByDate(sort));

  const addButton = onAddProspect && (
    <button
      type="button"
      className={`la-btn la-btn--wine h-8 shrink-0 ${TOUCH_ROW}`}
      onClick={onAddProspect}
      data-testid="persona-add-prospect"
    >
      <Plus size={14} />
      {t("merge.demosTab.addProspect")}
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[160px]">
        <DemosLoading />
      </div>
    );
  }
  if (error) {
    return (
      <Message text={t("error.load")}>
        <button type="button" className={`la-btn la-btn--soft ${TOUCH_ROW}`} onClick={onRetry}>
          {t("common.retry")}
        </button>
      </Message>
    );
  }
  if (rows.length === 0) return <Message text={emptyText}>{addButton}</Message>;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="am-mono">{t("merge.meta.prospects", { count: rows.length })}</span>
        {addButton}
      </div>
      <SectionCard padded={false} className="overflow-hidden dp-group">
        <SessionsTable
          rows={sorted}
          groups={groups}
          sort={sort}
          onSort={onSort}
          highlightKey={highlightKey}
          onOpenRow={onOpenRow}
        />
      </SectionCard>
    </>
  );
}
