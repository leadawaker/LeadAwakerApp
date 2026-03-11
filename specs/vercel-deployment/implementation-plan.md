# Implementation Plan: Vercel Deployment

## Overview

4 code changes (all small) + Vercel config file + GitHub push. Local dev is unaffected because `VITE_API_URL` is only set in Vercel's env vars, not locally.

---

## Phase 1: Frontend — API base URL

Make all frontend API calls use `VITE_API_URL` prefix when deployed to Vercel. Locally it's unset so relative paths still work via pm2/Vite proxy.

### Tasks

- [ ] Update `client/src/lib/apiUtils.ts` — prefix fetch URL with `import.meta.env.VITE_API_URL ?? ""`
- [ ] Update `client/src/features/conversations/hooks/useConversationsData.ts` — prefix SSE `EventSource` URL and the inline `fetch('/api/leads/${leadId}')` call

### Technical Details

**`apiUtils.ts`** — replace the body with:
```ts
const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "include",
    headers: { ...(options?.headers || {}) },
  });
}
```

**`useConversationsData.ts`** — at the top of the SSE `useEffect`:
```ts
const API_BASE = import.meta.env.VITE_API_URL ?? "";
const url = currentAccountId
  ? `${API_BASE}/api/interactions/stream?accountId=${currentAccountId}`
  : `${API_BASE}/api/interactions/stream`;
```

Also update the inline `fetch` on line ~158:
```ts
fetch(`${API_BASE}/api/leads/${leadId}`, { credentials: "include" })
```

`API_BASE` can be declared once at module level (outside the hook) since it's a build-time constant:
```ts
const API_BASE = import.meta.env.VITE_API_URL ?? "";
```

---

## Phase 2: Backend — CORS + Session cookie

Allow cross-origin requests from `leadawaker.com`. The session cookie must be `sameSite: "none"` + `secure: true` when the frontend and API are on different domains, otherwise the browser silently drops it.

### Tasks

- [ ] Add CORS middleware to `server/index.ts` — allow `https://leadawaker.com` with credentials
- [ ] Update session cookie in `server/auth.ts` — set `sameSite: "none"` when `CORS_ORIGIN` env var is present (cross-origin production mode)

### Technical Details

**`server/index.ts`** — add before `setupAuth(app)`:
```ts
import cors from "cors";

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [];

if (allowedOrigins.length > 0) {
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));
}
```

`cors` is already available via npm (Express ecosystem). Install if missing: `npm install cors && npm install -D @types/cors`

**`server/auth.ts`** — change the cookie block:
```ts
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.CORS_ORIGIN ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
},
```

**`.env` on Pi** — add:
```
CORS_ORIGIN=https://leadawaker.com
```

---

## Phase 3: Vercel config

Tell Vercel how to build the project (root is `.`, output is `dist/public`) and configure SPA routing.

### Tasks

- [ ] Create `vercel.json` at repo root

### Technical Details

**`vercel.json`**:
```json
{
  "buildCommand": "npx vite build",
  "outputDirectory": "dist/public",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The `rewrites` rule is required for client-side routing (Wouter) — without it, direct URL visits (e.g. `/agency/conversations`) return 404.

`framework: null` tells Vercel not to auto-detect (it would wrongly detect a Next.js project).

---

## Phase 4: GitHub + Vercel setup

Push code to GitHub and connect to Vercel.

### Tasks

- [ ] Create GitHub repo (`gh repo create leadawaker-app --private`) and push
- [ ] Connect repo to Vercel (vercel.com → Import Project)
- [ ] Set Vercel env var: `VITE_API_URL = https://app.leadawaker.com`
- [ ] Add custom domain `leadawaker.com` in Vercel project settings
- [ ] Point `leadawaker.com` DNS to Vercel (add records Vercel provides in Cloudflare DNS)
- [ ] Restart pm2 on Pi after `.env` change: `pm2 restart leadawaker`

### Technical Details

Vercel build settings (configured via `vercel.json`, no manual UI config needed):
- Build command: `npx vite build`
- Output dir: `dist/public`
- Install command: `npm install`

For `leadawaker.com` on Cloudflare DNS, Vercel will provide either:
- An `A` record (76.76.21.21) for the apex domain, OR
- A `CNAME` to `cname.vercel-dns.com` (only works if Cloudflare proxy is OFF — orange cloud → grey cloud)

**Important**: Cloudflare proxy must be **disabled (grey cloud)** on the `leadawaker.com` DNS record, otherwise Cloudflare intercepts Vercel's TLS certificate provisioning and breaks HTTPS.

`app.leadawaker.com` (Cloudflare Tunnel) is unaffected — that record is managed separately by `cloudflared`.
