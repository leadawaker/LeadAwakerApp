# Implementation Plan: Lead Score Computation

## Overview

Add a server-side scoring engine that computes `engagement_score` + `activity_score` → `lead_score` from a lead's interaction history, triggered automatically after each new interaction and available via a backfill endpoint. No frontend changes needed — display already exists.

## Phase 1: Scoring Algorithm & Storage Methods

Add the core computation logic and database write methods.

### Tasks

- [ ] Create scoring utility module `server/scoring.ts` with the scoring algorithm [complex]
  - [ ] `computeEngagementScore(interactions)` — returns 0–100
  - [ ] `computeActivityScore(interactions)` — returns 0–100
  - [ ] `computeLeadScore(engagement, activity)` — weighted composite, returns 0–100
- [ ] Add `createLeadScoreHistory()` storage method to interface and implementation
- [ ] Add `updateLeadScore()` storage method (updates `Leads.lead_score` for a given lead ID)
- [ ] Add `getInteractionsByLeadId(leadId)` storage method (needed to fetch all interactions for scoring)

### Technical Details

**Scoring Algorithm (`server/scoring.ts`):**

```typescript
// Engagement Score (0–100) — quality of interactions
// Factors:
//   - Reply ratio: (inbound messages / total messages) * 30 points
//   - Sentiment: average sentimentScore across interactions, scaled to 25 points
//   - Response speed: avg responseTimeMinutes, inversely scaled to 25 points
//     (< 5 min = 25, < 30 min = 20, < 60 min = 15, < 240 min = 10, else 5)
//   - Message depth: avg content length of inbound messages, scaled to 20 points
//     (> 200 chars = 20, > 100 = 15, > 50 = 10, > 20 = 5, else 2)

// Activity Score (0–100) — recency and frequency
// Factors:
//   - Recency: days since last interaction, inversely scaled to 40 points
//     (today = 40, < 3 days = 35, < 7 = 28, < 14 = 20, < 30 = 12, else 5)
//   - Frequency: total interaction count, scaled to 35 points
//     (> 20 = 35, > 10 = 28, > 5 = 20, > 2 = 12, 1 = 5)
//   - Thread count: unique conversation_thread_ids, scaled to 25 points
//     (> 5 = 25, > 3 = 20, > 1 = 12, else 5)

// Lead Score = 0.55 * engagementScore + 0.45 * activityScore (rounded to integer)
```

**Storage methods to add in `server/storage.ts`:**

Interface additions (around line 139):
```typescript
createLeadScoreHistory(data: InsertLead_Score_History): Promise<Lead_Score_History>;
updateLeadScore(leadId: number, score: number): Promise<void>;
getInteractionsByLeadId(leadId: number): Promise<Interactions[]>;
```

Implementation:
```typescript
async createLeadScoreHistory(data: InsertLead_Score_History): Promise<Lead_Score_History> {
  const [row] = await db.insert(leadScoreHistory).values({
    createdAt: new Date(),
    ...data,
  } as any).returning();
  return row;
}

async updateLeadScore(leadId: number, score: number): Promise<void> {
  await db.update(leads).set({ leadScore: score }).where(eq(leads.id, leadId));
}

async getInteractionsByLeadId(leadId: number): Promise<Interactions[]> {
  return db.select().from(interactions)
    .where(eq(interactions.leadsId, leadId))
    .orderBy(desc(interactions.createdAt));
}
```

**Key file paths:**
- New file: `server/scoring.ts`
- Edit: `server/storage.ts` (interface ~line 139, implementation ~line 535)
- Schema types from: `shared/schema.ts` (lines 510–528)

---

## Phase 2: Auto-Trigger After Interaction Creation

Hook into the existing `POST /api/interactions` endpoint to trigger score computation.

### Tasks

- [ ] Create `recomputeLeadScore(leadId, storage)` orchestrator function in `server/scoring.ts`
- [ ] Call `recomputeLeadScore` in `POST /api/interactions` handler after successful interaction creation

### Technical Details

**Orchestrator function (`server/scoring.ts`):**
```typescript
export async function recomputeLeadScore(leadId: number, storage: IStorage): Promise<void> {
  const interactions = await storage.getInteractionsByLeadId(leadId);
  if (!interactions.length) return;

  const engagement = computeEngagementScore(interactions);
  const activity = computeActivityScore(interactions);
  const score = computeLeadScore(engagement, activity);

  // Get current lead for conversion status
  const lead = await storage.getLeadById(leadId);

  await storage.createLeadScoreHistory({
    leadsId: leadId,
    scoreDate: new Date().toISOString().split("T")[0],
    leadScore: score,
    engagementScore: engagement,
    activityScore: activity,
    conversionStatus: lead?.conversionStatus ?? null,
  });

  await storage.updateLeadScore(leadId, score);
}
```

