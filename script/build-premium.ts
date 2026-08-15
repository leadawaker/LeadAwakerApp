import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { transformSync } from "esbuild";

const DIST_PREMIUM = path.resolve("dist/public/premium");
const SRC_PREMIUM = path.resolve("client/public/premium");

// Standalone legal pages, served at /terms-of-service and /privacy-policy via
// the rewrites in vercel.json. They are hand-written HTML with no JSX and no
// part in the bundle, but they DO <link> design-tokens.css — which is inlined
// and then pruned — so main() gives each the same link-to-<style> treatment as
// index.html. Without both steps these ship either deleted or unstyled, which
// is exactly how terms.html silently 404'd until 2026-07.
const LEGAL_PAGES = ["terms.html", "privacy.html"];

// Hand-written HTML pages that are NOT part of the bundle but DO <link>
// design-tokens.css, so they need the same link-to-<style> inlining and the
// same protection from pruneDistPremium. demo.html is the browser demo, served
// at /demo/<token>; it is vanilla JS on purpose, so it never enters the React
// bundle and never inherits the landing page's bone palette.
const STANDALONE_PAGES = [...LEGAL_PAGES, "demo.html"];

// Every pretty URL that vercel.json is expected to rewrite into this directory,
// checked against the real dist output by assertRewriteTargets() below.
//
// This exists because a rewrite is the OTHER half of shipping a page here, and
// it has now been lost twice. terms.html silently 404'd until 2026-07 for the
// build-step half of the problem; /home silently served the CRM shell because
// the rewrite half was written on feature/gbp-currency-uk-visitors (070d3673)
// and that branch never merged to main. Both failures are invisible in
// production: vercel.json's catch-all `/(.*)` -> /app.html answers 200 with the
// wrong document rather than 404ing, so nobody notices until a prospect is
// already looking at the wrong page.
//
// /home is not a separate file: config.jsx:761 resolves SITE_VARIANT from
// location.pathname, which a Vercel rewrite preserves, so /home and / are the
// same index.html rendering two different products.
const REWRITE_TARGETS = [
  { source: "/home", destination: "/premium/index.html" },
  { source: "/terms-of-service", destination: "/premium/terms.html" },
  { source: "/privacy-policy", destination: "/premium/privacy.html" },
  // /demo/:token is the browser demo. Without this rewrite the catch-all serves
  // app.html (the CRM shell) with a 200, so a prospect clicking a demo link
  // lands on a login screen and nobody sees a 404 in the logs.
  { source: "/demo/:token", destination: "/premium/demo.html" },
];

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
  ...STANDALONE_PAGES,
]);
// "demo" holds demo.html's stylesheet and ES modules. demo.html is a bare shell
// that <link>s and <script src>es them, so losing this directory ships a demo
// page that renders nothing at all — and, like every other failure in this
// file, does it with a 200. assertDemoAssets() below checks they survived.
const KEEP_DIRS = new Set(["assets", "hero-images", "demo"]);
const UPLOADS_KEEP = new Set(["ctatext17.jpg"]); // inside uploads/textures/

// The only files allowed to be silently missing from a checkout. These 3 are
// gitignored (.gitignore:93-95) — local-only dev tooling, never committed —
// so a clean checkout (Vercel's build) won't have them even though
// index.html still references them. Anything else missing (a real,
// tracked file gone via a bad rename/merge/etc.) must still fail the build
// loudly: see the ENOENT handling in compileBundle below.
const OPTIONAL_FILES = new Set(["tweaks-panel.jsx", "hero-debug.jsx", "cta-debug.jsx"]);

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

// Throws if `re` doesn't match `html` instead of silently no-op'ing a
// .replace(). Gabriel actively hand-edits index.html, so if any of these
// markup shapes ever drifts (e.g. the design-tokens.css <link> tag's
// attribute order changes), a plain .replace() would leave the original
// tag in the shipped HTML — pointing at a file pruneDistPremium still
// deletes — and the build would exit 0 with a broken production page.
// Fail loud instead, matching the existing zero-script-tags guard's
// philosophy.
function replaceRequired(html: string, re: RegExp, replacement: string, label: string, file = "index.html"): string {
  if (!re.test(html)) {
    throw new Error(`build-premium: expected to find and replace ${label} in ${file}, but the pattern didn't match — markup may have changed`);
  }
  return html.replace(re, replacement);
}

