# Lead Awaker — AI Agent Guide

## Project Overview

Lead Awaker is an AI-powered WhatsApp lead reactivation engine with a CRM and client dashboard layer. It converts inactive leads into booked calls (north star KPI) through AI-powered WhatsApp conversations orchestrated via n8n and Twilio.

**Scope:** Post-login UI only. The frontend is being redesigned/rebuilt while the backend, database, and API contracts remain in place.

---

## Active Branch

The UI redesign is being developed on **`feat/leads-redesign`**.
- `main` = stable, production-safe
- `feat/leads-redesign` = active redesign — always use this branch for UI changes until merged

---

## Tech Stack

Primary: React 19, TypeScript, Vite 7, Tailwind CSS v4, shadcn/ui, TanStack Query, Wouter, @dnd-kit. Backend: Node.js/Express + PostgreSQL (locked — do not modify). See `package.json` for full dependency list.

**API:** REST — use `apiFetch` from `apiUtils.ts` and `apiRequest` from `queryClient.ts` for all API calls.

---

## Critical Rules

1. **DO NOT modify backend code** — Express server logic is locked.
2. **You ARE allowed to modify the database schema** — PostgreSQL tables/columns may be altered, but ONLY upon explicit user request.
3. **You ARE allowed to modify API contracts** — Existing endpoints may be changed if needed, but do so carefully and deliberately.
4. **DO NOT touch landing/marketing pages** — Only modify post-login UI. Everything before the login screen is out of scope.
5. **DO NOT introduce new npm packages** unless absolutely necessary — the existing stack is comprehensive.
6. **DO respect database field names exactly** — NocoDB conventions are used (e.g., `Conversion_Status`, `Accounts_id`, `full_name_1`). Do not rename fields in queries or types.
7. **DO use existing API helpers** — Always use `apiFetch` from `apiUtils.ts` and `apiRequest` from `queryClient.ts`. Never use raw `fetch` directly.
8. **DO use existing Shadcn/ui components** — Components live in `client/src/components/ui/`. Prefer these over building new ones.
9. **DO follow the existing feature-based folder structure** — `client/src/features/{feature}/`.

---

## Database

Key tables: `Leads`, `Campaigns`, `Accounts`, `Interactions`, `Tags`, `Users`, `Leads_Tags`, `Automation_Logs`, `Prompt_Library`, `Lead_Score_History`, `Campaign_Metrics_History`. Full schema: `/home/gabriel/LEADAWAKER_DATABASE_SCHEMA.md`

---

## User Roles & Access Control

There are 4 roles split across two view modes:

### Agency View (Admin + Operator)
Full operational interface. All nav items visible. Pages filterable by account or campaign.

- **Admin** — Full access to all pages, accounts, campaigns, leads. Full CRUD on all entities. Manages users, tags, prompts, automation logs, accounts.
- **Operator** — Access to most pages filtered by assigned accounts. Can manage leads, campaigns, conversations. Cannot manage users or system-level settings.

### Subaccount / Client View (Manager + Viewer)
Restricted view scoped to their account. Pages hidden entirely (not in nav, inaccessible via URL): Accounts, Prompts, Automation Logs, Tags, Users. All data auto-scoped to the client's account.

- **Manager** — Scoped to their account only. Can view campaigns, leads, conversations, calendar. Limited modification abilities.
- **Viewer** — Read-only. Scoped to their account only. No modification capabilities.

All API calls must include account scoping for subaccount users (Manager/Viewer). Agency users (Admin/Operator) see all data unfiltered.

---

## Design System & UI Standards

> **Canonical reference: [`UI_STANDARDS.md`](UI_STANDARDS.md)** — READ THIS FILE before any frontend/UI work.
> It contains the complete color system, component patterns, spacing rules, animation standards, and coding rules.
> If a rule exists in `UI_STANDARDS.md`, it overrides anything else.

**Key brand colors (see `UI_STANDARDS.md` §2 for full palette):**
- Primary: Indigo `#4F46E5` — buttons, links, focus rings, CTAs
- KPI accent: Yellow `#FCB803` — Call Booked highlights, badges, data emphasis
- UI highlights: Indian Yellow `#E3A857` derived tints — active pills, selected cards, nav highlights
- Deep Blue: `#131B49` — text on yellow, strong emphasis

**Banned colors:** `#FFF375` (lime yellow), `#FFF6C8` (lime cream), `#5170FF` (old periwinkle blue).

**Performance:** Lightweight, virtualized, Raspberry Pi–friendly (no heavy animations, virtualized tables for large datasets).

---

## Folder Structure

```
client/src/
├── components/
│   └── ui/           ← Shadcn/ui components (use these, don't recreate)
├── features/
│   ├── leads/        ← Leads Kanban, Table, Detail Panel
│   ├── campaigns/    ← Campaigns page
│   ├── chats/        ← Inbox / Chat view
│   ├── dashboard/    ← Dashboard & KPIs
│   └── ...           ← One folder per feature domain
├── pages/            ← Top-level route pages
├── hooks/            ← Shared hooks
└── lib/              ← Utilities, API helpers
```

See `FILE_MAP.md` in project root for a quick-lookup index of every key component file.

---

## API Conventions

- All API calls must include `credentials: "include"` for session cookies.
- Use `apiFetch` (from `apiUtils.ts`) for standard data requests.
- Use `apiRequest` (from `queryClient.ts`) for mutations and TanStack Query integration.
- Handle error states gracefully — show user-friendly messages when the backend is unreachable.
- Subaccount users must have their requests scoped by `Accounts_id` automatically.

---

## Hooks & Performance

A **PostToolUse hook** runs `npx tsc --noEmit` after every Edit/Write to a `client/src/**/*.{ts,tsx}` file. This catches type errors immediately but is expensive (~500MB RAM per run).

**For bulk/parallel agent runs** (3+ agents), disable it first to avoid OOM on the Pi:
```bash
touch /tmp/skip-tsc-check      # disable
# ... run agents ...
rm /tmp/skip-tsc-check          # re-enable
npx tsc --noEmit                # one final check
```

**Max parallel agents on this Pi: 2-3.** More than that risks OOM from concurrent tsc processes.

---

## Feature-Specific Guides

- **[`EXPENSES.md`](EXPENSES.md)** — Expenses tab (Billing section): PostgreSQL table, Dutch BTW/VAT logic, OpenAI PDF parsing, disk storage, frontend architecture. **Read this before touching anything expenses-related.**

---

## Active Implementation Plans

- **`contract_plan.md`** (project root) — Contract Deal Structure feature: schema additions for `deal_type`/`value_per_booking`/`payment_trigger` on contracts, campaign→contract reference, Financials widget ROI redesign, Billing Expenses tab, Plus button move, and role-access updates. **If this topic comes up, read `contract_plan.md` first.** Delete `contract_plan.md` once all tasks in it are verified complete.
