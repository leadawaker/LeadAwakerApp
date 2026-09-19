#!/usr/bin/env node
/**
 * Capture a homepage screenshot for the widget demo (specs/website-widget phase 5).
 *
 * Run out-of-process on purpose: this box also serves the app, and a headless
 * Chromium inside the Express process would put a ~300MB spike in the middle of
 * request handling. server/siteShot.ts spawns this, one at a time.
 *
 *   node script/site-shot.cjs <url> <outfile.webp>
 *
 * Prints one line of JSON: { ok, file, width, height, bytes, cookieButton }.
 *
 * Three things make the difference between a usable backdrop and a grey box,
 * all learned by running it against real sites:
 *   1. Cookie banners cover exactly the hero we want. Ranked text match, accept
 *      words first and dismiss words second, across the page and every iframe.
 *   2. Lazy-loaded images stay blank unless the page is scrolled first.
 *   3. Real client sites have expired or mismatched certificates more often than
 *      you would think, and a screenshot sends them nothing, so we tolerate it.
 */
const { chromium } = require("playwright");
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs/promises");
const path = require("path");
const dns = require("dns").promises;
const { isIP } = require("net");

const execFileAsync = promisify(execFile);

const ACCEPT_RE = /(accept|accepteer|akkoord|prima|toestaan|agree|allow|aceit|concord|^ja\b|^sim\b|^ok\b|got it|begrepen)/i;
const DISMISS_RE = /(sluiten|close|weiger|reject|decline|necessary|noodzakelijk|essenti|nee\b|later)/i;

const VIEWPORT = { width: 1280, height: 800 };
const CAPTURE_HEIGHT = 1600;       // two screens: hero plus what follows it
const NAV_TIMEOUT = 30000;

// ── Keeping the browser on the public internet ───────────────────────────────
// The submitted URL is checked by server/siteShot.ts, but a public page can
// redirect to, or load, an internal address. Every request the browser makes is
// checked here too. isPrivateAddress mirrors the copy in server/siteShot.ts.
function isPrivateAddress(raw) {
  const ip = String(raw).replace(/^\[|\]$/g, "").toLowerCase();
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
    const mapped = ip.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
    if (mapped) {
      if (mapped[1]) return isPrivateAddress(mapped[1]);
      const hi = parseInt(mapped[2], 16), lo = parseInt(mapped[3], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return /^fe[89ab]/.test(ip) || /^f[cd]/.test(ip) || ip.startsWith("ff");
  }
  return false;
}

const hostVerdicts = new Map();
async function hostIsPublic(host) {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  if (isIP(host)) return !isPrivateAddress(host);
  if (!hostVerdicts.has(host)) {
    hostVerdicts.set(
      host,
      // A name that resolves to any private address is refused. A name that does
      // not resolve at all is refused too: the request would fail anyway.
      dns.lookup(host, { all: true }).then(
        (rows) => rows.length > 0 && rows.every((r) => !isPrivateAddress(r.address)),
        () => false,
      ),
    );
  }
  return hostVerdicts.get(host);
}

async function requestAllowed(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return false; }
  // Inline resources carry no address to check.
  if (u.protocol === "data:" || u.protocol === "blob:" || u.protocol === "about:") return true;
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  return hostIsPublic(u.hostname.toLowerCase().replace(/^\[|\]$/g, ""));
}

async function dismissBanner(page) {
  for (const re of [ACCEPT_RE, DISMISS_RE]) {
    for (const frame of [page, ...page.frames()]) {
      let els;
      try {
        els = await frame.$$(
          "button:visible, [role=button]:visible, a:visible, input[type=button]:visible, input[type=submit]:visible"
        );
      } catch { continue; }
      for (const el of els.slice(0, 60)) {
        let text = "";
        try {
          text = ((await el.innerText()) || (await el.getAttribute("value")) || (await el.getAttribute("aria-label")) || "").trim();
        } catch { continue; }
        if (text && text.length < 45 && re.test(text)) {
          try { await el.click({ timeout: 2000 }); return text; } catch { /* keep looking */ }
        }
      }
    }
  }
  return null;
}

async function capture(url, outFile) {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  let cookieButton = null;
  const pngFile = outFile.replace(/\.webp$/i, "") + ".png";
  try {
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      // A screenshot sends the site nothing, and a broken certificate on a
      // prospect's site should not cost us the demo.
      ignoreHTTPSErrors: true,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    });
    // Fires for the first request, every redirect hop and every subresource.
    await ctx.route("**/*", async (route) => {
      if (await requestAllowed(route.request().url())) return route.continue();
      return route.abort("blockedbyclient");
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    // Banners are injected after load, so scanning immediately finds nothing.
    await page.waitForTimeout(1500);
    cookieButton = await dismissBanner(page);
    await page.waitForTimeout(800);

    await page.evaluate(async () => {
      const step = window.innerHeight;
      const limit = Math.min(document.body.scrollHeight, step * 4);
      for (let y = 0; y < limit; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 350));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);

    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await page.screenshot({
      path: pngFile,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: CAPTURE_HEIGHT },
    });
  } finally {
    await browser.close();
  }

  // cwebp rather than sharp: it is already on this box and the repo has no
  // image library. Quality 82 keeps a 1280x1600 page shot near 100KB.
  await execFileAsync("cwebp", ["-quiet", "-q", "82", pngFile, "-o", outFile]);
  await fs.unlink(pngFile).catch(() => {});
  const stat = await fs.stat(outFile);
  return { ok: true, file: outFile, width: VIEWPORT.width, height: CAPTURE_HEIGHT, bytes: stat.size, cookieButton };
}

(async () => {
  const [url, outFile] = process.argv.slice(2);
  if (!url || !outFile) {
    console.log(JSON.stringify({ ok: false, error: "usage: site-shot.cjs <url> <out.webp>" }));
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(await capture(url, outFile)));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
    process.exit(1);
  }
})();
