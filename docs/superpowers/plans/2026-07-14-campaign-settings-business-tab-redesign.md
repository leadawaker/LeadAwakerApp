# Campaign Settings — Business Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the campaign settings Business tab: max-width the settings shell, reorder fields into business-info-then-interaction groups, turn the fixed 3-row Objection Playbook into a dynamic 1-5 row list with a shared input/answer box, make the First Message editor click-to-edit with an icon-only Templates button, rename "AI Style Override" to "AI Conversation Style", and de-emphasize the bottom "AI →" nav button.

**Architecture:** All changes are client-only, confined to `client/src/features/campaigns/components/settings/CampaignSettingsLayout.tsx`, `BusinessSectionFields.tsx`, `client/src/features/campaigns/components/formFields/EditText.tsx` (new `onBlur` prop), and the `en`/`nl` `campaigns.json` locale files. No DB/schema/API changes — `objection_playbook` is already a JSON array column, only the client's rendering assumptions change. `BusinessSectionFields` is shared by both desktop (`CampaignSettingsLayout`) and mobile (`MobileCampaignDetailPanel` → `CampaignStageEditor` → same layout), so there is only one component tree to edit.

**Tech Stack:** React + TypeScript (Vite), react-i18next, TailwindCSS utility classes mixed with the app's inline-style + CSS-variable design system (`la-btn`, `la-input`, `neu-inset-crisp`, `InfoRow`/`EditText` form-field components).

## Global Constraints

- **Never run `npm run dev`.** The app runs via pm2 on the Pi. Verify changes by checking `pm2 logs` or the live site at `app.leadawaker.com`.
- **Never run `npx tsc --noEmit` automatically** — only if Gabriel explicitly asks for a type check.
- **No automated test suite exists for this frontend area** (no vitest/jest config, no `.test.tsx` files under `client/src/features/campaigns`). Every task below is verified by **manual visual/interaction check** in the running app instead of automated tests — follow the "Verify" step exactly as written.
- **i18n discipline:** every user-facing string goes through `react-i18next`; all copy changes touch both `client/src/locales/en/campaigns.json` and `client/src/locales/nl/campaigns.json` in the same task.
- **No hardcoded strings, no `bg-white`/`text-black`/raw hex** — reuse existing CSS variables and `la-*` classes exactly as shown in each step.
- Frequent, small commits: one commit per task, after its manual verification passes.

---

### Task 1: Settings shell — max-width/centering + de-emphasized "Next" button

**Files:**
- Modify: `client/src/styles/components.css:74-79` (add a new `.la-btn--plain` modifier next to the other `la-btn` modifiers)
- Modify: `client/src/styles/design-system.css:596-600` (same modifier, mirrored — this codebase defines the `la-btn` family in both files)
- Modify: `client/src/features/campaigns/components/settings/CampaignSettingsLayout.tsx:62-64` (outer wrapper) and `:158-165` (Next button)

**Interfaces:**
- Produces: CSS class `.la-btn--plain` (transparent background, no shadow, wine-colored text, hover shifts to `--wine-soft`) — usable anywhere in the app going forward, though this task is its only consumer.

- [ ] **Step 1: Add the `.la-btn--plain` CSS modifier**

In `client/src/styles/components.css`, right after the existing `.la-btn--inset` block (ends at line 79), insert:

```css
.la-btn--plain {
  background: transparent;
  box-shadow: none;
  color: var(--wine);
}
.la-btn--plain:hover { color: var(--wine-soft); }
.la-btn--plain:disabled { opacity: 0.5; cursor: default; }
```

In `client/src/styles/design-system.css`, right after the existing `.la-btn--inset` block (ends at line 600), insert the same three rules.

- [ ] **Step 2: Add max-width + centering to the settings shell**

In `client/src/features/campaigns/components/settings/CampaignSettingsLayout.tsx`, change (around line 62):

```tsx
  return (
    <div style={compact
      ? { display: 'flex', flexDirection: 'column', gap: 16 }
      : { display: 'flex', gap: 'var(--gap, 22px)', alignItems: 'flex-start' }}>
```

to:

