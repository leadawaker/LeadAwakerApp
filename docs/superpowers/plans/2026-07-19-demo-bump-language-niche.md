# Demo Bumps: Language-Aware + Niche-Aware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make demo-campaign bumps (campaigns 60 Universal + 61 Discovery) speak the tester's language natively and reference the business/niche the tester configured, and let Gabriel see/edit both language variations in the CRM.

**Architecture:** Engine change in two repos. In `/home/gabriel/automations` (the Python engine) the demo bump scheduler becomes AI-first for demo leads, overlays the session's `demo_niche` persona onto the hand-built campaign dict, and resolves static fallback templates through a new pure `resolve_demo_template` helper (language slot + niche placeholder substitution). The AI bump generators gain a shared "write natively, do not translate" instruction. In LeadAwakerApp the DB gets bilingual `{"en","nl"}` template data for campaigns 60/61 only, and the CRM bump-template edit field + read-only card resolve to the operator's UI language exactly like the existing `First_Message` / Business-tab fields.

**Tech Stack:** Python 3 (asyncpg, structlog, APScheduler), pytest; React + TypeScript (Vite), react-i18next; PostgreSQL via NocoDB schema; no schema migration.

## Global Constraints

- **Scope is demo campaigns only** (campaign id 60 = Universal, 61 = Discovery). Real client campaigns keep single-language plain-string bump templates and must round-trip unchanged.
- **No schema changes, no new DB columns/tables/endpoints.** Bilingual data reuses the existing `{"en","nl"}` JSON-in-text-column pattern that `First_Message` already uses (`shared/schema.ts:528`, resolved via `shared/langField.ts`).
- **Never send a literal placeholder** (`{project_term}`, `{first_name}`, etc.) to a lead: always substitute a neutral default when the term is missing.
- **Locales are en + nl only.** No `pt` template copy (PT dropped product-wide). `resolve_lang` already falls back `pt` → `en`.
- **No em dashes** in any user-facing copy or prompt text. Use commas, periods, or colons.
- **Engine does not hot-reload.** After editing anything under `/home/gabriel/automations`, run `./preflight.sh` FIRST and only `pm2 restart leadawaker-engine --update-env` on PASS.
- **Rollout order:** engine code (Tasks 1-3) ships and restarts BEFORE the DB template data update (Task 4), so bilingual JSON is never sent raw. CRM tasks (5-6) are independent.
- **Do not run `tsc` / `npx tsc --noEmit`** automatically at any point. CRM changes are verified visually/by the running Vite dev server, not by a type check.
- **Commit engine changes separately** from the automations repo's pre-existing uncommitted work. Only commit when explicitly asked.

---

### Task 1: Pure `resolve_demo_template` helper + tests

Creates the language-aware, placeholder-substituting resolver used by the demo bump fallback path. Kept in its own tiny module so the pytest has no heavy import chain (only `tools.lang_field`).

**Files:**
- Create: `/home/gabriel/automations/src/automations/demo_bump_templates.py`
- Test: `/home/gabriel/automations/tests/test_demo_bump_templates.py`

**Interfaces:**
- Consumes: `resolve_lang` from `tools.lang_field` (existing: language-slot resolver, plain strings pass through, JSON `{"en","nl"}` selects `lang` with `en` fallback).
- Produces: `resolve_demo_template(raw: object, lang: str, subs: dict[str, str]) -> str | None` — resolves the language slot for `lang`, substitutes every `{key}` in `subs`, returns the trimmed string or `None` if the result is empty. Task 3 imports this.

- [ ] **Step 1: Write the failing test**

Create `/home/gabriel/automations/tests/test_demo_bump_templates.py`:

