# Prompt 93 reduction pass — handoff

Reduce the rendered size of `Prompt_Library` row 93 (Discovery Prompt) by tightening three
sections. **Remove and tighten only. Do not add rules.** Gabriel's explicit constraint: the
prompt has become a patchwork of overlapping rules, and every new rule makes it worse.

Target: **3,500-5,000 chars off the rendered prompt** with no behaviour change.

---

## Where it lives and how to edit it

- Postgres: `"p2mxx34fvbf3ll6"."Prompt_Library"` id **93**. Current version **8.69**, 58,145 chars stored.
- Connect with `node --env-file=.env` from `/home/gabriel/LeadAwakerApp` using the `pg` package
  (ESM script must live in that directory so `node_modules` resolves).
- The engine reads this row directly. `_load_prompt()` at
  `automations/src/automations/conversation/prompt_builder.py:14` hits the DB per conversation,
  so **edits are live immediately, no restart**.

### Non-negotiable write protocol

1. **Ask Gabriel to close the CRM prompt editor tab first.** Its debounced autosave (no Save
   button) will silently overwrite your SQL write with its stale buffer and keep your version
   number, so it looks like the edit never happened. This cost a full cycle on 2026-08-13.
2. **Snapshot before every write** into `"p2mxx34fvbf3ll6"."Prompt_Versions"`
   (`prompts_id, version_number, prompt_text, label, notes, saved_at, created_at`; `id` is a
   sequence). Convention: store the **pre**-change text under the **old** version number, so the
   editor's version list always trails the live row by one. That is expected, not a failed write.
3. **Match by line anchor** (`startsWith` on a distinctive prefix), assert **exactly 1 match**,
   and abort without writing if the count is wrong. Never blind `replace`.
4. **Poll the row for ~60s after writing** (`version`, `length(prompt_text)`, a `LIKE` probe on
   the new text) to confirm it held.

### Stored size is not sent size

`resolve_conditional_blocks()` at `automations/tools/ai_service.py:114` strips every `{{#if}}`
branch whose condition is false before the model sees it. **Always render before measuring or
diagnosing.** 58,145 stored renders to ~36-38k per turn.

```python
import sys; sys.path.insert(0, '/home/gabriel/automations')
from tools.ai_service import resolve_conditional_blocks
base = dict(voice_mode='off', voice_live='off', ai_disclosure='off',
            immediate_callback='on', is_demo='true', positioning='premium')
scoping  = dict(base, conversation_mode='scoping',  lead_stage='inquired',
                decision_opener='generic', quoted_first_reply='')
decision = dict(base, conversation_mode='decision', lead_stage='quoted',
                decision_opener='named',   quoted_first_reply='off')
```

Run with `/home/gabriel/automations/.venv/bin/python`.

**`quoted_first_reply` is the trap.** It is `""` unless the campaign has `opener_names_job="yes"`
(see `tools/ai_service.py:742`), and if you omit it the entire decision-mode `YOUR FIRST REPLY`
block is invisible in your render. A whole diagnosis was wrong for an hour because of this.

Current rendered sizes: **scoping 35,992**, **decision 38,093**.

---

## The three targets

### 1. `## STEP 5 — Buying signal and close` — 5,673 chars, 14.9%

Three patch-rules account for 2,236 of it, and two of them are the same idea:

- **NO STALLING RULE** (892 chars): never say "let me check the agenda", across three cases.
- **ALREADY-OFFERED TIMES RULE** (553 chars): times you already offered stay bookable.
- These are one rule from two directions: *the times you have are real, don't hedge about them.*
  One covers hedging forward ("I'll check"), the other hedging backward ("I don't have that day").
- **The staged-flow rule** (791 chars) describes the yes → days → times → link sequence in prose,
  and the lines immediately below it demonstrate the same sequence with example sentences.

Collapse to one positive procedure plus one guarantee sentence. All three rules must survive in
substance. Expected: 5,673 → ~3,400.

### 2. `## 4.3 Decision Completion Rule` — 1,608 chars, 4.2%

- **Four worked examples** ("We want to visit a few more showrooms first", "My partner wants to
  keep looking", "We are looking for something cheaper", "We are waiting for another quote") all
  demonstrate the identical status/reason/next-step decomposition. One is enough.
- **Two overlapping lists of exit moves**: near the top ("discuss next steps, offer space,
  schedule a future follow-up, move toward a close") and again at the bottom ("summarizing,
  discussing timing, offering future follow-up, explaining {advisor_term} relevance, closing").
  Merge into one.
- **Keep**: the rule itself, the three-part sufficiency test, and the sentence *"The burden of
  proof is on asking the next question, not on stopping"* — that line does most of the work.

Expected: 1,608 → ~700.

### 3. `### Your first reply — applies to ALL THREE disclosure modes below` — 5,984 chars, 15.7%

This is a **structural split**, not a trim, and it is the harder one. The section is headed
"first reply" but roughly half its content applies to every reply:

| Content | Actually applies to |
|---|---|
| AI disclosure clause (three `ai_disclosure` branches, one renders at a time) | reply 1 |
| "Never re-introduce yourself after the opener" (~320 chars) | every reply |
| Step 2 primary path / fallback path / status-only handling (~2,100 chars) | every reply |

Move the always-on material out to where per-turn rules live, and leave reply-1 material under a
heading that means reply 1. The mis-filing is a real cause of bugs: rules scoped to the first
reply silently fail to govern reply 2, which is exactly how the echo bug survived four fixes.

Expected: mostly relocation, some saving.

---

## Do not touch

These were tuned and verified working on 2026-08-13/14 and are not part of this pass:

- **`## Reacting and acknowledging`** (the consolidated block in section 3). Seven fragments were
  merged into it across versions 8.55-8.66 and it took six attempts to get right. Leave it alone.
- The **decision-mode first reply** (`"Good to hear it's still on the table. So, where did you get
  to with the {proposal_term}?"`), including its once-guard.
- **Checkpoint 3 (`WHAT'S IN THE WAY`)** in the decision checkpoints.
- **Step 4 of the scoping full sequence** (the budget question, `"What would your budget be for
  this?"`).

## Authoring conventions for this prompt

- **Every branch carries its own verbatim sentence.** Never replace an example with an "as above"
  cross-reference: the model does not resolve them reliably. If the same sentence must appear in
  two branches, it appears twice, and any wording change must touch every copy or they drift.
  (Five drifting copies of one sentence caused a live bug on 2026-08-14.)
- **Config branching belongs in `{{#if}}` variables, not prose.** The resolver **cannot nest**;
  where a block needs two conditions, the engine composites them into one variable
  (`quoted_first_reply` is exactly this).
- **Precedence must be stated where the conflict is read, not downstream.** A "this overrides the
  block above" note 100 lines later does not hold.
- Justification prose ("this is measured, not stylistic") is not load-bearing and can be cut.
- No em dashes or en dashes anywhere in the prompt text.

## Verification

1. Render **both** scoping and decision before and after; report char deltas per section.
2. Confirm no rule was lost in substance: list each rule removed and where its content now lives.
3. Grep for orphans: any text that references a rule you deleted (this bit us with *"follow the
   normal acknowledgment rules: vary them"* pointing at deleted text).
4. Do **not** run `tsc`. The app runs under pm2; never `npm run dev`.
