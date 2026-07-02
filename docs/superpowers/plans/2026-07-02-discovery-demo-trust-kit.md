# Discovery Demo Trust Kit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three build items from `docs/superpowers/specs/2026-07-02-discovery-demo-trust-kit-design.md`: an owner-editable "objection playbook" the AI must obey, a campaign-settings panel reorg that puts the opener + playbook on the screenshared Business panel, and a `{first_message}` prompt variable so the conversation engine always knows what opener a lead is replying to.

**Architecture:** Two repos change together. In the CRM (`/home/gabriel/LeadAwakerApp`, Express + Drizzle + React): add one `jsonb` column on `Campaigns`, wire it through the existing generic PATCH route (no route/storage code changes needed — it's already schema-driven), and move 5 existing fields between two campaign-settings tab components. In the automation engine (`/home/gabriel/automations`, separate Python/asyncpg service, pm2-managed, **no auto-reload**): append an `[OBJECTION PLAYBOOK]` block to the system prompt when the campaign has one configured, and expose `{first_message}` as a resolvable prompt template variable.

**Tech Stack:** React + TypeScript (Vite), Drizzle ORM (node-postgres, auto-parses jsonb), Express, Python 3 + asyncpg (jsonb columns come back as **raw JSON strings**, not parsed — must `json.loads` explicitly).

## Global Constraints

- Never run `npm run dev` — the CRM runs via pm2 (`tsx watch`) and auto-reloads server/shared changes in ~5-8s. Verify via `pm2 logs`, not by starting a second server.
- Never run `npx tsc --noEmit` unless Gabriel explicitly asks. Do not run it as part of this plan.
- `npm run db:push` fails on the Pi (no TTY). New columns are added via a direct `pg` script run as `node --env-file=.env <script>.js`, following the existing `migrate-campaign-type.js` pattern.
- Every user-facing string goes through i18n. Campaign-settings strings live in `client/src/locales/{en,nl}/campaigns.json` under the `config` key. **en + nl only** — Portuguese was dropped product-wide (2026-06-30); do not touch `client/src/locales/pt/`.
- The Python automation engine (`/home/gabriel/automations`) runs via pm2 as `leadawaker-engine` in **plain fork mode with watch disabled** — code edits there have zero effect until `./preflight.sh && pm2 restart leadawaker-engine --update-env` is run, and only if preflight PASSes.
- asyncpg does not auto-decode `jsonb` columns — always guard with `json.loads()` when the value is a `str`, matching the existing pattern in `src/automations/lead_close_summary.py:117-124` (ai_memory parsing).
- Drizzle's node-postgres driver DOES auto-parse `jsonb` columns to JS objects/arrays on both read and write — the frontend must send/receive the objection playbook as a real JS array, never a `JSON.stringify`'d string (unlike the existing `{en,nl}` multilingual text fields, which intentionally store stringified JSON in `text` columns).
- Out of scope (per spec): test-send button, meta-objection script, PDF/web-search, and the STEP 1/2 prompt-content changes (Part 6 of the spec) — those are a separate content session run by Gabriel, not built here.

---

## Task 1: Add the `objection_playbook` DB column (migration)

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/migrate-objection-playbook.js`

**Interfaces:**
- Produces: a `"objection_playbook" jsonb DEFAULT NULL` column on the `Campaigns` table, which Task 2's schema change will declare in Drizzle.

This must land **before** Task 2, because the moment `shared/schema.ts` is saved, the pm2-watched dev server reloads and every `db.select().from(campaigns)` query (which Drizzle compiles to a column-by-name `SELECT`, not `SELECT *`) will break on `app.leadawaker.com` if the DB column doesn't exist yet.

- [ ] **Step 1: Write the migration script**

```javascript
// Discovery Demo Trust Kit — add Campaigns.objection_playbook (Part 3 of spec).
// Run on the Pi with:  node --env-file=.env migrate-objection-playbook.js
// Idempotent: safe to re-run. db:push has no TTY on the Pi, so we go direct.
// NocoDB keeps tables in a generated schema (not public), so resolve it first.
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
  console.log(`→ target: ${T}`);

  await client.query(
    `ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "objection_playbook" jsonb DEFAULT NULL;`
  );
  console.log('✓ column objection_playbook ensured (jsonb, default NULL)');

  const check = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'Campaigns' AND column_name = 'objection_playbook';`,
    [schema]
  );
  console.log('column check:', check.rows[0]);

  console.log('\n✅ objection_playbook migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
```

- [ ] **Step 2: Run it on the Pi**

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env migrate-objection-playbook.js`

Expected output ends with:
```
column check: { column_name: 'objection_playbook', data_type: 'jsonb' }

✅ objection_playbook migration complete
```

- [ ] **Step 3: Commit**

```bash
git add migrate-objection-playbook.js
git commit -m "chore(db): add Campaigns.objection_playbook jsonb column"
```

---

## Task 2: Schema + Zod validation for `objection_playbook`

**Files:**
- Modify: `shared/schema.ts:482` (add column), `shared/schema.ts:526-533` (add Zod override)

**Interfaces:**
- Consumes: the DB column from Task 1.
- Produces: `Campaigns["objectionPlaybook"]` typed as `{ objection: string; answer: string }[] | null`, validated by `insertCampaignsSchema` — the PATCH route (`server/routes/campaigns.ts:347`) and storage layer (`server/storage/campaigns.ts:131-134`) already accept any field declared here with **zero code changes**, since both are schema-generic (`insertCampaignsSchema.partial().safeParse(...)` → `db.update(campaigns).set(data)`).

- [ ] **Step 1: Add the column to the `campaigns` table definition**

In `shared/schema.ts`, insert immediately after line 482 (`firstMessage: text("First_Message"),`):

```typescript
  firstMessage: text("First_Message"),
  // Discovery Demo Trust Kit: up to 3 owner-approved {objection, answer} pairs,
  // injected into the AI's system prompt verbatim-in-substance (see Part 3 of
  // docs/superpowers/specs/2026-07-02-discovery-demo-trust-kit-design.md).
  objectionPlaybook: jsonb("objection_playbook").$type<{ objection: string; answer: string }[]>(),
```

- [ ] **Step 2: Add Zod validation override**

Replace lines 526-533:

```typescript
export const insertCampaignsSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Campaigns = typeof campaigns.$inferSelect;
export type InsertCampaigns = z.infer<typeof insertCampaignsSchema>;
```

with:

```typescript
export const insertCampaignsSchema = createInsertSchema(campaigns, {
  objectionPlaybook: z.array(z.object({
    objection: z.string().max(500),
    answer: z.string().max(500),
  })).max(3).nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Campaigns = typeof campaigns.$inferSelect;
export type InsertCampaigns = z.infer<typeof insertCampaignsSchema>;
```

- [ ] **Step 3: Verify the column round-trips through the API**

The pm2-watched server auto-reloads on save (~5-8s). After it reloads, run against a real campaign id (replace `123` and the session cookie — reuse `leadawaker@gmail.com` / `Admin1234` login, see `reference_app_admin_login` memory, or just check via the browser network tab instead of curl if no session token is handy):

```bash
curl -s -X PATCH https://app.leadawaker.com/api/campaigns/123 \
  -H "Content-Type: application/json" \
  -b "<session-cookie>" \
  -d '{"objection_playbook":[{"objection":"too expensive","answer":"we price per project, not per hour"}]}' | python3 -m json.tool
```

Expected: response JSON includes `"objection_playbook": [{"objection": "too expensive", "answer": "we price per project, not per hour"}]` and no 400/500. If a session cookie isn't easily available, skip curl and verify this at the end of Task 3 through the actual UI instead — functionally equivalent.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(schema): add Campaigns.objectionPlaybook column + validation"
```

---

## Task 3: Objection Playbook UI (Business panel) + i18n

**Files:**
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx`
- Modify: `client/src/features/campaigns/components/useCampaignDetail.ts:289` (buildDraft default)
- Modify: `client/src/locales/en/campaigns.json`, `client/src/locales/nl/campaigns.json`

**Interfaces:**
- Consumes: `objection_playbook` field from Task 2 (draft key uses the DB column name, snake_case — matches every other field in this file, e.g. `first_touch`, `inquiry_timeframe`; `server/dbKeys.ts` derives the camelCase↔snake_case mapping automatically from the Drizzle column name, no extra code needed there).
- Produces: `draft.objection_playbook: { objection: string; answer: string }[]` (always exactly 3 slots, blank ones allowed) that Task 4's panel reorg and the auto-save pipeline (`useCampaignDetail.ts:354-366`, 1.5s debounce → PATCH) both rely on unchanged.

- [ ] **Step 1: Add a stable default for the new field in `buildDraft`**

In `client/src/features/campaigns/components/useCampaignDetail.ts`, insert after line 289 (`inquiry_timeframe: (c as any).inquiry_timeframe || "",`):

```typescript
    inquiry_timeframe: (c as any).inquiry_timeframe || "",
    objection_playbook: (c as any).objection_playbook ?? [
      { objection: "", answer: "" },
      { objection: "", answer: "" },
      { objection: "", answer: "" },
    ],
```

- [ ] **Step 2: Add i18n keys**

In `client/src/locales/en/campaigns.json`, insert after line 327 (`"launchNameHint": "..."`, right before `"sections": {`):

```json
    "objectionPlaybook": "Objection playbook",
    "objectionPlaybookHint": "Up to 3 objections the AI should recognize, with your approved answer for each. Edit live — the AI uses your wording on its next reply.",
    "objectionLabel": "Objection {{n}}",
    "objectionPlaceholder": "e.g. \"It's too expensive\"",
    "answerPlaceholder": "Your approved answer…",
```

In `client/src/locales/nl/campaigns.json`, insert at the same position (after the `launchNameHint` line, before `"sections": {`):

```json
    "objectionPlaybook": "Bezwaren-script",
    "objectionPlaybookHint": "Tot 3 bezwaren die de AI moet herkennen, met jouw goedgekeurde antwoord voor elk. Live aanpasbaar — de AI gebruikt jouw woorden in het volgende bericht.",
    "objectionLabel": "Bezwaar {{n}}",
    "objectionPlaceholder": "bijv. \"Het is te duur\"",
    "answerPlaceholder": "Jouw goedgekeurde antwoord…",
```

- [ ] **Step 3: Add the icon import**

In `BusinessSectionFields.tsx`, change the import at line 2-5 from:

```typescript
import {
  Clock, Bot, Building2,
  MousePointerClick, Award, Megaphone, BookOpen, Paintbrush, MapPin, UserRound,
} from "lucide-react";
```

to:

```typescript
import {
  Clock, Bot, Building2,
  MousePointerClick, Award, Megaphone, BookOpen, Paintbrush, MapPin, UserRound,
  HelpCircle,
} from "lucide-react";
```

- [ ] **Step 4: Add the 3-row playbook renderer + section**

In `BusinessSectionFields.tsx`, insert this helper function right after the `onTextChange` function (after line 77, before the `return (`):

```typescript
  type ObjectionRow = { objection: string; answer: string };
  const objectionRows = (): ObjectionRow[] => {
    const raw = (draft.objection_playbook ?? campaign.objection_playbook) as ObjectionRow[] | undefined;
    return [0, 1, 2].map((i) => raw?.[i] ?? { objection: "", answer: "" });
  };
  const updateObjectionRow = (idx: number, patch: Partial<ObjectionRow>) => {
    const rows = objectionRows();
    rows[idx] = { ...rows[idx], ...patch };
    setDraft(d => ({ ...d, objection_playbook: rows }));
  };
```

Then, inside the `return (<div style={{ display: 'grid', ... }}>...</div>)`, insert this block right after the knowledge-base `<div style={{ gridColumn: '1 / -1' }}>...kb...</div>` (after line 228, before the closing `</div>` at line 229):

```typescript
      {/* Objection playbook — up to 3 owner-approved objection/answer pairs,
          injected into the AI's system prompt (Part 3 of the trust-kit spec). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={HelpCircle} label={t("config.objectionPlaybook")} value={null}
          description={t("config.objectionPlaybookHint")}
          editChild={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md, 12px)' }}>
              {[0, 1, 2].map((idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
                  <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: 'var(--mute-2)' }}>
                    {t("config.objectionLabel", { n: idx + 1 })}
                  </span>
                  <EditText
                    value={objectionRows()[idx].objection}
                    onChange={(v) => updateObjectionRow(idx, { objection: v.slice(0, 500) })}
                    placeholder={t("config.objectionPlaceholder")}
                  />
                  <EditText
                    value={objectionRows()[idx].answer}
                    onChange={(v) => updateObjectionRow(idx, { answer: v.slice(0, 500) })}
                    multiline
                    minRows={2}
                    placeholder={t("config.answerPlaceholder")}
                  />
                </div>
              ))}
            </div>
          }
        />
      </div>
```

- [ ] **Step 5: Manual verification**

pm2 auto-reloads the frontend dev build. In the browser at `app.leadawaker.com`, open any campaign → Business panel:
1. Confirm an "Objection playbook" section renders with 3 objection/answer row pairs below Knowledge Base.
2. Type into row 1's objection + answer fields, wait ~2s (debounced auto-save), refresh the page.
3. Confirm the typed text persists after reload (proves the PATCH → DB round trip works end-to-end).

If Gabriel wants a screenshot-verified pass, suggest the **playwright-cli** skill here rather than doing it manually.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/campaigns/components/settings/BusinessSectionFields.tsx \
        client/src/features/campaigns/components/useCampaignDetail.ts \
        client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json
git commit -m "feat(campaigns): add objection playbook UI to Business panel"
```

---

## Task 4: Panel reorg — move 5 fields between Business and AI panels

**Files:**
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx`
- Modify: `client/src/features/campaigns/components/settings/AISectionFields.tsx`

**Interfaces:**
- Consumes: nothing new — all 5 fields (`First_Message`, `description`, `inquiry_timeframe`, `what_lead_did`, `first_touch`) already exist in `draft`/`campaign` from the existing `buildDraft` (`useCampaignDetail.ts:225,249,256,289`; `first_touch` isn't currently defaulted in `buildDraft` either — it already works today via the `campaign.first_touch ?? ""` fallback pattern used inline, same as before the move).
- Produces: no new keys — this task only relocates existing JSX blocks and their supporting helpers between the two files. Per the spec (Build Summary table), this is exactly 5 field moves, nothing else — do not touch `company_name`, `agent_name`, `ai_style_override`, `service_name`, `campaign_usp`, or `kb`, which stay on the Business panel unchanged.

- [ ] **Step 1: Remove the 4 fields from `BusinessSectionFields.tsx`**

Delete these 4 blocks entirely from `BusinessSectionFields.tsx` (matching the content read during planning — verify exact match before deleting, since line numbers may have shifted after Task 3's edits):

Block A — What Lead Did (originally lines 117-129):
```typescript
      {/* Stage of Sales Process — multilingual dropdown */}
      <InfoRow icon={MousePointerClick} label={t("config.whatLeadDid")}
        value={displayLabel("what_lead_did", campaign.what_lead_did)}
        {...editFor("what_lead_did")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("what_lead_did", draft.what_lead_did ?? campaign.what_lead_did)}
            onChange={(store) => setDraft(d => ({...d, what_lead_did: store}))}
            options={comboOptions("what_lead_did", WHAT_LEAD_DID_OPTIONS)}
            {...focusFor("what_lead_did")}
          />
        ) : undefined}
      />
```

Block B — Inquiry Date (originally lines 145-155):
```typescript
      <InfoRow icon={Clock} label={t("config.inquiryDate")} value={displayText(campaign.inquiry_timeframe)}
        {...editFor("inquiry_timeframe")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.inquiry_timeframe ?? campaign.inquiry_timeframe)}
            onChange={(v) => onTextChange("inquiry_timeframe", draft.inquiry_timeframe ?? campaign.inquiry_timeframe, v)}
            placeholder="e.g. Last 6 months, 2+ years ago"
            {...focusFor("inquiry_timeframe")}
          />
        ) : undefined}
      />
```

Block C — First Touch (originally lines 157-169):
```typescript
      {/* First Touch — how the lead first contacted the business */}
      <InfoRow icon={MapPin} label={t("config.firstTouch")}
        value={displayLabel("first_touch", campaign.first_touch)}
        {...editFor("first_touch")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("first_touch", draft.first_touch ?? campaign.first_touch)}
            onChange={(store) => setDraft(d => ({...d, first_touch: store}))}
            options={comboOptions("first_touch", FIRST_TOUCH_OPTIONS)}
            {...focusFor("first_touch")}
          />
        ) : undefined}
      />
