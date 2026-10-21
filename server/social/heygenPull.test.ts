import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { HeygenError, type HeygenClient, type HeygenVideo } from "./heygen";
import { pullHeygenVideo } from "./heygenPull";
import type { UploadOutcome } from "./upload";

const done: HeygenVideo = { id: "v1", title: "T", status: "completed", durationS: 50, createdAt: null, thumbnailUrl: null, videoPageUrl: null, videoUrl: "https://f/1.mp4?sig=1" };
const OK: UploadOutcome = { ok: true, durationS: 50, width: 1080, height: 1920, bytes: 10 };

function client(videos: (HeygenVideo | null)[], downloads: Array<"ok" | "expired" | "boom">) {
  const log: string[] = [];
  const c: HeygenClient = {
    async listVideos() { return { videos: [], nextToken: null }; },
    async getVideo(id) { log.push(`get ${id}`); return videos.length > 1 ? videos.shift()! : videos[0]; },
    async downloadVideo(url) {
      log.push(`download ${url}`);
      const d = downloads.shift() ?? "ok";
      if (d === "expired") throw new HeygenError("expired", "expired", 403);
      if (d === "boom") throw new Error("disk on fire");
      return Readable.from([Buffer.from("x")]);
    },
  };
  return { c, log };
}

const base = { videoId: "v1", destPath: "/tmp/x.mp4", maxBytes: 100 };

test("happy path: one get, one download, through receive", async () => {
  const { c, log } = client([done], ["ok"]);
  const r = await pullHeygenVideo({ ...base, client: c, receive: async () => OK });
  assert.equal(r.ok, true);
  assert.deepEqual(log, ["get v1", "download https://f/1.mp4?sig=1"]);
});

test("an expired link is fetched again once, then the download succeeds", async () => {
  const fresh = { ...done, videoUrl: "https://f/1.mp4?sig=2" };
  const { c, log } = client([done, fresh], ["expired", "ok"]);
  const r = await pullHeygenVideo({ ...base, client: c, receive: async () => OK });
  assert.equal(r.ok, true);
  assert.deepEqual(log, ["get v1", "download https://f/1.mp4?sig=1", "get v1", "download https://f/1.mp4?sig=2"]);
});

test("a stream that dies half way (receive says aborted) is retried once, then gives up", async () => {
  const { c, log } = client([done], []);
  let n = 0;
  const r = await pullHeygenVideo({ ...base, client: c, receive: async () => { n++; return { ok: false, status: 400, reason: "aborted" }; } });
  assert.deepEqual(r, { ok: false, status: 502, reason: "download_failed" });
  assert.equal(n, 2);
  assert.equal(log.filter((l) => l.startsWith("get")).length, 2);
});

test("not found, not finished, spec failure and unexpected errors", async () => {
  assert.deepEqual(await pullHeygenVideo({ ...base, client: client([null], []).c, receive: async () => OK }), { ok: false, status: 404, reason: "not_found" });
  assert.deepEqual(await pullHeygenVideo({ ...base, client: client([{ ...done, status: "processing" }], []).c, receive: async () => OK }), { ok: false, status: 409, reason: "not_ready" });
  assert.deepEqual(await pullHeygenVideo({ ...base, client: client([done], ["ok"]).c, receive: async () => ({ ok: false, status: 422, reason: "duration_long" }) }), { ok: false, status: 422, reason: "duration_long" });
  await assert.rejects(pullHeygenVideo({ ...base, client: client([done], ["boom"]).c, receive: async () => OK }), /disk on fire/);
});
