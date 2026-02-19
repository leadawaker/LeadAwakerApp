import { useHealthCheck } from "@/hooks/useHealthCheck";
import { cn } from "@/lib/utils";
import { Database } from "lucide-react";

/**
 * A small status indicator showing PostgreSQL connection health.
 * Shows a colored dot with optional label in expanded mode.
 * - Green: healthy (all tables accessible)
 * - Yellow: degraded (some tables inaccessible)
 * - Red: error (API unreachable or DB disconnected)
 * - Gray pulse: loading (initial check)
 */
export function DbStatusIndicator({ collapsed = false }: { collapsed?: boolean }) {
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
      className={cn(
        "flex items-center gap-2 rounded-lg transition-colors",
        collapsed ? "justify-center py-1" : "px-3 py-1.5"
      )}
      data-testid="db-status-indicator"
      data-status={health.status}
      title={`${label}${detail ? ` — ${detail}` : ""}`}
    >
      {collapsed ? (
        /* Collapsed: just show the dot */
        <div className="relative group flex items-center justify-center">
          <span className={cn("h-2.5 w-2.5 rounded-full", dotColor)} />
          {/* Tooltip on hover */}
          <div className="absolute left-[20px] opacity-0 group-hover:opacity-100 transition-opacity z-[120] pointer-events-none">
            <div className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-muted text-foreground shadow-lg border border-border/40">
              {label}
              {detail && <span className="text-muted-foreground ml-1">({detail})</span>}
            </div>
          </div>
        </div>
      ) : (
        /* Expanded: dot + label */
        <>
          <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
          <span className="text-[10px] text-muted-foreground font-medium truncate">
            {label}
          </span>
        </>
      )}
    </div>
  );
}