```tsx
  return (
    <div className="max-w-[1386px] mx-auto" style={compact
      ? { display: 'flex', flexDirection: 'column', gap: 16 }
      : { display: 'flex', gap: 'var(--gap, 22px)', alignItems: 'flex-start' }}>
```

- [ ] **Step 3: De-emphasize the "Next" button**

In the same file, change (around line 158):

```tsx
            <button
              onClick={() => curIdx < sections.length - 1 && setActive(sections[curIdx + 1].id)}
              disabled={curIdx === sections.length - 1}
              className={cn("la-btn", curIdx < sections.length - 1 ? "la-btn--wine" : "la-btn--soft")}
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const, gap: 8, opacity: curIdx === sections.length - 1 ? 0.5 : undefined }}
            >
              {curIdx < sections.length - 1 ? t(sections[curIdx + 1].labelKey) : "All done"} →
            </button>
```

to:

```tsx
            <button
              onClick={() => curIdx < sections.length - 1 && setActive(sections[curIdx + 1].id)}
              disabled={curIdx === sections.length - 1}
              className={cn("la-btn", curIdx < sections.length - 1 ? "la-btn--plain" : "la-btn--soft")}
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const, gap: 8, opacity: curIdx === sections.length - 1 ? 0.5 : undefined }}
            >
              {curIdx < sections.length - 1 ? t(sections[curIdx + 1].labelKey) : "All done"} →
            </button>
```

- [ ] **Step 4: Verify**

Open a campaign's settings tab in the browser at a wide viewport (>1386px). Confirm: the two-column nav+content layout no longer stretches edge-to-edge — it caps at 1386px and centers with equal whitespace on both sides. Confirm the bottom-right "Next" button (reads e.g. "AI →" on the Business tab) now shows as plain wine-colored text on the white/paper background with no raised shadow, and its text shifts to a lighter wine shade on hover. Confirm the "← Prev"/"Start" button and the center "Launch Campaign" WhatsApp pill button are unchanged.

- [ ] **Step 5: Commit**

```bash
git add client/src/styles/components.css client/src/styles/design-system.css client/src/features/campaigns/components/settings/CampaignSettingsLayout.tsx
git commit -m "feat(campaigns): cap settings tab width and de-emphasize Next button"
```

---

### Task 2: Business tab field reordering

