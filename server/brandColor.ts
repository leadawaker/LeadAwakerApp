// The prospect's brand colour, read off their homepage screenshot, for the
// widget demo's launcher button (specs/website-widget).
//
// From pixels rather than the page's CSS so it works for every screenshot we
// already hold, with no recapture: dwebp decodes the WebP to a raw PPM and the
// colour is the most common saturated hue, with the top of the page (header,
// nav, logo) counted three times over because that is where a brand lives and
// hero photos do not, and flat vivid fills favoured over textured photo pixels.
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { SHOT_DIR } from "./siteShot";

const SHOT_RE = /^[a-f0-9]{16}\.webp$/;
const HEADER_PX = 220;
const STEP = 4;
// Below this share of sampled pixels the "winner" is noise (a single photo
// highlight), and the neutral black launcher is the better answer.
const MIN_SHARE = 0.002;

const memo = new Map<string, string | null>();

function decodePpm(file: string): Promise<{ w: number; h: number; px: Buffer } | null> {
  return new Promise((resolve) => {
    execFile("dwebp", ["-quiet", file, "-ppm", "-o", "-"],
      { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, timeout: 20_000 },
      (err, stdout) => {
        if (err || !stdout || stdout.length < 16) return resolve(null);
        // "P6\n<w> <h>\n<max>\n" then raw RGB. Header fields may be separated by
        // any whitespace, so tokenise rather than split on newlines.
        let i = 0;
        const tokens: string[] = [];
        while (tokens.length < 4 && i < 64) {
          while (/\s/.test(String.fromCharCode(stdout[i]!))) i++;
          let tok = "";
          while (i < stdout.length && !/\s/.test(String.fromCharCode(stdout[i]!))) tok += String.fromCharCode(stdout[i++]!);
          tokens.push(tok);
        }
        i++; // the single whitespace byte before the pixel data
        const [magic, w, h] = [tokens[0], Number(tokens[1]), Number(tokens[2])];
        if (magic !== "P6" || !w || !h) return resolve(null);
        resolve({ w, h, px: stdout.subarray(i) });
      });
  });
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** The dominant saturated colour of an image, or null when it has none. */
export function dominantColor(w: number, h: number, px: Buffer): string | null {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number }>();
  let samples = 0;
  for (let y = 0; y < h; y += STEP) {
    const bonus = y < HEADER_PX ? 3 : 1;
    for (let x = 0; x < w; x += STEP) {
      const o = (y * w + x) * 3;
      const r = px[o]!, g = px[o + 1]!, b = px[o + 2]!;
      samples++;
      const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
      const l = (max + min) / 2;
      const d = max - min;
      if (d === 0) continue;
      const s = d / (1 - Math.abs(2 * l - 1));
      if (s < 0.4 || l < 0.12 || l > 0.85) continue;
      let hue: number;
      const rn = r / 255, gn = g / 255, bn = b / 255;
      if (max === rn) hue = ((gn - bn) / d) % 6;
      else if (max === gn) hue = (bn - rn) / d + 2;
      else hue = (rn - gn) / d + 4;
      hue = (hue * 60 + 360) % 360;
      // 15-degree hue slices, three lightness bands: close shades of one
      // brand colour pool together, a red and an orange do not.
      const key = Math.floor(hue / 15) * 3 + Math.min(2, Math.floor(l * 3));
      // Flat patches (buttons, bars, logos) count four times a textured one:
      // a photo's foliage or sky varies pixel to pixel, a brand fill does not.
      const n = o + STEP * 3;
      const flat = x + STEP < w &&
        Math.abs(r - px[n]!) < 10 && Math.abs(g - px[n + 1]!) < 10 && Math.abs(b - px[n + 2]!) < 10;
      const wgt = s * s * s * bonus * (flat ? 4 : 1);
      const bk = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
      bk.weight += wgt; bk.r += r * wgt; bk.g += g * wgt; bk.b += b * wgt;
      buckets.set(key, bk);
    }
  }
  let best: { weight: number; r: number; g: number; b: number } | null = null;
  for (const bk of buckets.values()) if (!best || bk.weight > best.weight) best = bk;
  if (!best || best.weight / samples < MIN_SHARE) return null;
  return toHex(best.r / best.weight, best.g / best.weight, best.b / best.weight);
}

/**
 * Brand colour for a screenshot file name (as stored on the Client row).
 * Cached in memory and in a sidecar file next to the shot, so each image is
 * decoded once for the life of the file rather than once per page view.
 */
export async function brandColorForShot(shot: string): Promise<string | null> {
  if (!SHOT_RE.test(shot)) return null;
  if (memo.has(shot)) return memo.get(shot)!;
  const sidecar = path.join(SHOT_DIR, `${shot}.color`);
  try {
    const cached = (await fs.readFile(sidecar, "utf8")).trim();
    const val = /^#[0-9a-f]{6}$/.test(cached) ? cached : null;
    memo.set(shot, val);
    return val;
  } catch { /* not computed yet */ }

  const img = await decodePpm(path.join(SHOT_DIR, shot));
  if (!img) return null;             // not cached: the file may appear later
  const color = dominantColor(img.w, img.h, img.px);
  memo.set(shot, color);
  await fs.writeFile(sidecar, color || "none").catch(() => {});
  return color;
}

/** Readable icon colour on top of a launcher of this colour. */
export function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  return lum > 0.45 ? "#18181b" : "#ffffff";
}
