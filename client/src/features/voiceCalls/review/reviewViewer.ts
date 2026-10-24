// Who is looking at a call review, for its cache key: the server cuts the review
// per viewer (tool details agency only, cost Owner only), so an Owner who starts
// "view as client" must not keep seeing the cached agency review.
import type { ImpersonationInfo } from "@/hooks/useWorkspace";

export function reviewViewerKey(userId: string | null, impersonation: ImpersonationInfo | null): string {
  const as = impersonation
    ? `as:${impersonation.role}:${impersonation.accountId ?? ""}:${impersonation.sandbox ? "sandbox" : "live"}`
    : "self";
  return `${userId || "anon"}|${as}`;
}
