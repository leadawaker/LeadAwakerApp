// Real storage and Graph wiring for the insights collector. Kept apart from insightsCollector.ts so
// its tests never load the database.
import { storage } from "../storage";
import { defaultIgDeps } from "./instagramApi";
import { getAccountDayTotals, getFollowerDailyChanges, getMediaInsights, getProfileCounts, listRecentMedia } from "./insightsApi";
import type { InsightsDeps } from "./insightsCollector";

export function liveInsightsDeps(): InsightsDeps {
  const ig = defaultIgDeps();
  return {
    now: () => new Date(),
    async listAccounts() {
      const conns = await storage.listSocialConnectionsForRefresh();
      return conns
        .filter((c) => c.status === "connected" && c.externalUserId)
        .map((c) => ({ accountId: c.accountsId, igUserId: c.externalUserId!, token: storage.getSocialAccessToken(c) ?? "" }))
        .filter((a) => a.token);
    },
    getState: (id) => storage.getInsightState(id),
    setState: (id, fields) => storage.setInsightState(id, fields),
    upsertMedia: (id, media) => storage.upsertInsightMedia(id, media),
    async listMediaToPoll(id, limit) {
      return (await storage.listInsightMedia(id, limit)).map((m) => ({ igMediaId: m.igMediaId, productType: m.productType, postedAt: m.postedAt, lastPolledAt: m.lastPolledAt }));
    },
    markPolled: (id, mediaId, at) => storage.markInsightMediaPolled(id, mediaId, at),
    upsertSnapshots: (rows) => storage.upsertInsightSnapshots(rows),
    async followerBuckets(id, sinceDay) {
      return new Set((await storage.accountSnapshots(id, sinceDay)).filter((r) => r.metric === "followers_count").map((r) => r.bucket));
    },
    ig: {
      profile: (a) => getProfileCounts(ig, a.igUserId, a.token),
      recentMedia: (a, limit) => listRecentMedia(ig, a.igUserId, a.token, limit),
      mediaInsights: (a, mediaId, metrics) => getMediaInsights(ig, mediaId, a.token, metrics),
      dayTotals: (a, metrics, day) => getAccountDayTotals(ig, a.igUserId, a.token, metrics, day),
      followerChanges: (a, now) => getFollowerDailyChanges(ig, a.igUserId, a.token, now),
    },
  };
}
