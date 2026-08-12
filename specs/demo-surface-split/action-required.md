# Action Required: Demo Surface Split

Manual steps that must be completed by a human.

No API keys, accounts, env vars or schema migrations are needed. The advisory-lock
approach in Phase 1 was chosen specifically to avoid a migration, since
`npm run db:push` needs a TTY and fails in an agent session.

## Before Implementation

- [ ] **Confirm the two-lead direction is still what you want** — this deliberately gives up browser → WhatsApp continuity. A prospect who starts in the browser and moves to WhatsApp begins again from the opener, by design.
- [ ] **Decide whether duplicate demo rows in the CRM are acceptable** — a prospect who tries both surfaces produces two `Leads` rows. Fine on the isolated demo account; say so now if the demo views need them grouped by token instead.

## During Implementation

- [ ] **Verify the `Leads` column names against the live DB** before running the `INSERT` in Phase 1 — the table mixes quoted PascalCase and bare snake_case, and a wrong identifier fails at runtime, not at import. Query is in the plan.

## After Implementation

- [ ] **Run the 6-step manual check in Phase 4** on a freshly minted link — there are no automated tests for this flow.
- [ ] **Re-test with a VIP number** — `_release_vip_test_claim` and the VIP exemption in `whatsapp_cloud_routes.py` still govern the WhatsApp lead. They are untouched here, but confirm your own number can still test a link without burning it.
- [ ] **Push the CRM change to `main`** — `demo.html` only reaches `leadawaker.com` via a Vercel deploy from `main`; the Pi's live tree does not serve the public page. (This is what caused the 404 on 2026-08-12.)
