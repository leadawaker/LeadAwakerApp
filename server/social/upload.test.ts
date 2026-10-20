import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findUpload, inspectVideo, receiveVideo } from "./upload";

// ffmpeg-backed tests run where ffmpeg exists (the Pi); elsewhere they are skipped, not failed.
const NEEDS_FFMPEG = { skip: (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return false; } catch { return "ffmpeg not installed"; } })() };

const tmp = mkdtempSync(join(tmpdir(), "social-upload-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

function clip(name: string, seconds: number): string {
  const f = join(tmp, name);
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=size=108x192:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", String(seconds), "-c:v", "libx264", "-c:a", "aac", f], { stdio: "ignore" });
  return f;
}

test("a good clip is stored, made faststart and described", NEEDS_FFMPEG, async () => {
  const src = clip("src-good.mp4", 4);
  const dest = join(tmp, "in", "good.mp4");
  const r = await receiveVideo(createReadStream(src), dest);
  assert.ok(r.ok);
  assert.equal(r.width, 108); assert.equal(r.height, 192);
  assert.ok(r.durationS > 3.9 && r.durationS < 4.2);
  assert.equal(r.bytes, statSync(dest).size);
});
test("garbage is refused as format and leaves no file", async () => {
  const dest = join(tmp, "in", "garbage.mp4");
  const r = await receiveVideo(Readable.from([Buffer.alloc(5000, 7)]), dest);
  assert.deepEqual(r, { ok: false, status: 422, reason: "format" });
  assert.equal(existsSync(dest), false);
});
test("a clip outside the Reel specs is refused with the reason and leaves no file", NEEDS_FFMPEG, async () => {
  const src = clip("src-short.mp4", 2);
  const dest = join(tmp, "in", "short.mp4");
  assert.deepEqual(await receiveVideo(createReadStream(src), dest), { ok: false, status: 422, reason: "duration_short" });
  assert.equal(existsSync(dest), false);
});
test("an upload over the limit is refused as size and leaves no file", async () => {
  const dest = join(tmp, "in", "big.mp4");
  assert.deepEqual(await receiveVideo(Readable.from([Buffer.alloc(3000), Buffer.alloc(3000)]), dest, 5000), { ok: false, status: 413, reason: "size" });
  assert.equal(existsSync(dest), false);
});
test("an aborted upload leaves no file", async () => {
  const dest = join(tmp, "in", "aborted.mp4");
  const src = new Readable({ read() { this.push(Buffer.alloc(100)); this.destroy(new Error("aborted")); } });
  assert.deepEqual(await receiveVideo(src, dest), { ok: false, status: 400, reason: "aborted" });
  assert.equal(existsSync(dest), false);
});
test("inspectVideo re-checks a stored file; a missing file is null", NEEDS_FFMPEG, async () => {
  const good = clip("stored.mp4", 4);
  const r = await inspectVideo(good);
  assert.ok(r && r.ok); assert.equal(r.bytes, statSync(good).size);
  assert.equal(await inspectVideo(join(tmp, "nope.mp4")), null);
});
test("findUpload is null for an upload that does not exist", async () => {
  assert.equal(await findUpload(999999, "0b9f1c1e-0000-4000-8000-00000000dead"), null);
});
