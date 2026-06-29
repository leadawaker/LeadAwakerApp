# Requirements: White-label Booking Domains (book.clientwebsite.com)

## What and Why

Today every client's booking page lives under **`cal.leadawaker.com/<client-slug>/<event>`**, and the
per-lead booking links the AI sends are **`webhooks.leadawaker.com/book/<token>`**. Both expose the
**leadawaker** brand. A lead who looks at the link (or its address bar after redirect) can research it and
discover the business hired an AI automation agency. That undermines the "this is just the client's own
booking page" illusion we want.

**Goal:** let each client serve their booking page from **their own domain**, e.g.
`book.clientwebsite.com` or `afspraak.klantbedrijf.nl`, with no leadawaker branding visible in the
address bar. Clients all already own a website, so a `book.` subdomain is a one-time DNS record for them.

This is a **white-label / vanity-domain** feature on top of the existing self-hosted Cal.diy. It does NOT
replace `cal.leadawaker.com` (which stays as the default/fallback and for clients who don't bother).

## Current architecture (grounding)

- **Cal.diy** (self-hosted Cal.com fork) runs on the Pi via pm2 (`caldiy`), port `3001`.
- Public URL `https://cal.leadawaker.com` → **Cloudflare Tunnel** (`pi-tunnel`) → `http://localhost:3001`.
  There is **no nginx**; ingress hostnames are added in the Cloudflare Zero Trust dashboard.
- `NEXTAUTH_URL` / `NEXT_PUBLIC_WEBAPP_URL` = `https://cal.leadawaker.com` and are **baked into the
  Next.js build** (rebuild required to change).
- Booking pages render at path `/<username>/<event-slug>` (e.g. `/sandbox-client/30min`). There is no
  built-in routing of a fully custom apex/sub domain to a user's page at the **root** path in the
  community build (Cal.com's org custom-domain feature is enterprise + subdomain-shaped).
- Each LeadAwaker account already gets its own Cal.diy user via `provisionCaldiyForAccount`
  (`server/calendar/caldiy.ts`), so a stable per-account `username` already exists.
- The AI sends per-lead links `webhooks.leadawaker.com/book/<token>` which 302-redirect to the client's
  `calendar_url` with lead prefill (`booking_routes.py` → `/book/{token}`).

## The two things that must change

1. **Inbound: serve the booking page at the custom host.** A request to `https://book.clientwebsite.com/`
   must render that client's Cal.diy booking page, with SSL, without the lead ever seeing `cal.leadawaker.com`.
2. **Outbound: the link the AI sends must be on the custom domain too.** A `webhooks.leadawaker.com/book/...`
   link leaks the brand even if the final page is white-labelled. Custom-domain clients need their
   campaign links to point at `https://book.clientwebsite.com/<event>` (with lead prefill preserved).

## Approach (recommended)

**Cloudflare for SaaS (Custom Hostnames) + an edge host→path rewrite.**

- **SSL + routing:** Use **Cloudflare for SaaS / Custom Hostnames** on the `leadawaker.com` zone. The
  client adds one `CNAME book.clientwebsite.com → <fallback-origin we give them>` (plus a one-time TXT for
  ownership validation). Cloudflare auto-issues and renews the cert for the client's hostname and routes
  the traffic into our tunnel. No per-client cert management on the Pi.
- **Host→page mapping:** the community build won't map a custom host to `/<username>` at root, so add a
  thin **rewrite layer** that, based on the incoming `Host` header, rewrites:
  - `/` → `/<username>` (or `/<username>/<default-event>`)
  - `/<event-slug>` → `/<username>/<event-slug>`
  - pass through unchanged: `/_next/*`, `/api/*`, `/booking/*`, static assets
  - Implement as a **Cloudflare Worker** (keeps the change OUT of the vendored Cal.diy fork — preferred),
    or as Next.js `middleware.ts` inside Cal.diy (cleaner mapping + DB access, but a fork patch to maintain).
- **Mapping store:** one table `host → caldiy username` (or reuse the LeadAwaker `calendar_connections`
  row for the account, adding a `customDomain` column). The rewrite layer and the link generator both read it.

## Acceptance Criteria

- [ ] Gabriel (or the client, via the read-only Accounts → Integrations panel) can set a **custom booking
      domain** for an account (e.g. `book.clientwebsite.com`)
- [ ] On save, LeadAwaker registers the hostname with Cloudflare for SaaS and shows the client the exact
      **DNS records to add** (CNAME + validation TXT), with copy-to-clipboard
- [ ] The UI shows live **status**: `pending DNS` → `validating` → `active` (polled from Cloudflare)
- [ ] Once active, `https://book.clientwebsite.com/` renders that client's booking page with valid SSL and
      **no `cal.leadawaker.com` in the address bar** for the booking page itself
- [ ] Campaign/AI booking links for a custom-domain account are emitted as
      `https://book.clientwebsite.com/<event>` with lead prefill (name/email/timezone/lead_id) preserved,
      instead of the `webhooks.leadawaker.com/book/<token>` short link
- [ ] Bookings made via the custom domain still fire the existing `webhooks.leadawaker.com/webhooks/booking`
      webhook and land in LeadAwaker + the client's connected calendar exactly as today
- [ ] Clients without a custom domain are unchanged (still on `cal.leadawaker.com/<slug>`)
- [ ] Removing the custom domain reverts links + routing to `cal.leadawaker.com` cleanly

## Open decisions / known leaks (must be called out, not silently shipped)

1. **Booking-management & confirmation links still carry `cal.leadawaker.com`.** Because
   `NEXT_PUBLIC_WEBAPP_URL` is baked at build time, post-booking URLs (reschedule/cancel), the `.ics`
   organizer/URL, and confirmation-email management links will still point at `cal.leadawaker.com` even
   when the booking page is on the custom domain. The **booking page the lead clicks from WhatsApp** is
   white-labelled (the 99% surface); the leak is in the after-booking surfaces. Decision: ship v1 with the
   page white-labelled and accept the management-link leak, OR invest in per-request `WEBAPP_URL` override
   (hard — it's compile-time) as a phase 2.
2. **Per-lead token vs direct link.** The `/book/<token>` short link does two jobs: brand-neutral-ish
   shortening AND embedding `lead_id` so the booking webhook matches the lead without email/phone lookup.
   Sending `book.clientwebsite.com/<event>` directly loses the token. Options: (a) carry `lead_id` as a
   query param + prefill (webhook already supports `metadata[lead_id]`), or (b) run the short-link
   redirector on the custom domain too (`book.clientwebsite.com/b/<token>`). Recommend (a) for simplicity.
3. **Network-tab purists.** If the rewrite proxies `/_next` and `/api` through the custom host, even XHRs
   stay on `book.clientwebsite.com` → full hiding. If not, a power user opening devtools sees calls to
   `cal.leadawaker.com`. Decide whether full asset proxying is in scope for v1.
4. **Worker vs fork middleware.** Worker keeps Cal.diy pristine (easier upgrades) but is another moving
   piece in Cloudflare; middleware is one repo but a fork patch. Pick one before building.
5. **Apex vs subdomain.** `book.clientwebsite.com` (subdomain, CNAME-able) is easy. A root apex
   (`clientwebsite.com`) can't CNAME cleanly — out of scope; require a subdomain.