**Files:**
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx:240-419` (the grid content, structural reorder only — no field internals change in this task)

**Interfaces:**
- Consumes: nothing new — this task only reorders existing JSX blocks (Company name, Demo Lead Name, Service, USP, Knowledge Base, First Message, Agent name, AI Style Override, Objection Playbook) that Task 1's edits did not touch.
- Produces: the field order that Tasks 3-5 will edit in place — after this task, "Service/USP/KB" sit before "First Message", and "Agent name/AI Style Override" sit after "First Message", with "Objection Playbook" unchanged at the very bottom.

- [ ] **Step 1: Replace the grid block with the reordered version**

In `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx`, replace the entire grid `<div style={{ display: 'grid', ... }}>...</div>` (currently lines 242-419, i.e. everything between the opening `<>` / `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ... }}>` and its matching closing `</div>` right before `<OpenerTemplatePicker`) with:

```tsx
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      <InfoRow icon={Building2} label={t("config.companyName")} value={String(draft.company_name ?? campaign.company_name ?? "")}
        {...editFor("company_name")}
        editChild={isEditing ? <EditText value={String(draft.company_name ?? "")} onChange={(v) => setDraft(d => ({...d, company_name: v}))} placeholder="Company name…" {...focusFor("company_name")} /> : undefined}
      />

      {/* Demo lead name — transient, drives the Launch Campaign button. Always
          editable (no save needed): typed live during a discovery screenshare. */}
      {setLaunchName && (
        <InfoRow icon={UserRound} label={t("config.launchName")} value={null}
          description={t("config.launchNameHint")}
          editChild={
            <input
              type="text"
              value={launchName ?? ""}
              onChange={(e) => setLaunchName(e.target.value)}
              placeholder={t("config.launchNamePlaceholder")}
              maxLength={80}
              className="la-input"
              style={{ width: '100%', fontSize: 13, padding: '8px 12px' }}
            />
          }
        />
      )}

      {/* Service — multilingual dropdown */}
      <InfoRow icon={Megaphone} label={t("config.service")}
        value={displayLabel("service_name", campaign.service_name)}
        {...editFor("service_name")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("service_name", draft.service_name ?? campaign.service_name)}
            onChange={(store) => setDraft(d => ({...d, service_name: store}))}
            options={comboOptions("service_name", SERVICE_OPTIONS)}
            {...focusFor("service_name")}
          />
        ) : undefined}
      />

      {/* USP — multilingual dropdown */}
      <InfoRow icon={Award} label={t("config.usp")}
        value={displayLabel("campaign_usp", campaign.campaign_usp)}
        {...editFor("campaign_usp")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("campaign_usp", draft.campaign_usp ?? campaign.campaign_usp)}
            onChange={(store) => setDraft(d => ({...d, campaign_usp: store}))}
            options={comboOptions("campaign_usp", USP_OPTIONS)}
            {...focusFor("campaign_usp")}
          />
        ) : undefined}
      />

      {/* Knowledge base — full width. */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={BookOpen} label={t("config.kb")}
          value={displayText(draft.kb ?? campaign.kb)} richText={true} noBorder
          {...editFor("kb")}
          editChild={isEditing ? (
            <EditText
              value={displayText(draft.kb ?? campaign.kb)}
              onChange={(v) => onTextChange("kb", draft.kb ?? campaign.kb, v)}
              multiline minRows={1}
              placeholder={placeholderFor("kb", uiLang)}
              {...focusFor("kb")}
            />
          ) : undefined}
        />
      </div>

      {/* First Message — the opener template. This is the field Finn live-edits
          on screenshare during the demo (Part 1 of the trust-kit spec). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare} label={t("config.firstMessage")}
          value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              {rawEditOpen ? (
                <>
                  <EditText
                    value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
                    onChange={(v) => onTextChange("First_Message", draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template, v)}
                    multiline
                    minRows={3}
                    placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                    <CopyButton value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)} />
                    <button type="button" onClick={() => setRawEditOpen(false)} className="la-btn la-btn--soft" style={MONO_BTN_STYLE}>
                      {t("config.previewOpener")}
                    </button>
                    <button type="button" onClick={() => setTemplatesOpen(true)} className="la-btn la-btn--soft" style={MONO_BTN_STYLE}>
                      {t("config.openerTemplatesButton")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: 13, lineHeight: 1.5, color: 'var(--ink)',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
                    padding: '10px 12px', whiteSpace: 'pre-wrap', minHeight: 64,
                  }}>
                    {previewText || t("config.previewEmpty")}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                    <button type="button" onClick={() => setRawEditOpen(true)} className="la-btn la-btn--soft" style={MONO_BTN_STYLE}>
                      {t("config.editOpener")}
                    </button>
                    <button type="button" onClick={() => setTemplatesOpen(true)} className="la-btn la-btn--soft" style={MONO_BTN_STYLE}>
                      {t("config.openerTemplatesButton")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>

      <InfoRow icon={Bot} label={t("config.agentName")} value={campaign.agent_name}
        {...editFor("agent_name")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={String(draft.agent_name ?? campaign.agent_name ?? "")}
            onChange={(store) => setDraft(d => ({...d, agent_name: store}))}
            options={AGENT_NAME_OPTIONS}
            {...focusFor("agent_name")}
          />
        ) : undefined}
      />

      {/* AI Style — multilingual dropdown */}
      <InfoRow icon={Paintbrush} label={t("config.aiStyleOverride")}
        value={displayLabel("ai_style_override", campaign.ai_style_override)}
        {...editFor("ai_style_override")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("ai_style_override", draft.ai_style_override ?? campaign.ai_style_override)}
            onChange={(store) => setDraft(d => ({...d, ai_style_override: store}))}
            options={comboOptions("ai_style_override", AI_STYLE_OPTIONS)}
            {...focusFor("ai_style_override")}
          />
        ) : undefined}
      />

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
                    placeholder={t(OBJECTION_PLACEHOLDER_KEYS[idx])}
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
    </div>
