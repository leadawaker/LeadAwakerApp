# Lead Awaker — AI Agent Guide

## Project Overview

Lead Awaker is an AI-powered WhatsApp lead reactivation engine with a CRM and client dashboard layer. It converts inactive leads into booked calls (north star KPI) through AI-powered WhatsApp conversations orchestrated via n8n and Twilio.

**Scope:** Post-login UI only. The frontend is being redesigned/rebuilt while the backend, database, and API contracts remain in place.

---

## Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite 7
- Tailwind CSS v4
- Shadcn/ui + Radix UI
- TanStack Query (data fetching)
- Wouter (routing)
- @dnd-kit (drag and drop)
- Recharts (charts)
- react-resizable-panels

**Backend (do not modify Express logic):**
- Node.js / Express
- PostgreSQL (schema: `p2mxx34fvbf3ll6`, 11 tables, 315+ columns)
- n8n workflows
- Twilio (WhatsApp/SMS)

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

## Database Tables

| Table | Description |
|-------|-------------|
| `Accounts` | Organization/client config, Twilio integration, AI preferences, business settings |
| `Leads` | Prospects with engagement tracking, lead scoring (0–100), bump stages, pipeline status |
| `Campaigns` | Messaging campaigns with AI templates, bump configs, performance metrics |
| `Interactions` | Individual messages/communications with analytics |
| `Users` | Team members with authentication, roles, invite system |
| `Tags` | Lead classification with categories, colors, auto-apply rules |
| `Leads_Tags` | Many-to-many junction: Leads ↔ Tags |
| `Automation_Logs` | n8n workflow execution tracking with error flagging |
| `Prompt_Library` | AI prompt templates with versioning and performance scores |
| `Lead_Score_History` | Lead scoring trends over time |
| `Campaign_Metrics_History` | Daily campaign performance snapshots for ROI analysis |

Full schema reference: `/home/gabriel/LEADAWAKER_DATABASE_SCHEMA.md`

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

## Design System

- **North Star KPI:** Calls Booked — must be the most prominent element on the Dashboard
- **Mental Model:** Accounts → Campaigns → Leads → Interactions → Pipeline Movement
- **Default Pipeline:** New → Contacted → Responded → Multiple Responses → Qualified → Call Booked → Lost → DND
- **Typography:** Inter (body), Outfit (headings)
- **Style Reference:** Modern Salesforce / Linear / Premium SaaS
- **Performance:** Lightweight, virtualized, Raspberry Pi–friendly (no heavy animations, use virtualized tables for large datasets)

### Color Palette

**Brand:**
| Token | Hex | Usage |
|-------|-----|-------|
| Blue | `#5170FF` | Primary actions, active states |
| Deep Blue | `#131B49` | Sidebar, headers, dark accents |
| Yellow | `#FCB803` | Call Booked highlight, important alerts |
| Soft Yellow | `#FCCA47` | Secondary highlights |

**Base / Neutrals:**
| Token | Hex | Usage |
|-------|-----|-------|
| White | `#FFFFFF` | Card backgrounds, surfaces |
| Light Gray | `#F8F9FA` | Page backgrounds |
| Medium Gray | `#E5E7EB` | Borders, dividers |
| Dark Gray | `#374151` | Secondary text |
| Near Black | `#111827` | Primary text |

**Dark Mode:** Use brand-tinted dark surfaces (not pure black). Soft gray backgrounds with proper contrast. Adjust brand colors for legibility on dark backgrounds.

**Glassmorphism:** Only on decorative accents. Never on functional data surfaces (pipeline cards, tables, chat bubbles).

---

## Product Identity

**Lead Awaker IS:**
- A Lead Reactivation Engine
- A Pipeline-centric system
- An Automation-first platform
- An Observability dashboard

**Lead Awaker IS NOT:**
- A generic CRM
- A deal management system
- A marketing automation suite
- An email marketing tool

## Design Priorities

When making tradeoffs, apply this order:
1. Pipeline visibility
2. Perceived speed
3. Cognitive clarity
4. Operational efficiency
5. Professional SaaS polish

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

---

## API Conventions

- All API calls must include `credentials: "include"` for session cookies.
- Use `apiFetch` (from `apiUtils.ts`) for standard data requests.
- Use `apiRequest` (from `queryClient.ts`) for mutations and TanStack Query integration.
- Handle error states gracefully — show user-friendly messages when the backend is unreachable.
- Subaccount users must have their requests scoped by `Accounts_id` automatically.

---

## Feature Categories

Features are organized into these categories:

- **Infrastructure** (indices 0–7) — API health, DB connectivity, role-aware filtering, error handling
- **App Shell & Navigation** — Layout, sidebar, topbar, account switcher
- **Dashboard** — KPI cards, charts, calls booked prominence
- **Leads — Shared** — Search, filters, bulk select, bulk actions, view toggle (shared between Kanban and Table)
- **Leads — Kanban** — Columns, drag-drop, cards, hover preview
- **Leads — Table** — Virtualized rendering, column config, CSV export, grouping
- **Lead Detail Panel** — Full lead info, interaction history, tags, pipeline actions
- **Chats / Inbox** — Conversation view, WhatsApp message thread, AI intervention
- **Campaigns** — Campaign list, metrics, configuration
- **Calendar** — Drag-and-drop booking, time slots
- **Accounts** — Account management (admin only)
- **Users** — User management, invite system (admin only)
- **Tags** — Tag CRUD, color/category config
- **Prompt Library** — AI prompt templates, versioning
- **Automation Logs** — n8n execution history, error flags
- **Settings** — Account-level settings
- **Design System & Polish** — Theming, dark mode, responsive breakpoints, micro-interactions