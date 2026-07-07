# WhatsApp Quality & Tier Visibility — Action Required (manual steps)

Steps a human must do that code can't, in rough order. Check off as completed.

## Build status
- [x] Built 2026-07-03. Schema migrated on the live DB, engine poller registered on the scheduler
  (hourly) and manually verified end-to-end against the live DB ("0 accounts to check", logged,
  no error). Client merge + UI chip shipped, renders the gray "—" placeholder on every account
  today. Still inert per design — see below.

## Still inert — waiting on messaging-provisioning Phase 2
- [ ] **This feature is inert until `specs/messaging-provisioning/` Phase 2 (WhatsApp sender
      registration) ships and at least one account has a real `whatsapp_sender_sid`.** Today, zero
      accounts qualify — no client campaign is live, and LeadAwaker's own demo campaigns (60, 61)
      use the Meta Business API directly, never a Twilio sender SID. The plumbing is now built and
      running (safe — it's a no-op hourly poll + a gray placeholder chip); it lights up automatically
      the moment the first client number is provisioned, no further code changes needed.

## Schema migration
- [x] Ran `migrate-quality-rating-columns.js` via `node --env-file=.env` against the live DB
      (2026-07-03). All 4 columns confirmed present on `Accounts`.

## First real poll — verify against live data, not just docs
- [ ] The Twilio `v2/Channels/Senders/{Sid}` response shape used in this spec is based on Twilio's
      published docs, not a call we've made against our own account. The **first real poll run**
      against an actual sender SID should be manually eyeballed (log the raw response once) to
      confirm `quality_rating` / `messaging_limit` field names and value formats match what the code
      expects before trusting the diff/alert logic. (Zero-account dry run already verified clean —
      this item is specifically about the first *real* Twilio response shape.)

## Twilio SDK note
- [x] No SDK version bump needed — confirmed the installed `twilio==9.4.3` lacks a typed `v2`
      Channels/Senders wrapper, so the poller calls it via the client's low-level `.request()`
      escape hatch (`tools/twilio_service.get_client()` → `client.request("GET", ...)`). If a future
      SDK upgrade adds a typed resource for this, switching to it is a pure internal refactor of
      `quality_rating_monitor.py`, no schema/API/UI change.

## Open decisions — confirmed 2026-07-03
- [x] **Poll interval**: 3600s (hourly), as proposed. Confirmed by Gabriel.
- [x] **Ordinal downgrade scale**: `unknown < green < yellow < red` (worse = alert-worthy),
      **including** `unknown → red` — a fresh number landing on red still alerts, per Gabriel's call.
- [x] **Notification recipient**: v1 notifies the account owner only (owner-lookup join, same as
      `nightly_summary.py`). Confirmed — no multi-admin fan-out in v1.
