# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lead Awaker is an AI-powered WhatsApp lead reactivation engine with a CRM and client dashboard layer. It converts inactive leads into booked calls through AI-powered WhatsApp conversations orchestrated via a Python automation engine and Twilio.

**Scope:** Post-login UI only. The frontend is being redesigned/rebuilt while the backend and database remain in place.

---

## Development Commands

```bash
# Full-stack dev (Express + Vite on single port :5000)
npm run dev

# Split-mode dev (separate processes)
npm run dev:client        # Vite frontend only → :5000 (proxies /api → :5001)
npm run dev:server        # Express API only → :5001 (STANDALONE_API=true)

# Type checking
npm run check             # npx tsc --noEmit

# Database
npm run db:push           # Drizzle schema sync → live PostgreSQL

# Build & production
npm run build             # Vite (frontend) + esbuild (backend) → dist/
npm start                 # Production server from dist/
```

**`npm run dev`** is the default — it starts Express with Vite middleware embedded, everything on `:5000`. Use `dev:client` + `dev:server` only when you need to restart backend/frontend independently.

---

## Active Branch

- `main` = stable, production-safe
- `feat/leads-redesign` = active redesign — always use this branch for UI changes until merged

---

## Architecture

Single-repo, single `package.json`. Three source directories share the same TypeScript project:

```
client/src/     → React 19 app (Vite, Tailwind v4, shadcn/ui)
server/         → Express API (Passport auth, PostgreSQL via Drizzle)
shared/         → Drizzle schema + shared TypeScript types
```

**Path aliases** (in `vite.config.ts` and `tsconfig.json`):
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

**Build output:** `dist/public/` (frontend), `dist/index.cjs` (backend bundle)

---

## Critical Rules

1. **DO NOT modify backend code** — Express server logic (`server/routes.ts`, `server/auth.ts`, `server/storage.ts`) is locked unless explicitly requested.
2. **You ARE allowed to modify the database schema** — but ONLY upon explicit user request. **CRITICAL: Schema changes in `shared/schema.ts` MUST be accompanied by a matching `ALTER TABLE` migration run against the live database immediately.** Drizzle does NOT auto-migrate — if a column exists in the schema but not in the database, every query on that table will fail at runtime. After any schema edit, verify with: `node -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT column_name FROM information_schema.columns WHERE table_schema=\'p2mxx34fvbf3ll6\' AND table_name=\'TableName\'').then(r=>console.log(r.rows.map(x=>x.column_name))).finally(()=>p.end())"` (load `.env` first).
3. **You ARE allowed to modify API contracts** — existing endpoints may be changed if needed, but do so carefully.
4. **DO NOT touch landing/marketing pages** — only modify post-login UI.
5. **DO NOT introduce new npm packages** unless absolutely necessary.
6. **DO respect database field names exactly** — NocoDB conventions (e.g., `Conversion_Status`, `Accounts_id`, `full_name_1`). Do not rename fields.
7. **DO use existing API helpers** — `apiFetch` from `@/lib/apiUtils`, `apiRequest` from `@/lib/queryClient`. Never use raw `fetch`.
8. **DO use existing Shadcn/ui components** — `client/src/components/ui/`. Prefer these over building new ones.
9. **DO follow the feature-based folder structure** — `client/src/features/{feature}/`.

---

## Database

PostgreSQL via Drizzle ORM. Schema: `shared/schema.ts`. Drizzle config: `drizzle.config.ts` (schema filter: `p2mxx34fvbf3ll6`).

Key tables: `Leads`, `Campaigns`, `Accounts`, `Interactions`, `Tags`, `Users`, `Leads_Tags`, `Automation_Logs`, `Prompt_Library`, `Lead_Score_History`, `Campaign_Metrics_History`.

---

## Routing & Access Control

Routes defined in `client/src/pages/app.tsx` with two path prefixes:
- `/agency/*` — Admin + Operator (full CRM)
- `/subaccount/*` — Manager + Viewer (scoped to their account)

