# DBR Scoping Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make database-reactivation conversations build a project brief through a per-niche question ladder instead of diagnosing a decision that does not exist, and make AI disclosure a real toggle.

**Architecture:** One prompt (Prompt_Library row 93), branched by a `conversation_mode` variable computed in Python. The ladder content lives per niche in `Niche_Vocabulary` as text packs, loaded by the existing pack machinery. No new prompt, no new pipeline: every change is a new variable, a new conditional block, or a new column.

**Tech Stack:** Python 3 + asyncpg + pytest (engine, `/home/gabriel/automations`), Express + Drizzle + PostgreSQL + React (CRM, `/home/gabriel/LeadAwakerApp`), OpenAI API.

**Scope:** This plan covers the conversation layer only (spec §3.1 to §3.6, §3.8, §3.9). The browser demo page (spec §3.7, §3.10) is a **separate plan** written after this one lands, because its recap window depends on the ladder existing first.

## Global Constraints

- **The conditional resolver does NOT nest.** `resolve_conditional_blocks` in `tools/ai_service.py:104` uses a non-greedy regex, so an inner `{{/if}}` closes the outer block. The codebase already documents this pattern at `tools/ai_service.py` (the `voice_live` comment): compute a composite value in Python and branch on it as **sibling blocks**. Never nest `{{#if}}`.
- **Conditionals support only `==` and `!=` against a literal string.** No set membership, no truthiness. Anything set-shaped is computed in Python first.
- **Prompt 93 lives in the database**, table `p2mxx34fvbf3ll6."Prompt_Library"`, `id = 93`. It is not a file. Every edit snapshots the previous text into `p2mxx34fvbf3ll6."Prompt_Versions"` first.
- **`npm run db:push` fails** (needs a TTY). Run schema changes as direct SQL through `node --env-file=.env` with the `pg` client.
- **Never run `npx tsc --noEmit`** unless Gabriel explicitly asks.
- **The app runs under pm2**, never `npm run dev`. Process `leadawaker` (Express) auto-restarts on changes under `server/` and `shared/`. Process `leadawaker-engine` (Python) must be restarted manually: `pm2 restart leadawaker-engine`.
- **New campaign settings fields must be added to `buildDraft()`** in `client/src/features/campaigns/components/useCampaignDetail.ts`, or they silently never save.
- **Zod insert schemas strip unknown keys.** A field missing from `shared/schema.ts` is discarded on write with no error.
- **No em dashes** in prompt copy or any user-facing string. Use commas, colons or parentheses.
- **i18n:** every user-facing string goes through i18n. Locales are `en` and `nl` only (`pt` is retired for new work).
- **Testing:** `/home/gabriel/automations` has pytest (`cd /home/gabriel/automations && python -m pytest`). **`/home/gabriel/LeadAwakerApp` has no test runner.** CRM-side verification is DB queries plus `pm2 logs leadawaker`.
- **Schema is `p2mxx34fvbf3ll6`** on database `nocodb`. Table names are quoted and capitalised: `"Campaigns"`, `"Leads"`, `"Niche_Vocabulary"`, `"Prompt_Library"`.

---

## File Structure

**Engine (`/home/gabriel/automations`)**

| File | Responsibility | Change |
|------|----------------|--------|
| `tools/ai_service.py` | Builds the prompt variable map, derives `lead_stage` | Add `conversation_mode` + `lead_context`; fix precedence; rename a colliding local |
| `tools/db/niche_vocabulary.py` | Loads per-niche terms and packs | Add two pack columns |
| `src/automations/_helpers.py` | Bump-path variable resolution | Align comment only; already lead-first |
| `src/automations/conversation/prompt_builder.py` | Parses AI response into messages | Cap message count |
| `src/automations/conversation/outbound.py` | Typing delay and inter-message gap | Replace campaign-61 hardcode |
| `tests/prompt_tester.py` | Manual multi-turn prompt harness | Add LLM-driven lead mode |
| `tests/test_conversation_mode.py` | **New.** Unit tests for mode derivation | Create |
| `scripts/prompt93/` | **New.** Versioned prompt-edit scripts | Create |

**CRM (`/home/gabriel/LeadAwakerApp`)**

| File | Responsibility | Change |
|------|----------------|--------|
| `shared/schema.ts` | Drizzle table definitions | Add 5 columns |
| `client/src/features/campaigns/components/useCampaignDetail.ts` | Campaign draft whitelist | Add 2 fields |
| `client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx` | Behaviour settings UI | Add 2 rows |
| `client/src/locales/{en,nl}/campaigns.json` | Campaign i18n strings | Add 4 keys |
| `scripts/migrations/` | **New.** SQL migration scripts | Create |

---

## Task 1: LLM-driven lead simulator

The ladder cannot be tested with the existing harness. `tests/prompt_tester.py` drives conversations from **scripted** lead replies (`SCENARIOS[n]["responses"]`, a fixed `list[str]`). A ladder asks different questions in a different order per run, so scripted answers desynchronise immediately. Every later task depends on being able to run a ladder conversation, so this comes first.

**Files:**
- Modify: `/home/gabriel/automations/tests/prompt_tester.py`
- Test: `/home/gabriel/automations/tests/test_llm_lead.py` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `build_lead_reply(client, persona: str, transcript: list[dict], model: str = "gpt-5.1") -> str` and a `--llm-lead "<persona text>"` CLI flag on `prompt_tester.py`

- [ ] **Step 1: Write the failing test**

Create `/home/gabriel/automations/tests/test_llm_lead.py`:

```python
from unittest.mock import MagicMock

from tests.prompt_tester import build_lead_reply


def test_build_lead_reply_sends_persona_and_transcript():
    client = MagicMock()
    client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="3 actually"))]
    )

    transcript = [
        {"role": "assistant", "content": "how many windows are you replacing?"},
    ]
    reply = build_lead_reply(client, "You have 3 windows.", transcript)

    assert reply == "3 actually"
    sent = client.chat.completions.create.call_args.kwargs["messages"]
    # The persona is the system message; the agent's question is the last user turn.
    assert "You have 3 windows." in sent[0]["content"]
    assert "how many windows are you replacing?" in sent[-1]["content"]


def test_build_lead_reply_flips_roles():
    """The agent is the AI under test, so from the simulated lead's point of
    view the agent's messages arrive as `user`, not `assistant`."""
    client = MagicMock()
    client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="yes"))]
    )

    transcript = [
        {"role": "assistant", "content": "still interested?"},
        {"role": "user", "content": "yes that was me"},
        {"role": "assistant", "content": "how many?"},
    ]
    build_lead_reply(client, "persona", transcript)

    sent = client.chat.completions.create.call_args.kwargs["messages"]
    roles = [m["role"] for m in sent[1:]]
    assert roles == ["user", "assistant", "user"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_llm_lead.py -v`
Expected: FAIL with `ImportError: cannot import name 'build_lead_reply'`

- [ ] **Step 3: Implement `build_lead_reply`**

Add to `/home/gabriel/automations/tests/prompt_tester.py`, above `run_conversation`:

```python
LEAD_SIMULATOR_SYSTEM = """You are role-playing a real person replying to a business on WhatsApp.

{persona}

Rules:
- Reply the way a busy person texts: short, lowercase is fine, occasional typo.
- Answer only what you were actually asked. Never volunteer the whole story at once.
- Never mention that you are an AI, a simulation or a test.
- If you are asked something your persona does not cover, invent a plausible answer and stay consistent with it for the rest of the conversation.
- Reply with the message text only. No quotes, no labels, no commentary."""


def build_lead_reply(client, persona: str, transcript: list[dict], model: str = "gpt-5.1") -> str:
    """Generate the simulated lead's next reply.

    `transcript` is the conversation from the AGENT's point of view
    ("assistant" = the agent under test). The simulated lead sees the mirror
    image, so roles are flipped before sending.
    """
    messages = [{"role": "system", "content": LEAD_SIMULATOR_SYSTEM.format(persona=persona)}]
    for turn in transcript:
        flipped = "user" if turn["role"] == "assistant" else "assistant"
        messages.append({"role": flipped, "content": turn["content"]})

    resp = client.chat.completions.create(model=model, messages=messages)
    return (resp.choices[0].message.content or "").strip()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_llm_lead.py -v`
Expected: PASS, 2 passed

- [ ] **Step 5: Wire the CLI flag**

In `/home/gabriel/automations/tests/prompt_tester.py`, add the argument next to the existing `--model` argument (around line 632):

```python
    parser.add_argument(
        "--llm-lead",
        type=str,
        default=None,
        help="Persona text for an LLM-driven lead. Replaces scripted scenario replies; "
             "required for testing ladder conversations, whose question order varies per run.",
    )
    parser.add_argument(
        "--turns",
        type=int,
        default=14,
        help="Max agent turns when --llm-lead is used (scripted mode uses the scenario length).",
    )
```

- [ ] **Step 6: Use the flag in `run_conversation`**

Change the signature and loop of `run_conversation` in `/home/gabriel/automations/tests/prompt_tester.py` so a persona overrides the scripted list:

```python
def run_conversation(
    client: OpenAI,
    system_prompt: str,
    first_message: str,
    lead_responses: list[str],
    model: str = "gpt-5.1",
    persona: str | None = None,
    max_turns: int = 14,
) -> list[dict]:
    """Run a multi-turn conversation.

    With `persona` set, the lead's replies are generated by build_lead_reply and
    `lead_responses` is ignored. This is the mode ladder testing requires: the
    agent's question order varies per run, so scripted replies desynchronise.
    """
    transcript: list[dict] = [{"role": "assistant", "content": first_message}]
    turns = max_turns if persona else len(lead_responses)

    for i in range(turns):
        if persona:
            lead_msg = build_lead_reply(client, persona, transcript, model=model)
        else:
            lead_msg = lead_responses[i]
        transcript.append({"role": "user", "content": lead_msg})

        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system_prompt}] + transcript,
        )
        agent_msg = (resp.choices[0].message.content or "").strip()
        transcript.append({"role": "assistant", "content": agent_msg})

        if "[END]" in agent_msg or "[BOOKED]" in agent_msg:
            break

    return transcript
```

Then pass the new arguments at the existing call site (around line 671):

```python
                transcript = run_conversation(
                    client,
                    system_prompt,
                    first_message,
                    scenario["responses"],
                    model=args.model,
                    persona=args.llm_lead,
                    max_turns=args.turns,
                )
```

- [ ] **Step 7: Verify end to end against the current prompt**

