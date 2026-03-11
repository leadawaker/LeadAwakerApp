import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Determines if a failed query should be retried.
 * - Network errors (fetch failed, timeout): retry up to 2 times
 * - Server errors (5xx): retry up to 2 times
 * - Client errors (4xx): never retry (bad request, auth, not found, etc.)
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Network errors — always worth retrying
    if (
      msg.includes("fetch") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("failed to fetch") ||
      msg.includes("load failed") ||
      msg.includes("err_connection") ||
      msg.includes("econnrefused") ||
      msg.includes("aborted")
    ) {
      return true;
    }

    // Server errors (5xx) — transient, worth retrying
    if (msg.startsWith("500") || msg.startsWith("502") || msg.startsWith("503") || msg.startsWith("504")) {
      return true;
    }
  }

  // Don't retry client errors (4xx) or unknown errors
  return false;
}

/** Exponential backoff delay: 1s, 2s */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: shouldRetry,
      retryDelay,
    },
    mutations: {
      retry: false,
    },
  },
});
