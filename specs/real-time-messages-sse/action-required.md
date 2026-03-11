# Action Required: Real-Time Messages via SSE

## Before Implementation

- [ ] **Confirm Twilio webhook route** — Find where inbound WhatsApp messages are saved on the server (search for `/webhook`, `/twilio`, or `createInteraction` calls outside of `POST /api/interactions`). The agent will need to know this to hook in the broadcast call (Phase 4).

## During Implementation

No blocking manual steps. All changes are in the existing Express + React codebase.

## After Implementation

- [ ] **Test on mobile** — Open the conversations view on your phone, send a WhatsApp message from a test lead, and confirm it appears without refreshing.
- [ ] **Check Pi memory** — SSE keeps HTTP connections open (one per browser tab). On the Raspberry Pi, verify memory usage stays stable with a few concurrent connections (`pm2 monit`).