Run:
```bash
cd /home/gabriel/automations && python tests/prompt_tester.py \
  --pl-id 93 --scenarios 0 --turns 12 \
  --llm-lead "You enquired about replacing windows about a year ago. You have 2 French doors and 1 casement window, uPVC, double glazing, straight swap, want it done in about 2 weeks, budget around 2000 pounds." \
  --output /tmp/ladder_baseline.json
```

Expected: a completed JSON transcript. This is the **baseline**: the current prompt should offer a call within about 3 turns without collecting any spec. Keep this file, Task 7 compares against it.

- [ ] **Step 8: Commit**

```bash
cd /home/gabriel/automations
git add tests/prompt_tester.py tests/test_llm_lead.py
git commit -m "test: add LLM-driven lead simulator for ladder conversations"
```

---

## Task 2: Database columns and Drizzle schema

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/scripts/migrations/2026-08-dbr-scoping-mode.js`
- Modify: `/home/gabriel/LeadAwakerApp/shared/schema.ts`

**Interfaces:**
- Consumes: nothing
- Produces: columns `Niche_Vocabulary.scoping_ladder` (jsonb), `Niche_Vocabulary.opener_phrase` (jsonb), `Leads.lead_context` (text), `Campaigns.conversation_mode_override` (text), `Campaigns.max_messages_per_reply` (integer, default 1)

- [ ] **Step 1: Write the migration script**

Create `/home/gabriel/LeadAwakerApp/scripts/migrations/2026-08-dbr-scoping-mode.js`:

```js
// Run with: node --env-file=.env scripts/migrations/2026-08-dbr-scoping-mode.js
// npm run db:push cannot be used here: it requires a TTY.
const { Client } = require("pg");

const SCHEMA = "p2mxx34fvbf3ll6";

