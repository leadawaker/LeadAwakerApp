# Landing Page Build Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop shipping raw JSX + a 3.14 MB in-browser compiler to every `leadawaker.com` visitor. Compile the landing page to one minified bundle at Vercel build time, strip everything not needed by a visitor (source, docs, debug panels, dead files) from the production output, and move `login.html` permanently off `/premium/`.

**Architecture:** A new Node script (`script/build-premium.ts`, run via `tsx`) runs after `vite build` in the Vercel build command. It reads the `index.html` Vite already copied into `dist/public/premium/`, compiles the 23 referenced `.jsx` files with `esbuild` (already a project dependency), concatenates and minifies them into one hashed bundle, rewrites `index.html` to reference that bundle instead of Babel Standalone, and deletes everything from `dist/public/premium/` that isn't on a public-asset allowlist. `client/public/premium/` itself — the source Gabriel edits and `app.leadawaker.com` serves raw via Express — is never touched.

**Tech Stack:** Node (`tsx`), `esbuild` (already `^0.25.0` in `package.json` devDependencies), Vercel static build, Express (`server/index.ts`) for the Pi dev server.

**Spec:** `docs/superpowers/specs/2026-07-07-landing-page-build-pipeline-design.md`

## Global Constraints

- Zero change to visitor-facing behavior or appearance, other than load time (spec Goals)
- Zero change to Gabriel's dev workflow on `app.leadawaker.com`, except the login file's path (spec Goals)
- No new npm dependencies — use `esbuild` for both the JSX transform and minification (spec Design §1, Risks)
- Do not convert the page to ES modules / Vite's native multi-page build (spec Non-goals)
- Do not prune individual unused images inside `assets/`/`hero-images/` (spec Non-goals)
- Do not bundle React/ReactDOM into the compiled output — they stay on the CDN, unchanged (spec Non-goals)
- `client/public/premium/*` source files are never modified or deleted by the build script — only `dist/public/premium/*` (the build output) is (spec Design §2)
- Never run `npm run dev` — the app runs via `pm2` (project CLAUDE.md)
- Never run `tsc` unless Gabriel explicitly asks (project CLAUDE.md)
- Pushing to `main` triggers an immediate Vercel production deploy of `leadawaker.com` — do not push until Gabriel explicitly confirms (project conventions on risky/hard-to-reverse actions)

---

### Task 1: Move `login.html` off `/premium/` (dev + prod routing)

**Files:**
- Move: `client/public/premium/login.html` → `client/public/login.html`
- Modify: `server/index.ts:103-115`
- Modify: `vercel.json`

**Interfaces:**
- Produces: `client/public/login.html` (source file, permanent new location) — consumed by Vite's default `publicDir` passthrough in Task 3's build, and by `server/index.ts`'s `/login` route in dev.

- [ ] **Step 1: Move the file with git, preserving history**

```bash
git mv "client/public/premium/login.html" "client/public/login.html"
```

- [ ] **Step 2: Update `server/index.ts`'s `/login` route to read from the new location**

Current code (lines 103-115):

```ts
(async () => {
  // Premium landing page is the default homepage. Serve the static HTML at "/"
  // (before Vite middleware claims the route) and the JSX/asset sidecars at /premium/*.
  const premiumDir = path.resolve("client/public/premium");
  const sendPremium = (file: string) => (_req: Request, res: Response, next: NextFunction) => {
    fs.readFile(path.join(premiumDir, file), "utf-8", (err, html) => {
      if (err) return next();
      res.type("html").send(html);
    });
  };
  app.get("/", sendPremium("index.html"));
  app.get("/login", sendPremium("login.html"));
  app.use("/premium", express.static(premiumDir));
```

Replace with:

