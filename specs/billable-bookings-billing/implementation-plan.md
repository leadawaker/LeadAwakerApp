# Implementation Plan: Billable Bookings Billing

## Overview

Wire `Leads.billable_booking` into the billing surface: one booking-stats endpoint (count-based: billable/pending/excluded), an Invoices panel on the account detail (built as a live view of actual invoices, not a computed billing-amount panel — see Phase 3), invoice period fields + generate-from-bookings draft flow (count/period only, amount is manual), and a per-lead breakdown with mismatch note on the invoice detail panel. Cancellations were also made non-billable in the engine. Touches both repos: LeadAwakerApp (schema/routes/UI) and automations (cancellation billing fix). Amount-computation work is blocked on task #702 (commission-based pricing model, pending a decision with Finn).

## Phase 1: Schema + rate field

### Tasks
- [x] Add `price_per_booking` to Accounts and `period_start`/`period_end` to Invoices (DDL below)
- [x] Mirror the three columns in `shared/schema.ts`
- [x] ~~Expose `price_per_booking` in the account edit UI~~ — built, then reverted 2026-07-13 when the pricing model turned out to be commission-based, not flat-rate (see Phase 3 revision + task #702). Column stays in the schema, unused, pending that decision.

### Technical Details

DDL — run with a direct `pg` script via `node --env-file=.env` (`npm run db:push` fails without a TTY on the Pi), and remember `SET search_path TO p2mxx34fvbf3ll6` before the ALTERs or the tables won't resolve:

```sql
ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS price_per_booking numeric;
ALTER TABLE "Invoices"
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;
```

`shared/schema.ts` mirrors:
- accounts (table starts ~line 29): `pricePerBooking: numeric("price_per_booking"),`
- invoices (~line 997, next to `issuedDate`/`dueDate` which already use `date()`): `periodStart: date("period_start"), periodEnd: date("period_end"),`

Account edit UI: before adding the input, check whether the accounts edit flow uses a draft-builder/whitelist pattern (the campaigns settings `buildDraft()` gotcha: fields not whitelisted silently never save). If a similar draft object exists in the accounts dialog/hooks, add `price_per_booking` there too. Input: numeric, currency-prefixed (EUR), placed with account business fields. Label via i18n (`accounts` namespace).

## Phase 2: Booking-stats endpoint

One endpoint serves the accounts panel, the generator, and the invoice breakdown.

### Tasks
- [x] Add `getAccountBookingStats(accountId, months | month)` to `server/storage/billing.ts` and re-export through the `storage` barrel [complex]
- [x] Add `GET /api/accounts/:id/booking-stats` route (query: `months=N` for rolling summary, or `month=YYYY-MM` for a single month incl. per-lead detail)
- [x] Verified BOOKING_CANCELLED: it preserved `billable_booking=true` on both cancel paths ("durable count for billing"). Decided 2026-07-13 that cancellations should NOT bill — engine now clears `billable_booking` on both client- and lead-initiated cancellation (`booking_routes.py` ~1075), matching the no-show claim behavior. Rebooks re-bill via BOOKING_CREATED.

### Technical Details

Route in `server/routes/accounts.ts`, `requireAuth` + scoping like sibling routes (agency `accountsId === 1` sees any account, others only their own).

Classification (single SQL over Leads, `WHERE "Accounts_id" = $1 AND booked_call_date IS NOT NULL` grouped by `date_trunc('month', booked_call_date)`):
- `billable`: `billable_booking = true AND booked_call_date + interval '48 hours' <= now()`
- `pending`: `billable_booking = true AND booked_call_date + interval '48 hours' > now()` (future calls included by design)
- `excluded`: `no_show = true`

Response shape:

```json
{
  "ratePerBooking": 150,
  "months": [
    { "month": "2026-07", "billable": 8, "pending": 2, "excluded": 1, "amount": 1200 }
  ],
  "leads": [
    { "id": 123, "name": "Jan Jansen", "bookedCallDate": "...", "status": "billed|pending|excluded", "noShowReason": "no_reason" }
  ],
  "existingInvoice": { "id": 45, "invoiceNumber": "INV-...", "status": "Draft" }
}
```

`leads` and `existingInvoice` only when `month=` is passed (detail mode). `existingInvoice` = any invoice for this account whose `period_start` falls in the requested month (used for the duplicate warning and the breakdown). `amount` null when rate unset. Timestamps compared in SQL (`now()`), never client-supplied.

## Phase 3: Accounts page Invoices panel (revised 2026-07-13)

Originally planned as a billing-amount panel (count × flat rate). Changed once the pricing model turned out to be commission-based (see action-required.md, task #702) — a flat rate can't produce a meaningful amount. Replaced with a live view of the account's actual invoices instead.

### Tasks
- [x] Built `InvoicesPanel` in `features/accounts/components/workspace/InvoicesPanel.tsx` (the actually-rendered path is the `workspace/` component tree via `OverviewTab.tsx`, not the legacy `AccountDetailView.tsx`) — shows the 3 most recent invoices for the account (title/number, status dot, amount), a count badge, "view all N" link, and click-through to the Billing page (`billing-selected-invoice` localStorage handoff, same pattern as `ContractsPanel`'s `billing-selected-contract`)
- [x] Wired into `OverviewTab.tsx` below `ContractsPanel` in both desktop (right column) and mobile (stacked) layouts
- [x] Removed `price_per_booking` field from the left Account Details panel (`AccountDetailsPanel.tsx`) — no longer meaningful pending #702
- [x] Moved "Opt-out Keyword" into the Notes group (was in Schedule) per Gabriel's request
- [x] i18n strings in `client/src/locales/{en,nl}/accounts.json` (`panels.invoices`, `panels.viewAllInvoices`, `related.noInvoice`, `invoiceStatus.*`)

### Technical Details

- Reused `fetchInvoices(accountId)` from `features/billing/api/invoicesApi.ts` (already parses JSON correctly) instead of a new endpoint.
- The legacy `AccountDetailView.tsx` / `AccountDetailsDialog.tsx` (unreachable dead code, superseded by the `workspace/` tree) also got the same fields added/removed for consistency, but since nothing imports `AccountListView.tsx` (the only consumer of `AccountDetailView`), they have no live effect — left as-is rather than deleted, to avoid unrelated cleanup scope.

## Phase 4: Invoice generation (create flow + period fields) — amount math descoped 2026-07-13

Generation still counts bookings and pre-fills description/quantity/period; it no longer computes unit price or amount (no flat rate to multiply — see task #702). Unit price and amount are left at 0 for manual entry.



### Tasks
- [x] Extend `features/billing/components/InvoiceCreatePanel.tsx` with a "Generate from bookings" mode: account picker + month picker → fetch booking-stats detail → pre-fill title, line item (qty only, unit price/amount left at 0), `period_start`/`period_end` [complex]
  - [x] Pending-block: if `pending > 0` for the chosen month, disable generation and show "N bookings not final until {latest booked_call_date + 48h}"
  - [x] Duplicate warning: if `existingInvoice` returned, show a warning (non-blocking) before create
- [x] Pass the period fields through the existing `POST /api/invoices` (rides the insert schema via `shared/schema.ts`, confirmed working in the dry run)
- [x] i18n strings in `client/src/locales/{en,nl}/billing.json`

### Technical Details

- Line item description pattern: "Booked calls {Month YYYY}" (localized), qty = billable count, unit price/amount = 0 (manual entry — no flat rate to compute from, see task #702).
- Month picker: current + previous 6 months; a full past month is generatable at most 2 days into the next month (once the last call's window closes) — the pending-block enforces this naturally.
- No new POST endpoint: generation is client-side pre-fill from booking-stats + the existing create route.
- Verified live: dry run on account 1, May 2026 → 5 billed leads, draft `INV-LEADAW-002` created with correct period fields; duplicate-warning correctly fired on a second attempt for the same account+period; test invoice deleted after verification.

## Phase 5: Invoice detail breakdown + mismatch note

### Tasks
- [x] In `features/billing/components/workspace/InvoiceDetailPanel.tsx`, add a "Bookings in this period" section, rendered only when `period_start` is set [complex]
  - [x] Lead list: name, call date, status chip (billed / excluded + no-show reason label)
  - [x] Mismatch note (amber, token-based): shown when live `billable` count != invoiced quantity — copy: "Live billable count is {N}, invoiced {M}. A no-show claim may have landed after this invoice was generated."
- [x] i18n strings (same `billing.json` block as Phase 4)

### Verification
- Verified live via playwright-cli against `app.leadawaker.com`: the May 2026 dry-run invoice rendered "Booked calls May 2026, 5 × €150.00 = €750.00" and a "Bookings in this period" list with all 5 leads (Paula, John, Michael, Johan, Sara) tagged BILLED, no mismatch note (5 invoiced = 5 live). Screenshot confirmed placement and styling.

### Technical Details

- Query: `GET /api/accounts/:accountsId/booking-stats?month={period_start YYYY-MM}` keyed `["invoice-booking-breakdown", invoiceId]`.
- The breakdown is read-only and never mutates the invoice; crediting is a human decision.
- Hand-written invoices (no period) render exactly as today.
- Mobile billing view (`mobile/MobileBillingView`): skip the breakdown for now; desktop-only section is acceptable (mirror the no-show feature's mobile deferral).
