# Action required: Client Mode

Things only Gabriel can do or confirm.

## Before the invite

- [ ] **Confirm Thijs's login email.** The account email `poaa@robbenrosmalen.nl` came from HubSpot and may be the lease partner's mailbox.
- [ ] **Confirm which leads on account 53 are test data** before they are marked `is_test`. The likely ones:
  - The callers named "Gabriel" (+31737044356).
  - "Dickface Johnson".
  - The "Danique" booking on Wed 14 Oct.
  - Is "Wim van der Zijden" (+31738887883) a real caller or a test?
- [ ] **Decide whether you stay on Robben's recap and alert list.** You are the only recipient today (leadawaker@gmail.com). Thijs adds himself via the checklist.
- [ ] **Restore the handoff number** to Thijs's mobile +31681764763 in the Voice tab when you are happy with the line. It is still your +31684446349 for testing.

## Sending it

- [ ] Settings › Team › Thijs Robben › Resend invite. The link is valid 72 hours, and the email is in Dutch.

## After the build

- [ ] "View as client" (Manager, account 53) on your phone and laptop, in Dutch, and walk the checklist.
- [ ] Review the Leads page in client view once the paged-leads rebuild has landed (out of scope here).
- [ ] Restart leadawaker-engine (pm2) when no call is live, so the recap and alerts skip test data

## Notes from the build

- Home load time: the `/api/home/*` calls answer in about 0.2 s each as Manager 53 (2026-10-19). The 5-9 s "LOADING" seen in the audit came from the Pi dev server compiling the page on first visit, not from the queries. No fix needed.
