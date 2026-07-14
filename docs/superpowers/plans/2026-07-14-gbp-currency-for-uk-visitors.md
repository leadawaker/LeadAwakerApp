# GBP Currency for UK Visitors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors whose IP geolocates to Britain (GB) see the homepage's audit calculator and CTA slider priced in `£` with UK number formatting (`en-GB`), instead of the current hardcoded `€` / `nl-NL` (Dutch) formatting. Everyone else is unaffected.

**Architecture:** `middleware.ts` (Vercel Edge Middleware, already runs on every `/`, `/pt`, `/nl` request to rewrite OG tags) reads Vercel's `x-vercel-ip-country` header and injects `window.__CURRENCY__` into the served HTML before any page script runs. `config.jsx` exposes a `window.useCurrency()` helper that reads that global. `06-audit.jsx` and `10-cta-footer.jsx` consume it instead of their hardcoded `€` / `'nl-NL'`.

**Tech Stack:** TypeScript (Vercel Edge Middleware, no framework), vanilla React 18 loaded via `<script>` + Babel-standalone (no bundler) for `client/public/premium/*.jsx`.

## Global Constraints

- Landing page = `client/public/premium/` only (per `LeadAwakerApp/CLAUDE.md`) — never touch `client/src/pages/legacy/`.
- `client/public/premium/components.jsx` / `components.html` is an internal design-system reference page, not the live site — out of scope, do not edit.
- No currency conversion of underlying numbers — only the displayed symbol and thousands/decimal formatting change. Slider defaults/min/max/step stay numerically identical.
- No manual currency-switcher UI — detection is automatic only (not requested).
- **No test framework exists** for `middleware.ts` or `client/public/premium/` (no vitest/jest config in this repo, confirmed via `package.json` and repo search). Verification below uses a standalone `tsx` script for the pure middleware logic (no test runner needed to execute it) and a local static server + browser check for the client-side JSX, per this project's actual verification convention (run it, look at it — not an automated suite).
- Never run `npx tsc --noEmit` unless Gabriel explicitly asks (`LeadAwakerApp/CLAUDE.md`).

---

### Task 1: Detect visitor country and inject currency in middleware.ts

**Files:**
- Modify: `middleware.ts:1-205`

