# Requirements: Demo Surface Split

## What This Is

One minted demo token currently produces **one lead**, shared by the browser demo page
(`/demo/<token>`) and the WhatsApp demo (`wa.me` link). Whichever surface the prospect
opens first *claims* the session; the other is locked out with a `claimed_by_whatsapp`
error.

This feature replaces that shared-lead / first-writer-wins model with **two independent
leads per token**: one for WhatsApp, one for the browser. Neither can interfere with the
other, and the entire mutual-exclusion mechanism is deleted rather than repaired.

## Why

Reported 2026-08-12 by Gabriel, testing a real prospect link.

The exclusivity is **asymmetric and broken browser-first**:

- **WhatsApp claims first → works.** The browser's next poll sees `phone` attached and
  correctly returns `claimed_by_whatsapp`.
- **Browser claims first → silently broken.** `_claim_for_web` sets
  `channel_identifier = 'web-demo:<token>'` but leaves `phone` NULL. WhatsApp's
  `_claim_demo_lead` only tests `WHERE phone IS NULL` — it never checks whether the
  browser already took the session — so it claims the *same lead* and continues the
  browser's half-finished conversation. The prospect's first WhatsApp message lands on a
  thread that is already one or two turns deep, so the AI replies as if mid-conversation.

The observed symptom: open the browser link, then open WhatsApp, and WhatsApp opens on the
*second* message instead of the opener.

The narrow fix (make WhatsApp always win, lock the browser out harder) was considered and
rejected. It keeps a whole class of cross-surface races alive, makes "restart from the
browser" impossible without a proactive WhatsApp push (which needs an approved Meta
template outside the 24h window and can silently fail), and yanks a live conversation
between surfaces. Splitting the leads removes the shared resource, so there is nothing
left to race over.

## Decisions Made

| Question | Decision |
|---|---|
| One lead or two? | **Two.** `wa-demo:<token>` and `web-demo:<token>`, fully independent. |
| When is the browser lead created? | **Lazily**, on the first browser GET. A prospect who never opens the browser link never gets a second row. |
| Does the browser lead inherit the persona? | **Yes** — campaign, first name, language, `demo_niche` (scenario/company/disclosure) and `demo_invited` are copied from the WhatsApp lead at creation. Both surfaces demo the same configured persona. |
| Does starting in the browser carry over to WhatsApp? | **No.** That continuity is exactly what caused the bug. The two conversations are independent from the first message. |
| Restart budget | **Per lead**, so each surface gets its own `MAX_RESTARTS` (5). Browser testing no longer burns the prospect's WhatsApp restarts. |
| `claimed_by_whatsapp` | **Deleted** from the engine and the page. |

## Acceptance Criteria

- [ ] Opening `/demo/<token>` creates a **separate** lead with `channel_identifier = 'web-demo:<token>'`, leaving the `wa-demo:<token>` lead untouched (no `channel_identifier` rewrite, `phone` still NULL, no Interactions added to it).
- [ ] The browser lead is created with the same `Campaigns_id`, `Accounts_id`, `firstName`, `language`, `demo_niche` and `demo_invited` as the WhatsApp lead.
- [ ] Opening the browser link **first**, exchanging messages, then opening the WhatsApp link starts WhatsApp at the **opener** (turn zero), not mid-conversation.
- [ ] Opening WhatsApp **first**, exchanging messages, then opening the browser link starts the browser at its own opener, and the browser is **not** locked out.
- [ ] Both conversations can run **concurrently** without either seeing the other's messages.
- [ ] Restart works on the browser lead with no `claimed_by_whatsapp` error, at any point, regardless of WhatsApp activity.
- [ ] Two simultaneous first-GETs on the same token produce **one** browser lead, not two.
- [ ] No `claimed_by_whatsapp` code path remains in `web_demo_routes.py` or `demo.html`.
- [ ] The browser lead never receives a WhatsApp message: no bump, no recap message, no vCard, no booking confirmation over WhatsApp transport.

## Related Features / Dependencies

- **`specs/dbr-scoping-mode/`** — the demo persona/scenario system whose `demo_niche` blob the new browser lead must copy.
- **`demo_data_purge.py`** — already purges both prefixes (`_DEMO_PREFIXES = ("wa-demo:", "web-demo:")`). No change needed; the second lead is retained and purged on the same 12-month schedule.
- **`demo_bump_scheduler.py`** — targets `wa-demo:%` only. Correct as-is: browser leads must not get WhatsApp bumps.
- **`demo_recap.py`** — `is_whatsapp_demo()` tests `wa-demo:` specifically, so the browser lead correctly skips the WhatsApp recap *message* and uses the page's recap *panel*.
- **`send_service.py` / `outbound.py`** — already short-circuit `web-demo:` into a synthetic success (no transport). No change needed.
- **`whatsapp_cloud_routes.py`** — `_find_pending_demo_lead_by_token` already matches `wa-demo:<token>` **exclusively**. **No change required on the WhatsApp side at all.**

## Known Consequences (accepted)

1. **Two CRM rows per prospect who tries both surfaces.** Demo leads are unbilled and live
   on the isolated demo account, so this costs nothing operationally. If the duplication
   becomes noisy in the CRM's demo views, a follow-up can group them by token.
2. **Effective restart cap per minted link doubles** (5 per surface rather than 5 shared).
   Acceptable: the cap exists as a cost ceiling on a leaked link, and both leads are still
   individually capped.
3. **No browser → WhatsApp continuity.** Intentional; see Decisions.
