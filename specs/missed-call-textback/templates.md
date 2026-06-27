# Missed-Call Text-Back — Opener Templates (Phase 5)

The cold WhatsApp text-back that fires the instant a forwarded call reaches Twilio. Because the caller
has no open 24h session, Meta requires this first touch to be an **approved template** (free text only
after the lead replies). The template is the entire opener; the voicemail transcript (Tier 2) is **never**
put here — it lands as a separate inbound interaction the AI reads on the reply.

## How it wires into the engine

`speed_to_lead.fire_first_touch` (reused, not forked) sends the cold template:

- Body source: the campaign's **`First_Message`** field, rendered by `_render_first_message`.
- Template SID: the campaign's **`twilio_first_message_template_sid`** (the approved Twilio Content SID).
- Variables: **`{"1": first_name or "there"}`** — a single positional var `{{1}}`.

So a `missed_call` campaign carries the exact same fields as a speed-to-lead campaign (no new columns).
Set `campaign_type = 'missed_call'`, paste the approved template SID into
`twilio_first_message_template_sid`, and put the matching body in `First_Message`.

## Variable

| Var | Maps to | Fallback (new caller, no name) |
|-----|---------|--------------------------------|
| `{{1}}` | lead `first_name` | `there` (en) / nothing usable in nl → keep neutral, see below |

A missed-call caller is almost always brand-new (we only have their number), so `{{1}}` will usually be
the fallback. **Write the body so the fallback reads naturally**, i.e. avoid copy that only works with a
real name. The English `there` fallback reads fine ("Hi there"); for Dutch, `daar` does NOT work, so the
Dutch opener is phrased to read cleanly even when `{{1}}` is the fallback (the variable is appended, not
embedded mid-sentence).

## Approved-ready template bodies

Submit these to Meta/Twilio (category: **Utility** — it is a direct response to the customer-initiated
call, not marketing). Keep one template per locale.

### English (`en`)

- **Template name:** `missed_call_textback_en`
- **Category:** Utility
- **Language:** English
- **Body:**
  ```
  Hi {{1}}, sorry we missed your call! 📞 You reached {{2}}. How can we help?
  ```

> Note: if you prefer a single-variable template to match the engine's current `{{1}}`-only send, use the
> simpler body below and hardcode the business name in `First_Message` instead of a variable:
>
> ```
> Hi {{1}}, sorry we missed your call! How can we help?
> ```
>
> This single-`{{1}}` form is the **default** — it matches `whatsapp_template_variables={"1": ...}` with
> no engine change. Use the two-variable form only if you also extend the send to pass `{{2}}` (business
> name); that is an optional enhancement, not required for Phase 5.

### Dutch (`nl`)

- **Template name:** `missed_call_textback_nl`
- **Category:** Utility
- **Language:** Dutch
- **Body (single `{{1}}`, default):**
  ```
  Hoi {{1}}, sorry dat we je oproep misten! Waarmee kunnen we je helpen?
  ```

  With the fallback (`there` → keep neutral), Twilio will substitute the literal fallback string, so set
  the fallback to an empty-friendly value. Recommended `First_Message` rendering: pass `{{1}}` as the
  first name when known, else a neutral token that reads naturally in Dutch. Since `there`/`daar` is
  awkward in Dutch, prefer leaving the greeting name-optional:
  ```
  Hoi{{1}}, sorry dat we je oproep misten! Waarmee kunnen we je helpen?
  ```
  …rendering `{{1}}` as ` {first_name}` (leading space) when known, and `""` when not, so it reads
  "Hoi Jan, …" or "Hoi, …". Pick whichever Meta approves; both are Utility-safe.

## Default copy decision (what to ship)

Ship the **single-variable, name-optional** form per locale (no engine change, reads fine for anonymous
callers):

- **EN `First_Message`:** `Hi {{1}}, sorry we missed your call! How can we help?` with `{{1}} = first_name or "there"`.
- **NL `First_Message`:** `Hoi{{1}}, sorry dat we je oproep misten! Waarmee kunnen we je helpen?` with
  `{{1}} = " " + first_name` when known else `""`.

> The engine currently always renders `{{1}} = first_name or "there"`. For the Dutch name-optional form,
> either (a) accept "Hoi there, …" in Dutch (acceptable, low volume), or (b) add a small per-locale
> fallback in `_render_first_message` later. (a) is fine for Phase 5; (b) is a polish task, not a blocker.

## Approval checklist (manual — see action-required.md)

1. Create both templates in the client's Twilio/Meta WhatsApp sender (Content Template Builder),
   category **Utility**.
2. Wait for Meta approval (can take hours to a day — start early).
3. Copy each approved **Content SID** into the matching `missed_call` campaign's
   `twilio_first_message_template_sid`.
4. Set the campaign's `First_Message` to the exact approved body (so the rendered free-text fallback and
   the CRM display match the template).
5. Verify the campaign also has its persona/agent + channel-fallback fields set, identical to a
   speed-to-lead campaign (it reuses the same columns).
