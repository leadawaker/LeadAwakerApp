# Structural Debt Cleanup — Two-Session Plan

Two Claude sessions work in parallel on the same working tree (the Pi serves it live via pm2/tsx watch). They never touch the same files. Each session reads this README first, then its own brief.

- **Session A (server):** `specs/structural-debt/session-a-server.md`
- **Session B (frontend):** `specs/structural-debt/session-b-frontend.md`

## Goal

Pure refactor. Zero behavior change, zero visual change, zero API change. The app must work identically after every commit. This is about file structure and deduplication only.

## File Ownership (hard boundaries)

| Session | Owns | Must NOT touch |
|---------|------|----------------|
| A | `server/**`, `client/src/pages/Settings.tsx` + new `client/src/features/settings/**` | anything else in `client/`, `shared/schema.ts` |
| B | `client/src/features/**` (except settings), `client/src/components/crm/**`, `client/src/components/DataTable/**` | `server/**`, `client/src/pages/Settings.tsx`, `shared/schema.ts` |

Shared files neither session touches: `shared/schema.ts`, `client/src/i18n.ts`, locale files outside additive key changes in the session's own namespaces, `vite.config.ts`. `FILE_MAP.md` is updated by Session B only, at the very end (Session A leaves a note in its final summary of what moved, for B to fold in).

## Hard Rules (both sessions)

1. **Never run tsc, never run `npm run dev`, never run builds.** The app runs via pm2; verify with `pm2 logs leadawaker --lines 50` and by hitting the running app.
2. **Commit after every milestone** with prefixed messages: `refactor(server): ...` (A) / `refactor(ui): ...` (B). Small commits, working tree always green. Do not push until Gabriel says so (push deploys Vercel production).
3. **Move code, don't rewrite it.** Copy blocks verbatim into new files; resist "improving while moving". Improvements go in a notes section of the final summary instead.
4. **Keep import paths stable for outsiders.** When splitting a file other code imports, leave a barrel/re-export at the old path so files outside your ownership zone never need editing.
5. Target ≤500 lines per file where reasonable.
6. If you discover you need to edit a file owned by the other session: stop, note it in your summary, skip that part.

## Verification (no tsc allowed)

- **A:** after each extraction, `curl` 2–3 representative endpoints of the moved domain (with a session cookie or against `/api/health`-style checks where auth-free) and watch `pm2 logs` for route-registration or import errors on the tsx watch reload.
- **B:** after each migration, load the affected page on `app.leadawaker.com` (playwright-cli skill for screenshots) and compare against the pre-change screenshot taken first.

## Order of Work

Both sessions can start immediately; their critical paths don't intersect. Session B's plan is sequenced so the riskiest migration (Leads) comes last and can be deferred if the reskin takes priority.
