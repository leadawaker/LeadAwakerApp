# Home Hub — Claude Code Handoff

## What this is
`Home Hub.html` is a React 18 app (no build step) for the Lead Awaker CRM. It uses
in-browser Babel to transpile `.jsx` at runtime. There is no bundler, package.json,
or framework — it's a static HTML page that loads React + Babel from a CDN and then
loads local component files via `<script>` tags.

## Files you MUST have together (the HTML alone will render blank)
- `Home Hub.html`        — entry point; mounts `<HomeHub />` into `#root`
- `design-system.css`    — SINGLE SOURCE OF TRUTH for all design tokens (see below)
- `home-data.js`         — plain JS data (global, loaded before React)
- `components.jsx`        — shared primitives (Icon, Sidebar, Header, etc.)
- `tweaks-panel.jsx`     — in-page tweak controls
- `home-shell.jsx`       — page shell / chrome
- `home-variations.jsx`  — variation logic + the `HomeHub` root component

## Loaded from CDN at runtime (need internet, no download)
- React 18.3.1 + ReactDOM (UMD, pinned + integrity hashes)
- @babel/standalone 7.29.0
- 5 Google Fonts: Libre Baskerville, Space Grotesk, Playfair Display, Merriweather, Abril Fatface

## How scope works (IMPORTANT)
Each `<script type="text/babel">` is transpiled in its OWN scope. Components are shared
by assigning them to `window` at the end of each file, e.g.:
```js
Object.assign(window, { Icon, Sidebar, Header });
```
So `home-variations.jsx` can use `Icon` only because `components.jsx` put it on `window`.
Keep this pattern if you split files further. Load order in the HTML matters — data and
components must load before the file that consumes them.

Also: never name a shared styles object just `styles` — collisions break the page. Use
prefixed names like `homeStyles`.

## Design tokens — the "different tokens" you mentioned
ALL tokens live in `design-system.css` as CSS custom properties. Change one value there
and it ripples across every page. Do NOT hardcode colors/spacing/radii in components —
reference the variables. Token families:

- **Colors:** `--wine` (#5E2230 accent), `--paper`, `--bg`, `--bg-2`, `--surface`, `--card`,
  `--ink` (text), `--mute`, `--mute-2`, `--line`, `--wine-tint`
- **Radii (snap to these):** `--r-flush 6px`, `--r-button 8px`, `--r-surface 11px`,
  `--r-card 16px`, `--r-panel 22px`, `--r-pill 999px`
- **Spacing:** `--space-xxs 4` … `--space-3xl 28`
- **Shadows:** `--sh-inset-crisp`, `--sh-raised-crisp/-medium/-tall`
- **Fonts:** `--mono` (used by the `.home-tag` labels) + the Google Font families above

### JSX gotcha (will break the page if wrong)
In inline styles, CSS variables MUST be quoted strings:
```jsx
// correct
<div style={{ borderRadius: 'var(--r-card)', padding: 'var(--space-md)' }} />
// WRONG — Babel syntax error, page goes blank
<div style={{ borderRadius: var(--r-card) }} />
```

## Frozen foundations — do not change without intent
`design-system.css` also defines locked utility/component classes the whole app shares:
`.la-btn` (+ `--raised`/`--ghost`/`--sm`/`--xs`/`.wine`), `.la-seg` + `.la-seg-btn.on`
(segmented controls), and `.neu-*` / `.glass-*` (neumorphic/glass internals, tuned px —
don't tokenize their radii). Editing these shifts every page at once.

## If you want to turn this into a "real" project
- It's framework-agnostic React. To migrate to Vite/Next: move each `window`-export
  component to ESM `export`/`import`, drop the in-browser Babel, and import
  `design-system.css` once at the app root. Keep the CSS-variable token system as-is.
- Until then, it runs by just opening `Home Hub.html` from a static server (fonts/CDN
  need network). Opening via `file://` works too but some browsers block the module-ish
  script loads — prefer a local static server (`npx serve` / `python -m http.server`).

## What to tell Claude Code in your prompt
Point it at this file plus the 7 files listed above, and state what you want changed.
Emphasize: respect the token system (edit `design-system.css`, don't hardcode), keep the
`window`-export scope pattern, and quote CSS vars in JSX inline styles.
