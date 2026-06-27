import { apiFetch, API_BASE } from "@/lib/apiUtils";

export interface ReviewsConnection {
  connected: boolean;
  status?: string;
  displayName?: string | null;
  locationName?: string | null;
  locationSelected?: boolean;
  lastError?: string | null;
}

export interface ReviewLocation {
  name: string;
  title: string;
}

export interface AccountReview {
  id: number;
  accountsId: number;
  platform: string | null;
  externalReviewId: string | null;
  authorName: string | null;
  rating: number | null;
  reviewText: string | null;
  reviewCreatedAt: string | null;
  status: string | null; // new | drafted | approved | posted | skipped
  draftReply: string | null;
  postedReply: string | null;
  postedAt: string | null;
  language: string | null;
}

export type ReviewAction = "approve" | "reject";

/** OAuth: full-page redirect to the Google consent screen (business.manage). */
export const startReviewsOAuth = (accountId: number) => {
  window.location.href = `${API_BASE}/api/reviews/oauth/google/authorize?accountId=${accountId}`;
};

export const fetchReviewsConnection = async (accountId: number): Promise<ReviewsConnection> => {
  const res = await apiFetch(`/api/accounts/${accountId}/reviews/connection`);
  if (!res.ok) throw new Error("Failed to load review connection");
  return res.json();
};

export const fetchReviewLocations = async (accountId: number): Promise<ReviewLocation[]> => {
  const res = await apiFetch(`/api/accounts/${accountId}/reviews/locations`);
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to load locations");
  }
  return res.json();
};

export const selectReviewLocation = async (accountId: number, location: ReviewLocation): Promise<void> => {
  const res = await apiFetch(`/api/accounts/${accountId}/reviews/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(location),
  });
  if (!res.ok) throw new Error("Failed to select location");
};

export const disconnectReviews = async (accountId: number): Promise<void> => {
  const res = await apiFetch(`/api/reviews/disconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) throw new Error("Failed to disconnect");
};

export const fetchReviews = async (accountId: number, statuses?: string[]): Promise<AccountReview[]> => {
  const qs = statuses && statuses.length ? `?status=${statuses.join(",")}` : "";
  const res = await apiFetch(`/api/accounts/${accountId}/reviews${qs}`);
  if (!res.ok) throw new Error("Failed to load reviews");
  return res.json();
};

export const pollReviewsNow = async (accountId: number): Promise<void> => {
  const res = await apiFetch(`/api/accounts/${accountId}/reviews/poll`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to refresh reviews");
};

export const actOnReview = async (
  reviewId: number,
  action: ReviewAction,
  draftReply?: string,
): Promise<AccountReview> => {
  const res = await apiFetch(`/api/reviews/${reviewId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, draftReply }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Action failed");
  }
  return res.json();
};