```ts
(async () => {
  // Premium landing page is the default homepage. Serve the static HTML at "/"
  // (before Vite middleware claims the route) and the JSX/asset sidecars at /premium/*.
  // login.html lives directly under client/public/ (not /premium/) so dev matches
  // production, where it's reachable at /login instead of /premium/login.html.
  const premiumDir = path.resolve("client/public/premium");
  const publicDir = path.resolve("client/public");
  const sendFile = (dir: string, file: string) => (_req: Request, res: Response, next: NextFunction) => {
    fs.readFile(path.join(dir, file), "utf-8", (err, html) => {
      if (err) return next();
      res.type("html").send(html);
    });
  };
  app.get("/", sendFile(premiumDir, "index.html"));
  app.get("/login", sendFile(publicDir, "login.html"));
  app.use("/premium", express.static(premiumDir));
```

- [ ] **Step 3: Update `vercel.json`'s `/login` rewrite destination**

In `vercel.json`, change:

```json
    { "source": "/login", "destination": "/premium/login.html" },
```

to:

```json
    { "source": "/login", "destination": "/login.html" },
```

- [ ] **Step 4: Verify the dev route still works**

`server/index.ts` changes are picked up automatically by the `pm2`-watched Pi dev server within ~5-8 seconds (never run `npm run dev` — see Global Constraints). Wait ~10 seconds, then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.leadawaker.com/login
curl -s -o /dev/null -w "%{http_code}\n" https://app.leadawaker.com/premium/login.html
```

Expected: first command prints `200` (served from the new `client/public/login.html`). The second command also prints `200`, not `404` — the dev server's Vite middleware has a catch-all SPA fallback that serves `index.html` for any unmatched route (this is pre-existing behavior, unrelated to this change, and mirrors production's `"/(.*)" -> "/app.html"` rewrite in `vercel.json`). Confirm instead that the body is no longer the login page: `curl -s https://app.leadawaker.com/premium/login.html | head -3` should print the app shell's `<!DOCTYPE html>` opening, not the login page's markup.

- [ ] **Step 5: Commit**

```bash
git add client/public/login.html server/index.ts vercel.json
git status
git commit -m "$(cat <<'EOF'
refactor(landing): move login.html off /premium/

Permanently relocates the login page to client/public/login.html so
it's reachable at leadawaker.com/login without living under the
/premium/ namespace, in both dev and prod.
EOF
)"
```

---

### Task 2: Write `script/build-premium.ts`

**Files:**
- Create: `script/build-premium.ts`

