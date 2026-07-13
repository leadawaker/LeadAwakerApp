# Action Required: Billable Bookings Billing

Manual steps that must be completed by a human.

## Before Implementation
- [x] **Decide: do cancelled-never-rebooked bookings bill?** - DECIDED 2026-07-13: no. Cancellations (both client- and lead-initiated) now clear `billable_booking` in the engine, matching the no-show claim behavior. A rebook re-bills automatically via BOOKING_CREATED.

## During Implementation
- No manual steps; DDL is agent-runnable (direct pg script, search_path gotcha documented in the plan).

## Pricing model changed mid-build (2026-07-13)
- [ ] **Resolve commission-based pricing model with Finn — tracked as CRM task #702.** The fee is a percentage of the client's quote value per booking (e.g. 3% of a solar quote), not a flat euro amount per booking. Open questions: % of every quote vs. % of average quote; where the quote amount gets entered (new Leads field proposed, not built); whether the % is account-wide or can vary per lead. Until resolved:
  - `Accounts.price_per_booking` (flat-rate column) is unused — removed from all UI.
  - The Accounts-page panel was changed from a billing-amount panel to an **Invoices panel**: a live mini-view of the account's actual invoices (status, amount, click-through to the Billing page), replacing the booking-count/amount display.
  - The invoice "Generate from bookings" flow still works but only pre-fills description + quantity (booking count) for the picked month; unit price and amount are left blank for manual entry.
  - The booking-stats endpoint, per-lead breakdown on invoice detail, and pending/duplicate-period warnings are unaffected — all still count-based, not amount-based.

## After Implementation
- [ ] **When #702 is resolved, rework the amount math** in `getAccountBookingStats` (server/storage/billing.ts) and the invoice generator to use the new commission model instead of count × flat rate.
