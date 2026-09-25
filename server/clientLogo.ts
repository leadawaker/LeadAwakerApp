// A Client's logo for the Instagram and Reputation demos (in place of the
// initials circle). Fetched from the Client's website, or uploaded by hand on
// the Demos page; either way it ends up as a 256px square .webp in
// uploads/site-shots/, served by GET /api/site-shot/:file like the screenshots.
//
// This fetches URLs taken from a page someone else wrote, so every hop is an
// SSRF surface: the host is resolved and range-checked before each request and
// again on every redirect, and bodies are capped.
import { createHash } from "crypto";
import { execFile } from "child_process";
import { lookup } from "dns/promises";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { nicheVocabulary } from "@shared/schema";
import { SHOT_DIR, isPrivateAddress, isPublicHttpUrl, normalizeUrl } from "./siteShot";

const execFileAsync = promisify(execFile);
const NORMALIZER = path.resolve("script/logo-to-webp.py");
const UA = "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_HTML = 1_500_000;
const MAX_IMAGE = 3_000_000;
const TIMEOUT_MS = 8000;

export const LOGO_FILE_RE = /^[a-f0-9]{16}\.webp$/;

/** The URL a demo page shows, or null for the initials circle. */
export function logoUrlFor(row: { logoPath?: string | null; logoEnabled?: boolean | null } | null | undefined): string | null {
  if (!row || row.logoEnabled === false || !row.logoPath || !LOGO_FILE_RE.test(row.logoPath)) return null;
  return `/api/site-shot/${row.logoPath}`;
}

// ---- finding candidates ---------------------------------------------------

export interface LogoCandidate { url: string; score: number; }

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? "").trim();
  }
  return out;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"');
}

function resolve(href: string, base: string): string | null {
  if (!href) return null;
  const h = decodeEntities(href);
  if (h.startsWith("data:image/")) return h;
  try {
    const u = new URL(h, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function largestSize(sizes: string | undefined): number {
  if (!sizes) return 0;
  if (/any/i.test(sizes)) return 512;
  return Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
}

/**
 * Logo candidates on one page, best first. A round avatar wants a square mark,
 * so the site's own app icon outranks a wide header wordmark; the tiny favicon
 * comes last and usually fails the converter's minimum size anyway.
 */
export function extractLogoCandidates(html: string, baseUrl: string): LogoCandidate[] {
  const found = new Map<string, number>();
  const add = (href: string | undefined, score: number) => {
    const url = resolve(href || "", baseUrl);
    if (url && (found.get(url) ?? -1) < score) found.set(url, score);
  };

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel || "").toLowerCase();
    if (/apple-touch-icon/.test(rel)) add(a.href, 100 + Math.min(largestSize(a.sizes), 512) / 100);
    else if (/(^|\s)icon(\s|$)/.test(rel)) {
      const px = largestSize(a.sizes);
      const svg = /svg/.test(a.type || "") || /\.svg(\?|$)/i.test(a.href || "");
      add(a.href, svg || px >= 96 ? 90 + Math.min(px, 512) / 100 : 30 + px / 100);
    }
  }
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if ((a.property || a.name || a.itemprop || "").toLowerCase() === "og:logo" || (a.itemprop || "").toLowerCase() === "logo") {
      add(a.content, 80);
    }
  }
  // schema.org Organization.logo, as a string or as an ImageObject.
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const l of m[1].matchAll(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"(?:url|contentUrl)"\s*:\s*"([^"]+)")/g)) {
      add((l[1] || l[2] || "").replace(/\\\//g, "/"), 80);
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const hay = `${a.class || ""} ${a.id || ""} ${a.alt || ""} ${a.src || ""}`.toLowerCase();
    if (/logo/.test(hay)) add(a.src || a["data-src"], 70);
  }
  add("/apple-touch-icon.png", 60);
  add("/favicon.ico", 20);

  return [...found.entries()].map(([url, score]) => ({ url, score })).sort((a, b) => b.score - a.score);
}

// ---- fetching ---------------------------------------------------------------

async function assertPublicHost(url: string): Promise<void> {
  if (!isPublicHttpUrl(url)) throw new Error("not a public URL");
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("private address");
}