```python
from src.automations.demo_bump_templates import resolve_demo_template

SUBS = {
    "first_name": "Sam",
    "project_term": "kitchen",
    "service_name": "kitchen fitting",
    "company_name": "Baker Kitchens",
    "advisor_term": "advisor",
}


def test_selects_nl_slot():
    raw = '{"en": "Hi {first_name}!", "nl": "Hoi {first_name}!"}'
    assert resolve_demo_template(raw, "nl", SUBS) == "Hoi Sam!"


def test_selects_en_slot():
    raw = '{"en": "Hi {first_name}!", "nl": "Hoi {first_name}!"}'
    assert resolve_demo_template(raw, "en", SUBS) == "Hi Sam!"


def test_plain_string_passthrough():
    # Legacy single-language template on a real campaign — unchanged behavior.
    assert resolve_demo_template("Hi {first_name}!", "nl", SUBS) == "Hi Sam!"


def test_substitutes_niche_placeholder():
    raw = '{"nl": "Wat houdt je tegen om verder te gaan met je {project_term}?"}'
    assert resolve_demo_template(raw, "nl", SUBS) == "Wat houdt je tegen om verder te gaan met je kitchen?"


def test_pt_falls_back_to_en():
    raw = '{"en": "Hi {first_name}!", "nl": "Hoi {first_name}!"}'
    assert resolve_demo_template(raw, "pt", SUBS) == "Hi Sam!"


def test_missing_slot_returns_none():
    assert resolve_demo_template("", "nl", SUBS) is None
    assert resolve_demo_template(None, "nl", SUBS) is None


def test_whitespace_only_returns_none():
    assert resolve_demo_template('{"nl": "   "}', "nl", SUBS) is None


def test_leaves_unknown_placeholder_only_if_absent_from_subs():
    # Keys not in subs are left as-is; the caller guarantees all niche keys
    # are present with defaults, so a literal placeholder never ships.
    raw = '{"en": "Hi {first_name}, about {unknown_key}"}'
    assert resolve_demo_template(raw, "en", {"first_name": "Sam"}) == "Hi Sam, about {unknown_key}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_demo_bump_templates.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.automations.demo_bump_templates'`

- [ ] **Step 3: Write the helper**

Create `/home/gabriel/automations/src/automations/demo_bump_templates.py`:

```python
"""Pure resolver for demo-campaign static bump templates.

Demo bump templates on campaigns 60/61 are stored as `{"en": "...", "nl": "..."}`
JSON strings (the same pattern First_Message uses) and carry niche placeholders
like {project_term}. This module resolves the language slot for the lead's
language and substitutes the placeholders, so the static fallback is both
language-correct and niche-aware. No DB or network access — kept tiny and pure
for unit testing.
"""

from __future__ import annotations

from tools.lang_field import resolve_lang


def resolve_demo_template(raw: object, lang: str, subs: dict[str, str]) -> str | None:
    """Resolve `raw` (plain string or `{"en","nl"}` JSON) for `lang`, then
    substitute every `{key}` found in `subs`.

    Returns the trimmed message, or None when the resolved slot is empty/blank.
    Placeholders whose key is absent from `subs` are left untouched; callers
    must pass every niche key with a neutral default so a literal placeholder
    is never sent.
    """
    resolved = resolve_lang(raw, lang)
    if not resolved:
        return None
    for key, value in subs.items():
        resolved = resolved.replace("{" + key + "}", value)
    resolved = resolved.strip()
    return resolved or None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_demo_bump_templates.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/demo_bump_templates.py tests/test_demo_bump_templates.py
git commit -m "feat(demo-bump): pure resolve_demo_template helper (lang slot + niche placeholders)"
```

---

### Task 2: Shared "write natively, do not translate" instruction in AI bump generators

Strengthens the language rule across all three AI bump prompts so a Dutch lead gets Dutch phrased the way a native speaker would say it, using the English reference only for intent and tone.

**Files:**
- Modify: `/home/gabriel/automations/src/automations/ai_bump_generator.py`

**Interfaces:**
- Produces: module-level constant `_NATIVE_LANGUAGE_INSTRUCTION: str` inserted into `_SYSTEM_PROMPT`, `_REENGAGEMENT_SYSTEM_PROMPT`, and `_BOOKING_NUDGE_SYSTEM_PROMPT`. No signature changes; Task 3 is unaffected.

- [ ] **Step 1: Add the shared constant**

In `/home/gabriel/automations/src/automations/ai_bump_generator.py`, immediately after `AI_BUMP_MIN_RESPONSES = 3` (line 30), add:

