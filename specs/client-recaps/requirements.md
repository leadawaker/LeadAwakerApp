# Requirements: Client Recaps and Instant Alerts

## What and Why

Clients want to know what the AI did for them without opening the CRM. Today nothing reaches them: a phone call's recap is stored in `Voice_Calls.summary` and shown only on the Voice Calls page, and the booking notification at `automations/src/webhooks/booking_routes.py:1047-1098` is in-app only (and skipped for in-chat bookings, see below). The first client is Thijs Robben (Robben Rosmalen, account 53, Dutch, Europe/Amsterdam).

This feature adds two things per account:

1. **Daily recap**: one message a day (default 18:00 in the account's timezone) summarising calls, chats, bookings and what is waiting on the team. Not sent on a day with zero activity.
2. **Instant alerts**: a short message the moment something time-sensitive happens.

Both go out over three channels, each switchable per account: **CRM** (in-app notification), **email** (Resend, through the CRM's branded layout in `server/email.ts`) and **WhatsApp** (Meta-approved utility templates sent from Lead Awaker's own Cloud API number).

## Fixed decisions (Gabriel)

- Recap time per account, default 18:00, editable in the CRM and in the onboarding wizard.
- Channels: CRM, email, WhatsApp. Channels and recipients configurable per account. Robben: email + WhatsApp.
- Email uses the CRM's existing layout in `server/email.ts` via Resend. One layout, no Python copy. The engine's `tools/email_service.py` is not used (port 25 blocked).
- WhatsApp goes out from Lead Awaker's own number (the global Cloud API number in `automations/src/config.py:266`) using UTILITY templates shared by all clients.
- No recap on a day with zero activity.

## Recommended instant-alert set

| Alert type | Instant by default | Why |
|---|---|---|
| `appointment_booked` | Yes | A customer is coming in. Staff plan around it. |
| `appointment_rescheduled` | Yes | The old time is now wrong. Staff may have planned around it. |
| `appointment_cancelled` | Yes | Frees a slot. Only when the **customer** cancelled. A cancel made by the client in the CRM is their own action and is not alerted. |
| `callback_requested` | Yes | A caller is waiting for a phone call. Value drops by the hour. |
| `lead_needs_reply` | Yes | The AI has paused a chat (smart handoff). Until a human answers, nobody replies. Waiting until 18:00 loses the lead. |
| Everything else | No (recap only) | Answered calls with no follow-up, chats the AI handled, new contacts, guardrail pauses. |

Each type has its own toggle per account. `lead_needs_reply` is an addition to Gabriel's draft list: a handoff stops the AI, so the lead hears nothing until someone acts. The chat `[CALLBACK_NOW]` token is **demo-only** (`ai_conversation.py:725-728`: only prompt 93's demo branch emits it), so for real clients "callback requested in chat" is the smart-handoff `first_human_request` / `repeated_human_request` reason, which this spec routes to `lead_needs_reply`.

Guardrail pauses (input/output guardrail, `ai_conversation.py:347`, `:710`, `voice_live.py:292`) go to the recap only: they fire on abusive or odd messages and would make instant alerts noisy.

**Quiet hours** (recommended, default on, 22:00 to 07:00 account time): WhatsApp alerts raised during quiet hours are held and sent at the end of quiet hours. CRM and email alerts are never held.

## Where each event happens (hook points)

