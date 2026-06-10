# LeadAwaker CRM — Project Guidelines

## What This App Is

Lead Reactivation CRM for WhatsApp outreach. Core features: WhatsApp inbox (conversations), campaign manager, leads pipeline (kanban/table/list), task manager (kanban/table/tree/list/gantt), prospects pipeline, AI agents, and AI smart automation (contextual bumps, buying signal detection, business knowledge base, smart handoff, nightly summaries).

## Stack

- **Frontend:** React + TypeScript (Vite), TailwindCSS, TanStack Query, shadcn/ui
- **Backend:** Express + Drizzle ORM + PostgreSQL (running on Raspberry Pi via pm2)
- **Auth:** Session-based
- **i18n:** react-i18next, three locales: `en`, `nl`, `pt`

## Key Reference Files — Read Before Working

| File | Purpose |
|------|---------|
| `UI_STANDARDS.md` | Canonical design system — colors, spacing, typography, rules, bans |
| `UI_PATTERNS.md` | Implementation patterns with exact markup |
| `FILE_MAP.md` | Quick component/file lookup — saves you grep/glob time |
| `shared/schema.ts` | Drizzle ORM schema for all DB tables |
| `specs/<feature>/` | Feature specs: requirements.md, implementation-plan.md, action-required.md |

## Critical Rules

### Running the App
- App runs via **pm2** on host — never run `npm run dev`
- Verify changes: `pm2 logs` or check `app.leadawaker.com`
- **Never run tsc automatically.** Only run `npx tsc --noEmit` when Gabriel explicitly asks for a type check. Do not run it after edits, before finishing, or as a "just to be safe" check.

### i18n — No Hardcoded Strings
Every user-facing string must go through i18n. Locale files live in `client/src/locales/{en,nl,pt}/`. Current namespace files: `leads`, `campaigns`, `conversations`, `automation`, `prompts`, `accounts`, `settings`, `billing`, `calendar`, `tags`, `users`, `about`, `crm`, `common`, `tasks`, `prospects`.

### Timestamps — Never Send ISO Strings from Client
Drizzle-Zod generates `z.date()` for timestamp columns. ISO strings from client fail validation silently (data reverts with no error). Always set timestamps server-side using `new Date()` objects.

### No `process.exit()` in Error Handlers
Never use `process.exit()` in Vite or server error handlers — it kills the entire Express+API process. File changes are never lost on crash, only serving stops.

### Terminology
- "Leads page" = `LeadsCardView.tsx` (the card/list view with chat panel), NOT `LeadDetailPanel.tsx`
- **Layout vocabulary (use these exact terms):**
  - **nav bar** = the app's global left navigation sidebar (logo, Menu/Engage/Outreach/Admin links, user profile at bottom). The leftmost vertical bar, shared across every page.
  - **toolbar** = the list panel *inside a page* where the entity cards appear (e.g., the lead-cards column on the Leads page = `LeadsListPanel.tsx`). The "menu on the left" of a page's content, sitting beside the detail panel.
  - **topbar** = the page's top header bar (e.g., "My Leads" + LIST/TABLE/PIPELINE tabs + search on the Leads page = `LeadsDesktopToolbar.tsx`). The horizontal header of the website's content area.

### Styling
- Follow `UI_STANDARDS.md` strictly. Check it before introducing new color values, spacing, or component patterns.
- Content-width cap: `max-w-[1386px] mr-auto` on outer flex child, never inner wrapper.
- Full-height columns: parent needs `overflow-hidden + min-h-0`, each column needs `min-h-0 overflow-y-auto`.

## Deployment

- `app.leadawaker.com` = Pi dev server (live on file save via tsx watch)
- `leadawaker.com` = Vercel production (auto-deploys from GitHub `main` after `git push`)
- `api.leadawaker.com` = Pi API (used by Vercel frontend via `VITE_API_URL`)

## Automation Engine (Python)

The campaign launcher, bump scheduler, AI conversation pipeline, and inbound handler are a **separate Python service** at `/home/gabriel/automations/`. It runs independently from the Express backend.

- Read `/home/gabriel/automations/CLAUDE.md` before touching anything bump/campaign/AI-conversation related
- Key files: `src/automations/campaign_launcher.py`, `bump_scheduler.py`, `ai_conversation.py`, `inbound_handler.py`
- Campaign config fields (First_Message, bump_1_template, bump_2_template, etc.) are read from the DB by this service — not by Express
- The CRM's AutomationLogs page (`AutomationLogs.tsx` → `features/automation/`) displays logs written by this service

## Landing Page (leadawaker.com)

The public-facing landing page is a **static HTML/JSX site**, separate from the CRM app.

- All files live in `client/public/premium/` — see `client/public/premium/FILE_MAP.md` for a full index
- "Landing page", "the website", or "homepage" always means these files — never `client/src/pages/legacy/`
- Legacy pages (`client/src/pages/legacy/`) are retired backups — do not edit unless explicitly asked
- The page uses its own design system (CSS variables, neumorphic tokens, Google Fonts) — `UI_STANDARDS.md` does not apply here
- Design tweaks (typography, light, depth, textures) are controlled via `config.jsx` + `app-main.jsx`