**Interfaces:**
- Consumes: `dist/public/premium/*` as produced by a prior `vite build` (Vite's default `publicDir` passthrough — no config needed, already verified in `vite.config.ts`), and `client/public/premium/design-tokens.css` (read directly from source, since the goal is to delete the copy Vite already placed in `dist/`).
- Produces: `dist/public/premium/bundle.<hash>.js` (compiled, minified, content-hashed), a rewritten `dist/public/premium/index.html`, and a pruned `dist/public/premium/` directory tree containing only the public-asset allowlist. Consumed by Task 3's build wiring and Task 4's deploy.

- [ ] **Step 1: Create the script**

Create `script/build-premium.ts`:

```ts
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { transformSync } from "esbuild";

const DIST_PREMIUM = path.resolve("dist/public/premium");
const SRC_PREMIUM = path.resolve("client/public/premium");

// Everything else under dist/public/premium/ is deleted once the build below
// finishes: the compiled .jsx files (their content now lives only in the
// bundle), dead HTML duplicates, docs, debug source, and design-tokens.css
// itself (inlined into index.html instead of served standalone).
const KEEP_FILES = new Set([
  "favicon.svg",
  "logo-icon.png",
  "logo-icon.svg",
  "logo-v2.svg",
  "logo-v2-dark.svg",
  "netherlands.svg",
]);
const KEEP_DIRS = new Set(["assets", "hero-images"]);
const UPLOADS_KEEP = new Set(["ctatext17.jpg"]); // inside uploads/textures/

const SCRIPT_TAG_RE = /<script type="text\/babel" src="\/premium\/([^"]+)"[^>]*><\/script>\n?/g;
const BABEL_STANDALONE_RE = /<script[^>]*@babel\/standalone[^>]*><\/script>\n?/;
const POLLER_RE = /<script>\n\/\/ Auto-reload when files change[\s\S]*?<\/script>\n?/;
const THREE_JS_RE = /(<script src="https:\/\/unpkg\.com\/three[^"]*"[^>]*)><\/script>/;
const DESIGN_TOKENS_LINK_RE = /<link rel="stylesheet" href="\/premium\/design-tokens\.css" \/>\n?/;

// Converts only TOP-LEVEL (column-0) `const`/`let` declarations to `var`,
// leaving every nested declaration (inside a function/block body, always
// indented) untouched. Empirically verified against the real site: Babel
// Standalone's per-<script>-tag execution treats top-level const/let as
// freely re-declarable AND readable bare across separate script tags (e.g.
// `config.jsx`'s `const TWEAK_DEFAULTS` is read bare in `app-main.jsx`,
// and `01-nav.jsx` / `10-cta-footer.jsx` both declare `const ArrowSm =
// window.ArrowSm` with no conflict) — i.e. real top-level const/let here
// behaves exactly like `var` (freely redeclarable, shared across files),
// not like true block-scoped, single-scope-only const/let. A first attempt
// at fixing the ArrowSm collision by wrapping each file in its own IIFE
// broke the *other* half of this behavior (bare cross-file reads like
// `TWEAK_DEFAULTS`), confirmed by a blank page + `TWEAK_DEFAULTS is not
// defined` at runtime. esbuild has no const/let-to-var downlevel transform
// (confirmed: `target: 'es5'` errors "not supported yet" on this esbuild
// version), so the fix is this narrow text-level substitution instead.
function topLevelConstLetToVar(code: string): string {
  return code.replace(/^(const|let)\b/gm, "var");
}

async function compileBundle(scriptFiles: string[]): Promise<string> {
  let bundleSource = "";
  for (const file of scriptFiles) {
    let raw: string;
    try {
      raw = await readFile(path.join(DIST_PREMIUM, file), "utf-8");
    } catch (err) {
      // tweaks-panel.jsx, hero-debug.jsx, cta-debug.jsx are gitignored
      // (.gitignore:93-95) — local-only dev tooling, never committed, so a
      // clean checkout (Vercel's build) won't have them even though
      // index.html still references them (2 of the 3 already have
      // onerror="void 0" on their script tag for exactly this reason).
      // app-main.jsx already handles TweaksPanel being undefined via
      // `TweaksPanel && <TweaksPanel ...>` (app-main.jsx:150/186), so
      // omitting these from the bundle changes nothing visitor-facing —
      // they already don't execute in production today (confirmed: Babel
      // throws parsing the app-shell HTML Vercel's catch-all rewrite
      // serves in their place, silently, before this build step ever
      // existed).
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.log(`build-premium: skipping ${file} (not present in this checkout — gitignored local-only file)`);
        continue;
      }
      throw err;
    }
    const { code } = transformSync(raw, {
      loader: "jsx",
      jsx: "transform", // classic runtime: compiles to React.createElement(...),
      jsxFactory: "React.createElement", // matching how these files rely on the
      jsxFragment: "React.Fragment", // global `React` from the CDN script today.
      sourcefile: file,
    });
    bundleSource += `// ${file}\n${topLevelConstLetToVar(code)}\n`;
  }
  const { code: minified } = transformSync(bundleSource, { loader: "js", minify: true });
  return minified;
}

async function pruneUploads() {
  const uploadsDir = path.join(DIST_PREMIUM, "uploads");
  const entries = await readdir(uploadsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name !== "textures") {
        await rm(path.join(uploadsDir, entry.name), { recursive: true, force: true });
      }
      continue;
    }
    await rm(path.join(uploadsDir, entry.name), { force: true });
  }
  const texturesDir = path.join(uploadsDir, "textures");
  const textureFiles = await readdir(texturesDir);
  for (const file of textureFiles) {
    if (!UPLOADS_KEEP.has(file)) {
      await rm(path.join(texturesDir, file), { force: true });
    }
  }
}

