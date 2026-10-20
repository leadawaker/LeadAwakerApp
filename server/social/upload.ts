// Receiving a Reel upload: stream it to disk, move the moov atom to the front, probe it and check
// Meta's Reel specs. Every failure leaves no file behind. The caller picks the path (videoPathFor),
// so tests can work in a temp dir.
import { stat, unlink } from "node:fs/promises";
import {
  MAX_UPLOAD_BYTES,
  checkReelSpecs,
  probeVideo,
  remuxFaststart,
  streamToFileWithLimit,
  videoPathFor,
  type ProbeResult,
} from "./media";

export type VideoMeta = { ok: true; durationS: number; width: number; height: number; bytes: number };
export type VideoCheck = VideoMeta | { ok: false; reason: string };
export type UploadOutcome = VideoMeta | { ok: false; status: 400 | 413 | 422; reason: string };

async function removeQuietly(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // already gone
  }
}

/** Probes a stored file and checks it against the Reel specs. null when the file does not exist. */
export async function inspectVideo(path: string): Promise<VideoCheck | null> {
  let bytes: number;
  try {
    bytes = (await stat(path)).size;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
  let probe: ProbeResult;
  try {
    probe = await probeVideo(path);
  } catch {
    return { ok: false, reason: "format" };
  }
  const specs = checkReelSpecs(probe, bytes);
  if (!specs.ok) return specs;
  return { ok: true, durationS: probe.durationS, width: probe.width, height: probe.height, bytes };
}

/**
 * Streams src to destPath (bytes counted as they arrive), then faststart, probe and spec check.
 * 413 "size" past maxBytes, 400 "aborted" when the client went away, 422 with the spec reason.
 * Disk errors are thrown, after the file is removed.
 */
export async function receiveVideo(
  src: NodeJS.ReadableStream,
  destPath: string,
  maxBytes: number = MAX_UPLOAD_BYTES,
): Promise<UploadOutcome> {
  try {
    await streamToFileWithLimit(src, destPath, maxBytes);
  } catch (err: any) {
    // streamToFileWithLimit has already removed the partial file.
    if (err?.message === "too_large") return { ok: false, status: 413, reason: "size" };
    if (err?.syscall) throw err; // a disk problem, not the client
    return { ok: false, status: 400, reason: "aborted" };
  }
  try {
    try {
      await remuxFaststart(destPath);
    } catch {
      await removeQuietly(destPath);
      return { ok: false, status: 422, reason: "format" };
    }
    const check = await inspectVideo(destPath);
    if (check?.ok) return check;
    await removeQuietly(destPath);
    return { ok: false, status: 422, reason: check?.reason ?? "format" };
  } catch (err) {
    await removeQuietly(destPath);
    throw err;
  }
}

/** Where an earlier upload to this account was stored, or null. */
export async function findUpload(accountId: number, uploadId: string): Promise<{ path: string; ext: "mp4" | "mov" } | null> {
  for (const ext of ["mp4", "mov"] as const) {
    const path = videoPathFor(accountId, uploadId, ext);
    try {
      if ((await stat(path)).isFile()) return { path, ext };
    } catch {
      // not this extension
    }
  }
  return null;
}
