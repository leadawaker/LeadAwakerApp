# Call costs and reply speed

Built 2026-10-15. Phone calls only (GPT-Live over Telnyx SIP).

## What gets stored

Each phone call's `Voice_Calls` row gets four columns at wrap-up (engine `scripts/migrate_add_voice_call_cost.py`, already run):

| Column | What |
|---|---|
| `usage` jsonb | Raw meters: GPT-Live `session.usage.updated` (its `seconds`), summed backend-model tokens, recap tokens, wall-clock seconds, price-table version, cost per part. |
| `cost_usd` | Total in USD. |
| `latency_ms` | Median gap from the caller's last word to her first word (gaps over 15 s dropped). |
| `latency_p90_ms` | The slow end of the same gaps. |

Pricing lives in one file: `automations/src/automations/voice/call_costs.py`. Because `usage` keeps the raw meters, old calls can be re-priced.

| Part | Price | Status |
|---|---|---|
| gpt-live-1 voice minutes | $0.05/min, billed per second | Confirmed on the OpenAI pricing page |
| Backend model gpt-5.6-terra | $2.00 in, $0.20 cached, $12.00 out per 1M tokens | Confirmed |
| Telnyx Voice API and conference | $0.002 + $0.002 per leg-minute, 2 legs | Confirmed |
| Telnyx transfer | $0.10 each | Confirmed |
| Telnyx NL inbound trunk | $0.01/min | **Estimate.** The real rate needs the Telnyx portal (see action-required.md) |

## Where it shows

- **Accounts > Voice tab > Overview**: under the monthly tiles, a "Reply speed" card for everyone, and "Cost per minute" plus "Cost this month" for the Owner only.
- **Home > Phone tab**: in the small cards under the charts, reply speed for everyone, and cost per minute plus spend for the Owner only.
- The server leaves cost fields out of the response for anyone who is not the Owner (impersonating counts as not the Owner). The client hides the cards when the fields are missing.

## Not covered

- Browser test calls and the public website demo (they have no server-side usage stream).
- WhatsApp and widget text cost (`Interactions.ai_cost` already exists per message).
- Telnyx minutes after a person takes over a transferred call (the AI session has ended, so the clock stops).
