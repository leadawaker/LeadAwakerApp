# Action Required: Task Manager

Manual steps that must be completed by a human.

## Before Implementation

- [x] **Database table created** — `Tasks` table already exists in PostgreSQL with all required columns. No migration needed.
- [x] **Drizzle schema defined** — `tasks`, `insertTaskSchema`, `Task`, `InsertTask` already in `shared/schema.ts`.

## During Implementation

- [x] **API scoping logic** — Agency-only feature. Tasks page hidden from subaccount users entirely. Routes use `requireAgency` guard.
- [x] **Nav position** — After Accounts, before Leads. Agency-only in sidebar.

## After Implementation

No manual steps required. No API keys, env vars, or external services needed.
