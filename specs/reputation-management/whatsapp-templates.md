# Reputation — WhatsApp Template Content (en / nl)

> **Ownership:** the reputation spec owns this **content**; `specs/messaging-provisioning/` owns
> *registering* it with Twilio/Meta and storing the approved SIDs. Built together with
> messaging-provisioning Phase 2 (the send-path is dormant until a client's WhatsApp sender +
> approved templates exist). Campaigns are **en + nl only** (pt-BR dropped 2026-06-22).

## Why two templates (and only two)

| Message | When | Channel mechanics | Meta approval? | Template? |
|---|---|---|---|---|
| **Cold opener** ("how was it?") | business-initiated, no open session | out-of-24h-window → must be an approved template | **Yes** (per client's WhatsApp sender) | **Template A** |
| **Negative reply** (apology + "Yes, connect me" button + review link) | in-session (customer just replied) | in-session, but a quick-reply **button** still needs a Twilio Content Template | No (in-session) | **Template B** |
| Positive review-ask (sends the review link) | in-session | free text | No | none |
| Neutral thank-you | in-session | free text | No | none |

Only the cold opener needs Meta approval. The button reply needs a Twilio **Content Template**
(for the quick-reply button) but not Meta approval since it's in-session.

## Template A — cold-open feedback ask (approved template)

- **Twilio Content type:** `twilio/text` (plain). **Meta category:** Marketing (it's a non-transactional
  follow-up — confirm at submission).
- **Variables:** `{{1}}` = customer first name, `{{2}}` = business name.
- **SID storage:** `Campaigns.twilio_first_message_template_sid` (populated by messaging-provisioning).

**en:** `Hi {{1}}! Thanks for choosing {{2}}. We'd love to know: how was your experience with us?`
**nl:** `Hoi {{1}}! Bedankt dat je voor {{2}} hebt gekozen. We horen graag: hoe was je ervaring bij ons?`

## Template B — negative reply with manager button (Content Template, in-session)

- **Twilio Content type:** `twilio/quick-reply`. One quick-reply button.
- **Variables:** `{{1}}` = customer first name, `{{2}}` = the account's `google_review_url`.
- **Quick-reply button:** title `Yes, connect me` (en) / `Ja, verbind me` (nl); button id/payload
  `reputation_connect_manager` (so a tap is recognizable in the inbound webhook body).
- **SID storage:** new field **`Campaigns.reputation_button_template_sid`** (to be added when the
  send-path is built — does NOT exist yet; flag for the schema-owning session).
- **Compliance:** the review link `{{2}}` is included for unhappy customers too. We resolve privately
  (manager alert + handoff) but never *withhold* the public-review path by sentiment (no review gating).

**en body:** `I'm really sorry your experience fell short, {{1}}. We'd like to make it right — tap below and someone from our team will reach out personally. If you'd like, you're also welcome to share your honest feedback here: {{2}}`
**nl body:** `Wat vervelend dat je ervaring tegenviel, {{1}}. We zetten dit graag recht — tik hieronder en iemand van ons team neemt persoonlijk contact op. Als je wilt, mag je je eerlijke feedback ook hier delen: {{2}}`

## Send-path wiring (build WITH messaging-provisioning Phase 2)

- **Cold opener** (`reputation_scheduler.py`): when the campaign channel is Twilio `whatsapp` and
  `twilio_first_message_template_sid` is set, send via `send_message(..., whatsapp_template_sid=<sid>,
  whatsapp_template_variables={"1": first_name, "2": business})` — `send_message` already routes
  out-of-session WhatsApp to `send_whatsapp_template`. Falls back to the baked free-text default
  otherwise (current behaviour).
- **Negative reply** (`reputation_handler.py`): when `reputation_button_template_sid` is set, call
  `twilio_service.send_whatsapp_template(content_sid=<sid>, content_variables={"1": first_name,
  "2": review_url}, ...)` directly (the unified `send_message` sends free text in-session, so the
  button needs the direct template call). Falls back to the current de-gated free-text ack (review
  link already appended) otherwise.
- A `Yes, connect me` tap returns as an inbound message; since the lead is already
  `manual_takeover=True` (set on negative), it lands in the human inbox — no extra engine handling
  needed for v1.

## Dependencies before this can run

1. `messaging-provisioning` provisions the client's Twilio sender + registers Template A (Meta approval).
2. Add `Campaigns.reputation_button_template_sid`; create Template B in the client's Twilio account.
3. Then wire the two send-path branches above (small, additive; reuses existing send helpers).
