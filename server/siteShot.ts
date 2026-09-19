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
import { isIP } from "net";

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

/** True for an IP literal that is not a public internet address. Kept in step
 *  with the copy in script/site-shot.cjs, which re-checks every redirect and
 *  every request the page makes. */
export function isPrivateAddress(raw: string): boolean {
  const ip = raw.replace(/^\[|\]$/g, "").toLowerCase();
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (kind === 6) {
    if (ip === "::" || ip === "::1") return true;
    // ::ffff:127.0.0.1 or its hex form ::ffff:7f00:1 is an IPv4 address in disguise.
    const mapped = ip.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
    if (mapped) {
      if (mapped[1]) return isPrivateAddress(mapped[1]);
      const hi = parseInt(mapped[2], 16), lo = parseInt(mapped[3], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    // fe80::/10 link-local, fc00::/7 unique-local, ff00::/8 multicast.
    return /^fe[89ab]/.test(ip) || /^f[cd]/.test(ip) || ip.startsWith("ff");
  }
  return false;
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
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  // Only IP literals are range-checked, so a domain such as fcbarcelona.com or
  // fdic.gov is not mistaken for an IPv6 prefix.
  return !isPrivateAddress(host);
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
