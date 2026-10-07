# Action Required: Public Website Demo

Manual steps that must be completed by a human.

## Before Implementation
- [ ] **Create a separate OpenAI project "Public demo" with a hard monthly budget (suggested EUR 100) and an API key** - This is the backstop: even if our own limits fail, OpenAI stops spending at that amount. Put the key in the engine `.env` and the CRM `.env` as `OPENAI_PUBLIC_DEMO_API_KEY`.
- [ ] **Create a Cloudflare Turnstile widget for leadawaker.com (and www)** - Free bot check on the form. Put the site key in the import script config and the secret in the CRM `.env` as `TURNSTILE_SECRET_KEY`.
- [ ] **Confirm the daily budget (default EUR 10) and the daily demo cap (default 40)** - Both are editable later in the CRM, this only sets the starting values.
- [ ] **Pick the phone number shown as "Or call her"** - Which `Voice_Numbers` line is the public demo line. It must not be a client's line. Unknown callers on it will get a 2-minute capped default demo.

## During Implementation
- [ ] **Check campaign 60's booking calendar is the isolated demo calendar (Account 52)** - Public visitors can book one slot in the WhatsApp demo; it must never land in a real calendar.
- [ ] **Review the fixed WhatsApp messages and the voice closing prompt** - They are drafts in the plan (Phase 4 and 5); NL and PT translations need your eye.
- [ ] **Update the privacy policy** - Add that demo visitors' website, phone number and conversation are stored to run the demo and for you to contact them, with the 90-day retention.

## After Implementation
- [ ] **Do the first end-to-end demo with your own phone** - Browser voice, WhatsApp, phone call, then check you got the notification and the task.
- [ ] **Approve the landing section placement and copy in the artifact preview before publishing**
