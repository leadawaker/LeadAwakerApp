# Landing Page Build Pipeline — Design

## Overview

`leadawaker.com`'s homepage (`client/public/premium/`) ships with no build step: production serves the exact same raw `.jsx` source files Gabriel edits, transpiled live in every visitor's browser via Babel Standalone (a 3.14 MB library Babel's own docs say is "not suitable for production"). Combined with a dev-only auto-reload poller and a render-blocking `three.js` include, this makes the homepage unreasonably slow to load. This spec adds a build-time compile step that runs only during Vercel deploys, locks down what's publicly reachable in production, and leaves Gabriel's existing edit-and-preview workflow on `app.leadawaker.com` completely untouched.

## Goals

- Eliminate in-browser JSX compilation in production: ship one pre-compiled, minified JS bundle instead of 23 raw `.jsx` files + a 3.14 MB compiler
- Stop the dev-only auto-reload poller from running in production
- Stop `three.js` (670 KB) from blocking initial render
- Stop serving source code, docs, debug panels, and dead files publicly in production (`.jsx` files, `design.md`, `FILE_MAP.md`, `components.html`, debug panels, dead `terms.html`/`privacy.html` duplicates, most of `uploads/`)
- Stop serving `design-tokens.css` as a standalone public file — inline it into the page instead
- Move the login page off the `/premium/` path permanently (`leadawaker.com/login`, not `leadawaker.com/premium/login.html`)
- Zero change to visitor-facing behavior or appearance, other than load time
- Zero change to Gabriel's dev workflow on `app.leadawaker.com`

## Non-goals

- Converting the landing page to ES modules / Vite's native multi-page build — would require rewriting all 23 files' cross-file `window.X` communication pattern into imports/exports, a much bigger and riskier change than needed here
- Pruning individual unused images inside `assets/`/`hero-images/` — out of scope, not a source-exposure or performance concern
- Bundling React/ReactDOM into the compiled output — they're 142 KB combined from a fast CDN already, not part of the measured problem
- Changing anything about the dev-time serving path (`express.static` in `server/index.ts`) — it continues serving `client/public/premium/*` raw, unchanged

## Current State (verified)

- `vercel.json`'s `buildCommand` runs `vite build`, which treats `client/public/` (including `premium/`) as pure pass-through: files are copied verbatim into `dist/public/`, untransformed. A second step (`cp dist/public/premium/index.html dist/public/index.html`) makes the premium page the site root.
- `server/index.ts:115` (`app.use("/premium", express.static(premiumDir))`) serves the same raw folder on `app.leadawaker.com` for dev/preview — entirely independent of the Vite/Vercel build path.
- `index.html` loads, render-blocking, in this order: React (10 KB), ReactDOM (132 KB), Babel Standalone (3.14 MB, CDN), `three.js` (670 KB, CDN, used only by `03-approach.jsx`), then 23 `<script type="text/babel" src="...">` tags (240 KB combined raw JSX), each fetched and transpiled in-browser before first paint.
- A separate inline script (`index.html:78-118`) polls all 20 watched files every 2 seconds via fetch + SHA-256 hash, forever, for every visitor — this is a dev-only live-reload mechanism that ships unconditionally to production too.
- `vercel.json` rewrites `/login` → `/premium/login.html`. This is the only premium `*.html` file that's actually live; `terms.html` and `privacy.html` under `premium/` are unreferenced dead duplicates (the real pages are React routes: `client/src/pages/terms-of-service.tsx`, `privacy-policy.tsx`, served via the app.html catch-all rewrite).
- `components.html`/`components.jsx` are not in `index.html`'s script list and are not linked from anywhere reachable — dead.
- `design-tokens.css` (15 KB) is linked via `<link rel="stylesheet">` in `index.html` — its only live consumer.
- Of `client/public/premium/uploads/` (4.2 MB: a scratch HTML export, a PDF, duplicate logo/netherlands SVGs), only `uploads/textures/ctatext17.jpg` (140 KB) is referenced by any live file (`10-cta-footer.jsx:212`).
- Live, must-stay-public assets referenced by path from `index.html` or the `.jsx` files: `favicon.svg`, `logo-icon.png`, `logo-icon.svg`, `logo-v2.svg`, `logo-v2-dark.svg`, `netherlands.svg`, `assets/*.webp`, `hero-images/*.webp`, `uploads/textures/ctatext17.jpg`.
- **Discovered during implementation:** 3 of the 23 script-tag files — `tweaks-panel.jsx`, `hero-debug.jsx`, `cta-debug.jsx` — are gitignored (`.gitignore:93-95`), local-only dev tooling that has never actually been deployed. Confirmed on live production today: Babel Standalone throws `SyntaxError: Unexpected token (1:0)` fetching each of these 3 URLs, because Vercel's catch-all rewrite (`"/(.*)" -> "/app.html"`) serves the CRM app shell in their place (they don't exist as static files in any deploy) and Babel fails trying to parse that HTML as JSX. This is silent and harmless today because `app-main.jsx:91,150,186` already guards `TweaksPanel` (and by the same pattern, the other two) as optional — `TweaksPanel && <TweaksPanel ...>` — so a missing/failed debug panel changes nothing visible. This pre-existing gap is unrelated to this plan, but it directly affects Design §1's build script (below): the script reads these 3 files from `dist/public/premium/`, which Vercel's clean git checkout will never have, so the build script must skip missing files gracefully rather than fail.

