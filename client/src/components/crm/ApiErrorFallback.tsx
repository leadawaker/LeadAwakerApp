import { WifiOff, ServerCrash, ShieldAlert, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ErrorType = "network" | "server" | "auth" | "unknown";

interface ApiErrorFallbackProps {
  /** The error object or message */
  error?: Error | string | null;
  /** Callback to retry the failed operation */
  onRetry?: () => void;
  /** Whether a retry is currently in progress */
  isRetrying?: boolean;
  /** Optional title override */
  title?: string;
  /** Optional description override */
  description?: string;
  /** Compact mode for inline use (smaller padding, no icon) */
  compact?: boolean;
  /** Additional CSS class */
  className?: string;
}

/** Classify an error to choose the right icon and messaging */
function classifyError(error?: Error | string | null): ErrorType {
  if (!error) return "unknown";
  const msg = typeof error === "string" ? error : error.message;
  const lower = msg.toLowerCase();

  // Network errors (fetch failed, timeout, no connection)
  if (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("failed to fetch") ||
    lower.includes("err_connection") ||
    lower.includes("econnrefused") ||
    lower.includes("load failed")
  ) {
    return "network";
  }

  // Auth errors
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return "auth";
  }

  // Server errors (5xx)
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("server")) {
    return "server";
  }

  return "unknown";
}

const errorConfig: Record<ErrorType, { icon: typeof WifiOff; title: string; description: string; iconBg: string; iconColor: string }> = {
  network: {
    icon: WifiOff,
    title: "Connection Lost",
    description: "Unable to reach the server. Please check your internet connection and try again.",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  server: {
    icon: ServerCrash,
    title: "Server Error",
    description: "The server encountered an error processing your request. This is usually temporary — please try again in a moment.",
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  auth: {
    icon: ShieldAlert,
    title: "Access Denied",
    description: "Your session may have expired. Please log in again to continue.",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  unknown: {
    icon: AlertCircle,
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
};

/**
 * User-friendly error fallback for API/network errors.
 * Automatically classifies the error type and shows appropriate
 * icon, message, and retry button.
 */
export function ApiErrorFallback({
  error,
  onRetry,
  isRetrying = false,
  title: titleOverride,
  description: descOverride,
  compact = false,
  className,
}: ApiErrorFallbackProps) {
  const errorType = classifyError(error);
  const config = errorConfig[errorType];
  const Icon = config.icon;
  const title = titleOverride || config.title;
  const description = descOverride || config.description;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3",
          className
        )}
        role="alert"
        data-testid="api-error-fallback"
        data-error-type={errorType}
      >
        <Icon className={cn("h-4 w-4 shrink-0", config.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            data-testid="api-error-retry"
          >
            <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center p-8",
        compact ? "min-h-[100px]" : "min-h-[250px]",
        className
      )}
      role="alert"
      data-testid="api-error-fallback"
      data-error-type={errorType}
    >
      <div className="flex flex-col items-center text-center max-w-sm space-y-4">
        <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center", config.iconBg)}>
          <Icon className={cn("h-7 w-7", config.iconColor)} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            data-testid="api-error-retry"
          >
            <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
            {isRetrying ? "Retrying..." : "Try Again"}
          </button>
        )}
      </div>
    </div>
  );
}
