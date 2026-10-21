/** Wires the Insights section's route (server/social/insightsRoutes.ts) to the real storage. */
import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { registerInsightRoutes } from "../social/insightsRoutes";

export function registerSocialInsightRoutes(app: Express): void {
  registerInsightRoutes(app, {
    requireAuth,
    now: () => new Date(),
    store: {
      async getAccount(accountId) {
        const a = await storage.getAccountById(accountId);
        return a ? { timezone: a.timezone, language: a.language, socialEnabled: a.socialEnabled === true } : null;
      },
      listInsightMedia: (id, limit) => storage.listInsightMedia(id, limit),
      latestMediaValues: (id) => storage.latestMediaValues(id),
      accountSnapshots: (id, since) => storage.accountSnapshots(id, since),
      skippedMetrics: (id, since) => storage.skippedMetrics(id, since),
      getInsightState: (id) => storage.getInsightState(id),
    },
  });
}
