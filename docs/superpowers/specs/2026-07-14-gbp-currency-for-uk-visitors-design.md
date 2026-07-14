# GBP currency for UK visitors — Design

## Problem

The public homepage (`client/public/premium/`) hardcodes `€` (Euro) and Dutch
number formatting (`nl-NL`, e.g. `40.000`) in the audit calculator and its
mirrored CTA slider. Visitors from Britain should see `£` (GBP) with UK
number formatting (`en-GB`, e.g. `40,000`) instead.

## Scope

**In scope:**
- `client/public/premium/06-audit.jsx` — main audit calculator (revenue
  estimate display, avgValue slider display, all `toLocaleString('nl-NL')`
  calls)
- `client/public/premium/10-cta-footer.jsx` — sticky CTA's mirrored slider
  (same `€` / `nl-NL` occurrences)
- `middleware.ts` — Vercel Edge Middleware, extended to detect visitor
  country and inject currency

**Out of scope:**
- `client/public/premium/components.jsx` / `components.html` — internal
  design-system reference page, not part of the live site
- Any actual currency conversion of amounts (deal value, cost, etc.) — this
  is a display-only change. The underlying numbers (e.g. default deal value
  40000) stay identical; only the symbol and thousands-separator formatting
  change.
- A manual currency switcher UI — not requested, detection is automatic only

## Detection

`middleware.ts` already runs on every request to `/`, `/pt`, `/nl` and
rewrites the fetched `index.html` to swap OG meta tags per language. Extend
it to also:

1. Read `request.headers.get('x-vercel-ip-country')`.
2. Compute `currency = country === 'GB' ? 'GBP' : 'EUR'`.
3. Inject an inline script (`<script>window.__CURRENCY__="GBP";</script>`)
   into the returned HTML, before the existing `<script>` tags that load
   `config.jsx` and the section components, so it's available before any
   component renders.

This runs at the edge, so the correct currency is baked into the HTML before
the browser executes any JS — no flicker, no client-side geolocation API
call, no extra round trip.

**Fallback:** if the header is missing (local dev, non-Vercel environments)
or the country isn't `GB`, `window.__CURRENCY__` is unset/`"EUR"` and
behavior is identical to today (`€`, `nl-NL`).

## Client-side consumption

Add a small helper in `config.jsx`:

```js
window.useCurrency = function useCurrency() {
  const currency = window.__CURRENCY__ === 'GBP' ? 'GBP' : 'EUR';
  return currency === 'GBP'
    ? { symbol: '£', locale: 'en-GB' }
    : { symbol: '€', locale: 'nl-NL' };
};
```

`06-audit.jsx` and `10-cta-footer.jsx` call `window.useCurrency()` and use
`symbol` in place of the hardcoded `"€"`, and `locale` in place of the
hardcoded `'nl-NL'` in every `toLocaleString(...)` call.

## Testing

- Verify the fallback path locally (no `x-vercel-ip-country` header →
  `EUR`/`nl-NL`, unchanged from current behavior).
- Real GB detection can't be spoofed locally (it depends on Vercel's edge
  geo header) — needs to be checked against the live or a preview
  deployment, e.g. via a UK VPN or Vercel's geo-override preview headers.