**Interfaces:**
- Produces: `resolveCurrency(request: Request): "GBP" | "EUR"` and `injectCurrency(html: string, currency: "GBP" | "EUR"): string`, both used by Task 1 only (Task 2 never imports middleware.ts — it only reads `window.__CURRENCY__`, which this task's `injectCurrency` writes into the HTML as `<script>window.__CURRENCY__="GBP";</script>`).

- [ ] **Step 1: Add the two pure helper functions**

Add these directly above `export default async function middleware(...)` in `middleware.ts` (i.e. right after the existing `escapeHtml` function, before the `interface OgTags` block — keep them near the top so they read as shared utilities):

```ts
function resolveCurrency(request: Request): "GBP" | "EUR" {
  const country = request.headers.get("x-vercel-ip-country");
  return country === "GB" ? "GBP" : "EUR";
}

function injectCurrency(html: string, currency: "GBP" | "EUR"): string {
  return html.replace(
    '<meta charset="utf-8" />',
    `<meta charset="utf-8" />\n<script>window.__CURRENCY__="${currency}";</script>`
  );
}
```

- [ ] **Step 2: Wire `injectCurrency` into the no-calc-params branch**

Find this block (currently around line 70-72):

```ts
  if (!hasCalcParams) {
    const baseOg = translations[lang];
    const res = await fetch(new URL("/index.html", url.origin), request);
    const html = await res.text();
```

Change the last line to:

```ts
    const html = injectCurrency(await res.text(), resolveCurrency(request));
```

- [ ] **Step 3: Wire `injectCurrency` into the calc-params branch**

Find this block (currently around line 165-166, after the OG-title/description computation):

```ts
  const res = await fetch(new URL("/index.html", url.origin), request);
  const html = await res.text();
```

Change the last line to:

```ts
  const html = injectCurrency(await res.text(), resolveCurrency(request));
```

- [ ] **Step 4: Verify the pure functions with a standalone script**

Create a temporary verification script (not committed — this repo has no test runner, so we verify with a throwaway `tsx` script instead of a fake test file):

```bash
cat > /tmp/claude-1000/-home/c3fe8cb0-de33-49c2-9e52-ac663ee8fb6b/scratchpad/verify-currency-middleware.ts << 'EOF'
function resolveCurrency(request: Request): "GBP" | "EUR" {
  const country = request.headers.get("x-vercel-ip-country");
  return country === "GB" ? "GBP" : "EUR";
}

function injectCurrency(html: string, currency: "GBP" | "EUR"): string {
  return html.replace(
    '<meta charset="utf-8" />',
    `<meta charset="utf-8" />\n<script>window.__CURRENCY__="${currency}";</script>`
  );
}

const sample = '<!doctype html><html><head>\n<meta charset="utf-8" />\n<title>x</title>\n</head></html>';

const gb = new Request("https://leadawaker.com/", { headers: { "x-vercel-ip-country": "GB" } });
const us = new Request("https://leadawaker.com/", { headers: { "x-vercel-ip-country": "US" } });
const none = new Request("https://leadawaker.com/");

console.assert(resolveCurrency(gb) === "GBP", "GB header should resolve to GBP");
console.assert(resolveCurrency(us) === "EUR", "US header should resolve to EUR");
console.assert(resolveCurrency(none) === "EUR", "missing header should resolve to EUR");

const injected = injectCurrency(sample, "GBP");
console.assert(injected.includes('window.__CURRENCY__="GBP";'), "should inject GBP script tag");
console.assert(injected.indexOf("__CURRENCY__") < injected.indexOf("<title>"), "currency script must come before <title> / other scripts");

console.log("All middleware currency checks passed.");
EOF
npx tsx /tmp/claude-1000/-home/c3fe8cb0-de33-49c2-9e52-ac663ee8fb6b/scratchpad/verify-currency-middleware.ts
```

Expected output: `All middleware currency checks passed.` with no `Assertion failed` lines.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts
git commit -m "$(cat <<'EOF'
Inject visitor currency into landing page HTML via edge geo header

Reads Vercel's x-vercel-ip-country header so UK visitors get GBP
in the audit calculator; everyone else keeps EUR (default when the
header is missing, e.g. local dev).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Consume the currency in the calculator and CTA slider

**Files:**
- Modify: `client/public/premium/config.jsx` (add `window.useCurrency()` near the end, after `window.useI18n`, around line 367)
- Modify: `client/public/premium/06-audit.jsx:9-244`
- Modify: `client/public/premium/10-cta-footer.jsx:98-500`

**Interfaces:**
- Consumes: nothing from Task 1 directly — reads `window.__CURRENCY__` (a plain global string, `"GBP"` or unset) that Task 1's `injectCurrency` writes into the HTML.
- Produces: `window.useCurrency(): { symbol: "£" | "€", locale: "en-GB" | "nl-NL" }`, called by `06-audit.jsx` and `10-cta-footer.jsx`.

- [ ] **Step 1: Add `window.useCurrency()` to config.jsx**

In `client/public/premium/config.jsx`, add this immediately after the closing brace of `window.useI18n` (the last block in the file, currently ending around line 366):

```js
window.useCurrency = function useCurrency() {
  const currency = window.__CURRENCY__ === 'GBP' ? 'GBP' : 'EUR';
  return currency === 'GBP'
    ? { symbol: '£', locale: 'en-GB' }
    : { symbol: '€', locale: 'nl-NL' };
};
```

- [ ] **Step 2: Update `06-audit.jsx` to use it**

In `client/public/premium/06-audit.jsx`, change line 11 from:

```js
  const { t } = window.useI18n();
```

to:

```js
  const { t } = window.useI18n();
  const { symbol, locale } = window.useCurrency();
```

Replace the three formatting functions (currently lines 106-118):

```js
  function fmtNum(n) {
    return Math.round(n).toLocaleString('nl-NL');
  }

  function fmt(n) {
    if (n >= 1_000_000) return "€" + (n / 1_000_000).toFixed(1).replace('.', ',') + "M";
    if (n >= 1_000)     return "€" + Math.round(n / 1_000) + "K";
    return "€" + fmtNum(n);
  }

  function fmtFull(n) {
    return "€" + fmtNum(n);
  }
```

with:

```js
  function fmtNum(n) {
    return Math.round(n).toLocaleString(locale);
  }

  function fmt(n) {
    if (n >= 1_000_000) {
      const millions = (n / 1_000_000).toFixed(1);
      return symbol + (locale === 'en-GB' ? millions : millions.replace('.', ',')) + "M";
    }
    if (n >= 1_000) return symbol + Math.round(n / 1_000) + "K";
    return symbol + fmtNum(n);
  }

  function fmtFull(n) {
    return symbol + fmtNum(n);
  }
```

(The `en-GB` branch keeps the period as decimal separator, e.g. `£1.5M`; the Dutch branch keeps swapping it to a comma, e.g. `€1,5M` — this was already the pre-existing behavior for EUR, just now conditional.)

Then replace every remaining literal `'nl-NL'` in this file with `locale` (5 occurrences: the two slider min/max labels, the quotes slider display, the avgValue slider display, and the metric value display). Use a single file-wide replace since the literal is identical at each site:

- `min.toLocaleString('nl-NL')` → `min.toLocaleString(locale)`
- `max.toLocaleString('nl-NL')` → `max.toLocaleString(locale)`
- `quotes.toLocaleString('nl-NL')` → `quotes.toLocaleString(locale)`
- `avgValue.toLocaleString('nl-NL')` → `avgValue.toLocaleString(locale)` (this occurrence is inside `display: "€" + avgValue.toLocaleString('nl-NL')` — also change the `"€"` on that same line to `symbol`, so the full line becomes `display: symbol + avgValue.toLocaleString(locale),`)
- `m.value.toLocaleString('nl-NL')` → `m.value.toLocaleString(locale)`

- [ ] **Step 3: Update `10-cta-footer.jsx` to use it**

In `client/public/premium/10-cta-footer.jsx`, change line 100 from:

```js
  const { t } = window.useI18n();
```

to:

```js
  const { t } = window.useI18n();
  const { symbol, locale } = window.useCurrency();
```

Change line 162 from:

```js
      `Avg project value: €${avgValue.toLocaleString('nl-NL')}`,
```

to:

```js
      `Avg project value: ${symbol}${avgValue.toLocaleString(locale)}`,
```

Change the `QualifyingSliders` call site (currently lines 321-328) from:

```js
                      <QualifyingSliders
                        t={t}
                        quotes={quotes} setQuotes={setQuotes}
                        silentPct={silentPct} setSilentPct={setSilentPct}
                        avgValue={avgValue} setAvgValue={setAvgValue}
                        numbersAccurate={numbersAccurate} setNumbersAccurate={setNumbersAccurate}
                        name={name}
                      />
```

to:

```js
                      <QualifyingSliders
                        t={t}
                        locale={locale}
                        quotes={quotes} setQuotes={setQuotes}
                        silentPct={silentPct} setSilentPct={setSilentPct}
                        avgValue={avgValue} setAvgValue={setAvgValue}
                        numbersAccurate={numbersAccurate} setNumbersAccurate={setNumbersAccurate}
                        name={name}
                      />
```

Change the `QualifyingSliders` function signature (currently line 479) from:

```js
function QualifyingSliders({ t, quotes, setQuotes, silentPct, setSilentPct, avgValue, setAvgValue, numbersAccurate, setNumbersAccurate, name }) {
```

to:

```js
function QualifyingSliders({ t, locale, quotes, setQuotes, silentPct, setSilentPct, avgValue, setAvgValue, numbersAccurate, setNumbersAccurate, name }) {
```

Change the `rows` array (currently line 500) from:

```js
    { label: t('cta.q_quotes'), min: 50,   max: 2000,   step: 50,   value: quotes,    setValue: setQuotes,    fmt: (v) => v.toLocaleString('nl-NL') },
```

to:

```js
    { label: t('cta.q_quotes'), min: 50,   max: 2000,   step: 50,   value: quotes,    setValue: setQuotes,    fmt: (v) => v.toLocaleString(locale) },
```

- [ ] **Step 4: Verify by serving the site locally and forcing each currency state**

There's no bundler for this directory — it's served as static files and compiled by Babel in the browser, so a plain static server is enough:

```bash
cd /home/gabriel/LeadAwakerApp/client/public && npx serve -l 4173 . &
```

Use the `playwright-cli` skill to:
1. Navigate to `http://localhost:4173/premium/index.html` with an init script that runs before page scripts, setting `window.__CURRENCY__ = "GBP"` (mirrors what Task 1's `injectCurrency` does in production). Scroll to the `#audit` section and confirm the revenue figure and the "Avg project value" slider display render with `£` and comma-grouped numbers (e.g. `£40,000`, not `€40.000`).
2. Reload without the init script (simulating a non-GB visitor, i.e. `window.__CURRENCY__` unset). Confirm the same elements render with `€` and dot-grouped numbers (e.g. `€40.000`) — i.e. unchanged from current production behavior.
3. Stop the static server: `kill %1` (or the backgrounded `serve` PID).

Expected: step 1 shows `£`/comma formatting, step 2 shows `€`/dot formatting exactly as before this change.

- [ ] **Step 5: Commit**

```bash
git add client/public/premium/config.jsx client/public/premium/06-audit.jsx client/public/premium/10-cta-footer.jsx
git commit -m "$(cat <<'EOF'
Display audit calculator and CTA slider in GBP for UK visitors

Reads the window.__CURRENCY__ global (set server-side by middleware.ts
based on the visitor's geolocated country) to pick the currency symbol
and number-formatting locale. Non-UK visitors see identical output to
before this change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan note

Real GB-detection (the `x-vercel-ip-country` header itself) can only be exercised on an actual Vercel deployment or preview — it isn't present in local dev. Task 1 Step 4 and Task 2 Step 4 verify everything that *can* be verified locally (the pure header-parsing logic, and both possible rendered states of the page). Confirming an actual UK IP gets routed to GBP in production is a follow-up manual check against `leadawaker.com` (e.g. via a UK VPN) after deploy — flag this to Gabriel rather than claiming it as verified.
