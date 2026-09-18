// Homepage screenshots for the widget demo (specs/website-widget phase 5).
//
// The capture itself runs in script/site-shot.cjs, out of process: a headless
// Chromium is a ~300MB spike and this box also serves the app. Concurrency is
// one, globally, for the same reason — a queue is slower than parallel captures
// and far better than an OOM in the middle of a demo.
import { execFile } from "child_process";
import { createHash } from "crypto";
import path from "path";
import fs from "fs/promises";

export const SHOT_DIR = path.resolve("uploads/site-shots");

// A capture is ~10s. Three is a wide margin for a slow site behind a CDN.
const CAPTURE_TIMEOUT_MS = 90_000;

export type ShotResult =
  | { ok: true; file: string; bytes: number; cookieButton: string | null }
  | { ok: false; error: string };

/** Stable per URL, so a refresh overwrites the old image and every reference to
 *  it (demo backdrop, Demos-page thumbnail) updates without a second write. */
export function shotFileName(url: string): string {
  return `${createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16)}.webp`;
}

export function normalizeUrl(raw: string): string {
  const trimmed = String(raw || "").trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const u = new URL(withScheme);
  u.hash = "";
  return u.toString();
}

/** Only http(s), and never a private address: this fetches a URL the caller
 *  chose, so it is an SSRF surface even though it only produces an image. */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(normalizeUrl(raw));
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 127 || a === 10 || a === 0 || a === 169) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false;
  return true;
}

let chain: Promise<unknown> = Promise.resolve();

/** Queue one capture behind any other. Returns the file NAME, not a path. */
export function captureSiteShot(url: string): Promise<ShotResult> {
  const run = () => runCapture(url);
  const queued = chain.then(run, run);
  // Keep the chain alive even when a capture rejects, so one failure cannot
  // wedge every later request behind it.
  chain = queued.catch(() => undefined);
  return queued;
}

async function runCapture(url: string): Promise<ShotResult> {
  if (!isPublicHttpUrl(url)) return { ok: false, error: "invalid_url" };
  const fileName = shotFileName(url);
  const outFile = path.join(SHOT_DIR, fileName);
  await fs.mkdir(SHOT_DIR, { recursive: true });

  return new Promise<ShotResult>((resolve) => {
    execFile(
      process.execPath,
      [path.resolve("script/site-shot.cjs"), normalizeUrl(url), outFile],
      { timeout: CAPTURE_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        const line = String(stdout || "").trim().split("\n").filter(Boolean).pop() || "";
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(line); } catch { /* fall through to the error below */ }
        if (parsed && parsed.ok) {
          return resolve({
            ok: true,
            file: fileName,
            bytes: Number(parsed.bytes || 0),
            cookieButton: (parsed.cookieButton as string) || null,
          });
        }
        resolve({ ok: false, error: String(parsed.error || (err && err.message) || "capture_failed") });
      }
    );
  });
}

/** Has this URL already been captured? Lets callers skip a redundant capture. */
export async function shotExists(url: string): Promise<string | null> {
  try {
    const name = shotFileName(url);
    await fs.stat(path.join(SHOT_DIR, name));
    return name;
  } catch {
    return null;
  }
}
