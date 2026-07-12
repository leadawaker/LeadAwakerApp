# Action Required: No-Show Recovery

Manual steps that must be completed by a human.

## Before Implementation
- [ ] **Decide the billing rule** - Does a claimed no-show flip `billable_booking = false` on the lead? This is the whole point of the 48h claim window from the billing side, but it is a business decision (and affects revenue reporting). The spec stores the claim either way; the billing flip is one extra line once decided.
- [ ] **Decide whether Owner/admin can claim outside the 48h window** - Current spec: hard 409 for everyone. An Owner override is easy to add but changes the dispute story.

## During Implementation
- [ ] **Add the `no_show_checkin` global prompt in Prompt_Library** - Content drafting guidance (en + nl) for the gentle check-in message; can be done by the implementing agent but Gabriel may want to review the tone before it goes live.

## After Implementation
- [ ] **Test the full ladder on campaign 61 with a real booking** - Book, skip the call, claim "simply didn't show", verify check-in arrives, stay silent 24h (or temporarily lower the threshold), verify the booking-link message, then reply and verify the AI resumes normally.
- [ ] **Brief the pilot client** - The button replaces "tell Gabriel"; explain the 48h window and the three reasons.
