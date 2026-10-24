# Lead Awaker CRM

Lead Awaker sells AI receptionists to small businesses: an AI that answers the phone, the website chat and WhatsApp, books appointments, and hands over to a human when needed. This repo is the CRM around it, used by the agency (us) and by each client:

- **Calls and Chats**: every phone call and conversation the AI had, with transcripts, recordings, summaries and bookings.
- **Leads and Contacts**: the people behind those conversations, as a list, table or pipeline.
- **Accounts**: one per client business, with its receptionist setup, integrations and alerts.
- **Also**: Home dashboard, Calendar, lead reactivation campaigns (Accounts > Reactivation), Social, Reviews, Billing, Demos and the agency's prospecting tools.

The app is in English, Dutch and Brazilian Portuguese.

## How the pieces fit

| Piece | Where | What it does |
|---|---|---|
| CRM frontend | `client/` (this repo) | React app, built by Vite and deployed to Vercel |
| CRM API | `server/` (this repo) | Express + Drizzle on Postgres, also serves the Vite dev middleware in development |
| Automations engine | separate repo `LeadAwakerAutomations` | Python (FastAPI) service: the voice and chat AI, campaign sender, follow-ups, alerts. Talks to this API over HTTP (`ENGINE_URL`) and shares the same database |
| Booking pages | separate checkout of Cal.diy (`CALDIY_DIR`) | Self-hosted booking app the server provisions per client |
| Marketing site | `client/public/site/`, `client/public/premium/` | The leadawaker.com landing pages. Not part of the CRM; due to move to its own repo |

## Repo layout

```
client/src/
  pages/            route entry points (app.tsx = all CRM routes, every page lazy-loaded)
  features/<area>/  one folder per area (voiceCalls, leads, accounts, settings, ...)
  components/crm/   shared CRM shell, nav bar and UI primitives
  locales/{en,nl,pt}/  translations, one JSON file per namespace
  styles/           design tokens (variables.css) and shared classes
server/
  routes/           API routes, one file per domain, wired in routes/index.ts
  storage/          database access, one module per domain (storage.ts is the barrel)
  paths.ts          machine-specific paths, all overridable from .env
shared/schema.ts    Drizzle schema for every table (Postgres schema p2mxx34fvbf3ll6)
script/             build scripts and maintenance scripts
scripts/migrations/ one-off data migrations, dated
specs/, docs/       feature specs and plans
infra/              Cloudflare Worker for client booking domains
```

Before working on the UI, read `UI_STANDARDS.md` (the design system) and `UI_PATTERNS.md`. `CLAUDE.md` holds the working rules for Claude Code and is worth reading as a human too. `FILE_MAP.md` is a quick index of where components live.

## Running it locally

You need Node 20.6 or newer (the server runs Node 24), Postgres 16 or newer (the server runs 17), and ideally the automations engine running alongside.

```bash
npm install
cp .env.example .env      # then fill in at least DATABASE_URL, SESSION_SECRET, INTERNAL_API_KEY
npm run db:push           # create or update the tables from shared/schema.ts
npm run dev               # API and frontend together on http://localhost:5000
```

Most integrations (WhatsApp, Telnyx, Google, Meta, email) are optional: leave their variables empty and those features stay off. Set `DISABLE_BACKGROUND_JOBS=1` if you point a second machine at a shared database, so its pollers don't run twice. The machine paths in `.env.example` default to the production server's layout; set them if your folders differ.

Useful commands:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run check` | TypeScript type check (heavy on small machines) |
| `npm run db:push` | Push schema changes to the database |
| `npm run build` / `npm start` | Production bundle into `dist/`, then run it |

## Environments and deploys

| Address | What runs there |
|---|---|
| `leadawaker.com` | Vercel production: the marketing site and the built CRM frontend. Deploys automatically on every push to `main` |
| `api.leadawaker.com` | The API on the production server (Gabriel's Raspberry Pi, through a Cloudflare tunnel) |
| `app.leadawaker.com` | The same server in development mode: changes are live as soon as a file is saved |

On that server pm2 runs `leadawaker` (this app, see `ecosystem.config.cjs`) and `leadawaker-engine` (the Python engine). That setup is specific to the production server; on your own machine `npm run dev` is all you need.

## Working together

- `main` is production: anything pushed there goes live on leadawaker.com. Work on a branch and open a pull request.
- Keep files small and focused (around 500 lines), add every user-facing string to all three locale files, and use the design tokens instead of raw colors.
- Database changes go through `shared/schema.ts` and `npm run db:push`; one-off data changes get a dated script in `scripts/migrations/`.
- Never commit `.env` or any key. `.env.example` lists the names only.

## License

Private and proprietary. Not open source.