## Design

### 1. Build script: compile instead of ship raw JSX

New script, `script/build-premium.ts` (Node, run via `tsx`, matching the existing `script/build.ts` convention), invoked as an added step in `vercel.json`'s `buildCommand`, after `vite build` has already copied `client/public/premium/*` into `dist/public/premium/*`:

1. Parse `dist/public/premium/index.html` (the copy Vite just placed) for its ordered list of `<script type="text/babel" src="/premium/...">` tags — this is the single source of truth for which files to compile, so a future new section (new file + new script tag in `index.html`) is picked up automatically with no separate list to maintain.
2. For each file in that order, transform with `esbuild.transformSync()` (`loader: 'jsx', jsx: 'transform'`, classic `React.createElement` runtime) — `esbuild` is already a direct project dependency (`package.json`, used by Vite itself), so this adds zero new dependencies. Its classic JSX transform is a well-established equivalent to Babel Standalone's default output for plain JSX with no exotic syntax, which is all this codebase uses. If a listed file doesn't exist in `dist/public/premium/` (the 3 gitignored debug files, see Current State above), skip it and log why, rather than failing the build — this is expected on every real Vercel deploy, not an error condition.
3. Convert each file's transformed output's TOP-LEVEL `const`/`let` declarations to `var` (regex `^(const|let)\b` in multiline mode — matches only column-0 declarations, leaving every nested declaration inside a function/block body untouched), then concatenate in that same order into one string. This was discovered in two steps during implementation: a first attempt assumed flat concatenation was safe, but it threw because `01-nav.jsx` and `10-cta-footer.jsx` both declare `const ArrowSm` at top level. A second attempt wrapped each file in its own IIFE to isolate scope — this fixed the collision but broke the *other* direction of cross-file communication: files also read each other's bare top-level `const`/`let` names directly (e.g. `app-main.jsx` reads `config.jsx`'s `const TWEAK_DEFAULTS` with no `window.` prefix, and reads component names like `Nav` the same way), which an IIFE also isolates, and this broke at runtime (blank page, `TWEAK_DEFAULTS is not defined`) — caught by local browser verification, not by any build-time check. Empirically confirmed (via a minimal Babel Standalone reproduction) that today's actual per-`<script>`-tag execution treats top-level `const`/`let` exactly like `var`: freely re-declarable across script tags AND freely readable bare across script tags. The `const`→`var` text substitution reproduces that behavior directly, without esbuild's help — esbuild has no const/let-to-var downlevel capability at all (confirmed: `target: 'es5'` errors "Transforming const to the configured target environment is not supported yet" on the installed esbuild version).
4. Minify the concatenated result with `esbuild.transformSync(..., { minify: true })` into `dist/public/premium/bundle.[hash].js`, where `[hash]` is a content hash for cache-busting across deploys.
5. Read `client/public/premium/design-tokens.css` and inline its contents into a `<style>` tag.
6. Rewrite `dist/public/premium/index.html` in place:
   - Remove all 23 `<script type="text/babel">` tags
   - Remove the Babel Standalone `<script>` tag (no longer needed — nothing left to transpile in-browser)
   - Remove the auto-reload poller `<script>` block (lines 78-118 today) entirely
   - Add `defer` to the `three.js` `<script>` tag so it no longer blocks initial render
   - Replace `<link rel="stylesheet" href="/premium/design-tokens.css">` with the inlined `<style>` block from step 5
   - Add one `<script src="/premium/bundle.[hash].js"></script>` tag, positioned where the last babel script tag used to be
