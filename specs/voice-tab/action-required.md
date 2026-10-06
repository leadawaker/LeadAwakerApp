# Action Required: Account Workspace "Voice" Tab

Manual steps that must be completed by a human.

## Before Implementation

- [ ] **Confirm the two defaults:** hours stay only on the Account, and the Bookings tile counts calls with `booked_iso` set (v1).
- [ ] **Review the written spec** (`requirements.md`, `implementation-plan.md`) before the plan is executed.

## During Implementation

- [ ] **Supply Robben's numbers:** the Telnyx number for his line (order and document review stay manual) and the transfer number (his mobile or the person Sophie hands calls to).
- [ ] **Confirm Robben's greeting and after-hours choice** in the wizard (currently "Robben Rosmalen, Sophie here the digital assistant, how can I help you?", after-hours: callback).
- [ ] **Make a live test call** to Robben's number and check KB answers, greeting, extra instructions and a transfer.

## After Implementation

- [ ] **Decide on client editing** of extra instructions (default: agency only).
- [ ] **Decide the v2 booking link** (billable bookings vs calendar booking) so the Bookings tile counts real bookings.
- [ ] **Tell Robben's team** how forwarding to the number works once the line is live (wizard shows the dial codes).
