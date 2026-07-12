# Action Required: No-Show Recovery

Manual steps that must be completed by a human.

## Before Implementation
- [x] **Decide the billing rule** - DECIDED 2026-07-12: every claim flips `billable_booking = false`, uniform across all three reasons (implemented in the claim route). A rebook via the recovery ladder arrives as a fresh BOOKING_CREATED which re-sets `billable_booking = true`, so recovered no-shows re-bill automatically; only never-recovered no-shows stay unbilled. Follow-up idea (not built): show claimed no-shows as "not billed (no-show)" in the billing view, and watch per-account claim rates (>25-30% of bookings = conversation).
- [ ] **Decide whether Owner/admin can claim outside the 48h window** - Current spec: hard 409 for everyone. An Owner override is easy to add but changes the dispute story.

## During Implementation
- [ ] **Add the `no_show_checkin` global prompt in Prompt_Library** - Content drafting guidance (en + nl) for the gentle check-in message; can be done by the implementing agent but Gabriel may want to review the tone before it goes live.

## After Implementation
- [ ] **Test the full ladder on campaign 61 with a real booking** - Book, skip the call, claim "simply didn't show", verify check-in arrives, stay silent 24h (or temporarily lower the threshold), verify the booking-link message, then reply and verify the AI resumes normally.
- [ ] **Brief the pilot client** - The button replaces "tell Gabriel"; explain the 48h window and the three reasons.
