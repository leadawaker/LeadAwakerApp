import { useState, useEffect, useCallback, useRef } from "react";
import { WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionState = "connected" | "checking" | "disconnected" | "reconnecting" | "recovered";

/**
 * A banner that appears at the top of the CRM content area when the API is unreachable.
 * Polls /api/health and shows/hides based on connectivity.
 * Shows a brief "reconnected" confirmation when connection is restored.
 * Auto-retries every 10s while disconnected, 60s while connected.
 */
export function ConnectionBanner() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [retryCount, setRetryCount] = useState(0);
  const wasDisconnected = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = useCallback(async (isManualRetry = false) => {
    if (isManualRetry) {
      setState("reconnecting");
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch("/api/health", {
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        if (wasDisconnected.current) {
          // Was disconnected, now reconnected — show recovery
          setState("recovered");
          wasDisconnected.current = false;
        } else {
          setState("connected");
        }
        setRetryCount(0);
        return;
      }
      // Server responded but with error status
      throw new Error(`HTTP ${res.status}`);
    } catch {
      setState("disconnected");
      wasDisconnected.current = true;
    }
  }, []);

  // Clear "recovered" state after 3 seconds
  useEffect(() => {
    if (state === "recovered") {
      const t = setTimeout(() => setState("connected"), 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  // Initial check after a short delay
  useEffect(() => {
    const timer = setTimeout(() => checkConnection(), 2000);
    return () => clearTimeout(timer);
  }, [checkConnection]);

  // Adaptive polling: fast while disconnected, slow while connected
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const pollMs = state === "disconnected" ? 10000 : 60000;
    intervalRef.current = setInterval(() => checkConnection(), pollMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state, checkConnection]);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    checkConnection(true);
  };

  // Fully connected or initial check — render nothing
  if (state === "connected" || state === "checking") return null;

  // Recovered — brief green confirmation
  if (state === "recovered") {
    return (
      <div
        className="mx-4 md:mx-0 mb-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 px-4 py-2.5 text-sm animate-in fade-in slide-in-from-top-2 duration-300"
        role="status"
        data-testid="connection-banner-recovered"
      >
        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          Connection restored
        </span>
      </div>
    );
  }

  // Disconnected or reconnecting
  return (
    <div
      className={cn(
        "mx-4 md:mx-0 mb-3 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm",
        "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
        "animate-in fade-in slide-in-from-top-2 duration-300"
      )}
      role="alert"
      data-testid="connection-banner"
      data-state={state}
    >
      <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-amber-700 dark:text-amber-300">
          {state === "reconnecting"
            ? "Reconnecting to server..."
            : "Unable to reach the server"}
        </span>
        {state === "disconnected" && (
          <span className="text-amber-600/80 dark:text-amber-400/80 ml-1 hidden sm:inline">
            — Check your connection or try again.
            {retryCount >= 3 && " The server may be down."}
          </span>
        )}
      </div>
      <button
        onClick={handleRetry}
        disabled={state === "reconnecting"}
        className={cn(
          "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
          "bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50",
          "dark:bg-amber-500 dark:hover:bg-amber-600"
        )}
        data-testid="connection-banner-retry"
      >
        <RefreshCw className={cn("h-3 w-3", state === "reconnecting" && "animate-spin")} />
        {state === "reconnecting" ? "Retrying..." : "Retry Now"}
      </button>
      {retryCount > 0 && state === "disconnected" && (
        <span className="text-xs text-amber-600/60 dark:text-amber-400/60 shrink-0 hidden sm:inline">
          (Attempt {retryCount})
        </span>
      )}
    </div>
  );
}
