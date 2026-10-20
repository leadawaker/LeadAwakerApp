import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const SOCIAL_UPLOAD_DIR = resolve("uploads/social");
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const FFPROBE_TIMEOUT_MS = 30_000;
const FFMPEG_TIMEOUT_MS = 120_000;

async function removeQuietly(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // already gone
  }
}

/**
 * Streams src to destPath, counting bytes as they arrive (Content-Length is not trusted).
 * Resolves with the bytes written. Rejects Error("too_large") past maxBytes, and deletes
 * the partial file on any failure.
 */
export async function streamToFileWithLimit(
  src: NodeJS.ReadableStream,
  destPath: string,
  maxBytes: number,
): Promise<number> {
  await mkdir(dirname(destPath), { recursive: true });
  return new Promise<number>((resolvePromise, reject) => {
    // A request whose client hung up before this point (e.g. during the await above) has
    // already emitted its last event; waiting for one would hang with an empty file left open.
    if ((src as { destroyed?: boolean }).destroyed) {
      reject(new Error("aborted"));
      return;
    }
    const out = createWriteStream(destPath);
    let written = 0;
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      src.removeListener("data", onData);
      (src as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
      out.destroy();
      out.once("close", () => {
        void removeQuietly(destPath).then(() => reject(err));
      });
    };

    const onData = (chunk: Buffer | string) => {
      written += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      if (written > maxBytes) {
        fail(new Error("too_large"));
        return;
      }
      if (!out.write(chunk)) {
        src.pause();
        out.once("drain", () => src.resume());
      }
    };

    src.on("data", onData);
    src.once("end", () => {
      if (settled) return;
      out.end();
    });
    src.once("error", (e) => fail(e instanceof Error ? e : new Error(String(e))));
    src.once("close", () => {
      // closed without a clean end (aborted request)
      if (!settled && !(src as { readableEnded?: boolean }).readableEnded) fail(new Error("aborted"));
    });
    out.once("error", fail);
    out.once("finish", () => {
      if (settled) return;
      settled = true;
      resolvePromise(written);
    });
  });
}

export interface ProbeResult {
  formatName: string;
  videoCodec: string | null;
  audioCodec: string | null;
  audioSampleRate: number | null;
  durationS: number;
  width: number;
  height: number;
  fps: number;
}

function parseRate(r: unknown): number {
  if (typeof r !== "string") return 0;
  const [n, d] = r.split("/").map(Number);
  if (!Number.isFinite(n)) return 0;
  if (d === undefined) return n;
  return d ? n / d : 0;
}

export async function probeVideo(path: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
    { timeout: FFPROBE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
  );
  const data = JSON.parse(stdout) as {
    format?: { format_name?: string; duration?: string };
    streams?: Array<Record<string, any>>;
  };
  const streams = data.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");
  const duration = Number(data.format?.duration ?? v?.duration ?? 0);
  const sampleRate = a?.sample_rate !== undefined ? Number(a.sample_rate) : null;
  return {
    formatName: data.format?.format_name ?? "",
    videoCodec: v?.codec_name ?? null,
    audioCodec: a?.codec_name ?? null,
    audioSampleRate: sampleRate !== null && Number.isFinite(sampleRate) ? sampleRate : null,
    durationS: Number.isFinite(duration) ? duration : 0,
    width: Number(v?.width ?? 0),
    height: Number(v?.height ?? 0),
    fps: parseRate(v?.avg_frame_rate) || parseRate(v?.r_frame_rate),
  };
}

/** Moves the moov atom to the front without re-encoding. Replaces the original atomically. */
export async function remuxFaststart(path: string): Promise<void> {
  const ext = extname(path);
  const tmpPath = join(dirname(path), `.faststart-${randomBytes(6).toString("hex")}${ext}`);
  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-v", "error", "-i", path, "-c", "copy", "-movflags", "+faststart", tmpPath],
      { timeout: FFMPEG_TIMEOUT_MS },
    );
    await rename(tmpPath, path);
  } catch (err) {
    await removeQuietly(tmpPath);
    throw err;
  }
}

export type ReelSpecReason =
  | "format"
  | "video_codec"
  | "audio_codec"
  | "audio_rate"
  | "duration_short"
  | "duration_long"
  | "fps"
  | "width"
  | "size";

export function checkReelSpecs(
  p: ProbeResult,
  bytes: number,
): { ok: true } | { ok: false; reason: ReelSpecReason } {
  const fmt = p.formatName.split(",");
  if (!fmt.includes("mp4") && !fmt.includes("mov")) return { ok: false, reason: "format" };
  if (p.videoCodec !== "h264" && p.videoCodec !== "hevc") return { ok: false, reason: "video_codec" };
  if (p.audioCodec !== null && p.audioCodec !== "aac") return { ok: false, reason: "audio_codec" };
  if (p.audioSampleRate !== null && p.audioSampleRate > 48000) return { ok: false, reason: "audio_rate" };
  if (p.durationS < 3) return { ok: false, reason: "duration_short" };
  if (p.durationS > 900) return { ok: false, reason: "duration_long" };
  if (p.fps < 23 || p.fps > 60) return { ok: false, reason: "fps" };
  if (p.width > 1920) return { ok: false, reason: "width" };
  if (bytes > MAX_UPLOAD_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

export function videoPathFor(accountId: number, publicId: string, ext: "mp4" | "mov"): string {
  return join(SOCIAL_UPLOAD_DIR, String(accountId), `${publicId}.${ext}`);
}
