import { useHealthCheck } from "@/hooks/useHealthCheck";
import { cn } from "@/lib/utils";
import { Database } from "lucide-react";

/**
 * A small status indicator showing PostgreSQL connection health.
 * Shows a database icon circle with a colored status dot badge.
 * - Green: healthy (all tables accessible)
 * - Yellow: degraded (some tables inaccessible)
 * - Red: error (API unreachable or DB disconnected)
 * - Gray pulse: loading (initial check)
 */
export function DbStatusIndicator({ collapsed: _collapsed = false }: { collapsed?: boolean }) {
  const health = useHealthCheck(60000); // check every 60s

  const dotColor = {
    healthy: "bg-emerald-500",
    degraded: "bg-yellow-500",
    error: "bg-red-500",
    loading: "bg-gray-400 animate-pulse",
  }[health.status];

  const label = {
    healthy: "DB Connected",
    degraded: "DB Degraded",
    error: "DB Offline",
    loading: "Checking...",
  }[health.status];

  const detail = health.status === "healthy" || health.status === "degraded"
    ? `${health.accessibleTables}/${health.totalTables} tables`
    : health.error || "";

  return (
    <div
      className="relative group"
      data-testid="db-status-indicator"
      data-status={health.status}
      title={`${label}${detail ? ` — ${detail}` : ""}`}
    >
      {/* Database icon in standardized circle */}
      <div className="h-10 w-10 rounded-full border border-black/[0.125] flex items-center justify-center bg-transparent text-muted-foreground">
        <Database className="h-4 w-4" />
      </div>

      {/* Status dot badge */}
      <span
        className={cn(
          "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
          dotColor
        )}
      />

      {/* Hover tooltip */}
      <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-[120] pointer-events-none">
        <div className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-muted text-foreground shadow-lg border border-border/40">
          {label}
          {detail && <span className="text-muted-foreground ml-1">({detail})</span>}
        </div>
      </div>
    </div>
  );
}
