import { useMemo, useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { SkeletonCardGrid } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

/** Returns Tailwind classes for the status badge based on status value */
function getStatusBadgeClasses(status: string | null | undefined): string {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized === "active") {
    return "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50";
  }
  if (normalized === "archived") {
    return "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700/50";
  }
  // Unknown / null status — show as gray
  return "bg-gray-100 text-gray-400 border border-gray-200 dark:bg-gray-800/30 dark:text-gray-500 dark:border-gray-700/30";
}

function getStatusLabel(status: string | null | undefined): string {
  const normalized = (status || "").trim();
  return normalized || "Unknown";
}

export default function PromptLibraryPage() {
  const { isAgencyView } = useWorkspace();
  const [q, setQ] = useState("");
  const [promptLibrary, setPromptLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Agency view shows all prompts; no account-filter applied here
      const res = await apiFetch("/api/prompts");
      if (!res.ok) throw new Error(`${res.status}: Failed to fetch prompts`);
      const data = await res.json();
      setPromptLibrary(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch prompts:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [isAgencyView]);

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
            {rows.map((p: any) => {
              const promptId = p.id || p.Id;
              return (
                <div key={promptId} className="rounded-2xl border border-border bg-card p-4 h-fit shadow-sm" data-testid={`card-prompt-${promptId}`}>
                  {/* Header row: name + status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-foreground leading-snug" data-testid={`text-prompt-name-${promptId}`}>
                      {p.name || <span className="text-muted-foreground italic">Untitled</span>}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusBadgeClasses(p.status)}`}
                      data-testid={`badge-prompt-status-${promptId}`}
                    >
                      {getStatusLabel(p.status)}
                    </span>
                  </div>

                  {/* Use case */}
                  <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-prompt-usecase-${promptId}`}>
                    {p.useCase || p.use_case || ""}
                  </div>

                  {/* Version + model + score row */}
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {/* Version number */}
                      {p.version && (
                        <span
                          className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-mono font-medium text-foreground"
                          data-testid={`text-prompt-version-${promptId}`}
                        >
                          v{p.version}
                        </span>
                      )}
                      {/* Model */}
                      {p.model && (
                        <span className="font-medium" data-testid={`text-prompt-model-${promptId}`}>
                          {p.model}
                        </span>
                      )}
                    </div>
                    {/* Performance score */}
                    {p.performanceScore != null && (
                      <span className="font-medium" data-testid={`text-prompt-score-${promptId}`}>
                        score: {p.performanceScore}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CrmShell>
  );
}
