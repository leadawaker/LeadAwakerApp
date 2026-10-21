// Video to text for "Upgrade with AI": pull the audio out of an uploaded video with ffmpeg (mono,
// 16 kHz, low-bitrate Opus in .ogg, cut into 20-minute pieces so every piece stays far under Groq's
// 25 MB), transcribe the pieces in order and join them. Everything lives in a temp folder that is
// removed afterwards, whatever happens. Nothing is kept.
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { probeVideo, streamToFileWithLimit } from "./media";

const execFileAsync = promisify(execFile);

export const SEGMENT_SECONDS = 20 * 60;
/** Longer videos are refused: 90 minutes is already 5 pieces to transcribe. */
export const MAX_VIDEO_SECONDS = 90 * 60;
const FFMPEG_TIMEOUT_MS = 300_000;

export type Transcriber = (audio: Buffer, mimeType: string) => Promise<{ text: string } | { error: string }>;

export type VideoTranscript =
  | { ok: true; text: string; durationS: number }
  | { ok: false; status: 400 | 413 | 422 | 502; reason: "size" | "aborted" | "format" | "video_too_long" | "no_speech" | "transcribe_failed" };

/** Content types the panel may send: any video or audio file ffmpeg can read. */
export function isMediaContentType(ct: string | undefined): boolean {
  const base = (ct ?? "").split(";")[0].trim().toLowerCase();
  return base.startsWith("video/") || base.startsWith("audio/");
}

/** Joins the pieces' text, skipping empty ones. */
export function joinPieces(pieces: string[]): string {
  return pieces.map((p) => p.trim()).filter(Boolean).join("\n\n");
}

export async function transcribeVideoStream(src: NodeJS.ReadableStream, maxBytes: number, transcribe: Transcriber): Promise<VideoTranscript> {
  const dir = await mkdtemp(join(tmpdir(), "la-upgrade-"));
  try {
    const input = join(dir, "input");
    try {
      await streamToFileWithLimit(src, input, maxBytes);
    } catch (err: any) {
      if (err?.message === "too_large") return { ok: false, status: 413, reason: "size" };
      if (err?.syscall) throw err;
      return { ok: false, status: 400, reason: "aborted" };
    }
    let durationS = 0;
    try {
      const probe = await probeVideo(input);
      if (!probe.audioCodec) return { ok: false, status: 422, reason: "no_speech" };
      durationS = probe.durationS;
    } catch {
      return { ok: false, status: 422, reason: "format" };
    }
    if (durationS > MAX_VIDEO_SECONDS) return { ok: false, status: 422, reason: "video_too_long" };
    try {
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y", "-i", input,
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "24k",
        "-f", "segment", "-segment_time", String(SEGMENT_SECONDS), "-reset_timestamps", "1",
        join(dir, "part_%03d.ogg"),
      ], { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 });
    } catch {
      return { ok: false, status: 422, reason: "format" };
    }
    const parts = (await readdir(dir)).filter((f) => f.startsWith("part_")).sort();
    const pieces: string[] = [];
    for (const p of parts) {
      const result = await transcribe(await readFile(join(dir, p)), "audio/ogg");
      if ("error" in result) {
        console.warn(`[social-upgrade] transcription of a video piece failed: ${result.error}`);
        return { ok: false, status: 502, reason: "transcribe_failed" };
      }
      pieces.push(result.text);
    }
    const text = joinPieces(pieces);
    if (!text) return { ok: false, status: 422, reason: "no_speech" };
    return { ok: true, text, durationS };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
