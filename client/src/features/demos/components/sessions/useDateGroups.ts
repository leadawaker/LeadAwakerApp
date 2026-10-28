import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ProspectRow } from "../../prospectRows";
import { dateSections, type SessionSort } from "../../sessionsView";

/** One date group, its heading already in the UI language. */
export interface LabelledGroup {
  key: string;
  label: string;
  rows: ProspectRow[];
}

/**
 * The rows under their date headings (Today, Yesterday, This week, Last week, then months), in the
 * browser's timezone. `rows` arrive filtered and sorted. null while `enabled` is false: the table
 * shows a flat list unless it is sorted by Sent.
 */
export function useDateGroups(rows: ProspectRow[], sort: SessionSort, enabled: boolean): LabelledGroup[] | null {
  const { t, i18n } = useTranslation("demos");
  return useMemo(
    () =>
      enabled
        ? dateSections(rows, sort, { locale: i18n.language }).map((g) => ({
            key: g.key,
            label: g.monthLabel ?? t(`listView.groups.${g.key}`),
            rows: g.items,
          }))
        : null,
    [enabled, rows, sort, i18n.language, t],
  );
}