```

Block D — Business Description (originally lines 199-211):
```typescript
      <InfoRow icon={Building2} label={t("config.businessDescription")}
        value={displayText(draft.description ?? campaign.description)} richText={true} noBorder
        {...editFor("description")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.description ?? campaign.description)}
            onChange={(v) => onTextChange("description", draft.description ?? campaign.description, v)}
            multiline minRows={4}
            placeholder={placeholderFor("business_description", uiLang)}
            {...focusFor("description")}
          />
        ) : undefined}
      />
```

After removing these 4 blocks, `MousePointerClick`, `Clock`, and `MapPin` become unused imports in `BusinessSectionFields.tsx` — remove them from the lucide-react import (keep `Building2`, still used by company_name and now needed for nothing else — check: `Building2` is ALSO used by the company_name `InfoRow` at the top of the file, so keep it). Also remove now-unused `WHAT_LEAD_DID_OPTIONS` and `FIRST_TOUCH_OPTIONS` from the `./fieldLocale` import (keep `USP_OPTIONS`, `AI_STYLE_OPTIONS`, `SERVICE_OPTIONS`, still used).

The import block at the top of `BusinessSectionFields.tsx` should end up as:

```typescript
import { useTranslation } from "react-i18next";
import {
  Bot, Building2,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle,
} from "lucide-react";
import {
  EditText, InfoRow,
} from "../formFields";
import { LocalizedCombo } from "../formFields/LocalizedCombo";
import {
  asCampaignLang,
  USP_OPTIONS, AI_STYLE_OPTIONS, SERVICE_OPTIONS,
  placeholderFor, optionLabel, optionStore,
} from "./fieldLocale";
import { resolveLang } from "@shared/langField";
```

- [ ] **Step 2: Add the First Message field to `BusinessSectionFields.tsx`**

Insert this block right after the company_name `InfoRow` (after the closing `/>` at the end of the original lines 81-84 block, before the "Demo lead name" conditional block), so the opener is the first thing Finn sees:

```typescript
      {/* First Message — the opener template. This is the field Finn live-edits
          on screenshare during the demo (Part 1 of the trust-kit spec). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare} label={t("config.firstMessage")} value={campaign.first_message_template}
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                <EditToggle
                  value={!!draft.first_message_voice_note}
                  onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
                />
              </div>
              <EditText
                value={String(draft.First_Message ?? campaign.first_message_template ?? "")}
                onChange={(v) => setDraft(d => ({ ...d, First_Message: v }))}
                multiline
                minRows={3}
                placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
              />
              <CopyButton value={String(draft.First_Message || campaign.first_message_template || "")} />
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>
```

This requires 3 new imports in `BusinessSectionFields.tsx`: `MessageSquare` (lucide-react), `EditToggle` and `CopyButton` (from `../formFields`). Update the imports from Step 1's final state to:

```typescript
import {
  Bot, Building2, MessageSquare,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle,
} from "lucide-react";
import {
  EditText, EditToggle, InfoRow, CopyButton,
} from "../formFields";
```

- [ ] **Step 3: Remove the First Message field from `AISectionFields.tsx`**

Delete this block (originally lines 90-112, the first thing inside the `return`'s outer `<div>`):

```typescript
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare} label={t("config.firstMessage")} value={campaign.first_message_template}
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                <EditToggle
                  value={!!draft.first_message_voice_note}
                  onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
                />
              </div>
              <EditText
                value={String(draft.First_Message ?? campaign.first_message_template ?? "")}
                onChange={(v) => setDraft(d => ({ ...d, First_Message: v }))}
                multiline
                minRows={3}
                placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
              />
              <CopyButton value={String(draft.First_Message || campaign.first_message_template || "")} />
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>
```

`MessageSquare` and `CopyButton` stay imported in `AISectionFields.tsx` (still used by the bump-template rows via `renderBump`). `EditToggle` also stays (still used by `renderBump` and `voice_reply_mode`... actually `voice_reply_mode` uses `EditSelect`; `EditToggle` is used inside `renderBump` for `voiceField` — keep it).

- [ ] **Step 4: Add the 4 moved fields to `AISectionFields.tsx`, below the bumps**

First, extend the imports at the top of `AISectionFields.tsx` from:

```typescript
import {
  MessageSquare, Bot, Mic, Link, Zap,
  Thermometer, Radio, MessageCircle, HelpCircle,
} from "lucide-react";
import {
  EditText, EditNumber, EditSelect, EditToggle, InfoRow, CopyButton,
} from "../formFields";
import { MODEL_OPTIONS } from "@/features/prompts/types";
import { asCampaignLang, placeholderFor } from "./fieldLocale";
import { resolveLang } from "@shared/langField";
```

to:

```typescript
import {
  MessageSquare, Bot, Mic, Link, Zap, Building2, Clock, MapPin, MousePointerClick,
  Thermometer, Radio, MessageCircle, HelpCircle,
} from "lucide-react";
import {
  EditText, EditNumber, EditSelect, EditToggle, InfoRow, CopyButton,
} from "../formFields";
import { LocalizedCombo } from "../formFields/LocalizedCombo";
import { MODEL_OPTIONS } from "@/features/prompts/types";
import {
  asCampaignLang, placeholderFor,
  WHAT_LEAD_DID_OPTIONS, FIRST_TOUCH_OPTIONS, optionLabel, optionStore,
} from "./fieldLocale";
import { resolveLang } from "@shared/langField";
```

Then add the `comboOptions` and `displayLabel` helpers (mirrors `BusinessSectionFields.tsx`'s local pattern — this file already keeps its own local `onTextChange`/`displayText` rather than sharing a hook, so follow the same per-file convention). Insert right after the existing `onTextChange` function (after line 44, before `const editFor = ...`):

```typescript
  // Build LocalizedCombo options for a given field and option table
  const comboOptions = (
    field: string,
    table: Record<string, string[]>,
  ) =>
    (table[uiLang] ?? table.en).map((label) => ({
      label,
      store: optionStore(field, label, uiLang),
    }));

  // Resolve a raw field value to its display label in UI language
  const displayLabel = (field: string, raw: unknown) =>
    optionLabel(field, raw, uiLang);
```

Finally, insert the 4 fields right after the bump loop (after `{[1, 2, 3, 4].map(n => renderBump(n))}`, before the `reengagement_bump_template` block):

```typescript
      {[1, 2, 3, 4].map(n => renderBump(n))}

      {/* Business context fields — moved here from the Business panel so that
          panel contains only the owner-voice surface (opener + objection
          playbook). See Part 4 of the trust-kit spec. */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={Building2} label={t("config.businessDescription")}
          value={displayText(draft.description ?? campaign.description)} richText={true} noBorder
          {...editFor("description")}
          editChild={isEditing ? (
            <EditText
              value={displayText(draft.description ?? campaign.description)}
              onChange={(v) => onTextChange("description", draft.description ?? campaign.description, v)}
              multiline minRows={4}
              placeholder={placeholderFor("business_description", uiLang)}
              {...focusFor("description")}
            />
          ) : undefined}
        />
      </div>
      <InfoRow icon={Clock} label={t("config.inquiryDate")} value={displayText(campaign.inquiry_timeframe)}
        {...editFor("inquiry_timeframe")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.inquiry_timeframe ?? campaign.inquiry_timeframe)}
            onChange={(v) => onTextChange("inquiry_timeframe", draft.inquiry_timeframe ?? campaign.inquiry_timeframe, v)}
            placeholder="e.g. Last 6 months, 2+ years ago"
            {...focusFor("inquiry_timeframe")}
          />
        ) : undefined}
      />
      <InfoRow icon={MapPin} label={t("config.firstTouch")}
        value={displayLabel("first_touch", campaign.first_touch)}
        {...editFor("first_touch")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("first_touch", draft.first_touch ?? campaign.first_touch)}
            onChange={(store) => setDraft(d => ({...d, first_touch: store}))}
            options={comboOptions("first_touch", FIRST_TOUCH_OPTIONS)}
            {...focusFor("first_touch")}
          />
        ) : undefined}
      />
      <InfoRow icon={MousePointerClick} label={t("config.whatLeadDid")}
        value={displayLabel("what_lead_did", campaign.what_lead_did)}
        {...editFor("what_lead_did")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("what_lead_did", draft.what_lead_did ?? campaign.what_lead_did)}
            onChange={(store) => setDraft(d => ({...d, what_lead_did: store}))}
            options={comboOptions("what_lead_did", WHAT_LEAD_DID_OPTIONS)}
            {...focusFor("what_lead_did")}
          />
        ) : undefined}
      />

      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageCircle} label={t("config.reengagementBump")} value={campaign.reengagement_bump_template}
