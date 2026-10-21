// GET /api/social/accounts/:id/insights?days=7|30: the Insights section. Any user of the account
// (agency, Manager, Viewer), behind the same account gate as the other Socials routes. Read-only.
import type { Express, RequestHandler } from "express";
import type { SocialInsightMedia } from "@shared/schema";
import { wrapAsync } from "../routes/_helpers";
import { makeAccountGate, type GetAccount } from "./gate";
import { buildInsightsView } from "./insightsView";

export interface InsightRouteDeps {
  requireAuth: RequestHandler;
  now(): Date;
  store: {
    getAccount: GetAccount;
    listInsightMedia(accountId: number, limit: number): Promise<SocialInsightMedia[]>;
    latestMediaValues(accountId: number): Promise<{ igMediaId: string; metric: string; value: number }[]>;
    accountSnapshots(accountId: number, sinceDay: string): Promise<{ metric: string; bucket: string; value: number }[]>;
    skippedMetrics(accountId: number, since: Date): Promise<string[]>;
    getInsightState(accountId: number): Promise<{ lastAccountRunAt: Date | null; lastError: string | null } | null>;
  };
}

export function registerInsightRoutes(app: Express, deps: InsightRouteDeps): void {
  const accountGate = makeAccountGate((id) => deps.store.getAccount(id));
  app.get("/api/social/accounts/:id/insights", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    const days = Number(req.query.days) === 30 ? 30 : 7;
    const now = deps.now();
    const since = new Date(now.getTime() - 40 * 86_400_000).toISOString().slice(0, 10);
    const [media, latest, account, skipped, state] = await Promise.all([
      deps.store.listInsightMedia(ctx.accountId, 100),
      deps.store.latestMediaValues(ctx.accountId),
      deps.store.accountSnapshots(ctx.accountId, since),
      deps.store.skippedMetrics(ctx.accountId, new Date(now.getTime() - 7 * 86_400_000)),
      deps.store.getInsightState(ctx.accountId),
    ]);
    res.json({
      ...buildInsightsView({ days, now, timeZone: ctx.timeZone, media, latest, account, skipped }),
      lastRunAt: state?.lastAccountRunAt?.toISOString() ?? null,
      timeZone: ctx.timeZone,
    });
  }));
}
