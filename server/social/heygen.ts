// HeyGen, read-only: list the videos made in the HeyGen web app, read one, download its mp4.
// GET requests only. This module has no create, translate or upload call on purpose: generating a
// video spends money, reading costs nothing. The key comes from env HEYGEN_API_KEY and is never logged;
// any URL that is logged or put in an error has its query string (the presigned signature) removed.
// Paging (limit, token, next_token, has_more) and GET /v3/videos/{id}: checked 2026-10-20 against
// HeyGen's public reference via search (the docs host does not resolve from the build sandbox), so
// the parser below accepts the documented shape and the obvious variants.
import { Readable } from "node:stream";

export const HEYGEN_API = "https://api.heygen.com";
const TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
export const HEYGEN_LIST_MAX = 50;

export interface HeygenVideo {
  id: string;
  title: string;
  /** "completed" is the only status that can be pulled. Others: processing, pending, failed... */
  status: string;
  durationS: number | null;
  /** ISO string, or null when HeyGen sent none. */
  createdAt: string | null;
  thumbnailUrl: string | null;
  videoPageUrl: string | null;
  /** Presigned and short-lived: download it straight away, never store it. */
  videoUrl: string | null;
}

export interface HeygenClient {
  listVideos(opts?: { limit?: number; token?: string }): Promise<{ videos: HeygenVideo[]; nextToken: string | null }>;
  getVideo(id: string): Promise<HeygenVideo | null>;
  /** The mp4 as a stream. Throws HeygenError kind "expired" when the presigned link no longer works. */
  downloadVideo(url: string): Promise<NodeJS.ReadableStream>;
}

export class HeygenError extends Error {
  constructor(message: string, public kind: "http" | "network" | "expired" | "not_found", public status?: number) {
    super(message);
    this.name = "HeygenError";
  }
}

/** A URL safe to log: no query string, no fragment. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "(invalid url)";
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** created_at may be unix seconds, milliseconds or an ISO string. */
function isoOf(v: unknown): string | null {
  const n = num(v);
  if (n !== null) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function parseVideo(raw: unknown): HeygenVideo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id) ?? str(r.video_id);
  if (!id) return null;
  return {
    id,
    title: str(r.title) ?? str(r.video_title) ?? "",
    status: (str(r.status) ?? "unknown").toLowerCase(),
    durationS: num(r.duration),
    createdAt: isoOf(r.created_at),
    thumbnailUrl: str(r.thumbnail_url),
    videoPageUrl: str(r.video_page_url),
    videoUrl: str(r.video_url),
  };
}

/** The list response: { data: [...] , next_token, has_more } or { data: { videos: [...], token } }. */
export function parseVideoList(body: unknown): { videos: HeygenVideo[]; nextToken: string | null } {
  const b = (body ?? {}) as Record<string, any>;
  const items: unknown[] = Array.isArray(b.data) ? b.data
    : Array.isArray(b.data?.videos) ? b.data.videos
    : Array.isArray(b.videos) ? b.videos
    : [];
  const next = str(b.next_token) ?? str(b.data?.next_token) ?? str(b.data?.token) ?? str(b.token);
  const hasMore = b.has_more ?? b.data?.has_more;
  return {
    videos: items.map(parseVideo).filter((v): v is HeygenVideo => v !== null),
    nextToken: hasMore === false ? null : next,
  };
}

export function createHeygenClient(apiKey: string, fetchImpl: typeof fetch = fetch): HeygenClient {
  async function getJson(path: string): Promise<any> {
    let res: Response;
    try {
      res = await fetchImpl(`${HEYGEN_API}${path}`, {
        method: "GET",
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e: any) {
      throw new HeygenError(`HeyGen request failed: ${e?.name === "TimeoutError" ? "timeout" : "network error"}`, "network");
    }
    if (res.status === 404) throw new HeygenError("HeyGen video not found", "not_found", 404);
    let data: any = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) {
      const msg = str(data?.error?.message) ?? str(data?.message) ?? `HTTP ${res.status}`;
      throw new HeygenError(`HeyGen error: ${msg.slice(0, 200)}`, "http", res.status);
    }
    return data;
  }

  return {
    async listVideos(opts = {}) {
      const params = new URLSearchParams({ limit: String(Math.min(Math.max(1, opts.limit ?? 20), HEYGEN_LIST_MAX)) });
      if (opts.token) params.set("token", opts.token);
      return parseVideoList(await getJson(`/v3/videos?${params.toString()}`));
    },
    async getVideo(id) {
      if (!/^[\w-]{1,128}$/.test(id)) return null;
      try {
        const body = await getJson(`/v3/videos/${encodeURIComponent(id)}`);
        return parseVideo(body?.data ?? body);
      } catch (err) {
        if (err instanceof HeygenError && err.kind === "not_found") return null;
        throw err;
      }
    },
    async downloadVideo(url) {
      let res: Response;
      try {
        // The presigned link carries its own signature: no API key goes to the storage host.
        res = await fetchImpl(url, { method: "GET", signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      } catch (e: any) {
        throw new HeygenError(`HeyGen download failed (${redactUrl(url)}): ${e?.name === "TimeoutError" ? "timeout" : "network error"}`, "network");
      }
      if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410) {
        throw new HeygenError(`HeyGen download link expired (${redactUrl(url)})`, "expired", res.status);
      }
      if (!res.ok || !res.body) throw new HeygenError(`HeyGen download failed (${redactUrl(url)}): HTTP ${res.status}`, "http", res.status);
      return Readable.fromWeb(res.body as any);
    },
  };
}

/** The live client, or null when HEYGEN_API_KEY is not set. */
export function heygenFromEnv(): HeygenClient | null {
  const key = process.env.HEYGEN_API_KEY?.trim();
  return key ? createHeygenClient(key) : null;
}
