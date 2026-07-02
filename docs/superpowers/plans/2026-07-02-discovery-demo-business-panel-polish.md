# Discovery Demo Business Panel Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Discovery Demo campaign's Business panel (`BusinessSectionFields.tsx`), reorder the Demo Lead Name field next to Company Name, give objection rows 2 and 3 distinct placeholder examples, and add a "Preview opener" button that shows the First Message with all `{variable}` tokens resolved (live niche terms, current-user or Demo Lead first name).

**Architecture:** All three changes live in one component file plus its two locale files. The Preview button adds no new backend endpoint — it reuses `buildMap()` from `client/src/features/prompts/utils/resolveVariables.ts` (already the source of truth for client-side token resolution, mirroring the Python engine's `personalize_message()`) and the existing `GET /api/niche-vocabulary/:niche?lang=` endpoint, following the exact fetch/merge pattern already proven in `PromptEditorPanel.tsx`.

**Tech Stack:** React + TypeScript, react-i18next, existing `formFields` primitives (`InfoRow`, `EditText`, `EditToggle`, `CopyButton`), `useSession()` hook, `apiFetch()`.

## Global Constraints

- Every user-facing string goes through i18n — no hardcoded copy. Locale files: `client/src/locales/en/campaigns.json`, `client/src/locales/nl/campaigns.json`.
- Only `en` and `nl` — Portuguese was dropped product-wide 2026-06-30. Do not add `pt` keys.
- Never run `npx tsc --noEmit` unless Gabriel explicitly asks.
- App runs via pm2 with `tsx watch` — file saves under `client/src` hot-reload in the browser. Never run `npm run dev`.
- No new colors/spacing outside existing CSS custom properties (`var(--ink)`, `var(--mute)`, `var(--line)`, `var(--space-*)`, etc.) per `UI_STANDARDS.md`.
- Preview is local-only — no message is ever sent. No new API endpoint is added (per the design doc's explicit trade-off).

---

## Task 1: Field reorder — Demo Lead Name next to Company Name

**Files:**
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx:92-142`

**Interfaces:** None — pure JSX reordering, no new props or state.

- [ ] **Step 1: Move the Demo Lead Name `InfoRow` block to immediately follow Company Name**

Current order (lines 92-142): Company Name → First Message (full width) → Demo Lead Name.
Target order: Company Name → Demo Lead Name → First Message (full width).

Replace:

```tsx
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      <InfoRow icon={Building2} label={t("config.companyName")} value={String(draft.company_name ?? campaign.company_name ?? "")}
        {...editFor("company_name")}
        editChild={isEditing ? <EditText value={String(draft.company_name ?? "")} onChange={(v) => setDraft(d => ({...d, company_name: v}))} placeholder="Company name…" {...focusFor("company_name")} /> : undefined}
      />

      {/* First Message — the opener template. This is the field Finn live-edits
          on screenshare during the demo (Part 1 of the trust-kit spec). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare} label={t("config.firstMessage")}
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
                value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
                onChange={(v) => onTextChange("First_Message", draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template, v)}
                multiline
                minRows={3}
                placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
              />
              <CopyButton value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)} />
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>

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

      <InfoRow icon={Bot} label={t("config.agentName")} value={campaign.agent_name}
```

With:

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

      {/* First Message — the opener template. This is the field Finn live-edits
          on screenshare during the demo (Part 1 of the trust-kit spec). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare} label={t("config.firstMessage")}
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
                value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
                onChange={(v) => onTextChange("First_Message", draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template, v)}
                multiline
                minRows={3}
                placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
              />
              <CopyButton value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)} />
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>

      <InfoRow icon={Bot} label={t("config.agentName")} value={campaign.agent_name}
```

(Note: this snippet intentionally omits the Preview-button UI added in Task 3 — Task 3 edits this same First Message block again, after this reorder lands.)

- [ ] **Step 2: Verify in browser**

Open `app.leadawaker.com`, navigate to a Discovery Demo campaign's settings → Business panel, click Edit. Confirm row 1 is Company Name | Demo Lead Name, row 2 (full width) is First Message, row 3 is Agent Name | AI Style Override. Check both desktop layout and the mobile/compact tab layout (`compact` prop).

- [ ] **Step 3: Commit**

```bash
git add client/src/features/campaigns/components/settings/BusinessSectionFields.tsx
git commit -m "refactor(campaigns): move Demo Lead Name next to Company Name in Business panel"
```

---

## Task 2: Distinct objection placeholder examples

**Files:**
- Modify: `client/src/locales/en/campaigns.json:331`
- Modify: `client/src/locales/nl/campaigns.json:331`
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx` (objection row placeholder, currently line 230 pre-Task-1)

**Interfaces:** None — new i18n keys only, consumed by the existing `objectionRows()`/`[0,1,2].map(...)` block.

- [ ] **Step 1: Add the two new i18n keys to `en/campaigns.json`**

In `client/src/locales/en/campaigns.json`, find:

```json
    "objectionPlaceholder": "e.g. \"It's too expensive\"",
    "answerPlaceholder": "Your approved answer…",
```

Replace with:

```json
    "objectionPlaceholder": "e.g. \"It's too expensive\"",
    "objectionPlaceholder2": "e.g. \"The competitor is cheaper\"",
    "objectionPlaceholder3": "e.g. \"We need to think about it\"",
    "answerPlaceholder": "Your approved answer…",
```

- [ ] **Step 2: Add the matching keys to `nl/campaigns.json`**

In `client/src/locales/nl/campaigns.json`, find:

```json
    "objectionPlaceholder": "bijv. \"Het is te duur\"",
    "answerPlaceholder": "Jouw goedgekeurde antwoord…",
```

Replace with:

```json
    "objectionPlaceholder": "bijv. \"Het is te duur\"",
    "objectionPlaceholder2": "bijv. \"De concurrent is goedkoper\"",
    "objectionPlaceholder3": "bijv. \"We willen er nog even over nadenken\"",
    "answerPlaceholder": "Jouw goedgekeurde antwoord…",
```

- [ ] **Step 3: Wire the three keys into the objection row map in `BusinessSectionFields.tsx`**

Find the objection playbook block:

```tsx
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
```

Replace with (add the `OBJECTION_PLACEHOLDER_KEYS` constant near the top of the file, alongside `AGENT_NAME_OPTIONS`, and index into it):

```tsx
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
```

And near the top of the file, right after `AGENT_NAME_OPTIONS`:

```tsx
const AGENT_NAME_OPTIONS = ["Thomas", "Mark", "Sophie", "Lisa"].map((n) => ({ label: n, store: n }));

// Distinct example objections per row (price / competitor / stalling) so the
// playbook demonstrates its range instead of repeating the same example 3x.
const OBJECTION_PLACEHOLDER_KEYS = [
  "config.objectionPlaceholder",
  "config.objectionPlaceholder2",
  "config.objectionPlaceholder3",
] as const;
```

- [ ] **Step 4: Verify in browser**

In the Business panel, Edit mode, clear all three objection text fields if populated (or use a campaign where they're empty) and confirm each row shows a different placeholder. Switch the CRM UI language (nl) via the top-right language switcher and confirm the Dutch placeholders appear.

- [ ] **Step 5: Commit**

```bash
git add client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json client/src/features/campaigns/components/settings/BusinessSectionFields.tsx
git commit -m "feat(campaigns): distinct example objections for playbook rows 2 and 3"
```

---

## Task 3: Preview opener button

**Files:**
- Modify: `client/src/features/campaigns/components/settings/BusinessSectionFields.tsx`
- Modify: `client/src/locales/en/campaigns.json`
- Modify: `client/src/locales/nl/campaigns.json`

**Interfaces:**
- Consumes: `buildMap(campaign?: CampaignForPreview, lead?: LeadForPreview, account: null, lang?: string, opts?: ResolveOpts): Record<string, string | undefined | null>` and `DEFAULT_NICHE_TERMS: Record<"en"|"nl", Record<string,string>>` from `@/features/prompts/utils/resolveVariables` (read-only, not modified). `map.first_message` is the resolved opener text.
- Consumes: `useSession(): { status: "loading"|"authenticated"|"unauthenticated"; user?: { fullName: string | null } }` from `@/hooks/useSession`.
- Consumes: `apiFetch(url: string, options?: RequestInit): Promise<Response>` from `@/lib/apiUtils`.
- Consumes existing component props: `campaign: any`, `draft: Record<string, unknown>`, `launchName?: string` (already destructured in the component).
- Produces: no new exports — this is leaf UI state internal to `BusinessSectionFields`.

- [ ] **Step 1: Add imports**

At the top of `BusinessSectionFields.tsx`, replace:

```tsx
import { useTranslation } from "react-i18next";
import {
  Bot, Building2, MessageSquare,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle,
} from "lucide-react";
import {
  EditText, EditToggle, InfoRow, CopyButton,
} from "../formFields";
import { LocalizedCombo } from "../formFields/LocalizedCombo";
import {
  asCampaignLang,
  USP_OPTIONS, AI_STYLE_OPTIONS, SERVICE_OPTIONS,
  placeholderFor, optionLabel, optionStore,
} from "./fieldLocale";
import { resolveLang } from "@shared/langField";
```

With:

```tsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot, Building2, MessageSquare,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle,
} from "lucide-react";
import {
  EditText, EditToggle, InfoRow, CopyButton,
} from "../formFields";
import { LocalizedCombo } from "../formFields/LocalizedCombo";
import {
  asCampaignLang,
  USP_OPTIONS, AI_STYLE_OPTIONS, SERVICE_OPTIONS,
  placeholderFor, optionLabel, optionStore,
} from "./fieldLocale";
import { resolveLang } from "@shared/langField";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { buildMap, DEFAULT_NICHE_TERMS, type CampaignForPreview } from "@/features/prompts/utils/resolveVariables";
```

- [ ] **Step 2: Verify the imports don't break anything**

Save the file, check the browser (pm2 hot-reloads) shows no red error overlay on the Campaign Settings page. `useEffect`/`useRef` are added now but not yet used — that's expected, they're consumed in Step 3.

- [ ] **Step 3: Add preview state, the niche-terms fetch helper, and the campaign-shape mapper**

Inside the component body, right after the existing `objectionRows`/`updateObjectionRow` block (just before the `return (`), add:

```tsx
  /* ── Preview opener button ──────────────────────────────────────────────
     Resolves the First Message with all {variable} tokens substituted, using
     the same buildMap() the AI-prompt preview uses (mirrors the engine's
     personalize_message()). Local-only — nothing is sent. */
  const session = useSession();
  const [previewOn, setPreviewOn] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const nicheTermsCacheRef = useRef<Map<string, Record<string, string>>>(new Map());

  // Leaving edit mode should not leave a stale preview showing next time.
  useEffect(() => { if (!isEditing) setPreviewOn(false); }, [isEditing]);

  const fetchNicheTerms = async (niche: string, lang: "en" | "nl"): Promise<Record<string, string>> => {
    const defaults = DEFAULT_NICHE_TERMS[lang];
    try {
      const r = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}?lang=${lang}`);
      if (!r.ok) return defaults;
      const groups = await r.json();
      if (!groups) return defaults;
      const pick = (a?: string[]) => (Array.isArray(a) && a.length ? a[0] : "");
      const list = (a?: string[]) => (Array.isArray(a) ? a.join(", ") : "");
      return {
        ...defaults,
        project_term: pick(groups.projectTerm) || defaults.project_term,
        project_term_list: list(groups.projectTerm) || defaults.project_term_list,
        proposal_term: pick(groups.proposalTerm) || defaults.proposal_term,
        proposal_term_list: list(groups.proposalTerm) || defaults.proposal_term_list,
        decision_term: pick(groups.decisionTerm) || defaults.decision_term,
        decision_term_list: list(groups.decisionTerm) || defaults.decision_term_list,
        advisor_term: pick(groups.advisorTerm) || defaults.advisor_term,
        advisor_term_list: list(groups.advisorTerm) || defaults.advisor_term_list,
        visit_term: pick(groups.visitTerm) || defaults.visit_term,
        visit_term_list: list(groups.visitTerm) || defaults.visit_term_list,
      };
    } catch {
      return defaults;
    }
  };

  // Maps the merged {...campaign, ...draft} snake_case/camelCase-mixed shape
  // into CampaignForPreview, mirroring the mapper in PromptsPage.tsx so this
  // preview and the AI-prompt preview never drift on field-name handling.
  const buildCampaignForPreview = (raw: Record<string, unknown>): CampaignForPreview => {
    const get = (camel: string, snake: string) => (raw[camel] ?? raw[snake] ?? null) as string | null;
    return {
      id: Number(raw.id ?? raw.Id ?? 0),
      name: String(raw.name ?? raw.Name ?? ""),
      aiModel: String(raw.aiModel ?? raw.ai_model ?? ""),
      agentName: get("agentName", "agent_name"),
      serviceName: get("serviceName", "service_name"),
      campaignService: get("campaignService", "campaign_service"),
      campaignUsp: get("campaignUsp", "campaign_usp"),
      calendarLink: get("calendarLink", "calendar_link"),
      firstMessage: (raw.firstMessage ?? raw.first_message ?? raw.First_Message ?? null) as string | null,
      whatLeadDid: get("whatLeadDid", "what_lead_did"),
      firstTouch: get("firstTouch", "first_touch"),
      inquiriesSource: get("inquiriesSource", "inquiries_source"),
      inquiryTimeframe: get("inquiryTimeframe", "inquiry_timeframe"),
      niche: (raw.niche ?? null) as string | null,
      nicheQuestion: get("nicheQuestion", "niche_question"),
      bookingMode: (raw.bookingModeOverride ?? raw.booking_mode_override ?? null) as string | null,
      positioning: (raw.positioning ?? null) as string | null,
      aiDisclosure: get("aiDisclosure", "ai_disclosure"),
      language: (raw.language ?? null) as string | null,
      demoClientName: get("demoClientName", "demo_client_name"),
      companyName: get("companyName", "company_name"),
      aiStyleOverride: get("aiStyleOverride", "ai_style_override"),
      description: (raw.description ?? null) as string | null,
      aiRole: get("aiRole", "ai_role"),
      typoCount: (raw.typoCount ?? raw.typo_count ?? null) as number | null,
      kb: (raw.kb ?? null) as string | null,
      accountsId: (raw.accountsId ?? raw.Accounts_id ?? null) as number | null,
    };
  };

  const handlePreviewClick = async () => {
    if (previewOn) { setPreviewOn(false); return; }
    setPreviewOn(true);
    setPreviewLoading(true);

    // Merge unsaved edits over the saved campaign so a First Message the operator
    // is actively typing (or a Company Name change made moments ago) shows up.
    const raw: Record<string, unknown> = { ...campaign, ...draft };
    const lang: "en" | "nl" = String(raw.language ?? "en").toLowerCase().startsWith("nl") ? "nl" : "en";
    const niche = String(raw.niche ?? "").trim() || "__default__";
    const cacheKey = `${niche}|${lang}`;

    let terms = nicheTermsCacheRef.current.get(cacheKey);
    if (!terms) {
      terms = await fetchNicheTerms(niche, lang);
      nicheTermsCacheRef.current.set(cacheKey, terms);
    }

    // {first_name}: Demo Lead Name wins if filled, else the logged-in user's
    // first name (Finn or Gabriel, whoever is running the screenshare).
    const sessionFirstName = session.status === "authenticated"
      ? session.user.fullName?.split(" ")[0]
      : undefined;
    const firstName = launchName?.trim() || sessionFirstName || undefined;

    const campaignForPreview = buildCampaignForPreview(raw);
    const map = buildMap(campaignForPreview, { firstName }, null, lang, { nicheTerms: terms });
    setPreviewText(map.first_message ?? "");
    setPreviewLoading(false);
  };
```

- [ ] **Step 4: Add the four new i18n keys**

In `client/src/locales/en/campaigns.json`, find (this line was already touched by Task 2 — add after it):

```json
    "objectionPlaceholder3": "e.g. \"We need to think about it\"",
```

Add right after it (still inside the same `"config"` object):

```json
    "objectionPlaceholder3": "e.g. \"We need to think about it\"",
    "previewOpener": "Preview",
    "previewBackToEdit": "Back to edit",
    "previewResolving": "Resolving…",
    "previewEmpty": "No message configured yet.",
```

In `client/src/locales/nl/campaigns.json`, find:

```json
    "objectionPlaceholder3": "bijv. \"We willen er nog even over nadenken\"",
```

Add right after it:

```json
    "objectionPlaceholder3": "bijv. \"We willen er nog even over nadenken\"",
    "previewOpener": "Voorbeeld",
    "previewBackToEdit": "Terug naar bewerken",
    "previewResolving": "Bezig met omzetten…",
    "previewEmpty": "Nog geen bericht ingesteld.",
```

- [ ] **Step 5: Wire the Preview UI into the First Message block**

Replace the First Message block's `editChild` (as it stands after Task 1's reorder):

```tsx
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                <EditToggle
                  value={!!draft.first_message_voice_note}
                  onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
                />
              </div>
              <EditText
                value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
                onChange={(v) => onTextChange("First_Message", draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template, v)}
                multiline
                minRows={3}
                placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
              />
              <CopyButton value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)} />
            </div>
          ) : undefined}
```

With:

```tsx
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              {previewOn ? (
                <>
                  <div style={{
                    fontSize: 13, lineHeight: 1.5, color: 'var(--ink)',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
                    padding: '10px 12px', whiteSpace: 'pre-wrap', minHeight: 64,
                  }}>
                    {previewLoading ? t("config.previewResolving") : (previewText || t("config.previewEmpty"))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewOn(false)}
                    className="la-btn la-btn--soft"
                    style={{ alignSelf: 'flex-start', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  >
                    {t("config.previewBackToEdit")}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                    <EditToggle
                      value={!!draft.first_message_voice_note}
                      onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
                    />
                  </div>
                  <EditText
                    value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)}
                    onChange={(v) => onTextChange("First_Message", draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template, v)}
                    multiline
                    minRows={3}
                    placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                    <CopyButton value={displayText(draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)} />
                    <button
                      type="button"
                      onClick={handlePreviewClick}
                      className="la-btn la-btn--soft"
                      style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      {t("config.previewOpener")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : undefined}
```

- [ ] **Step 6: Verify in browser (manual — no test harness exists for this component)**

Using playwright-cli or a manual browser check against `app.leadawaker.com` (credentials in memory: leadawaker@gmail.com / Admin1234):

1. Open Discovery Demo campaign (id 61, "Instakeukens" or similar), Business panel, Edit mode.
2. Type a First Message containing `{first_name}`, `{business}`, `{project}`. Leave Demo Lead Name empty. Click Preview — confirm the block replaces the editor, shows "Resolving…" briefly, then resolved text with the logged-in user's first name substituted for `{first_name}` and `{project}` resolved to the niche vocabulary term (e.g. "keuken" for niche "Kitchens"), not the service name.
3. Click "Back to edit" — confirm the editor returns with your typed text intact.
4. Fill Demo Lead Name (e.g. "Donald Duck") and click Preview again — confirm `{first_name}` now shows "Donald Duck" instead of the session user's name.
5. Switch the campaign's language in the Behavior tab (unsaved), return to Business tab, click Preview — confirm the resolved text switches to the other language's First Message variant.
6. Pick a campaign/niche with no `Niche_Vocabulary` row — confirm `{project}` still resolves via `DEFAULT_NICHE_TERMS` (e.g. "project" in English) instead of showing a raw `{project}` token.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/campaigns/components/settings/BusinessSectionFields.tsx client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json
git commit -m "feat(campaigns): Preview opener button resolves {variable} tokens live"
```

---

## Post-implementation

- [ ] Update `docs/superpowers/specs/2026-07-02-discovery-demo-business-panel-polish-design.md` status line from "Approved design, pending implementation plan" to "Implemented" once all three tasks are committed.