```python
# Shared across all bump prompts: write natively in the lead's language.
# Any English reference/template shown below conveys intent and tone ONLY —
# it must never be translated word-for-word into the target language.
_NATIVE_LANGUAGE_INSTRUCTION = (
    "Write entirely in {language}, phrased the way a native {language} speaker "
    "would naturally say it. Any reference or template text below is written in "
    "English to convey intent and tone only: never translate it literally, "
    "re-express the idea in idiomatic {language}."
)
```

- [ ] **Step 2: Reference it from `_SYSTEM_PROMPT`**

In `_SYSTEM_PROMPT` (lines 52-84), replace rule 9:

```
9. Always write in {language}.
```

with:

```
9. {native_language_instruction}
```

- [ ] **Step 3: Reference it from `_REENGAGEMENT_SYSTEM_PROMPT`**

In `_REENGAGEMENT_SYSTEM_PROMPT` (lines 282-310), replace rule 7:

```
7. Always write in {language}.
```

with:

```
7. {native_language_instruction}
```

- [ ] **Step 4: Reference it from `_BOOKING_NUDGE_SYSTEM_PROMPT`**

In `_BOOKING_NUDGE_SYSTEM_PROMPT` (lines 313-341), replace rule 6:

```
6. Always write in {language}.
```

with:

```
6. {native_language_instruction}
```

- [ ] **Step 5: Feed the constant into all three `.format()` calls**

The three prompts already receive `language=language` in their `.format()` calls. Add the pre-formatted instruction alongside each. In `generate_ai_bump`, the `system = _SYSTEM_PROMPT.format(` call (line 214), add this kwarg (place it next to `language=language,`):

```python
        native_language_instruction=_NATIVE_LANGUAGE_INSTRUCTION.format(language=language),
```

In `generate_booking_nudge_bump`, the `system = _BOOKING_NUDGE_SYSTEM_PROMPT.format(` call (line 411), add the same kwarg next to `language=language,`:

```python
        native_language_instruction=_NATIVE_LANGUAGE_INSTRUCTION.format(language=language),
```

In `generate_reengagement_bump`, the `system = _REENGAGEMENT_SYSTEM_PROMPT.format(` call (line 520), add the same kwarg next to `language=language,`:

```python
        native_language_instruction=_NATIVE_LANGUAGE_INSTRUCTION.format(language=language),
```

- [ ] **Step 6: Verify the module imports and all prompts format cleanly**

Run:

```bash
cd /home/gabriel/automations && python -c "
from src.automations.ai_bump_generator import _SYSTEM_PROMPT, _REENGAGEMENT_SYSTEM_PROMPT, _BOOKING_NUDGE_SYSTEM_PROMPT, _NATIVE_LANGUAGE_INSTRUCTION
# Each prompt must still contain exactly one {native_language_instruction} slot.
for name, p in [('sys', _SYSTEM_PROMPT), ('reeng', _REENGAGEMENT_SYSTEM_PROMPT), ('nudge', _BOOKING_NUDGE_SYSTEM_PROMPT)]:
    assert '{native_language_instruction}' in p, name
print('OK: instruction slot present in all three prompts')
"
```

Expected: `OK: instruction slot present in all three prompts` (no `KeyError`, no traceback)