const STATEMENTS = [
  `ALTER TABLE "${SCHEMA}"."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS scoping_ladder jsonb`,
  `ALTER TABLE "${SCHEMA}"."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS opener_phrase jsonb`,
  `ALTER TABLE "${SCHEMA}"."Leads" ADD COLUMN IF NOT EXISTS lead_context text`,
  `ALTER TABLE "${SCHEMA}"."Campaigns" ADD COLUMN IF NOT EXISTS conversation_mode_override text`,
  `ALTER TABLE "${SCHEMA}"."Campaigns" ADD COLUMN IF NOT EXISTS max_messages_per_reply integer DEFAULT 1`,
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  for (const sql of STATEMENTS) {
    await c.query(sql);
    console.log("OK:", sql.slice(0, 80));
  }
  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run the migration**

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env scripts/migrations/2026-08-dbr-scoping-mode.js`
Expected: five `OK:` lines, exit 0.

- [ ] **Step 3: Verify the columns exist**

Run:
```bash
cd /home/gabriel/LeadAwakerApp && timeout 60 node --env-file=.env -e "
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const r=await c.query(\"select table_name, column_name from information_schema.columns where column_name in ('scoping_ladder','opener_phrase','lead_context','conversation_mode_override','max_messages_per_reply') order by table_name, column_name\");
console.table(r.rows);await c.end();process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
"
```
Expected: 5 rows.

- [ ] **Step 4: Add the columns to Drizzle**

In `/home/gabriel/LeadAwakerApp/shared/schema.ts`, add to the `campaigns` table next to `aiDisclosure` (line 574):

```ts
  // "scoping" | "decision" | null. Forces the conversation flow regardless of
  // the lead's derived stage. Needed by demo campaigns, which must ladder even
  // when their stage would resolve to decision mode.
  conversationModeOverride: text("conversation_mode_override"),
  // Hard cap on balloons per AI reply. Default 1: every extra balloon is a
  // separately billed message, and a ladder runs 8-10 turns.
  maxMessagesPerReply: integer("max_messages_per_reply").default(1),
```

Add to the `leads` table next to `whatHasTheLeadDone` (line 738):

```ts
  // Free-text specifics for this lead, imported with the list. In decision mode
  // this is the quote detail the AI can reference by name; in scoping mode it
  // pre-fills ladder slots so the AI skips them. Distinct from
  // whatHasTheLeadDone, which is a constrained dropdown feeding the stage
  // classifier and must never carry free text.
  leadContext: text("lead_context"),
```

- [ ] **Step 5: Confirm the server restarted cleanly**

Run: `pm2 logs leadawaker --lines 30 --nostream`
Expected: a restart line and no TypeScript or Drizzle errors.

- [ ] **Step 6: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add scripts/migrations/2026-08-dbr-scoping-mode.js shared/schema.ts
git commit -m "feat: add DBR scoping mode columns"
```

---

## Task 3: Conversation mode derivation and lead_context precedence

**Files:**
- Modify: `/home/gabriel/automations/tools/ai_service.py:143-150` (add `derive_conversation_mode`), `:546` (rename local), `:564` (precedence), `:596-660` (variable map)
- Test: `/home/gabriel/automations/tests/test_conversation_mode.py` (create)

**Interfaces:**
- Consumes: `derive_lead_stage(what_lead_did: str | None) -> str` (exists)
- Produces: `derive_conversation_mode(lead_stage: str, override: str | None) -> str` returning `"scoping"` or `"decision"`; prompt variables `conversation_mode` and `lead_context`

**Naming hazard:** `tools/ai_service.py:546` already binds a local named `lead_context` holding `what_has_the_lead_done`. It is renamed here to `_lead_stage_text`, freeing the name for the new field. Do not skip this rename: leaving it produces a silent shadow.

- [ ] **Step 1: Write the failing test**

Create `/home/gabriel/automations/tests/test_conversation_mode.py`:

```python
import pytest

from tools.ai_service import derive_conversation_mode, derive_lead_stage


@pytest.mark.parametrize("stage", ["inquired", ""])
def test_scoping_when_no_quote_exists(stage):
    """No quote on file means the unknown is the project, so build the brief."""
    assert derive_conversation_mode(stage, None) == "scoping"


@pytest.mark.parametrize("stage", ["quoted", "deciding", "visited", "declined", "owner"])
def test_decision_when_history_exists(stage):
    """A quote, visit or prior decision means the unknown is the decision."""
    assert derive_conversation_mode(stage, None) == "decision"


def test_override_wins_over_stage():
    assert derive_conversation_mode("quoted", "scoping") == "scoping"
    assert derive_conversation_mode("inquired", "decision") == "decision"


def test_invalid_override_is_ignored():
    assert derive_conversation_mode("inquired", "banana") == "scoping"


def test_stage_derivation_still_maps_dropdown_values():
    """Guards the classifier the mode depends on."""
    assert derive_lead_stage("Inquired about a quote") == "inquired"
    assert derive_lead_stage("Received a quote") == "quoted"
    assert derive_lead_stage("Had solar panels installed by us") == "owner"


def test_free_text_does_not_classify():
    """Why lead_context exists as a separate field: free text in the stage
    field silently disables every lead_stage conditional in the prompt."""
    assert derive_lead_stage("asked for a 3400 euro quote for 2 doors") == ""
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_conversation_mode.py -v`
Expected: FAIL with `ImportError: cannot import name 'derive_conversation_mode'`

- [ ] **Step 3: Implement `derive_conversation_mode`**

Add to `/home/gabriel/automations/tools/ai_service.py` immediately after `derive_lead_stage` (after line 150):

```python
# Stages where no proposal exists yet, so the unknown is the project rather than
# the decision. "" (unclassified) is included: a campaign with no stage set is
# almost always a raw reactivation list.
_SCOPING_STAGES = frozenset({"inquired", ""})
_VALID_MODES = frozenset({"scoping", "decision"})


def derive_conversation_mode(lead_stage: str, override: str | None) -> str:
    """Pick the conversation flow: build the brief, or diagnose the decision.

    The prompt's conditional resolver cannot express set membership, so this
    collapses lead_stage into a single token the prompt branches on as sibling
    {{#if conversation_mode == "..."}} blocks.
    """
    candidate = (override or "").strip().lower()
    if candidate in _VALID_MODES:
        return candidate
    return "scoping" if (lead_stage or "") in _SCOPING_STAGES else "decision"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_conversation_mode.py -v`
Expected: PASS, 10 passed

- [ ] **Step 5: Rename the colliding local and fix precedence**

In `/home/gabriel/automations/tools/ai_service.py`, change line 546 from:

```python
    lead_context = lead.get("what_has_the_lead_done") or ""
```

to:

```python
    # The lead's own stage value (a dropdown), NOT free text. Renamed from
    # lead_context, which now belongs to the free-text specifics field below.
    _lead_stage_text = lead.get("what_has_the_lead_done") or ""
    # Free-text specifics for this lead: quote detail in decision mode,
    # ladder pre-fill in scoping mode.
    lead_context = lead.get("lead_context") or ""
```

Then change line 564 from:

```python
    what_lead_did = resolve_lang(campaign.get("what_lead_did"), _campaign_lang) or lead_context
```

to:

```python
    # Lead-first, campaign-second. This matches src/automations/_helpers.py:71
    # (the bump path); the two paths previously disagreed, so a per-lead stage
    # was silently discarded in conversations. Verified 2026-08-08: zero of 657
    # rows have what_has_the_lead_done set, so no existing lead changes.
    what_lead_did = _lead_stage_text or resolve_lang(campaign.get("what_lead_did"), _campaign_lang) or ""
```

- [ ] **Step 6: Add the new prompt variables**

In the variable map in `/home/gabriel/automations/tools/ai_service.py`, replace the `"lead_stage"` entry with:

```python
        # Stable lead-stage token for {{#if lead_stage == "..."}} flow branching.
        "lead_stage": derive_lead_stage(what_lead_did),
        # Composite flow token. The resolver does not nest and cannot express
        # set membership, so the collapse happens here and the prompt branches
        # on this as sibling blocks.
        "conversation_mode": derive_conversation_mode(
            derive_lead_stage(what_lead_did),
            campaign.get("conversation_mode_override"),
        ),
        # Free-text specifics for this lead (quote detail / ladder pre-fill).
        "lead_context": lead_context,
```

- [ ] **Step 7: Run the full engine suite for regressions**

Run: `cd /home/gabriel/automations && python -m pytest`
Expected: all pass. If `tests/test_webhook_parsing.py` or `tests/test_slot_signal.py` fail, the rename was applied incompletely: grep for remaining uses of the old local with `grep -n "lead_context" tools/ai_service.py` and confirm each one is intentional.

- [ ] **Step 8: Restart the engine and confirm it boots**

Run: `pm2 restart leadawaker-engine && sleep 5 && pm2 logs leadawaker-engine --lines 30 --nostream`
Expected: startup lines, no traceback.

- [ ] **Step 9: Commit**

```bash
cd /home/gabriel/automations
git add tools/ai_service.py tests/test_conversation_mode.py
git commit -m "feat: derive conversation_mode, add lead_context, fix stage precedence"
```

---

## Task 4: Load the new niche packs

**Files:**
- Modify: `/home/gabriel/automations/tools/db/niche_vocabulary.py:32-35`
- Test: `/home/gabriel/automations/tests/test_niche_packs.py` (create)

**Interfaces:**
- Consumes: the `_PACK_COLS` mechanism (exists, with per-field `__default__` fallback) and `get_niche_terms`
- Produces: prompt variable `{niche_scoping_ladder}`, and `opener_phrase` as a **term**, not a pack

**The two new fields take different routes, and this matters.** `scoping_ladder` is only ever needed inside the conversation prompt, so it joins `_PACK_COLS`. `opener_phrase` is needed in the **first message**, which is rendered by `_render_first_message` in `src/automations/campaign_launcher.py:269` on a completely different substitution path: that function merges `get_niche_terms(...)` into the campaign dict, and never touches the packs. Putting `opener_phrase` in `_PACK_COLS` would make `{opener_phrase}` render as an empty string in every opener. It goes in `get_niche_terms`.

Both are stored as `{nl, en}` **strings**, so the existing per-field `__default__` fallback works unchanged. Do not store them as structured arrays: the value is injected as text either way.

- [ ] **Step 1: Write the failing test**

Create `/home/gabriel/automations/tests/test_niche_packs.py`:

```python
from tools.db.niche_vocabulary import _PACK_COLS


def test_scoping_ladder_is_a_loaded_pack():
    assert _PACK_COLS["niche_scoping_ladder"] == "scoping_ladder"


def test_opener_phrase_is_NOT_a_pack():
    """It must travel with the terms, not the packs: the first-message renderer
    merges get_niche_terms() and never loads packs, so a pack would render as
    an empty string in every opener."""
    assert "niche_opener_phrase" not in _PACK_COLS
    assert "opener_phrase" not in _PACK_COLS.values()


def test_existing_packs_are_untouched():
    for var, col in [
        ("niche_question_bank", "question_bank"),
        ("niche_bad_examples", "bad_examples"),
        ("niche_objection_examples", "objection_examples"),
        ("niche_scenario_examples", "scenario_examples"),
    ]:
        assert _PACK_COLS[var] == col
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_niche_packs.py -v`
Expected: FAIL with `KeyError: 'niche_scoping_ladder'`

- [ ] **Step 3: Register the ladder pack**

In `/home/gabriel/automations/tools/db/niche_vocabulary.py`, extend `_PACK_COLS` (line 32):

```python
_PACK_COLS = {
    "niche_question_bank": "question_bank",
    "niche_bad_examples": "bad_examples",
    "niche_objection_examples": "objection_examples",
    "niche_scenario_examples": "scenario_examples",
    # Scoping mode (DBR): the ordered slot ladder. Same {nl, en} string shape
    # and per-field __default__ fallback as the packs above.
    "niche_scoping_ladder": "scoping_ladder",
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_niche_packs.py -v`
Expected: PASS, 3 passed

- [ ] **Step 5: Return `opener_phrase` from `get_niche_terms`**

In `/home/gabriel/automations/tools/db/niche_vocabulary.py`, inside `get_niche_terms`, add `opener_phrase` to the selected columns and to the returned dict. It is a `{nl, en}` jsonb **object**, not a list, so it does not go through `_as_list`:

```python
def _pick_lang(value, want_en: bool) -> str:
    """Resolve a {nl, en} jsonb object to one language, falling back to the other."""
    if value is None:
        return ""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return value
    if not isinstance(value, dict):
        return ""
    primary, secondary = ("en", "nl") if want_en else ("nl", "en")
    return str(value.get(primary) or value.get(secondary) or "")
```

Add `opener_phrase` to the `cols` string built at the top of `get_niche_terms`, and add this to the returned dict:

```python
        "opener_phrase": _pick_lang(row.get("opener_phrase") if row else None, want_en),
```

Apply the same `__default__` fallback the terms already use: if the niche row has no `opener_phrase`, read it from the `__default__` row.

- [ ] **Step 6: Expose the ladder as a prompt variable**

In `/home/gabriel/automations/tools/ai_service.py`, add to the variable map after `"niche_scenario_examples"`:

```python
        "niche_scoping_ladder": campaign.get("niche_scoping_ladder") or "",
        # Merged in by _render_first_message and by the niche-term resolution
        # upstream of the conversation prompt.
        "opener_phrase": campaign.get("opener_phrase") or "",
```

- [ ] **Step 7: Verify the opener path can see it**

Run:
```bash
cd /home/gabriel/automations && python -c "
import asyncio
from tools.db.niche_vocabulary import get_niche_terms
print(asyncio.run(get_niche_terms('Windows & Doors', 'en')).get('opener_phrase'))
"
```
Expected: an empty string for now (Task 6 loads the content), and **no KeyError**. A `KeyError` means Step 5 was not applied.

- [ ] **Step 6: Run the full engine suite**

Run: `cd /home/gabriel/automations && python -m pytest`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /home/gabriel/automations
git add tools/db/niche_vocabulary.py tools/ai_service.py tests/test_niche_packs.py
git commit -m "feat: load scoping_ladder and opener_phrase niche packs"
```

---

## Task 5: Prompt 93 scoping mode branch

**Files:**
- Create: `/home/gabriel/automations/scripts/prompt93/apply_edit.js` (reusable versioned editor)
- Modify: `Prompt_Library` row 93 (database)

**Interfaces:**
- Consumes: `conversation_mode`, `niche_scoping_ladder` (Tasks 3, 4)
- Produces: Prompt 93 with sibling `{{#if conversation_mode == "scoping"}}` / `{{#if conversation_mode == "decision"}}` blocks in Step 3, a scoping-mode Step 5 signal block, and a scoping-mode carve-out block after §4.9

- [ ] **Step 1: Write the versioned prompt editor**

Create `/home/gabriel/automations/scripts/prompt93/apply_edit.js`:

```js
// Usage: node --env-file=/home/gabriel/LeadAwakerApp/.env apply_edit.js <patch.js> "<label>"
// Snapshots the current prompt text into Prompt_Versions before writing.
// The patch module exports: (text: string) => string
const { Client } = require("pg");
const path = require("path");

const SCHEMA = "p2mxx34fvbf3ll6";
const PROMPT_ID = 93;

(async () => {
  const [, , patchPath, label] = process.argv;
  if (!patchPath || !label) {
    console.error("usage: apply_edit.js <patch.js> \"<label>\"");
    process.exit(1);
  }
  const patch = require(path.resolve(patchPath));

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const { rows } = await c.query(
    `SELECT prompt_text, version FROM "${SCHEMA}"."Prompt_Library" WHERE id = $1`, [PROMPT_ID]
  );
  if (!rows.length) throw new Error(`Prompt ${PROMPT_ID} not found`);
  const before = rows[0].prompt_text;

  const after = patch(before);
  if (after === before) throw new Error("Patch produced no change: refusing to write");

  const { rows: vrows } = await c.query(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS n FROM "${SCHEMA}"."Prompt_Versions" WHERE prompts_id = $1`,
    [PROMPT_ID]
  );
  await c.query(
    `INSERT INTO "${SCHEMA}"."Prompt_Versions" (prompts_id, version_number, prompt_text, label, saved_at, created_at)
     VALUES ($1, $2, $3, $4, now(), now())`,
    [PROMPT_ID, vrows[0].n, before, label]
  );
  await c.query(
    `UPDATE "${SCHEMA}"."Prompt_Library" SET prompt_text = $1, updated_at = now() WHERE id = $2`,
    [after, PROMPT_ID]
  );

  console.log(`Snapshotted v${vrows[0].n} ("${label}"). ${before.length} -> ${after.length} chars.`);
  await c.end();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
```

- [ ] **Step 2: Write the scoping-mode patch**

Create `/home/gabriel/automations/scripts/prompt93/01-scoping-mode.js`:

```js
// Adds sibling conversation_mode blocks. The resolver does NOT nest, so these
// are siblings at the top level of their sections, never inside another {{#if}}.
const CARVE_OUT = `
{{#if conversation_mode == "scoping"}}
## 4.10 Scoping-mode overrides
This lead has no {proposal_term} on file, so there is nothing to diagnose: your job is to build the brief.
For this conversation only, the following change:
Rule 4.3 (Decision Completion) does NOT apply. There is no decision in progress to complete.
Rule 4.4 (Status Acceptance) does NOT apply to the project details. A short answer is a filled slot, not a finished conversation.
Rule 4.8 (Anti-interrogation) is replaced: you may ask up to ten consecutive questions here, one per reply, as long as each one is a slot from the ladder and each one builds on the last answer.
All other rules in section 4 still apply, especially 4.5 (neutral language), 4.7 (handling corrections) and 4.9 (question quality).
{{/if}}
`;

const STEP3_SCOPING = `
{{#if conversation_mode == "scoping"}}
Your goal is to build a brief the {advisor_term} could quote from. Work through the ladder below, one question per reply, in order.

Ladder rules:
Ask one slot per reply. Never two questions in one message.
Build each question on the answer you just received. Reuse their own words.
Skip any slot the prospect already answered unprompted, and any slot already covered by {lead_context}. Never ask for something you were already told.
When you ask about budget, quote the brief back in the question ("for the two French doors and the casement window"), never "for the project".
If an answer is ambiguous, ask one immediate clarifying question before moving on. Currency, units, and countable ambiguity ("3 windows" could be three openings or three panes) are the common cases.
Never assert that a job is doable or affordable. The {advisor_term} evaluates that. "I'm confident the team can help with that" is the right register.

The ladder:
{niche_scoping_ladder}

Universal slots, asked in this order regardless of niche:
FIRST, before the ladder: are they still interested at all. If no, close gracefully with [END].
SECOND TO LAST: timing. When were they hoping to have the work done.
LAST: budget. Quote the brief back.

Stop laddering and move to Step 5 when every slot is filled or explicitly skipped by the prospect.

Exit rules, since 4.8 does not protect you here:
The prospect pushes back twice: stop laddering, move to the close or offer space.
A clear "not interested": respect it immediately, [END].
The prospect asks their own question: answer it first, then resume at the slot you stopped on.
Ten agent turns without completing the brief: close on what you have.
{{/if}}
{{#if conversation_mode == "decision"}}
`;

const STEP5_SCOPING = `
{{#if conversation_mode == "scoping"}}
In scoping mode the buying signal is different: it is a completed brief for a project that is real and near-term. The comparison signals below (preferring our concept, the price difference being the only issue) assume a {proposal_term} exists and do not apply here.
When the brief is complete, offer the call directly and wait for a clear yes, then run the same staged booking flow described below.
{{/if}}
`;

module.exports = (text) => {
  let out = text;

  // 1. Carve-out block, immediately before "# 5. CONVERSATION FLOW".
  const flowHeader = "\n# 5. CONVERSATION FLOW";
  if (!out.includes(flowHeader)) throw new Error("anchor not found: # 5. CONVERSATION FLOW");
  out = out.replace(flowHeader, `\n${CARVE_OUT}${flowHeader}`);

  // 2. Step 3 fork. The existing Step 3 body becomes the decision branch, so we
  //    open the scoping block before it and close the decision block after it.
  const step3 = "## STEP 3 — Understand their current position\n";
  if (!out.includes(step3)) throw new Error("anchor not found: STEP 3 header");
  out = out.replace(step3, step3 + STEP3_SCOPING);

  const step4 = "\n## STEP 4 — Objection handling";
  if (!out.includes(step4)) throw new Error("anchor not found: STEP 4 header");
  out = out.replace(step4, "\n{{/if}}\n" + step4.slice(1));

  // 3. Scoping buying-signal block, at the top of Step 5.
  const step5 = "## STEP 5 — Buying signal and close\n";
  if (!out.includes(step5)) throw new Error("anchor not found: STEP 5 header");
  out = out.replace(step5, step5 + STEP5_SCOPING);

  return out;
};
```

- [ ] **Step 3: Apply the patch**

Run:
```bash
cd /home/gabriel/automations/scripts/prompt93 && \
node --env-file=/home/gabriel/LeadAwakerApp/.env apply_edit.js ./01-scoping-mode.js "pre-scoping-mode"
```
Expected: `Snapshotted v1 ("pre-scoping-mode"). 31802 -> ~34500 chars.`

- [ ] **Step 4: Verify the conditionals are balanced and unnested**

Run:
```bash
cd /home/gabriel/LeadAwakerApp && timeout 60 node --env-file=.env -e "
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const t=(await c.query('select prompt_text from p2mxx34fvbf3ll6.\"Prompt_Library\" where id=93')).rows[0].prompt_text;
const opens=(t.match(/\{\{#if /g)||[]).length, closes=(t.match(/\{\{\/if\}\}/g)||[]).length;
console.log('opens',opens,'closes',closes);
// Nesting check: walk the tokens, depth must never exceed 1.
let depth=0,maxDepth=0;
for(const m of t.matchAll(/\{\{#if |\{\{\/if\}\}/g)){ depth += m[0].startsWith('{{#if')?1:-1; maxDepth=Math.max(maxDepth,depth); }
console.log('maxDepth',maxDepth,'finalDepth',depth);
await c.end();process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
"
```
Expected: `opens` equals `closes`, `maxDepth 1`, `finalDepth 0`. **A `maxDepth` above 1 means a nested block was introduced and the resolver will mis-parse it.** Roll back via `Prompt_Versions` and fix the patch before continuing.

- [ ] **Step 5: Commit the scripts**

```bash
cd /home/gabriel/automations
git add scripts/prompt93/
git commit -m "feat: prompt 93 scoping mode branch + versioned prompt editor"
```

---

## Task 6: Author the Windows & Doors and Kitchens ladders

These two are load-bearing twice over: they are production ladders **and** the few-shot examples the remaining fourteen are generated from (Task 13). A shallow ladder here degrades all sixteen.

**Files:**
- Create: `/home/gabriel/automations/scripts/prompt93/ladders/windows-doors.json`
- Create: `/home/gabriel/automations/scripts/prompt93/ladders/kitchens.json`
- Create: `/home/gabriel/automations/scripts/prompt93/load_ladder.js`

**Interfaces:**
- Consumes: `Niche_Vocabulary.scoping_ladder` (Task 2), the pack loader (Task 4)
- Produces: populated ladders for niches `Windows & Doors` and `Kitchens`

- [ ] **Step 1: Write the Windows & Doors ladder**

Create `/home/gabriel/automations/scripts/prompt93/ladders/windows-doors.json`:

```json
{
  "niche": "Windows & Doors",
  "opener_phrase": {
    "en": "new windows or doors",
    "nl": "nieuwe kozijnen"
  },
  "scoping_ladder": {
    "en": "SLOT 1 - quantity\nPurpose: sizes the job. A single unit and a whole-house replacement are different conversations.\nAsk: \"how many windows or doors are you looking to replace?\"\nOptions: open number.\n\nSLOT 2 - composition\nPurpose: splits the count into windows versus doors, and gives a rough size.\nAsk: \"what type are the three, and roughly what size are they?\"\nOptions: open.\n\nSLOT 3 - door sub-type (only if the answer to slot 2 included doors)\nPurpose: a quote line in its own right. French and patio doors price very differently from a front door.\nAsk: \"are the doors front, back, French or patio doors?\"\nOptions: front, back, French, patio, bi-fold.\n\nSLOT 4 - window sub-type (only if the answer to slot 2 included windows)\nPurpose: quote line detail.\nAsk: \"what type is the window, for example casement, sash or tilt-and-turn?\"\nOptions: casement, sash, tilt-and-turn, bay, fixed.\n\nSLOT 5 - frame material\nPurpose: the largest single price driver.\nAsk: \"are you thinking uPVC, aluminium or timber frames?\"\nOptions: uPVC, aluminium, timber, composite.\n\nSLOT 6 - glazing spec\nPurpose: second price driver, and it signals how much they care about efficiency.\nAsk: \"are you after standard double glazing or triple?\"\nOptions: double, triple, not sure.\n\nSLOT 7 - scope of work\nPurpose: separates a straight swap from structural work, which changes the labour cost entirely.\nAsk: \"is it a straight replacement, or are any openings being altered?\"\nOptions: straight replacement, openings altered, new opening.",
    "nl": "SLOT 1 - aantal\nDoel: bepaalt de omvang. Een enkel kozijn en een heel huis zijn verschillende gesprekken.\nVraag: \"om hoeveel kozijnen of deuren gaat het ongeveer?\"\nOpties: open getal.\n\nSLOT 2 - samenstelling\nDoel: splitst het aantal op in ramen en deuren, plus een globale maat.\nVraag: \"wat voor soort zijn die drie, en hoe groot ongeveer?\"\nOpties: open.\n\nSLOT 3 - type deur (alleen als slot 2 deuren bevatte)\nDoel: eigen offerteregel. Openslaande en schuifpuien liggen heel anders dan een voordeur.\nVraag: \"gaat het om een voordeur, achterdeur, openslaande deuren of een schuifpui?\"\nOpties: voordeur, achterdeur, openslaande deuren, schuifpui, vouwwand.\n\nSLOT 4 - type raam (alleen als slot 2 ramen bevatte)\nDoel: offerteregel detail.\nVraag: \"wat voor raam is het, bijvoorbeeld draaikiep, vast of schuifraam?\"\nOpties: draaikiep, vast, schuifraam, erker.\n\nSLOT 5 - materiaal\nDoel: de grootste prijsbepaler.\nVraag: \"denken jullie aan kunststof, aluminium of hout?\"\nOpties: kunststof, aluminium, hout, composiet.\n\nSLOT 6 - beglazing\nDoel: tweede prijsbepaler, en het zegt iets over hoe zwaar isolatie weegt.\nVraag: \"gaat het om standaard dubbel glas of triple?\"\nOpties: dubbel, triple, weet ik nog niet.\n\nSLOT 7 - aard van het werk\nDoel: scheidt een een-op-een vervanging van constructief werk, wat de arbeidskosten volledig verandert.\nVraag: \"is het een-op-een vervangen, of worden er openingen aangepast?\"\nOpties: een-op-een, opening aangepast, nieuwe opening."
  }
}
```

- [ ] **Step 2: Write the Kitchens ladder**

Create `/home/gabriel/automations/scripts/prompt93/ladders/kitchens.json`:

```json
{
  "niche": "Kitchens",
  "opener_phrase": {
    "en": "a new kitchen",
    "nl": "een nieuwe keuken"
  },
  "scoping_ladder": {
    "en": "SLOT 1 - room size\nPurpose: sizes the job before anything else. Everything downstream scales off it.\nAsk: \"roughly how big is the kitchen, in metres or in steps across?\"\nOptions: open.\n\nSLOT 2 - layout\nPurpose: drives unit count and whether the plumbing moves.\nAsk: \"what shape is it at the moment, galley, L-shaped, U-shaped or open plan?\"\nOptions: galley, L-shaped, U-shaped, island, open plan.\n\nSLOT 3 - scope\nPurpose: separates a door-and-worktop refresh from a full rip-out, which is a different price bracket.\nAsk: \"is this a full replacement, or more a refresh of doors and worktops?\"\nOptions: full replacement, refresh, extension.\n\nSLOT 4 - worktop material\nPurpose: the largest visible price driver, and a strong quality signal.\nAsk: \"any thoughts on worktops yet, laminate, quartz, granite or solid wood?\"\nOptions: laminate, quartz, granite, solid wood, not sure.\n\nSLOT 5 - appliances\nPurpose: decides whether appliances are in the quote at all, which swings the total materially.\nAsk: \"are you keeping your current appliances or including new ones?\"\nOptions: keeping, including new, partly.\n\nSLOT 6 - trades needed\nPurpose: flags whether electrics or plumbing move, which is where kitchen quotes overrun.\nAsk: \"is anything moving, like the sink or the hob, or is it staying where it is?\"\nOptions: staying, sink moving, hob moving, full reconfiguration.",
    "nl": "SLOT 1 - afmeting\nDoel: bepaalt eerst de omvang. Alles daarna schaalt hierop mee.\nVraag: \"hoe groot is de keuken ongeveer, in meters of in stappen?\"\nOpties: open.\n\nSLOT 2 - indeling\nDoel: bepaalt het aantal kasten en of het leidingwerk verplaatst.\nVraag: \"wat voor vorm heeft hij nu, rechte wand, hoekkeuken, U-vorm of open?\"\nOpties: rechte wand, hoekkeuken, U-vorm, kookeiland, open.\n\nSLOT 3 - omvang van het werk\nDoel: scheidt fronten en blad vervangen van een complete nieuwe keuken.\nVraag: \"gaat het om een complete nieuwe keuken, of meer om fronten en werkblad?\"\nOpties: compleet nieuw, opfrissen, uitbouw.\n\nSLOT 4 - werkblad\nDoel: de grootste zichtbare prijsbepaler en een sterk kwaliteitssignaal.\nVraag: \"al ideeen over het werkblad, laminaat, composiet, graniet of massief hout?\"\nOpties: laminaat, composiet, graniet, massief hout, weet ik nog niet.\n\nSLOT 5 - apparatuur\nDoel: bepaalt of apparatuur uberhaupt in de offerte zit, wat het totaal flink verschuift.\nVraag: \"nemen jullie de huidige apparatuur mee of komt er nieuwe bij?\"\nOpties: meenemen, nieuw, deels.\n\nSLOT 6 - installatiewerk\nDoel: signaleert of elektra of leidingwerk verplaatst, waar keukenoffertes doorgaans uitlopen.\nVraag: \"verandert er iets aan de plek van de spoelbak of de kookplaat, of blijft alles zitten?\"\nOpties: blijft zitten, spoelbak verplaatst, kookplaat verplaatst, volledige herindeling."
  }
}
```

- [ ] **Step 3: Write the loader**

Create `/home/gabriel/automations/scripts/prompt93/load_ladder.js`:

```js
// Usage: node --env-file=/home/gabriel/LeadAwakerApp/.env load_ladder.js ladders/windows-doors.json
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const SCHEMA = "p2mxx34fvbf3ll6";

(async () => {
  const file = process.argv[2];
  if (!file) { console.error("usage: load_ladder.js <ladder.json>"); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const { rowCount } = await c.query(
    `UPDATE "${SCHEMA}"."Niche_Vocabulary"
        SET scoping_ladder = $1::jsonb, opener_phrase = $2::jsonb, updated_at = now()
      WHERE niche = $3`,
    [JSON.stringify(data.scoping_ladder), JSON.stringify(data.opener_phrase), data.niche]
  );
  if (rowCount !== 1) throw new Error(`Expected 1 row for niche "${data.niche}", updated ${rowCount}`);
  console.log(`Loaded ladder for ${data.niche}`);
  await c.end();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
```

- [ ] **Step 4: Load both ladders**

Run:
```bash
cd /home/gabriel/automations/scripts/prompt93
node --env-file=/home/gabriel/LeadAwakerApp/.env load_ladder.js ladders/windows-doors.json
node --env-file=/home/gabriel/LeadAwakerApp/.env load_ladder.js ladders/kitchens.json
```
Expected: `Loaded ladder for Windows & Doors`, `Loaded ladder for Kitchens`.

- [ ] **Step 5: Run the ladder conversation and compare to baseline**

Run:
```bash
cd /home/gabriel/automations && python tests/prompt_tester.py \
  --pl-id 93 --scenarios 0 --turns 14 \
  --llm-lead "You enquired about replacing windows about a year ago. You have 2 French doors and 1 casement window, uPVC, double glazing, straight swap, want it done in about 2 weeks, budget around 2000 pounds. You do not volunteer information: answer only what you are asked." \
  --output /tmp/ladder_after.json
```

Read `/tmp/ladder_after.json` and check all five:
1. The agent asks **at least six** distinct spec questions before offering a call
2. It never asks two questions in one message
3. It never re-asks something already answered
4. The budget question **quotes the brief back** ("for the two French doors and the casement window")
5. It offers the call only after the brief is complete

Compare with `/tmp/ladder_baseline.json` from Task 1: the baseline should offer a call within about three turns with no spec collected.

If any check fails, the fix is the **ladder text or the Step 3 block**, not the model. Re-run after each edit.

- [ ] **Step 6: Commit**

```bash
cd /home/gabriel/automations
git add scripts/prompt93/ladders/ scripts/prompt93/load_ladder.js
git commit -m "feat: author Windows & Doors and Kitchens scoping ladders"
```

---

## Task 7: AI disclosure branch and opener template

**Files:**
- Create: `/home/gabriel/automations/scripts/prompt93/02-disclosure.js`
- Modify: `/home/gabriel/automations/tools/ai_service.py` (add `disclosure_clause`), `tools/guardrails_service.py` call site
- Modify: `Prompt_Library` row 93

**Interfaces:**
- Consumes: `ai_disclosure` (exists in the variable map), `niche_opener_phrase` (Task 4)
- Produces: prompt variable `disclosure_clause`; Prompt 93 Step 1/Step 2/§6.3 disclosure branches

- [ ] **Step 1: Add the `disclosure_clause` variable**

In `/home/gabriel/automations/tools/ai_service.py`, immediately after the `"ai_disclosure"` entry in the variable map:

```python
        # Rendered into the opener template. "on" moves the disclosure into the
        # opener (before the interaction, as EU Art 50 requires); Step 2's
        # first-reply clause is suppressed in that mode so it is not said twice.
        "disclosure_clause": (
            f"the AI assistant at {company_name}"
            if (campaign.get("ai_disclosure") or "off") == "on"
            else f"from {company_name}"
        ),
```

- [ ] **Step 2: Free the guardrail**

Find the `validate_output(` call site in the conversation path:

Run: `cd /home/gabriel/automations && grep -rn "validate_output(" --include=*.py src/ tools/`

At the call inside the conversation pipeline, pass the flag explicitly:

```python
    guard = validate_output(
        response,
        max_length=max_length,
        # Prompt 93 owns disclosure policy in three places (opener, Step 2, 6.3).
        # The regex backstop exists for prompts that have none; leaving it armed
        # would block 6.3's honest answer on a disclosure-off campaign.
        allow_ai_disclosure=True,
    )
```

- [ ] **Step 3: Write the disclosure patch**

Create `/home/gabriel/automations/scripts/prompt93/02-disclosure.js`:

```js
// Disclosure branches. Siblings only: the resolver does not nest.
const STEP2_DISCLOSURE = `
{{#if ai_disclosure == "on"}}
The opener already disclosed that you are an AI assistant. Do NOT disclose again in this reply: saying it twice in two consecutive messages reads as broken. Skip the disclosure clause entirely and go straight into substance.
Your second message must not claim anything a human would claim and an AI would not. Never say a manager asked you to reach out, and never say you dislike making phone calls. Instead do the same three jobs in your own terms: give the reason for contact, take the fear of a cold call off the table, and ask the interest question. Example (English): "Thanks for confirming. The team asked me to go back through our older enquiries, and I'd rather drop you a message than have someone ring you out of the blue. Are you still interested in {niche_opener_phrase}?"
{{/if}}
{{#if ai_disclosure == "off"}}
`;

const SIX_THREE = `
{{#if ai_disclosure == "off"}}
## 6.3b AI question, disclosure-off campaigns
Nothing was disclosed in the opener, so never say "as I mentioned".
First time they ask or accuse: do not debate what you are and do not deny it. State who you are with and move the conversation to what they want. Example: "I'm {agent_name} with {company_name}. Are you looking at {niche_opener_phrase}, or is now not a good time?"
Second time they ask, or if they push at all: confirm plainly, then continue. Never deny being an AI. Example: "Fair enough, yes: I'm the digital assistant here. I'm mainly checking whether you still need anything, or whether we should leave you be."
Do not pitch, qualify or push for a call in the same message as either answer.
{{/if}}
`;

module.exports = (text) => {
  let out = text;

  // Wrap the existing Step 2 disclosure paragraph as the disclosure-off branch.
  const anchor = "The disclosure clause below belongs ONLY in your very first reply";
  if (!out.includes(anchor)) throw new Error("anchor not found: Step 2 disclosure paragraph");
  out = out.replace(anchor, STEP2_DISCLOSURE + anchor);

  // Close the disclosure-off branch just before the Primary path paragraph.
  const primary = "\nPrimary path — respond directly:";
  if (!out.includes(primary)) throw new Error("anchor not found: Primary path");
  out = out.replace(primary, "\n{{/if}}\n" + primary.slice(1));

  // Add the disclosure-off variant of 6.3 next to the booking-confirmed section.
  const booked = "## 6.8 Booking confirmed";
  if (!out.includes(booked)) throw new Error("anchor not found: 6.8");
  out = out.replace(booked, SIX_THREE + booked);

  return out;
};
```

- [ ] **Step 4: Apply and verify nesting**

Run:
```bash
cd /home/gabriel/automations/scripts/prompt93 && \
node --env-file=/home/gabriel/LeadAwakerApp/.env apply_edit.js ./02-disclosure.js "pre-disclosure-branch"
```

Then re-run the balance and nesting check from Task 5 Step 4.
Expected: `opens` equals `closes`, `maxDepth 1`, `finalDepth 0`.

- [ ] **Step 3b: Make `disclosure_clause` available on the opener path**

The opener is **not** rendered by `tools/ai_service.py`. It is rendered by `_render_first_message` in `/home/gabriel/automations/src/automations/campaign_launcher.py:269`, which merges only `get_niche_terms(...)` into the campaign dict. A `{disclosure_clause}` token in `First_Message` would render as literal text there unless it is added to that path too.

In `_render_first_message`, immediately after the existing `campaign = {**campaign, **niche_terms}` line (around line 287):

```python
    # Disclosure lives in the opener when the campaign discloses, so the token
    # has to resolve on THIS path, not just in the conversation prompt.
    _company = campaign.get("company_name") or campaign.get("demo_client_name") or campaign.get("name") or "the business"
    campaign["disclosure_clause"] = (
        f"the AI assistant at {_company}"
        if (campaign.get("ai_disclosure") or "off") == "on"
        else f"from {_company}"
    )
```

- [ ] **Step 3c: Verify both tokens resolve in a rendered opener**

Run:
```bash
cd /home/gabriel/LeadAwakerApp && timeout 60 node --env-file=.env -e "
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
await c.query(\`update p2mxx34fvbf3ll6.\"Campaigns\" set \"First_Message\" = '{\"en\":\"Hi it is {agent_name} {disclosure_clause}, is that the same {first_name} who was looking at {opener_phrase} a while back?\"}' where id = 66\`);
console.log('campaign 66 opener template set');await c.end();process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
"
```

Then trigger a first message for one demo lead on campaign 66 and read it back from `Interactions`. Expected: **no literal `{disclosure_clause}` or `{opener_phrase}` in the sent text.** If either token survives, the corresponding merge step was missed (Step 3b here, or Task 4 Step 5).

- [ ] **Step 5: Fix the generated opener**

In `/home/gabriel/LeadAwakerApp/server/demo-session.ts`, the opener currently concatenates the niche and `service_name`, producing "interested in Double glazing (windows and doors) supply and installation". Locate the `first_message` instruction inside the generator prompt in `generateNicheContext` (search the file for `first_message` in the prompt string) and replace that instruction with:

```
Write the opener as one sentence a real person would text. Use this exact shape:
"Hi it's {agent_name} {disclosure_clause}, is that the same {first_name} who was looking at <NATURAL PLURAL PHRASE> a while back?"
<NATURAL PLURAL PHRASE> is what the customer wants in their own words ("new windows or doors", "a new kitchen", "solar panels"). NEVER use the commercial arrangement ("supply and installation", "design and manufacturing"): nobody has ever described themselves as interested in supply and installation. Also return that phrase on its own as `opener_phrase`.
```

Add `opener_phrase: string;` to the `NicheContext` interface at the top of the file, alongside `niche_question_bank`.

- [ ] **Step 6: Test both disclosure modes**

Run the disclosure-on case:
```bash
cd /home/gabriel/LeadAwakerApp && timeout 60 node --env-file=.env -e "
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
await c.query('update p2mxx34fvbf3ll6.\"Campaigns\" set ai_disclosure=\$1 where id=66',['on']);
console.log('campaign 66 disclosure=on');await c.end();process.exit(0)})();
"
cd /home/gabriel/automations && python tests/prompt_tester.py --pl-id 93 --scenarios 0 --turns 6 \
  --llm-lead "You enquired about windows a year ago. Ask 'are you an AI?' on your second reply, and ask again on your third." \
  --output /tmp/disclosure_on.json
```

Check `/tmp/disclosure_on.json`: the first reply must NOT contain a second disclosure, and the AI question must be answered with an "as I mentioned" style confirmation.

Then repeat with `ai_disclosure='off'`, output to `/tmp/disclosure_off.json`, and check: first ask gets a deflection with no denial, second ask gets a plain confirmation.

- [ ] **Step 7: Commit**

```bash
cd /home/gabriel/automations
git add scripts/prompt93/02-disclosure.js tools/ai_service.py
git commit -m "feat: wire ai_disclosure into prompt 93, free the guardrail"
cd /home/gabriel/LeadAwakerApp
git add server/demo-session.ts
git commit -m "fix: opener uses natural project phrase, not niche + service_name"
```

---

## Task 8: Port the Prompt 67 rules

**Files:**
- Create: `/home/gabriel/automations/scripts/prompt93/03-prompt67-ports.js`
- Modify: `Prompt_Library` row 93

**Interfaces:**
- Consumes: `{lead_context}`, `{what_lead_did}`, `{opt_out_notice}` (all in the variable map)
- Produces: five new rules plus one widened rule in Prompt 93

- [ ] **Step 1: Write the patch**

Create `/home/gabriel/automations/scripts/prompt93/03-prompt67-ports.js`:

```js
const PROVENANCE = `
## 6.3c Where did you get my number
This question is common in reactivation and is a trust moment, not an objection. Answer it directly in one message: say what they did, when, and how to stop hearing from you. Never be vague and never ask a follow-up question in the same message. Example (English): "You made an enquiry through our website {inquiry_timeframe}. If you'd rather not hear from us, just reply with the word delete and that's the end of it."
Then wait. If they continue, pick the conversation back up where it was.
`;

const ROLE_LIMIT = `
## 4.11 What you are not
You handle the conversation and the scheduling. The {advisor_term} handles specifics: technical feasibility, exact pricing, materials advice, lead times.
When you are asked something outside that, say so plainly and offer the {advisor_term}, rather than guessing. Example: "That's one for the {advisor_term} honestly, they can give you the exact answer on the call."
Never invent a fact about the business, a price, a timeline or a product. Never confirm that a job is doable or affordable: the {advisor_term} evaluates that. "I'm confident the team can help with that" is as far as you go.
`;

const DESCRIPTION_RULE = `
Do not paste or summarise the business description in a message. Weave in one short, relevant detail only when it matches something the prospect has actually said.
`;

module.exports = (text) => {
  let out = text;

  // Provenance + opt-out, and the role limit, next to the existing playbook.
  const booked = "## 6.8 Booking confirmed";
  if (!out.includes(booked)) throw new Error("anchor not found: 6.8");
  out = out.replace(booked, PROVENANCE + booked);

  const flowHeader = "\n# 5. CONVERSATION FLOW";
  if (!out.includes(flowHeader)) throw new Error("anchor not found: # 5");
  out = out.replace(flowHeader, `\n${ROLE_LIMIT}${flowHeader}`);

  // Business-description discipline, in the text-mode rules block.
  const noEmoji = "\nNo emojis.\n";
  if (!out.includes(noEmoji)) throw new Error("anchor not found: No emojis.");
  out = out.replace(noEmoji, noEmoji + DESCRIPTION_RULE.trim() + "\n");

  // Widen the repetition rule from consecutive sentences to the whole conversation.
  const oldRep = "Never use the same acknowledging word in consecutive sentences";
  if (!out.includes(oldRep)) throw new Error("anchor not found: repetition rule");
  out = out.replace(
    oldRep,
    "Never reuse an acknowledging word anywhere in this conversation, not just in consecutive sentences"
  );

  // Relative-day booking confirmations.
  const dateToken = "[datum en tijd]";
  if (!out.includes(dateToken)) throw new Error("anchor not found: booking date token");
  out = out.replace(
    dateToken,
    "[dag en tijd, uitgedrukt als 'morgen', 'donderdag' of 'volgende week maandag', nooit als datumnotatie]"
  );

  return out;
};
```

- [ ] **Step 2: Apply and verify nesting**

Run:
```bash
cd /home/gabriel/automations/scripts/prompt93 && \
node --env-file=/home/gabriel/LeadAwakerApp/.env apply_edit.js ./03-prompt67-ports.js "pre-prompt67-ports"
```

Re-run the balance and nesting check from Task 5 Step 4.
Expected: `maxDepth 1`, `finalDepth 0`. (These blocks add no conditionals, so counts are unchanged from Task 7.)

- [ ] **Step 3: Test the provenance answer**

Run:
```bash
cd /home/gabriel/automations && python tests/prompt_tester.py --pl-id 93 --scenarios 0 --turns 6 \
  --llm-lead "You enquired about windows a year ago but do not remember doing it. On your first reply ask 'how did you get my number?' and be slightly annoyed." \
  --output /tmp/provenance.json
```

Check `/tmp/provenance.json`: the answer names what they did, and offers the opt-out word, in one message, with no follow-up question attached.

- [ ] **Step 4: Commit**

```bash
cd /home/gabriel/automations
git add scripts/prompt93/03-prompt67-ports.js
git commit -m "feat: port provenance, role limit, description and repetition rules into prompt 93"
```

---

## Task 9: Cap messages per reply

**Files:**
- Modify: `/home/gabriel/automations/src/automations/conversation/prompt_builder.py` (`_parse_ai_response`)
- Test: `/home/gabriel/automations/tests/test_message_cap.py` (create)

**Interfaces:**
- Consumes: `Campaigns.max_messages_per_reply` (Task 2)
- Produces: `_parse_ai_response(content: str, max_messages: int = 1, voice_mode: bool = False) -> list[str]`

**Voice mode must not be capped to one.** Prompt 93 line 51 requires that any URL, phone number or exact figure the lead needs to copy goes out as a **separate plain-text message**, because a voice memo cannot carry a copyable link. The AI produces that companion as a second entry in the same JSON, so a hard cap of 1 would silently delete it and the lead would hear "I'm texting it to you" and receive nothing. Voice turns therefore get a floor of 2.

- [ ] **Step 1: Write the failing test**

Create `/home/gabriel/automations/tests/test_message_cap.py`:

```python
import json

from src.automations.conversation.prompt_builder import _parse_ai_response


def test_defaults_to_one_message():
    content = json.dumps({"message 1": "first", "message 2": "second", "message 3": "third"})
    assert _parse_ai_response(content) == ["first"]


def test_respects_a_higher_cap():
    content = json.dumps({"message 1": "first", "message 2": "second", "message 3": "third"})
    assert _parse_ai_response(content, max_messages=2) == ["first", "second"]


def test_cap_never_exceeds_four():
    content = json.dumps({f"message {i}": f"m{i}" for i in range(1, 7)})
    assert len(_parse_ai_response(content, max_messages=99)) == 4


def test_cap_floor_is_one():
    content = json.dumps({"message 1": "first", "message 2": "second"})
    assert _parse_ai_response(content, max_messages=0) == ["first"]


def test_voice_mode_keeps_the_companion_message():
    """A voice memo cannot carry a copyable link, so the plain-text companion
    is a second JSON entry. Capping voice turns at 1 would delete it and the
    lead would hear "I'm texting it to you" and receive nothing."""
    content = json.dumps({"message 1": "the memo", "message 2": "https://cal.example/x"})
    assert _parse_ai_response(content, max_messages=1, voice_mode=True) == [
        "the memo",
        "https://cal.example/x",
    ]


def test_voice_mode_does_not_lower_a_higher_cap():
    content = json.dumps({f"message {i}": f"m{i}" for i in range(1, 5)})
    assert len(_parse_ai_response(content, max_messages=3, voice_mode=True)) == 3


def test_empty_content_still_ends_the_conversation():
    assert _parse_ai_response("") == []


def test_plain_text_falls_back_to_single_message():
    assert _parse_ai_response("just text") == ["just text"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_message_cap.py -v`
Expected: FAIL, `test_defaults_to_one_message` returns three messages.

- [ ] **Step 3: Add the cap**

In `/home/gabriel/automations/src/automations/conversation/prompt_builder.py`, change the signature and the truncation in `_parse_ai_response`:

```python
def _parse_ai_response(content: str, max_messages: int = 1, voice_mode: bool = False) -> list[str]:
    """Parse the AI response into a list of message strings.

    Default is ONE message: every extra balloon is a separately billed message,
    and a scoping conversation runs 8-10 turns instead of 3.

    Voice turns get a floor of 2. A voice memo cannot carry a copyable link, so
    prompt 93 requires URLs, numbers and exact figures to go out as a separate
    plain-text companion, which arrives as a second JSON entry. Capping voice at
    1 would delete it silently.
    """
    if not content or not content.strip():
        return []

    limit = max(1, min(int(max_messages or 1), 4))
    if voice_mode:
        limit = max(limit, 2)

    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            messages = [str(v) for v in parsed.values() if str(v).strip()]
            if messages:
                return messages[:limit]
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
```

Leave the rest of the function body unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_message_cap.py -v`
Expected: PASS, 8 passed

- [ ] **Step 5: Pass the campaign setting at the call site**

In `/home/gabriel/automations/src/automations/ai_conversation.py`, find the `_parse_ai_response(` call. The surrounding code already resolves whether this turn is a voice turn (the same value passed to `send_ai_messages` as `voice_reply_mode`); reuse that resolution rather than recomputing it:

```python
        messages_list = _parse_ai_response(
            content,
            max_messages=campaign_account.get("max_messages_per_reply") or 1,
            voice_mode=is_voice_turn,
        )
```

If the local holding that decision has a different name at this call site, use the existing one. Do not introduce a second source of truth for whether the turn is voice.

- [ ] **Step 6: Run the full engine suite**

Run: `cd /home/gabriel/automations && python -m pytest`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/conversation/prompt_builder.py src/automations/ai_conversation.py tests/test_message_cap.py
git commit -m "feat: cap AI replies at one message by default"
```

---

## Task 10: Instant replies for demo campaigns

**Files:**
- Modify: `/home/gabriel/automations/src/automations/conversation/outbound.py:159-170`
- Modify: `/home/gabriel/automations/src/automations/conversation/helpers.py:92-114`
- Test: `/home/gabriel/automations/tests/test_demo_timing.py` (create)

**Interfaces:**
- Consumes: `Campaigns.is_demo` (exists)
- Produces: `_calculate_typing_delay(messages, min_override, max_override, is_demo=False) -> float`

- [ ] **Step 1: Write the failing test**

Create `/home/gabriel/automations/tests/test_demo_timing.py`:

```python
from src.automations.conversation.helpers import _calculate_typing_delay


def test_demo_campaigns_reply_instantly():
    """A scoping demo runs 8-10 turns; a proportional delay on each one loses
    the prospect inside the flow that is supposed to impress them."""
    assert _calculate_typing_delay(["a" * 400], is_demo=True) == 0.0


def test_demo_flag_beats_explicit_overrides():
    assert _calculate_typing_delay(["a" * 400], min_override=5, max_override=9, is_demo=True) == 0.0


def test_real_campaigns_keep_a_delay():
    delay = _calculate_typing_delay(["a" * 400], min_override=2, max_override=8)
    assert delay >= 2


def test_real_campaigns_respect_the_max():
    delay = _calculate_typing_delay(["a" * 5000], min_override=2, max_override=8)
    assert delay <= 8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_demo_timing.py -v`
Expected: FAIL with `TypeError: unexpected keyword argument 'is_demo'`

- [ ] **Step 3: Add the demo path**

In `/home/gabriel/automations/src/automations/conversation/helpers.py`, change the signature and add an early return at the top of `_calculate_typing_delay`:

```python
def _calculate_typing_delay(
    messages: list[str],
    min_override: float | None = None,
    max_override: float | None = None,
    is_demo: bool = False,
) -> float:
    """Calculate a realistic typing delay proportional to message length.

    Demo campaigns return 0: a demo is a product showcase, not a simulation,
    and a scoping conversation is long enough that per-turn delays cost
    completions. This replaces the old hardcoded `campaign_id == 61` check.
    """
    if is_demo:
        return 0.0
```

Leave the existing body below unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_demo_timing.py -v`
Expected: PASS, 4 passed

- [ ] **Step 5: Replace the campaign-61 hardcode**

In `/home/gabriel/automations/src/automations/conversation/outbound.py`, pass the flag at the `_calculate_typing_delay` call (around line 57):

```python
    delay = _calculate_typing_delay(
        messages_list,
        min_override=campaign_account.get("ai_min_delay_seconds"),
        max_override=campaign_account.get("ai_max_delay_seconds"),
        is_demo=bool(campaign_account.get("is_demo")),
    )
```

Then replace the inter-message gap block (around line 164):

```python
        # Gap between messages. Demo campaigns send with no gap for the same
        # reason they have no typing delay. Real campaigns keep the realistic
        # 2-3s pause. (Was: a hardcoded `campaign_id == 61` special case.)
        if idx < len(grouped) - 1:
            _gap = 0 if campaign_account.get("is_demo") else random.uniform(2, 3)
            if _gap > 0:
                await asyncio.sleep(_gap)
```

- [ ] **Step 6: Run the full engine suite and restart**

Run: `cd /home/gabriel/automations && python -m pytest && pm2 restart leadawaker-engine`
Expected: all pass, engine restarts clean.

- [ ] **Step 7: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/conversation/helpers.py src/automations/conversation/outbound.py tests/test_demo_timing.py
git commit -m "feat: demo campaigns reply instantly, replacing the campaign-61 hardcode"
```

---

## Task 11: CRM surface for the new campaign fields

Without this task the two new campaign settings exist but cannot be changed outside SQL. Note the `buildDraft()` whitelist: a field missing there silently never saves.

**Files:**
- Modify: `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/useCampaignDetail.ts:320`
- Modify: `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx:104`
- Modify: `/home/gabriel/LeadAwakerApp/client/src/locales/en/campaigns.json`, `/home/gabriel/LeadAwakerApp/client/src/locales/nl/campaigns.json`

**Interfaces:**
- Consumes: `conversationModeOverride`, `maxMessagesPerReply` (Task 2)
- Produces: editable settings rows

- [ ] **Step 1: Add both fields to the draft whitelist**

In `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/useCampaignDetail.ts`, next to the `ai_disclosure` line (320):

```ts
    conversation_mode_override: (c as any).conversation_mode_override || "",
    max_messages_per_reply: (c as any).max_messages_per_reply ?? 1,
```

- [ ] **Step 2: Add the i18n keys**

In `/home/gabriel/LeadAwakerApp/client/src/locales/en/campaigns.json`, inside the `config` object:

```json
    "conversationMode": "Conversation mode",
    "conversationModeHint": "Scoping builds a project brief for leads with no quote on file. Decision diagnoses where a quoted lead stands. Auto picks from the lead's stage.",
    "maxMessagesPerReply": "Messages per reply",
    "maxMessagesPerReplyHint": "Each extra message is billed separately. Default 1."
```

In `/home/gabriel/LeadAwakerApp/client/src/locales/nl/campaigns.json`, inside the `config` object:

```json
    "conversationMode": "Gespreksmodus",
    "conversationModeHint": "Scoping bouwt een projectbriefing op voor leads zonder offerte. Decision peilt waar een lead met offerte staat. Auto kiest op basis van de fase van de lead.",
    "maxMessagesPerReply": "Berichten per antwoord",
    "maxMessagesPerReplyHint": "Elk extra bericht wordt apart gefactureerd. Standaard 1."
```

- [ ] **Step 3: Add the settings rows**

In `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx`, directly after the existing `aiDisclosure` `BoolRow` (line 104), following the same prop pattern used by the surrounding rows in that file:

```tsx
      <SelectRow
        icon={GitBranch}
        label={t("config.conversationMode")}
        hint={t("config.conversationModeHint")}
        value={(draft.conversation_mode_override ?? campaign.conversation_mode_override) || ""}
        options={[
          { value: "", label: t("config.modeAuto", { defaultValue: "Auto" }) },
          { value: "scoping", label: t("config.modeScoping", { defaultValue: "Scoping" }) },
          { value: "decision", label: t("config.modeDecision", { defaultValue: "Decision" }) },
        ]}
        onChange={(v: string) => onField("conversation_mode_override", v)}
      />
      <NumberRow
        icon={MessageSquare}
        label={t("config.maxMessagesPerReply")}
        hint={t("config.maxMessagesPerReplyHint")}
        min={1}
        max={4}
        value={(draft.max_messages_per_reply ?? campaign.max_messages_per_reply) ?? 1}
        onChange={(v: number) => onField("max_messages_per_reply", v)}
      />
```

Import `GitBranch` and `MessageSquare` from `lucide-react` alongside the existing `ShieldCheck` import. If `SelectRow` or `NumberRow` do not exist in this file's imports, use whichever equivalents the neighbouring rows use and match their prop names exactly. Read the file before editing.

- [ ] **Step 4: Verify a save actually persists**

Campaign settings auto-save on a 1.5 second debounce with no Save button, so a click writes immediately. Use a demo campaign, never a real one.

Open `app.leadawaker.com`, go to campaign 66 ("Discovery DBR"), set Conversation mode to Scoping, wait three seconds, then run:

```bash
cd /home/gabriel/LeadAwakerApp && timeout 60 node --env-file=.env -e "
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const r=await c.query('select id, name, conversation_mode_override, max_messages_per_reply from p2mxx34fvbf3ll6.\"Campaigns\" where id=66');
console.table(r.rows);await c.end();process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
"
```
Expected: `conversation_mode_override` is `scoping`. **If it is null, the field is missing from `buildDraft()`** (Step 1) or from `shared/schema.ts` (Task 2 Step 4), where Zod silently strips it.

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add client/src/features/campaigns/components/useCampaignDetail.ts \
        client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx \
        client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json
git commit -m "feat: campaign settings for conversation mode and message cap"
```

---

## Task 12: Generate the remaining fourteen ladders

Run only after Task 6's two ladders pass their conversation checks. They are the few-shot examples, so generating first would propagate their flaws.

**Files:**
- Create: `/home/gabriel/automations/scripts/prompt93/generate_ladders.js`
- Create: `/home/gabriel/automations/scripts/prompt93/ladders/<niche>.json` × 14

**Interfaces:**
- Consumes: `ladders/windows-doors.json`, `ladders/kitchens.json` (Task 6), `load_ladder.js` (Task 6)
- Produces: ladders for the fourteen remaining niches

The fourteen: Bathrooms, Countertops, Flooring, General Contracting, HVAC, Interior Design, Landscaping, Moving Services, Painting, Pest Control, Pool Installation, Roofing, Solar Panels, Wellness. Plus `__default__`, which gets the Kitchens ladder generalised.

- [ ] **Step 1: Write the generator**

Create `/home/gabriel/automations/scripts/prompt93/generate_ladders.js`:

```js
// Usage: node --env-file=/home/gabriel/LeadAwakerApp/.env generate_ladders.js "Bathrooms"
// Writes ladders/<slug>.json for human review. Does NOT write to the database:
// review the file, then load it with load_ladder.js.
const fs = require("fs");
const path = require("path");

const MODEL = "gpt-5.4-mini";

const SYSTEM = `You write question ladders for a sales AI that reactivates a home-improvement company's dead enquiry database over WhatsApp.

A ladder is an ordered list of slots. Each slot collects ONE fact the company needs in order to quote the job.

The hard part is trade knowledge. A weak ladder circles budget and timeline and never touches a price driver. A strong ladder asks the questions an experienced employee of that trade would ask, in the order they would ask them: cheapest to answer first, most sensitive last. Every slot must state, in its Purpose line, what that answer changes in the quote.

Do not include slots for: still interested, timing, or budget. Those are universal and handled elsewhere.

Match the depth, tone and formatting of the examples exactly. Output ONLY valid JSON matching the example shape, with "en" and "nl" keys. Dutch must be natural Dutch as a tradesperson would speak it, not a translation. Never use em dashes.`;

(async () => {
  const niche = process.argv[2];
  if (!niche) { console.error('usage: generate_ladders.js "<Niche>"'); process.exit(1); }

  const dir = path.join(__dirname, "ladders");
  const ex1 = fs.readFileSync(path.join(dir, "windows-doors.json"), "utf8");
  const ex2 = fs.readFileSync(path.join(dir, "kitchens.json"), "utf8");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPEN_AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Example 1:\n${ex1}\n\nExample 2:\n${ex2}\n\nNow write the ladder for: ${niche}` },
      ],
    }),
  });
  const json = await res.json();
  if (!json.choices) throw new Error(JSON.stringify(json).slice(0, 300));

  const raw = json.choices[0].message.content.trim().replace(/^```json\n?|```$/g, "");
  const parsed = JSON.parse(raw);
  parsed.niche = niche;

  const slug = niche.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const out = path.join(dir, `${slug}.json`);
  fs.writeFileSync(out, JSON.stringify(parsed, null, 2));
  console.log(`Wrote ${out} — REVIEW BEFORE LOADING`);
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
```

- [ ] **Step 2: Generate all fourteen**

Run:
```bash
cd /home/gabriel/automations/scripts/prompt93
for n in "Bathrooms" "Countertops" "Flooring" "General Contracting" "HVAC" \
         "Interior Design" "Landscaping" "Moving Services" "Painting" \
         "Pest Control" "Pool Installation" "Roofing" "Solar Panels" "Wellness"; do
  node --env-file=/home/gabriel/LeadAwakerApp/.env generate_ladders.js "$n" || echo "RETRY: $n"
done
```
Expected: fourteen `Wrote ...` lines.

- [ ] **Step 3: Review every generated ladder**

For each file, check all four. This is the step that determines quality, and the failure mode reads fine on the page: plausible questions that never touch a price driver only show up in conversation.

1. Does every Purpose line name something that **changes the quote**? Reject "to understand their needs".
2. Are the two biggest price drivers for that trade actually present? (Roofing: material and roof area or pitch. HVAC: property size and existing system. Flooring: area and subfloor condition.)
3. Is the order cheapest-to-answer first?
4. Is the Dutch natural trade language, not translated English?

Edit the JSON directly. Do not regenerate: a second generation usually reproduces the same gap.

- [ ] **Step 4: Load the reviewed ladders**

Run:
```bash
cd /home/gabriel/automations/scripts/prompt93
for f in ladders/*.json; do
  node --env-file=/home/gabriel/LeadAwakerApp/.env load_ladder.js "$f"
done
```
Expected: one `Loaded ladder for ...` line per file.

- [ ] **Step 5: Verify coverage**

Run:
```bash
cd /home/gabriel/LeadAwakerApp && timeout 60 node --env-file=.env -e "
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const r=await c.query('select niche, (scoping_ladder is not null) has_ladder, (opener_phrase is not null) has_phrase from p2mxx34fvbf3ll6.\"Niche_Vocabulary\" order by niche');
console.table(r.rows);await c.end();process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
"
```
Expected: every row `has_ladder` and `has_phrase` true, including `__default__`.

- [ ] **Step 6: Spot-check two generated niches in conversation**

Run the Roofing case:
```bash
cd /home/gabriel/LeadAwakerApp && timeout 60 node --env-file=.env -e "
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
await c.query(\"update p2mxx34fvbf3ll6.\\\"Campaigns\\\" set niche='Roofing' where id=66\");
console.log('campaign 66 niche=Roofing');await c.end();process.exit(0)})();
"
cd /home/gabriel/automations && python tests/prompt_tester.py --pl-id 93 --scenarios 0 --turns 14 \
  --llm-lead "You enquired about a new roof about a year ago. Your house is a semi-detached, the roof is about 60 square metres, tiles are cracked in places, you want slate, no scaffolding up yet, hoping to do it in spring, budget maybe 8000 pounds. Answer only what you are asked." \
  --output /tmp/ladder_roofing.json
```

Apply the same five checks as Task 6 Step 5. Repeat for one more niche (HVAC or Bathrooms). Restore campaign 66's niche afterwards.

- [ ] **Step 7: Commit**

```bash
cd /home/gabriel/automations
git add scripts/prompt93/generate_ladders.js scripts/prompt93/ladders/
git commit -m "feat: scoping ladders for all 16 niches"
```

---

## Task 13: Scoping ladders for arbitrary demo niches

The universal demo accepts a free-text niche and invents a company for it. Without this task, a demo in an unlisted niche (dental implants, loft conversions) falls back to the `__default__` ladder, which is kitchen-shaped and will ask about worktops.

**Files:**
- Modify: `/home/gabriel/LeadAwakerApp/server/demo-session.ts` (`NicheContext`, `generateNicheContext`)

**Interfaces:**
- Consumes: the tier-1 ladders from Task 6 as few-shot examples
- Produces: `NicheContext.scoping_ladder: string` and `NicheContext.opener_phrase: string`, overlaid onto the campaign at runtime by the existing `demo_niche` mechanism

- [ ] **Step 1: Extend the interface**

In `/home/gabriel/LeadAwakerApp/server/demo-session.ts`, add to the `NicheContext` interface next to `niche_question_bank`:

```ts
  // Scoping ladder for this niche, generated at demo-creation time. Same text
  // shape as Niche_Vocabulary.scoping_ladder so the prompt reads it identically.
  scoping_ladder: string;
  // Natural plural phrase for the opener ("new windows or doors"), never the
  // commercial arrangement ("supply and installation").
  opener_phrase: string;
```

- [ ] **Step 2: Add both to the generator prompt**

In the generator prompt inside `generateNicheContext`, add these instructions alongside the existing `niche_question_bank` instruction:

```
`scoping_ladder`: an ordered list of 5 to 7 slots, each collecting ONE fact the company needs to quote the job. Format each slot exactly like this:

SLOT 1 - <short name>
Purpose: <what this answer changes in the quote>
Ask: "<one natural question a real employee would text>"
Options: <closed set, or "open">

Order them cheapest-to-answer first. Do NOT include slots for still-interested, timing or budget: those are universal and handled elsewhere. Every Purpose line must name something that changes the quote; "to understand their needs" is not acceptable. Include the two biggest price drivers for this specific trade.

`opener_phrase`: what the customer wants in their own words, plural, as it would appear in "who was looking at ___ a while back". For example "new windows or doors", "a new kitchen", "solar panels". Never the commercial arrangement.
```

- [ ] **Step 3: Add the fallback defaults**

In `applyDemoDefaults` (or wherever the other generated fields get their fallbacks in this file), default both to empty strings so a generation failure degrades to the `__default__` ladder rather than throwing:

```ts
    scoping_ladder: ctx.scoping_ladder || "",
    opener_phrase: ctx.opener_phrase || "",
```

Also add both to `buildFallbackNicheContext` and `buildSolarNicheContext` with the same empty-string default, so every construction path produces a complete object.

- [ ] **Step 4: Verify a generated demo niche produces a real ladder**

Start a universal demo for an unlisted niche and read back what was generated:

```bash
cd /home/gabriel/LeadAwakerApp && curl -s -X POST http://localhost:5000/api/demo/start \
  -H 'Content-Type: application/json' \
  -d '{"niche":"dental implants","firstName":"Test","language":"en"}' | head -5

timeout 60 node --env-file=.env -e "
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const r=await c.query('select demo_niche from p2mxx34fvbf3ll6.\"Leads\" where channel_identifier like \'wa-demo:%\' order by id desc limit 1');
const d=JSON.parse(r.rows[0].demo_niche);
console.log('opener_phrase:', d.opener_phrase);
console.log(d.scoping_ladder);
await c.end();process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
"
```

Expected: an `opener_phrase` like "dental implants" (not "supply and installation"), and 5 to 7 slots asking about implant count, bone condition, timeline pressure and similar. If the slots are generic ("what are you looking for?"), the few-shot examples are not reaching the model: confirm Step 2 landed in the prompt that is actually sent.

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add server/demo-session.ts
git commit -m "feat: generate scoping ladders for arbitrary demo niches"
```

---

## Verification checklist

Run before declaring this plan complete:

- [ ] `cd /home/gabriel/automations && python -m pytest` passes
- [ ] Prompt 93 conditional check reports `maxDepth 1`, `finalDepth 0`, opens equal to closes
- [ ] A scoping conversation asks 6+ spec questions before offering a call (`/tmp/ladder_after.json`)
- [ ] The same prompt in decision mode still behaves as before: run `prompt_tester.py` against a campaign with `what_lead_did = "Received a quote"` and confirm it diagnoses rather than ladders
- [ ] `ai_disclosure = "on"` discloses in the opener and does **not** disclose again in the first reply
- [ ] `ai_disclosure = "off"` deflects the first AI question and confirms plainly on the second
- [ ] Every `Niche_Vocabulary` row has a ladder and an opener phrase
- [ ] A rendered opener contains no literal `{disclosure_clause}` or `{opener_phrase}` tokens
- [ ] A voice turn still emits its plain-text companion message despite the cap of 1
- [ ] A universal demo in an unlisted niche generates a real ladder, not the kitchen default
- [ ] Campaign settings for conversation mode and message cap persist after a save
- [ ] `pm2 logs leadawaker --lines 50 --nostream` and `pm2 logs leadawaker-engine --lines 50 --nostream` are clean