```

(This is a pure reorder: Service/USP/KB moved up to sit before First Message; Agent name/AI Style Override moved down to sit after First Message. No field's internal markup changed — that comes in Tasks 3-5.)

- [ ] **Step 2: Verify**

Open a campaign's Business tab. Confirm field order top to bottom is: Company name + Demo Lead Name (row), Service + USP (row), Knowledge Base (full width), First Message (full width), Agent name + AI Conversation Style label still reading "AI Style Override" at this point (row — rename comes in Task 3), Objection Playbook (full width, last). Confirm every field still displays and edits its existing value correctly (nothing lost in the move).

- [ ] **Step 3: Commit**

```bash
git add client/src/features/campaigns/components/settings/BusinessSectionFields.tsx
git commit -m "refactor(campaigns): reorder Business tab into info-then-interaction groups"
```

---

### Task 3: Demo Lead Name label cleanup + "AI Style Override" → "AI Conversation Style" rename

**Files:**
- Modify: `client/src/locales/en/campaigns.json:334,344-346`
- Modify: `client/src/locales/nl/campaigns.json:334,344-346`
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx` (Demo Lead Name `InfoRow`, now inside the row-2 block from Task 2)

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports — copy-only change, `config.aiStyleOverride` / `config.launchName` i18n values change, `config.launchNameHint` key is deleted.

- [ ] **Step 1: Update en locale**

In `client/src/locales/en/campaigns.json`, change:

```json
    "aiStyleOverride": "AI Style Override",
```
to:
```json
    "aiStyleOverride": "AI Conversation Style",
```

and change:
```json
    "launchName": "Demo lead name",
    "launchNamePlaceholder": "Lead name (optional)",
    "launchNameHint": "Sets the demo lead's first name when you launch. Leave empty to keep the current name.",
```
to:
```json
    "launchName": "Demo lead name (empty = current name)",
    "launchNamePlaceholder": "Lead name (optional)",
```

(The `launchNameHint` key is deleted entirely — no replacement key.)

- [ ] **Step 2: Update nl locale**

In `client/src/locales/nl/campaigns.json`, change:

```json
    "aiStyleOverride": "AI-stijloverride",
```
to:
```json
    "aiStyleOverride": "AI-gespreksstijl",
```

and change:
```json
    "launchName": "Naam demolead",
    "launchNamePlaceholder": "Naam lead (optioneel)",
    "launchNameHint": "Stelt de voornaam van de demolead in bij het starten. Laat leeg om de huidige naam te behouden.",
```
to:
```json
    "launchName": "Naam demolead (leeg = huidige naam)",
    "launchNamePlaceholder": "Naam lead (optioneel)",
```

- [ ] **Step 3: Remove the hint line from the Demo Lead Name field**

In `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx`, change:

```tsx
        <InfoRow icon={UserRound} label={t("config.launchName")} value={null}
          description={t("config.launchNameHint")}
          editChild={
```

to:

```tsx
        <InfoRow icon={UserRound} label={t("config.launchName")} value={null}
          editChild={
```

- [ ] **Step 4: Verify**

Reload the Business tab. Confirm the Demo Lead Name field's label reads "Demo lead name (empty = current name)" (English) with no helper line underneath it. Switch the CRM's language to Dutch and confirm the label reads "Naam demolead (leeg = huidige naam)". Confirm the Agent name row's second field now reads "AI Conversation Style" (en) / "AI-gespreksstijl" (nl) instead of "AI Style Override".

- [ ] **Step 5: Commit**

```bash
git add client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json client/src/features/campaigns/components/settings/BusinessSectionFields.tsx
git commit -m "feat(campaigns): simplify demo lead name label, rename AI Style Override"
```

---

### Task 4: Objection Playbook — dynamic 1-5 row list with shared box

