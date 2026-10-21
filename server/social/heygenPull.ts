// Download one finished HeyGen video into the Reel upload layout, through the same receive step as a
// browser upload (stream with a size limit, faststart, probe, Reel spec check). The presigned link
// expires: when it does (refused, or the stream dies half way), the video is read again once for a
// fresh link and the download retried. Never logs the link's query string.
import { HeygenError, redactUrl, type HeygenClient } from "./heygen";
import type { UploadOutcome } from "./upload";

export type PullOutcome =
  | { ok: true; video: Extract<UploadOutcome, { ok: true }>; title: string }
  | { ok: false; status: 404 | 409 | 422 | 502; reason: "not_found" | "not_ready" | "download_failed" | string };

export async function pullHeygenVideo(p: {
  client: HeygenClient;
  videoId: string;
  destPath: string;
  maxBytes: number;
  receive(src: NodeJS.ReadableStream, destPath: string, maxBytes: number): Promise<UploadOutcome>;
}): Promise<PullOutcome> {
  let video = await p.client.getVideo(p.videoId);
  if (!video) return { ok: false, status: 404, reason: "not_found" };
  for (let attempt = 0; attempt < 2; attempt++) {
    if (video.status !== "completed" || !video.videoUrl) return { ok: false, status: 409, reason: "not_ready" };
    let retry = false;
    try {
      const stream = await p.client.downloadVideo(video.videoUrl);
      const outcome = await p.receive(stream, p.destPath, p.maxBytes);
      if (outcome.ok) return { ok: true, video: outcome, title: video.title };
      // "aborted": the stream died (link expired mid-download, network). Size and spec failures are final.
      if (outcome.status === 400) retry = true;
      else return { ok: false, status: 422, reason: outcome.reason };
    } catch (err) {
      if (err instanceof HeygenError && (err.kind === "expired" || err.kind === "network")) retry = true;
      else throw err;
    }
    if (!retry || attempt === 1) break;
    console.warn(`[social-heygen] video ${p.videoId}: download from ${redactUrl(video.videoUrl)} failed, fetching a fresh link`);
    const fresh = await p.client.getVideo(p.videoId);
    if (!fresh) return { ok: false, status: 404, reason: "not_found" };
    video = fresh;
  }
  return { ok: false, status: 502, reason: "download_failed" };
}