```

(The last two lines show the existing `reengagementBump` block's opening — stop your insertion right before it; don't duplicate it.)

- [ ] **Step 5: Manual verification**

In the browser at `app.leadawaker.com`, open any campaign:
1. Business panel: confirm First Message now appears near the top (below company name), and confirm "What lead has done" / "Inquiry date" / "First touch" / "Business Description" are **gone** from this panel.
2. AI panel: confirm those 4 fields now appear directly below the 4 bump rows, above "Contact Later re-engagement".
3. Edit one moved field (e.g. First Touch dropdown) in its new location, wait for autosave, refresh, confirm it persisted.
4. Switch UI language (en ↔ nl) via the app's language switcher and confirm all moved field labels translate correctly (this exercises the i18n keys, not new ones — just confirms nothing broke moving them).

- [ ] **Step 6: Commit**

```bash
git add client/src/features/campaigns/components/settings/BusinessSectionFields.tsx \
        client/src/features/campaigns/components/settings/AISectionFields.tsx
git commit -m "refactor(campaigns): move First Message to Business panel, business-context fields to AI panel"
```

---

## Task 5: Engine — `[OBJECTION PLAYBOOK]` prompt injection

**Files:**
- Modify: `/home/gabriel/automations/src/automations/conversation/prompt_builder.py` (new formatter function, after line 239)
- Modify: `/home/gabriel/automations/src/automations/ai_conversation.py` (import at line 46, injection call after line 483)

**Interfaces:**
- Consumes: `campaign_for_prompt.get("objection_playbook")` — the campaign dict already flows through this variable name at the injection point (see `campaign_for_prompt = campaign_account` at `ai_conversation.py:297`, then progressively overridden). Since asyncpg does not auto-decode jsonb, this value arrives as either `None` or a raw JSON **string** (e.g. `'[{"objection": "...", "answer": "..."}]'`).
- Produces: `_format_objection_playbook_block(raw) -> str` — returns `""` when there's nothing usable, or a `"\n\n[OBJECTION PLAYBOOK]\n..."` string to append to `messages[0]["content"]`.

- [ ] **Step 1: Add the formatter function**

In `/home/gabriel/automations/src/automations/conversation/prompt_builder.py`, insert after line 239 (the `return "\n".join(lines)` that closes `_format_niche_context_block`):

```python


