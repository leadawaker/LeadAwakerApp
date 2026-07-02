# Bump System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt Dan Wardrope's 4-message bump cadence as the default, let campaigns customize AI bump angles per stage, fix the empty-template stall bug, fix the First Message voice toggle, and add a booking-aware bump path so a lead who named a booking day but never confirmed a time gets nudged with fresh live slots instead of a generic re-engagement message.

**Architecture:** Two separate git repositories are touched. `/home/gabriel/LeadAwakerApp` (Express + Drizzle + React) owns the campaign settings UI and the `Campaigns`/`Leads` schema definitions. `/home/gabriel/automations` (Python, WAT framework, pm2 process `leadawaker-engine`) owns the live bump-sending and AI-conversation logic that actually reads/writes those columns. Both point at the same Postgres database (NocoDB-managed schema), so new columns are added once via a raw SQL migration script, then declared in `shared/schema.ts` for the TS side — the Python side just reads/writes the raw column names directly via `asyncpg`, no schema file to update there.

**Tech Stack:** TypeScript/React/Drizzle (CRM), Python/asyncpg/structlog (automations engine), PostgreSQL (NocoDB-generated schema), Cal.diy/Cal.com v2 API (booking).

## Global Constraints

- Never run `npm run dev` or `tsc` — the CRM app runs via pm2/tsx-watch and auto-reloads on save (5-8s). Verify via `pm2 logs` or the live app, not by starting a dev server.
- The automations engine does **NOT** hot-reload. After any edit under `/home/gabriel/automations/src/` or `/home/gabriel/automations/tools/`, run `./preflight.sh && pm2 restart leadawaker-engine --update-env` from `/home/gabriel/automations`, then confirm clean startup with `pm2 logs leadawaker-engine --lines 20 --nostream`. Do not restart if preflight fails.
- Every automation script step must log via `AsyncLogStep`/`log_step` (see `/home/gabriel/automations/docs/logging-patterns.md`). New code paths in this plan follow that convention.
- No hardcoded user-facing strings in the CRM — all new UI text goes through `client/src/locales/{en,nl}/campaigns.json` (pt was dropped product-wide).
- Never send ISO date strings from client to server for timestamp columns; server sets `new Date()` itself. Not directly relevant here (no new client-writable timestamp fields), noted for awareness.
- `/home/gabriel/automations` is a separate git repository (remote: `LeadAwakerAutomations`) — commits for Python-side tasks happen there, not in `LeadAwakerApp`.
- Never use `git commit --amend`; always create new commits, per user's global git safety rules.
- Discovery demo campaign id is **61** (confirmed via `_DEMO_CAMPAIGN_IDS = {60, 61}` in `slot_booking.py`, comment: "universal = 60, discovery = 61").
- Spec: `docs/superpowers/specs/2026-07-02-bump-system-overhaul-design.md`.

---

## File Structure

**LeadAwakerApp (create):**
- `migrate-bump-system-columns.js` — one-off Node/pg migration adding the 5 new columns
- `seed-discovery-demo-bumps.js` — one-off Node/pg script filling Wardrope content into campaign 61

**LeadAwakerApp (modify):**
- `shared/schema.ts` — 4 new Campaigns columns, 1 new Leads column
- `client/src/features/campaigns/components/settings/AISectionFields.tsx` — bump AI-prompt textareas, relocated First Message voice toggle
- `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx` — remove the unlabeled voice toggle
- `client/src/features/campaigns/components/CampaignDetailPanel.tsx` — add missing Bump 4 card
- `client/src/locales/en/campaigns.json`, `client/src/locales/nl/campaigns.json` — new keys

**automations (modify):**
- `src/automations/bump_scheduler.py` — max_bumps default, empty-template skip-forward fix, new booking-nudge branch
- `src/automations/ai_bump_generator.py` — per-campaign stage angle override, new `generate_booking_nudge_bump()`
- `src/automations/conversation/slot_booking.py` — `by_day` return value, `{{DAY_SELECTED}}` prompt signal, new `_get_fresh_times_for_day()`
- `src/automations/ai_conversation.py` — `{{DAY_SELECTED}}` regex + parsing, `pending_booking_context` write/clear
- `src/automations/campaign_launcher.py` — gate first-message voice send on `voice_reply_mode`

---

## Task 1: Database migration — new columns

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/migrate-bump-system-columns.js`

**Interfaces:**
- Produces: `Campaigns.bump_1_ai_prompt` .. `bump_4_ai_prompt` (text, nullable), `Leads.pending_booking_context` (text, nullable) — every later task in both repos reads/writes these by exact name.

- [ ] **Step 1: Write the migration script**

Follow the exact precedent from `migrate-objection-playbook.js` (git commit `5fe47766`): resolve the NocoDB-generated schema name first, then `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (idempotent, safe to re-run).

```javascript
// Bump System Overhaul — add Campaigns.bump_N_ai_prompt (x4) + Leads.pending_booking_context.
// Run on the Pi with:  node --env-file=.env migrate-bump-system-columns.js
// Idempotent: safe to re-run. db:push has no TTY on the Pi, so we go direct.
// NocoDB keeps tables in a generated schema (not public), so resolve it first.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function ensureColumn(table, column, type) {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = $1 ORDER BY table_schema LIMIT 1;`,
    [table]
  );
  if (found.rowCount === 0) throw new Error(`${table} table not found in any schema`);
  const schema = found.rows[0].table_schema;
  const T = `"${schema}"."${table}"`;

  await client.query(
    `ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "${column}" ${type} DEFAULT NULL;`
  );

  const check = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3;`,
    [schema, table, column]
  );
  console.log(`✓ ${table}.${column} ensured:`, check.rows[0]);
}

async function setDefault(table, column, sqlLiteral) {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = $1 ORDER BY table_schema LIMIT 1;`,
    [table]
  );
  const schema = found.rows[0].table_schema;
  const T = `"${schema}"."${table}"`;
  await client.query(`ALTER TABLE ${T} ALTER COLUMN "${column}" SET DEFAULT ${sqlLiteral};`);
  console.log(`✓ ${table}.${column} default set`);
}