- [ ] **Step 7: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/ai_bump_generator.py
git commit -m "feat(bump): instruct AI to write natively, never translate the reference template"
```

---

### Task 3: AI-first + niche-overlay wiring in the demo bump scheduler

Makes demo bumps attempt AI first (dropping the 3-inbound gate for demo leads), overlays the session's `demo_niche` persona so bumps speak as the tester's configured business, and routes the static fallback through `resolve_demo_template`. Applies the overlay to the booking nudge too. Ends with preflight + engine restart.

**Files:**
- Modify: `/home/gabriel/automations/src/automations/demo_bump_scheduler.py`

**Interfaces:**
- Consumes: `resolve_demo_template` (Task 1); `_overlay_demo_niche_onto_campaign(campaign: dict, lead: dict) -> dict` from `src.automations.conversation.prompt_builder` (existing: returns a NEW merged dict, sets `company_name`/`service_name`/`advisor_term`/`project_term`/etc. from `lead["demo_niche"]` JSON, no-op when `demo_niche` is absent — so campaign 61 is unaffected). Note it sets `company_name`, NOT `name`; `generate_ai_bump` reads `name` for the company, so the wiring must copy the overlaid `company_name` into `name`.
- The lead dicts from `_get_demo_leads_due()` already include `demo_niche` (via `SELECT l.*`) and now `use_ai_bumps` (added below).

- [ ] **Step 1: Add imports and fetch `use_ai_bumps`**

In `/home/gabriel/automations/src/automations/demo_bump_scheduler.py`, extend the ai_bump_generator import block (lines 16-20) to keep `AI_BUMP_MIN_RESPONSES` (still referenced nowhere after this task, so it may be dropped) and add the two new imports below it:

```python
from src.automations.ai_bump_generator import (
    generate_ai_bump,
    generate_booking_nudge_bump,
)
from src.automations.conversation.prompt_builder import _overlay_demo_niche_onto_campaign
from src.automations.demo_bump_templates import resolve_demo_template
from tools.lang_field import norm_lang
```

(Removing `AI_BUMP_MIN_RESPONSES` from the import is intentional — the demo path no longer gates on it. Leave the other existing imports untouched.)

In `_get_demo_leads_due()`, add `c.use_ai_bumps,` to the SELECT list, right after `c.max_bumps,` (line 54):

```sql
                c.max_bumps,
                c.use_ai_bumps,
```

- [ ] **Step 2: Add a niche-overlay + subs helper**

Add this module-level helper to `demo_bump_scheduler.py` (place it just above `_send_bump`, after `_get_previous_bump_texts`):

```python
def _overlaid_account_and_subs(lead: dict, base: dict) -> tuple[dict, str, dict]:
    """Overlay the session's demo_niche persona onto a hand-built campaign_account
    dict and return (campaign_account, lang, subs).

    - The overlay sets company_name (not name); generate_ai_bump reads `name`,
      so we copy company_name -> name after overlaying.
    - subs are the neutral-defaulted niche placeholders for resolve_demo_template.
    """
    lang = norm_lang(lead.get("language") or base.get("language") or "en")
    account = _overlay_demo_niche_onto_campaign(base, lead)
    company = account.get("company_name")
    if company:
        account["name"] = company
    first_name = (lead.get("firstName") or lead.get("first_name") or "there").strip()
    subs = {
        "first_name": first_name,
        "project_term": account.get("project_term") or "project",
        "service_name": resolve_lang(account.get("service_name"), lang) or "our service",
        "company_name": account.get("company_name") or account.get("name") or "us",
        "advisor_term": account.get("advisor_term") or "advisor",
    }
    return account, lang, subs
