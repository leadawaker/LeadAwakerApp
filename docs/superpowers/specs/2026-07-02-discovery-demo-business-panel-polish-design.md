# Discovery Demo Business Panel Polish — Design

**Date:** 2026-07-02
**Status:** Implemented and verified live on campaign #61 (Discovery Demo). Extended beyond original scope: preview is now the default (live-reactive) view with an Edit toggle, plus a Templates popup offering 9 pre-written opener archetypes (resolved in the CRM's UI language, applied to both language slots on pick).
**Owner:** Gabriel, built by Claude
**Builds on:** `2026-07-02-discovery-demo-trust-kit-design.md` (Business panel reorg, objection playbook, First Message field)

## Problem

Two small gaps surfaced in the Business panel (`BusinessSectionFields.tsx`) after using it live:

1. There is no way to see what the First Message opener will actually resolve to (with `{first_name}`, `{project}`, `{business}`, etc. substituted) without launching a real WhatsApp conversation. This surfaced a real bug: a Discovery Demo send to "Instakeukens" showed `{project}` as "Ontwerp en fabricage inclusief installatie" (the campaign's `service_name`) instead of "keuken" (the niche vocabulary's canonical term) — see Root Cause below.
2. All three objection-playbook rows show the identical placeholder example ("It's too expensive"), which doesn't demonstrate the range of objections the feature is meant to handle.
3. Field order in the panel doesn't group related fields: Demo Lead Name is separated from Company Name by the full-width First Message block.

## Root Cause (already fixed, informs this design)

The Python engine has two independent send paths for a campaign's opener:

- `campaign_launcher.py::_render_first_message` (regular campaigns) — merges `get_niche_terms()` into the campaign dict before substitution, so `{project}` resolves to the niche vocabulary's term.
- `demo_recap.py::_send_first_message` (used for demo/Discovery Demo campaigns' first inbound reply) — did **not** do this merge, so `{project}` fell through to `campaign_service` / `service_name` instead.

Fixed in this session (`/home/gabriel/automations/src/automations/demo_recap.py`): added the same `get_niche_terms()` merge, plus a matching fix for `First_Message` language resolution (was sending the raw `{"en":...,"nl":...}` JSON blob verbatim in some cases). Both verified via `preflight.sh` + `pm2 restart leadawaker-engine`.

This design's Preview button must resolve `{project}` and friends the same corrected way — via `buildMap()`, which already does this merge on the client side (used today by the AI-prompt preview) — so the preview and the real send never disagree again.

## Goals

1. A "Preview opener" button under the First Message editor that shows the fully resolved text (language picked, all `{variable}` tokens substituted, niche terms from the live vocabulary API).
2. Distinct, useful example placeholders for objection rows 2 and 3.
3. Reorder: Company Name + Demo Lead Name share a row; First Message follows (full width); Agent Name + Agent Style follow that.

## Out of Scope

- A "send this opener to my phone" test-send button — explicitly rejected in the trust-kit spec (editing live on screen is the demo payoff, not a test send). This preview is local-only, no message is sent anywhere.
- Editing niche vocabulary terms from this panel — that's the existing Niche Words settings page.
- Changing the objection playbook's *saved* content — only the empty-state placeholder examples change.

## Design

### 1. Field reorder

In `BusinessSectionFields.tsx`, move the "Demo lead name" `InfoRow` block to immediately follow the Company Name `InfoRow`, before the First Message block. Both are single-cell (non-full-width) items in the `1fr 1fr` grid, and First Message is `gridColumn: '1 / -1'`, so this reorder alone yields:

- Row 1: Company Name | Demo Lead Name
- Row 2: First Message (full width)
- Row 3: Agent Name | Agent Style
- (Service, USP, KB, Objection Playbook unchanged below)

No layout/CSS changes — pure JSX reordering.

### 2. Objection placeholder examples

Three distinct examples so each row demonstrates a different objection archetype (price, competitor comparison, stalling):

| # | EN key | EN copy | NL key | NL copy |
|---|--------|---------|--------|---------|
| 1 (existing, unchanged) | `config.objectionPlaceholder` | e.g. "It's too expensive" | `config.objectionPlaceholder` | bijv. "Het is te duur" |
| 2 (new) | `config.objectionPlaceholder2` | e.g. "The competitor is cheaper" | `config.objectionPlaceholder2` | bijv. "De concurrent is goedkoper" |
| 3 (new) | `config.objectionPlaceholder3` | e.g. "We need to think about it" | `config.objectionPlaceholder3` | bijv. "We willen er nog even over nadenken" |

In the component, replace the single `t("config.objectionPlaceholder")` call in the `[0,1,2].map(...)` block with an index lookup into `["config.objectionPlaceholder", "config.objectionPlaceholder2", "config.objectionPlaceholder3"]`. The answer-field placeholder (`answerPlaceholder`) stays generic and shared across all three rows — only the objection-text placeholder varies.

### 3. Preview opener button

**Trigger:** a small button below the First Message `EditText`/`CopyButton` row, visible only while `isEditing` is true (same visibility as the editor itself). Label: "Preview" (i18n key `config.previewOpener`).

**State on click (toggle):**
- If not currently previewing: set `previewOn = true`, `previewLoading = true`; fetch niche terms; compute resolved text; set `previewLoading = false`.
- If currently previewing: set `previewOn = false` (back to the editor, no re-fetch needed if pressed again — cache the last fetch keyed by niche+language for the component's lifetime).

**Display (chosen UX: replace, not inline-expand):** while `previewOn` is true, the voice-note toggle, `EditText`, and `CopyButton` are replaced by:
- A read-only text block showing the resolved message (or "Resolving…" while `previewLoading`, or "No message configured yet." if the resolved text is empty).
- A "Back to edit" button that sets `previewOn = false`.

**Resolution logic (data flow):**

1. **Language:** use `campaign.language` (falling back to `draft.language` if the Behavior section has an unsaved edit, else `"en"`) — the campaign's actual send language, *not* the CRM viewer's UI language. This matches what the engine sends, which is the whole point of the button (catch language/token bugs like the Instakeukens one before they go out).
2. **Niche terms:** `GET /api/niche-vocabulary/:niche?lang=<lang>` (existing endpoint, already used by `PromptEditorPanel.tsx`'s preview) using `campaign.niche`. Merge the response over `DEFAULT_NICHE_TERMS[lang]` (same fallback shape `PromptEditorPanel.tsx` builds — `project_term`/`project_term_list`, `proposal_term`/`_list`, `decision_term`/`_list`, `advisor_term`/`_list`, `visit_term`/`_list`) so a niche with no vocabulary row still resolves to sensible defaults instead of leaking a raw `{project}` token. On fetch failure, use `DEFAULT_NICHE_TERMS[lang]` alone.
3. **Lead identity for `{first_name}`:** `launchName.trim()` (the Demo Lead Name field) if non-empty, else the current logged-in user's first name via `useSession()` (`user.fullName.split(" ")[0]`), else left unresolved.
4. **Campaign shape:** merge `{...campaign, ...draft}` (so unsaved edits — e.g. a First Message being actively typed, or a Company Name change made moments ago — show in the preview) and map the merged snake_case object into the existing `CampaignForPreview` (camelCase) shape from `resolveVariables.ts`: `companyName`, `demoClientName`, `agentName`, `serviceName`, `campaignService`, `campaignUsp`, `calendarLink`, `firstMessage`, `whatLeadDid`, `firstTouch`, `inquiriesSource`, `inquiryTimeframe`, `niche`, `nicheQuestion`, `bookingMode`, `positioning`, `aiDisclosure`, `language`, `aiStyleOverride`, `description`, `aiRole`, `typoCount`, `kb`, `accountsId`.
5. **Resolve:** call the existing `buildMap(campaignForPreview, { firstName }, null, language, { nicheTerms })` from `resolveVariables.ts` and read `map.first_message` — this function already does the exact two-step resolution needed (pick the `{en,nl}` language variant of `First_Message`, then substitute `{variable}` tokens against the same map), because it was built to mirror the engine's `personalize_message()`. No new resolution logic is written; this button is purely new UI wired to existing, already-correct client logic.

**Why not a server round-trip through the Python engine instead?** The client-side `resolveVariables.ts` already mirrors `personalize_message()` closely enough for prompt previews elsewhere in the app, and reusing it avoids adding a new API endpoint whose only job would be to duplicate that mirroring. Trade-off: if the two implementations drift again (as they did for the demo path), the preview could show correct text while the real send is still wrong, or vice versa — same class of risk as the bug just fixed. Accepted because it matches the existing pattern in this codebase (`PromptEditorPanel.tsx`) and keeps the change small; not worth a new endpoint for a same-session convenience preview.

## Testing

- Manual: open a Discovery Demo campaign (e.g. id 61), edit First Message with `{first_name}`, `{business}`, `{project}` tokens, click Preview with Demo Lead Name empty (should show session user's first name) and filled (should show that name instead). Switch campaign language and re-preview to confirm the language variant changes.
- Manual: campaign with no Niche_Vocabulary row for its niche — confirm `{project}` still resolves via `DEFAULT_NICHE_TERMS`, not a raw token.
- Manual: verify the three objection rows show distinct placeholder text when empty, in both `en` and `nl` UI languages.
- Manual: verify grid reorder (Company Name + Demo Lead Name same row, First Message below, Agent Name + Agent Style below that) in both the compact (mobile tab) and full desktop layouts.
