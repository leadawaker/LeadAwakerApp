import { test } from "node:test";
import assert from "node:assert/strict";
import type { SocialPostView } from "../api/socialApi";
import type { ScriptView, TopicView } from "../api/studioApi";
import { groupScripts, managerHome, scriptActions, sortTopics, spokenSeconds, studioErrorKey } from "./studio";

const script = (over: Partial<ScriptView>): ScriptView => ({
  id: 1, title: "T", body: "", status: "idea", topicId: null, postId: null, post: null, videoUploadId: null, heygenVideoId: null,
  reviewStatus: "none", reviewNote: null, updatedAt: "2026-10-20T10:00:00Z", ...over,
});
const post = (over: Partial<SocialPostView>) => ({ id: 1, section: "upcoming", scheduledAt: "2026-10-22T10:00:00Z", ...over }) as SocialPostView;

test("error keys: known reasons, everything else is the fallback", () => {
  assert.equal(studioErrorKey("rate_limited"), "errors.rate_limited");
  assert.equal(studioErrorKey("weird"), "errors.failed");
  assert.equal(studioErrorKey(null), "errors.failed");
});

test("scripts group in pipeline order, newest first inside a group", () => {
  const groups = groupScripts([
    script({ id: 1, status: "draft", updatedAt: "2026-10-01T00:00:00Z" }),
    script({ id: 2, status: "idea" }),
    script({ id: 3, status: "draft", updatedAt: "2026-10-05T00:00:00Z" }),
  ]);
  assert.deepEqual(groups.map((g) => [g.status, g.scripts.map((s) => s.id)]), [["idea", [2]], ["draft", [3, 1]]]);
});

test("topics: new first, dismissed last", () => {
  const t = (id: number, status: TopicView["status"], createdAt: string) => ({ id, text: "", source: "typed", status, scriptId: null, createdAt }) as TopicView;
  assert.deepEqual(sortTopics([t(1, "dismissed", "2026-10-09"), t(2, "used", "2026-10-08"), t(3, "new", "2026-10-01"), t(4, "new", "2026-10-02")]).map((x) => x.id), [4, 3, 2, 1]);
});

test("Manager home: scripts waiting on him, videos to approve (soonest first), next 3 upcoming", () => {
  const home = managerHome(
    [script({ id: 1, reviewStatus: "waiting" }), script({ id: 2, reviewStatus: "ok" })],
    [post({ id: 1, section: "needs_approval", scheduledAt: "2026-10-25T10:00:00Z" }), post({ id: 2, section: "needs_approval", scheduledAt: "2026-10-21T10:00:00Z" }), post({ id: 3 }), post({ id: 4, section: "published" })],
  );
  assert.deepEqual(home.scriptsWaiting.map((s) => s.id), [1]);
  assert.deepEqual(home.videosWaiting.map((p) => p.id), [2, 1]);
  assert.deepEqual(home.upcoming.map((p) => p.id), [3]);
});

test("script actions follow the script's state", () => {
  assert.deepEqual(scriptActions(script({})), ["edit", "draft", "pickVideo", "uploadVideo"]);
  assert.deepEqual(scriptActions(script({ body: "x", videoUploadId: "u" })), ["edit", "draft", "sendForReview", "pickVideo", "uploadVideo", "schedule"]);
  assert.ok(!scriptActions(script({ body: "x", reviewStatus: "waiting" })).includes("sendForReview"));
  assert.deepEqual(scriptActions(script({ status: "published" })), []);
});

test("spoken length at ~175 words a minute, tags left out", () => {
  assert.equal(spokenSeconds(Array.from({ length: 175 }, () => "palavra").join(" ")), 60);
  assert.equal(spokenSeconds("[sighs] [short pause]"), 0);
});