/** GET with every redirect hop re-checked, a timeout, and a body cap. */
async function safeGet(url: string, cap: number): Promise<{ bytes: Buffer; type: string; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("redirect without location");
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.length;
      if (total > cap) throw new Error("too large");
      chunks.push(Buffer.from(chunk));
    }
    return { bytes: Buffer.concat(chunks), type: res.headers.get("content-type") || "", finalUrl: current };
  }
  throw new Error("too many redirects");
}

function isSvg(bytes: Buffer, type: string): boolean {
  if (/svg/.test(type)) return true;
  const head = bytes.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
}

/**
 * Any logo image -> stored 256px webp. Returns the file NAME, or null when the
 * image is unreadable or too small to be a usable logo.
 */
export async function storeLogo(bytes: Buffer, type = ""): Promise<string | null> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "logo-"));
  try {
    let input = path.join(dir, "in");
    await fs.writeFile(input, bytes);
    if (isSvg(bytes, type)) {
      const png = path.join(dir, "in.png");
      await execFileAsync("rsvg-convert", ["-w", "512", "--keep-aspect-ratio", "-o", png, input], { timeout: 15000 });
      input = png;
    }
    const out = path.join(dir, "out.webp");
    try {
      await execFileAsync("python3", [NORMALIZER, input, out], { timeout: 15000 });
    } catch {
      return null;
    }
    const webp = await fs.readFile(out);
    const file = `${createHash("sha256").update(webp).digest("hex").slice(0, 16)}.webp`;
    await fs.mkdir(SHOT_DIR, { recursive: true });
    await fs.writeFile(path.join(SHOT_DIR, file), webp);
    return file;
  } catch {
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function candidateBytes(url: string): Promise<{ bytes: Buffer; type: string }> {
  const data = /^data:(image\/[a-z0-9.+-]+)(;base64)?,(.*)$/i.exec(url);
  if (data) {
    const bytes = data[2] ? Buffer.from(data[3], "base64") : Buffer.from(decodeURIComponent(data[3]), "utf8");
    if (bytes.length > MAX_IMAGE) throw new Error("too large");
    return { bytes, type: data[1] };
  }
  return safeGet(url, MAX_IMAGE);
}

export type LogoFetchResult = { ok: true; file: string; from: string } | { ok: false; error: string };

/** Fetch the homepage, try its logo candidates best-first, store the first usable one. */
export async function fetchLogoFromSite(websiteUrl: string): Promise<LogoFetchResult> {
  const url = normalizeUrl(websiteUrl);
  if (!isPublicHttpUrl(url)) return { ok: false, error: "Not a public website address." };
  let page: { bytes: Buffer; finalUrl: string };
  try {
    page = await safeGet(url, MAX_HTML);
  } catch (err) {
    return { ok: false, error: `Could not load the website (${(err as Error).message}).` };
  }
  const candidates = extractLogoCandidates(page.bytes.toString("utf8"), page.finalUrl).slice(0, 8);
  for (const c of candidates) {
    try {
      const { bytes, type } = await candidateBytes(c.url);
      const file = await storeLogo(bytes, type);
      if (file) return { ok: true, file, from: c.url.startsWith("data:") ? "inline image" : c.url };
    } catch {
      // Next candidate.
    }
  }
  return { ok: false, error: "No usable logo found on the website." };
}

/**
 * Fetch a Client's logo from its website and store it on the Client row. A
 * hand-uploaded logo is kept unless the caller explicitly overwrites it (the
 * Demos page "Fetch from website" button does; the scrape does not).
 */
export async function refreshSiteLogo(niche: string, websiteUrl: string, opts: { overwriteUpload?: boolean } = {}): Promise<LogoFetchResult> {
  const [current] = await db
    .select({ logoSource: nicheVocabulary.logoSource })
    .from(nicheVocabulary)
    .where(eq(nicheVocabulary.niche, niche))
    .limit(1);
  if (!current) return { ok: false, error: "Unknown client." };
  if (current.logoSource === "upload" && !opts.overwriteUpload) return { ok: false, error: "An uploaded logo is in place." };
  const got = await fetchLogoFromSite(websiteUrl);
  if (!got.ok) return got;
  await db.update(nicheVocabulary).set({ logoPath: got.file, logoSource: "site" }).where(eq(nicheVocabulary.niche, niche));
  return got;
}
