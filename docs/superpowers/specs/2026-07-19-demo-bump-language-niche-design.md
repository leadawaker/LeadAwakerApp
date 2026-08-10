# Demo Bumps: Language-Aware + Niche-Aware — Design

**Date:** 2026-07-19
**Scope:** Demo campaigns only (Universal Demo = campaign 60, Discovery Demo = campaign 61). Real client campaigns keep single-language bump templates.
**Repos touched:** `/home/gabriel/automations` (engine), LeadAwakerApp (CRM client + DB data). No schema changes.

## Problem

1. Demo bump messages go out in English even when the tester ran the demo in Dutch. AI-generated bumps already follow the lead's language, but they only trigger after 3+ inbound messages; below that, the static English template is sent. Even AI bumps risk sounding like translated English rather than natural Dutch.
2. Universal Demo bumps are generic. Each demo session carries the visitor's business config (company name, service, niche terms, scenario) in the `Leads.demo_niche` JSON column, and the AI conversation path already overlays it onto the campaign context (`_overlay_demo_niche_onto_campaign`, `automations/src/automations/conversation/prompt_builder.py:160`). The demo bump scheduler does not use that overlay, so bumps ignore the business the visitor created.

## Goals

- Every demo bump (AI or static fallback) is written in the lead's language (`Leads.language`, set by the demo form) and sounds native, never like a translation.
- Universal Demo bumps reference the session's business/niche/scenario.
- Gabriel can see and edit both language variations of demo bump templates in the CRM, the same way the campaign Business tab works (one field, `{"en","nl"}` JSON, shown per CRM UI language).

## Non-Goals

- No bilingual bump templates for real client campaigns (explicit user decision).
- No new DB columns, tables, or API endpoints.
- No changes to bump cadence, eligibility, or the fixes shipped earlier today (latest-session-per-phone filter, 72h staleness guard, `max_bumps`).

## Design

### 1. AI-first demo bumps — `automations/src/automations/demo_bump_scheduler.py`

- In `_send_bump`, drop the `inbound_count >= AI_BUMP_MIN_RESPONSES` gate for demo leads: always attempt `generate_ai_bump` first (unless the campaign's `use_ai_bumps` is explicitly false), falling back to the static template on `None`/exception. Even a session with only the first message gives the generator enough context (outbound history + niche overlay).
- Before building `campaign_account`, overlay the lead's `demo_niche` onto it by reusing `_overlay_demo_niche_onto_campaign` from `conversation/prompt_builder.py`. For campaign 61 (no `demo_niche`), the overlay is a no-op and campaign fields apply unchanged. Apply the same overlay in `_send_booking_nudge`.
- Static fallback resolution becomes a pure helper (for testability), e.g. `resolve_demo_template(raw, lang, subs) -> str | None`:
  1. Resolve the language slot with the engine's existing `resolve_lang` (used at `ai_bump_generator.py:141`). Plain legacy strings pass through unchanged.
  2. Substitute placeholders: `{first_name}` plus niche terms `{project_term}`, `{service_name}`, `{company_name}`, `{advisor_term}` from the overlaid `campaign_account`, with neutral defaults when missing (`project_term` → "project", others → the campaign-column values already present). `demo_niche` terms are generated in the session's language at session creation (`server/demo-session.ts:102`), so substituted values are language-correct for free.

### 2. Native-language generation — `automations/src/automations/ai_bump_generator.py`

Strengthen the language instruction in all three generator functions (main bump `:74/:221`, and the two later generators loading language at `:369-370` and `:481-482`): write natively in the lead's language the way a native speaker would phrase it; the English reference template conveys intent and tone only — never translate it literally. One shared instruction-block constant so the three stay consistent.

### 3. Bilingual static templates — DB data update (campaigns 60 + 61 only)

`bump_1..4_template` values become JSON strings `{"en": "...", "nl": "..."}`, the exact pattern `First_Message` already uses (`shared/schema.ts:528`, resolved via `shared/langField.ts`).

Campaign 60 (Universal — with niche placeholder):

| # | en | nl |
|---|----|----|
| 1 | Hi {first_name}! Just checking in, I figured you got busy before. | Hoi {first_name}! Even een berichtje, ik denk dat je het druk had. |
| 2 | What's holding you back from moving forward with your {project_term}? | Wat houdt je nog tegen om verder te gaan met je {project_term}? |
| 3 | Is it a trust thing? | Is het een kwestie van vertrouwen? |
| 4 | I won't bother you anymore {first_name}. If you ever need to discuss it in the future, I will be here for you :) | Ik zal je niet langer lastigvallen {first_name}. Mocht je er in de toekomst nog eens over willen praten, dan weet je me te vinden :) |

Campaign 61 (Discovery — fixed business, no placeholders): same copy with bump 2 as "…with your project?" / "…met je project?".

Copy is a starting point; Gabriel can refine either language slot in the CRM afterwards (section 4).

### 4. CRM visibility — client only

- **Edit:** `client/src/features/campaigns/components/settings/AISectionFields.tsx` (per-bump card, `bump_${n}_template` textarea around lines 69-110): display the slot for the current CRM UI language via `resolveLang(raw, uiLang)` and write edits back with `setLang` (merge current slot, preserve the other), mirroring `BusinessSectionFields.tsx:84-97`. Plain-string templates (real campaigns) round-trip unchanged as plain strings.
- **Read-only view:** `BumpCard` in `client/src/features/campaigns/components/CampaignDetailPanel.tsx:315-335` renders `resolveLang(template, uiLang)` like the First Message block directly above it (`:308`).
- Remember the `buildDraft()` whitelist in `useCampaignDetail.ts` already includes bump template fields (no new fields added), and campaign settings auto-save after 1.5s — no Save button.

## Edge Cases

- **AI generation fails or returns empty** → static bilingual template, resolved + substituted; if that's also empty, skip with the existing `no_template` warning.
- **Lead language missing/unknown** → fall back to campaign `language`, then `en` (existing `resolve_lang` semantics).
- **`pt` demo sessions**: the demo form schema still allows `pt`; `resolve_lang` falls back to `en` for locales without a slot. No `pt` template copy (product dropped PT).
- **Legacy plain-string template on any campaign** → `resolve_lang` passthrough; behavior identical to today.
- **Unresolved placeholder** (term missing and no default) → substitute the neutral default, never send a literal `{project_term}`.

## Testing & Verification

1. **pytest (pure functions):** new `automations/tests/test_demo_bump_templates.py` covering `resolve_demo_template`: en/nl slot resolution, plain-string passthrough, placeholder substitution, missing-term defaults, empty result → None.
2. **Engine:** `./preflight.sh` PASS → `pm2 restart leadawaker-engine --update-env` → clean startup logs.
3. **Live check:** run a fresh Universal Demo session (nl + a distinctive niche) from Gabriel's own phone, abandon it mid-conversation, and confirm the next-day bump is Dutch and niche-aware. Lead 420 organically validates the AI-first path at its 24h mark. No test messages to strangers.
4. **CRM:** flip UI language EN↔NL on campaign 60's settings and confirm both template variations display/edit correctly, and that a real campaign's plain-string template still shows unchanged.

## Rollout Notes

- Engine does not hot-reload: preflight + pm2 restart required (`automations/CLAUDE.md`).
- DB template update is data-only; apply after the engine code deploy so JSON never renders raw in a sent message (the resolver ships first).
- Automations repo has pre-existing uncommitted work; commit engine changes separately from unrelated files.
