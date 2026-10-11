// Live data for the Reputation page: real Google reviews from the reviews API
// (specs/reputation-reviews), mapped onto the page's `Review` shape.
//
// Scope follows the nav bar's account switcher: one account when scoped, every
// account's reviews merged into one queue in agency view.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  actOnReview,
  fetchReviews,
  fetchReviewsConnection,
  type AccountReview,
  type ReviewsConnection,
} from "@/features/accounts/api/reviewsApi";
import type { Review, TimelineStep } from "./types";

// Everything except "skipped": the queue plus the posted history.
const LIVE_STATUSES = ["new", "drafted", "approved", "posted"];

export interface TimelineLabels {
  received: string;
  drafted: string;
  posted: string;
  anonymous: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

/** "6h" / "2d" / "3w", the format repAgeHours() parses. Empty when unknown. */
function agoOf(iso: string | null): string {
  if (!iso) return "";
  const hours = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : `${Math.round(days / 7)}w`;
}

function dateOf(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function toReview(row: AccountReview, accountName: string, labels: TimelineLabels): Review {
  const name = row.authorName?.trim() || labels.anonymous;
  const posted = row.status === "posted";
  const draft = row.draftReply?.trim() ? row.draftReply : null;
  const ago = agoOf(row.reviewCreatedAt);
  const timeline: TimelineStep[] = [
    { key: "received", label: labels.received, who: null, ago, done: true },
    { key: "drafted", label: labels.drafted, who: null, ago: null, done: !!draft },
    { key: "posted", label: labels.posted, who: null, ago: agoOf(row.postedAt), done: posted },
  ];
  // Google can return a review with no star rating; show it as neutral (3) so it
  // is never auto-sorted as either a complaint or praise.
  const rating = (row.rating && row.rating >= 1 && row.rating <= 5 ? row.rating : 3) as Review["rating"];
  return {
    id: String(row.id),
    name,
    ini: initials(name),
    rating,
    platform: row.platform || "google",
    lang: row.language || "en",
    ago,
    date: dateOf(row.reviewCreatedAt),
    status: posted ? "replied" : row.status === "skipped" ? "ignored" : "needs",
    job: accountName,
    text: row.reviewText || "",
    draft,
    tone: null,
    reply: posted && row.postedReply ? { text: row.postedReply, by: "", ago: agoOf(row.postedAt) } : null,
    timeline,
    confidence: 100,
    analysis: null,
    draftReady: !posted && !!draft,
  };
}

export interface LiveReputation {
  loading: boolean;
  /** Accounts in scope that have a Google Business Profile location selected. */
  connectedCount: number;
  reviews: Review[];
  busyId: string | null;
  reload: () => void;
  post: (reviewId: string, text: string) => Promise<void>;
  skip: (reviewId: string) => Promise<void>;
}

export function useLiveReputation(labels: TimelineLabels): LiveReputation {
  const { currentAccountId, accounts, isAgencyUser } = useWorkspace();
  const [rows, setRows] = useState<AccountReview[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // A scoped account wins; agency view fans out over every account.
  const scopeKey = currentAccountId > 0
    ? String(currentAccountId)
    : accounts.map((a) => a.id).join(",");

  const reload = useCallback(async () => {
    const ids = scopeKey ? scopeKey.split(",").map(Number).filter(Boolean) : [];
    // The reviews routes are agency-only.
    if (!isAgencyUser || ids.length === 0) {
      setRows([]); setConnectedCount(0); setLoading(false);
      return;
    }
    const perAccount = await Promise.all(ids.map(async (id) => {
      const conn: ReviewsConnection = await fetchReviewsConnection(id).catch(() => ({ connected: false }));
      if (!conn.connected || !conn.locationSelected) return { connected: false, list: [] as AccountReview[] };
      const list = await fetchReviews(id, LIVE_STATUSES).catch(() => [] as AccountReview[]);
      return { connected: true, list };
    }));
    setConnectedCount(perAccount.filter((p) => p.connected).length);
    setRows(perAccount.flatMap((p) => p.list));
    setLoading(false);
  }, [scopeKey, isAgencyUser]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    accounts.forEach((a) => m.set(a.id, a.name || ""));
    return m;
  }, [accounts]);

  const reviews = useMemo(
    () => rows.map((r) => toReview(r, nameById.get(r.accountsId) || "", labels)),
    // Labels change only with the language; keying on the values keeps this stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, nameById, labels.received, labels.drafted, labels.posted, labels.anonymous],
  );

  const act = useCallback(async (reviewId: string, action: "approve" | "reject", text?: string) => {
    setBusyId(reviewId);
    try {
      const updated = await actOnReview(Number(reviewId), action, text);
      setRows((prev) => action === "reject"
        ? prev.filter((r) => r.id !== updated.id)
        : prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      // The row may have changed server-side (already posted, skipped): reconcile.
      reload();
      throw e;
    } finally {
      setBusyId(null);
    }
  }, [reload]);

  const post = useCallback((id: string, text: string) => act(id, "approve", text), [act]);
  const skip = useCallback((id: string) => act(id, "reject"), [act]);

  return { loading, connectedCount, reviews, busyId, reload, post, skip };
}