| Event | Source | Hook (file:line) |
|---|---|---|
| Booked via booking link | Cal.diy `BOOKING_CREATED` webhook | `automations/src/webhooks/booking_routes.py` `_handle_booking`, right after the "2. Update lead state" block (`:616-668`), **before** the `engine_booked` early return at `:678` |
| Booked in chat (SLOT_SELECTED) | same webhook, payload marked `engine_booked` | same hook as above. Today the in-chat path returns at `:678` and never reaches the existing `booking_confirmed` notify at `:1047`, so clients get nothing for in-chat bookings. |
| Rebook through the link (new uid replaces old) | same webhook, `is_rebook` at `:580` | same hook, raised as `appointment_rescheduled`. The auto-cancel of the old uid is already skipped at `:1293-1316`, so no false cancel alert. |
| Rescheduled (chat or Cal.diy page) | `BOOKING_RESCHEDULED`, `_handle_reschedule` `:1115` | after `apply_event_tags(... "appointment_rebooked")` at `:1238`, before `:1246` |
| Cancelled by the customer | `BOOKING_CANCELLED`, `_handle_cancellation` `:1254` | before `log.info("booking_cancellation.done")` at `:1363`, only when `is_client_cancel` (`:1326`) is false. Read the old time from the lead snapshot (it is cleared in the update). |
| Phone call ended | every voice door converges on `close_out_call` | `automations/tools/db/voice_calls.py:239`, after `finalize_outcome`. Called from `phone_call.py:425` (phone door), `live_voice_routes.py:360` (browser) and `voice_call_sweep.py:52` (abandoned calls). |
| Chat handoff (AI paused) | `notify_manual_takeover` | `automations/src/automations/inbound_handler.py:814`, the single funnel for `ai_conversation.py:347` (input guardrail), `:657` (smart handoff), `:710` (output guardrail) and `conversation/voice_live.py:292`. Add a `trigger` argument so guardrail pauses are recap-only. |
| Recap | new engine job | `automations/src/scheduler/jobs.py`, new interval job next to `nightly_summary` (`:108`) |

### What a phone call raises

Read the closed `Voice_Calls` row (only **Live** calls: port the `isDemoSql` rule from `server/storage/voiceCallsSql.ts:22` to Python).

| Row state | Alert |
|---|---|
| `outcome = 'callback'` (summary intent `callback_now`) | `callback_requested` |
| summary has intent `leave_message` | `callback_requested` |
| `transfer_outcome = 'failed'` | `callback_requested` (they wanted a person and nobody picked up) |
| `outcome = 'booked'` | `callback_requested` with "wants an appointment: {slot}" (see warning) |
| `outcome = 'transferred'`, `hung_up`, `other` | none, recap only |

**Warning (found while writing this spec):** the phone door's booking is demo-only. `voice/booking_tool.py:277` `_book()` resolves a slot without touching any calendar, and `phone_call.py:293-307` tells the caller "booked". On Robben's live line a caller who books hears a confirmation, but nothing lands in his calendar. Until real voice booking exists, the alert must say "wants an appointment, please confirm", never "booked". When real voice booking is built it will fire the Cal.diy webhook, and the alert comes from there automatically.

## Data model

### Per-account settings

Stored in `Account_Communication_Profile.setup` (jsonb), so the wizard and the CRM card edit one source. Recap on/off and time already exist in the wizard as `setup.handoff.recap` (default `true`) and `setup.handoff.recapTime` (default `"18:00"`), see `communication/setupConstants.ts:33,51`. They stay there. Everything new goes under `setup.alerts`:

```json
{
  "handoff": { "recap": true, "recapTime": "18:00", "...": "existing keys" },
  "alerts": {
    "language": null,
    "channels": {
      "recap":  { "crm": true, "email": true, "whatsapp": true },
      "alerts": { "crm": true, "email": true, "whatsapp": true }
    },
    "instant": {
      "appointment_booked": true,
      "appointment_rescheduled": true,
      "appointment_cancelled": true,
      "callback_requested": true,
      "lead_needs_reply": true
    },
    "quietHours": { "enabled": true, "from": "22:00", "to": "07:00" },
    "includePhoneInWhatsApp": true,
    "recipients": {
      "emails": [{ "address": "poaa@robbenrosmalen.nl", "name": "Thijs" }],
      "whatsapp": [{ "number": "+31612345678", "name": "Thijs", "optedInAt": "server-set", "optedOutAt": null }]
    }
  }
}
```

