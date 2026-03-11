# Requirements: Lead Score Computation

## What & Why

The Lead_Score_History table and frontend display (gauges, filters, sorting) already exist, but there is **no computation engine** — scores are never calculated or recorded. This feature adds the server-side logic to compute `engagement_score` + `activity_score` → `lead_score` after each interaction, making the CRM intelligence layer functional.

## Functional Requirements

1. **Scoring algorithm** — Compute two sub-scores (0–100 each) from a lead's interaction history:
   - `engagement_score`: measures quality/depth of engagement (reply rate, sentiment, response speed, message length)
   - `activity_score`: measures recency and frequency of interactions (message count, days since last interaction, conversation threads)
   - `lead_score`: weighted combination of the two sub-scores (0–100)

2. **Automatic computation** — Recalculate scores whenever a new interaction is created via `POST /api/interactions`

3. **Score persistence** — After computation:
   - Insert a new row into `Lead_Score_History` with the computed scores + current `Conversion_Status`
   - Update `Leads.lead_score` with the latest composite score

4. **Manual recalculation** — API endpoint to trigger score recomputation for a single lead or all leads in a campaign (backfill)

5. **Frontend integration** — Already done (gauges in LeadDetailPanel, score filters/sorting in list/table/kanban). No frontend changes needed unless `engagement_score` and `activity_score` need to be surfaced on the Leads API response (they currently only exist in Lead_Score_History).

## Acceptance Criteria

- [ ] After creating an interaction via `POST /api/interactions`, the lead's scores are automatically recomputed
- [ ] `Lead_Score_History` receives a new row with `lead_score`, `engagement_score`, `activity_score`, `conversion_status`, and `score_date`
- [ ] `Leads.lead_score` is updated with the latest computed score
- [ ] A backfill endpoint exists to recompute scores for leads that already have interactions
- [ ] Score values are 0–100 integers
- [ ] Leads with zero interactions get a score of 0
- [ ] The scoring algorithm accounts for: reply count, sentiment, response time, recency, frequency

## Dependencies

- `Lead_Score_History` table (exists)
- `Leads.lead_score` column (exists)
- `Interactions` table with fields: `direction`, `sentimentScore`, `sentimentDetected`, `responseTimeMinutes`, `createdAt`, `leadsId` (all exist)
- `POST /api/interactions` endpoint (exists at `server/routes.ts:811`)
- Frontend score display (exists in LeadDetailPanel, LeadsCardView, LeadsKanban, LeadsInlineTable)

## Out of Scope

- Real-time WebSocket score updates (polling/refetch is fine)
- ML-based scoring models (rule-based algorithm is sufficient)
- Score decay over time (can be added later)
- Frontend changes (display already works)