try {
  await ensureColumn('Campaigns', 'bump_1_ai_prompt', 'text');
  await ensureColumn('Campaigns', 'bump_2_ai_prompt', 'text');
  await ensureColumn('Campaigns', 'bump_3_ai_prompt', 'text');
  await ensureColumn('Campaigns', 'bump_4_ai_prompt', 'text');
  await ensureColumn('Leads', 'pending_booking_context', 'text');

  // Wardrope cadence becomes the DB-level default for NEW campaign rows only
  // (existing rows are untouched — Postgres column defaults never retroactively
  // backfill existing data). This is what makes "new campaigns get these as
  // defaults" true without having to find every campaign-creation code path.
  await setDefault('Campaigns', 'bump_1_template', `'Hi {first_name}! Just checking in, I figured you got busy before.'`);
  await setDefault('Campaigns', 'bump_2_template', `'{first_name}, what''s holding you back from {service}?'`);
  await setDefault('Campaigns', 'bump_3_template', `'Is it a trust thing?'`);
  await setDefault('Campaigns', 'bump_4_template', `'I won''t bother you anymore {first_name}. If you ever need to discuss {service}, I will be here for you :)'`);
  await setDefault('Campaigns', 'max_bumps', `4`);

  console.log('\n✅ bump-system-columns migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
```

- [ ] **Step 2: Run the migration on the Pi**

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env migrate-bump-system-columns.js`
Expected: 5 lines of `✓ <Table>.<column> ensured: { column_name: '...', data_type: 'text' }`, then 5 lines of `✓ <Table>.<column> default set`, then `✅ bump-system-columns migration complete`.

- [ ] **Step 3: Verify columns exist**

Run: `node --env-file=.env -e "
import('pg').then(async ({ default: pg }) => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(\`SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('bump_1_ai_prompt','bump_2_ai_prompt','bump_3_ai_prompt','bump_4_ai_prompt','pending_booking_context') ORDER BY table_name, column_name;\`);
  console.log(r.rows);
  await c.end();
});
"`
Expected: 5 rows listing the new columns under `Campaigns`/`Leads`.

- [ ] **Step 4: Commit**

```bash
git add migrate-bump-system-columns.js
git commit -m "$(cat <<'EOF'
chore(db): add Campaigns.bump_N_ai_prompt + Leads.pending_booking_context columns

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Drizzle schema — declare the new columns

**Files:**
- Modify: `shared/schema.ts:461-466` (Campaigns table, alongside `bump1AiReference`/`bumpNVoiceTemplate`)
- Modify: `shared/schema.ts:660-664` (Leads table, alongside `nextActionAt`/`currentBumpStage`)

**Interfaces:**
- Consumes: columns created in Task 1
- Produces: `campaigns.bump1AiPrompt` .. `bump4AiPrompt`, `leads.pendingBookingContext` — TS field names later UI tasks bind to via `draft`/`campaign` objects (which use snake_case keys from the API, e.g. `campaign.bump_1_ai_prompt`, matching the existing `bump1Template`/`bump_1_template` pattern already in the file).

- [ ] **Step 1: Add the 4 Campaigns columns, and declare the new Wardrope defaults**

In `shared/schema.ts`, find:
```typescript
  bump1AiReference: boolean("bump_1_ai_reference").default(false),
  bump2AiReference: boolean("bump_2_ai_reference").default(false),
  bump3AiReference: boolean("bump_3_ai_reference").default(false),
  bump1VoiceTemplate: text("bump_1_voice_template"),
```
Replace with:
```typescript
  bump1AiReference: boolean("bump_1_ai_reference").default(false),
  bump2AiReference: boolean("bump_2_ai_reference").default(false),
  bump3AiReference: boolean("bump_3_ai_reference").default(false),
  // Per-bump AI angle override: what generate_ai_bump() should aim for at this
  // stage. Falls back to the engine's hardcoded _STAGE_ANGLES when empty (see
  // docs/superpowers/specs/2026-07-02-bump-system-overhaul-design.md, item 2).
  bump1AiPrompt: text("bump_1_ai_prompt"),
  bump2AiPrompt: text("bump_2_ai_prompt"),
  bump3AiPrompt: text("bump_3_ai_prompt"),
  bump4AiPrompt: text("bump_4_ai_prompt"),
  bump1VoiceTemplate: text("bump_1_voice_template"),
```

Then find the existing bump template + max_bumps declarations (near the top of the bump-related block, likely close to where `bump1Template`/`maxBumps` are declared — search for `bump1Template: text("bump_1_template")` and `maxBumps: bigint`) and add `.default(...)` matching the DB defaults set in Task 1, so newly-created rows via the Drizzle/Zod insert path agree with the raw-SQL column defaults:
```typescript
  bump1Template: text("bump_1_template").default("Hi {first_name}! Just checking in, I figured you got busy before."),
  bump2Template: text("bump_2_template").default("{first_name}, what's holding you back from {service}?"),
  bump3Template: text("bump_3_template").default("Is it a trust thing?"),
  bump4Template: text("bump_4_template").default("I won't bother you anymore {first_name}. If you ever need to discuss {service}, I will be here for you :)"),
```
```typescript
  maxBumps: bigint("max_bumps", { mode: "number" }).default(4),
```
(Keep every other property on these lines — e.g. if `bump1Template` already has other chained calls, only add `.default(...)`, don't remove anything existing.)

- [ ] **Step 2: Add the Leads column**

Find:
```typescript
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  currentBumpStage: bigint("current_bump_stage", { mode: "number" }),
```
Replace with:
```typescript
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  currentBumpStage: bigint("current_bump_stage", { mode: "number" }),
  // Set when the lead named a booking day but hasn't confirmed a time yet;
  // JSON string {day, offered_slots, timezone}. Cleared on booking or after
  // one booking-nudge bump. See bump-system-overhaul design spec, item 6.
  pendingBookingContext: text("pending_booking_context"),
```

- [ ] **Step 3: Verify the app picks up the change**

Run: `pm2 logs leadawaker-crm --lines 15 --nostream` (or the actual pm2 process name for the Express app — check with `pm2 list` first if unsure)
Expected: no new TypeScript errors in the log after the file save triggers the tsx-watch reload; the process stays up.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "$(cat <<'EOF'
feat(schema): add bump AI prompt columns + Leads.pendingBookingContext

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fix max_bumps default mismatch

**Files:**
- Modify: `/home/gabriel/automations/src/automations/bump_scheduler.py:101`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new (internal default only)

- [ ] **Step 1: Change the default**

Find:
```python
    max_bumps = data.get("max_bumps") or 3
```
Replace with:
```python
    max_bumps = data.get("max_bumps") or 4
```

- [ ] **Step 2: Preflight + restart**

Run: `cd /home/gabriel/automations && ./preflight.sh`
Expected: `✅ PASS`
Run: `pm2 restart leadawaker-engine --update-env && pm2 logs leadawaker-engine --lines 20 --nostream`
Expected: `engine.starting` → `scheduler.started`, no traceback.

- [ ] **Step 3: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/bump_scheduler.py
git commit -m "fix(bumps): align engine max_bumps default with UI default (4)"
```

---

## Task 4: Fix the empty-template stall bug

**Files:**
- Modify: `/home/gabriel/automations/src/automations/bump_scheduler.py:100-202` (add a helper, fix the early-return branch, reuse the helper in the existing send path)

**Interfaces:**
- Produces: `_compute_next_delay_hours(data: dict, next_stage: int, max_bumps: int) -> int` — a module-level helper, used by both the new skip path and the existing send path (DRY: the delay math was previously duplicated inline).

- [ ] **Step 1: Add the shared delay helper**

In `bump_scheduler.py`, immediately above `async def _process_lead(...)`, add:

```python
def _compute_next_delay_hours(data: dict, next_stage: int, max_bumps: int) -> int:
    """Hours until the bump attempt *after* `next_stage` should fire."""
    if next_stage < max_bumps:
        return data.get(f"bump_{next_stage + 1}_delay_hours") or 24
    return data.get(f"bump_{next_stage}_delay_hours") or 24
```

- [ ] **Step 2: Replace the stall with a skip-forward, and reuse the helper**

Find (the empty-template guard):
```python
    if not body:
        template_key = f"bump_{next_stage}_template"
        template = data.get(template_key)
        if not template:
            log.warning(
                "bump_scheduler.no_template",
                lead_id=lead_id,
                campaign_id=campaign_id,
                stage=next_stage,
            )
            return
```
Replace with:
```python
    if not body:
        template_key = f"bump_{next_stage}_template"
        template = data.get(template_key)
        if not template:
            # Blank bump — skip forward instead of stalling the lead in the
            # queue forever (previously this returned without advancing
            # current_bump_stage/next_action_at, so the lead was re-selected
            # every 5 min and later bumps never fired).
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            next_delay = _compute_next_delay_hours(data, next_stage, max_bumps)
            await update_lead_fields(
                lead_id,
                current_bump_stage=next_stage,
                next_action_at=now + timedelta(hours=next_delay),
            )
            await log_step(
                workflow_name="bump_scheduler",
                step_name="skip_empty_template",
                status="Skipped",
                skipped_reason=f"Bump {next_stage} template is empty",
                accounts_id=account_id,
                campaigns_id=campaign_id,
                leads_id=lead_id,
                workflow_execution_id=exec_id,
            )
            log.info("bump_scheduler.skip_empty_template", lead_id=lead_id, stage=next_stage)
            return
```

- [ ] **Step 3: Replace the duplicated delay math in the send path with the same helper**

Find (further down in `_process_lead`, the "Calculate next action time" block):
```python
    # Calculate next action time (strip tzinfo — DB columns are timestamp without time zone)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if next_stage < max_bumps:
        next_delay = data.get(f"bump_{next_stage + 1}_delay_hours") or 24
    else:
        # Last bump — next_action_at gates the exhaustion check
        next_delay = data.get(f"bump_{next_stage}_delay_hours") or 24
    next_action_at = now + timedelta(hours=next_delay)
```
Replace with:
```python
    # Calculate next action time (strip tzinfo — DB columns are timestamp without time zone)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    next_delay = _compute_next_delay_hours(data, next_stage, max_bumps)
    next_action_at = now + timedelta(hours=next_delay)
```

- [ ] **Step 4: Sanity-check the helper in isolation**

Run: `cd /home/gabriel/automations && .venv/bin/python -c "
from src.automations.bump_scheduler import _compute_next_delay_hours
data = {'bump_2_delay_hours': 48, 'bump_4_delay_hours': 72}
assert _compute_next_delay_hours(data, 1, 4) == 48   # next stage has a delay
assert _compute_next_delay_hours(data, 3, 4) == 24   # bump_4_delay_hours missing above, but stage 3->4 uses bump_4
assert _compute_next_delay_hours({'bump_4_delay_hours': 72}, 4, 4) == 72  # last bump uses its own delay
print('OK')
"`
Expected: `OK` (no assertion error).

- [ ] **Step 5: Preflight + restart**

Run: `./preflight.sh && pm2 restart leadawaker-engine --update-env`
Then: `pm2 logs leadawaker-engine --lines 20 --nostream` — expect clean startup.

- [ ] **Step 6: Commit**

```bash
git add src/automations/bump_scheduler.py
git commit -m "fix(bumps): blank bump template skips forward instead of stalling the lead"
```

---

## Task 5: First Message voice toggle — relocate + fix gating

**Files:**
- Modify: `/home/gabriel/automations/src/automations/campaign_launcher.py:316`
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx:104-110`
- Modify: `client/src/features/campaigns/components/settings/AISectionFields.tsx` (add new field near `voice_reply_mode`, line ~123)
- Modify: `client/src/locales/en/campaigns.json`, `client/src/locales/nl/campaigns.json`

**Interfaces:**
- Consumes: `campaign.voice_reply_mode` (existing field, values `"off" | "smart" | "voice_reply"`)
- Produces: nothing new for later tasks

- [ ] **Step 1: Fix the engine gating**

In `campaign_launcher.py`, find:
```python
        "use_voice": channel == "whatsapp" and bool(campaign.get("first_message_voice_note")),
```
Replace with:
```python
        "use_voice": (
            channel == "whatsapp"
            and bool(campaign.get("first_message_voice_note"))
            and (campaign.get("voice_reply_mode") or "off") != "off"
        ),
```

- [ ] **Step 2: Remove the unlabeled toggle from BusinessSectionFields.tsx**

In `BusinessSectionFields.tsx`, find:
```tsx
          value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                <EditToggle
                  value={!!draft.first_message_voice_note}
                  onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
                />
              </div>
              <EditText
```
Replace with:
```tsx
          value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              <EditText
```

- [ ] **Step 3: Add the labeled toggle to AISectionFields.tsx**

In `AISectionFields.tsx`, find the `voice_reply_mode` InfoRow:
```tsx
      <InfoRow icon={Mic} label={t("config.voiceReplyMode")} value={campaign.voice_reply_mode || "off"}
        {...editFor("voice_reply_mode")}
        editChild={isEditing ? <EditSelect value={String(draft.voice_reply_mode ?? "")} onChange={(v) => setDraft(d => ({...d, voice_reply_mode: v}))} options={["off", "smart", "voice_reply"]} labels={{ off: t("config.voiceReplyOff"), smart: t("config.voiceReplySmart"), voice_reply: t("config.voiceReplyVoiceReply") }} {...focusFor("voice_reply_mode")} /> : undefined}
      />
```
Add immediately after it:
```tsx
      <InfoRow icon={Mic} label={t("config.firstMessageVoiceNote")} value={campaign.first_message_voice_note ? t("config.on") : t("config.off")}
        {...editFor("first_message_voice_note")}
        editChild={isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
            <EditToggle
              value={!!draft.first_message_voice_note}
              onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
            />
            <span style={{ fontSize: 11, color: 'var(--mute)' }}>{t("config.firstMessageVoiceNoteHint")}</span>
          </div>
        ) : undefined}
      />
```

Note: this introduces `t("config.on")`/`t("config.off")` — check `client/src/locales/en/campaigns.json` and `nl/campaigns.json` for an existing generic `config.on`/`config.off` pair before adding new ones (search first: `grep -n '"on":\|"off":' client/src/locales/en/campaigns.json`). If they don't exist, add them alongside the new keys in Step 4.

- [ ] **Step 4: Add/update locale keys**

In `client/src/locales/en/campaigns.json`, find:
```json
    "firstMessageVoiceNote": "First message as voice note",
```
Replace with:
```json
    "firstMessageVoiceNote": "First message as voice note",
    "firstMessageVoiceNoteHint": "Sends the opener as a spoken voice note instead of text. Only works when AI Voice Mode above is not Off.",
```
(If `config.on`/`config.off` were missing per Step 3's check, add `"on": "On", "off": "Off"` near the same block — but check first, `voiceReplyOff` already exists at a different key name and must not be reused for this generic pair.)

In `client/src/locales/nl/campaigns.json`, find:
```json
    "firstMessageVoiceNote": "Eerste bericht als spraakbericht",
```
Replace with:
```json
    "firstMessageVoiceNote": "Eerste bericht als spraakbericht",
    "firstMessageVoiceNoteHint": "Verstuurt de opener als gesproken spraakbericht in plaats van tekst. Werkt alleen als AI-spraakmodus hierboven niet op Uit staat.",
```

- [ ] **Step 5: Verify in the running app**

Open the campaign settings panel for any campaign in a browser (or via playwright-cli), go to the Business tab, confirm the First Message field no longer shows a floating unlabeled toggle. Go to the AI tab, confirm a labeled "First message as voice note" toggle appears near "AI Voice Mode" with the hint text visible. Toggle it on/off and save, confirm it persists (check `pm2 logs` for the Express app, no errors).

- [ ] **Step 6: Preflight + restart the engine, commit both repos**

```bash
cd /home/gabriel/automations && ./preflight.sh && pm2 restart leadawaker-engine --update-env
pm2 logs leadawaker-engine --lines 20 --nostream
git add src/automations/campaign_launcher.py
git commit -m "fix(first-message): gate voice send on voice_reply_mode, not channel alone"
```

```bash
cd /home/gabriel/LeadAwakerApp
git add client/src/features/campaigns/components/settings/AISectionFields.tsx \
        client/src/features/campaigns/components/settings/BusinessSectionFields.tsx \
        client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json
git commit -m "$(cat <<'EOF'
fix(campaigns): move First Message voice toggle to AI tab with a real label

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Per-campaign AI bump angle override

**Files:**
- Modify: `/home/gabriel/automations/src/automations/ai_bump_generator.py:171`

**Interfaces:**
- Consumes: `Campaigns.bump_N_ai_prompt` (Task 1/2)
- Produces: nothing new

- [ ] **Step 1: Change the stage-angle lookup**

Find:
```python
    # Stage-specific angle — keeps each bump fresh
    stage_angle = _STAGE_ANGLES.get(bump_stage, _STAGE_ANGLES[1])
```
Replace with:
```python
    # Stage-specific angle — campaign override takes priority, falls back to
    # the built-in angle when the campaign hasn't customized this stage.
    stage_angle = (
        campaign_account.get(f"bump_{bump_stage}_ai_prompt")
        or _STAGE_ANGLES.get(bump_stage, _STAGE_ANGLES[1])
    )
```

- [ ] **Step 2: Sanity-check the fallback logic**

Run: `cd /home/gabriel/automations && .venv/bin/python -c "
from src.automations.ai_bump_generator import _STAGE_ANGLES
campaign_with_override = {'bump_2_ai_prompt': 'Ask specifically about price hesitation.'}
campaign_without = {}
angle = campaign_with_override.get('bump_2_ai_prompt') or _STAGE_ANGLES.get(2, _STAGE_ANGLES[1])
assert angle == 'Ask specifically about price hesitation.'
angle2 = campaign_without.get('bump_2_ai_prompt') or _STAGE_ANGLES.get(2, _STAGE_ANGLES[1])
assert angle2 == _STAGE_ANGLES[2]
print('OK')
"`
Expected: `OK`.

- [ ] **Step 3: Preflight + restart + commit**

```bash
./preflight.sh && pm2 restart leadawaker-engine --update-env
pm2 logs leadawaker-engine --lines 20 --nostream
git add src/automations/ai_bump_generator.py
git commit -m "feat(bumps): let campaigns override the AI bump angle per stage"
```

---

## Task 7: Bump AI-prompt fields in the campaign settings UI

**Files:**
- Modify: `client/src/features/campaigns/components/settings/AISectionFields.tsx:68-104` (`renderBump`)
- Modify: `client/src/locales/en/campaigns.json`, `client/src/locales/nl/campaigns.json`

**Interfaces:**
- Consumes: `campaign.bump_N_ai_prompt` / `draft.bump_N_ai_prompt` (Task 1/2)

- [ ] **Step 1: Extend `renderBump` with the AI-angle textarea**

In `AISectionFields.tsx`, find the full `renderBump` function:
```tsx
  const renderBump = (n: number) => {
    const voiceField = `bump_${n}_voice_note`;
    const delayField = `bump_${n}_delay_hours`;
    const templateField = `bump_${n}_template`;
    return (
      <div key={n} style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 'var(--space-md, 12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            {t("config.bumpN", { n }) || `Bump ${n}`}
          </span>
          <EditToggle
            value={!!draft[voiceField]}
            onChange={(v) => setDraft(d => ({ ...d, [voiceField]: v }))}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)' }}>
            {t("config.delayLabel", { value: draft[delayField] ?? campaign[delayField] ?? 0 })}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 'var(--space-sm, 8px)', alignItems: 'start' }}>
          <EditNumber
            value={Number(draft[delayField] ?? campaign[delayField] ?? 0)}
            onChange={(v) => setDraft(d => ({ ...d, [delayField]: v }))}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
            <EditText
              value={String(draft[templateField] ?? campaign[templateField] ?? "")}
              onChange={(v) => setDraft(d => ({ ...d, [templateField]: v }))}
              multiline
              minRows={2}
              placeholder={t("config.bumpTemplate", { n }) || `Bump ${n} template…`}
            />
            <CopyButton value={String(draft[templateField] || campaign[templateField] || "")} />
          </div>
        </div>
      </div>
    );
  };
```
Replace with:
```tsx
  const renderBump = (n: number) => {
    const voiceField = `bump_${n}_voice_note`;
    const delayField = `bump_${n}_delay_hours`;
    const templateField = `bump_${n}_template`;
    const aiPromptField = `bump_${n}_ai_prompt`;
    return (
      <div key={n} style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 'var(--space-md, 12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            {t("config.bumpN", { n }) || `Bump ${n}`}
          </span>
          <EditToggle
            value={!!draft[voiceField]}
            onChange={(v) => setDraft(d => ({ ...d, [voiceField]: v }))}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)' }}>
            {t("config.delayLabel", { value: draft[delayField] ?? campaign[delayField] ?? 0 })}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 'var(--space-sm, 8px)', alignItems: 'start' }}>
          <EditNumber
            value={Number(draft[delayField] ?? campaign[delayField] ?? 0)}
            onChange={(v) => setDraft(d => ({ ...d, [delayField]: v }))}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
            <EditText
              value={String(draft[templateField] ?? campaign[templateField] ?? "")}
              onChange={(v) => setDraft(d => ({ ...d, [templateField]: v }))}
              multiline
              minRows={2}
              placeholder={t("config.bumpTemplate", { n }) || `Bump ${n} template…`}
            />
            <CopyButton value={String(draft[templateField] || campaign[templateField] || "")} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
          <span style={{ fontSize: 11, color: 'var(--mute)' }}>{t("config.bumpAiPrompt")}</span>
          <EditText
            value={String(draft[aiPromptField] ?? campaign[aiPromptField] ?? "")}
            onChange={(v) => setDraft(d => ({ ...d, [aiPromptField]: v }))}
            multiline
            minRows={2}
            placeholder={t("config.bumpAiPromptPlaceholder", { n }) || `How should the AI angle bump ${n}? Leave blank for the default.`}
          />
        </div>
      </div>
    );
  };
```

- [ ] **Step 2: Add locale keys**

In `client/src/locales/en/campaigns.json`, find:
```json
    "reengagementBump": "Contact Later re-engagement",
```
Add immediately before it:
```json
    "bumpAiPrompt": "AI angle (used once this bump goes AI-generated)",
    "bumpAiPromptPlaceholder": "e.g. Address price hesitation directly, offer a smaller first step",
    "reengagementBump": "Contact Later re-engagement",
```

In `client/src/locales/nl/campaigns.json`, find the matching `"reengagementBump"` line and add immediately before it:
```json
    "bumpAiPrompt": "AI-invalshoek (gebruikt zodra deze bump AI-gegenereerd wordt)",
    "bumpAiPromptPlaceholder": "bijv. Ga direct in op prijstwijfel, bied een kleinere eerste stap aan",
    "reengagementBump": "Later contact heropening",
```

- [ ] **Step 3: Verify in the running app**

Open a campaign's settings, AI tab, confirm each of Bump 1-4 now shows a second textarea below the template labeled "AI angle..." with the placeholder text. Type something into Bump 2's AI angle field, save, reload the panel, confirm it persisted.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/campaigns/components/settings/AISectionFields.tsx \
        client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json
git commit -m "$(cat <<'EOF'
feat(campaigns): add per-bump AI angle field to campaign settings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add the missing Bump 4 card to the campaign detail summary

**Files:**
- Modify: `client/src/features/campaigns/components/CampaignDetailPanel.tsx:315-331`

**Interfaces:**
- Consumes: `BumpCard` component (existing, unchanged — `client/src/features/campaigns/components/detailPanelWidgets/BumpCard.tsx`)

- [ ] **Step 1: Add the 4th card**

Find:
```tsx
              {/* Bump 1, 2, 3 */}
              <BumpCard
                bumpNumber={1}
                template={campaign.bump_1_template}
                delayHours={campaign.bump_1_delay_hours}
              />
              <BumpCard
                bumpNumber={2}
                template={campaign.bump_2_template}
                delayHours={campaign.bump_2_delay_hours}
              />
              <BumpCard
                bumpNumber={3}
                template={campaign.bump_3_template}
                delayHours={campaign.bump_3_delay_hours}
              />
            </div>
```
Replace with:
```tsx
              {/* Bump 1, 2, 3, 4 */}
              <BumpCard
                bumpNumber={1}
                template={campaign.bump_1_template}
                delayHours={campaign.bump_1_delay_hours}
              />
              <BumpCard
                bumpNumber={2}
                template={campaign.bump_2_template}
                delayHours={campaign.bump_2_delay_hours}
              />
              <BumpCard
                bumpNumber={3}
                template={campaign.bump_3_template}
                delayHours={campaign.bump_3_delay_hours}
              />
              <BumpCard
                bumpNumber={4}
                template={campaign.bump_4_template}
                delayHours={campaign.bump_4_delay_hours}
              />
            </div>
```

- [ ] **Step 2: Verify in the running app**

Open any campaign's detail panel (read-only summary view, not the edit form), scroll to Message Templates, confirm a 4th "Bump 4" card now renders alongside the first three.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/campaigns/components/CampaignDetailPanel.tsx
git commit -m "fix(campaigns): show Bump 4 in the campaign detail summary panel"
```

---

## Task 9: Seed the discovery demo campaign with Wardrope content

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/seed-discovery-demo-bumps.js`

**Interfaces:**
- Consumes: `Campaigns.id = 61`, columns `bump_1_template`..`bump_4_template`, `max_bumps`, `reengagement_bump_template`

- [ ] **Step 1: Write the seed script**

```javascript
// Bump System Overhaul — fill the Discovery Demo campaign (id 61) with the
// Wardrope cadence as its default bump content, and a starter reengagement line.
// Run on the Pi with:  node --env-file=.env seed-discovery-demo-bumps.js
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = 'Campaigns' ORDER BY table_schema LIMIT 1;`
  );
  if (found.rowCount === 0) throw new Error('Campaigns table not found in any schema');
  const schema = found.rows[0].table_schema;
  const T = `"${schema}"."Campaigns"`;

  const result = await client.query(
    `UPDATE ${T} SET
       bump_1_template = $1,
       bump_2_template = $2,
       bump_3_template = $3,
       bump_4_template = $4,
       max_bumps = 4,
       reengagement_bump_template = $5
     WHERE id = 61
     RETURNING id, name;`,
    [
      "Hi {first_name}! Just checking in, I figured you got busy before.",
      "{first_name}, what's holding you back from {service}?",
      "Is it a trust thing?",
      "I won't bother you anymore {first_name}. If you ever need to discuss {service}, I will be here for you :)",
      "Hi {first_name}! You mentioned this timing would work better for you, so here I am, is now a good moment?",
    ]
  );

  if (result.rowCount === 0) {
    throw new Error('Campaign id 61 not found — check _DEMO_CAMPAIGN_IDS is still {60, 61} before re-running.');
  }
  console.log('✓ updated campaign:', result.rows[0]);
  console.log('\n✅ discovery demo bump seed complete');
} catch (err) {
  console.error('❌ seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
```

- [ ] **Step 2: Run it**

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env seed-discovery-demo-bumps.js`
Expected: `✓ updated campaign: { id: 61, name: '...' }` then `✅ discovery demo bump seed complete`.

- [ ] **Step 3: Verify in the campaign detail panel**

Open the Discovery Demo campaign (id 61) in the CRM, confirm Bump 1-4 cards now show the Wardrope text, and the AI tab's "Contact Later re-engagement" field shows the new starter line.

- [ ] **Step 4: Commit**

```bash
git add seed-discovery-demo-bumps.js
git commit -m "$(cat <<'EOF'
chore(data): seed discovery demo campaign with Wardrope bump cadence

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `slot_booking.py` — day-selection signal + fresh single-day fetch

**Files:**
- Modify: `/home/gabriel/automations/src/automations/conversation/slot_booking.py`

**Interfaces:**
- Consumes: existing `_resolve_booking_target`, `parse_calcom_url`, `caldiy_get_availability`
- Produces:
  - `_fetch_and_format_slots(...) -> tuple[str, list[str], dict[str, list[str]]]` (signature change: now returns `by_day` as a 3rd element — every existing caller must be updated, see Task 11)
  - `_get_fresh_times_for_day(campaign_account: dict, day_iso: str, lead_tz: str) -> list[str]` (new)
  - The AI now emits `{{DAY_SELECTED: <YYYY-MM-DD>}}` in STAGE 2 replies — a new observable signal Task 11 parses

- [ ] **Step 1: Change `_fetch_and_format_slots`'s early-return signature**

Find (two occurrences):
```python
        return "", []
```
The first is guarded by the unparseable-URL check, the second by the empty-slots check. Replace **both** with:
```python
        return "", [], {}
```

- [ ] **Step 2: Embed the hidden day-ISO tag in the days list**

Find:
```python
    days_bullets = "\n".join(f"  - {d}" for d in day_labels)
```
Replace with:
```python
    days_bullets = "\n".join(
        f"  - {d} → {{{{DAY_SELECTED: {dk}}}}}" for d, dk in zip(day_labels, day_keys)
    )
```

- [ ] **Step 3: Update the STAGE 1/STAGE 2 instructions to explain the tag**

Find:
```python
        f"STAGE 1 — after the lead agrees to a call, ask which day suits them best and "
        f"offer ONLY the days in this list (no times, no link). These are the ONLY "
        f"available days:\n"
        f"{days_bullets}\n"
        f"  CRITICAL: copy these exact days (you may translate the label into the "
        f"lead's language, e.g. 'tomorrow'→'morgen', 'this Thursday'→'donderdag'). Do "
        f"NOT work out the days yourself from today's date, do NOT offer today, and do "
        f"NOT offer any weekday that is not in the list above — those days have no "
        f"availability.\n"
        f"STAGE 2 — after the lead picks a day, offer ONLY the times listed for that "
        f"day below, phrased naturally in the lead's language. Each line is tagged "
        f"morning / early afternoon / late afternoon, but a day may have fewer (e.g. "
        f"only afternoon options) — offer exactly what is listed, never invent a "
        f"morning or a time that is not there. If a day has only one time, offer that "
        f"one. Still no link.\n"
```
Replace with:
```python
        f"STAGE 1 — after the lead agrees to a call, ask which day suits them best and "
        f"offer ONLY the day labels in this list (no times, no link, and never say the "
        f"{{{{DAY_SELECTED}}}} part out loud — that tag is invisible system bookkeeping, "
        f"not something to say to the lead). These are the ONLY available days:\n"
        f"{days_bullets}\n"
        f"  CRITICAL: copy these exact days (you may translate the label into the "
        f"lead's language, e.g. 'tomorrow'→'morgen', 'this Thursday'→'donderdag'). Do "
        f"NOT work out the days yourself from today's date, do NOT offer today, and do "
        f"NOT offer any weekday that is not in the list above — those days have no "
        f"availability.\n"
        f"STAGE 2 — after the lead picks a day, include that day's hidden "
        f"{{{{DAY_SELECTED: <date>}}}} tag (copied exactly from the list above) on its "
        f"own line at the END of your message, then offer ONLY the times listed for "
        f"that day below, phrased naturally in the lead's language. Each line is "
        f"tagged morning / early afternoon / late afternoon, but a day may have fewer "
        f"(e.g. only afternoon options) — offer exactly what is listed, never invent a "
        f"morning or a time that is not there. If a day has only one time, offer that "
        f"one. Still no link.\n"
```

- [ ] **Step 4: Return `by_day` from `_fetch_and_format_slots`**

Find the function's final line:
```python
    return context, selected
```
Replace with:
```python
    return context, selected, by_day
```

Also update the docstring. Find:
```python
    """
    Fetch 2-3 available slots from Cal.diy and return a [AVAILABLE SLOTS] context
    block to inject into the AI system prompt, plus the raw ISO list.

    Returns (context_block, slot_iso_list). Returns ("", []) on any error.
    The block includes the booking link as a soft fallback so the AI can offer it
    when the lead doesn't like any of the proposed slots.
    """
```
Replace with:
```python
    """
    Fetch 2-3 available slots from Cal.diy and return a [AVAILABLE SLOTS] context
    block to inject into the AI system prompt, plus the raw ISO list, plus the
    day→times grouping (used by the booking-aware bump to find the next
    available day when a lead's previously-named day has passed).

    Returns (context_block, slot_iso_list, by_day). Returns ("", [], {}) on any
    error. The block includes the booking link as a soft fallback so the AI can
    offer it when the lead doesn't like any of the proposed slots.
    """
```

- [ ] **Step 5: Add `_get_fresh_times_for_day`**

Add this new function after `_fetch_and_format_slots` (before `_create_booking_from_slot`):

```python
async def _get_fresh_times_for_day(
    campaign_account: dict,
    day_iso: str,
    lead_tz: str,
) -> list[str]:
    """
    Live-fetch available times for one specific day (YYYY-MM-DD).

    Used by the booking-aware bump to re-check a day the lead named before
    ghosting — never trust a previously-offered slot list, availability may
    have changed since. Returns [] on any error or if the day has no openings.
    """
    calendar_url, cal_api_key = _resolve_booking_target(campaign_account)
    parsed = parse_calcom_url(calendar_url)
    if not parsed:
        log.warning(
            "booking_nudge.fetch_day.unparseable_url",
            url=calendar_url,
        )
        return []

    username, event_type_slug = parsed
    window_start = f"{day_iso}T00:00:00Z"
    window_end = f"{day_iso}T23:59:59Z"

    return await caldiy_get_availability(
        0,
        window_start,
        window_end,
        username=username,
        event_type_slug=event_type_slug,
        timezone=lead_tz,
        api_key=cal_api_key,
    )
```

- [ ] **Step 6: Preflight**

Run: `cd /home/gabriel/automations && ./preflight.sh`
Expected: `✅ PASS` (this only checks the module loads cleanly — the one broken caller from the signature change is fixed in Task 11, do NOT restart pm2 yet if Task 11 isn't done in the same sitting).

- [ ] **Step 7: Commit**

```bash
git add src/automations/conversation/slot_booking.py
git commit -m "$(cat <<'EOF'
feat(booking): add DAY_SELECTED signal + by_day grouping + single-day live fetch

Lays the groundwork for booking-aware bumps: the AI now tags which day the
lead picked, and a new helper can re-check one specific day's availability
without walking the full 3-day lookahead.
EOF
)"
```

---

## Task 11: `ai_conversation.py` — parse DAY_SELECTED, write/clear pending_booking_context

**Files:**
- Modify: `/home/gabriel/automations/src/automations/ai_conversation.py:74-76` (regex block)
- Modify: `/home/gabriel/automations/src/automations/ai_conversation.py:516-517` (init the new `by_day` variable)
- Modify: `/home/gabriel/automations/src/automations/ai_conversation.py:546` (unpack 3 values)
- Modify: `/home/gabriel/automations/src/automations/ai_conversation.py:732-745` (add DAY_SELECTED parsing after SLOT_SELECTED parsing)
- Modify: `/home/gabriel/automations/src/automations/conversation/slot_booking.py:439-445` (clear `pending_booking_context` atomically with the booking write — same file as Task 10, different function)

**Interfaces:**
- Consumes: `_fetch_and_format_slots` new 3-tuple return (Task 10), `_DAY_SELECTED_RE`
- Produces: `Leads.pending_booking_context` gets written mid-conversation; cleared on successful booking

- [ ] **Step 1: Add the DAY_SELECTED regex next to SLOT_SELECTED**

Find:
```python
# Regex for parsing the {{SLOT_SELECTED: <ISO>}} signal emitted by the AI.
_SLOT_SELECTED_RE = re.compile(
    r"\{\{SLOT_SELECTED:\s*([^\}]+)\}\}", re.IGNORECASE
)
```
Replace with:
```python
# Regex for parsing the {{SLOT_SELECTED: <ISO>}} signal emitted by the AI.
_SLOT_SELECTED_RE = re.compile(
    r"\{\{SLOT_SELECTED:\s*([^\}]+)\}\}", re.IGNORECASE
)

# Regex for parsing the {{DAY_SELECTED: <YYYY-MM-DD>}} signal emitted by the
# AI when it moves from STAGE 1 (day picking) to STAGE 2 (time picking) of the
# conversational booking flow. See slot_booking.py's _fetch_and_format_slots.
_DAY_SELECTED_RE = re.compile(
    r"\{\{DAY_SELECTED:\s*([^\}]+)\}\}", re.IGNORECASE
)
```

- [ ] **Step 2: Initialize `_last_offered_by_day` alongside the existing slot variables**

Find:
```python
        _slot_injection_ctx: str | None = None
        _last_offered_slots: list[str] = []
```
Replace with:
```python
        _slot_injection_ctx: str | None = None
        _last_offered_slots: list[str] = []
        _last_offered_by_day: dict[str, list[str]] = {}
```

- [ ] **Step 3: Unpack the new 3rd return value**

Find:
```python
                _slot_injection_ctx, _last_offered_slots = await _fetch_and_format_slots(
                    lead=lead,
                    campaign_account=campaign_account,
                    booking_link=campaign_for_prompt.get("calendar_link", ""),
                    exec_id=exec_id,
                    include_calling_hint=not _prompt_has_calling_info,
                )
```
Replace with:
```python
                _slot_injection_ctx, _last_offered_slots, _last_offered_by_day = await _fetch_and_format_slots(
                    lead=lead,
                    campaign_account=campaign_account,
                    booking_link=campaign_for_prompt.get("calendar_link", ""),
                    exec_id=exec_id,
                    include_calling_hint=not _prompt_has_calling_info,
                )
```

- [ ] **Step 4: Parse DAY_SELECTED and persist `pending_booking_context`**

Find (the existing SLOT_SELECTED parsing block, to anchor the insertion point):
```python
        # Detect SLOT_SELECTED signal: {{SLOT_SELECTED: <ISO_TIMESTAMP>}}
        # The AI emits this (hidden from the lead) when the lead picks a specific slot.
        # We parse and strip it here, then create the Cal.diy booking below.
        _slot_selected_match = _SLOT_SELECTED_RE.search(ai_content)
        signal_slot_selected: str | None = None
        if _slot_selected_match:
            signal_slot_selected = _slot_selected_match.group(1).strip()
            # Strip the signal from the AI content (never sent to lead)
            ai_content = _SLOT_SELECTED_RE.sub("", ai_content).strip()
            log.info(
                "ai_conversation.slot_selected_detected",
                lead_id=lead_id,
                slot_iso=signal_slot_selected,
            )
```
Replace with:
```python
        # Detect SLOT_SELECTED signal: {{SLOT_SELECTED: <ISO_TIMESTAMP>}}
        # The AI emits this (hidden from the lead) when the lead picks a specific slot.
        # We parse and strip it here, then create the Cal.diy booking below.
        _slot_selected_match = _SLOT_SELECTED_RE.search(ai_content)
        signal_slot_selected: str | None = None
        if _slot_selected_match:
            signal_slot_selected = _slot_selected_match.group(1).strip()
            # Strip the signal from the AI content (never sent to lead)
            ai_content = _SLOT_SELECTED_RE.sub("", ai_content).strip()
            log.info(
                "ai_conversation.slot_selected_detected",
                lead_id=lead_id,
                slot_iso=signal_slot_selected,
            )

        # Detect DAY_SELECTED signal: {{DAY_SELECTED: <YYYY-MM-DD>}}
        # The AI emits this when it moves into STAGE 2 (offering times for a
        # specific day). If the lead then goes quiet before confirming a time,
        # bump_scheduler.py's booking-nudge path uses this to re-offer fresh
        # times instead of a generic re-engagement message. Only meaningful
        # when no slot was confirmed this same turn (a confirmed booking means
        # there's nothing left to nudge).
        _day_selected_match = _DAY_SELECTED_RE.search(ai_content)
        if _day_selected_match:
            ai_content = _DAY_SELECTED_RE.sub("", ai_content).strip()
            if signal_slot_selected is None:
                _day_iso = _day_selected_match.group(1).strip()
                _day_times = _last_offered_by_day.get(_day_iso, [])
                if _day_times:
                    try:
                        await update_lead_fields(
                            lead_id,
                            pending_booking_context=json.dumps({
                                "day": _day_iso,
                                "offered_slots": _day_times,
                                "timezone": (
                                    lead.get("time_zone")
                                    or campaign_account.get("account_timezone")
                                    or campaign_account.get("timezone")
                                    or "Europe/Amsterdam"
                                ),
                            }),
                        )
                        log.info(
                            "ai_conversation.pending_booking_context_set",
                            lead_id=lead_id,
                            day=_day_iso,
                        )
                    except Exception as _pbc_exc:
                        log.error(
                            "ai_conversation.pending_booking_context_write_failed",
                            lead_id=lead_id,
                            error=str(_pbc_exc),
                        )
```

- [ ] **Step 5: Clear `pending_booking_context` atomically when a booking succeeds**

This is in `slot_booking.py`'s `_create_booking_from_slot`, not `ai_conversation.py` — clearing it in the same atomic update as the booking write avoids any race where a webhook or the next bump cycle could see stale pending state.

Find (in `/home/gabriel/automations/src/automations/conversation/slot_booking.py`):
```python
        update_kwargs: dict = {
            "calcom_booking_uid": result["uid"],
            "booking_confirmation_sent": True,
        }
        if booked_dt is not None:
            update_kwargs["booked_call_date"] = booked_dt
        await update_lead_fields(lead_id, **update_kwargs)
        return result
```
Replace with:
```python
        update_kwargs: dict = {
            "calcom_booking_uid": result["uid"],
            "booking_confirmation_sent": True,
            "pending_booking_context": None,
        }
        if booked_dt is not None:
            update_kwargs["booked_call_date"] = booked_dt
        await update_lead_fields(lead_id, **update_kwargs)
        return result
```

- [ ] **Step 6: Preflight + restart**

Run: `cd /home/gabriel/automations && ./preflight.sh`
Expected: `✅ PASS` (confirms the `_fetch_and_format_slots` signature change from Task 10 is now fully consistent across both files).
Run: `pm2 restart leadawaker-engine --update-env && pm2 logs leadawaker-engine --lines 20 --nostream`
Expected: clean startup, no traceback.

- [ ] **Step 7: Manual conversation smoke test**

Using the `bot-test` skill (or a manual WhatsApp test conversation against a call-mode test campaign), simulate: agree to a call → get offered days → pick a day → confirm the AI's reply does NOT show a literal `{{DAY_SELECTED: ...}}` string to the "lead" (it must be stripped) → check `pm2 logs leadawaker-engine --lines 50 --nostream | grep pending_booking_context_set` shows the write fired with the correct day. Then continue the conversation, pick a time, confirm booking succeeds and `pending_booking_context_write_failed` never fires.

- [ ] **Step 8: Commit**

```bash
git add src/automations/ai_conversation.py src/automations/conversation/slot_booking.py
git commit -m "$(cat <<'EOF'
feat(booking): persist pending_booking_context when a lead picks a day but not a time

Sets Leads.pending_booking_context from the new {{DAY_SELECTED}} signal so
the bump scheduler can nudge with fresh slots instead of a generic
re-engagement message. Cleared atomically when the booking actually completes.
EOF
)"
```

---

## Task 12: `generate_booking_nudge_bump()` in ai_bump_generator.py

**Files:**
- Modify: `/home/gabriel/automations/src/automations/ai_bump_generator.py`

**Interfaces:**
- Consumes: `_format_relative_date` (from `src.automations.conversation.helpers`, already used elsewhere in this file's siblings)
- Produces: `generate_booking_nudge_bump(lead: dict, campaign_account: dict, day_iso: str, times: list[str], link: str, *, voice_mode: bool = False) -> str | None` — consumed by Task 13

- [ ] **Step 1: Add the system prompt template and the function**

Add this after `_REENGAGEMENT_SYSTEM_PROMPT`'s closing `"""` and before `async def generate_reengagement_bump`:

```python
_BOOKING_NUDGE_SYSTEM_PROMPT = """\
You are {agent_name}, following up with {first_name} about booking a call.