| Field | Rule |
|---|---|
| Timezone | `Accounts.timezone` (IANA, default `Europe/Amsterdam`). No separate field. |
| `recapTime` | `HH:MM`, 24h, local to the account timezone. |
| `language` | `nl`, `en`, `pt` or `null`. `null` means derive from `Accounts.language` (`nl`/`Dutch` to `nl`, `pt`/`Portuguese` to `pt`, else `en`). |
| `recipients.emails` | max 5, valid address, name optional. |
| `recipients.whatsapp` | max 3, E.164 (normalised server-side), **name required** (used as `{{1}}` in every template), `optedInAt` set server-side with `new Date()` when the "agreed to receive WhatsApp updates" box is ticked. A number without `optedInAt` or with `optedOutAt` is never messaged. |
| Defaults for a new block | CRM on, email and WhatsApp off until a recipient is added, all five instant types on, quiet hours on. |

Writes go through a new merge route (pattern: `server/storage/voiceLines.ts:287`, merge the patch into `setup`, never replace), so a wizard save cannot wipe `alerts` and the card cannot wipe the wizard's keys.

### Event ledger: new table `Client_Alert_Log` (engine-owned migration)

One row per business event, whether or not an instant alert is enabled. The recap reads its booking and handoff lists from here, and the unique key is what makes every send idempotent.

| Column | Type | Notes |
|---|---|---|
| `id` | serial | |
| `accounts_id` | int not null | |
| `leads_id` | int null | |
| `voice_call_id` | text null | `Voice_Calls.call_id` |
| `kind` | text | `event`, `recap`, `reply` |
| `event_type` | text | one of the five alert types, `guardrail_pause`, `daily_recap`, `client_reply` |
| `dedup_key` | text **unique** | see Idempotency |
| `payload` | jsonb | rendered facts: name, time ISO, phone, source, reason, counts, window |
| `instant` | bool | whether this row was alerted instantly |
| `deliveries` | jsonb | `[{channel, to, status, providerId, error, attempts, at}]`, status `pending`, `sending`, `sent`, `delivered`, `read`, `failed`, `held`, `skipped` |
| `link_code` | text unique | the `/go/{code}` suffix |
| `window_start`, `window_end` | timestamptz | recap rows only |
| `created_at`, `updated_at` | timestamptz | server `now()` |

## CRM notification types

| Type | New? | Recipients |
|---|---|---|
| `booking_confirmed` | existing, now fired for in-chat bookings too | Viewer users on the account + agency Owner/Admin (as today at `booking_routes.py:1056-1097`) |
| `booking_rescheduled` | new | same |
| `booking_cancelled` | new | same |
| `callback_requested` | new | same |
| `lead_manual_takeover` | existing (`inbound_handler.py:849`), recipients widened from owner-only to all Viewer users | same |
| `daily_recap` | new | Viewer users on the account only (agency does not need a recap per client) |

These go through the existing Python `notify()` (`tools/notification_service.py`) with the email channel forced off, so a user with personal email notifications on does not get a second email next to the account recipients' email. The old notify block at `booking_routes.py:1047-1098` is folded into the new module (one creator per event).

## Recap content

Window: from the previous recap row's `window_end` (sent or skipped) to now, capped at 48 hours. The first ever recap uses the last 24 hours.

| Section | Source | In email | In WhatsApp |
|---|---|---|---|
| Calls answered | Live `Voice_Calls` started in window | count, outcome split, list (time, name or "unknown caller", phone, one-line outcome from `summary.outcome`), max 15 + "and N more" | count |
| Conversations | distinct leads with inbound `Interactions` in window (not voice threads, not demo campaigns) | count + new contacts count | count |
| Appointments | ledger `appointment_*` rows in window | list: date/time, name, phone, source, booked/moved/cancelled | count of new bookings |
| Waiting on you | ledger `callback_requested` in window + open handoffs (lead still `manual_takeover`, no human outbound since the ledger row) | list: name, phone, what about, since when | count |
| Tomorrow | leads with `booked_call_date` tomorrow (local) | list | no |
| Links | `/go/{code}` to the recap, each item links to its lead or call | yes | one button |