```

Add `resolve_lang` to the `tools.lang_field` import from Step 1 so it reads:

```python
from tools.lang_field import norm_lang, resolve_lang
```

- [ ] **Step 3: Rewrite `_send_bump` to be AI-first with overlay + resolved fallback**

Replace the body of `_send_bump` (lines 155-206) with:

```python
async def _send_bump(lead: dict, stage: int) -> None:
    account_id = lead.get("Accounts_id") or lead.get("account_id_from_campaign") or 1
    phone = lead.get("phone")
    if not phone:
        return

    agent_name = lead.get("agent_name") or "Assistant"
    # Resolve the lead-language reference template up front so the AI sees a
    # single-language reference (never raw {"en","nl"} JSON) and the static
    # fallback has a value to substitute.
    base = {
        "id": lead.get("Campaigns_id"),
        "agent_name": agent_name,
        "service_name": lead.get("service_name") or "our service",
        "name": lead.get("account_name") or "Lead Awaker",
        "channel": "whatsapp",
        "language": lead.get("language") or "en",
        "ai_model": lead.get("ai_model"),
        "bump_1_ai_prompt": lead.get("bump_1_ai_prompt"),
        "bump_2_ai_prompt": lead.get("bump_2_ai_prompt"),
        "bump_3_ai_prompt": lead.get("bump_3_ai_prompt"),
        "bump_4_ai_prompt": lead.get("bump_4_ai_prompt"),
    }
    campaign_account, lang, subs = _overlaid_account_and_subs(lead, base)
    reference = resolve_lang(lead.get(f"bump_{stage}_template"), lang)
    if reference:
        campaign_account[f"bump_{stage}_template"] = reference

    body: str | None = None
    used_ai = False

    # Demo bumps are AI-first: attempt a contextual generation regardless of
    # inbound count, unless the campaign explicitly disabled AI bumps.
    ai_disabled = str(lead.get("use_ai_bumps")).strip().lower() in ("false", "0", "no", "off")
    if not ai_disabled:
        previous_texts = await _get_previous_bump_texts(lead["id"], stage)
        try:
            body = await generate_ai_bump(
                lead, campaign_account, stage,
                previous_bump_texts=previous_texts,
            )
            if body:
                used_ai = True
                log.info("demo_bump.ai_bump", lead_id=lead["id"], stage=stage)
        except Exception as exc:
            log.warning("demo_bump.ai_bump_failed", lead_id=lead["id"], stage=stage, error=str(exc))

    # Fall back to the static bilingual template, resolved + niche-substituted.
    if not body:
        body = resolve_demo_template(lead.get(f"bump_{stage}_template"), lang, subs)
        if not body:
            log.warning("demo_bump.no_template", lead_id=lead["id"], stage=stage)
            return

    try:
        result = await send_text_message(phone, body)
        msg_id = (result or {}).get("message_id") or f"demo_bump_{stage}"
        await _record_bump(lead["id"], account_id, body, msg_id, stage, agent_name, used_ai)
        log.info("demo_bump.sent", lead_id=lead["id"], stage=stage, ai=used_ai)
    except Exception as exc:
        log.warning("demo_bump.send_failed", lead_id=lead["id"], stage=stage, error=str(exc))
```

- [ ] **Step 4: Overlay the niche onto the booking nudge's campaign_account**

In `_send_booking_nudge` (lines 225-304), the `campaign_account` dict is hand-built at lines 252-262. Immediately after that dict literal (after line 262, before the `times: list[str] = []` line), insert the overlay so the nudge also speaks as the demo business:

```python
    campaign_account = _overlay_demo_niche_onto_campaign(campaign_account, lead)
    if campaign_account.get("company_name"):
        campaign_account["name"] = campaign_account["company_name"]
```

(The nudge's AI generator `generate_booking_nudge_bump` already reads `name`/`service_name`; the plain-text fallback at lines 290-295 stays as-is — it is a link mechanic, not niche copy.)

- [ ] **Step 5: Run the existing helper's unit test to confirm nothing broke**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_demo_bump_templates.py -v`
Expected: PASS (8 passed) — confirms the resolver import path used by the scheduler is intact.

- [ ] **Step 6: Import-check the scheduler module (no DB/network at import time)**

Run:

```bash
cd /home/gabriel/automations && python -c "import src.automations.demo_bump_scheduler as m; print('OK', bool(m._send_bump), bool(m._overlaid_account_and_subs))"
```

Expected: `OK True True` (no ImportError, no circular-import traceback)

- [ ] **Step 7: Preflight, then restart the engine on PASS**

Run:

```bash
cd /home/gabriel/automations && ./preflight.sh
```

Expected: PASS. **Only if PASS**, then:

```bash
pm2 restart leadawaker-engine --update-env
```

- [ ] **Step 8: Confirm clean startup and next demo tick**

Run (wait for the next 5-min `demo_bump_scheduler` tick, then):

```bash
pm2 logs leadawaker-engine --lines 60 --nostream | grep -E "demo_bump|Traceback|error" | tail -30
```

Expected: a `run_complete` line for `demo_bump_scheduler`, no `Traceback`, no `demo_bump.no_template` storm.

