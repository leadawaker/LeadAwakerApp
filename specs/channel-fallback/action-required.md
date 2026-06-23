# Channel Fallback (SMS + Email) — Action Required (manual steps)

Steps a human must do that code can't, in rough order. Check off as completed.

## Schema (Phase 0 — parallel schema session owns `shared/schema.ts`)
- [ ] Add `channel_mode` (default `'whatsapp_then_sms'`) + `fallback_channel` (default `'email'`) to
      `Campaigns` via a direct `pg` SQL script (`node --env-file=.env`; db:push has no TTY). Backfill
      existing campaigns to the defaults.

## Email deliverability (so the fallback email actually lands, not spam)
- [ ] Confirm **SPF / DKIM / DMARC** are set for the DIY SMTP sender (`tools/email_service.py`) — a
      fallback email that spam-folders is worse than nothing.
- [ ] Decide the **From identity**: the client's own domain (best deliverability + brand) vs a shared
      Lead Awaker sender. Per-account vs shared SMTP.
- [ ] **Unsubscribe / opt-out** handling for the email channel (compliance).

## Content
- [ ] **en/nl** email opener (subject + body) in Prompt_Library — short, branded, with the unsubscribe
      line. (Campaign content is en/nl only — pt-BR dropped.)

## WhatsApp-undeliverable path (Slice 2 — after WhatsApp sending is live)
- [ ] `/status` receiver endpoint live + Twilio-signature-verified; confirm the provisioned number's
      `statusCallback` points at it (messaging-provisioning Phase 1 already sets the URL).
- [ ] Confirm the exact Twilio "not a WhatsApp user" error codes used for the undeliverable trigger.

## Engine restart
- [ ] `pm2 restart leadawaker-engine --update-env` after the send-path + status-receiver changes
      (engine has `watch:false`; the Express server auto-reloads via pm2 watch).

## Open decisions
- [x] **Default fallback channel = `email`** (NL: low SMS engagement; intakes capture an address).
- [ ] **Fallback trigger:** undeliverable status-callback only, or also a no-`delivered` timeout?
- [ ] **Bumps too, or opener only?** Apply the channel policy to follow-up bumps, or first touch only.
- [ ] **`sms_then_email`** ordering: email only after SMS also fails, or both? (Default: one per
      attempt.)
- [ ] **Email From identity:** client domain vs shared Lead Awaker sender.