Recap is sent only when calls + conversations + appointment events + callbacks + new handoffs in the window is greater than 0. Open items from earlier days alone do not trigger a recap (otherwise one forgotten handoff sends a recap every day). The recap is deterministic: no LLM sentence, so nothing in it can be invented.

## Email content

Rendered by Express with the shared branded layout from `server/email.ts`. Every email: heading, a short facts block, a button "Open in Lead Awaker" to the `/go/{code}` link, and a footer line "You get this because {account} set up updates in Lead Awaker" with a link to the settings.

### Subject lines

| Type | EN | NL | PT-BR |
|---|---|---|---|
| Daily recap | Daily recap for {account}, {date} | Dagoverzicht {account}, {date} | Resumo do dia de {account}, {date} |
| Booked | New appointment: {name}, {time} | Nieuwe afspraak: {name}, {time} | Novo agendamento: {name}, {time} |
| Rescheduled | Appointment moved: {name}, now {time} | Afspraak verzet: {name}, nu {time} | Agendamento remarcado: {name}, agora {time} |
| Cancelled | Appointment cancelled: {name}, {time} | Afspraak geannuleerd: {name}, {time} | Agendamento cancelado: {name}, {time} |
| Callback | Call back: {name} ({phone}) | Terugbelverzoek: {name} ({phone}) | Retornar ligação: {name} ({phone}) |
| Needs reply | Reply needed: {name} | Reactie nodig: {name} | Resposta necessária: {name} |

