import { useMemo, useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { SkeletonCardGrid } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

export default function PromptLibraryPage() {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");
  const [promptLibrary, setPromptLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (currentAccountId) params.set("accountId", String(currentAccountId));
      const qs = params.toString();
      const url = qs ? `/api/prompts?${qs}` : "/api/prompts";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`${res.status}: Failed to fetch prompts`);
      const data = await res.json();
      setPromptLibrary(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch prompts:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [currentAccountId]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const rows = useMemo(() => {
    return promptLibrary
      .filter((p: any) => (q ? (p.name || "").toLowerCase().includes(q.toLowerCase()) : true));
  }, [promptLibrary, q]);

  return (
    <CrmShell>
      <div className="py-4 h-full flex flex-col" data-testid="page-prompt-library">
        <div className="flex items-center gap-2 mb-6" data-testid="bar-prompts">
          <input
            className="h-10 w-[320px] max-w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search prompts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-prompt-search"
          />
        </div>

        {error && promptLibrary.length === 0 && !loading ? (
          <ApiErrorFallback
            error={error}
            onRetry={fetchPrompts}
            isRetrying={loading}
          />
        ) : loading ? (
          <SkeletonCardGrid count={6} columns="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" className="flex-1" />
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-2" data-testid="grid-prompts">
            {rows.length === 0 && (
              <div className="col-span-full">
                <DataEmptyState variant={q ? "search" : "prompts"} />
              </div>
            )}
            {rows.map((p: any) => (
              <div key={p.id || p.Id} className="rounded-2xl border border-border bg-card p-4 h-fit shadow-sm" data-testid={`card-prompt-${p.id || p.Id}`}>
                <div className="font-semibold text-foreground" data-testid={`text-prompt-name-${p.id || p.Id}`}>{p.name}</div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-prompt-usecase-${p.id || p.Id}`}>{p.use_case}</div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium" data-testid={`text-prompt-model-${p.id || p.Id}`}>model: {p.model}</span>
                  <span className="font-medium" data-testid={`text-prompt-score-${p.id || p.Id}`}>score: {p.performance_score}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CrmShell>
  );
}