async function compileBundle(scriptFiles: string[]): Promise<string> {
  let bundleSource = "";
  for (const file of scriptFiles) {
    let raw: string;
    try {
      raw = await readFile(path.join(DIST_PREMIUM, file), "utf-8");
    } catch (err) {
      // Only the 3 known-gitignored dev files (OPTIONAL_FILES, above) are
      // allowed to be silently missing — app-main.jsx already handles
      // TweaksPanel being undefined via `TweaksPanel && <TweaksPanel ...>`
      // (app-main.jsx:150/186), so omitting these from the bundle changes
      // nothing visitor-facing; they already don't execute in production
      // today. Anything else missing (e.g. a real section file like
      // 02-hero.jsx gone via a bad rename/merge) must fail loudly instead
      // of silently dropping a whole section with a green build.
      if ((err as NodeJS.ErrnoException).code === "ENOENT" && OPTIONAL_FILES.has(file)) {
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

// Tests live beside the modules they cover (demo/demo.test.mjs), which is where
// they are most likely to be kept up to date — but a kept directory is a PUBLIC
// directory, and there is no reason to serve them. Dropped from the build
// output only; the source stays put.
async function pruneTestsIn(dirName: string) {
  const dir = path.join(DIST_PREMIUM, dirName);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && /\.test\.(mjs|js)$/.test(entry.name)) {
      await rm(path.join(dir, entry.name), { force: true });
      console.log(`build-premium: dropped test file ${dirName}/${entry.name} from the build`);
    }
  }
}

async function pruneDistPremium(bundleName: string) {
  const entries = await readdir(DIST_PREMIUM, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "index.html" || entry.name === bundleName) continue;

    if (entry.isDirectory()) {
      if (KEEP_DIRS.has(entry.name)) {
        await pruneTestsIn(entry.name);
        continue;
      }
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

// Asserts each REWRITE_TARGETS entry is still declared in vercel.json AND still
// points at a file that survived pruneDistPremium. Run last, so it validates
// what actually ships rather than what existed mid-build. Throws rather than
// warns, matching replaceRequired's philosophy: a silently unreachable page is
// worse than a red build.
async function assertRewriteTargets() {
  const vercelPath = path.resolve("vercel.json");
  const config = JSON.parse(await readFile(vercelPath, "utf-8")) as {
    rewrites?: { source: string; destination: string }[];
  };
  const rewrites = config.rewrites || [];

  for (const target of REWRITE_TARGETS) {
    const match = rewrites.find((r) => r.source === target.source);
    if (!match) {
      throw new Error(
        `build-premium: vercel.json has no rewrite for ${target.source}. It would fall through ` +
          `to the /(.*) catch-all and serve /app.html (the CRM shell) with a 200, not a 404. ` +
          `Expected: { "source": "${target.source}", "destination": "${target.destination}" }`
      );
    }
    if (match.destination !== target.destination) {
      throw new Error(
        `build-premium: vercel.json rewrites ${target.source} to ${match.destination}, ` +
          `expected ${target.destination}`
      );
    }
    const file = path.join(DIST_PREMIUM, match.destination.replace(/^\/premium\//, ""));
    try {
      await readFile(file);
    } catch {
      throw new Error(
        `build-premium: vercel.json rewrites ${target.source} to ${match.destination}, ` +
          `but that file is not in the build output. It was never emitted, or pruneDistPremium ` +
          `deleted it (add it to KEEP_FILES)`
      );
    }
    console.log(`build-premium: verified ${target.source} -> ${match.destination}`);
  }
}

// demo.html is a shell: every byte it renders comes from these. A rewrite that
// resolves to a page whose stylesheet and modules were pruned still answers 200
// with a blank screen, which is the same invisible failure assertRewriteTargets
// exists to catch, one level down. Parsed out of the HTML rather than listed
// here, so renaming a module cannot leave this check quietly validating a file
// nobody loads any more.
async function assertDemoAssets() {
  const html = await readFile(path.join(DIST_PREMIUM, "demo.html"), "utf-8");
  const refs = [...html.matchAll(/(?:href|src)="\/premium\/(demo\/[^"]+)"/g)].map((m) => m[1]);
  if (refs.length === 0) {
    throw new Error(
      "build-premium: demo.html references no /premium/demo/ assets — it is supposed to be a " +
        "shell that loads demo.css and main.js. Check the markup hasn't changed shape."
    );
  }
  for (const ref of refs) {
    try {
      await readFile(path.join(DIST_PREMIUM, ref));
    } catch {
      throw new Error(
        `build-premium: demo.html loads /premium/${ref}, but that file is not in the build ` +
          `output. It was never emitted, or pruneDistPremium deleted it (add its directory ` +
          `to KEEP_DIRS)`
      );
    }
  }
  console.log(`build-premium: verified ${refs.length} demo assets: ${refs.join(", ")}`);
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

  html = html.replace(SCRIPT_TAG_RE, ""); // already covered by the scriptFiles.length===0 guard above
  html = replaceRequired(html, BABEL_STANDALONE_RE, "", "the Babel Standalone <script> tag");
  html = replaceRequired(html, POLLER_RE, "", "the auto-reload poller <script> block");
  html = replaceRequired(html, THREE_JS_RE, "$1 defer></script>", "the three.js <script> tag");
  html = replaceRequired(html, DESIGN_TOKENS_LINK_RE, `<style>\n${css}\n</style>\n`, "the design-tokens.css <link> tag");
  // Deferred scripts execute in document order, strictly after full parse.
  // three.js is declared in <head> and deferred above; the bundle must also
  // be deferred so it runs AFTER three.js finishes loading+executing.
  // Without this, 03-approach.jsx's render effect (deps=[shapes], no retry)
  // fires while `THREE` is still undefined and never gets a second chance —
  // deterministic, not a network race, confirmed via empirical repro
  // (built canvas 300x150 default vs. live production's rendered 1280x720).
  html = replaceRequired(
    html,
    /<\/body>/,
    `<script src="/premium/${bundleName}" defer></script>\n</body>`,
    "the closing </body> tag"
  );

  await writeFile(indexPath, html);
  console.log("build-premium: rewrote index.html");

  for (const page of STANDALONE_PAGES) {
    const pagePath = path.join(DIST_PREMIUM, page);
    const pageHtml = await readFile(pagePath, "utf-8");
    await writeFile(
      pagePath,
      replaceRequired(pageHtml, DESIGN_TOKENS_LINK_RE, `<style>\n${css}\n</style>\n`, "the design-tokens.css <link> tag", page)
    );
    console.log(`build-premium: inlined design tokens into ${page}`);
  }

  await pruneDistPremium(bundleName);
  console.log("build-premium: pruned non-public files from dist/public/premium/");

  await assertRewriteTargets();
  await assertDemoAssets();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
