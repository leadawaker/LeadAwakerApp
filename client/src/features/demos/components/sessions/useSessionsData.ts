import { useCallback, useMemo } from "react";
import { useDemoProspects } from "../../api/demoProspectsApi";
import { useDemoSessions } from "../../api/demoSessionsApi";
import { buildProspectRows } from "../../prospectRows";

/**
 * The Sessions tab's data: prospects and links, joined into rows.
 *
 * The table shows as soon as there is something to show, so a slow prospects query never
 * holds back rows the sessions query already has. A failure of either query is an error
 * (never silently dropped) as long as it left that query without data; a background
 * refresh that fails keeps the table it already has.
 */
export function useSessionsData() {
  const sessionsQ = useDemoSessions();
  const prospectsQ = useDemoProspects();
  const { refetch: refetchSessions } = sessionsQ;
  const { refetch: refetchProspects } = prospectsQ;

  const rows = useMemo(
    () => buildProspectRows(prospectsQ.data ?? [], sessionsQ.data ?? []),
    [prospectsQ.data, sessionsQ.data],
  );

  // The clients that have prospects, for the filter menu.
  const clients = useMemo(
    () =>
      [...new Set(rows.map((r) => r.clientNiche).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((niche) => ({ niche, label: niche })),
    [rows],
  );

  const refresh = useCallback(
    () => void Promise.all([refetchSessions(), refetchProspects()]),
    [refetchSessions, refetchProspects],
  );

  const failed = (q: { data?: unknown; error: Error | null }) => (!q.data && q.error ? q.error : null);
  const error = failed(sessionsQ) ?? failed(prospectsQ);

  return {
    rows,
    clients,
    // Blocks only while there is nothing to show: sessions still loading, or no rows yet and prospects still loading.
    isLoading: !error && (sessionsQ.isLoading || (prospectsQ.isLoading && rows.length === 0)),
    error,
    // Only the error state's Retry: react-query and the SSE stream keep the data fresh otherwise.
    refresh,
  };
}