7. Delete from `dist/public/premium/` everything not on the public-asset allowlist (see section 2) — the 23 `.jsx` files (their content now lives only in the compiled bundle), `components.html`, `components.jsx`, `design.md`, `FILE_MAP.md`, `tweaks-panel.jsx`, `hero-debug.jsx`, `cta-debug.jsx`, `design-tokens.css` itself (now inlined), `terms.html`, `privacy.html`, and everything under `uploads/` except `uploads/textures/ctatext17.jpg`.

The existing `cp dist/public/premium/index.html dist/public/index.html` step in `vercel.json` runs after this and needs no change — it now copies the already-transformed production `index.html`.

### 2. Public-asset allowlist (survives in `dist/public/premium/` after build)

`favicon.svg`, `logo-icon.png`, `logo-icon.svg`, `logo-v2.svg`, `logo-v2-dark.svg`, `netherlands.svg`, `assets/` (all files), `hero-images/` (all files), `uploads/textures/ctatext17.jpg`, the generated `bundle.[hash].js`, and the rewritten `index.html`.

Everything else under `client/public/premium/` is either compiled into the bundle (the `.jsx` files) or deleted from the production output (debug panels, docs, dead HTML duplicates, `design-tokens.css`, the rest of `uploads/`). None of it is reachable by URL in production. `client/public/premium/` itself is untouched on disk — this only affects what the build step copies into `dist/public/`.

### 3. `login.html` moves off `/premium/`

One-time physical move: `client/public/premium/login.html` → `client/public/login.html`. `vercel.json`'s rewrite changes from `{ "source": "/login", "destination": "/premium/login.html" }` to `{ "source": "/login", "destination": "/login.html" }`. Since the file now lives outside `premium/`, Vite's normal public-passthrough copies it to `dist/public/login.html` with no special-casing in the build script, and it's permanently outside the `/premium/` namespace in both dev and prod — not just a build-time illusion.

### 4. Dev workflow — unchanged

`app.leadawaker.com` keeps serving `client/public/premium/*` raw via `express.static`, with Babel Standalone and the auto-reload poller running exactly as today. Editing a `.jsx` file and refreshing still works identically. The only thing that changes for Gabriel: if he ever needs to touch the login page, it now lives at `client/public/login.html` (one directory up) instead of `client/public/premium/login.html`.

## Verification Plan

1. Run `vite build && tsx script/build-premium.ts` locally, serve `dist/public/` with a static server.
2. Screenshot-compare the built output against the current live site (both EN and NL) — hero, process illustrations, about section, footer, login page.
3. Check the browser console for errors on the built version (confirms the Babel-transform concatenation didn't break cross-file references).
4. Confirm the network tab shows one JS bundle instead of 23 files + Babel Standalone, and that `three.js` no longer blocks first paint.
5. Spot-check that `/premium/config.jsx`, `/premium/design-tokens.css`, `/premium/uploads/Lead Awaker Logo.pdf`, `/premium/terms.html` etc. all 404 on the built output, and `/premium/favicon.svg`, `/premium/hero-images/kitchen.webp`, `/login` still resolve.
6. Confirm `app.leadawaker.com` still previews edits live, unaffected.

## Risks

- `esbuild`'s JSX transform could in theory diverge from Babel Standalone's runtime output on some edge-case syntax — low risk given the code is plain modern JS+JSX with no exotic features, and any such failure surfaces immediately in local verification (or, at worst, blocks the Vercel build loudly) rather than silently breaking for visitors, which is safer than today's failure mode.
- This is the first build step ever added to this folder — if the concatenation-order assumption is wrong for some file, it would surface immediately in local verification before any deploy. **This happened, twice**: (1) `01-nav.jsx` and `10-cta-footer.jsx` both declare top-level `const ArrowSm`, which threw a build-time error under naive flat concatenation — caught immediately, before any deploy. (2) The first fix (wrapping each file in its own IIFE) went too far: it also isolated legitimate bare cross-file reads like `config.jsx`'s `TWEAK_DEFAULTS`, which several other files read without a `window.` prefix — this one did NOT throw at build time, it produced a build that succeeded but rendered a blank page at runtime (`TWEAK_DEFAULTS is not defined`), only caught by the local browser-based verification step (screenshot/console check), not by the build step itself. This is the sharper version of this exact risk: a build-time-clean output can still be runtime-broken, which is why the plan's local playwright-cli verification step is not optional. Final fix (Design §1 step 3): convert only top-level const/let to var (regex, column-0 only) — verified empirically against a minimal Babel Standalone reproduction to match real current behavior exactly (freely re-declarable AND freely readable bare across script tags).
