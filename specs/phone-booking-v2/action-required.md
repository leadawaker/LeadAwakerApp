# Phone booking v2: action required

Built 2026-10-13 (all 12 tasks, each reviewed, plus a whole-feature review and one fix wave, then the replace-cancel budget fix). The engine runs the final code.

## 1. Test call (callbacks): Gabriel

Call Robben's line (+31 73 851 9847) from your own mobile. In one call:

1. Ask for "overmorgen om half elf" (the day after tomorrow at 10:30). Expect a booking on the right day at 10:30 in your calendar.
2. Ask to make it an hour later. Expect "moved", with the calendar entry moved and no second entry.
3. Ask to cancel it. Expect "cancelled", the entry gone, and the client "cancelled" alert email.

Then check the log:

```bash
grep -E "voice\.phone\.tool|backend_said|voice\.booking|booking_changes" ~/.pm2/logs/leadawaker-engine-out.log | tail -30
```

Expected: `check_availability` with a `date`, `book_appointment` with a `start`, one `booking_changes.rescheduled`, one `booking_changes.cancelled`.

The old test booking "Danique" (Wed 14 Oct 10:30, lead 1319) is still in your calendar. A call from +31617862359 will hear about it as an existing appointment. Delete it in Cal.diy when you no longer need it.

## 2. Visits for Robben: ready, waiting on the showroom address

The last blocker is fixed (2026-10-13, engine c488134). When a caller swaps a visit for a callback, the cancel of the old appointment now stays within the 8 s budget and finishes in the background, so a slow Cal.diy no longer drops the caller.

Visits are still off for Robben because the showroom address is not confirmed. "Afrikalaan 17a, 5232 BD 's-Hertogenbosch" is only an open question in `specs/receptionist-channels/robben-number-request.md`, and a wrong address sends customers to the wrong place. Once the address is confirmed:

1. Account 53, Integrations tab, Visits card: switch it on, set the name "Bezichtiging of proefrit", 60 minutes, and the confirmed address. Visits are not offered until the address is filled in.
2. Check that `Calendar_Connections.caldiy_visit_event_type_id` is set for account 53.
3. Make one test visit booking and read it back in Cal.diy. Confirm it has the visit's own length and the showroom address (the engine leaves the location out and relies on the event type's own).
4. Live call: ask to come and see a car on a weekday morning (expect a 60-minute visit), then ask to be called instead (expect the visit replaced by a callback, and her saying so).

## 3. Decisions for Gabriel

- **Visits card is agency-only.** `PATCH /api/accounts/:id` requires an agency login, so a client logging in does not see the card.
- **Switched-off visits can still be booked by direct link.** A switched-off visit type is only hidden in Cal.diy, so `cal.leadawaker.com/<user>/visit` still takes bookings by direct link. The engine stops offering visits. The webhook stays so existing visits can still be moved or cancelled.
- **Hidden test visit type on account 1.** Account 1 keeps a hidden test visit type (event type 11, "Test visit", Teststraat). Delete it in Cal.diy if you do not want it.
- **Reminder wording.** Reminders for a visit still say "call" on the legacy free-text WhatsApp reminder path.
- **Address in writing.** The caller never gets the visit address in writing (no SMS or WhatsApp with it).
- **Visits on but not provisioned.** If visits are on but provisioning failed, the engine silently offers callbacks only.
- **Visit held after visits are switched off.** A caller who still holds a visit after visits were switched off is treated as holding a callback.
- **Alert order.** A "booked" alert held until the call ends can arrive after a "cancelled" alert from the same call.
- **Rate limit for withheld callers.** Withheld callers on the conference route skip the per-caller hourly rate limit. The concurrency cap still applies.
- **Re-picking their own time.** A caller who picks the exact time they already hold is told "booked" without a Cal.diy check. If the client just cancelled that booking in Cal.diy and the webhook is late, that answer is wrong.

## 4. Repo state

- **Pushed.** Everything is pushed (2026-10-13): CRM `main`, and in the engine both `main` and `feature/dbr-scoping-mode` (`main` fast-forwarded to the feature branch).
- **Cal.diy script.** `/home/gabriel/caldiy/scripts/provision-leadawaker-user.ts` carries the visit provisioning, uncommitted on purpose: that repo already had your own local changes. The CRM's provisioning depends on it, so commit it with your Cal.diy changes.
