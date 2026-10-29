import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HomeReputation } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, boundsFor, rangeOf, bucketSql, fillDays, liveLeadSql, num, reputationCampaignSql } from "./homeSql";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];
const avg = (v: unknown): number | null => (v == null ? null : Math.round(Number(v) * 10) / 10);

async function getHomeReputation(q: HomeQuery): Promise<HomeReputation> {
  const b = await boundsFor(q);
  const { cur, end, prev, prevEnd } = rangeOf(b);
  const reviewScope = sql`${acct("r.accounts_id", q.accountId)}`;
  const requestScope = sql`${acct('l."Accounts_id"', q.accountId)} AND l.review_request_sent_at IS NOT NULL
    AND ${reputationCampaignSql} AND ${liveLeadSql}`;

  const [totals, ratings, days, recent, extras] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE COALESCE(r.review_created_at, r.created_at) >= ${cur} AND COALESCE(r.review_created_at, r.created_at) < ${end})::int AS reviews,
        count(*) FILTER (WHERE COALESCE(r.review_created_at, r.created_at) >= ${prev} AND COALESCE(r.review_created_at, r.created_at) < ${prevEnd})::int AS reviews_prev,
        avg(r.rating) FILTER (WHERE COALESCE(r.review_created_at, r.created_at) >= ${cur} AND COALESCE(r.review_created_at, r.created_at) < ${end}) AS avg_rating,
        avg(r.rating) FILTER (WHERE COALESCE(r.review_created_at, r.created_at) >= ${prev} AND COALESCE(r.review_created_at, r.created_at) < ${prevEnd}) AS avg_rating_prev,
        count(*) FILTER (WHERE r.posted_at >= ${cur} AND r.posted_at < ${end})::int AS replied,
        count(*) FILTER (WHERE r.posted_at >= ${prev} AND r.posted_at < ${prevEnd})::int AS replied_prev,
        count(*) FILTER (WHERE r.status IN ('new', 'drafted', 'approved'))::int AS awaiting
      FROM ${T.accountReviews} r WHERE ${reviewScope}`),
    db.execute(sql`
      SELECT r.rating, count(*)::int AS n FROM ${T.accountReviews} r
      WHERE ${reviewScope} AND COALESCE(r.review_created_at, r.created_at) >= ${cur} AND COALESCE(r.review_created_at, r.created_at) < ${end} GROUP BY 1`),
    db.execute(sql`
      SELECT ${bucketSql("COALESCE(r.review_created_at, r.created_at)", b)} AS day, count(*)::int AS value
      FROM ${T.accountReviews} r
      WHERE ${reviewScope} AND COALESCE(r.review_created_at, r.created_at) >= ${cur} AND COALESCE(r.review_created_at, r.created_at) < ${end} GROUP BY 1`),
    db.execute(sql`
      SELECT r.id, r.author_name, r.rating, left(COALESCE(r.review_text, ''), 140) AS text,
             r.posted_at IS NOT NULL AS replied, COALESCE(r.review_created_at, r.created_at) AS at
      FROM ${T.accountReviews} r
      WHERE ${reviewScope} AND COALESCE(r.review_created_at, r.created_at) >= ${cur} AND COALESCE(r.review_created_at, r.created_at) < ${end}
      ORDER BY COALESCE(r.review_created_at, r.created_at) DESC LIMIT 8`),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${requestScope} AND l.review_request_sent_at >= ${cur} AND l.review_request_sent_at < ${end})::int AS requests,
        (SELECT count(*) FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${requestScope} AND l.review_request_sent_at >= ${prev} AND l.review_request_sent_at < ${prevEnd})::int AS requests_prev,
        EXISTS (SELECT 1 FROM ${T.calendarConnections} g
          WHERE ${acct("g.account_id", q.accountId)} AND g.provider = 'gbp' AND g.external_id IS NOT NULL) AS connected`),
  ]);

  const t = rows(totals)[0] ?? {};
  const x = rows(extras)[0] ?? {};
  const byRating = new Map(rows(ratings).map((r) => [num(r.rating), num(r.n)]));
  return {
    // One Google Business Profile per account: no single profile in the all-accounts view.
    connected: q.accountId !== null && x.connected === true,
    reviews: { value: num(t.reviews), previous: num(t.reviews_prev) },
    avgRating: { value: avg(t.avg_rating), previous: avg(t.avg_rating_prev) },
    replied: { value: num(t.replied), previous: num(t.replied_prev) },
    awaitingReply: num(t.awaiting),
    requestsSent: { value: num(x.requests), previous: num(x.requests_prev) },
    ratings: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: byRating.get(rating) ?? 0 })),
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    recent: rows(recent).map((r) => ({
      id: num(r.id), author: (r.author_name as string | null) ?? null,
      rating: r.rating == null ? null : num(r.rating), text: String(r.text ?? ""),
      replied: r.replied === true, at: new Date(r.at as string).toISOString(),
    })),
  };
}

export const homeReputationStorage = { getHomeReputation };