YOUR IDENTITY
- Name: {agent_name}
- Style: {ai_style}
- You work at {company_name}
- Service: {service_name}

WHAT HAPPENED
{first_name} was picking a time for {day_label} but went quiet before confirming.
Ask if one of the times below still works. If none of them will, offer the link
so they can pick another moment themselves.

AVAILABLE TIMES FOR {day_label}:
{times_block}

BOOKING LINK (mention it naturally as a fallback, e.g. "or grab any time here"):
{link}

RULES
1. Keep it under {max_chars} characters. One message only.
2. Sound human and casual, not salesy or like a list.
3. Reference the specific times naturally, don't just dump them mechanically.
4. Always include the link so they have a way to self-serve if the times don't fit.
5. Never reveal you are an AI.
6. Always write in {language}.
7. Never use em dashes. Use commas, periods, or colons instead.

{voice_mode_block}"""


async def generate_booking_nudge_bump(
    lead: dict,
    campaign_account: dict,
    day_iso: str,
    times: list[str],
    link: str,
    *,
    voice_mode: bool = False,
) -> str | None:
    """
    Generate a follow-up for a lead who named a booking day but never
    confirmed a time. `times` must be freshly re-fetched ISO datetimes for
    `day_iso` — never pass stale previously-offered slots, availability may
    have changed since. Returns None on failure (caller falls back to a
    plain link-only message).
    """
    from datetime import datetime as _dt
    from src.automations.conversation.helpers import _format_relative_date

    lead_id = lead["id"]

    agent_name = campaign_account.get("agent_name") or campaign_account.get("default_ai_name") or "Assistant"
    ai_style = campaign_account.get("default_ai_style") or "Natural, human, low pressure"
    company_name = campaign_account.get("name") or "the company"
    language = lead.get("language") or campaign_account.get("language") or "English"
    _campaign_lang = _norm_lang(campaign_account.get("language") or "en")
    service_name = resolve_lang(campaign_account.get("service_name"), _campaign_lang) or campaign_account.get("campaign_service") or "our service"
    first_name = lead.get("first_name") or "there"

    try:
        day_label = _format_relative_date(_dt.fromisoformat(day_iso))
    except Exception:
        day_label = day_iso

    def _fmt_time(iso_str: str) -> str:
        try:
            return _dt.fromisoformat(iso_str.replace(".000", "")).strftime("%H:%M")
        except Exception:
            return iso_str

    times_block = "\n".join(f"  - {_fmt_time(t)}" for t in times)

    channel = campaign_account.get("channel") or "sms"
    max_chars = 160 if channel == "whatsapp" else 120

    voice_mode_block = ""
    if voice_mode:
        voice_mode_block = (
            "\n\nVOICE MODE — spoken aloud as a voice memo via TTS. Write like someone "
            "talking into their phone. Start with 'Hey {first_name}'. No emojis, no "
            "'...'. Keep it under 30 words."
        ).format(first_name=first_name)

    system = _BOOKING_NUDGE_SYSTEM_PROMPT.format(
        agent_name=agent_name,
        first_name=first_name,
        ai_style=ai_style,
        company_name=company_name,
        service_name=service_name,
        day_label=day_label,
        times_block=times_block,
        link=link or "(no link available)",
        max_chars=max_chars,
        language=language,
        voice_mode_block=voice_mode_block,
    )

    try:
        result = await generate_response(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": "Write the follow-up now. Just the message text, nothing else."},
            ],
            model=campaign_account.get("ai_model") or settings.default_ai_model,
            temperature=0.7,
            max_tokens=200,
        )
        content = result["content"].strip()
        if content.startswith('"') and content.endswith('"'):
            content = content[1:-1]
        if not content:
            log.warning("booking_nudge.empty_response", lead_id=lead_id)
            return None

        check = validate_output(content, max_length=max_chars + 50)
        if not check["safe"]:
            log.warning("booking_nudge.guardrail_failed", lead_id=lead_id, violations=check["violations"])
            return None

        log.info("booking_nudge.generated", lead_id=lead_id, length=len(content))
        return content
    except Exception as exc:
        log.error("booking_nudge.generation_failed", lead_id=lead_id, error=str(exc))
        return None
```

- [ ] **Step 2: Sanity-check time formatting helper logic in isolation**

Run: `cd /home/gabriel/automations && .venv/bin/python -c "
from datetime import datetime
def _fmt_time(iso_str):
    try:
        return datetime.fromisoformat(iso_str.replace('.000', '')).strftime('%H:%M')
    except Exception:
        return iso_str
assert _fmt_time('2026-07-07T13:00:00.000+02:00') == '13:00'
assert _fmt_time('garbage') == 'garbage'
print('OK')
"`
Expected: `OK`.

- [ ] **Step 3: Preflight + restart**

Run: `./preflight.sh && pm2 restart leadawaker-engine --update-env`
Then: `pm2 logs leadawaker-engine --lines 20 --nostream` — expect clean startup.

- [ ] **Step 4: Commit**

```bash
git add src/automations/ai_bump_generator.py
git commit -m "feat(bumps): add generate_booking_nudge_bump for mid-booking ghosts"
```

---

## Task 13: `bump_scheduler.py` — the booking-nudge branch

**Files:**
- Modify: `/home/gabriel/automations/src/automations/bump_scheduler.py` (imports, `_process_lead` early branch, new `_handle_booking_nudge` function)

**Interfaces:**
- Consumes: `Leads.pending_booking_context` (Task 11 writes it), `_get_fresh_times_for_day` + `_fetch_and_format_slots` (Task 10), `generate_booking_nudge_bump` (Task 12)

- [ ] **Step 1: Add imports**

Find:
```python
from src.automations.ai_bump_generator import (
    generate_ai_bump,
    generate_reengagement_bump,
    AI_BUMP_ELIGIBLE_STATUSES,
    AI_BUMP_MIN_RESPONSES,
)
```
Replace with:
```python
from src.automations.ai_bump_generator import (
    generate_ai_bump,
    generate_reengagement_bump,
    generate_booking_nudge_bump,
    AI_BUMP_ELIGIBLE_STATUSES,
    AI_BUMP_MIN_RESPONSES,
)
from src.automations.conversation.slot_booking import (
    _fetch_and_format_slots,
    _get_fresh_times_for_day,
)
```

Find the top of the file's other imports:
```python
from datetime import datetime, timedelta, timezone

import structlog
```
Replace with:
```python
import json
from datetime import datetime, timedelta, timezone

import structlog
```

- [ ] **Step 2: Add the early branch in `_process_lead`, right after the Contact Later check**

Find:
```python
    # Contact Later re-engagement takes precedence over normal bump logic.
    # The lead asked to be reached on a future date; next_action_at gated them
    # out until now. Re-open warmly, drop the tag, and resume the normal flow.
    if CONTACT_LATER_TAG in (lead.get("tag_names") or []):
        await _handle_contact_later_reengagement(lead, data, exec_id)
        return

    max_bumps = data.get("max_bumps") or 4
```
Replace with:
```python
    # Contact Later re-engagement takes precedence over normal bump logic.
    # The lead asked to be reached on a future date; next_action_at gated them
    # out until now. Re-open warmly, drop the tag, and resume the normal flow.
    if CONTACT_LATER_TAG in (lead.get("tag_names") or []):
        await _handle_contact_later_reengagement(lead, data, exec_id)
        return

    # Booking-in-progress also takes precedence: the lead named a day but
    # never confirmed a time. Re-offer fresh slots instead of a generic bump.
    if lead.get("pending_booking_context"):
        await _handle_booking_nudge(lead, data, exec_id)
        return

    max_bumps = data.get("max_bumps") or 4
```

- [ ] **Step 3: Add `_handle_booking_nudge`**

Add this new function after `_handle_bumps_exhausted` and before `_handle_contact_later_reengagement`:

```python
async def _handle_booking_nudge(lead: dict, data: dict, exec_id: str) -> None:
    """
    Nudge a lead who named a booking day but never confirmed a time.

    Always re-fetches live availability — the stored offered_slots are only
    the trigger, never the source of truth for what to say, since the day may
    have passed or the slot may have been taken by someone else. Sends once,
    then clears pending_booking_context so the lead falls back into whatever
    numbered-bump stage it was already at.
    """
    lead_id = lead["id"]
    campaign_id = lead.get("Campaigns_id")
    account_id = data["Accounts_id"]

    tz_name = data.get("account_timezone") or "UTC"
    bh_start = data.get("active_hours_start") or data.get("account_bh_start")
    bh_end = data.get("active_hours_end") or data.get("account_bh_end")
    if not is_within_business_hours(tz_name, bh_start, bh_end):
        return

    try:
        context = json.loads(lead["pending_booking_context"])
    except (TypeError, ValueError, KeyError):
        # Corrupt/unreadable state — clear it so the lead isn't stuck here
        # forever, fall through to normal bumps next cycle.
        await update_lead_fields(lead_id, pending_booking_context=None)
        log.warning("bump_scheduler.booking_nudge.bad_context", lead_id=lead_id)
        return

    lead_tz = context.get("timezone") or "Europe/Amsterdam"
    day_iso = context.get("day") or ""
    today_iso = datetime.now(timezone.utc).date().isoformat()

    times: list[str] = []
    if day_iso and day_iso >= today_iso:
        times = await _get_fresh_times_for_day(data, day_iso, lead_tz)

    link = (
        data.get("calendar_link_override")
        or data.get("booking_url")
        or data.get("calendar_link")
        or settings.default_booking_url
    ).strip()

    if not times:
        # Stored day has passed or has no live openings — fall back to the
        # next available day using the same 3-day lookahead the live
        # conversation uses.
        _, _, by_day = await _fetch_and_format_slots(
            lead=lead, campaign_account=data, booking_link=link, exec_id=exec_id,
            include_calling_hint=False,
        )
        if by_day:
            day_iso = next(iter(by_day))
            times = by_day[day_iso]

    lead_language = lead.get("language") or data.get("language") or "English"
    channel = data.get("channel") or "sms"
    voice_mode = channel == "whatsapp" and bool(data.get("bump_1_voice_note"))

    per_lead_link = None
    if link:
        token = await get_or_create_booking_link(lead_id, link)
        booking_mode_call = data.get("booking_mode_call")
        if booking_mode_call is None:
            booking_mode_call = True
        link_prefix = "book" if booking_mode_call else "join"
        per_lead_link = await build_lead_booking_url(lead, account_id, link, token, lead_id, link_prefix)

    body: str | None = None
    if times:
        body = await generate_booking_nudge_bump(
            lead, data, day_iso, times, per_lead_link or link, voice_mode=voice_mode,
        )

    if not body:
        # AI failed, or no live times anywhere — plain link-only fallback.
        first_name = lead.get("first_name") or "there"
        if per_lead_link or link:
            body = f"Hey {first_name}, still want to grab a time? Pick whatever works here: {per_lead_link or link}"
        else:
            body = f"Hey {first_name}, just checking in on that booking, still interested?"
        if lead_language.lower() not in ("english", "en"):
            from tools.ai_service import translate_message
            body = await translate_message(body, lead_language, model=data.get("ai_model") or None)

    async with AsyncLogStep(
        "bump_scheduler", "send_booking_nudge",
        workflow_execution_id=exec_id,
        accounts_id=account_id,
        campaigns_id=campaign_id,
        leads_id=lead_id,
    ) as step:
        sent = await send_message(
            channel=channel, body=body, lead_id=lead_id,
            phone=lead.get("phone"),
            channel_identifier=lead.get("channel_identifier"),
            twilio_from=data.get("twilio_default_from_number"),
            messaging_service_sid=data.get("twilio_messaging_service_sid"),
            account_sid=data.get("twilio_account_sid"),
            auth_token=data.get("twilio_auth_token"),
            instagram_access_token=data.get("instagram_access_token"),
            instagram_user_id=data.get("instagram_user_id"),
            use_voice=voice_mode,
            tts_voice_id=resolve_tts_voice_id(data, lead_language),
        )
        result = sent["result"]
        if not result["success"]:
            raise RuntimeError(f"Send failed: {result.get('error')}")

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        await update_lead_fields(
            lead_id,
            pending_booking_context=None,
            next_action_at=now + timedelta(hours=24),
            last_message_sent_at=now,
        )
        await increment_message_count(lead_id, "outbound")

        await create_interaction(
            accounts_id=account_id,
            campaigns_id=campaign_id,
            leads_id=lead_id,
            who=data.get("agent_name") or "System",
            direction="outbound",
            content=body,
            status="Sent",
            twilio_message_sid=result.get("message_sid"),
            from_number=sent["from_addr"],
            to_number=sent["to_addr"],
            is_bump=False,
            triggered_by="booking_nudge",
            ai_generated=bool(times),
            attachment=sent["voice_url"],
        )
        step.output = sent["send_id"]

    log.info("bump_scheduler.booking_nudge_sent", lead_id=lead_id, day=day_iso, had_live_times=bool(times))
```

- [ ] **Step 4: Preflight + restart**

Run: `cd /home/gabriel/automations && ./preflight.sh`
Expected: `✅ PASS`.
Run: `pm2 restart leadawaker-engine --update-env && pm2 logs leadawaker-engine --lines 20 --nostream`
Expected: clean startup, no traceback.

- [ ] **Step 5: Commit**

```bash
git add src/automations/bump_scheduler.py
git commit -m "$(cat <<'EOF'
feat(bumps): booking-aware nudge for leads who named a day but ghosted before confirming a time

Re-fetches live availability at bump time (never trusts stale offered
slots), falls back to the next available day if the original has passed,
and falls back to a plain booking-link message if the calendar is
unreachable. Sends once, then clears pending_booking_context so the lead
resumes normal bump progression.
EOF
)"
```

---

## Task 14: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm the engine is healthy after all changes**

Run: `pm2 logs leadawaker-engine --lines 50 --nostream`
Expected: no tracebacks since the Task 13 restart; scheduler jobs (`campaign_launcher`, `bump_scheduler`, etc.) still firing on their normal cadence.

- [ ] **Step 2: Manually exercise the full booking-aware bump path against a test lead**

Using a test campaign in call mode (not campaign 60/61, to avoid touching the live demo booking account) with a real Cal.diy/Cal.com integration:
1. Send an inbound message that gets the AI to offer a call, agree to it, and get to STAGE 1 (pick a day).
2. Reply naming one of the offered days (e.g. "Thursday works").
3. Confirm the AI's STAGE 2 reply shows real times for that day, and does NOT leak a literal `{{DAY_SELECTED: ...}}` string.
4. Check the lead's `pending_booking_context` column is now populated: `.venv/bin/python -c "
import asyncio
from tools.db.leads import get_lead
async def main():
    lead = await get_lead(<test_lead_id>)
    print(lead.get('pending_booking_context'))
asyncio.run(main())
"` — expect a JSON string with `day`/`offered_slots`/`timezone`.
5. Go silent (don't reply). Manually set `next_action_at` to the past for this lead so `bump_scheduler` picks it up on its next 5-minute cycle (or wait for the natural delay), then check `pm2 logs leadawaker-engine --lines 100 --nostream | grep booking_nudge` for `bump_scheduler.booking_nudge_sent`.
6. Confirm the resulting WhatsApp/SMS message re-offers times for the chosen day (or the next available day, if enough time passed) plus the booking link.
7. Confirm `pending_booking_context` is now `None` on the lead.

Expected: all 7 checks pass. If step 3 fails (AI leaks the raw tag or doesn't emit it), the STAGE 2 prompt instruction from Task 10 Step 3 needs tightening — this is a prompt-engineering iteration, not a code bug, and should be treated as expected refinement rather than a blocker.

- [ ] **Step 3: Spot-check the Wardrope seed on the discovery demo**

Open campaign 61 in the CRM, confirm all 4 bump templates and the reengagement starter read correctly in both the edit form (AI tab) and the read-only summary panel (all 4 BumpCards visible per Task 8).

- [ ] **Step 4: Confirm no regressions in the plain (non-booking) bump path**

Trigger a normal static-template bump on any other active test lead (or wait for a natural cycle), confirm it still sends correctly and `current_bump_stage`/`next_action_at` advance as expected — this exercises the `_compute_next_delay_hours` refactor from Task 4 on the main send path, not just the skip path.

---

## Execution Notes

- Tasks 1-2 must run first (both repos depend on the new columns existing).
- Tasks 3-9 are independent of each other and of Tasks 10-13 — safe to parallelize across subagents.
- Tasks 10-13 are strictly sequential (each depends on the previous task's new function/signature).
- Task 14 must run last.
