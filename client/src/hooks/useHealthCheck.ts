import { useState, useEffect, useCallback } from "react";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "error" | "loading";
  database: string;
  totalTables: number;
  accessibleTables: number;
  tables?: Record<string, { accessible: boolean; rowCount: number; error?: string }>;
  error?: string;
  lastChecked: Date | null;
}

/**
 * Hook that polls the /api/health endpoint to verify
 * PostgreSQL database connectivity from the frontend.
 *
 * @param intervalMs - polling interval in milliseconds (default: 60000 = 1 min)
 */
export function useHealthCheck(intervalMs = 60000): HealthCheckResult {
  const [result, setResult] = useState<HealthCheckResult>({
    status: "loading",
    database: "unknown",
    totalTables: 0,
    accessibleTables: 0,
    lastChecked: null,
  });

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { credentials: "include" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();

      const newResult: HealthCheckResult = {
        status: data.status ?? "error",
        database: data.database ?? "unknown",
        totalTables: data.totalTables ?? 0,
        accessibleTables: data.accessibleTables ?? 0,
        tables: data.tables,
        lastChecked: new Date(),
      };

      setResult(newResult);

      // Log to console for dev tools visibility
      if (data.status === "healthy") {
        console.log(
          `%c[Health Check] PostgreSQL connected — ${data.accessibleTables}/${data.totalTables} tables accessible`,
          "color: #22c55e; font-weight: bold"
        );
      } else if (data.status === "degraded") {
        console.warn(
          `[Health Check] PostgreSQL degraded — ${data.accessibleTables}/${data.totalTables} tables accessible`,
          data.tables
        );
      }
    } catch (err: any) {
      const errorResult: HealthCheckResult = {
        status: "error",
        database: "disconnected",
        totalTables: 0,
        accessibleTables: 0,
        error: err.message,
        lastChecked: new Date(),
      };
      setResult(errorResult);
      console.error("[Health Check] Failed to reach API:", err.message);
    }
  }, []);

  useEffect(() => {
    // Initial check
    check();

    // Periodic polling
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  return result;
}