**Hook into routes (`server/routes.ts` ~line 814):**
After `const interaction = await storage.createInteraction(parsed.data);`, add:
```typescript
// Fire-and-forget score recomputation
const leadId = interaction.leadsId ?? interaction.leadId;
if (leadId) {
  recomputeLeadScore(Number(leadId), storage).catch(err =>
    console.error(`Score recompute failed for lead ${leadId}:`, err)
  );
}
```

**Key file paths:**
- Edit: `server/scoring.ts` (add orchestrator)
- Edit: `server/routes.ts` (line ~814, after interaction creation)
- Import needed: `import { recomputeLeadScore } from "./scoring";` in routes.ts

---

## Phase 3: Backfill & Manual Recomputation Endpoint

Add an API endpoint to recompute scores for existing leads.

### Tasks

- [ ] Add `POST /api/lead-score-history/recompute` endpoint — accepts optional `leadId` or `campaignId`
- [ ] Add `getLeadsByCampaignId(campaignId)` storage method if not already present
- [ ] Add `getAllLeadIds()` storage method for full backfill

### Technical Details

**New endpoint in `server/routes.ts` (after existing lead-score-history GET, ~line 1469):**
```typescript
app.post("/api/lead-score-history/recompute", requireAgency, wrapAsync(async (req, res) => {
  const { leadId, campaignId } = req.body;

  if (leadId) {
    await recomputeLeadScore(Number(leadId), storage);
    res.json({ recomputed: 1 });
  } else if (campaignId) {
    const leads = await storage.getLeadsByCampaignId(Number(campaignId));
    for (const lead of leads) {
      await recomputeLeadScore(lead.id!, storage);
    }
    res.json({ recomputed: leads.length });
  } else {
    // Full backfill — all leads
    const leads = await storage.getAllLeads();
    for (const lead of leads) {
      await recomputeLeadScore(lead.id!, storage);
    }
    res.json({ recomputed: leads.length });
  }
}));
```

**Storage methods (check if they exist first):**
- `getLeadsByCampaignId(campaignId)` — may already exist via campaign filtering
- `getAllLeads()` — likely exists as `getLeads()`

**Key file paths:**
- Edit: `server/routes.ts` (~line 1469)
- Edit: `server/storage.ts` (if new methods needed)

---

## Phase 4: Frontend — Surface Sub-Scores on Lead Cards (Optional)

The frontend already displays scores from lead data. However, `engagement_score` and `activity_score` only exist in `Lead_Score_History`, not on the `Leads` table. The detail panel references `lead.engagement_score` and `lead.activity_score` which are currently always null.

### Tasks

- [ ] Add `engagement_score` and `activity_score` columns to the `Leads` table in schema + database [complex]
  - [ ] Add columns to `shared/schema.ts` Leads table definition
  - [ ] Run `ALTER TABLE` to add columns to live database
  - [ ] Update `updateLeadScore()` to also write engagement + activity scores to Leads
- [ ] Verify LeadDetailPanel gauges display correctly with real data (manual test)

### Technical Details

**Schema change (`shared/schema.ts` ~line 336):**
```typescript
leadScore: integer("lead_score"),
engagementScore: integer("engagement_score"),   // NEW
activityScore: integer("activity_score"),         // NEW
```

**ALTER TABLE (run against live DB):**
```sql
ALTER TABLE p2mxx34fvbf3ll6."Leads"
  ADD COLUMN IF NOT EXISTS engagement_score integer,
  ADD COLUMN IF NOT EXISTS activity_score integer;
```

**Verify columns exist after migration:**
```bash
node -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT column_name FROM information_schema.columns WHERE table_schema='p2mxx34fvbf3ll6' AND table_name='Leads' AND column_name IN ('engagement_score','activity_score')\").then(r=>console.log(r.rows.map(x=>x.column_name))).finally(()=>p.end())"
```

**Update storage method:**
```typescript
async updateLeadScore(leadId: number, score: number, engagement: number, activity: number): Promise<void> {
  await db.update(leads).set({
    leadScore: score,
    engagementScore: engagement,
    activityScore: activity,
  }).where(eq(leads.id, leadId));
}
```

**LeadDetailPanel already handles this** at `client/src/features/leads/components/LeadDetailPanel.tsx:1074`:
```typescript
{(lead.lead_score != null || lead.engagement_score != null || lead.activity_score != null) && (
```
Once the Leads table has these columns populated, the gauges will render automatically.