**Agency-only pages** (behind `<AgencyOnly>` guard): Accounts, Automation Logs, Prompt Library, Expenses. Non-agency users redirect to `/campaigns`.

**Key redirects:** `/users` → `/settings`, `/tags` → `/campaigns`, `/dashboard` → `/campaigns` (Campaigns is the landing page).

### User Roles

| Role | View Mode | Access |
|------|-----------|--------|
| Admin | Agency | Full CRUD on all entities |
| Operator | Agency | Filtered by assigned accounts, no user management |
| Manager | Subaccount | Read/limited-write, scoped to their account |
| Viewer | Subaccount | Read-only, scoped to their account |

All API calls from subaccount users must be scoped by `Accounts_id`.

---

## API Conventions

- All API calls include `credentials: "include"` for session cookies.
- `apiFetch` (from `@/lib/apiUtils`) for GET requests.
- `apiRequest` (from `@/lib/queryClient`) for mutations + TanStack Query integration.
- TanStack Query defaults: `staleTime: Infinity`, `refetchOnWindowFocus: false`, retry on 5xx/network errors only.
- Server-side auth middleware: `requireAuth`, `requireAgency`, `scopeToAccount`.

---

## Design System & UI Standards

> **Two canonical files — read BOTH before any frontend/UI work:**
>
> - **[`UI_STANDARDS.md`](UI_STANDARDS.md)** — Rules, tokens, bans, design decisions (the "what" and "why")
> - **[`UI_PATTERNS.md`](UI_PATTERNS.md)** — Implementation patterns, exact markup, code references (the "how")
>
> If a rule exists in either file, it overrides anything else. `UI_STANDARDS.md` wins on design decisions, `UI_PATTERNS.md` wins on implementation details.

**Dark mode:** Fully implemented. See **[`NIGHT_MODE.md`](NIGHT_MODE.md)** for the dark mode architecture, surface hierarchy, accent system, avatar palettes, and rules for adding dark support to new components.

**Performance:** Lightweight, virtualized, Raspberry Pi-friendly. No heavy animations, virtualized tables for large datasets.

---

## Folder Structure

```
client/src/
├── components/ui/      ← Shadcn/ui components (use these, don't recreate)
├── features/
│   ├── leads/          ← List, Table, Kanban, Detail views
│   ├── campaigns/      ← List + detail (Summary/Configurations/Tags tabs)
│   ├── conversations/  ← Inbox + Chat panel
│   ├── accounts/       ← Accounts management
│   ├── billing/        ← Contracts, Invoices, Expenses
│   ├── tags/           ← Campaign tag management
│   ├── prompts/        ← Prompt library
│   └── users/          ← User/team management
├── pages/              ← Top-level route pages
├── hooks/              ← Shared hooks
└── lib/                ← Utilities, API helpers, color system
```

See `FILE_MAP.md` for a quick-lookup index of every key component file.

---

## Hooks & Performance

A **PostToolUse hook** (`.claude/tsc-check.sh`) runs `npx tsc --noEmit` after every Edit/Write to `client/src/**/*.{ts,tsx}`. It does NOT check `server/` or `shared/` files. This catches type errors immediately but costs ~500MB RAM per run.

**For bulk/parallel agent runs** (3+ agents), disable it to avoid OOM on the Pi:
```bash
touch /tmp/skip-tsc-check      # disable
# ... run agents ...
rm /tmp/skip-tsc-check          # re-enable
npx tsc --noEmit                # one final check
```

**Max parallel agents on this Pi: 2-3.** More risks OOM from concurrent tsc processes.

---

## Feature-Specific Guides

- **[`EXPENSES.md`](EXPENSES.md)** — Expenses tab: PostgreSQL table, Dutch BTW/VAT logic, OpenAI PDF parsing, disk storage, frontend architecture.
- **[`NIGHT_MODE.md`](NIGHT_MODE.md)** — Dark mode: surface hierarchy, per-page accent system, avatar palettes, substitution rules, gradient overlays.
