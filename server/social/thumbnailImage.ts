// The image model behind the thumbnail creator, and the file work around it (sniffing an uploaded
// reference, cropping the model's PNG to the picked format as a JPEG).
//
// Provider: OpenAI's image API. It is only switched on when OPENAI_API_KEY (or OPEN_AI_API_KEY) is set
// on the server; without it the routes answer 501 not_configured and the page says so. With reference
// images the request goes to /v1/images/edits (the images steer the result), else to /v1/images/generations.
// THUMBNAIL_IMAGE_MODEL pins a model; otherwise the newest "quality" model is picked (lib/imageModel.ts).
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { resolveImageModel } from "../lib/imageModel";
import { cropFilter, type GenerationPlan } from "./thumbnailPrompt";

const execFileAsync = promisify(execFile);
const IMAGE_TIMEOUT_MS = 180_000;
const FFMPEG_TIMEOUT_MS = 60_000;

export interface ReferenceImage { data: Buffer; mimeType: string; name: string }

export interface ImageRequest {
  prompt: string;
  size: GenerationPlan["size"];
  n: number;
  references: ReferenceImage[];
}

export interface ImageProvider {
  /** The images as PNG (or whatever the model sends) bytes, one per variant, and the model used. */
  generate(req: ImageRequest): Promise<{ images: Buffer[]; model: string }>;
}

/** A short reason safe to show in the gallery: never the key, never a whole response body. */
export class ImageProviderError extends Error {
  constructor(message: string) {
    super(message.slice(0, 300));
    this.name = "ImageProviderError";
  }
}

export function openAiImageProvider(apiKey: string, opts: { model?: string; fetchFn?: typeof fetch } = {}): ImageProvider {
  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  return {
    async generate(req) {
      const model = opts.model || (await resolveImageModel("quality", apiKey, fetchFn));
      const headers = { authorization: `Bearer ${apiKey}` };
      const signal = AbortSignal.timeout(IMAGE_TIMEOUT_MS);
      let res: Response;
      if (req.references.length > 0) {
        const form = new FormData();
        form.append("model", model);
        form.append("prompt", req.prompt);
        form.append("size", req.size);
        form.append("quality", "high");
        form.append("n", String(req.n));
        for (const r of req.references) form.append("image[]", new Blob([new Uint8Array(r.data)], { type: r.mimeType }), r.name);
        res = await fetchFn("https://api.openai.com/v1/images/edits", { method: "POST", headers, body: form, signal });
      } else {
        res = await fetchFn("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ model, prompt: req.prompt, size: req.size, quality: "high", n: req.n }),
          signal,
        });
      }
      if (!res.ok) {
        let detail = "";
        try {
          const body: any = await res.json();
          detail = typeof body?.error?.message === "string" ? `: ${body.error.message}` : "";
        } catch {
          // not JSON
        }
        throw new ImageProviderError(`image API ${res.status}${detail}`);
      }
      const body: any = await res.json();
      const images = (Array.isArray(body?.data) ? body.data : [])
        .map((d: any) => (typeof d?.b64_json === "string" ? Buffer.from(d.b64_json, "base64") : null))
        .filter((b: Buffer | null): b is Buffer => !!b && b.length > 0);
      if (images.length === 0) throw new ImageProviderError("image API returned no image");
      return { images, model };
    },
  };
}

/** The provider from the environment, or null when no key is set. */
export function imageProviderFromEnv(env: NodeJS.ProcessEnv = process.env): ImageProvider | null {
  const key = env.OPENAI_API_KEY || env.OPEN_AI_API_KEY;
  if (!key) return null;
  return openAiImageProvider(key, { model: env.THUMBNAIL_IMAGE_MODEL || undefined });
}

/** Image types a reference may be, by their first bytes (the declared type is not trusted). */
export function sniffImage(data: Buffer): { mimeType: string; ext: string } | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: "image/png", ext: "png" };
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { mimeType: "image/jpeg", ext: "jpg" };
  if (data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return { mimeType: "image/webp", ext: "webp" };
  return null;
}

/** `data:image/...;base64,...` (or bare base64) to bytes. null when it is not base64. */
export function decodeDataUrl(value: unknown): Buffer | null {
  if (typeof value !== "string" || !value) return null;
  const m = /^data:[a-z/+.-]+;base64,(.*)$/is.exec(value);
  const b64 = (m ? m[1] : value).replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return null;
  const buf = Buffer.from(b64, "base64");
  return buf.length > 0 ? buf : null;
}

/** Crops and scales the model's image to the format with ffmpeg and writes it as a JPEG at destPath. */
export async function writeThumbnailJpeg(image: Buffer, plan: GenerationPlan, destPath: string): Promise<void> {
  const tmp = join(tmpdir(), `thumb-${randomUUID()}.png`);
  await writeFile(tmp, image);
  try {
    await mkdir(dirname(destPath), { recursive: true });
    await execFileAsync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-vf", cropFilter(plan), "-q:v", "2", "-frames:v", "1", destPath], { timeout: FFMPEG_TIMEOUT_MS });
  } finally {
    await rm(tmp, { force: true });
  }
}
