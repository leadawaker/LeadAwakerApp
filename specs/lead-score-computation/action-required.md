# Action Required: Lead Score Computation

Manual steps that must be completed by a human.

## Before Implementation

- [ ] **Confirm scoring weights** — The algorithm uses 55% engagement / 45% activity weighting. Review and adjust if business priorities differ (e.g., recency matters more than engagement quality).
- [ ] **Confirm score thresholds** — Frontend uses score >= 70 as "high score" filter. Verify this threshold makes sense with the new algorithm.

## During Implementation

- [ ] **Phase 4: Run ALTER TABLE on live database** — Adding `engagement_score` and `activity_score` columns to the Leads table requires a manual migration against the live PostgreSQL database. Drizzle does NOT auto-migrate.

## After Implementation

- [ ] **Run initial backfill** — After deployment, trigger `POST /api/lead-score-history/recompute` (no body) to compute scores for all existing leads with interaction history. This is a one-time operation.
- [ ] **Verify scores look reasonable** — Spot-check a few leads in the UI to confirm the gauges display sensible values (not all 0 or all 100).
