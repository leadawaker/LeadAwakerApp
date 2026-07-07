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
    const raw = await readFile(path.join(DIST_PREMIUM, file), "utf-8");
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
