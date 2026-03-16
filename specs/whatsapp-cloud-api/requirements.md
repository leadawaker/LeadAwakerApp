# Requirements: WhatsApp Cloud API Integration

## What It Does

Meta WhatsApp Cloud API integration for Lead Awaker's own outreach pipeline. This sits alongside the existing Twilio integration: Cloud API handles Gabriel's direct outreach (free/near-free), while Twilio remains for multi-tenant client campaigns.

## Why

- Free 1,000 service conversations/month, marketing conversations ~$0.06/conversation in NL
- No vendor dependency for own outreach: direct Meta API, no Twilio middleman
- Enables pre-approved template messages for cold outreach, then 24h free-form window after prospect replies

## Core Functions

1. **Send template messages** to prospects (cold outreach with pre-approved templates + variables)
2. **Send text messages** within the 24h reply window (free-form after prospect responds)
3. **Receive inbound messages** via Meta webhook (prospect replies)
4. **Receive status updates** via Meta webhook (sent, delivered, read, failed)
5. **Token management** via permanent System User token (no short-lived tokens)

## Architecture

- `tools/whatsapp_cloud.py`: service module (send_template_message, send_text_message, parse webhook)
- `src/webhooks/whatsapp_cloud_routes.py`: FastAPI webhook endpoint for Meta callbacks
- Both channels (Cloud API + Twilio) feed into the same `process_inbound` pipeline and Conversations page
- `send_service.py` gains a new `whatsapp_cloud` channel option

## Acceptance Criteria

- [ ] `send_template_message(phone, template_name, language, variables)` sends a template message via Cloud API and returns message ID
- [ ] `send_text_message(phone, text)` sends a free-form text message within 24h window
- [ ] Webhook GET endpoint handles Meta verification challenge
- [ ] Webhook POST endpoint receives inbound messages and routes them through `process_inbound`
- [ ] Webhook POST endpoint receives status updates (sent/delivered/read/failed) and logs them
- [ ] DRY_RUN mode blocks real sends and returns fake message IDs (consistent with Twilio pattern)
- [ ] Config uses `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` env vars
- [ ] `send_service.py` routes `channel="whatsapp_cloud"` to the new service

## Dependencies

- Existing: `tools/twilio_service.py`, `tools/send_service.py`, `src/webhooks/instagram_routes.py` (Meta webhook pattern), `src/automations/inbound_handler.py`
- External: Meta Business Account, WhatsApp Business API app, verified business, approved message templates
