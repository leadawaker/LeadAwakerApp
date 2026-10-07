import { useQuery } from "@tanstack/react-query";
import { fetchVoiceStats, voiceStatsKey } from "./voiceApi";

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Current month as YYYY-MM (the server applies the account's timezone to the boundaries). */
export function currentMonth(): string {
  return ym(new Date());
}

/** The last `count` months, newest first, as YYYY-MM. */
export function recentMonths(count = 12): string[] {
  const d = new Date();
  d.setDate(1);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(ym(d));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function useVoiceStats(accountId: number, month: string) {
  const query = useQuery({
    queryKey: voiceStatsKey(accountId, month),
    queryFn: () => fetchVoiceStats(accountId, month),
    enabled: accountId > 0,
    staleTime: 30 * 1000,
  });
  return { stats: query.data ?? null, loading: query.isLoading, error: query.error as Error | null };
}
