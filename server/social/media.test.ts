import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_UPLOAD_BYTES,
  checkReelSpecs,
  probeVideo,
  remuxFaststart,
  streamToFileWithLimit,
  videoPathFor,
  SOCIAL_UPLOAD_DIR,
  type ProbeResult,
} from "./media";

// ffmpeg-backed tests run where ffmpeg exists (the Pi); elsewhere they are skipped, not failed.
const NEEDS_FFMPEG = { skip: (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return false; } catch { return "ffmpeg not installed"; } })() };

const tmp = mkdtempSync(join(tmpdir(), "social-media-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const good: ProbeResult = { formatName: "mov,mp4,m4a,3gp,3g2,mj2", videoCodec: "h264", audioCodec: "aac", audioSampleRate: 44100, durationS: 58, width: 1080, height: 1920, fps: 30 };

test("spec check accepts a HeyGen-like 9:16 video", () => assert.deepEqual(checkReelSpecs(good, 40e6), { ok: true }));
test("spec check accepts hevc and no audio", () => assert.deepEqual(checkReelSpecs({ ...good, videoCodec: "hevc", audioCodec: null, audioSampleRate: null }, 1e6), { ok: true }));
test("spec check reasons", () => {
  assert.deepEqual(checkReelSpecs({ ...good, formatName: "matroska,webm" }, 1e6), { ok: false, reason: "format" });
  assert.deepEqual(checkReelSpecs({ ...good, videoCodec: "vp9" }, 1e6), { ok: false, reason: "video_codec" });
  assert.deepEqual(checkReelSpecs({ ...good, audioCodec: "opus" }, 1e6), { ok: false, reason: "audio_codec" });
  assert.deepEqual(checkReelSpecs({ ...good, audioSampleRate: 96000 }, 1e6), { ok: false, reason: "audio_rate" });
  assert.deepEqual(checkReelSpecs({ ...good, durationS: 2.9 }, 1e6), { ok: false, reason: "duration_short" });
  assert.deepEqual(checkReelSpecs({ ...good, durationS: 900.1 }, 1e6), { ok: false, reason: "duration_long" });
  assert.deepEqual(checkReelSpecs({ ...good, fps: 15 }, 1e6), { ok: false, reason: "fps" });
  assert.deepEqual(checkReelSpecs({ ...good, width: 2160 }, 1e6), { ok: false, reason: "width" });
  assert.deepEqual(checkReelSpecs(good, MAX_UPLOAD_BYTES + 1), { ok: false, reason: "size" });
});

test("videoPathFor builds the per-account path", () => {
  assert.equal(videoPathFor(7, "abc", "mp4"), join(SOCIAL_UPLOAD_DIR, "7", "abc.mp4"));
});

test("streamToFileWithLimit writes under the limit", async () => {
  const dest = join(tmp, "ok.bin");
  assert.equal(await streamToFileWithLimit(Readable.from([Buffer.alloc(1000)]), dest, 2000), 1000);
  assert.equal(statSync(dest).size, 1000);
});
test("streamToFileWithLimit creates missing parent directories", async () => {
  const dest = join(tmp, "nested", "deeper", "ok.bin");
  assert.equal(await streamToFileWithLimit(Readable.from([Buffer.alloc(10)]), dest, 2000), 10);
  assert.equal(statSync(dest).size, 10);
});
test("streamToFileWithLimit rejects over the limit and leaves no file", async () => {
  const dest = join(tmp, "big.bin");
  await assert.rejects(streamToFileWithLimit(Readable.from([Buffer.alloc(1500), Buffer.alloc(1500)]), dest, 2000), /too_large/);
  assert.equal(existsSync(dest), false);
});
test("streamToFileWithLimit cleans up on a broken stream", async () => {
  const dest = join(tmp, "broken.bin");
  const src = new Readable({ read() { this.push(Buffer.alloc(100)); this.destroy(new Error("aborted")); } });
  await assert.rejects(streamToFileWithLimit(src, dest, 2000));
  assert.equal(existsSync(dest), false);
});
test("streamToFileWithLimit settles when the source was gone before it started (client hung up early)", { timeout: 3000 }, async () => {
  const dest = join(tmp, "gone.bin");
  const src = new Readable({ read() {} });
  src.destroy();
  await assert.rejects(streamToFileWithLimit(src, dest, 2000), /aborted/);
  assert.equal(existsSync(dest), false);
});

test("probe + faststart on a real 4 s clip", NEEDS_FFMPEG, async () => {
  const f = join(tmp, "clip.mp4");
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=size=108x192:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "4", "-c:v", "libx264", "-c:a", "aac", f], { stdio: "ignore" });
  await remuxFaststart(f);
  const p = await probeVideo(f);
  assert.equal(p.videoCodec, "h264");
  assert.equal(p.audioCodec, "aac");
  assert.equal(p.width, 108);
  assert.equal(p.height, 192);
  assert.equal(Math.round(p.fps), 30);
  assert.ok(p.durationS > 3.9 && p.durationS < 4.2);
});

test("remuxFaststart removes its temp file and rethrows on failure", async () => {
  const f = join(tmp, "garbage.mp4");
  execFileSync("sh", ["-c", `head -c 2000 /dev/urandom > "${f}"`]);
  await assert.rejects(remuxFaststart(f));
  const { readdirSync } = await import("node:fs");
  assert.deepEqual(readdirSync(tmp).filter((n) => n.includes("faststart")), []);
});