**Files:**
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx` (lucide-react import, `OBJECTION_PLACEHOLDER_KEYS`, `objectionRows`/`updateObjectionRow`, new `addObjectionRow`/`removeObjectionRow`, Objection Playbook JSX block)
- Modify: `client/src/locales/en/campaigns.json:347-352`
- Modify: `client/src/locales/nl/campaigns.json:347-352`

**Interfaces:**
- Consumes: `InfoRow`, `t()` from `useTranslation("campaigns")`, `setDraft` (already in scope).
- Produces: `MAX_OBJECTIONS` constant, `addObjectionRow(): void`, `removeObjectionRow(idx: number): void` — local to `BusinessSectionFields`, no other file consumes them.

- [ ] **Step 1: Add `X` and `Plus` to the lucide-react import**

In `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx`, change:

```tsx
import {
  Bot, Building2, MessageSquare,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle,
} from "lucide-react";
```

to:

```tsx
import {
  Bot, Building2, MessageSquare,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle, X, Plus,
} from "lucide-react";
```

- [ ] **Step 2: Extend the placeholder keys from 3 to 5**

Change:

```tsx
const OBJECTION_PLACEHOLDER_KEYS = [
  "config.objectionPlaceholder",
  "config.objectionPlaceholder2",
  "config.objectionPlaceholder3",
] as const;
```

to:

```tsx
const OBJECTION_PLACEHOLDER_KEYS = [
  "config.objectionPlaceholder",
  "config.objectionPlaceholder2",
  "config.objectionPlaceholder3",
  "config.objectionPlaceholder4",
  "config.objectionPlaceholder5",
] as const;
```

- [ ] **Step 3: Rewrite the data helpers as a dynamic 1-5 row array**

Change:

```tsx
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

to:

```tsx
  type ObjectionRow = { objection: string; answer: string };
  const MAX_OBJECTIONS = 5;
  const objectionRows = (): ObjectionRow[] => {
    const raw = (draft.objection_playbook ?? campaign.objection_playbook) as ObjectionRow[] | undefined;
    return raw && raw.length > 0 ? raw : [{ objection: "", answer: "" }];
  };
  const updateObjectionRow = (idx: number, patch: Partial<ObjectionRow>) => {
    const rows = [...objectionRows()];
    rows[idx] = { ...rows[idx], ...patch };
    setDraft(d => ({ ...d, objection_playbook: rows }));
  };
  const addObjectionRow = () => {
    const rows = objectionRows();
    if (rows.length >= MAX_OBJECTIONS) return;
    setDraft(d => ({ ...d, objection_playbook: [...rows, { objection: "", answer: "" }] }));
  };
  const removeObjectionRow = (idx: number) => {
    const rows = objectionRows().filter((_, i) => i !== idx);
    setDraft(d => ({ ...d, objection_playbook: rows.length > 0 ? rows : [{ objection: "", answer: "" }] }));
  };
```

- [ ] **Step 4: Rewrite the Objection Playbook JSX block**