Alert emails carry the full facts (full name, phone, old and new time for a reschedule, the call's outcome line and interest items, the last inbound message for a handoff, max 300 chars). Email is where detail lives; WhatsApp carries the minimum.

## WhatsApp templates

### Rules applied to every template

- Category **UTILITY**. Wording is factual, about a specific event on the recipient's own account. No adjectives like "great", no offers, no emojis, no calls to buy, or Meta reclassifies to MARKETING (about 3x the price).
- Languages: `nl`, `en`, `pt_BR`, same template name, three translations.
- Positional variables `{{1}}`...`{{n}}`. Never the first or last token of the body: every body starts with a greeting word and ends with a static sentence.
- Variable values are sanitised by the engine: no newline, no tab, no run of 4+ spaces, trimmed, max 80 chars, never empty (fallbacks below).
- Variable-to-text ratio kept low: 4 to 6 variables in 30+ words of fixed text.
- Header: static text, no variable (max 60 chars). Footer: `Lead Awaker`.
- One button: **URL**, dynamic suffix. Base `https://app.leadawaker.com/go/{{1}}`, suffix is the ledger row's opaque `link_code` (8 chars). Button text max 25 chars: EN "Open in Lead Awaker", NL "Openen in Lead Awaker", PT "Abrir no Lead Awaker". Sample URL for review: `https://app.leadawaker.com/go/k7Q2mX9a`.
- `{{1}}` is always the recipient's name from the settings (name is required, so no fallback needed).

### Why lists go in the email

A template variable cannot hold a newline, and a body has a fixed number of variables. Three bookings cannot become three lines, and cramming them into one variable ("Jan 14:00, Piet 15:30, ...") makes a run-on line, trips the 80-char cap, raises the variable ratio and invites rejection or reclassification. So the WhatsApp recap carries **counts plus a link**, and the email (or the CRM page behind the button) carries the names and times.

### 1. `la_daily_recap`

| | Value |
|---|---|
| Header | EN "Daily recap" / NL "Dagoverzicht" / PT "Resumo do dia" |
| Variables | 1 recipient name, 2 account name, 3 calls answered, 4 conversations, 5 new appointments, 6 waiting on your team |
| Samples | Thijs, Robben Rosmalen, 7, 4, 2, 1 |

- **EN:** Hi {{1}}, here is today's update for {{2}}. Calls answered: {{3}}. Conversations handled: {{4}}. New appointments: {{5}}. Waiting on your team: {{6}}. Names, times and all details are in Lead Awaker.
- **NL:** Hoi {{1}}, hier is de update van vandaag voor {{2}}. Telefoontjes beantwoord: {{3}}. Chats afgehandeld: {{4}}. Nieuwe afspraken: {{5}}. Wacht op jullie team: {{6}}. Namen, tijden en alle details staan in Lead Awaker.
- **PT:** Olá {{1}}, aqui está o resumo de hoje de {{2}}. Ligações atendidas: {{3}}. Conversas atendidas: {{4}}. Novos agendamentos: {{5}}. Aguardando sua equipe: {{6}}. Nomes, horários e todos os detalhes estão no Lead Awaker.

### 2. `la_appointment_booked`

| | Value |
|---|---|
| Header | EN "New appointment" / NL "Nieuwe afspraak" / PT "Novo agendamento" |
| Variables | 1 recipient, 2 account, 3 customer (first name + last initial), 4 date and time, 5 booked through |
| Samples | Thijs, Robben Rosmalen, Jan de V., do 16 okt 14:30, telefoon |

- **EN:** Hi {{1}}, a new appointment was booked for {{2}}. Customer: {{3}}. Date and time: {{4}}. Booked through: {{5}}. Tap the button below to see the booking.
- **NL:** Hoi {{1}}, er is een nieuwe afspraak ingepland voor {{2}}. Klant: {{3}}. Datum en tijd: {{4}}. Geboekt via: {{5}}. Tik op de knop hieronder om de afspraak te bekijken.
- **PT:** Olá {{1}}, um novo horário foi agendado para {{2}}. Cliente: {{3}}. Data e hora: {{4}}. Agendado por: {{5}}. Toque no botão abaixo para ver o agendamento.

`{{5}}` values: EN phone call / WhatsApp chat / website chat / booking page; NL telefoon / WhatsApp-chat / websitechat / boekingspagina; PT ligação / conversa no WhatsApp / chat do site / página de agendamento.

### 3. `la_appointment_rescheduled`

| | Value |
|---|---|
| Header | EN "Appointment moved" / NL "Afspraak verzet" / PT "Agendamento remarcado" |
| Variables | 1 recipient, 2 account, 3 customer, 4 new date and time |
| Samples | Thijs, Robben Rosmalen, Jan de V., vr 17 okt 10:00 |

- **EN:** Hi {{1}}, an appointment for {{2}} was moved to a new time. Customer: {{3}}. New date and time: {{4}}. Tap the button below to see the updated booking.
- **NL:** Hoi {{1}}, een afspraak voor {{2}} is verzet naar een nieuw moment. Klant: {{3}}. Nieuwe datum en tijd: {{4}}. Tik op de knop hieronder om de gewijzigde afspraak te bekijken.
- **PT:** Olá {{1}}, um agendamento de {{2}} foi remarcado para um novo horário. Cliente: {{3}}. Nova data e hora: {{4}}. Toque no botão abaixo para ver o agendamento atualizado.

The old time is left out on purpose: when the AI already processed a chat reschedule, the lead snapshot already holds the new time, so the old one is not always known. The email shows it when known.

### 4. `la_appointment_cancelled`

| | Value |
|---|---|
| Header | EN "Appointment cancelled" / NL "Afspraak geannuleerd" / PT "Agendamento cancelado" |
| Variables | 1 recipient, 2 account, 3 customer, 4 the cancelled date and time |
| Samples | Thijs, Robben Rosmalen, Jan de V., do 16 okt 14:30 |

- **EN:** Hi {{1}}, an appointment for {{2}} was cancelled by the customer. Customer: {{3}}. It was planned for {{4}}. Tap the button below to see the conversation.
- **NL:** Hoi {{1}}, een afspraak voor {{2}} is door de klant geannuleerd. Klant: {{3}}. De afspraak stond gepland op {{4}}. Tik op de knop hieronder om het gesprek te bekijken.
- **PT:** Olá {{1}}, um agendamento de {{2}} foi cancelado pelo cliente. Cliente: {{3}}. Estava marcado para {{4}}. Toque no botão abaixo para ver a conversa.

### 5. `la_callback_requested`

| | Value |
|---|---|
| Header | EN "Callback request" / NL "Terugbelverzoek" / PT "Pedido de retorno" |
| Variables | 1 recipient, 2 account, 3 caller name, 4 phone, 5 what about |
| Samples | Thijs, Robben Rosmalen, Jan de Vries, +31 6 1234 5678, proefrit Audi A4 zaterdag |

- **EN:** Hi {{1}}, someone who called {{2}} would like a call back. Name: {{3}}. Phone: {{4}}. About: {{5}}. Please call them back as soon as you can.
- **NL:** Hoi {{1}}, iemand die {{2}} belde wil graag teruggebeld worden. Naam: {{3}}. Telefoon: {{4}}. Onderwerp: {{5}}. Bel diegene zo snel mogelijk terug.
- **PT:** Olá {{1}}, uma pessoa que ligou para {{2}} pediu um retorno. Nome: {{3}}. Telefone: {{4}}. Assunto: {{5}}. Retorne a ligação assim que puder.

Fallbacks: no name: EN "not given" / NL "niet genoemd" / PT "não informado". No phone or `includePhoneInWhatsApp = false`: EN "see Lead Awaker" / NL "zie Lead Awaker" / PT "veja no Lead Awaker". No interest: EN "not clear from the call" / NL "niet duidelijk uit het gesprek" / PT "não ficou claro na ligação". A voice "booking" becomes `{{5}}` = "wants an appointment: Thu 14:00, please confirm" (localised).

### 6. `la_lead_needs_reply`

| | Value |
|---|---|
| Header | EN "Reply needed" / NL "Reactie nodig" / PT "Resposta necessária" |
| Variables | 1 recipient, 2 account, 3 customer, 4 reason |
| Samples | Thijs, Robben Rosmalen, Jan de V., vroeg om een medewerker |

- **EN:** Hi {{1}}, a conversation for {{2}} needs a reply from your team. Customer: {{3}}. Reason: {{4}}. The assistant has paused this chat, so tap the button below to answer.
- **NL:** Hoi {{1}}, een gesprek voor {{2}} heeft een reactie van jullie team nodig. Klant: {{3}}. Reden: {{4}}. De assistent heeft deze chat gepauzeerd, dus tik op de knop hieronder om te antwoorden.
- **PT:** Olá {{1}}, uma conversa de {{2}} precisa de uma resposta da sua equipe. Cliente: {{3}}. Motivo: {{4}}. A assistente pausou esta conversa, então toque no botão abaixo para responder.

`{{4}}` values (from `handoff_reason`): human request: "asked to speak to a person" / "vroeg om een medewerker" / "pediu para falar com uma pessoa"; `knowledge_gap`: "a question the assistant could not answer" / "een vraag die de assistent niet kon beantwoorden" / "uma pergunta que a assistente não soube responder"; `circular_conversation`: "the conversation was going in circles" / "het gesprek liep in rondjes" / "a conversa estava andando em círculos"; unknown: "the assistant paused the chat" / "de assistent heeft de chat gepauzeerd" / "a assistente pausou a conversa".

## When a client replies to a WhatsApp alert

- The reply lands on Lead Awaker's Cloud API webhook. Today `whatsapp_cloud_routes.py:333` hardcodes `account_id = 1` and runs every inbound through the lead pipeline, so **without a guard the demo/sales AI would answer Thijs as if he were a prospect**. A new early branch (after the VIP slash-command check at `:342`, before the demo-token logic) recognises a sender that is an opted-in alert recipient and takes it out of the AI pipeline.
- Excluded from the branch: VIP phones (Gabriel and Danique keep their demo commands) and messages carrying a demo token (a recipient trying the demo still gets the demo).
- `STOP` (also `stop`, `uit`, `afmelden`, `parar`, `sair`) sets `optedOutAt` on that number in every account and sends one free-form confirmation (allowed: the reply opened the 24-hour customer service window).
- Any other text: stored as a `client_reply` ledger row, an in-app + Telegram notification to the agency Owner ("Thijs (Robben Rosmalen) replied: ..."), and at most one free-form auto-reply per 24 hours per number: "Thanks. This number only sends updates from Lead Awaker. Gabriel has your message and will get back to you." (EN/NL/PT).
- The 24-hour window it opens is not used for anything else. Alerts keep going out as templates either way, so behaviour does not depend on window state.

## Idempotency (never double-send)

- Every event and recap claims a ledger row with `INSERT ... ON CONFLICT (dedup_key) DO NOTHING RETURNING id`. Only the inserting caller dispatches.

| Event | `dedup_key` |
|---|---|
| Booked | `booked:{booking_uid}` |
| Rescheduled | `rescheduled:{booking_uid}:{new_start_iso}` |
| Cancelled | `cancelled:{booking_uid}` |
| Phone callback | `callback:call:{call_id}` |
| Chat handoff | `handoff:{lead_id}:{local_date}` (max one per lead per day, also an anti-spam cap) |
| Recap | `recap:{account_id}:{local_date}` |

- Each delivery moves `pending` to `sending` by an atomic jsonb update before the provider call, then to `sent` or `failed`. A delivery stuck in `sending` for 10+ minutes (crash after Meta accepted) is marked `unknown` and **not retried**: a missed alert is better than a duplicate.
- Email retries pass `Idempotency-Key: {ledger_id}:{address}` to Resend (supported for 24h), so a retry after a timeout cannot double-send.
- Cal.diy firing `BOOKING_CREATED` twice within milliseconds (`booking_routes.py:690-697`) is covered by the uid key.

## Timezone and DST

- All local times use `zoneinfo` with `Accounts.timezone`. The server runs in Europe/Amsterdam, but no logic relies on that.
- The recap job runs every 5 minutes. It sends when local time is at or past `recapTime`, no recap row exists for today's local date, and local time is within 3 hours after `recapTime` (catch-up after engine downtime). "At or past" means a time skipped by a DST jump still fires, and the per-local-date key means a repeated hour cannot fire twice.
- A recap missed beyond the catch-up window is logged as skipped. The next recap's window still starts at the last `window_end`, so nothing is lost (48h cap).
- Times in messages: 24h clock, short weekday, in the recipient language and account timezone (e.g. "do 16 okt 14:30", "Thu 16 Oct 14:30", "qui 16 out 14:30").

## Failure handling and logging

- Every step logs to `Automation_Logs` via `AsyncLogStep` (workflow `client_alerts`, steps `record_event`, `send_whatsapp`, `send_email`, `notify_crm`, `build_recap`).
- WhatsApp: transient errors (HTTP 5xx, timeout, `130429` rate limit) retry at 5, 15 and 45 minutes. Permanent errors (`131026` not on WhatsApp, `100` invalid parameter, `132001` template missing for that language, `132000` param count mismatch) are not retried. For `132001` in `nl` or `pt_BR`, retry once in `en`.
- Meta delivery statuses (`whatsapp_cloud_routes.py:298` `_process_status_updates`) update the matching delivery to `delivered`, `read` or `failed` by message id.
- Email: Express returns per-address results; failures retry on the same schedule. Resend falls back to SMTP inside `deliver()` already.
- A recap that failed on every channel, or 3+ failed alerts for one account in a day, raises one `critical_automation_failure` notification to the agency (max one per account per day).
- One channel failing never blocks the others.

## Cost (WhatsApp, NL)

- Meta charges per delivered template. Netherlands utility rate: about **$0.057 per message** (third-party rate card read 2026-10, verify on Meta's page). Marketing is about $0.18, which is why staying in UTILITY matters.
- Reported change from 2026-10-01: utility templates inside an open 24h window are no longer free, and service replies are free only up to 1,000 per number per month. Treat every alert as billed.
- Robben estimate, 2 WhatsApp recipients: about 22 recaps (active days) + about 60 alerts a month = 82 sends x 2 = 164 messages, roughly **$9 a month**. One recipient: about $5.
- Email through Resend: inside the free tier at this volume.

## Privacy (minimum lead data in WhatsApp)

- WhatsApp carries: first name + last initial, appointment time, source, and for a callback only the phone number (switchable with `includePhoneInWhatsApp`) and a short "about" line. No email addresses, no message content, no transcript, no address.
- Full details sit behind the `/go/{code}` link, which requires a CRM login and checks the user's access to that account. The code is opaque (8 random chars), not a lead id.
- Email carries full details (the client's own data to the client's own address).
- Recipients are explicit and opted in (`optedInAt`). STOP is honoured.
- The client is the data controller; Lead Awaker processes on their behalf. These alerts are within the purpose the client set up (being told about their own customers).

## Overlap with `nightly_summary`

`automations/src/automations/nightly_summary.py` runs at 00:00 server time (`jobs.py:108`). Per **active campaign** (not per account) it gathers pipeline and 24h message stats, asks Groq for a one-sentence summary, stores it on `Campaigns.ai_summary`, and sends an in-app `campaign_summary` notification to the account owner. It does not cover phone calls, sends no email or WhatsApp, and does nothing for an account without an active campaign (Robben's receptionist line).

Overlap is small. Keep it for `Campaigns.ai_summary` (the Campaigns page reads it), but skip its in-app notification for accounts whose daily recap is on, so the client gets one daily message, not two.

## Acceptance Criteria

- [ ] An account with recap on, email + WhatsApp on and one recipient each gets exactly one recap per active day at its local recap time, on both channels, and none on a day with zero activity.
- [ ] Changing the recap time in the CRM card or the wizard changes the next send; both read and write the same `setup.handoff` keys.
- [ ] An in-chat booking, a link booking, a reschedule and a customer cancel each produce exactly one alert per enabled channel and recipient, even when Cal.diy fires the webhook twice.
- [ ] A client-initiated cancel (CRM button) produces no alert.
- [ ] A phone call ending with a callback request, a left message, a failed transfer or a voice "booking" produces one `callback_requested` alert. Demo calls never alert.
- [ ] A smart handoff produces one `lead_needs_reply` alert per lead per day. Guardrail pauses appear only in the recap.
- [ ] Each alert type can be switched off per account. Each channel can be switched off separately for recaps and alerts.
- [ ] WhatsApp alerts raised during quiet hours go out at the end of quiet hours. Email and CRM are not held.
- [ ] A reply from a recipient never reaches the AI; STOP opts the number out.
- [ ] All six templates are approved as UTILITY in nl, en and pt_BR before WhatsApp sending is switched on.
- [ ] The button opens the right lead, call or calendar in the CRM after login.
- [ ] Every send attempt is visible in Automation Logs, and failures reach the agency without spamming.

## Out of Scope

- Per-client WhatsApp sender numbers (alerts always come from Lead Awaker's number).
- Real calendar booking from the phone line (flagged above; separate spec).
- Weekly or monthly reports, AI-written recap prose.
- Client self-serve editing of recipients (v1 is agency-edited; see open questions).
- SMS as an alert channel.

## Open questions for Gabriel

1. Phone number in the WhatsApp callback alert: recommended **on** (the whole point is to call back from the phone). Off means staff must log in to see it.
2. Quiet hours 22:00 to 07:00 for WhatsApp only, default on: OK?
3. `lead_needs_reply` instant by default: OK? (It is the one addition to your list.)
4. Who edits the settings: recommended agency only for v1, clients see them read-only.
5. Should the agency (you) get a copy of each client's recap by email? Recommended no; you already get in-app booking notifications.