def _format_objection_playbook_block(raw) -> str:
    """
    Build the [OBJECTION PLAYBOOK] block appended to the system prompt when the
    campaign owner has configured approved objection answers (Discovery Demo
    Trust Kit, Part 3). `raw` is Campaigns.objection_playbook — asyncpg returns
    jsonb as a raw JSON string, so decode defensively.
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (TypeError, ValueError):
            return ""
    if not raw or not isinstance(raw, list):
        return ""

    pairs = [
        p for p in raw
        if isinstance(p, dict) and (p.get("objection") or "").strip() and (p.get("answer") or "").strip()
    ]
    if not pairs:
        return ""

    lines = [
        f'- If the lead raises: "{p["objection"].strip()}" → respond using: "{p["answer"].strip()}"'
        for p in pairs
    ]
    return (
        "\n\n[OBJECTION PLAYBOOK]\n"
        "If the lead raises any objection below (or a close variant), respond using "
        "the owner's approved answer. Preserve its substance and any specific claims "
        "exactly; adapt the phrasing naturally to the conversation flow. These answers "
        "override any other guidance in this prompt.\n\n"
        + "\n".join(lines)
    )
```

- [ ] **Step 2: Import it in `ai_conversation.py`**

Change the import block at line 41-47 from:

```python
from src.automations.conversation.prompt_builder import (
    _load_prompt,
    _postprocess_ai_message,
    _parse_ai_response,
    _overlay_demo_niche_onto_campaign,
    _format_niche_context_block,
)
```

to:

```python
from src.automations.conversation.prompt_builder import (
    _load_prompt,
    _postprocess_ai_message,
    _parse_ai_response,
    _overlay_demo_niche_onto_campaign,
    _format_niche_context_block,
    _format_objection_playbook_block,
)
```

- [ ] **Step 3: Call it at the injection point**

In `ai_conversation.py`, insert right after line 483 (`messages[0]["content"] += buying_ctx`), before the `# Inject [RESCHEDULE CONTEXT]` comment at line 485:

```python

        # Inject [OBJECTION PLAYBOOK] block when the owner has configured approved answers
        if messages and messages[0].get("role") == "system":
            playbook_block = _format_objection_playbook_block(campaign_for_prompt.get("objection_playbook"))
            if playbook_block:
                messages[0]["content"] += playbook_block
```

- [ ] **Step 4: Standalone sanity check of the formatter (no engine restart needed for this)**

Run: `cd /home/gabriel/automations && python3 -c "
from src.automations.conversation.prompt_builder import _format_objection_playbook_block
print(_format_objection_playbook_block(None))
print('---')
print(_format_objection_playbook_block('[]'))
print('---')
print(_format_objection_playbook_block('[{\"objection\":\"too expensive\",\"answer\":\"we price per project\"},{\"objection\":\"\",\"answer\":\"\"}]'))
"`

Expected: first two prints are empty lines (`""`), third print shows the full `[OBJECTION PLAYBOOK]` block with exactly 1 pair (the empty second row is skipped).

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/conversation/prompt_builder.py src/automations/ai_conversation.py
git commit -m "feat(conversation): inject [OBJECTION PLAYBOOK] block into system prompt"
```

---

## Task 6: Engine — `{first_message}` resolvable prompt variable

**Files:**
- Modify: `/home/gabriel/automations/tools/ai_service.py` (import + `prompt_vars` dict, `build_conversation_prompt()`)

**Interfaces:**
- Consumes: `personalize_message()` from `src/automations/_helpers.py:50` (already the function `campaign_launcher.py` uses to resolve the actual outbound first message — reusing it here guarantees the prompt sees exactly the text the lead received, per the spec's Part 5 rationale).
- Produces: `prompt_vars["first_message"]` — a fully personalized string, available for `{first_message}` substitution anywhere in a Prompt_Library prompt (used by Gabriel's separate STEP 1 content session, Part 6 of the spec — not built here).

- [ ] **Step 1: Import `personalize_message`**

In `/home/gabriel/automations/tools/ai_service.py`, change the import block at line 11-12 from:

```python
from src.config import settings
from tools.lang_field import resolve_lang, norm_lang as _norm_lang
```

to:

```python
from src.config import settings
from src.automations._helpers import personalize_message
from tools.lang_field import resolve_lang, norm_lang as _norm_lang
```

This is safe — `ai_service.py` already imports across the `tools`/`src` boundary (`from src.config import settings`), and `_helpers.py` does not import anything from `tools.ai_service`, so there's no circular import.

- [ ] **Step 2: Resolve `first_message` once, before `prompt_vars` is built**

In `build_conversation_prompt()`, find the `prompt_vars = {` dict (currently starting around line 504). Add a line computing the resolved first message immediately before that dict literal starts:

```python
    first_message_resolved = personalize_message(
        (campaign.get("First_Message") or campaign.get("first_message") or ""),
        lead=lead,
        campaign=campaign,
    )

    prompt_vars = {
        "first_name": lead_name,
        "lead_name": lead_name,
```

Then add one entry to the `prompt_vars` dict (anywhere among the existing string entries, e.g. right after `"first_touch": first_touch,`):

```python
        "first_touch": first_touch,
        "first_message": first_message_resolved,
```

- [ ] **Step 3: Reuse the resolved value in the existing "MENSAGEM ENVIADA AO LEAD" reminder block**

This existing block (originally lines 578-585) currently re-derives and re-resolves the first message independently using ad-hoc merge-tag replacement. Replace it so both blocks share one resolution:

Find:
```python
    # Inject first message context so the AI knows what the lead is responding to
    first_msg = (campaign.get("First_Message") or campaign.get("first_message") or "").strip()
    if first_msg:
        # Replace merge tags in first message too
        for key, val in prompt_vars.items():
            first_msg = first_msg.replace(f"{{{key}}}", str(val))
        first_msg = resolve_conditional_blocks(first_msg, prompt_vars)
        system_prompt += f"\n\nMENSAGEM ENVIADA AO LEAD (a lead esta respondendo a isso, NAO repita o conteudo):\n\"{first_msg}\""
```

Replace with:
```python
    # Inject first message context so the AI knows what the lead is responding to
    if first_message_resolved.strip():
        system_prompt += f"\n\nMENSAGEM ENVIADA AO LEAD (a lead esta respondendo a isso, NAO repita o conteudo):\n\"{first_message_resolved.strip()}\""
```

`personalize_message()` already resolves `{first_name}`, `{business}`-equivalent fields (`company_name`), `{project}`-equivalent (`service`/`service_name`), etc. via its own `replacements` dict (`_helpers.py:81-98`) — this is a strict subset of what the old ad-hoc loop did (it also ran `resolve_conditional_blocks`, which `personalize_message` does not). If a First_Message template ever uses `{{#if ...}}` conditional blocks (currently none do — those are a STEP-prompt-only construct per the codebase's existing usage), this would stop resolving them. Since First_Message templates today are the flat opener library from Part 2 of the spec (no conditionals), this is safe; flag it in the PR description as a known simplification.

- [ ] **Step 4: Standalone sanity check**

Run: `cd /home/gabriel/automations && python3 -c "
from src.automations._helpers import personalize_message
campaign = {'First_Message': 'Hi {first_name}, {company_name} here. Checking in on your {service}.', 'company_name': 'Acme Kitchens', 'campaign_service': 'kitchen renovation'}
lead = {'first_name': 'Jan'}
print(personalize_message(campaign['First_Message'], lead=lead, campaign=campaign))
"`

Expected: `Hi Jan, Acme Kitchens here. Checking in on your kitchen renovation.`

- [ ] **Step 5: Restart the engine and verify**

Run: `cd /home/gabriel/automations && ./preflight.sh && pm2 restart leadawaker-engine --update-env`

Only proceed if preflight PASSes (per `/home/gabriel/automations/CLAUDE.md:86-90` — a broken restart takes all live automation offline).

Run: `pm2 logs leadawaker-engine --lines 20 --nostream`

Expected: no import errors, no tracebacks on startup.

- [ ] **Step 6: Commit**

```bash
git add tools/ai_service.py
git commit -m "feat(prompt): expose {first_message} as a resolvable template variable"
```

---

## Task 7: End-to-end manual verification

Matches the spec's own Testing section — no automated test suite exists for either repo's prompt-building code (the automations repo has no pytest suite, just a manual harness at `tests/prompt_tester.py`), so verification here is manual, on the live demo campaign (61), per project convention.

- [ ] **Step 1: Objection playbook round-trip**

In the CRM UI, open campaign 61 (discovery demo) → Business panel → Objection Playbook. Type an objection + answer in row 1, let it autosave.

Trigger a demo conversation (WhatsApp to the AI line, per the existing `LAUNCH_WA_NUMBER`/`LAUNCH_WA_MESSAGE` pattern in `CampaignSettingsLayout.tsx:11-12`, or however Gabriel normally triggers campaign 61's demo flow) and, as the "lead", raise that exact objection. Confirm the AI's reply uses the approved answer's substance.

- [ ] **Step 2: Live-edit propagation**

Mid-conversation, edit the same objection row's answer in the CRM (different wording). Send another message from the demo lead raising a related objection. Confirm the new wording comes back — proves there's no caching (per the spec's Part 3 rationale, `get_campaign_with_account()` fetches fresh every message).

- [ ] **Step 3: First_Message field location + propagation**

Confirm First_Message is editable from the Business panel (not AI panel) per Task 4. Edit it, save, and start a **fresh** demo send to a new/reset lead; confirm the edited opener text goes out.

- [ ] **Step 4: bot-test pass (optional but recommended before shipping)**

Suggest running the **bot-test** skill against campaign 61's prompt to confirm the objection-playbook block and first_message variable don't degrade reply quality, matching the spec's Testing section.
