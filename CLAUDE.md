# LeadAwaker CRM — Project Guidelines

## What This App Is

CRM around Lead Awaker's AI receptionist (phone, website chat, WhatsApp) for small businesses, used by the agency and by each client. Core features: Calls and Chats (every AI conversation with transcripts, summaries and bookings), leads/contacts (list, table, pipeline), accounts (one per client, with receptionist setup, integrations and alerts), calendar, campaigns (lead reactivation), social, reviews, billing, demos, and the agency's prospecting and task tools. See `README.md` for the overall picture.

## Stack

React + Vite frontend, Express + Drizzle + PostgreSQL backend, session auth, react-i18next with locales `en`, `nl`, `pt`. Production runs on Gabriel's Raspberry Pi under pm2 (see Deployment).

## Key Reference Files — Read Before Working

| File | Purpose |
|------|---------|
| `UI_STANDARDS.md` | Canonical design system — colors, spacing, typography, rules, bans |
| `UI_PATTERNS.md` | Implementation patterns with exact markup |
| `FILE_MAP.md` | Quick component/file lookup — saves you grep/glob time |
| `specs/<feature>/` | Feature specs: requirements.md, implementation-plan.md, action-required.md |

## Critical Rules

### Running the App
- **On Gabriel's server (the Pi):** the app runs via **pm2**, so never run `npm run dev` there. Verify changes with `pm2 logs` or on `app.leadawaker.com`.
- **On any other machine:** `npm run dev` (see `README.md`). Machine-specific paths come from `.env` via `server/paths.ts`.
- **Never run tsc automatically.** Only run `npx tsc --noEmit` when Gabriel explicitly asks for a type check. Do not run it after edits, before finishing, or as a "just to be safe" check.

### i18n — No Hardcoded Strings
Every user-facing string must go through i18n. Locale files live in `client/src/locales/{en,nl,pt}/`.

### Timestamps — Never Send ISO Strings from Client
Drizzle-Zod generates `z.date()` for timestamp columns. ISO strings from client fail validation silently (data reverts with no error). Always set timestamps server-side using `new Date()` objects.

### No `process.exit()` in Error Handlers
Never use `process.exit()` in Vite or server error handlers — it kills the entire Express+API process. File changes are never lost on crash, only serving stops.

### Terminology
- "Leads page" = `LeadsCardView.tsx` (the card/list view with chat panel). It is also the one place a lead opens: link with `leadPath()` / `openLead()` from `client/src/lib/leadLink.ts` (`/platform/chat?lead=<id>`); the old `/platform/leads` and `/platform/contacts/:id` redirect there
- **Layout vocabulary (use these exact terms):**
  - **nav bar** = the app's global left navigation sidebar (logo, Menu/Engage/Outreach/Admin links, user profile at bottom). The leftmost vertical bar, shared across every page.
  - **toolbar** = the list panel *inside a page* where the entity cards appear (e.g., the lead-cards column on the Leads page = `LeadsListPanel.tsx`). The "menu on the left" of a page's content, sitting beside the detail panel.
  - **topbar** = the page's top header bar (e.g., "My Leads" + LIST/TABLE/PIPELINE tabs + search on the Leads page = `LeadsDesktopToolbar.tsx`). The horizontal header of the website's content area.

### Styling
- Follow `UI_STANDARDS.md` strictly. Check it before introducing new color values, spacing, or component patterns.
- Content width: list pages (a list panel beside a detail panel) keep `max-w-[1386px] mr-auto` on the outer flex child, never an inner wrapper. Single-column pages (dashboards, stats, settings-style pages) center with the shared `.la-page-center` class instead.
- Full-height columns: parent needs `overflow-hidden + min-h-0`, each column needs `min-h-0 overflow-y-auto`.
- Dark mode is live: never hardcode `bg-white`/`text-black`/raw hex, always use tokens.

## Architecture Conventions (post-refactor, 2026-06)

- **Routing is lazy everywhere.** Every page in `client/src/App.tsx` and `client/src/pages/app.tsx` is a `React.lazy` import. New pages must follow this pattern (named exports need `.then(m => ({ default: m.X }))`). Never add a static page import: it lands in the entry chunk.
- **Server routing:** `server/routes/index.ts` + domain files in `server/routes/`. `server/routes.ts` no longer exists.
- **Server storage:** `server/storage.ts` is a thin barrel; methods live in domain modules under `server/storage/` (accounts, leads, campaigns, interactions, tasks, billing, agents, ...). Add new methods to the right module, keep the barrel's `storage` object as the only consumer-facing API.
- **List views:** new list/table pipelines use `buildEntityRows()` / `groupItemsToMap()` from `client/src/components/crm/entityList/` instead of copy-pasting another page's filter→sort→group useMemo. Greenfield list pages can use `useEntityList` + `EntityListView`.
- **Settings page:** `pages/Settings.tsx` is a thin composition; edit the sections in `client/src/features/settings/components/`.
- **Images:** no multi-MB originals in `client/src/assets/` — compress to WebP at display size before committing.
- **Structural-debt refactors are DONE** (summaries in `specs/structural-debt/`). Do not re-plan this work.

## Deployment

- `leadawaker.com` = Vercel production (auto-deploys from GitHub `main` after `git push`)
- Gabriel's server setup (Raspberry Pi, pm2, Cloudflare tunnel):
  - `app.leadawaker.com` = Pi dev server (live on file save via pm2 watch)
  - `api.leadawaker.com` = Pi API (used by Vercel frontend via `VITE_API_URL`)

## Automation Engine (Python)

The campaign launcher, bump scheduler, AI conversation pipeline, and inbound handler are a **separate Python service** (repo `LeadAwakerAutomations`; on Gabriel's server at `/home/gabriel/automations/`, elsewhere wherever `AUTOMATIONS_DIR` points). It runs independently from the Express backend.

- Read that repo's `CLAUDE.md` before touching anything bump/campaign/AI-conversation related
- Campaign config fields (First_Message, bump_1_template, bump_2_template, etc.) are read from the DB by this service — not by Express
- The CRM's AutomationLogs page (`AutomationLogs.tsx` → `features/automation/`) displays logs written by this service

## Landing Page (leadawaker.com)

"Landing page", "the website", or "homepage" means the static marketing site: the homepage is `client/public/site/index.html`, with more pages in `client/public/premium/` (details in its `CLAUDE.md`). Never `client/src/legacy/`. The marketing site is not part of the CRM and is due to move to its own repo.