Change (this is the full-width block at the bottom of the grid, produced by Task 2's reorder):

```tsx
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
                    placeholder={t(OBJECTION_PLACEHOLDER_KEYS[idx])}
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

to:

```tsx
      {/* Objection playbook — up to 5 owner-approved objection/answer pairs,
          injected into the AI's system prompt (Part 3 of the trust-kit spec). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={HelpCircle} label={t("config.objectionPlaybook")} value={null}
          editChild={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md, 12px)' }}>
              {objectionRows().map((row, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
                  <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: 'var(--mute-2)' }}>
                    {t("config.objectionLabel", { n: idx + 1 })}
                  </span>
                  <div className="neu-inset-crisp" style={{ borderRadius: 'var(--r-button)', overflow: 'hidden', position: 'relative' }}>
                    <input
                      value={row.objection}
                      onChange={(e) => updateObjectionRow(idx, { objection: e.target.value.slice(0, 500) })}
                      placeholder={t(OBJECTION_PLACEHOLDER_KEYS[idx])}
                      style={{
                        width: '100%', padding: '9px 13px', fontSize: 13, fontFamily: 'inherit',
                        border: 'none', background: 'transparent', color: 'var(--ink-soft)',
                        borderBottom: '1px solid var(--line)',
                      }}
                    />
                    <textarea
                      value={row.answer}
                      onChange={(e) => updateObjectionRow(idx, { answer: e.target.value.slice(0, 500) })}
                      rows={2}
                      placeholder={t("config.answerPlaceholder")}
                      style={{
                        width: '100%', padding: '9px 13px', fontSize: 13, fontFamily: 'inherit',
                        border: 'none', background: 'transparent', color: 'var(--ink-soft)',
                        resize: 'none', display: 'block',
                      }}
                    />
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => removeObjectionRow(idx)}
                        className="la-btn la-btn--soft la-btn--icon"
                        title={t("config.objectionRemove")}
                        style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22 }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {objectionRows().length < MAX_OBJECTIONS && (
                <button type="button" className="la-btn la-btn--inset" style={{ alignSelf: 'flex-start' }} onClick={addObjectionRow}>
                  <Plus size={13} />{t("config.objectionAdd")}
                </button>
              )}
            </div>
          }
        />
      </div>
```

- [ ] **Step 5: Update en locale**

In `client/src/locales/en/campaigns.json`, change:

```json
    "objectionPlaybook": "Objection playbook",
    "objectionPlaybookHint": "Up to 3 objections the AI should recognize, with your approved answer for each. Edit live — the AI uses your wording on its next reply.",
    "objectionLabel": "Objection {{n}}",
    "objectionPlaceholder": "e.g. \"It's too expensive\"",
    "objectionPlaceholder2": "e.g. \"The competitor is cheaper\"",
    "objectionPlaceholder3": "e.g. \"We need to think about it\"",
```

to:

```json
    "objectionPlaybook": "Objection playbook",
    "objectionLabel": "Objection {{n}}",
    "objectionPlaceholder": "e.g. \"It's too expensive\"",
    "objectionPlaceholder2": "e.g. \"The competitor is cheaper\"",
    "objectionPlaceholder3": "e.g. \"We need to think about it\"",
    "objectionPlaceholder4": "e.g. \"We already have someone for this\"",
    "objectionPlaceholder5": "e.g. \"Not interested right now\"",
    "objectionAdd": "Add objection",
    "objectionRemove": "Remove objection",
```

- [ ] **Step 6: Update nl locale**

In `client/src/locales/nl/campaigns.json`, change:

```json
    "objectionPlaybook": "Bezwaren-script",
    "objectionPlaybookHint": "Tot 3 bezwaren die de AI moet herkennen, met jouw goedgekeurde antwoord voor elk. Live aanpasbaar — de AI gebruikt jouw woorden in het volgende bericht.",
    "objectionLabel": "Bezwaar {{n}}",
    "objectionPlaceholder": "bijv. \"Het is te duur\"",
    "objectionPlaceholder2": "bijv. \"De concurrent is goedkoper\"",
    "objectionPlaceholder3": "bijv. \"We willen er nog even over nadenken\"",
```

to:

```json
    "objectionPlaybook": "Bezwaren-script",
    "objectionLabel": "Bezwaar {{n}}",
    "objectionPlaceholder": "bijv. \"Het is te duur\"",
    "objectionPlaceholder2": "bijv. \"De concurrent is goedkoper\"",
    "objectionPlaceholder3": "bijv. \"We willen er nog even over nadenken\"",
    "objectionPlaceholder4": "bijv. \"We hebben hier al iemand voor\"",
    "objectionPlaceholder5": "bijv. \"Nu geen interesse\"",
    "objectionAdd": "Bezwaar toevoegen",
    "objectionRemove": "Bezwaar verwijderen",
```

- [ ] **Step 7: Verify**

Open a campaign whose `objection_playbook` is empty/undefined (e.g. a fresh campaign never edited on this tab) — confirm only "Objection 1" shows, with no hint line above it. Click "Add objection" — confirm a new "Objection 2" row appears below, sharing one box with a horizontal divider between the objection input and the answer textarea, and an "X" button appears top-right of row 2 (not row 1). Keep clicking Add up to 5 rows total, confirm the Add button disappears at 5. Click the X on, say, row 3 of 5 — confirm it disappears and row 4/5 shift up to become the new row 3/4 (renumbering via the label). Type into an objection/answer box and confirm placeholder text is light/muted and disappears once you type, matching the pre-existing style. Note: campaigns that already have a stored 3-element `objection_playbook` array (even with blank rows 2/3) will still show all 3 rows — this is expected per the approved spec (only empty/undefined arrays default to a single row).

- [ ] **Step 8: Commit**

```bash
git add client/src/features/campaigns/components/settings/BusinessSectionFields.tsx client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json
git commit -m "feat(campaigns): dynamic 1-5 row Objection Playbook with shared box"
```

---

### Task 5: First Message — click-to-edit, blur-to-preview, icon-only Templates button

**Files:**
- Modify: `client/src/features/campaigns/components/formFields/EditText.tsx` (add optional `onBlur` prop)
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx` (lucide-react import, `rawEditOpen` state rename, `handlePickTemplate`, First Message JSX block, remove now-unused `MONO_BTN_STYLE`)
- Modify: `client/src/locales/en/campaigns.json:353-354` (delete `previewOpener`/`editOpener`)
- Modify: `client/src/locales/nl/campaigns.json:353-354` (delete `previewOpener`/`editOpener`)

**Interfaces:**
- Consumes: `LayoutTemplate` icon from `lucide-react`.
- Produces: `EditText` gains an optional `onBlur?: () => void` prop (backward compatible — every other `EditText` call site omits it and is unaffected). `BusinessSectionFields` renames its `rawEditOpen` boolean state to `firstMessageFocused` (same shape, `useState<boolean>`).

- [ ] **Step 1: Add `onBlur` support to `EditText`**

In `client/src/features/campaigns/components/formFields/EditText.tsx`, change:

```tsx
export function EditText({
  value,
  onChange,
  placeholder,
  multiline = false,
  autoFocus = false,
  minRows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  minRows?: number;
}) {
```

to:

```tsx
export function EditText({
  value,
  onChange,
  placeholder,
  multiline = false,
  autoFocus = false,
  minRows = 3,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  minRows?: number;
  onBlur?: () => void;
}) {
```

Then change the textarea branch:

```tsx
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className="la-input resize-none overflow-y-auto"
        style={{ minHeight: `${minH}px`, maxHeight: "320px" }}
      />
```

to:

```tsx
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={minRows}
        className="la-input resize-none overflow-y-auto"
        style={{ minHeight: `${minH}px`, maxHeight: "320px" }}
      />
```

And the input branch:

```tsx
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="la-input"
    />
```

to:

```tsx
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="la-input"
    />
```

- [ ] **Step 2: Add `LayoutTemplate` to the lucide-react import**

In `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx`, change (as left by Task 4):

```tsx
import {
  Bot, Building2, MessageSquare,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle, X, Plus,
} from "lucide-react";
```

to:

```tsx
import {
  Bot, Building2, MessageSquare,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle, X, Plus, LayoutTemplate,
} from "lucide-react";
```

- [ ] **Step 3: Rename `rawEditOpen` → `firstMessageFocused`**

Change:

```tsx
  const [rawEditOpen, setRawEditOpen] = useState(false);
```

to:

```tsx
  const [firstMessageFocused, setFirstMessageFocused] = useState(false);
```

Change:

```tsx
  useEffect(() => { if (isEditing) setRawEditOpen(false); }, [isEditing]);
```

to:

```tsx
  useEffect(() => { if (isEditing) setFirstMessageFocused(false); }, [isEditing]);
```

- [ ] **Step 4: Update `handlePickTemplate`**

Change:

```tsx
  const handlePickTemplate = (tpl: OpenerTemplate) => {
    setDraft(d => ({ ...d, First_Message: JSON.stringify({ en: tpl.body.en, nl: tpl.body.nl }) }));
    setRawEditOpen(false); // land back on the live preview showing the applied template
  };
```

to:

```tsx
  const handlePickTemplate = (tpl: OpenerTemplate) => {
    setDraft(d => ({ ...d, First_Message: JSON.stringify({ en: tpl.body.en, nl: tpl.body.nl }) }));
    setFirstMessageFocused(false); // land back on the live preview showing the applied template
  };
```

- [ ] **Step 5: Rewrite the First Message JSX block**

Change (the full-width block placed by Task 2, right after Knowledge Base):

```tsx
      {/* First Message — the opener template. This is the field Finn live-edits
          on screenshare during the demo (Part 1 of the trust-kit spec). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare} label={t("config.firstMessage")}
          value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              {rawEditOpen ? (
                <>
                  <EditText
                    value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
                    onChange={(v) => onTextChange("First_Message", draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template, v)}
                    multiline
                    minRows={3}
                    placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                    <CopyButton value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)} />
                    <button type="button" onClick={() => setRawEditOpen(false)} className="la-btn la-btn--soft" style={MONO_BTN_STYLE}>
                      {t("config.previewOpener")}
                    </button>
                    <button type="button" onClick={() => setTemplatesOpen(true)} className="la-btn la-btn--soft" style={MONO_BTN_STYLE}>
                      {t("config.openerTemplatesButton")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: 13, lineHeight: 1.5, color: 'var(--ink)',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
                    padding: '10px 12px', whiteSpace: 'pre-wrap', minHeight: 64,
                  }}>
                    {previewText || t("config.previewEmpty")}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                    <button type="button" onClick={() => setRawEditOpen(true)} className="la-btn la-btn--soft" style={MONO_BTN_STYLE}>
                      {t("config.editOpener")}
                    </button>
                    <button type="button" onClick={() => setTemplatesOpen(true)} className="la-btn la-btn--soft" style={MONO_BTN_STYLE}>
                      {t("config.openerTemplatesButton")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>
```

to:

```tsx
      {/* First Message — the opener template. This is the field Finn live-edits
          on screenshare during the demo (Part 1 of the trust-kit spec). Click the
          preview to edit; blur reverts to preview (draft autosaves as-you-type). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare} label={t("config.firstMessage")}
          value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
          editChild={isEditing ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="la-btn la-btn--soft la-btn--icon"
                title={t("config.openerTemplatesButton")}
                style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, zIndex: 1 }}
              >
                <LayoutTemplate size={14} />
              </button>
              {firstMessageFocused ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
                  <EditText
                    value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
                    onChange={(v) => onTextChange("First_Message", draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template, v)}
                    onBlur={() => setFirstMessageFocused(false)}
                    multiline
                    minRows={3}
                    autoFocus
                    placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
                  />
                  <div style={{ alignSelf: 'flex-start' }}>
                    <CopyButton value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)} />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setFirstMessageFocused(true)}
                  style={{
                    fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', cursor: 'text',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
                    padding: '10px 40px 10px 12px', whiteSpace: 'pre-wrap', minHeight: 64,
                  }}
                >
                  {previewText || t("config.previewEmpty")}
                </div>
              )}
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>
```

- [ ] **Step 6: Drop the now-unused `MONO_BTN_STYLE` constant**

Its only call sites were the "Edit"/"Preview"/"Templates" buttons removed in Step 5. Delete this block entirely:

```tsx
const MONO_BTN_STYLE: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
};
```

- [ ] **Step 7: Delete the now-unused `previewOpener`/`editOpener` locale keys**

In `client/src/locales/en/campaigns.json`, delete these two lines:

```json
    "previewOpener": "Preview",
    "editOpener": "Edit",
```

In `client/src/locales/nl/campaigns.json`, delete:

```json
    "previewOpener": "Voorbeeld",
    "editOpener": "Bewerken",
```

- [ ] **Step 8: Verify**

Open a campaign's Business tab. Confirm the First Message field shows a preview box (no Edit/Preview buttons) with a small icon-only button in its top-right corner using a "layout template" icon (grid-like icon, NOT a pencil — the pencil is reserved for the in-popup template-row editing). Click anywhere in the preview text: confirm it switches to an editable, auto-focused textarea with the cursor at the end of the existing text, and a small copy-icon button appears bottom-left under it. Type a change, then click elsewhere on the page (blur): confirm it reverts to the preview view showing your edited text. Click the top-right template icon while in preview state, and again while in edit state: confirm both open the same Templates popup. Confirm picking a template from the popup updates the text and lands back on the preview view.

- [ ] **Step 9: Commit**

```bash
git add client/src/features/campaigns/components/formFields/EditText.tsx client/src/features/campaigns/components/settings/BusinessSectionFields.tsx client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json
git commit -m "feat(campaigns): click-to-edit First Message with icon-only Templates button"
```
