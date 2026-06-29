# Implementation Plan: White-label Booking Domains

Scope doc — see `requirements.md`. This is a **phased** plan; phases 1–3 deliver the core
(white-labelled booking page + custom-domain links). Phases 4–5 close the leaks.

## Phase 0 — Decisions (do before any code)

Lock these (see "Open decisions" in requirements):
- Rewrite layer: **Cloudflare Worker** (recommended) vs Cal.diy `middleware.ts`.
- v1 leak tolerance: white-label the booking page only, accept management-link leak (recommended) vs
  full proxying of `/_next` + `/api`.
- Link strategy: direct `book.clientwebsite.com/<event>?...&metadata[lead_id]=` (recommended) vs
  short-link redirector on the custom host.

## Phase 1 — Mapping store + provisioning API (no UI yet)

- Add `customDomain` (text, nullable, unique) + `customDomainStatus` (`pending|validating|active|error`)
  to the account's `calendar_connections` row (or a small new `custom_domains` table keyed by accountId).
  Migration via direct `pg` SQL script (db:push has no TTY on the Pi).
- `server/calendar/customDomain.ts`:
  - `registerCustomHostname(accountId, host)` → calls **Cloudflare for SaaS Custom Hostnames API**
    (`POST /zones/{zoneId}/custom_hostnames`, zone `436490922c7aa7dc5ce7454d9aac05dd`) with the leadawaker
    API token; stores the returned hostname id; returns the CNAME + TXT records the client must add.
  - `getCustomHostnameStatus(accountId)` → polls Cloudflare for SSL + ownership status, maps to our enum.
  - `removeCustomHostname(accountId)` → deletes the Cloudflare custom hostname + clears the columns.
- Routes in `server/routes/calendar.ts`: `POST/GET/DELETE /api/accounts/:id/custom-domain`.

## Phase 2 — Edge host→path rewrite

**If Cloudflare Worker (recommended):**
- Worker bound to the custom hostnames. On each request, read `Host`, look up `host → caldiy username`
  (via a KV namespace synced from the DB on save, or a tiny lookup endpoint on the Express API with
  short cache).
- Rewrite rules:
  - pass through `/_next/*`, `/api/*`, `/booking/*`, `/favicon*`, anything already starting with the
    username → fetch origin unchanged
  - `/` → fetch origin `/<username>` (or `/<username>/<defaultEvent>`)
  - `/<rest>` → fetch origin `/<username>/<rest>`
- Origin = the tunnel (`cal.leadawaker.com`). Set the `Host` header appropriately so Cal.diy serves.

**If Cal.diy `middleware.ts` (fork patch):**
- Add `apps/web/middleware.ts` (or extend existing) that on non-`cal.leadawaker.com` hosts looks up the
  username (read-only query against the caldiy DB or a cached map) and `NextResponse.rewrite`s the path.
- Document the patch in `caldiy`'s notes so a fork upgrade re-applies it.

Verify: `curl -H "Host: book.test.com" http://localhost:3001/` returns the right client's page HTML.

## Phase 3 — Outbound links use the custom domain

- Central helper (engine side, Python): `resolve_booking_base(account)` → returns
  `https://<customDomain>` when active, else today's behaviour (`webhooks.leadawaker.com/book/<token>`).
- In `ai_conversation.py` (both link-build spots) + `campaign_launcher.py` / `bump_scheduler.py` /
  `buying_signal_followup.py`: when the account has an active custom domain, emit
  `https://book.clientwebsite.com/<event-slug>?name=...&email=...&cal.timezone=...&metadata[lead_id]=<id>`
  instead of the short link. Reuse the exact prefill params the `/book/{token}` redirect already builds
  (factor that param-building out of `booking_routes.py` so both paths share it).
- Booking webhook already matches on `metadata[lead_id]` → no webhook change needed.

Verify: a custom-domain campaign's AI message contains a `book.clientwebsite.com` link; booking it
creates the interaction + lead match in LeadAwaker.

## Phase 4 — UI (Accounts → Integrations panel)

- Add a "Custom booking domain" card next to the existing calendar-connect UI
  (`client/src/features/accounts/components/workspace/`). Fields: domain input, Save, status badge,
  the DNS records to add (copy buttons), Remove.
- i18n: add keys to `accounts` namespace in `en` / `nl` / `pt` (Brazilian PT).
- Read-only-account aware (clients see + act per existing pattern).

## Phase 5 — Close the leaks (optional, decision-gated)

- Confirmation/management link leak: evaluate a per-account `WEBAPP_URL` override. Since it's baked,
  options are (a) run a second Cal.diy build/instance per ... (too heavy), or (b) post-process outbound
  emails/links to swap the host for custom-domain accounts at send time (the email-branding chokepoint
  in the caldiy build already rewrites sender/logo — extend it to rewrite management URLs). Prefer (b).
- Full asset proxying through the custom host if "network-tab hiding" is required.

## Risks / notes

- **Cloudflare for SaaS may be a paid add-on** depending on plan — confirm it's enabled on the
  leadawaker.com zone before building Phase 1 (this is the linchpin; if unavailable, fall back to
  per-hostname tunnel ingress entries, which don't scale well).
- Tunnel ingress is managed in the **Zero Trust dashboard**, not the local config file — custom hostnames
  via Cloudflare for SaaS sidestep needing a tunnel entry per client.
- Don't rebuild Cal.diy casually — the full build OOMs on the Pi (build `apps/web` directly with a 4GB
  heap; see caldiy build-gotchas memory). Phase 2 middleware route would trigger a rebuild; the Worker
  route does not.
- Keep `cal.leadawaker.com/<slug>` working as the canonical fallback throughout.

## Action required (human)

- Confirm **Cloudflare for SaaS / Custom Hostnames** is available on the `leadawaker.com` zone and
  provision an API token scoped to `Custom Hostnames:Edit` + `SSL and Certificates:Edit`.
- Decide the **fallback origin / target hostname** clients CNAME to (Cloudflare for SaaS gives you one).
- Pick Phase 0 decisions.