async function pruneDistPremium(bundleName: string) {
  const entries = await readdir(DIST_PREMIUM, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "index.html" || entry.name === bundleName) continue;

    if (entry.isDirectory()) {
      if (KEEP_DIRS.has(entry.name)) continue;
      if (entry.name === "uploads") {
        await pruneUploads();
        continue;
      }
      await rm(path.join(DIST_PREMIUM, entry.name), { recursive: true, force: true });
      continue;
    }

    if (!KEEP_FILES.has(entry.name)) {
      await rm(path.join(DIST_PREMIUM, entry.name), { force: true });
    }
  }
}

async function main() {
  const indexPath = path.join(DIST_PREMIUM, "index.html");
  let html = await readFile(indexPath, "utf-8");

  const scriptFiles = [...html.matchAll(SCRIPT_TAG_RE)].map((m) => m[1]);
  if (scriptFiles.length === 0) {
    throw new Error(
      'build-premium: no <script type="text/babel"> tags found in index.html — ' +
        "check the markup hasn't changed shape"
    );
  }
  console.log(`build-premium: compiling ${scriptFiles.length} JSX files: ${scriptFiles.join(", ")}`);

  const minified = await compileBundle(scriptFiles);
  const hash = createHash("sha256").update(minified).digest("hex").slice(0, 8);
  const bundleName = `bundle.${hash}.js`;
  await writeFile(path.join(DIST_PREMIUM, bundleName), minified);
  console.log(`build-premium: wrote ${bundleName} (${minified.length} bytes)`);

  const css = await readFile(path.join(SRC_PREMIUM, "design-tokens.css"), "utf-8");

  html = html.replace(SCRIPT_TAG_RE, "");
  html = html.replace(BABEL_STANDALONE_RE, "");
  html = html.replace(POLLER_RE, "");
  html = html.replace(THREE_JS_RE, "$1 defer></script>");
  html = html.replace(DESIGN_TOKENS_LINK_RE, `<style>\n${css}\n</style>\n`);
  html = html.replace("</body>", `<script src="/premium/${bundleName}"></script>\n</body>`);

  await writeFile(indexPath, html);
  console.log("build-premium: rewrote index.html");

  await pruneDistPremium(bundleName);
  console.log("build-premium: pruned non-public files from dist/public/premium/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Generate a real build fixture to test against**

```bash
rm -rf dist
npx vite build
```

Expected: exits 0, prints Vite's chunk summary, and `dist/public/premium/` now contains the raw, uncompiled copy of `client/public/premium/` (including `login.html` — this is expected to *not* be there anymore since Task 1 already moved it; confirm with `ls dist/public/premium/login.html` → "No such file or directory", and `ls dist/public/login.html` → exists).

- [ ] **Step 3: Run the script against the fixture**

```bash
npx tsx script/build-premium.ts
```

Expected output (hash will differ):

```
build-premium: compiling 23 JSX files: tweaks-panel.jsx, hero-debug.jsx, cta-debug.jsx, translations-en.jsx, translations-nl.jsx, translations-en-2.jsx, translations-nl-2.jsx, config.jsx, trust-strip.jsx, conversation-card.jsx, _motion.jsx, 01-nav.jsx, 02-hero.jsx, 03-approach.jsx, 04-process.jsx, 05-pipeline.jsx, 06-audit.jsx, 07-demo.jsx, 08-about.jsx, 09-faq.jsx, footer-mark.jsx, 10-cta-footer.jsx, app-main.jsx
build-premium: wrote bundle.<hash>.js (<N> bytes)
build-premium: rewrote index.html
build-premium: pruned non-public files from dist/public/premium/
```

Exit code 0, no stack trace.

- [ ] **Step 4: Inspect the output**

```bash
ls dist/public/premium/
```

Expected: exactly `assets/`, `bundle.<hash>.js`, `favicon.svg`, `hero-images/`, `index.html`, `logo-icon.png`, `logo-icon.svg`, `logo-v2-dark.svg`, `logo-v2.svg`, `netherlands.svg`, `uploads/` — no `.jsx` files, no `components.html`, `components.jsx`, `design.md`, `FILE_MAP.md`, `design-tokens.css`, `terms.html`, or `privacy.html`.

```bash
ls dist/public/premium/uploads/ dist/public/premium/uploads/textures/
```

Expected: `uploads/` contains only `textures/`; `uploads/textures/` contains only `ctatext17.jpg`.

```bash
grep -c "text/babel" dist/public/premium/index.html
grep -c "babel/standalone" dist/public/premium/index.html
grep -c "Auto-reload when files change" dist/public/premium/index.html
grep -c "design-tokens.css" dist/public/premium/index.html
grep -c "bundle\." dist/public/premium/index.html
grep "three@0.160.0" dist/public/premium/index.html
```

Expected: first four commands print `0`; fifth prints `1` (the new `<script src="/premium/bundle.<hash>.js">` tag); the `three@0.160.0` line now includes ` defer` before `></script>`.

- [ ] **Step 5: Commit**

```bash
git add script/build-premium.ts
git status
git commit -m "$(cat <<'EOF'
feat(landing): add build-time compile step for the premium landing page

New script/build-premium.ts compiles the 23 JSX files index.html loads
via Babel Standalone into one minified bundle using esbuild (already a
project dependency, no new deps added), inlines design-tokens.css, and
deletes everything else non-public from the build output. Not yet
wired into vercel.json's buildCommand.
EOF
)"
```

---

### Task 3: Wire into `vercel.json` and run full local verification

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `script/build-premium.ts` (Task 2).
- Produces: a `vercel.json` whose `buildCommand` matches exactly what's verified locally in this task — consumed by Task 4's deploy.

- [ ] **Step 1: Add the build step to `vercel.json`'s `buildCommand`**

Change:

```json
  "buildCommand": "npx vite build && cp dist/public/premium/index.html dist/public/index.html",
```

to:

```json
  "buildCommand": "npx vite build && npx tsx script/build-premium.ts && cp dist/public/premium/index.html dist/public/index.html",
```

- [ ] **Step 2: Run the exact production build command locally**

```bash
rm -rf dist
npx vite build && npx tsx script/build-premium.ts && cp dist/public/premium/index.html dist/public/index.html
echo "exit code: $?"
```

Expected: `exit code: 0`. `dist/public/index.html` now exists and is byte-identical to `dist/public/premium/index.html` (both are the rewritten, bundle-referencing version).

- [ ] **Step 3: Serve the build output locally**

```bash
cd dist/public && python3 -m http.server 4173 &
sleep 1
```

- [ ] **Step 4: curl checks — confirm the public-asset allowlist is enforced**

```bash
for url in /premium/favicon.svg /premium/logo-v2.svg /premium/hero-images/kitchen.webp /premium/uploads/textures/ctatext17.jpg /login.html; do
  echo "$url -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4173$url)"
done
for url in /premium/config.jsx /premium/04-process.jsx /premium/design-tokens.css /premium/components.html /premium/terms.html /premium/privacy.html /premium/FILE_MAP.md /premium/uploads/Lead\ Awaker\ Logo.pdf; do
  echo "$url -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4173$url)"
done
```

Expected: every URL in the first loop prints `200`; every URL in the second loop prints `404`.

- [ ] **Step 5: Visual + console verification with playwright-cli**

```bash
playwright-cli open http://localhost:4173/premium/
playwright-cli console
playwright-cli network
playwright-cli screenshot
```

Expected: `console` reports no errors (warnings about the `unpkg.com` CDN scripts loading are fine — React/ReactDOM/three.js are unchanged); `network` shows exactly one `/premium/bundle.<hash>.js` request and no `@babel/standalone` request; the screenshot shows the hero section rendering exactly as today (same fonts, layout, copy). Compare side-by-side against `https://leadawaker.com` (open a second tab: `playwright-cli tab-new https://leadawaker.com`, screenshot, compare).

Then check the Dutch locale renders too. `01-nav.jsx`'s `LangSwitcher` calls `setLang('nl')` from a button whose visible text is `nl` — use the snapshot to get its ref, then click it:

```bash
playwright-cli tab-select 0
playwright-cli snapshot
```

Find the `nl` button's ref in the snapshot output (it's inside the nav bar's language switcher, rendered as two buttons with text `en` / `nl`), then:

```bash
playwright-cli click <ref-for-nl-button>
playwright-cli console
playwright-cli screenshot
```

Expected: page re-renders in Dutch (nav, hero, process illustrations, about section, footer all switch copy — this is a client-side state change, no reload), no new console errors.

- [ ] **Step 6: Stop the local server**

```bash
kill %1
```

- [ ] **Step 7: Confirm `app.leadawaker.com` (dev) is completely unaffected**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.leadawaker.com/premium/config.jsx
curl -s -o /dev/null -w "%{http_code}\n" https://app.leadawaker.com/premium/design-tokens.css
```

Expected: both print `200` — dev still serves raw source, because the build script only ever touches `dist/`, never `client/public/premium/`.

- [ ] **Step 8: Commit**

```bash
git add vercel.json
git status
git commit -m "$(cat <<'EOF'
build(landing): wire build-premium.ts into the Vercel build command

Verified locally: the exact buildCommand string produces a pruned
dist/public/premium/ (public assets + one hashed bundle only), the
rewritten index.html has no Babel/poller/raw JSX, and app.leadawaker.com
dev serving is unaffected.
EOF
)"
```

---

### Task 4: Deploy to production

**Files:** none (git push only)

**This task requires Gabriel's explicit go-ahead before the push step** — it triggers an immediate production deploy of `leadawaker.com` via Vercel's GitHub integration.

- [ ] **Step 1: Show Gabriel the local verification results from Task 3 and ask for confirmation to push**

- [ ] **Step 2: Push to `main`**

```bash
git push
```

- [ ] **Step 3: Watch the Vercel deploy finish**

Check the Vercel dashboard, or poll production directly — the pre-deploy page has no `bundle.*.js` reference at all, so its appearance confirms the new build is live:

```bash
until curl -s https://leadawaker.com/ | grep -qo 'bundle\.[a-f0-9]*\.js'; do sleep 10; done
BUNDLE=$(curl -s https://leadawaker.com/ | grep -o 'bundle\.[a-f0-9]*\.js' | head -1)
echo "live bundle: $BUNDLE"
curl -s -o /dev/null -w "%{http_code}\n" "https://leadawaker.com/premium/$BUNDLE"
```

Expected: the loop exits once the new deploy is live, `$BUNDLE` prints a filename like `bundle.a1b2c3d4.js`, and the final `curl` prints `200`.

- [ ] **Step 4: Verify production**

`vercel.json`'s catch-all rewrite (`"/(.*)" -> "/app.html"`) means a genuinely missing `/premium/*` path does **not** return a raw 404 in production — it returns `200` with the CRM app shell's HTML (confirmed by curling a nonexistent `/premium/*` path against the live site before this deploy: `https://www.leadawaker.com/premium/this-definitely-does-not-exist-xyz123.jsx` → `200`, body starts with the app shell's `<!DOCTYPE html>`). So "deleted" here means the response body is the app shell, not the actual source file content — check the body, not the status code, for the deleted files:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://leadawaker.com/
curl -s -o /dev/null -w "%{http_code}\n" https://leadawaker.com/login
curl -s https://leadawaker.com/premium/config.jsx | head -3
curl -s https://leadawaker.com/premium/design-tokens.css | head -3
```

Expected: `/` → `200`, `/login` → `200`; the last two commands each print the app shell's `<!DOCTYPE html>`/`<html lang="en">` opening (from `client/app.html`), not JSX or CSS source — confirming the real files are gone from the deploy, same as Task 3's local `python3 -m http.server` 404 checks already confirmed for the build output itself (that local server has no rewrite fallback, so it's the more precise check; this production check only confirms the rewrite masks it the same way as any other nonexistent path on the site).

- [ ] **Step 5: Screenshot the live production homepage and confirm it matches Task 3's local screenshot**

```bash
playwright-cli goto https://leadawaker.com/
playwright-cli screenshot
playwright-cli console
```

Expected: visually identical to Task 3's screenshots, no console errors, and (informally) the page should feel noticeably snappier on reload — the whole point of this plan.