- [ ] **Step 9: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/demo_bump_scheduler.py
git commit -m "feat(demo-bump): AI-first demo bumps with niche overlay and language-aware static fallback"
```

---

### Task 4: Bilingual static template data for campaigns 60 + 61

Writes the `{"en","nl"}` JSON template values into the DB. Runs AFTER the engine restart (Task 3) so the resolver is live and JSON is never sent raw. Data-only; no schema change.

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/migrate-demo-bump-bilingual.js` (one-off data script, kept for the record like the repo's other `migrate-*.js` files)

**Interfaces:**
- Consumes: `pg` Client via `node --env-file=.env` (the project's TTY-free DB access pattern; `npm run db:push` requires a TTY and is unavailable).
- Campaign 60 templates carry the `{project_term}` placeholder; campaign 61 uses the literal word "project" (fixed business, no niche session).

- [ ] **Step 1: Write the data migration script**

Create `/home/gabriel/LeadAwakerApp/migrate-demo-bump-bilingual.js`:

```js
// One-off: set bilingual {"en","nl"} bump templates on demo campaigns 60 (Universal)
// and 61 (Discovery). Run AFTER the engine restart so resolve_demo_template is live.
//   node --env-file=.env migrate-demo-bump-bilingual.js
import pkg from "pg";
const { Client } = pkg;

const SCHEMA = "p2mxx34fvbf3ll6";

// Campaign 60 (Universal) — {project_term} substituted per demo session.
const C60 = {
  bump_1_template: { en: "Hi {first_name}! Just checking in, I figured you got busy before.", nl: "Hoi {first_name}! Even een berichtje, ik denk dat je het druk had." },
  bump_2_template: { en: "What's holding you back from moving forward with your {project_term}?", nl: "Wat houdt je nog tegen om verder te gaan met je {project_term}?" },
  bump_3_template: { en: "Is it a trust thing?", nl: "Is het een kwestie van vertrouwen?" },
  bump_4_template: { en: "I won't bother you anymore {first_name}. If you ever need to discuss it in the future, I will be here for you :)", nl: "Ik zal je niet langer lastigvallen {first_name}. Mocht je er in de toekomst nog eens over willen praten, dan weet je me te vinden :)" },
};

// Campaign 61 (Discovery) — fixed business, literal "project", no placeholder.
const C61 = {
  bump_1_template: { en: "Hi {first_name}! Just checking in, I figured you got busy before.", nl: "Hoi {first_name}! Even een berichtje, ik denk dat je het druk had." },
  bump_2_template: { en: "What's holding you back from going forward with your project?", nl: "Wat houdt je nog tegen om verder te gaan met je project?" },
  bump_3_template: { en: "Is it a trust thing?", nl: "Is het een kwestie van vertrouwen?" },
  bump_4_template: { en: "I won't bother you anymore {first_name}. If you ever need to discuss it in the future, I will be here for you :)", nl: "Ik zal je niet langer lastigvallen {first_name}. Mocht je er in de toekomst nog eens over willen praten, dan weet je me te vinden :)" },
};

async function apply(client, id, fields) {
  for (const [col, val] of Object.entries(fields)) {
    await client.query(
      `UPDATE ${SCHEMA}."Campaigns" SET "${col}" = $1 WHERE id = $2`,
      [JSON.stringify(val), id],
    );
  }
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await apply(client, 60, C60);
  await apply(client, 61, C61);
  const { rows } = await client.query(
    `SELECT id, bump_1_template, bump_2_template FROM ${SCHEMA}."Campaigns" WHERE id IN (60, 61) ORDER BY id`,
  );
  console.log(JSON.stringify(rows, null, 2));
  console.log("OK: campaigns 60/61 bilingual bump templates set");
} finally {
  await client.end();
}
```

- [ ] **Step 2: Run the migration and verify the written JSON**

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env migrate-demo-bump-bilingual.js`
Expected: the printed rows show `bump_1_template` / `bump_2_template` as JSON strings containing both `en` and `nl` keys for ids 60 and 61, followed by `OK: campaigns 60/61 bilingual bump templates set`.

- [ ] **Step 3: Confirm the engine resolves them (spot check with the live resolver)**

Run:

```bash
cd /home/gabriel/automations && python -c "
from src.automations.demo_bump_templates import resolve_demo_template
raw = '{\"en\": \"What is holding you back from moving forward with your {project_term}?\", \"nl\": \"Wat houdt je nog tegen om verder te gaan met je {project_term}?\"}'
print(resolve_demo_template(raw, 'nl', {'project_term': 'keuken'}))
"
```

Expected: `Wat houdt je nog tegen om verder te gaan met je keuken?`

- [ ] **Step 4: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add migrate-demo-bump-bilingual.js
git commit -m "chore(demo): bilingual bump templates for campaigns 60/61 (data migration)"
```

---

### Task 5: CRM bump-template edit field resolves per UI language

Makes the bump-template textarea in campaign settings show/edit the operator's UI-language slot and write it back with the shared bilingual helper, mirroring the Business tab. Plain-string templates on real campaigns round-trip unchanged.

**Files:**
- Modify: `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/settings/AISectionFields.tsx`

**Interfaces:**
- Consumes: existing local helpers in this file — `displayText(raw)` (line 36, resolves `raw` to `uiLang`) and `onTextChange(field, raw, text)` (lines 38-48, writes the `uiLang` slot as `{"en","nl"}` JSON, preserving the other slot). These already exist and are used by `ai_role`, `description`, `niche_question`.
- Only the `bump_${n}_template` textarea changes; the `bump_${n}_ai_prompt`, delay, and voice-note fields stay plain.

- [ ] **Step 1: Switch the bump template textarea to the language-aware helpers**

In `renderBump` (lines 68-115), replace the `<EditText>` + `<CopyButton>` block for the template (lines 93-100):

```jsx
            <EditText
              value={String(draft[templateField] ?? campaign[templateField] ?? "")}
              onChange={(v) => setDraft(d => ({ ...d, [templateField]: v }))}
              multiline
              minRows={2}
              placeholder={t("config.bumpTemplate", { n }) || `Bump ${n} template…`}
            />
            <CopyButton value={String(draft[templateField] || campaign[templateField] || "")} />
```

with:

```jsx
            <EditText
              value={displayText(draft[templateField] ?? campaign[templateField])}
              onChange={(v) => onTextChange(templateField, draft[templateField] ?? campaign[templateField], v)}
              multiline
              minRows={2}
              placeholder={t("config.bumpTemplate", { n }) || `Bump ${n} template…`}
            />
            <CopyButton value={displayText(draft[templateField] ?? campaign[templateField])} />
```

- [ ] **Step 2: Verify in the running app**

The Vite dev server serves live on save (do NOT run `tsc`). In the browser at `app.leadawaker.com`, open campaign 60's settings → AI section, and confirm:
- With UI language EN, bump 2 shows the English template; editing it and waiting ~1.5s (auto-save) persists.
- Switch UI language to NL (`/settings` language toggle): bump 2 now shows the Dutch slot; editing NL does not wipe the EN slot.
- Open a real single-language campaign's settings: its bump templates still show the plain string unchanged.

Expected: both language slots display/edit independently; plain-string campaigns unaffected.

- [ ] **Step 3: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add client/src/features/campaigns/components/settings/AISectionFields.tsx
git commit -m "feat(campaigns): edit bump templates per UI language (bilingual demo bumps)"
```

---

### Task 6: CRM read-only BumpCard resolves per UI language

Makes the campaign detail panel's read-only bump display resolve the bilingual template to the operator's UI language, exactly like the First Message block directly above it.

**Files:**
- Modify: `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/detailPanelWidgets/BumpCard.tsx`
- Modify: `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/CampaignDetailPanel.tsx:316-335`

**Interfaces:**
- Consumes: `resolveLang` from `@shared/langField` and the `uiLang` value already computed in `CampaignDetailPanel` (`const uiLang = asCampaignLang(i18n.language)`, line 118; First Message uses `resolveLang(..., uiLang === "pt" ? "en" : uiLang)` at line 308).
- Produces: `BumpCard` gains a required `uiLang: "en" | "nl"` prop.

- [ ] **Step 1: Resolve the template inside BumpCard**

In `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/detailPanelWidgets/BumpCard.tsx`, add the import and the prop, and resolve before rendering. Replace lines 1-14:

```jsx
import { useTranslation } from "react-i18next";
import { Clock, ChevronRight } from "lucide-react";
import { formatHours } from "../formFields/campaignFormatters";
import { resolveLang } from "@shared/langField";

/** Renders a single bump template block */
export function BumpCard({
  bumpNumber,
  template,
  delayHours,
  uiLang,
}: {
  bumpNumber: number;
  template: string | null | undefined;
  delayHours: number | null | undefined;
  uiLang: "en" | "nl";
}) {
```

Then replace the render of the template text (lines 33-39):

```jsx
      {template ? (
        <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {template}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">{t("config.noTemplateSet")}</p>
      )}
```

with:

```jsx
      {resolveLang(template, uiLang) ? (
        <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {resolveLang(template, uiLang)}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">{t("config.noTemplateSet")}</p>
      )}
```

- [ ] **Step 2: Pass `uiLang` from the detail panel**

In `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/CampaignDetailPanel.tsx`, update the four `<BumpCard>` usages (lines 316-335) to pass `uiLang`. `uiLang` may be `"pt"`; collapse it to `"en"` for the bilingual field just like First Message. For each of the four cards add the prop:

```jsx
              <BumpCard
                bumpNumber={1}
                template={campaign.bump_1_template}
                delayHours={campaign.bump_1_delay_hours}
                uiLang={uiLang === "pt" ? "en" : uiLang}
              />
```

Repeat for bumpNumber 2, 3, 4 (each with its matching `campaign.bump_N_template` / `campaign.bump_N_delay_hours`), adding the same `uiLang={uiLang === "pt" ? "en" : uiLang}` line.

- [ ] **Step 3: Verify in the running app**

In the browser, open campaign 60 in the detail panel (not settings). With UI language EN the bump cards show English; toggle to NL and they show Dutch. A real single-language campaign's bump cards still show their plain string. (Do NOT run `tsc`.)

Expected: read-only bump cards track the UI language; plain-string campaigns unaffected.

- [ ] **Step 4: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add client/src/features/campaigns/components/detailPanelWidgets/BumpCard.tsx client/src/features/campaigns/components/CampaignDetailPanel.tsx
git commit -m "feat(campaigns): read-only bump cards resolve to UI language"
```

---

## Final Verification

- [ ] **Live end-to-end (Gabriel's own phone):** start a fresh Universal Demo session in Dutch with a distinctive niche (e.g. a kitchen studio), exchange a couple of messages, then go quiet. At the 24h mark confirm the bump arrives in natural Dutch and references the configured business/niche (not "Lead Awaker", not English). No test messages to strangers.
- [ ] **Organic checkpoint:** lead 420 validates the AI-first path at its 24h mark (~2026-07-20 13:13 UTC). Confirm its bump is AI-generated and language-correct.
- [ ] **Regression:** confirm a real (non-demo) campaign still sends its single-language static bump unchanged, and its CRM fields still show plain strings.

## Self-Review Notes

- **Spec section 1 (AI-first + overlay + resolver):** Tasks 1 + 3. The `company_name` → `name` mapping gap (overlay sets `company_name`, `generate_ai_bump` reads `name`) is handled in `_overlaid_account_and_subs` and the nudge overlay.
- **Spec section 2 (native-language instruction):** Task 2, shared constant across all three generators.
- **Spec section 3 (bilingual template data):** Task 4, exact en/nl copy table, campaign 60 keeps `{project_term}`, campaign 61 uses literal "project".
- **Spec section 4 (CRM visibility):** Tasks 5 (edit) + 6 (read-only). `buildDraft()` whitelist already includes `bump_N_template` (no new fields), auto-save at 1.5s — no Save button touched.
- **Edge cases (spec):** AI failure → resolved static template (Task 3 Step 3); missing/unknown lead language → `norm_lang`/`resolve_lang` en fallback; `pt` → en; legacy plain string → `resolve_lang` passthrough (Task 1 test `test_plain_string_passthrough`); unresolved placeholder → neutral default in `subs` (Task 3 Step 2).
