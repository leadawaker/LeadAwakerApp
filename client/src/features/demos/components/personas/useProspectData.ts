import { useCallback, useMemo } from "react";
import { useDemoProspects } from "../../api/demoProspectsApi";
import { useDemoSessions } from "../../api/demoSessionsApi";
import { buildProspectRows } from "../../prospectRows";

/**
 * The Demos page's data: prospects and links, joined into one row per prospect. Every persona's
 * Demos tab, the special cards and the activity dots read from these rows.
 *
 * The rows show as soon as there is something to show, so a slow prospects query never
 * holds back rows the sessions query already has. A failure of either query is an error
 * (never silently dropped) as long as it left that query without data; a background
 * refresh that fails keeps the rows it already has.
 */
export function useProspectData() {
  const sessionsQ = useDemoSessions();
  const prospectsQ = useDemoProspects();
  const { refetch: refetchSessions } = sessionsQ;
  const { refetch: refetchProspects } = prospectsQ;

  const rows = useMemo(
    () => buildProspectRows(prospectsQ.data ?? [], sessionsQ.data ?? []),
    [prospectsQ.data, sessionsQ.data],
  );

  const refresh = useCallback(
    () => void Promise.all([refetchSessions(), refetchProspects()]),
    [refetchSessions, refetchProspects],
  );

  const failed = (q: { data?: unknown; error: Error | null }) => (!q.data && q.error ? q.error : null);
  const error = failed(sessionsQ) ?? failed(prospectsQ);

  return {
    rows,
    // Blocks only while there is nothing to show: sessions still loading, or no rows yet and prospects still loading.
    isLoading: !error && (sessionsQ.isLoading || (prospectsQ.isLoading && rows.length === 0)),
    error,
    // Only the error state's Retry: react-query and the SSE stream keep the data fresh otherwise.
    refresh,
  };
}
