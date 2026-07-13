# Requirements: Billable Bookings Billing

## What & Why

`Leads.billable_booking` is correctly maintained (set true on BOOKING_CREATED, flipped false by the no-show claim feature, rebooks re-bill) but nothing consumes it: the Billing UI never shows it and invoicing is fully manual. This feature makes the flag actionable:

1. **Accounts page panel**: a Billing section on the account detail showing billable bookings for this month and last month (count x rate = amount), plus pending (still inside the 48h no-show claim window) and excluded (no-show claimed) counts.
2. **Rate**: new `Accounts.price_per_booking` field, editable in the account edit UI.
3. **Invoice generation**: "Generate from bookings" in the invoice create flow — pick account + month, server counts finalized billable bookings, pre-fills a draft invoice (period fields set, line item = count x rate). Blocked while any booking in the period is still inside the claim window; warns if an invoice already covers that account + period.
4. **Invoice detail breakdown**: for invoices with a period, the detail panel lists the leads behind the number (billed / excluded with no-show reason) and shows an amber mismatch note if the live count no longer matches the invoiced quantity (e.g., a claim landed after generation).

Everything is Express + React. No Python engine changes.

## Key semantics

- **Period key** = `booked_call_date`: a booking bills in the calendar month the call happened.
- **Final (billable)** = `billable_booking = true` AND `now >= booked_call_date + 48h` (claim window closed).
- **Pending** = `billable_booking = true` AND `now < booked_call_date + 48h` (covers future calls and in-window calls).
- **Excluded** = `no_show = true` (claim flipped `billable_booking = false`).
- Invoice amount is a snapshot at generation; the detail breakdown is live-queried and surfaces drift, it never mutates the invoice.
- Known limitation (accepted): `billable_booking` is a lead-level boolean, not a per-booking event log. A lead who books in June and rebooks in July counts once, in July. A `BookingEvents` log is the future fix if per-booking granularity is ever needed.

## Acceptance criteria

- [ ] Account detail shows this month + last month billable counts, amounts when a rate is set, pending and excluded lines when nonzero, and a "set a rate" hint when `price_per_booking` is empty.
- [ ] `price_per_booking` is editable in the account edit panel and persists.
- [ ] Invoice create flow offers "Generate from bookings" (account + month), pre-filling subtotal/total, line item, and `period_start`/`period_end`.
- [ ] Generation is blocked with an explanatory message while pending bookings exist in the period, and warns on duplicate account + period.
- [ ] Invoice detail panel shows the per-lead breakdown for period invoices and a mismatch note when live billable count != invoiced quantity.
- [ ] All new strings in en + nl (`accounts` and `billing` namespaces); tokens-only styling per UI_STANDARDS.

## Dependencies / related

- Builds on `specs/no-show-recovery/` (claim flow sets `billable_booking=false`; BOOKING_CREATED re-sets true).
- Open semantic question recorded in action-required.md: cancelled-never-rebooked bookings currently keep `billable_booking=true` (engine preserves it on BOOKING_CANCELLED for the durable count), so they would bill.
