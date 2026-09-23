import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SHOT_DIR } from "../siteShot";

const execFileAsync = promisify(execFile);

export interface ImageDeps {
  fetch: typeof fetch;
  exec: (cmd: string, args: string[]) => Promise<void>;
  dir: string;
  apiKey: string | undefined;
}

function defaultDeps(): ImageDeps {
  return {
    fetch: globalThis.fetch,
    exec: async (cmd, args) => { await execFileAsync(cmd, args); },
    dir: SHOT_DIR,
    apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
  };
}

const MODEL = "gpt-image-1";

export async function generateSocialImage(
  prompt: string,
  deps: ImageDeps = defaultDeps(),
  quality: "low" | "medium" = "medium",
): Promise<string> {
  if (!deps.apiKey) throw new Error("OPENAI_API_KEY is not set");
  const res = await deps.fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${deps.apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${prompt}. Square photo. No text, no logos, no watermarks, no signs.`,
      size: "1024x1024",
      quality,
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`image API ${res.status}`);
  const body: any = await res.json();
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error("image API returned no image");
  const png = Buffer.from(b64, "base64");
  const name = crypto.createHash("sha256").update(png).digest("hex").slice(0, 16) + ".webp";
  const tmp = path.join(os.tmpdir(), `social-${name}.png`);
  await fs.mkdir(deps.dir, { recursive: true });
  await fs.writeFile(tmp, png);
  try {
    await deps.exec("cwebp", ["-quiet", "-q", "82", "-resize", "1080", "0", tmp, "-o", path.join(deps.dir, name)]);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return name;
}

const inFlight = new Map<string, Promise<void>>();

export function ensureSocialImage(
  key: string,
  prompt: string,
  onDone: (file: string) => Promise<void>,
  deps: ImageDeps = defaultDeps(),
): Promise<void> {
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      const file = await generateSocialImage(prompt, deps);
      await onDone(file);
    } catch (err) {
      console.error("[social-demo] image generation failed", key, (err as Error).message);
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}
