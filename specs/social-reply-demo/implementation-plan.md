# Social Reply Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Socials" demo on the Demos page that mints `/social-demo/<token>`: an Instagram-like feed with a post generated for the prospect's business, where commenting the keyword opens a DM thread with the same AI, booking and CRM inbox as the other demos.

**Architecture:** A new demo campaign (S) borrows prompt 108 and gains Instagram context through three flat persona keys that the engine overlay passes into the opener and the prompt. The CRM generates the post text at mint (image in the background), stores it on the Client row, and serves a server-rendered page whose DM thread talks to the existing `/api/web-demo/:token` transport through a new shared `transport.js` module.

**Tech Stack:** Express + Drizzle + Postgres (CRM, `/home/gabriel/LeadAwakerApp`), vanilla ES modules for the page, React + TanStack Query for the Demos/Chats UI, Python FastAPI engine (`/home/gabriel/automations`), OpenAI Images API via `fetch`, system `cwebp`.

**Spec:** [specs/social-reply-demo/requirements.md](requirements.md). Read it before any task.

## Global Constraints

- Languages: exactly `en`, `nl`, `pt`. Portuguese is always Brazilian (você, equipe, never European forms).
- No em dashes in any copy, code comment or commit message (Gabriel's writing rule).
- Never run `npx tsc` / `npm run check` unless Gabriel asks. Never run `npm run dev`; the app runs under pm2 and reloads on save (server/ and shared/ in about 5 to 8 s).
- DB changes go through a `node --env-file=.env scripts/migrations/<file>.js` script (`npm run db:push` needs a TTY). Schema `p2mxx34fvbf3ll6`.
- Never send ISO strings from the client for timestamp columns; set them server-side with `new Date()`.
- CRM React strings go through i18n (`client/src/locales/{en,nl,pt}/`). The standalone page uses its own per-language table (outside React).
- No official Instagram logo or icon artwork: the word "Instagram" in the Grand Hotel Google Font, generic outline icons.
- Images: WebP at display size (posts 1080 px square, avatars 112 px), never multi-MB originals.
- Server files stay under about 500 lines; new logic goes in `server/demoSocial/`, not into `server/routes/demo.ts` (already 1100 lines).
- Tests: the CRM has no test runner. TypeScript tests use `node:test` run with `node --import tsx --test <file>` (Node 24, `tsx` is installed). Browser modules use the plain-node pattern of `client/public/premium/demo/demo.test.mjs`. Engine tests use `cd /home/gabriel/automations && .venv/bin/python -m pytest <file>`.
- Campaign S id: the plan writes `69` (current max id is 68). Task 1 prints the real id; if it is not 69, use the printed id everywhere this plan says 69.
- Do not modify `client/public/premium/demo/main.js` or `client/public/widget/widget.js` (live surfaces).

## Review Focus

1. **Keyword typed "wrong" on a phone:** lower case, accents (telhado vs TELHADO), trailing "!", keyword inside a sentence, autocorrect capital. All must open the DM. Pinned in Task 9 (`matchesKeyword` tests).
2. **Mint before the image exists / image generation failed:** the page must still render a full post (website screenshot, else a branded placeholder), never a broken image icon. Pinned in Task 7 (`pickPostImage` tests) and Task 5 (failure leaves no path).
3. **Reload mid-demo or after restart:** a reload after the prospect replied opens the DM view with history; after a presenter restart it shows the feed again; a double-tap on Post never creates two openers. Pinned in Task 7 (`threadStarted` query semantics) and Task 8 (transport `load` single-flight test).
4. **Client minted in a language it has no social post for** (e.g. `pt` after `en`): text generates for `pt`, the image is reused, the `en` post is untouched. Pinned in Task 6 (`upsertLangSlot` tests).
5. **Prompt 108 regressions for campaigns 67 and 68:** with no `lead_source`, the rendered 108 must be byte-identical to before. Pinned in Task 3 (render comparison test).

---

## File map

**CRM (`/home/gabriel/LeadAwakerApp`)**

| File | Status | Responsibility |
|---|---|---|
| `scripts/migrations/2026-09-social-reply-demo.js` | create | Niche_Vocabulary columns + campaign S row |
| `scripts/migrations/2026-09-prompt108-social-block.js` | create | Insert the guarded block into prompt 108 |
| `shared/schema.ts` | modify | `socialPost`, `socialImagePath` on `nicheVocabulary` |
| `server/demoSocial/types.ts` | create | `SocialPost`, `PublicSocialPost`, `SocialLang` |
| `server/demoSocial/validate.ts` | create | `normalizeKeyword`, `validateSocialPost` (pure) |
| `server/demoSocial/generatePost.ts` | create | Prompt builder + `generateSocialPost` via `runJson` |
| `server/demoSocial/context.ts` | create | `socialContextFields` (persona keys for the engine + page) |
| `server/demoSocial/image.ts` | create | OpenAI image + `cwebp` + in-flight dedup |
| `server/demoSocial/clientStore.ts` | create | Read/write the post and image on the Client row |
| `server/demoSocial/*.test.ts` | create | node:test suites |
| `server/demo-session.ts` | modify | Add 69 to `SERVICE_DEMO_CAMPAIGN_IDS` |
| `server/routes/demo.ts` | modify | `service` enum + socials branch in create-link (calls `demoSocial`) |
| `server/routes/demoSocial.ts` | create | Page route, assets static, Client social-post API |
| `server/socialDemoPage.ts` | create | `renderSocialDemoHtml` (template string + import map) |
| `server/routes/index.ts` | modify | Register `registerDemoSocialRoutes` |
| `client/public/premium/demo/transport.js` | create | Shared web-demo transport (load/send/restart/poll/recap) |
| `client/public/premium/demo/transport.test.mjs` | create | Plain-node tests with a fake fetch |
| `client/public/social-demo/keyword.js` | create | `matchesKeyword` (pure) |
| `client/public/social-demo/copy.js` | create | Per-language page strings, static posts, inbox rows |
| `client/public/social-demo/feed.js` | create | Feed HTML (3 posts, comment box) |
| `client/public/social-demo/dm.js` | create | Inbox + thread HTML |
| `client/public/social-demo/main.js` | create | Boot, view switching, wiring transport and reused modules |
| `client/public/social-demo/social.css` | create | Instagram-like light theme |
| `client/public/social-demo/social.test.mjs` | create | Plain-node tests for keyword/copy/feed/dm |
| `client/public/social-demo/img/` | create | Static post images + inbox avatars (WebP) |
| `scripts/social-demo/generate-static-images.ts` | create | One-off generator for `img/` |
| `client/src/features/demos/services.ts` | modify | socials: campaign 69, `socialPage` |
| `client/src/features/demos/components/ProspectDemoPanel.tsx` | modify | URL after mint for `socialPage` |
| `client/src/features/campaigns/components/clients/SocialPostSection.tsx` | create | Editor section |
| `client/src/features/campaigns/components/clients/ClientEditor.tsx` | modify | Mount the section |
| `client/src/features/campaigns/api/demoClientsApi.ts` | modify | Social-post API calls + types |
| `client/src/features/leads/components/conversationType.ts` | modify | `instagram` type |
| `client/src/locales/{en,nl,pt}/leads.json` | modify | `conversationType.instagram` |
| `client/src/locales/{en,nl,pt}/campaigns.json` | modify | Editor strings (`clients.social`) |

**Engine (`/home/gabriel/automations`)**

| File | Status | Responsibility |
|---|---|---|
| `src/automations/demo_campaigns.py` | modify | 69 in `_DEFAULT_IDS` |
| `src/automations/conversation/prompt_builder.py` | modify | Copy social keys; social opener after `apply_mode_opener` |
| `tools/ai_service.py` | modify | `lead_source`, `social_context` prompt vars |
| `tests/test_social_reply_overlay.py` | create | Overlay + opener + prompt var tests |

---

### Task 1: Database: Client columns and campaign S

**Files:**
- Create: `scripts/migrations/2026-09-social-reply-demo.js`
- Modify: `shared/schema.ts` (the `nicheVocabulary` table, near `screenshotPath` / `widgetColor`, lines ~337-445)

**Interfaces:**
- Produces: DB columns `"Niche_Vocabulary".social_post jsonb`, `"Niche_Vocabulary".social_image_path text`; Drizzle fields `nicheVocabulary.socialPost` (typed `SocialPostByLang | null`) and `nicheVocabulary.socialImagePath`; a `"Campaigns"` row "Social Reply Demo" (id printed, expected 69) with `campaign_type='social_reply'`, `is_demo=true`, `prompt_campaign_id=67`, cloned from 67.

- [ ] **Step 1: Write the migration script**

```js
// Run with: node --env-file=.env scripts/migrations/2026-09-social-reply-demo.js
// npm run db:push cannot be used here: it requires a TTY.
import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";
const q = (t) => `"${SCHEMA}"."${t}"`;

const FALLBACK_OPENER = {
  en: "Hey, thanks for commenting on the post! It's {agent_name} from {company_name}{disclosure_clause}, how's your day going?",
  nl: "Hoi, bedankt voor je reactie op de post! Met {agent_name} van {company_name}{disclosure_clause}, hoe gaat het vandaag?",
  pt: "Oi, obrigado por comentar no post! Aqui é {agent_name} da {company_name}{disclosure_clause}, tudo bem com você hoje?",
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query(`ALTER TABLE ${q("Niche_Vocabulary")} ADD COLUMN IF NOT EXISTS social_post jsonb`);
  await c.query(`ALTER TABLE ${q("Niche_Vocabulary")} ADD COLUMN IF NOT EXISTS social_image_path text`);
  console.log("OK: Niche_Vocabulary columns");

  const existing = await c.query(`SELECT id FROM ${q("Campaigns")} WHERE name = 'Social Reply Demo' LIMIT 1`);
  if (existing.rows[0]) {
    console.log("Campaign exists, id =", existing.rows[0].id);
  } else {
    const src = (await c.query(`SELECT * FROM ${q("Campaigns")} WHERE id = 67`)).rows[0];
    if (!src) throw new Error("campaign 67 not found");
    const row = { ...src };
    delete row.id;
    // Timestamps and counters belong to 67, not to the copy.
    for (const k of Object.keys(row)) {
      if (/^(created_at|updated_at|CreatedAt|UpdatedAt)$/.test(k)) delete row[k];
    }
    row.name = "Social Reply Demo";
    row.campaign_type = "social_reply";
    row.is_demo = true;
    row.prompt_campaign_id = 67;
    row.First_Message = JSON.stringify(FALLBACK_OPENER);
    // apply_mode_opener would swap these in over First_Message and the social opener.
    if ("first_message_scoping" in row) row.first_message_scoping = null;
    if ("first_message_quoted" in row) row.first_message_quoted = null;
    const cols = Object.keys(row);
    const sql = `INSERT INTO ${q("Campaigns")} (${cols.map((k) => `"${k}"`).join(", ")})
                 VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`;
    const res = await c.query(sql, cols.map((k) => row[k]));
    console.log("Created campaign, id =", res.rows[0].id);
  }
  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it and record the id**

Run: `node --env-file=.env scripts/migrations/2026-09-social-reply-demo.js`
Expected: `OK: Niche_Vocabulary columns` then `Created campaign, id = 69`. If the id differs, note it: every later "69" in this plan means this id. Re-running prints `Campaign exists, id = ...` (idempotent).

- [ ] **Step 3: Verify the row**

Run:
```bash
node --env-file=.env -e 'const {Client}=require("pg");(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query(`SELECT id,name,campaign_type,is_demo,prompt_campaign_id,"Accounts_id",booking_mode_call,first_message_scoping IS NULL AS no_scoping,"First_Message" FROM "p2mxx34fvbf3ll6"."Campaigns" WHERE name=$1`,["Social Reply Demo"]);console.log(r.rows);await c.end()})()'
```
Expected: `campaign_type: 'social_reply'`, `is_demo: true`, `prompt_campaign_id: 67`, `Accounts_id: 1`, `no_scoping: true`, First_Message JSON with en/nl/pt.

- [ ] **Step 4: Add the Drizzle columns**

In `shared/schema.ts`, above `nicheVocabulary`, next to the `NicheText` type (line ~335):

```ts
export type SocialPostText = {
  handle: string;
  caption: string;
  keyword: string;
  cta_line: string;
  dm_opener: string;
  offer: string;
  image_prompt: string;
  likes: number;
};
export type SocialPostByLang = Partial<Record<"en" | "nl" | "pt", SocialPostText>>;
```

Inside the `nicheVocabulary` columns, next to `screenshotPath`:

```ts
  socialPost: jsonb("social_post").$type<SocialPostByLang | null>(),
  socialImagePath: text("social_image_path"),
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/2026-09-social-reply-demo.js shared/schema.ts
git commit -m "feat(social-demo): Client social post columns and Social Reply Demo campaign"
```

---

### Task 2: Engine: campaign S is a persona demo; social keys reach opener and prompt

**Files:**
- Modify: `/home/gabriel/automations/src/automations/demo_campaigns.py:23`
- Modify: `/home/gabriel/automations/src/automations/conversation/prompt_builder.py` (`_overlay_demo_niche_onto_campaign`, final `return apply_mode_opener(out, _mode, _stage)` near line 452)
- Modify: `/home/gabriel/automations/tools/ai_service.py` (`prompt_vars`, next to `"opener_phrase"` near line 820)
- Test: `/home/gabriel/automations/tests/test_social_reply_overlay.py`

**Interfaces:**
- Consumes: `demo_niche` JSON with flat keys `lead_source` (`"social_comment"`), `social_context` (str), `social_dm_opener` (str, already in the lead's language, may contain `{agent_name}`, `{company_name}`, `{disclosure_clause}`), plus the usual `enquiry_context`.
- Produces: `_overlay_demo_niche_onto_campaign` returns a dict with `lead_source`, `social_context`, and, when `social_dm_opener` is set, `First_Message = json.dumps({lang: opener})`. `build_conversation_prompt` exposes `{lead_source}` and `{social_context}` (empty string when absent).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_social_reply_overlay.py
import json

from src.automations.conversation.prompt_builder import _overlay_demo_niche_onto_campaign
from src.automations.demo_campaigns import is_persona_demo_campaign


def _lead(ctx: dict, language: str = "nl") -> dict:
    return {"id": 1, "language": language, "demo_niche": json.dumps(ctx)}


BASE_CAMPAIGN = {
    "id": 69,
    "language": "en",
    "First_Message": json.dumps({"en": "fallback en", "nl": "fallback nl"}),
    "first_message_scoping": None,
    "first_message_quoted": None,
}


def test_campaign_69_is_a_persona_demo_campaign():
    assert is_persona_demo_campaign(69)


def test_social_keys_are_copied():
    out = _overlay_demo_niche_onto_campaign(
        BASE_CAMPAIGN,
        _lead({"lead_source": "social_comment", "social_context": "Commented DAK on a post"}),
    )
    assert out["lead_source"] == "social_comment"
    assert out["social_context"] == "Commented DAK on a post"


def test_social_opener_replaces_first_message_in_lead_language():
    opener = "Hoi! Met {agent_name} van {company_name}, hoe gaat het?"
    out = _overlay_demo_niche_onto_campaign(BASE_CAMPAIGN, _lead({"social_dm_opener": opener}, "nl"))
    assert json.loads(out["First_Message"]) == {"nl": opener}


def test_no_social_opener_keeps_campaign_first_message():
    out = _overlay_demo_niche_onto_campaign(BASE_CAMPAIGN, _lead({"company_name": "Dakwerk BV"}))
    assert out["First_Message"] == BASE_CAMPAIGN["First_Message"]
    assert "lead_source" not in out


def test_social_opener_wins_over_an_authored_scoping_opener():
    campaign = {**BASE_CAMPAIGN, "first_message_scoping": json.dumps({"nl": "scoping"})}
    out = _overlay_demo_niche_onto_campaign(campaign, _lead({"social_dm_opener": "social"}, "nl"))
    assert json.loads(out["First_Message"]) == {"nl": "social"}
```

- [ ] **Step 2: Run to see them fail**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_social_reply_overlay.py -v`
Expected: `test_campaign_69_is_a_persona_demo_campaign` FAILS (69 not in set); the social-key tests FAIL with `KeyError: 'lead_source'` / assertion on First_Message.

- [ ] **Step 3: Register 69**

`src/automations/demo_campaigns.py:23`:

```python
_DEFAULT_IDS = {60, 67, 68, 69}
```

- [ ] **Step 4: Copy the keys and apply the social opener last**

In `prompt_builder.py`, replace the final line of `_overlay_demo_niche_onto_campaign`:

```python
    return apply_mode_opener(out, _mode, _stage)
```

with:

```python
    out = apply_mode_opener(out, _mode, _stage)
    return _apply_social_reply(out, ctx, lang)
```

(`lang` is already computed a few lines above for the pack headers.) Add this function directly below `_overlay_demo_niche_onto_campaign`:

```python
def _apply_social_reply(campaign: dict, ctx: dict, lang: str) -> dict:
    """Instagram comment-to-DM demo (campaign_type social_reply).

    The post context rides in flat persona keys because the overlay never reads
    nested ones. The opener goes in AFTER apply_mode_opener: the lead just
    commented on a post, so neither the scoping nor the quoted opener is true.
    Stored as {lang: text} so demo_recap's authored-variant check skips the
    AI translation step. Each key works on its own; the CRM writes all three.
    """
    source = str(ctx.get("lead_source") or "").strip()
    opener = str(ctx.get("social_dm_opener") or "").strip()
    social_context = str(ctx.get("social_context") or "").strip()
    if not (source or opener or social_context):
        return campaign
    out = dict(campaign)
    if source:
        out["lead_source"] = source
    if social_context:
        out["social_context"] = social_context
    if opener:
        out["First_Message"] = json.dumps({lang: opener})
    return out
```

Check that `json` is already imported at the top of `prompt_builder.py` (the overlay calls `json.loads`, so it is).

- [ ] **Step 5: Expose the prompt vars**

In `tools/ai_service.py` `prompt_vars`, after `"opener_phrase"`:

```python
        # Instagram comment-to-DM demo. "" for every other campaign, so the
        # {{#if lead_source == "social_comment"}} block in prompt 108 stays shut.
        "lead_source": campaign.get("lead_source") or "",
        "social_context": campaign.get("social_context") or "",
```

Add to the test file:

```python
from tools.ai_service import build_conversation_prompt  # noqa: E402


def test_prompt_vars_render_social_context():
    # Mirrors tests/test_disclosure_clause.py: plain dicts, custom prompt text.
    prompt = build_conversation_prompt(
        lead={"id": 1, "first_name": "Ana", "language": "pt"},
        campaign={"language": "pt", "lead_source": "social_comment", "social_context": "Comentou TELHADO"},
        custom_prompt='{{#if lead_source == "social_comment"}}CTX: {social_context}{{/if}}',
    )
    assert "CTX: Comentou TELHADO" in (prompt if isinstance(prompt, str) else prompt[0])
```

Before running, open `tests/test_disclosure_clause.py` and copy its exact `build_conversation_prompt(...)` call shape (argument names and return handling); adjust the call above to match it exactly. Keep the assertion.

- [ ] **Step 6: Run the tests**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_social_reply_overlay.py tests/test_disclosure_clause.py -v`
Expected: all PASS.

- [ ] **Step 7: Restart the engine and commit**

Run: `pm2 restart leadawaker-engine && sleep 5 && pm2 logs leadawaker-engine --lines 20 --nostream`
Expected: no traceback.

```bash
cd /home/gabriel/automations
git add src/automations/demo_campaigns.py src/automations/conversation/prompt_builder.py tools/ai_service.py tests/test_social_reply_overlay.py
git commit -m "feat(social-demo): campaign 69 persona overlay, social opener and prompt vars"
```

---

### Task 3: Prompt 108: the guarded Instagram block

**Files:**
- Create: `scripts/migrations/2026-09-prompt108-social-block.js` (CRM repo)
- Test: `/home/gabriel/automations/tests/test_social_reply_overlay.py` (add a test)

**Interfaces:**
- Consumes: `{lead_source}`, `{social_context}` from Task 2.
- Produces: Prompt_Library row 108 containing one block between the `# 1. ROLE & IDENTITY` section and `# 2. PRIMARY OBJECTIVE`.

- [ ] **Step 1: Close any CRM tab showing prompt 108.** The CRM autosave overwrites SQL writes (`feedback_prompt93_editing_workflow`). Ask Gabriel to confirm no Prompts page is open, or check with him before Step 3.

- [ ] **Step 2: Write the script**

The block text (English, like the rest of 108, which renders the reply language via `{language}`):

```
{{#if lead_source == "social_comment"}}
### HOW THEY GOT IN TOUCH: A COMMENT ON YOUR INSTAGRAM POST
{social_context}
They typed that word under the post because they want what it offers. Your opener in their DMs thanked them for commenting, and they are now replying to it. Treat the offer in the post as the reason they are here: pick up from it in your first reply, and do not ask why they got in touch.
This is an Instagram DM. Keep every message short and casual, one question at a time.
{{/if}}
```

Script:

```js
// Run with: node --env-file=.env scripts/migrations/2026-09-prompt108-social-block.js
import { Client } from "pg";

const TABLE = '"p2mxx34fvbf3ll6"."Prompt_Library"';
const MARK = '{{#if lead_source == "social_comment"}}';
const BLOCK = `${MARK}
### HOW THEY GOT IN TOUCH: A COMMENT ON YOUR INSTAGRAM POST
{social_context}
They typed that word under the post because they want what it offers. Your opener in their DMs thanked them for commenting, and they are now replying to it. Treat the offer in the post as the reason they are here: pick up from it in your first reply, and do not ask why they got in touch.
This is an Instagram DM. Keep every message short and casual, one question at a time.
{{/if}}

`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const cols = (await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='p2mxx34fvbf3ll6' AND table_name='Prompt_Library'`)).rows.map((r) => r.column_name);
  const col = ["prompt_text", "Prompt_Text", "prompt", "content", "system_prompt"].find((k) => cols.includes(k));
  if (!col) throw new Error("prompt text column not found: " + cols.join(","));
  const text = (await c.query(`SELECT "${col}" AS t FROM ${TABLE} WHERE id = 108`)).rows[0]?.t;
  if (!text) throw new Error("prompt 108 not found");
  if (text.includes(MARK)) { console.log("Already present, nothing to do"); process.exit(0); }
  const anchor = text.indexOf("# 2. PRIMARY OBJECTIVE");
  if (anchor < 0) throw new Error("anchor '# 2. PRIMARY OBJECTIVE' not found");
  const next = text.slice(0, anchor) + BLOCK + text.slice(anchor);
  await c.query(`UPDATE ${TABLE} SET "${col}" = $1 WHERE id = 108`, [next]);
  const back = (await c.query(`SELECT "${col}" AS t FROM ${TABLE} WHERE id = 108`)).rows[0].t;
  console.log(back.includes(MARK) ? "OK: block inserted" : "FAILED: not found after write");
  await c.end();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
```

- [ ] **Step 3: Save the current 108 as a backup, then run**

Run:
```bash
node --env-file=.env -e 'const {Client}=require("pg");(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query(`SELECT * FROM "p2mxx34fvbf3ll6"."Prompt_Library" WHERE id=108`);require("fs").writeFileSync("/tmp/claude-1000/prompt108-backup.json",JSON.stringify(r.rows[0]));await c.end()})()'
node --env-file=.env scripts/migrations/2026-09-prompt108-social-block.js
```
Expected: `OK: block inserted`. Wait 2 minutes and re-read (Step 3's second command again prints `Already present`): if the block vanished, a CRM tab reverted it; close it and rerun.

- [ ] **Step 4: Test that 108 is unchanged for campaigns 67/68 (Review Focus 5)**

Add to `tests/test_social_reply_overlay.py`:

```python
MARK = '{{#if lead_source == "social_comment"}}'
BLOCK_BODY = "HOW THEY GOT IN TOUCH: A COMMENT ON YOUR INSTAGRAM POST"
TEMPLATE = "BEFORE\n" + MARK + "\n### " + BLOCK_BODY + "\n{social_context}\n{{/if}}\n\n# 2. PRIMARY OBJECTIVE"


def _render(campaign):
    out = build_conversation_prompt(
        lead={"id": 1, "first_name": "Sam", "language": "en"},
        campaign={"language": "en", **campaign},
        custom_prompt=TEMPLATE,
    )
    return out if isinstance(out, str) else out[0]


def test_block_absent_without_lead_source():
    rendered = _render({})
    assert BLOCK_BODY not in rendered
    assert "{social_context}" not in rendered


def test_block_present_for_social_comment():
    rendered = _render({"lead_source": "social_comment", "social_context": "Commented ROOF"})
    assert BLOCK_BODY in rendered and "Commented ROOF" in rendered
```

(Same call-shape adjustment as Task 2 Step 5.)

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_social_reply_overlay.py -v`
Expected: all PASS. If `test_block_absent_without_lead_source` leaves blank lines that differ from the pre-block prompt, that is fine; only the block text must be absent.

- [ ] **Step 5: Commit (CRM repo)**

```bash
git add scripts/migrations/2026-09-prompt108-social-block.js
git commit -m "feat(social-demo): guarded Instagram block in prompt 108"
cd /home/gabriel/automations && git add tests/test_social_reply_overlay.py && git commit -m "test(social-demo): prompt 108 block renders only for social_comment"
```

---

### Task 4: CRM: social post types, validation and generation

**Files:**
- Create: `server/demoSocial/types.ts`, `server/demoSocial/validate.ts`, `server/demoSocial/generatePost.ts`
- Test: `server/demoSocial/validate.test.ts`, `server/demoSocial/generatePost.test.ts`

**Interfaces:**
- Consumes: `runJson` from `server/demoGenerator/providers.ts` (`runJson(opts: { system; user; provider; claudeModel; claudeTimeoutMs?; validate?; openai: { model; maxTokens; timeoutMs }; stage }): Promise<{ data: any; providerUsed: string }>`); `SocialPostText` from `shared/schema.ts`.
- Produces:
  - `types.ts`: `export type SocialLang = "en" | "nl" | "pt"; export type SocialPost = SocialPostText; export type PublicSocialPost = Omit<SocialPost, "image_prompt" | "dm_opener">;`
  - `validate.ts`: `normalizeKeyword(raw: string): string`, `validateSocialPost(data: unknown): string | null`, `coerceSocialPost(data: any): SocialPost`
  - `generatePost.ts`: `export interface SocialPostInput { language: SocialLang; companyName: string; serviceName: string; nicheLabel: string; usp: string; kb: string; area: string }`, `buildSocialPostPrompt(input): { system: string; user: string }`, `generateSocialPost(input, opts?: { provider?: "claude" | "openai"; claudeModel?: "opus" | "sonnet" }): Promise<SocialPost>`

- [ ] **Step 1: Write the failing validation tests**

```ts
// server/demoSocial/validate.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeKeyword, validateSocialPost, coerceSocialPost } from "./validate";

const good = {
  handle: "dakwerk.utrecht",
  caption: "Lekkage na de storm? Wij repareren daken in heel Utrecht.",
  keyword: "DAK",
  cta_line: "Reageer DAK en we sturen je een DM om een afspraak te plannen.",
  dm_opener: "Hoi, bedankt voor je reactie! Met {agent_name} van {company_name}, hoe gaat het?",
  offer: "dakreparatie na stormschade",
  image_prompt: "A roofer on a ladder fixing clay tiles on a Dutch terraced house, daylight",
  likes: 412,
};

test("normalizeKeyword strips accents, case and non-letters", () => {
  assert.equal(normalizeKeyword(" telhádo! "), "TELHADO");
  assert.equal(normalizeKeyword("Keuken"), "KEUKEN");
});

test("a good post validates", () => {
  assert.equal(validateSocialPost(good), null);
});

test("keyword must be 3-10 ASCII letters", () => {
  assert.match(validateSocialPost({ ...good, keyword: "DA" }) ?? "", /keyword/);
  assert.match(validateSocialPost({ ...good, keyword: "DAK1" }) ?? "", /keyword/);
});

test("cta_line must contain the keyword", () => {
  assert.match(validateSocialPost({ ...good, cta_line: "Stuur ons een bericht" }) ?? "", /cta_line/);
});

test("dm_opener must keep the agent and company tokens", () => {
  assert.match(validateSocialPost({ ...good, dm_opener: "Hoi, met Sarah van Dakwerk" }) ?? "", /dm_opener/);
});

test("coerce clamps likes and normalizes keyword and handle", () => {
  const p = coerceSocialPost({ ...good, keyword: "dak", handle: "Dakwerk Utrecht", likes: 999999 });
  assert.equal(p.keyword, "DAK");
  assert.equal(p.handle, "dakwerkutrecht");
  assert.equal(p.likes, 5000);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --import tsx --test server/demoSocial/validate.test.ts`
Expected: FAIL, cannot find module `./validate`.

- [ ] **Step 3: Implement types and validation**

```ts
// server/demoSocial/types.ts
import type { SocialPostText } from "@shared/schema";

export type SocialLang = "en" | "nl" | "pt";
export type SocialPost = SocialPostText;
/** What the page receives: never the image prompt, and the opener stays server-side. */
export type PublicSocialPost = Omit<SocialPost, "image_prompt" | "dm_opener">;
```

Check how other server files import `shared/schema` (e.g. `server/demo-clients.ts` top imports) and use the same specifier (`@shared/schema` or a relative path).

```ts
// server/demoSocial/validate.ts
import type { SocialPost } from "./types";

export function normalizeKeyword(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

const TEXT_FIELDS = ["handle", "caption", "keyword", "cta_line", "dm_opener", "offer", "image_prompt"] as const;

export function validateSocialPost(data: unknown): string | null {
  if (!data || typeof data !== "object") return "not an object";
  const d = data as Record<string, unknown>;
  for (const k of TEXT_FIELDS) {
    if (typeof d[k] !== "string" || !(d[k] as string).trim()) return `missing ${k}`;
  }
  const kw = String(d.keyword).trim();
  if (!/^[A-Za-zÀ-ÿ]{3,10}$/.test(kw) || normalizeKeyword(kw).length < 3) return "keyword must be 3-10 letters";
  if (!normalizeKeyword(String(d.cta_line)).includes(normalizeKeyword(kw))) return "cta_line must contain the keyword";
  const opener = String(d.dm_opener);
  if (!opener.includes("{agent_name}") || !opener.includes("{company_name}")) {
    return "dm_opener must contain {agent_name} and {company_name}";
  }
  if (String(d.caption).length > 400) return "caption too long";
  return null;
}

export function coerceSocialPost(data: any): SocialPost {
  const likes = Math.round(Number(data.likes));
  return {
    handle: String(data.handle).toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30),
    caption: String(data.caption).trim(),
    keyword: normalizeKeyword(data.keyword),
    cta_line: String(data.cta_line).trim(),
    dm_opener: String(data.dm_opener).trim(),
    offer: String(data.offer).trim(),
    image_prompt: String(data.image_prompt).trim(),
    likes: Number.isFinite(likes) ? Math.min(5000, Math.max(40, likes)) : 327,
  };
}
```

- [ ] **Step 4: Run validation tests**

Run: `node --import tsx --test server/demoSocial/validate.test.ts`
Expected: 6 PASS.

- [ ] **Step 5: Write the failing prompt-builder tests**

```ts
// server/demoSocial/generatePost.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSocialPostPrompt } from "./generatePost";

const input = {
  language: "pt" as const,
  companyName: "Telhados Silva",
  serviceName: "conserto de telhado",
  nicheLabel: "Telhados",
  usp: "atendimento em 24h",
  kb: "Atendemos São Paulo capital e ABC.",
  area: "São Paulo",
};

test("prompt names the business, service and language", () => {
  const { system, user } = buildSocialPostPrompt(input);
  assert.match(user, /Telhados Silva/);
  assert.match(user, /conserto de telhado/);
  assert.match(system, /Brazilian Portuguese/);
});

test("prompt demands the opener tokens and a keyword in the CTA", () => {
  const { system } = buildSocialPostPrompt(input);
  assert.match(system, /\{agent_name\}/);
  assert.match(system, /\{company_name\}/);
  assert.match(system, /cta_line/);
});

test("image prompt is always requested in English with no text", () => {
  const { system } = buildSocialPostPrompt(input);
  assert.match(system, /image_prompt[^\n]*English/);
  assert.match(system, /no text/i);
});
```

- [ ] **Step 6: Run to see it fail**

Run: `node --import tsx --test server/demoSocial/generatePost.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 7: Implement `generatePost.ts`**

```ts
// server/demoSocial/generatePost.ts
import { runJson } from "../demoGenerator/providers";
import type { SocialLang, SocialPost } from "./types";
import { coerceSocialPost, validateSocialPost } from "./validate";

export interface SocialPostInput {
  language: SocialLang;
  companyName: string;
  serviceName: string;
  nicheLabel: string;
  usp: string;
  kb: string;
  area: string;
}

const LANGUAGE_NAME: Record<SocialLang, string> = {
  en: "English",
  nl: "Dutch (informal, 'je', never 'u')",
  pt: "Brazilian Portuguese (você, never European Portuguese)",
};

export function buildSocialPostPrompt(input: SocialPostInput): { system: string; user: string } {
  const lang = LANGUAGE_NAME[input.language];
  const system = `You write one Instagram post for a small local business, the kind the owner posts to get enquiries: "Comment ROOF and we'll DM you".
Return ONLY a JSON object with these keys:
- handle: an Instagram username for the business, lowercase, letters, digits, dots or underscores only, max 30 characters.
- caption: 1 to 3 sentences in ${lang}, written like the owner really posts: names the service and the area, one emoji at most, no hashtags.
- keyword: ONE short word in capitals tied to the service, 3 to 10 letters, easy to type on a phone, in ${lang} (ROOF, KEUKEN, TELHADO).
- cta_line: one sentence in ${lang} telling people to comment the keyword and they will get a DM to arrange the next step. It must contain the keyword exactly.
- dm_opener: the first DM the business sends after someone comments, in ${lang}: thanks them for commenting on the post, says who is writing and from which company, asks how they are. Use the literal tokens {agent_name} and {company_name} instead of names, and put {disclosure_clause} straight after {company_name} with no space. One or two short sentences, casual.
- offer: a short phrase in ${lang} naming what the post offers.
- image_prompt: in English, a realistic photo for this post: the work, the tradesperson or the product in a real local setting, natural light, phone-camera look. It must ask for no text, no logos, no watermarks and no signs.
- likes: an integer between 80 and 2500.`;
  const user = `Business: ${input.companyName}
Service: ${input.serviceName}
Niche: ${input.nicheLabel}
What makes them different: ${input.usp || "(not given)"}
Area: ${input.area || "(not given, keep it general)"}
Knowledge base excerpt:
${(input.kb || "").slice(0, 1500) || "(none)"}`;
  return { system, user };
}

export async function generateSocialPost(
  input: SocialPostInput,
  opts: { provider?: "claude" | "openai"; claudeModel?: "opus" | "sonnet" } = {},
): Promise<SocialPost> {
  const { system, user } = buildSocialPostPrompt(input);
  const { data } = await runJson({
    system,
    user,
    provider: opts.provider ?? "claude",
    claudeModel: opts.claudeModel ?? "sonnet",
    validate: validateSocialPost,
    openai: { model: "gpt-4o-mini", maxTokens: 900, timeoutMs: 30000 },
    stage: "social_post",
  });
  return coerceSocialPost(data);
}
```

Before writing, open `server/demoGenerator/providers.ts` and confirm the exact `runJson` option names and the OpenAI model string other callers pass (search `runJson(` in `server/`); use the same model string as the persona generator.

- [ ] **Step 8: Run both suites**

Run: `node --import tsx --test server/demoSocial/validate.test.ts server/demoSocial/generatePost.test.ts`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add server/demoSocial/types.ts server/demoSocial/validate.ts server/demoSocial/generatePost.ts server/demoSocial/validate.test.ts server/demoSocial/generatePost.test.ts
git commit -m "feat(social-demo): social post generation and validation"
```

---

### Task 5: CRM: post image generation

**Files:**
- Create: `server/demoSocial/image.ts`
- Test: `server/demoSocial/image.test.ts`

**Interfaces:**
- Consumes: `SHOT_DIR` from `server/siteShot.ts` (`path.resolve("uploads/site-shots")`; export it if it is not exported), `OPENAI_API_KEY` (fallback `OPEN_AI_API_KEY`), system `cwebp`.
- Produces:
  - `generateSocialImage(prompt: string, deps?: ImageDeps): Promise<string>`: returns a filename matching `/^[a-f0-9]{16}\.webp$/`, served by the existing `GET /api/site-shot/:file`.
  - `ensureSocialImage(key: string, prompt: string, onDone: (file: string) => Promise<void>, deps?: ImageDeps): Promise<void>`: fire-and-forget safe; one generation per `key` at a time; logs and swallows errors.
  - `interface ImageDeps { fetch: typeof fetch; exec: (cmd: string, args: string[]) => Promise<void>; dir: string; apiKey: string | undefined }`

- [ ] **Step 1: Write the failing tests**

```ts
// server/demoSocial/image.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateSocialImage, ensureSocialImage, type ImageDeps } from "./image";

function deps(over: Partial<ImageDeps> = {}): ImageDeps & { calls: number } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "socimg-"));
  const d = {
    calls: 0,
    dir,
    apiKey: "sk-test",
    fetch: (async () => {
      d.calls++;
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png-bytes").toString("base64") }] }), { status: 200 });
    }) as unknown as typeof fetch,
    exec: async (_cmd: string, args: string[]) => {
      fs.writeFileSync(args[args.indexOf("-o") + 1], "webp-bytes");
    },
    ...over,
  };
  return d;
}

test("returns a 16-hex webp filename in the target dir", async () => {
  const d = deps();
  const file = await generateSocialImage("a roofer", d);
  assert.match(file, /^[a-f0-9]{16}\.webp$/);
  assert.ok(fs.existsSync(path.join(d.dir, file)));
});

test("throws without an API key", async () => {
  await assert.rejects(generateSocialImage("x", deps({ apiKey: undefined })), /OPENAI_API_KEY/);
});

test("throws on an API error", async () => {
  const d = deps({ fetch: (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch });
  await assert.rejects(generateSocialImage("x", d), /500/);
});

test("ensureSocialImage dedups concurrent calls for one key and never throws", async () => {
  const d = deps();
  const done: string[] = [];
  await Promise.all([
    ensureSocialImage("client-a", "p", async (f) => { done.push(f); }, d),
    ensureSocialImage("client-a", "p", async (f) => { done.push(f); }, d),
  ]);
  assert.equal(d.calls, 1);
  assert.equal(done.length, 1);
  const bad = deps({ fetch: (async () => { throw new Error("net"); }) as unknown as typeof fetch });
  await ensureSocialImage("client-b", "p", async () => { throw new Error("should not run"); }, bad);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --import tsx --test server/demoSocial/image.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// server/demoSocial/image.ts
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SHOT_DIR } from "../siteShot";

const execFileAsync = promisify(execFile);

export interface ImageDeps {
  fetch: typeof fetch;
  exec: (cmd: string, args: string[]) => Promise<void>;
  dir: string;
  apiKey: string | undefined;
}

function defaultDeps(): ImageDeps {
  return {
    fetch: globalThis.fetch,
    exec: async (cmd, args) => { await execFileAsync(cmd, args); },
    dir: SHOT_DIR,
    apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
  };
}

const MODEL = "gpt-image-1";

export async function generateSocialImage(prompt: string, deps: ImageDeps = defaultDeps()): Promise<string> {
  if (!deps.apiKey) throw new Error("OPENAI_API_KEY is not set");
  const res = await deps.fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${deps.apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${prompt}. Square photo. No text, no logos, no watermarks, no signs.`,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`image API ${res.status}`);
  const body: any = await res.json();
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error("image API returned no image");
  const png = Buffer.from(b64, "base64");
  const name = crypto.createHash("sha256").update(png).digest("hex").slice(0, 16) + ".webp";
  const tmp = path.join(os.tmpdir(), `social-${name}.png`);
  await fs.mkdir(deps.dir, { recursive: true });
  await fs.writeFile(tmp, png);
  try {
    await deps.exec("cwebp", ["-quiet", "-q", "82", "-resize", "1080", "0", tmp, "-o", path.join(deps.dir, name)]);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return name;
}

const inFlight = new Map<string, Promise<void>>();

export function ensureSocialImage(
  key: string,
  prompt: string,
  onDone: (file: string) => Promise<void>,
  deps: ImageDeps = defaultDeps(),
): Promise<void> {
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      const file = await generateSocialImage(prompt, deps);
      await onDone(file);
    } catch (err) {
      console.error("[social-demo] image generation failed", key, (err as Error).message);
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}
```

If `SHOT_DIR` is not exported from `server/siteShot.ts`, add `export` to its declaration (line 13) and nothing else.

Check the current OpenAI image model name before committing (the API may list a newer default than `gpt-image-1`); keep `MODEL` as the single place to change it.

- [ ] **Step 4: Run the tests**

Run: `node --import tsx --test server/demoSocial/image.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: One real call (costs about $0.04)**

Run: `node --env-file=.env --import tsx -e 'import("./server/demoSocial/image.ts").then(async m=>console.log(await m.generateSocialImage("A bakery counter with fresh sourdough loaves, morning light")))'`
Expected: prints a filename; `ls uploads/site-shots/<file>` exists; open `https://app.leadawaker.com/api/site-shot/<file>` and look at it. Delete the file afterwards.

- [ ] **Step 6: Commit**

```bash
git add server/demoSocial/image.ts server/demoSocial/image.test.ts server/siteShot.ts
git commit -m "feat(social-demo): generate post images via OpenAI Images and cwebp"
```

---

### Task 6: CRM: store the post on the Client and mint socials links

**Files:**
- Create: `server/demoSocial/clientStore.ts`, `server/demoSocial/context.ts`
- Test: `server/demoSocial/clientStore.test.ts`, `server/demoSocial/context.test.ts`
- Modify: `server/demo-session.ts:863-870` (`SERVICE_DEMO_CAMPAIGN_IDS`)
- Modify: `server/routes/demo.ts` (`service` enum at ~574; create-link body after `demoClientToContext`, before `demoNiche = JSON.stringify(ctx)`)
- Modify: `server/demo-clients.ts` (`demoClientToEditable`, line ~480)

**Interfaces:**
- Consumes: `generateSocialPost` (Task 4), `ensureSocialImage` (Task 5), `getDemoClient(niche)` and `ClientRow` from `server/demo-clients.ts`, `db` + `nicheVocabulary`.
- Produces:
  - `clientStore.ts`: `upsertLangSlot(existing: SocialPostByLang | null | undefined, lang: SocialLang, post: SocialPost): SocialPostByLang` (pure); `getClientSocialPost(row: ClientRow, lang: SocialLang): SocialPost | null`; `saveClientSocialPost(niche: string, lang: SocialLang, post: SocialPost): Promise<void>`; `setClientSocialImage(niche: string, file: string): Promise<void>`; `ensureClientSocialPost(row: ClientRow, lang: SocialLang, ctx: Record<string, unknown>): Promise<SocialPost>` (reuse or generate + save, and kick the image if the row has none).
  - `context.ts`: `socialContextFields(post: SocialPost): { social_post: PublicSocialPost; social_dm_opener: string; lead_source: "social_comment"; social_context: string; enquiry_context: string }`
  - `demoClientToEditable` gains `socialPost: SocialPostByLang | null` and `socialImage: string | null`.

- [ ] **Step 1: Write the failing pure tests**

```ts
// server/demoSocial/clientStore.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { upsertLangSlot } from "./clientStore";

const post = (keyword: string) => ({
  handle: "h", caption: "c", keyword, cta_line: `x ${keyword}`, dm_opener: "{agent_name} {company_name}",
  offer: "o", image_prompt: "i", likes: 100,
});

test("adds a language without touching the others", () => {
  const next = upsertLangSlot({ en: post("ROOF") }, "pt", post("TELHADO"));
  assert.equal(next.en?.keyword, "ROOF");
  assert.equal(next.pt?.keyword, "TELHADO");
});

test("works from null", () => {
  assert.deepEqual(Object.keys(upsertLangSlot(null, "nl", post("DAK"))), ["nl"]);
});

test("replaces the same language", () => {
  assert.equal(upsertLangSlot({ nl: post("DAK") }, "nl", post("DAKEN")).nl?.keyword, "DAKEN");
});
```

```ts
// server/demoSocial/context.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { socialContextFields } from "./context";

const post = {
  handle: "dakwerk.utrecht", caption: "Lekkage na de storm?", keyword: "DAK",
  cta_line: "Reageer DAK en we sturen je een DM.", dm_opener: "Hoi! Met {agent_name} van {company_name}.",
  offer: "dakreparatie", image_prompt: "SECRET PROMPT", likes: 300,
};

test("public post hides the image prompt and opener", () => {
  const f = socialContextFields(post);
  assert.equal("image_prompt" in f.social_post, false);
  assert.equal("dm_opener" in f.social_post, false);
  assert.equal(f.social_post.keyword, "DAK");
});

test("engine keys are flat and carry the post", () => {
  const f = socialContextFields(post);
  assert.equal(f.lead_source, "social_comment");
  assert.equal(f.social_dm_opener, post.dm_opener);
  assert.match(f.social_context, /DAK/);
  assert.match(f.social_context, /Lekkage na de storm/);
  assert.match(f.social_context, /dakreparatie/);
  assert.match(f.enquiry_context, /DAK/);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --import tsx --test server/demoSocial/clientStore.test.ts server/demoSocial/context.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `context.ts`**

```ts
// server/demoSocial/context.ts
import type { PublicSocialPost, SocialPost } from "./types";

// English on purpose: it is prompt context, and prompt 108 is written in English
// with {language} deciding the reply language.
export function socialContextFields(post: SocialPost) {
  const { image_prompt: _ip, dm_opener, ...rest } = post;
  const social_post: PublicSocialPost = rest;
  const social_context =
    `They commented "${post.keyword}" on your Instagram post offering ${post.offer}.\n` +
    `The post said: "${post.caption}"\n` +
    `Under it: "${post.cta_line}"`;
  return {
    social_post,
    social_dm_opener: dm_opener,
    lead_source: "social_comment" as const,
    social_context,
    enquiry_context: `Commented ${post.keyword} on the Instagram post offering ${post.offer}.`,
  };
}
```

- [ ] **Step 4: Implement `clientStore.ts`**

```ts
// server/demoSocial/clientStore.ts
import { eq } from "drizzle-orm";
import { db } from "../db";
import { nicheVocabulary, type SocialPostByLang } from "@shared/schema";
import type { ClientRow } from "../demo-clients";
import { generateSocialPost } from "./generatePost";
import { ensureSocialImage } from "./image";
import type { SocialLang, SocialPost } from "./types";

export function upsertLangSlot(
  existing: SocialPostByLang | null | undefined,
  lang: SocialLang,
  post: SocialPost,
): SocialPostByLang {
  return { ...(existing ?? {}), [lang]: post };
}

export function getClientSocialPost(row: ClientRow, lang: SocialLang): SocialPost | null {
  return (row.socialPost as SocialPostByLang | null)?.[lang] ?? null;
}

export async function saveClientSocialPost(niche: string, lang: SocialLang, post: SocialPost): Promise<void> {
  const [row] = await db.select({ socialPost: nicheVocabulary.socialPost })
    .from(nicheVocabulary).where(eq(nicheVocabulary.niche, niche)).limit(1);
  await db.update(nicheVocabulary)
    .set({ socialPost: upsertLangSlot(row?.socialPost as SocialPostByLang | null, lang, post) })
    .where(eq(nicheVocabulary.niche, niche));
}

export async function setClientSocialImage(niche: string, file: string): Promise<void> {
  await db.update(nicheVocabulary).set({ socialImagePath: file }).where(eq(nicheVocabulary.niche, niche));
}

export function startClientSocialImage(niche: string, prompt: string): void {
  void ensureSocialImage(niche, prompt, (file) => setClientSocialImage(niche, file));
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  return "";
}

/** Reuse the Client's post for this language, or generate and save it. The
 *  image is started in the background whenever the Client has none. */
export async function ensureClientSocialPost(
  row: ClientRow,
  lang: SocialLang,
  ctx: Record<string, unknown>,
): Promise<SocialPost> {
  let post = getClientSocialPost(row, lang);
  if (!post) {
    post = await generateSocialPost({
      language: lang,
      companyName: str(ctx.company_name),
      serviceName: str(ctx.service_name),
      nicheLabel: str(ctx.niche_label) || row.niche,
      usp: str(ctx.usp),
      kb: str(ctx.kb) || str(ctx.business_description),
      area: str(ctx.area),
    });
    await saveClientSocialPost(row.niche, lang, post);
  }
  if (!row.socialImagePath) startClientSocialImage(row.niche, post.image_prompt);
  return post;
}
```

Before writing: check `server/demo-clients.ts` for the actual `db` import path, the `ClientRow` export (line 48, export it if it is only a local `type`), and the ctx key names `demoClientToContext` produces (line 524) for company, service, niche label, usp and kb. Rename the `ctx.*` reads above to those exact keys.

- [ ] **Step 5: Run the pure tests**

Run: `node --import tsx --test server/demoSocial/clientStore.test.ts server/demoSocial/context.test.ts`
Expected: all PASS. (Importing `clientStore.ts` loads `../db`; if that import fails without env, run with `node --env-file=.env --import tsx --test ...`.)

- [ ] **Step 6: Wire create-link**

`server/demo-session.ts:869`, in both branches: `[60, 67, 68, 69]`.

`server/routes/demo.ts` ~574:

```ts
  service: z.enum(["dbr", "quote", "speed", "widget", "voice", "socials"]).optional(),
```

In the create-link handler, in the `clientNiche` branch, after the companyName/aiDisclosure overrides and `ctx.client_niche = row.niche`, before `demoNiche = JSON.stringify(ctx)`:

```ts
      if (parsed.data.service === "socials") {
        try {
          const post = await ensureClientSocialPost(row, language as SocialLang, ctx);
          Object.assign(ctx, socialContextFields(post));
        } catch (err) {
          console.error("[social-demo] post generation failed", row.niche, (err as Error).message);
          return res.status(502).json({ message: "Could not write the Instagram post. Try again." });
        }
      }
```

And before the `clientNiche` / `niche` branching, refuse socials without a Client:

```ts
    if (parsed.data.service === "socials" && !parsed.data.clientNiche) {
      return res.status(400).json({ message: "Pick a Client for the Instagram demo." });
    }
```

Imports at the top of `server/routes/demo.ts`:

```ts
import { ensureClientSocialPost } from "../demoSocial/clientStore";
import { socialContextFields } from "../demoSocial/context";
import type { SocialLang } from "../demoSocial/types";
```

Use the variable names the handler actually uses (`parsed.data`, `row`, `ctx`, `language`); read lines 582-704 first.

- [ ] **Step 7: Expose it to the editor**

In `demoClientToEditable` (`server/demo-clients.ts` ~480) add:

```ts
    socialPost: (row.socialPost as SocialPostByLang | null) ?? null,
    socialImage: row.socialImagePath || null,
```

- [ ] **Step 8: Live check**

After pm2 reloads (watch `pm2 logs --lines 20 --nostream` for errors), mint through the API as a logged-in agency user. Easiest: Task 11's button once it exists; for now:

Run (replace `<client>` with a Client key from `SELECT niche FROM "p2mxx34fvbf3ll6"."Niche_Vocabulary" WHERE is_demo_client LIMIT 5`, and `<cookie>` with a session cookie from a logged-in browser):
```bash
curl -s -X POST https://app.leadawaker.com/api/demo/create-link -H 'content-type: application/json' -H 'cookie: <cookie>' \
  -d '{"firstName":"Test","language":"nl","campaignId":69,"clientNiche":"<client>","service":"socials","scenario":"inquired"}'
```
Expected: JSON with `demoUrl`. Then:
```bash
node --env-file=.env -e 'const {Client}=require("pg");(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query(`SELECT social_post->'"'"'nl'"'"' AS nl, social_image_path FROM "p2mxx34fvbf3ll6"."Niche_Vocabulary" WHERE niche=$1`,[process.argv[1]]);console.log(r.rows[0]);await c.end()})()' '<client>'
```
Expected: `nl` post present; `social_image_path` set within about a minute. Minting a second time returns fast (reused).

- [ ] **Step 9: Commit**

```bash
git add server/demoSocial/clientStore.ts server/demoSocial/context.ts server/demoSocial/clientStore.test.ts server/demoSocial/context.test.ts server/demo-session.ts server/routes/demo.ts server/demo-clients.ts
git commit -m "feat(social-demo): mint socials links with a per-Client Instagram post"
```

---

### Task 7: CRM: the `/social-demo/:token` page route

**Files:**
- Create: `server/socialDemoPage.ts`, `server/routes/demoSocial.ts`
- Test: `server/socialDemoPage.test.ts`
- Modify: `server/routes/index.ts` (import + `registerDemoSocialRoutes(app)` next to `registerWidgetRoutes(app)` at line 86)

**Interfaces:**
- Consumes: the persona blob (as `loadDemoPersona` in `server/routes/widget.ts:173` reads it; copy that query, do not import the private function), `nicheVocabulary.socialImagePath`/`screenshotPath`, `pool` from `server/db`.
- Produces:
  - `pickPostImage(opts: { socialImage: string | null | undefined; screenshot: string | null | undefined }): string` (pure): `/api/site-shot/<file>` for a valid 16-hex webp, social first, else screenshot, else `""`.
  - `renderSocialDemoHtml(boot: SocialBoot): string` with `interface SocialBoot { token: string; language: "en" | "nl" | "pt"; started: boolean; company: string; agentName: string; post: PublicSocialPost | null; imageUrl: string }`.
  - `registerDemoSocialRoutes(app: Express)`: `GET /social-demo/:token`, static `/social-demo-assets` (from `client/public/social-demo`, `no-cache`), and the Client social-post API (Task 12 adds to it).
  - Client boot object `window.__SOCIAL__` = `SocialBoot`.

- [ ] **Step 1: Write the failing tests**

```ts
// server/socialDemoPage.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPostImage, renderSocialDemoHtml } from "./socialDemoPage";

const post = { handle: "dak", caption: "</script><b>x</b>", keyword: "DAK", cta_line: "Reageer DAK", offer: "o", likes: 3 };

test("pickPostImage prefers the social image, then the screenshot", () => {
  assert.equal(pickPostImage({ socialImage: "0123456789abcdef.webp", screenshot: "fedcba9876543210.webp" }), "/api/site-shot/0123456789abcdef.webp");
  assert.equal(pickPostImage({ socialImage: null, screenshot: "fedcba9876543210.webp" }), "/api/site-shot/fedcba9876543210.webp");
  assert.equal(pickPostImage({ socialImage: "../../etc/passwd", screenshot: "" }), "");
});

test("boot JSON cannot break out of the script tag", () => {
  const html = renderSocialDemoHtml({ token: "abcd1234", language: "nl", started: false, company: "Dak", agentName: "Sarah", post, imageUrl: "" });
  assert.equal(html.includes("</script><b>"), false);
  assert.match(html, /<html lang="nl"/);
  assert.match(html, /noindex/);
});

test("every module in the graph is versioned", () => {
  const html = renderSocialDemoHtml({ token: "abcd1234", language: "en", started: false, company: "", agentName: "", post: null, imageUrl: "" });
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1]);
  for (const target of Object.values(map.imports) as string[]) assert.match(target, /\?v=/);
  assert.ok(map.imports["/premium/demo/transport.js"]);
  assert.ok(map.imports["/social-demo-assets/main.js"]);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --import tsx --test server/socialDemoPage.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `server/socialDemoPage.ts`**

```ts
// server/socialDemoPage.ts
import type { PublicSocialPost } from "./demoSocial/types";

export interface SocialBoot {
  token: string;
  language: "en" | "nl" | "pt";
  started: boolean;
  company: string;
  agentName: string;
  post: PublicSocialPost | null;
  imageUrl: string;
}

const SHOT = /^[a-f0-9]{16}\.webp$/;

export function pickPostImage(opts: { socialImage: string | null | undefined; screenshot: string | null | undefined }): string {
  for (const f of [opts.socialImage, opts.screenshot]) {
    if (f && SHOT.test(f)) return `/api/site-shot/${f}`;
  }
  return "";
}

// Cloudflare caches static paths for hours: version the whole module graph,
// including the reused /premium/demo modules the page imports.
const ASSET_V = Date.now().toString(36);
const MODULES = [
  "/social-demo-assets/main.js",
  "/social-demo-assets/feed.js",
  "/social-demo-assets/dm.js",
  "/social-demo-assets/copy.js",
  "/social-demo-assets/keyword.js",
  "/premium/demo/transport.js",
  "/premium/demo/chat.js",
  "/premium/demo/tracker.js",
  "/premium/demo/recap.js",
  "/premium/demo/confetti.js",
  "/premium/demo/admin.js",
  "/premium/demo/copy.js",
  "/premium/demo/format.js",
  "/premium/demo/icons.js",
];

function importMap(): string {
  const imports: Record<string, string> = {};
  for (const m of MODULES) imports[m] = `${m}?v=${ASSET_V}`;
  return JSON.stringify({ imports });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function renderSocialDemoHtml(boot: SocialBoot): string {
  const bootJson = JSON.stringify(boot).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${esc(boot.language)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(boot.company || "Demo")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Grand+Hotel&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/premium/demo/demo.css?v=${ASSET_V}" />
<link rel="stylesheet" href="/social-demo-assets/social.css?v=${ASSET_V}" />
<script type="importmap">${importMap()}</script>
<script>window.__SOCIAL__ = ${bootJson};</script>
</head>
<body>
<div id="root"></div>
<script type="module" src="/social-demo-assets/main.js"></script>
</body>
</html>`;
}
```

Check before writing: does `demo.css` need to be loaded at all? It carries a global `*` reset and the bubble/tracker/recap styles `chat.js`/`tracker.js`/`recap.js` output. Load it, and let `social.css` (loaded after) override. Also check which modules `chat.js`, `tracker.js`, `recap.js`, `admin.js` import (`grep -h "^import" client/public/premium/demo/{chat,tracker,recap,admin}.js`) and add any missing path to `MODULES`, so the test "every module is versioned" matches reality.

- [ ] **Step 4: Implement the route file**

```ts
// server/routes/demoSocial.ts
import express, { type Express, type Request, type Response } from "express";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { nicheVocabulary } from "@shared/schema";
import { wrapAsync } from "./_helpers";
import { pickPostImage, renderSocialDemoHtml } from "../socialDemoPage";

const LEADS_TABLE = '"p2mxx34fvbf3ll6"."Leads"';
const INTERACTIONS_TABLE = '"p2mxx34fvbf3ll6"."Interactions"';
const LANGS = new Set(["en", "nl", "pt"]);

async function loadPersona(token: string) {
  const { rows } = await pool.query(
    `SELECT demo_niche, language FROM ${LEADS_TABLE}
      WHERE channel_identifier IN ($1, $2) AND demo_niche IS NOT NULL
      ORDER BY created_at DESC NULLS LAST LIMIT 1`,
    [`web-demo:${token}`, `wa-demo:${token}`],
  );
  let persona: Record<string, any> = {};
  try { persona = JSON.parse(String(rows[0]?.demo_niche || "{}")) || {}; } catch { /* none */ }
  const lang = String(rows[0]?.language || "en");
  return { persona, language: (LANGS.has(lang) ? lang : "en") as "en" | "nl" | "pt", found: rows.length > 0 };
}

/** The thread has started once the prospect has sent a DM. The opener alone
 *  does not count: after a restart the engine re-sends it, and the page must
 *  show the feed again. */
async function threadStarted(token: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM ${INTERACTIONS_TABLE} i
       JOIN ${LEADS_TABLE} l ON l.id = i."Leads_id"
      WHERE l.channel_identifier = $1 AND i.direction = 'inbound' LIMIT 1`,
    [`web-demo:${token}`],
  );
  return rows.length > 0;
}

export function registerDemoSocialRoutes(app: Express) {
  app.use("/social-demo-assets", express.static(path.resolve("client/public/social-demo"), {
    setHeaders: (res) => res.set("cache-control", "no-cache"),
  }));

  app.get("/social-demo/:token", wrapAsync(async (req: Request, res: Response) => {
    const token = String(req.params.token || "");
    if (!/^[A-Za-z0-9]{4,64}$/.test(token)) return res.status(400).send("Invalid demo link.");
    const { persona, language, found } = await loadPersona(token);
    if (!found) return res.status(404).send("This demo link does not exist.");

    let socialImage: string | null = null;
    let screenshot: string | null = String(persona.screenshot || "") || null;
    if (persona.client_niche) {
      const [client] = await db
        .select({ socialImagePath: nicheVocabulary.socialImagePath, screenshotPath: nicheVocabulary.screenshotPath })
        .from(nicheVocabulary)
        .where(eq(nicheVocabulary.niche, String(persona.client_niche)))
        .limit(1);
      socialImage = client?.socialImagePath ?? null;
      screenshot = screenshot || client?.screenshotPath || null;
    }

    res.set("content-type", "text/html; charset=utf-8");
    res.set("cache-control", "no-store");
    res.set("x-robots-tag", "noindex, nofollow");
    res.send(renderSocialDemoHtml({
      token,
      language,
      started: await threadStarted(token),
      company: String(persona.company_name || ""),
      agentName: String(persona.agent_name || ""),
      post: persona.social_post ?? null,
      imageUrl: pickPostImage({ socialImage, screenshot }),
    }));
  }));
}
```

Before writing: copy the exact import lines for `db`, `pool`, `wrapAsync` and `nicheVocabulary` from the top of `server/routes/widget.ts`. Confirm the Interactions table name and its `"Leads_id"`/`direction` columns (the engine query in `web_demo_routes.py:377-381` uses exactly these). Confirm which persona key holds the Client key: the create-link handler sets `ctx.client_niche = row.niche`; the widget route reads `persona.raw`. Use whichever `demoClientToContext` output actually carries (check both), falling back from one to the other.

Register in `server/routes/index.ts`:

```ts
import { registerDemoSocialRoutes } from "./demoSocial";
// ...
  registerWidgetRoutes(app);
  registerDemoSocialRoutes(app);
```

- [ ] **Step 5: Run the tests**

Run: `node --import tsx --test server/socialDemoPage.test.ts`
Expected: 3 PASS.

- [ ] **Step 6: Live check**

Create a placeholder `client/public/social-demo/main.js` containing `document.getElementById("root").textContent = JSON.stringify(window.__SOCIAL__);` (Task 9 replaces it). Open `https://app.leadawaker.com/social-demo/<token from Task 6>`.
Expected: the boot JSON with the Dutch post, `started: false`, an `imageUrl`. `/social-demo/zzzz` returns 404, `/social-demo/../x` returns 400.

- [ ] **Step 7: Commit**

```bash
git add server/socialDemoPage.ts server/socialDemoPage.test.ts server/routes/demoSocial.ts server/routes/index.ts client/public/social-demo/main.js
git commit -m "feat(social-demo): server-rendered /social-demo page shell"
```

---

### Task 8: Shared web-demo transport module

**Files:**
- Create: `client/public/premium/demo/transport.js`
- Test: `client/public/premium/demo/transport.test.mjs`

**Interfaces:**
- Consumes: the engine proxy `/api/web-demo/<token>` with suffixes `""` (GET state, lazily creates the lead and opener), `/message` (POST `{text}`), `/restart` (POST `{scenario}`), `/recap` (GET).
- Produces: `createTransport({ token, fetchImpl?, setTimer?, clearTimer?, onState, onRecap, onError }) => { load(): Promise<object>, send(text: string): Promise<void>, restart(scenario?: string|null): Promise<void>, pollSoon(delay?: number): void, stop(): void, getState(): object|null, isPending(): boolean }`. `onState(state, { pending })` fires on every accepted state change; `onRecap(recap)` once per finished conversation; `onError(err)` for fatal errors (404).

Behaviour copied from `main.js` (lines 99-110, 444-477, 716+, 826-878): optimistic visitor bubble on send, `epoch` guard so a stale poll never overwrites fresher state, poll delays 1600 ms while a reply is pending, 6000 ms idle, 15000 ms when done, recap loaded once when done. `load()` is single-flight: two calls return the same promise.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/premium/demo/transport.test.mjs
// Run with: node client/public/premium/demo/transport.test.mjs
import { createTransport } from "./transport.js";

let failed = 0;
function ok(label, cond) { console.log((cond ? "  ok  " : "  FAIL ") + label); if (!cond) failed++; }

function fakeServer() {
  const calls = [];
  let state = { messages: [{ role: "ai", text: "Hi" }], stage: "new", done: false };
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body });
    if (url.endsWith("/message")) {
      const { text } = JSON.parse(opts.body);
      state = { ...state, messages: [...state.messages, { role: "visitor", text }, { role: "ai", text: "reply" }] };
      return new Response("{}", { status: 200 });
    }
    if (url.endsWith("/restart")) {
      state = { messages: [{ role: "ai", text: "Hi again" }], stage: "new", done: false };
      return new Response("{}", { status: 200 });
    }
    if (url.endsWith("/recap")) return new Response(JSON.stringify({ summary: "S", brief: [] }), { status: 200 });
    return new Response(JSON.stringify(state), { status: 200 });
  };
  return { calls, fetchImpl, setDone() { state = { ...state, done: true }; } };
}

const manualTimers = () => {
  let queue = [];
  return {
    setTimer: (fn, ms) => { const t = { fn, ms }; queue.push(t); return t; },
    clearTimer: (t) => { queue = queue.filter((x) => x !== t); },
    async flush() { const q = queue; queue = []; for (const t of q) await t.fn(); await new Promise((r) => setTimeout(r, 0)); },
    delays: () => queue.map((t) => t.ms),
  };
};

console.log("transport");
{
  const srv = fakeServer(); const tm = manualTimers(); const states = [];
  const tr = createTransport({ token: "abcd1234", fetchImpl: srv.fetchImpl, ...tm, onState: (s, m) => states.push([s, m]), onRecap() {}, onError() {} });
  const [a, b] = [tr.load(), tr.load()];
  ok("load is single-flight", a === b);
  await a;
  ok("one GET for two loads", srv.calls.filter((c) => c.method === "GET").length === 1);
  ok("GET hits the token base", srv.calls[0].url === "/api/web-demo/abcd1234");
  ok("state delivered", states.at(-1)[0].messages.length === 1);

  await tr.send("  hello  ");
  const optimistic = states.find(([s, m]) => m.pending && s.messages.some((x) => x.role === "visitor" && x.text === "hello"));
  ok("optimistic visitor bubble while pending", !!optimistic);
  ok("message POST body trimmed", JSON.parse(srv.calls.find((c) => c.url.endsWith("/message")).body).text === "hello");
  ok("next poll scheduled fast while pending", tm.delays().some((d) => d <= 1600));
  await tm.flush();
  ok("pending cleared once the reply arrives", tr.isPending() === false && tr.getState().messages.length === 3);

  await tr.send("   ");
  ok("blank send is ignored", srv.calls.filter((c) => c.url.endsWith("/message")).length === 1);

  await tr.restart(null);
  ok("restart replaces state", tr.getState().messages[0].text === "Hi again");

  srv.setDone(); await tm.flush();
  ok("done schedules idle poll", tm.delays().includes(15000));
}
{
  let recapCalls = 0;
  const srv = fakeServer(); srv.setDone(); const tm = manualTimers();
  const tr = createTransport({ token: "t0k3n", fetchImpl: srv.fetchImpl, ...tm, onState() {}, onRecap: () => recapCalls++, onError() {} });
  await tr.load(); await tm.flush(); await tm.flush();
  ok("recap loaded exactly once", recapCalls === 1);
}
{
  const tm = manualTimers(); let err = null;
  const fetchImpl = async () => new Response(JSON.stringify({ message: "gone", code: "not_found" }), { status: 404 });
  const tr = createTransport({ token: "gone1", fetchImpl, ...tm, onState() {}, onRecap() {}, onError: (e) => { err = e; } });
  await tr.load().catch(() => {});
  ok("404 reaches onError with status", err && err.status === 404);
}
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
```

- [ ] **Step 2: Run to see it fail**

Run: `node client/public/premium/demo/transport.test.mjs`
Expected: FAIL, cannot find module `./transport.js`.

- [ ] **Step 3: Implement**

```js
// client/public/premium/demo/transport.js
// The web-demo conversation transport, without any DOM. main.js and widget.js
// still carry their own copies; new surfaces use this one.

export function createTransport(opts) {
  const base = "/api/web-demo/" + encodeURIComponent(opts.token);
  const doFetch = opts.fetchImpl || ((u, o) => fetch(u, o));
  const setTimer = opts.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer || ((t) => clearTimeout(t));

  let state = null;
  let pending = false;
  let busy = false;
  let epoch = 0;
  let timer = null;
  let loading = null;
  let recapLoaded = false;
  let stopped = false;

  function api(path, init) {
    return doFetch(base + (path || ""), init).then((r) =>
      r.json().catch(() => ({})).then((body) => {
        if (!r.ok) {
          const e = new Error(body.message || "Request failed");
          e.code = body.code; e.status = r.status;
          throw e;
        }
        return body;
      }));
  }

  function emit() { opts.onState(state, { pending }); }

  function schedule(ms) {
    if (stopped) return;
    if (timer) clearTimer(timer);
    timer = setTimer(poll, ms);
  }

  function nextDelay() { return state && state.done ? 15000 : pending ? 1600 : 6000; }

  function maybeRecap() {
    if (!state || !state.done || recapLoaded) return;
    recapLoaded = true;
    api("/recap").then((r) => opts.onRecap(r || { summary: "", brief: [] }))
      .catch(() => opts.onRecap({ summary: "", brief: [] }));
  }

  function accept(next) {
    const grew = state && next.messages && state.messages && next.messages.length > state.messages.length;
    state = next;
    if (grew) pending = false;
    emit();
    maybeRecap();
  }

  function poll() {
    if (busy) { schedule(1500); return Promise.resolve(); }
    const mine = epoch;
    return api("").then((next) => {
      if (mine !== epoch) { schedule(nextDelay()); return; }
      accept(next);
      schedule(nextDelay());
    }).catch((err) => {
      if (mine === epoch && err && err.status === 404) { opts.onError(err); return; }
      schedule(6000);
    });
  }

  function load() {
    if (loading) return loading;
    loading = api("").then((s) => { accept(s); schedule(nextDelay()); return s; })
      .catch((err) => { loading = null; opts.onError(err); throw err; });
    return loading;
  }

  function send(raw) {
    const text = String(raw || "").trim();
    if (!text || busy || pending || !state || state.done) return Promise.resolve();
    epoch++;
    state = { ...state, messages: [...state.messages, { role: "visitor", text, at: new Date().toISOString() }] };
    pending = true;
    busy = true;
    emit();
    return api("/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }).then(() => { busy = false; schedule(1200); })
      .catch((err) => { busy = false; pending = false; emit(); opts.onError(err); });
  }

  function restart(scenario) {
    if (busy || !state) return Promise.resolve();
    busy = true;
    pending = false;
    recapLoaded = false;
    epoch++;
    return api("/restart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: scenario || null }),
    }).then(() => api("")).then((s) => { busy = false; accept(s); schedule(nextDelay()); })
      .catch((err) => { busy = false; opts.onError(err); });
  }

  return {
    load, send, restart,
    pollSoon(ms) { schedule(ms == null ? 150 : ms); },
    stop() { stopped = true; if (timer) clearTimer(timer); },
    getState: () => state,
    isPending: () => pending,
  };
}
```

Before writing: read `doRestart` fully in `main.js` (from line 716) and mirror what it sends in the restart body and what it does after (if the engine's `/restart` response already returns the new state, use it instead of the extra GET).

- [ ] **Step 4: Run the tests and the existing suite**

Run: `node client/public/premium/demo/transport.test.mjs && node client/public/premium/demo/demo.test.mjs`
Expected: `all passed` for transport; the existing demo suite still passes.

- [ ] **Step 5: Commit**

```bash
git add client/public/premium/demo/transport.js client/public/premium/demo/transport.test.mjs
git commit -m "feat(demo): shared web-demo transport module"
```

---

### Task 9: The page: keyword matching, copy tables, feed, DM view

**Files:**
- Create: `client/public/social-demo/keyword.js`, `copy.js`, `feed.js`, `dm.js`, `main.js` (replaces the Task 7 placeholder), `social.css`
- Test: `client/public/social-demo/social.test.mjs`

**Interfaces:**
- Consumes: `window.__SOCIAL__` (`SocialBoot`, Task 7), `createTransport` (Task 8), `messagesHtml(s, pending, voice, opts)` from `/premium/demo/chat.js`, `trackerHtml(stage, dnc)`, `settleTracker(root)`, `isDnc(s)` from `tracker.js`, `railInlineHtml(opts, lead)` from `recap.js`, `confetti()` from `confetti.js`, `admin.init({ token, getState, reload, restart })`, `admin.bindTrigger()` from `admin.js`, `setLang(lang)` from `/premium/demo/copy.js`.
- Produces:
  - `keyword.js`: `normalize(s: string): string`, `matchesKeyword(comment: string, keyword: string): boolean`
  - `copy.js`: `COPY[lang]` with keys listed below, `STATIC_POSTS[lang]` = `[before, after]`, `INBOX[lang]` = 8 rows, `tr(lang, key)`
  - `feed.js`: `feedHtml({ lang, post, imageUrl, company, comments, hint }): string`
  - `dm.js`: `dmHtml({ lang, company, handle, state, pending, recap, admin, wide, showList }): string`

`copy.js` keys (all three languages): `scrollHint`, `sponsored`, `likes` (with `{n}`), `addComment`, `commentHint` (with `{kw}`), `post`, `noMatch` (with `{kw}`), `dmToast` (with `{handle}`), `direct`, `primary`, `general`, `requests`, `activeNow`, `today`, `message`, `back`, `you`, `demoBy`.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/social-demo/social.test.mjs
// Run with: node client/public/social-demo/social.test.mjs
import { matchesKeyword } from "./keyword.js";
import { COPY, STATIC_POSTS, INBOX } from "./copy.js";
import { feedHtml } from "./feed.js";

let failed = 0;
function ok(label, cond) { console.log((cond ? "  ok  " : "  FAIL ") + label); if (!cond) failed++; }

console.log("keyword (Review Focus 1)");
ok("exact", matchesKeyword("ROOF", "ROOF"));
ok("lower case", matchesKeyword("roof", "ROOF"));
ok("trailing punctuation", matchesKeyword("Roof!!", "ROOF"));
ok("inside a sentence", matchesKeyword("roof please 🙏", "ROOF"));
ok("accents", matchesKeyword("telhádo", "TELHADO"));
ok("keyword typed with accent vs plain", matchesKeyword("telhado", "TELHÁDO"));
ok("not a prefix of another word", !matchesKeyword("roofing", "ROOF"));
ok("wrong word", !matchesKeyword("hello", "ROOF"));
ok("empty", !matchesKeyword("", "ROOF"));

console.log("copy");
const keys = Object.keys(COPY.en);
for (const l of ["nl", "pt"]) {
  ok(`${l} has every key`, keys.every((k) => typeof COPY[l][k] === "string" && COPY[l][k].length > 0));
  ok(`${l} two static posts`, STATIC_POSTS[l].length === 2);
  ok(`${l} eight inbox rows`, INBOX[l].length === 8);
}
ok("pt is Brazilian (no 'equipa'/'contacto')", !/equipa|contacto|pequeno-almoço/.test(JSON.stringify([COPY.pt, STATIC_POSTS.pt, INBOX.pt])));
ok("no em dashes in copy", !/\u2014/.test(JSON.stringify([COPY, STATIC_POSTS, INBOX])));

console.log("feed");
const post = { handle: "dakwerk", caption: "<img src=x onerror=alert(1)>", keyword: "DAK", cta_line: "Reageer DAK", offer: "o", likes: 412 };
const html = feedHtml({ lang: "nl", post, imageUrl: "", company: "Dakwerk", comments: [], hint: false });
ok("caption is escaped", !html.includes("<img src=x"));
ok("three posts", (html.match(/class="ig-post/g) || []).length === 3);
ok("only one live comment input", (html.match(/id="ig-comment"/g) || []).length === 1);
ok("placeholder image when none", html.includes("ig-media--placeholder"));
ok("Dutch chrome", html.includes(COPY.nl.sponsored));

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
```

- [ ] **Step 2: Run to see it fail**

Run: `node client/public/social-demo/social.test.mjs`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `keyword.js`**

```js
// client/public/social-demo/keyword.js
export function normalize(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

// Whole word, anywhere in the comment: "roof please" opens the DM, "roofing" does not.
export function matchesKeyword(comment, keyword) {
  const kw = normalize(keyword).replace(/[^A-Z]/g, "");
  if (!kw) return false;
  const words = normalize(comment).split(/[^A-Z]+/).filter(Boolean);
  return words.includes(kw);
}
```

- [ ] **Step 4: Implement `copy.js`**

Write all three languages natively (not translated line by line). Static posts: each `{ handle, name, avatarLetter, image, caption, likes, sponsored }` with `image` a path under `/social-demo-assets/img/` (Task 10 creates the files). Inbox rows: `{ name, avatar, snippet, time, unread }`.

```js
// client/public/social-demo/copy.js
export const COPY = {
  en: {
    scrollHint: "Scroll down to start the demo",
    sponsored: "Sponsored",
    likes: "{n} likes",
    addComment: "Add a comment...",
    commentHint: "Type {kw} and tap Post",
    post: "Post",
    noMatch: "Comment {kw} to get the DM",
    dmToast: "{handle} sent you a message",
    direct: "Direct",
    primary: "Primary",
    general: "General",
    requests: "Requests (1)",
    activeNow: "Active now",
    today: "Today",
    message: "Message...",
    back: "Back",
    you: "you",
    demoBy: "Demo by Lead Awaker",
  },
  nl: {
    scrollHint: "Scroll naar beneden om de demo te starten",
    sponsored: "Gesponsord",
    likes: "{n} vind-ik-leuks",
    addComment: "Voeg een reactie toe...",
    commentHint: "Typ {kw} en tik op Plaatsen",
    post: "Plaatsen",
    noMatch: "Reageer {kw} om de DM te krijgen",
    dmToast: "{handle} heeft je een bericht gestuurd",
    direct: "Direct",
    primary: "Primair",
    general: "Algemeen",
    requests: "Verzoeken (1)",
    activeNow: "Nu actief",
    today: "Vandaag",
    message: "Bericht...",
    back: "Terug",
    you: "jij",
    demoBy: "Demo door Lead Awaker",
  },
  pt: {
    scrollHint: "Role para baixo para começar a demo",
    sponsored: "Patrocinado",
    likes: "{n} curtidas",
    addComment: "Adicione um comentário...",
    commentHint: "Digite {kw} e toque em Publicar",
    post: "Publicar",
    noMatch: "Comente {kw} para receber a DM",
    dmToast: "{handle} enviou uma mensagem",
    direct: "Direct",
    primary: "Principal",
    general: "Geral",
    requests: "Solicitações (1)",
    activeNow: "Online agora",
    today: "Hoje",
    message: "Mensagem...",
    back: "Voltar",
    you: "você",
    demoBy: "Demo por Lead Awaker",
  },
};

export const STATIC_POSTS = {
  en: [
    { handle: "mia.kitchen", avatarLetter: "M", image: "/social-demo-assets/img/post-en-1.webp", caption: "New sourdough crumb shot, we got there 🍞", likes: 327, sponsored: false },
    { handle: "noah.notes", avatarLetter: "N", image: "/social-demo-assets/img/post-en-2.webp", caption: "Sunday desk reset. Coffee first, emails later.", likes: 189, sponsored: false },
  ],
  nl: [
    { handle: "lotte.bakt", avatarLetter: "L", image: "/social-demo-assets/img/post-nl-1.webp", caption: "Eindelijk een zuurdesem met mooie gaatjes 🍞", likes: 214, sponsored: false },
    { handle: "daan.fietst", avatarLetter: "D", image: "/social-demo-assets/img/post-nl-2.webp", caption: "Rondje langs de Vecht vanochtend. Niet verkeerd.", likes: 156, sponsored: false },
  ],
  pt: [
    { handle: "ana.nacozinha", avatarLetter: "A", image: "/social-demo-assets/img/post-pt-1.webp", caption: "Pão de fermentação natural saiu do forno agora 🍞", likes: 402, sponsored: false },
    { handle: "lucas.pedala", avatarLetter: "L", image: "/social-demo-assets/img/post-pt-2.webp", caption: "Pedal de domingo no Ibirapuera, que dia bonito.", likes: 233, sponsored: false },
  ],
};

export const INBOX = {
  en: [
    { name: "Peggy Franklin", avatar: "/social-demo-assets/img/av-en-1.webp", snippet: "omg yes!! dinner friday? 🍝", time: "2h", unread: true },
    { name: "Curtis Simmons", avatar: "/social-demo-assets/img/av-en-2.webp", snippet: "That game last night was insane", time: "5h", unread: true },
    { name: "Edgar Pierce", avatar: "/social-demo-assets/img/av-en-3.webp", snippet: "I'll send you the address now", time: "11h", unread: false },
    { name: "Maxine Diaz", avatar: "/social-demo-assets/img/av-en-4.webp", snippet: "Wait you moved to Melbourne?!", time: "1d", unread: true },
    { name: "William Chapman", avatar: "/social-demo-assets/img/av-en-5.webp", snippet: "Haha yeah the trip was wild", time: "1d", unread: false },
    { name: "Gail Simmons", avatar: "/social-demo-assets/img/av-en-6.webp", snippet: "The kids loved it!! Thanks so much", time: "2d", unread: true },
    { name: "Willie Little", avatar: "/social-demo-assets/img/av-en-7.webp", snippet: "Running 15 min late sorry!", time: "2d", unread: false },
    { name: "Nora Newman", avatar: "/social-demo-assets/img/av-en-8.webp", snippet: "Can you pick up milk on the way?", time: "3d", unread: false },
  ],
  nl: [
    { name: "Sanne de Vries", avatar: "/social-demo-assets/img/av-nl-1.webp", snippet: "Jaaa! Vrijdag uit eten? 🍝", time: "2u", unread: true },
    { name: "Thijs Bakker", avatar: "/social-demo-assets/img/av-nl-2.webp", snippet: "Die wedstrijd gisteren was echt bizar", time: "5u", unread: true },
    { name: "Ruben Visser", avatar: "/social-demo-assets/img/av-nl-3.webp", snippet: "Ik stuur je zo het adres", time: "11u", unread: false },
    { name: "Femke Jansen", avatar: "/social-demo-assets/img/av-nl-4.webp", snippet: "Wacht, woon je nu in Groningen?!", time: "1d", unread: true },
    { name: "Bram Mulder", avatar: "/social-demo-assets/img/av-nl-5.webp", snippet: "Haha ja, die reis was echt top", time: "1d", unread: false },
    { name: "Eva Smit", avatar: "/social-demo-assets/img/av-nl-6.webp", snippet: "De kids vonden het geweldig!! Dankje", time: "2d", unread: true },
    { name: "Jesse de Boer", avatar: "/social-demo-assets/img/av-nl-7.webp", snippet: "Kwartiertje later, sorry!", time: "2d", unread: false },
    { name: "Lieke Meijer", avatar: "/social-demo-assets/img/av-nl-8.webp", snippet: "Neem jij onderweg melk mee?", time: "3d", unread: false },
  ],
  pt: [
    { name: "Juliana Souza", avatar: "/social-demo-assets/img/av-pt-1.webp", snippet: "Simm!! Jantar na sexta? 🍝", time: "2h", unread: true },
    { name: "Rafael Oliveira", avatar: "/social-demo-assets/img/av-pt-2.webp", snippet: "Aquele jogo ontem foi surreal", time: "5h", unread: true },
    { name: "Thiago Lima", avatar: "/social-demo-assets/img/av-pt-3.webp", snippet: "Já te mando o endereço", time: "11h", unread: false },
    { name: "Camila Santos", avatar: "/social-demo-assets/img/av-pt-4.webp", snippet: "Pera, você mudou pra Floripa?!", time: "1d", unread: true },
    { name: "Gustavo Pereira", avatar: "/social-demo-assets/img/av-pt-5.webp", snippet: "Haha sim, a viagem foi demais", time: "1d", unread: false },
    { name: "Beatriz Costa", avatar: "/social-demo-assets/img/av-pt-6.webp", snippet: "As crianças amaram!! Muito obrigada", time: "2d", unread: true },
    { name: "Felipe Rodrigues", avatar: "/social-demo-assets/img/av-pt-7.webp", snippet: "Vou atrasar uns 15 min, desculpa!", time: "2d", unread: false },
    { name: "Larissa Almeida", avatar: "/social-demo-assets/img/av-pt-8.webp", snippet: "Você passa no mercado e pega leite?", time: "3d", unread: false },
  ],
};

export function tr(lang, key, vars) {
  const table = COPY[lang] || COPY.en;
  let s = table[key] ?? COPY.en[key] ?? key;
  for (const [k, v] of Object.entries(vars || {})) s = s.replace("{" + k + "}", String(v));
  return s;
}
```

- [ ] **Step 5: Implement `feed.js`**

Icons are generic outlines (spec C7): heart, speech bubble, paper plane, bookmark, and plain rounded squares for header/tab icons.

```js
// client/public/social-demo/feed.js
import { STATIC_POSTS, tr } from "./copy.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const ICON = {
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  comment: '<path d="M20 12a8 8 0 1 1-3.3-6.5A8 8 0 0 1 20 12zM20 20l-3.3-1.5"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  save: '<path d="M6 3h12v18l-6-5-6 5z"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="4"/>',
};
export function svg(name, size = 24) {
  return `<svg class="ig-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
}

function actions() {
  return `<div class="ig-actions"><span>${svg("heart")}${svg("comment")}${svg("send")}</span>${svg("save")}</div>`;
}

function staticPost(lang, p) {
  return `<article class="ig-post">
    <header class="ig-post-hdr"><span class="ig-avatar ig-avatar--letter">${esc(p.avatarLetter)}</span>
      <span class="ig-handle">${esc(p.handle)}</span><span class="ig-more">•••</span></header>
    <img class="ig-media" src="${esc(p.image)}" alt="" loading="lazy" />
    ${actions()}
    <div class="ig-likes">${esc(tr(lang, "likes", { n: p.likes.toLocaleString(lang) }))}</div>
    <p class="ig-caption"><b>${esc(p.handle)}</b> ${esc(p.caption)}</p>
    <div class="ig-add-comment is-static">${esc(tr(lang, "addComment"))}</div>
  </article>`;
}

function demoPost({ lang, post, imageUrl, company, comments, hint }) {
  const media = imageUrl
    ? `<img class="ig-media" src="${esc(imageUrl)}" alt="" />`
    : `<div class="ig-media ig-media--placeholder"><span>${esc(company || post.handle)}</span></div>`;
  const list = comments.map((c) => `<p class="ig-comment"><b>${esc(c.author)}</b> ${esc(c.text)}</p>`).join("");
  return `<article class="ig-post ig-post--demo" id="ig-demo-post">
    <header class="ig-post-hdr"><span class="ig-avatar ig-avatar--ring">${esc((company || post.handle).slice(0, 1).toUpperCase())}</span>
      <span class="ig-handle">${esc(post.handle)}<small>${esc(tr(lang, "sponsored"))}</small></span><span class="ig-more">•••</span></header>
    ${media}
    ${actions()}
    <div class="ig-likes">${esc(tr(lang, "likes", { n: Number(post.likes).toLocaleString(lang) }))}</div>
    <p class="ig-caption"><b>${esc(post.handle)}</b> ${esc(post.caption)}</p>
    <div class="ig-cta">${esc(post.cta_line)}</div>
    ${list}
    ${hint ? `<p class="ig-hint">${esc(tr(lang, "noMatch", { kw: post.keyword }))}</p>` : ""}
    <form class="ig-comment-form" id="ig-comment-form" autocomplete="off">
      <span class="ig-avatar ig-avatar--me"></span>
      <input id="ig-comment" name="c" maxlength="200" placeholder="${esc(tr(lang, "commentHint", { kw: post.keyword }))}" />
      <button type="submit" class="ig-post-btn">${esc(tr(lang, "post"))}</button>
    </form>
  </article>`;
}

export function feedHtml(opts) {
  const [before, after] = STATIC_POSTS[opts.lang] || STATIC_POSTS.en;
  return `<div class="ig-feed">
    <header class="ig-topbar"><span class="ig-wordmark">Instagram</span><span class="ig-topbar-icons">${svg("square")}${svg("square")}</span></header>
    <div class="ig-scroll-pill" id="ig-scroll-pill">↓ ${esc(tr(opts.lang, "scrollHint"))}</div>
    ${staticPost(opts.lang, before)}
    ${opts.post ? demoPost(opts) : ""}
    ${staticPost(opts.lang, after)}
    <nav class="ig-tabbar">${svg("square")}${svg("square")}${svg("square")}${svg("square")}<span class="ig-avatar ig-avatar--me"></span></nav>
    <div class="ig-demo-by">${esc(tr(opts.lang, "demoBy"))}</div>
  </div>`;
}
```

- [ ] **Step 6: Implement `dm.js`**

```js
// client/public/social-demo/dm.js
import { INBOX, tr } from "./copy.js";
import { esc, svg } from "./feed.js";
import { messagesHtml } from "/premium/demo/chat.js";
import { trackerHtml, isDnc } from "/premium/demo/tracker.js";
import { railInlineHtml } from "/premium/demo/recap.js";

function inboxHtml({ lang, company, handle, lastText }) {
  const rows = (INBOX[lang] || INBOX.en).map((r) => `<li class="ig-row">
      <img class="ig-row-av" src="${esc(r.avatar)}" alt="" loading="lazy" />
      <span class="ig-row-txt"><b class="${r.unread ? "is-unread" : ""}">${esc(r.name)}</b>
        <small>${esc(r.snippet)} · ${esc(r.time)}</small></span>
      ${r.unread ? '<span class="ig-dot"></span>' : ""}
    </li>`).join("");
  return `<aside class="ig-inbox">
    <header class="ig-inbox-hdr"><b>${esc(tr(lang, "direct"))}</b></header>
    <div class="ig-tabs"><span class="is-on">${esc(tr(lang, "primary"))}</span><span>${esc(tr(lang, "general"))}</span><span class="ig-req">${esc(tr(lang, "requests"))}</span></div>
    <ul>
      <li class="ig-row is-active" id="ig-open-thread">
        <span class="ig-row-av ig-avatar--ring">${esc((company || handle).slice(0, 1).toUpperCase())}</span>
        <span class="ig-row-txt"><b>${esc(company || handle)}</b><small>${esc(lastText || "")}</small></span>
      </li>
      ${rows}
    </ul>
  </aside>`;
}

function threadHtml({ lang, company, handle, state, pending, recap, admin, wide }) {
  const railOpts = { done: state.done, recap, quote: state.quote };
  return `<section class="ig-thread">
    <header class="ig-thread-hdr">
      ${wide ? "" : `<button class="ig-back" id="ig-back" aria-label="${esc(tr(lang, "back"))}">‹</button>`}
      <span class="ig-avatar ig-avatar--ring">${esc((company || handle).slice(0, 1).toUpperCase())}</span>
      <span class="ig-thread-name"><b>${esc(company || handle)}</b><small>@${esc(handle)} · ${esc(tr(lang, "activeNow"))}</small></span>
      ${admin ? `<button class="admin-toggle" id="admin-toggle" aria-label="Presenter settings" aria-haspopup="dialog" aria-expanded="false">•••</button>` : ""}
    </header>
    <div class="ig-tracker">${trackerHtml(state.stage, isDnc(state))}</div>
    <div class="ig-stream stream" id="stream">
      <div class="ig-day">${esc(tr(lang, "today"))}</div>
      ${messagesHtml(state, pending, {}, {})}
      ${state.done ? railInlineHtml(railOpts) : ""}
    </div>
    <form class="ig-composer" id="ig-composer" autocomplete="off">
      <input id="msg" maxlength="1000" placeholder="${esc(tr(lang, "message"))}" ${state.done ? "disabled" : ""} />
      <button type="submit" id="send" aria-label="Send">${svg("send", 20)}</button>
    </form>
  </section>`;
}

export function dmHtml(opts) {
  const last = opts.state && opts.state.messages.length ? opts.state.messages[opts.state.messages.length - 1].text : "";
  const list = inboxHtml({ ...opts, lastText: last });
  if (opts.wide) return `<div class="ig-dm is-wide">${list}${threadHtml(opts)}</div>`;
  return `<div class="ig-dm">${opts.showList ? list : threadHtml(opts)}</div>`;
}
```

Before writing: check `messagesHtml`'s third/fourth parameters in `chat.js:109` and pass a voice stub that its code tolerates (read how `main.js:223` builds it; pass `{ playingId: null, elapsed: 0, durations: {}, urls: {} }` if the function reads those). Check how message objects mark AI vs visitor (`role` values) so `social.css` can style `.bubble` classes that `chat.js` emits: `grep -n "class=" client/public/premium/demo/chat.js`.

- [ ] **Step 7: Implement `main.js`**

```js
// client/public/social-demo/main.js
import { createTransport } from "/premium/demo/transport.js";
import { settleTracker } from "/premium/demo/tracker.js";
import { confetti } from "/premium/demo/confetti.js";
import * as admin from "/premium/demo/admin.js";
import { setLang } from "/premium/demo/copy.js";
import { matchesKeyword } from "./keyword.js";
import { feedHtml } from "./feed.js";
import { dmHtml } from "./dm.js";
import { tr } from "./copy.js";

const BOOT = window.__SOCIAL__ || {};
const lang = ["en", "nl", "pt"].includes(BOOT.language) ? BOOT.language : "en";
setLang(lang);
const root = document.getElementById("root");
const post = BOOT.post;

let view = BOOT.started ? "dm" : "feed";
let comments = [];
let hint = false;
let state = null;
let pending = false;
let recap = null;
let showList = false;
let seenStage = null;
let celebrated = false;
let draft = "";

const wide = () => window.matchMedia("(min-width: 900px)").matches;

const transport = createTransport({
  token: BOOT.token,
  onState(s, m) {
    state = s; pending = m.pending;
    if (seenStage && seenStage !== "objective" && s.stage === "objective" && !celebrated) { celebrated = true; confetti(); }
    if (s.stage) seenStage = s.stage;
    render();
  },
  onRecap(r) { recap = r; render(); },
  onError() { /* keep the last good screen; the poll retries */ },
});

admin.init({
  token: BOOT.token,
  getState: () => state,
  reload: () => transport.pollSoon(150),
  restart: (scenario) => transport.restart(scenario).then(() => {
    view = "feed"; comments = []; hint = false; recap = null; celebrated = false; render();
    window.scrollTo(0, 0);
  }),
});

function render() {
  if (view === "feed" || !state) {
    root.innerHTML = feedHtml({ lang, post, imageUrl: BOOT.imageUrl, company: BOOT.company, comments, hint });
    bindFeed();
    return;
  }
  const keepDraft = document.getElementById("msg");
  if (keepDraft) draft = keepDraft.value;
  root.innerHTML = dmHtml({ lang, company: BOOT.company, handle: post ? post.handle : "", state, pending, recap, admin: !!state.admin, wide: wide(), showList });
  bindDm();
}

function bindFeed() {
  const pill = document.getElementById("ig-scroll-pill");
  if (pill) window.addEventListener("scroll", () => pill.classList.add("is-gone"), { once: true, passive: true });
  const form = document.getElementById("ig-comment-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("ig-comment");
    const text = input.value.trim();
    if (!text) return;
    comments.push({ author: tr(lang, "you"), text });
    const hit = matchesKeyword(text, post.keyword);
    hint = !hit;
    render();
    if (hit) openDmSoon();
  });
}

function openDmSoon() {
  const toast = document.createElement("button");
  toast.className = "ig-toast";
  toast.textContent = tr(lang, "dmToast", { handle: post.handle });
  document.body.appendChild(toast);
  let opened = false;
  const open = () => {
    if (opened) return; opened = true; toast.remove();
    transport.load().then(() => { view = "dm"; render(); window.scrollTo(0, 0); });
  };
  toast.addEventListener("click", open);
  setTimeout(open, 2200);
}

function bindDm() {
  const form = document.getElementById("ig-composer");
  const input = document.getElementById("msg");
  if (input) { input.value = draft; input.addEventListener("input", () => { draft = input.value; }); }
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value;
    draft = "";
    transport.send(text);
  });
  const back = document.getElementById("ig-back");
  if (back) back.addEventListener("click", () => { showList = true; render(); });
  const open = document.getElementById("ig-open-thread");
  if (open) open.addEventListener("click", () => { showList = false; render(); });
  const stream = document.getElementById("stream");
  if (stream) stream.scrollTop = stream.scrollHeight;
  settleTracker(root);
  if (state && state.admin) admin.bindTrigger();
}

window.matchMedia("(min-width: 900px)").addEventListener("change", render);

if (view === "dm") transport.load().then(render).catch(() => { view = "feed"; render(); });
else render();
```

Before writing: check `admin.js` for the exact exported names (`init`, `bindTrigger`, `isOpen`) and whether `bindTrigger` must be called after every repaint (main.js calls it in its render path; mirror that). Check `confetti.js` exports `confetti` by that name.

- [ ] **Step 8: Implement `social.css`**

Light Instagram-like theme scoped under `.ig-feed` / `.ig-dm` / `.ig-toast` so `demo.css` bubble styles can be overridden without leaking. Palette tokens on `:root` of the page:

```css
:root {
  --ig-bg: #ffffff;
  --ig-text: #000000;
  --ig-muted: #737373;
  --ig-line: #dbdbdb;
  --ig-soft: #efefef;
  --ig-blue: #0095f6;
  --ig-me: #3797f0;
  --ig-ring: linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5);
}
html, body { background: var(--ig-bg); color: var(--ig-text); margin: 0; min-height: 100dvh; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
#root { display: flex; flex-direction: column; min-height: 100dvh; }

.ig-feed { width: 100%; max-width: 470px; margin: 0 auto; padding-bottom: 72px; }
.ig-topbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: var(--ig-bg); border-bottom: 1px solid var(--ig-line); }
.ig-wordmark { font-family: "Grand Hotel", cursive; font-size: 30px; line-height: 1; }
.ig-topbar-icons { display: flex; gap: 14px; }
.ig-scroll-pill { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 6; padding: 10px 18px; border-radius: 999px; color: #fff; font-weight: 600; background: var(--ig-ring); box-shadow: 0 6px 20px rgba(214, 41, 118, .35); transition: opacity .3s; }
.ig-scroll-pill.is-gone { opacity: 0; pointer-events: none; }
.ig-post { border-bottom: 1px solid var(--ig-line); padding-bottom: 12px; }
.ig-post-hdr { display: flex; align-items: center; gap: 10px; padding: 10px 16px; }
.ig-handle { font-weight: 600; font-size: 14px; display: flex; flex-direction: column; }
.ig-handle small { font-weight: 400; color: var(--ig-muted); font-size: 12px; }
.ig-more { margin-left: auto; color: var(--ig-muted); }
.ig-avatar { width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; background: var(--ig-soft); flex: none; }
.ig-avatar--ring { background: var(--ig-ring); color: #fff; }
.ig-avatar--me { width: 28px; height: 28px; background: var(--ig-ring); }
.ig-media { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; background: var(--ig-soft); }
.ig-media--placeholder { display: flex; align-items: center; justify-content: center; background: var(--ig-ring); color: #fff; font-weight: 700; font-size: 22px; }
.ig-actions { display: flex; justify-content: space-between; padding: 8px 12px 4px; }
.ig-actions span { display: flex; gap: 14px; }
.ig-likes { font-weight: 600; font-size: 14px; padding: 0 16px; }
.ig-caption, .ig-comment { font-size: 14px; margin: 6px 16px; line-height: 1.4; }
.ig-cta { margin: 8px 16px; padding: 10px 12px; border-radius: 10px; background: #eef6ff; border: 1px solid #cfe5ff; font-size: 14px; font-weight: 500; }
.ig-hint { margin: 4px 16px; color: #ed4956; font-size: 13px; }
.ig-add-comment { color: var(--ig-muted); font-size: 14px; margin: 6px 16px; }
.ig-comment-form { display: flex; align-items: center; gap: 10px; margin: 8px 16px 0; padding-top: 8px; border-top: 1px solid var(--ig-line); }
.ig-comment-form input { flex: 1; min-width: 0; border: 0; outline: 0; font-size: 16px; background: transparent; }
.ig-post-btn { border: 0; background: none; color: var(--ig-blue); font-weight: 600; font-size: 14px; }
.ig-tabbar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 470px; display: flex; justify-content: space-around; align-items: center; padding: 10px 0 calc(10px + env(safe-area-inset-bottom)); background: var(--ig-bg); border-top: 1px solid var(--ig-line); }
.ig-demo-by { text-align: center; color: var(--ig-muted); font-size: 11px; padding: 16px 0; }
.ig-toast { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 20; padding: 12px 16px; border: 0; border-radius: 14px; background: #fff; color: var(--ig-text); font-weight: 600; box-shadow: 0 8px 30px rgba(0, 0, 0, .18); animation: ig-drop .35s ease-out; max-width: calc(100vw - 32px); }
@keyframes ig-drop { from { transform: translate(-50%, -30px); opacity: 0; } }

.ig-dm { display: flex; height: 100dvh; min-height: 0; overflow: hidden; }
.ig-inbox { width: 100%; overflow-y: auto; min-height: 0; border-right: 1px solid var(--ig-line); }
.ig-dm.is-wide .ig-inbox { width: 350px; flex: none; }
.ig-inbox-hdr { padding: 20px 20px 8px; font-size: 20px; }
.ig-tabs { display: flex; gap: 20px; padding: 8px 20px; border-bottom: 1px solid var(--ig-line); font-size: 14px; color: var(--ig-muted); }
.ig-tabs .is-on { color: var(--ig-text); font-weight: 600; }
.ig-tabs .ig-req { margin-left: auto; color: var(--ig-blue); font-weight: 600; }
.ig-inbox ul { list-style: none; margin: 0; padding: 0; }
.ig-row { display: flex; align-items: center; gap: 12px; padding: 8px 20px; }
.ig-row.is-active { background: var(--ig-soft); cursor: pointer; }
.ig-row-av { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: none; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; }
.ig-row-txt { display: flex; flex-direction: column; min-width: 0; font-size: 14px; }
.ig-row-txt b { font-weight: 400; }
.ig-row-txt b.is-unread { font-weight: 600; }
.ig-row-txt small { color: var(--ig-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ig-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ig-blue); margin-left: auto; flex: none; }
.ig-thread { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.ig-thread-hdr { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--ig-line); position: relative; }
.ig-thread-name { display: flex; flex-direction: column; font-size: 15px; }
.ig-thread-name small { color: var(--ig-muted); font-size: 12px; }
.ig-back { border: 0; background: none; font-size: 28px; line-height: 1; padding: 0 4px; }
.ig-tracker { padding: 8px 16px; border-bottom: 1px solid var(--ig-line); overflow-x: auto; }
.ig-stream { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
.ig-day { text-align: center; color: var(--ig-muted); font-size: 12px; margin: 8px 0 16px; }
.ig-composer { display: flex; align-items: center; gap: 8px; margin: 12px 16px calc(12px + env(safe-area-inset-bottom)); padding: 6px 8px 6px 16px; border: 1px solid var(--ig-line); border-radius: 22px; }
.ig-composer input { flex: 1; min-width: 0; border: 0; outline: 0; font-size: 16px; background: transparent; }
.ig-composer button { border: 0; background: none; color: var(--ig-blue); }
```

Then add the bubble overrides for the classes `chat.js` actually emits (from the Step 6 grep): AI bubble `background: var(--ig-soft); color: var(--ig-text); border-radius: 22px;` left-aligned; visitor bubble `background: var(--ig-me); color: #fff; border-radius: 22px;` right-aligned; hide any WhatsApp tails/ticks. Keep every rule under `.ig-dm` so the `/demo` page is unaffected (it does not load this file anyway).

- [ ] **Step 9: Run the tests**

Run: `node client/public/social-demo/social.test.mjs && node client/public/premium/demo/transport.test.mjs`
Expected: `all passed` twice. (If `dm.js` is imported by the test in future, note its absolute `/premium/...` imports only resolve in the browser; the test imports only `keyword`, `copy`, `feed`.)

- [ ] **Step 10: Browser check with playwright-cli**

Use the playwright-cli skill. Open `https://app.leadawaker.com/social-demo/<token>` at 390x844 and at 1440x900. Check: three posts, Dutch chrome, image or placeholder, typing the keyword in lowercase with "!" shows the toast, then the DM with the opener; sending a reply shows the typing dots and an AI reply; no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`). Take screenshots; close the browser afterwards (`feedback_pi_resource_hygiene`).

- [ ] **Step 11: Commit**

```bash
git add client/public/social-demo/
git commit -m "feat(social-demo): Instagram-like feed, comment keyword and DM thread page"
```

---

### Task 10: Static feed images and inbox avatars

**Files:**
- Create: `scripts/social-demo/generate-static-images.ts`
- Create: `client/public/social-demo/img/post-{en,nl,pt}-{1,2}.webp`, `client/public/social-demo/img/av-{en,nl,pt}-{1..8}.webp`

**Interfaces:**
- Consumes: `generateSocialImage(prompt, deps)` from Task 5 with `deps.dir` pointed at a temp folder.
- Produces: 30 WebP files at the paths `copy.js` references (posts 1080 px, avatars 112 px).

- [ ] **Step 1: Write the generator**

```ts
// scripts/social-demo/generate-static-images.ts
// Run once with: node --env-file=.env --import tsx scripts/social-demo/generate-static-images.ts
// About $1.50 in image credits. Re-run only for files that are missing.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { generateSocialImage } from "../../server/demoSocial/image";

const OUT = path.resolve("client/public/social-demo/img");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "socstatic-"));

const POSTS: Record<string, string> = {
  "post-en-1": "Close-up of a home-baked sourdough loaf cut open on a floured wooden board, kitchen window light, English home",
  "post-en-2": "A tidy home desk with a laptop, a mug of coffee and a small plant, soft Sunday morning light",
  "post-nl-1": "Home-baked sourdough loaf cut open on a wooden board in a Dutch kitchen, grey daylight through the window",
  "post-nl-2": "A bicycle resting by a quiet Dutch river path with willow trees, early morning",
  "post-pt-1": "Fresh sourdough bread just out of the oven on a kitchen counter in a Brazilian apartment, warm light",
  "post-pt-2": "A bicycle in Ibirapuera park in São Paulo on a sunny Sunday, trees and path",
};

const FACES: Record<string, string[]> = {
  en: ["woman in her 30s, auburn hair", "man in his 40s, short beard", "man in his 50s, glasses", "woman in her 20s, curly dark hair", "man in his 30s, East Asian", "woman in her 40s, blonde", "man in his 60s, grey hair", "woman in her 30s, Black, braids"],
  nl: ["Dutch woman in her 30s, blonde", "Dutch man in his 20s", "Dutch man in his 40s, beard", "Dutch woman in her 20s, brown hair", "Dutch man in his 30s, glasses", "Dutch woman in her 40s", "Dutch man in his 50s", "Dutch woman in her 30s, ponytail"],
  pt: ["Brazilian woman in her 20s, long dark hair", "Brazilian man in his 30s", "Brazilian man in his 40s, beard", "Brazilian woman in her 30s, curly hair", "Brazilian man in his 20s", "Brazilian woman in her 40s", "Brazilian man in his 50s", "Brazilian woman in her 20s, freckles"],
};

async function make(name: string, prompt: string, width: number) {
  const target = path.join(OUT, `${name}.webp`);
  if (fs.existsSync(target)) return console.log("skip", name);
  const file = await generateSocialImage(prompt, {
    fetch: globalThis.fetch,
    exec: async (cmd, args) => { execFileSync(cmd, args); },
    dir: TMP,
    apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
  });
  execFileSync("cwebp", ["-quiet", "-q", "80", "-resize", String(width), "0", path.join(TMP, file), "-o", target]);
  console.log("ok", name);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, prompt] of Object.entries(POSTS)) await make(name, prompt, 1080);
  for (const [lang, faces] of Object.entries(FACES)) {
    for (let i = 0; i < faces.length; i++) {
      await make(`av-${lang}-${i + 1}`, `Casual smartphone profile photo, head and shoulders, ${faces[i]}, friendly, natural light, plain background`, 112);
    }
  }
})();
```

- [ ] **Step 2: Ask Gabriel before running** (a paid external call, about $1.50). On his OK, run it.

Expected: 30 `ok` lines; `ls client/public/social-demo/img | wc -l` prints 30; `du -sh client/public/social-demo/img` well under 2 MB.

- [ ] **Step 3: Look at them.** Open a few in the browser page; replace any uncanny face or text-bearing image by deleting the file and re-running (it skips existing files).

- [ ] **Step 4: Commit**

```bash
git add scripts/social-demo/generate-static-images.ts client/public/social-demo/img/
git commit -m "feat(social-demo): static feed posts and inbox avatars"
```

---

### Task 11: Demos page: the Socials button

**Files:**
- Modify: `client/src/features/demos/services.ts`
- Modify: `client/src/features/demos/components/ProspectDemoPanel.tsx:57`

**Interfaces:**
- Consumes: `/social-demo/<token>` (Task 7), campaign 69.
- Produces: `ServiceDef.socialPage?: boolean`; `socialDemoUrl(demoUrl: string): string`.

- [ ] **Step 1: Edit `services.ts`**

In `ServiceDef`, after `widgetPage?`:

```ts
  /** The Instagram comment-to-DM demo opens its own page (/social-demo/<token>,
   *  specs/social-reply-demo). Pi-only like the widget page. */
  socialPage?: boolean;
```

Replace the socials entry:

```ts
  { key: "socials", labelKey: "services.socials", icon: Instagram, campaignId: 69, scenario: "inquired", socialPage: true },
```

After `widgetDemoUrl`:

```ts
export function socialDemoUrl(demoUrl: string): string {
  return `${window.location.origin}/social-demo/${tokenFromUrl(demoUrl)}`;
}
```

In `serviceCopyUrl` and `serviceOpenUrl`, next to the `widgetPage` line:

```ts
  if (svc.socialPage) return socialDemoUrl(session.demoUrl);
```

In `serviceOf`, after the 68 line:

```ts
  if (session.campaignId === 69) return "socials";
```

- [ ] **Step 2: Edit `ProspectDemoPanel.tsx:57`**

Where it builds the URL for `svc.widgetPage`, add the same branch for `svc.socialPage` using `socialDemoUrl` (import it from `../services`). Read lines 40-125 first and follow the widget branch exactly.

- [ ] **Step 3: Browser check**

With playwright-cli, log in (`reference_app_admin_login`), open the Demos page, pick a Client, choose Nederlands, click Socials. Expected: spinner, then a `/social-demo/<token>` link; opening it shows the feed. Minting again for the same Client is instant. Close the browser.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/demos/services.ts client/src/features/demos/components/ProspectDemoPanel.tsx
git commit -m "feat(demos): Socials service mints Instagram reply demo links"
```

---

### Task 12: Client editor: Social post section

**Files:**
- Modify: `server/routes/demoSocial.ts` (add API routes)
- Create: `client/src/features/campaigns/components/clients/SocialPostSection.tsx`
- Modify: `client/src/features/campaigns/components/clients/ClientEditor.tsx`
- Modify: `client/src/features/campaigns/api/demoClientsApi.ts`
- Modify: `client/src/locales/{en,nl,pt}/campaigns.json` (`clients.social` block)

**Interfaces:**
- Consumes: `saveClientSocialPost`, `startClientSocialImage`, `getDemoClient`, `demoClientToEditable`, `generateSocialPost`, `validateSocialPost`, `coerceSocialPost`, `demoClientToContext`.
- Produces:
  - `PUT /api/demo/clients/:niche/social-post` body `{ language: "en"|"nl"|"pt", post: { caption, keyword, cta_line, dm_opener } }` merges into the existing post for that language (400 when the result fails `validateSocialPost`, 404 when the language has no post yet); returns `{ client }`.
  - `POST /api/demo/clients/:niche/social-post/regenerate` body `{ language, part: "text" | "image" }`; text regenerates and saves that language; image starts `startClientSocialImage` with that language's `image_prompt` and returns 202; returns `{ client }`.
  - Both `requireAuth` + `requireAgency` (same guards as the existing `PATCH /api/demo/clients/:niche`, `server/routes/demo.ts:398`).
  - `demoClientsApi.ts`: `saveSocialPost(niche, language, post)`, `regenerateSocialPost(niche, language, part)`; `EditableClient` type gains `socialPost: Record<string, SocialPostFields> | null` and `socialImage: string | null`.

- [ ] **Step 1: Server routes**

In `registerDemoSocialRoutes`:

```ts
  const langSchema = z.enum(["en", "nl", "pt"]);
  const editSchema = z.object({
    language: langSchema,
    post: z.object({
      caption: z.string().max(400),
      keyword: z.string().max(20),
      cta_line: z.string().max(300),
      dm_opener: z.string().max(400),
    }),
  });

  app.put("/api/demo/clients/:niche/social-post", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const row = await getDemoClient(String(req.params.niche));
    if (!row) return res.status(404).json({ message: "Client not found" });
    const current = getClientSocialPost(row, parsed.data.language);
    if (!current) return res.status(404).json({ message: "No post in this language yet" });
    const merged = { ...current, ...parsed.data.post };
    const problem = validateSocialPost(merged);
    if (problem) return res.status(400).json({ message: problem });
    await saveClientSocialPost(row.niche, parsed.data.language, coerceSocialPost(merged));
    res.json({ client: demoClientToEditable((await getDemoClient(row.niche))!) });
  }));

  app.post("/api/demo/clients/:niche/social-post/regenerate", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const parsed = z.object({ language: langSchema, part: z.enum(["text", "image"]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const row = await getDemoClient(String(req.params.niche));
    if (!row) return res.status(404).json({ message: "Client not found" });
    const { language, part } = parsed.data;
    if (part === "image") {
      const post = getClientSocialPost(row, language);
      if (!post) return res.status(404).json({ message: "No post in this language yet" });
      startClientSocialImage(row.niche, post.image_prompt);
      return res.status(202).json({ client: demoClientToEditable(row) });
    }
    const ctx = demoClientToContext(row, language, "inquired", undefined) ?? {};
    const fresh = await generateSocialPost({
      language,
      companyName: String((ctx as any).company_name || ""),
      serviceName: String((ctx as any).service_name || ""),
      nicheLabel: String((ctx as any).niche_label || row.niche),
      usp: String((ctx as any).usp || ""),
      kb: String((ctx as any).kb || ""),
      area: "",
    });
    await saveClientSocialPost(row.niche, language, fresh);
    res.json({ client: demoClientToEditable((await getDemoClient(row.niche))!) });
  }));
```

Use the same ctx key names as in Task 6 Step 4 (they were checked there). Copy `requireAuth` / `requireAgency` / `z` imports from `server/routes/demo.ts`. Note `startClientSocialImage` dedups per Client via `ensureSocialImage`; the regenerated image replaces `social_image_path` when it finishes, and the page reads it live.

Live check: `curl -X POST .../regenerate` with a session cookie returns 200/202; the DB row updates.

- [ ] **Step 2: API client**

In `client/src/features/campaigns/api/demoClientsApi.ts`, add to the `EditableDemoClient` type (next to `screenshot: string | null;`, line ~87):

```ts
  socialPost: Partial<Record<DemoLang, SocialPostFields>> | null;
  socialImage: string | null;
```

And below `useSetClientScreenshot` (same `apiFetch` + error style it uses):

```ts
export interface SocialPostFields {
  handle: string;
  caption: string;
  keyword: string;
  cta_line: string;
  dm_opener: string;
  offer: string;
  image_prompt: string;
  likes: number;
}

export type SocialPostEdit = Pick<SocialPostFields, "caption" | "keyword" | "cta_line" | "dm_opener">;

async function socialRequest(url: string, method: "PUT" | "POST", body: unknown) {
  const res = await apiFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message || "Request failed");
  return json as { client: EditableDemoClient };
}

export function useSaveSocialPost(niche: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ language, post }: { language: DemoLang; post: SocialPostEdit }) =>
      socialRequest(`/api/demo/clients/${encodeURIComponent(niche)}/social-post`, "PUT", { language, post }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...CLIENTS_KEY, niche] }),
  });
}

export function useRegenerateSocialPost(niche: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ language, part }: { language: DemoLang; part: "text" | "image" }) =>
      socialRequest(`/api/demo/clients/${encodeURIComponent(niche)}/social-post/regenerate`, "POST", { language, part }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...CLIENTS_KEY, niche] }),
  });
}
```

- [ ] **Step 3: `SocialPostSection.tsx`**

Same card look as `ClientScreenshot.tsx` (`neu-raised`, `eyebrow wine`, `la-btn la-btn--soft`, tokens only). It has its own Save button rather than joining the editor's autosave draft, so a half-typed keyword never reaches the server validator mid-word.

```tsx
// client/src/features/campaigns/components/clients/SocialPostSection.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, RefreshCw, Save } from "lucide-react";
import { API_BASE } from "@/lib/apiUtils";
import {
  CLIENTS_KEY,
  type DemoLang,
  type SocialPostEdit,
  type SocialPostFields,
  useRegenerateSocialPost,
  useSaveSocialPost,
} from "../../api/demoClientsApi";

const LANGS: DemoLang[] = ["en", "nl", "pt"];
const EMPTY: SocialPostEdit = { caption: "", keyword: "", cta_line: "", dm_opener: "" };

export function SocialPostSection({
  niche,
  socialPost,
  socialImage,
}: {
  niche: string;
  socialPost: Partial<Record<DemoLang, SocialPostFields>> | null;
  socialImage: string | null;
}) {
  const { t } = useTranslation("campaigns");
  const qc = useQueryClient();
  const save = useSaveSocialPost(niche);
  const regen = useRegenerateSocialPost(niche);
  const [lang, setLang] = useState<DemoLang>("en");
  const current = socialPost?.[lang] ?? null;
  const [draft, setDraft] = useState<SocialPostEdit>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setDraft(current ? { caption: current.caption, keyword: current.keyword, cta_line: current.cta_line, dm_opener: current.dm_opener } : EMPTY);
    setError(null);
  }, [lang, current?.caption, current?.keyword, current?.cta_line, current?.dm_opener]);

  // After "Regenerate image" the server answers 202 and works in the background:
  // refetch every 5s until the file name changes, for at most 2 minutes.
  useEffect(() => {
    if (waitingFor === undefined) return;
    if (socialImage !== waitingFor) { setWaitingFor(undefined); return; }
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 120_000) { clearInterval(id); setWaitingFor(undefined); return; }
      qc.invalidateQueries({ queryKey: [...CLIENTS_KEY, niche] });
    }, 5000);
    return () => clearInterval(id);
  }, [waitingFor, socialImage, niche, qc]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : t("clients.social.failed", "Something went wrong.")); }
  };

  const dirty = current !== null && (Object.keys(EMPTY) as (keyof SocialPostEdit)[]).some((k) => draft[k] !== current[k]);
  const busy = save.isPending || regen.isPending;

  const field = (key: keyof SocialPostEdit, label: string, rows: number, help?: string) => (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginBottom: 4 }}>{label}</span>
      <textarea
        className="la-input"
        rows={rows}
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        style={{ width: "100%", resize: "vertical" }}
      />
      {help && <span style={{ display: "block", fontSize: 11, color: "var(--mute-2)", marginTop: 4 }}>{help}</span>}
    </label>
  );

  return (
    <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
      <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.social.title", "Instagram post")}</div>
      <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
        {t("clients.social.hint", "The post the Instagram demo is built around. Written the first time a Socials link is minted in a language.")}
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: 160, height: 160, borderRadius: "var(--r-surface)", overflow: "hidden", flexShrink: 0, background: "var(--card)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {socialImage ? (
            <img src={`${API_BASE}/api/site-shot/${socialImage}`} alt={t("clients.social.title", "Instagram post")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 12, color: "var(--mute-2)", textAlign: "center", padding: 8 }}>
              {waitingFor !== undefined ? t("clients.social.imagePending", "Generating the image...") : t("clients.social.noImage", "No image yet")}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {LANGS.map((l) => (
              <button key={l} type="button" className={`la-btn ${l === lang ? "la-btn--primary" : "la-btn--soft"}`} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {current ? (
            <>
              {field("caption", t("clients.social.caption", "Caption"), 3)}
              {field("keyword", t("clients.social.keyword", "Comment word"), 1)}
              {field("cta_line", t("clients.social.cta", "Comment line under the post"), 2)}
              {field("dm_opener", t("clients.social.opener", "First DM"), 2, t("clients.social.openerHelp", "Keep {agent_name} and {company_name} in the text."))}
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--mute)", marginBottom: 12 }}>
              {t("clients.social.none", "No Instagram post in this language yet.")}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {current && (
              <button type="button" className="la-btn la-btn--soft" disabled={!dirty || busy}
                onClick={() => void run(() => save.mutateAsync({ language: lang, post: draft }))}>
                {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {t("clients.social.save", "Save")}
              </button>
            )}
            <button type="button" className="la-btn la-btn--soft" disabled={busy}
              onClick={() => void run(() => regen.mutateAsync({ language: lang, part: "text" }))}>
              {regen.isPending && regen.variables?.part === "text" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {current ? t("clients.social.regenerateText", "Rewrite text") : t("clients.social.writeNow", "Write it now")}
            </button>
            {current && (
              <button type="button" className="la-btn la-btn--soft" disabled={busy || waitingFor !== undefined}
                onClick={() => void run(async () => { await regen.mutateAsync({ language: lang, part: "image" }); setWaitingFor(socialImage); })}>
                <ImageIcon size={13} />
                {t("clients.social.regenerateImage", "New image")}
              </button>
            )}
          </div>
          {error && <p style={{ marginTop: 10, fontSize: 12, color: "var(--danger, #B3261E)" }}>{error}</p>}
        </div>
      </div>
    </section>
  );
}
```

Before writing: confirm `CLIENTS_KEY` is exported from `demoClientsApi.ts` (export it if not), and that `la-input` and `la-btn--primary` exist (`grep -rn "la-btn--primary\|\.la-input" client/src/styles`); if a class is missing, use what `ClientEditor.tsx` uses for its own text inputs and active tabs.

Mount it in `ClientEditor.tsx` right after line 341:

```tsx
      <SocialPostSection niche={niche} socialPost={client?.socialPost ?? null} socialImage={client?.socialImage ?? null} />
```

with `import { SocialPostSection } from "./SocialPostSection";` next to the `ClientScreenshot` import.

i18n: add a `clients.social` block to `client/src/locales/{en,nl,pt}/campaigns.json` (next to the existing `clients.shot` block) with the keys used above: `title`, `hint`, `caption`, `keyword`, `cta`, `opener`, `openerHelp`, `none`, `save`, `regenerateText`, `writeNow`, `regenerateImage`, `noImage`, `imagePending`, `failed`. English values = the defaults above. Dutch uses "je" (e.g. `openerHelp`: "Laat {agent_name} en {company_name} in de tekst staan."), Portuguese is Brazilian (e.g. `none`: "Ainda não há post do Instagram neste idioma."). Escape `{agent_name}` for i18next if the project's interpolation would try to replace it: check whether other locale strings contain literal braces and how they are written.

- [ ] **Step 4: Browser check**

With playwright-cli: open the Client in the editor, see the post and image, change the keyword to `DAKEN`, save, reload: persisted; open the socials demo link minted after the edit: the new keyword works. Try saving a keyword of `X`: inline error. Close the browser.

- [ ] **Step 5: Commit**

```bash
git add server/routes/demoSocial.ts client/src/features/campaigns/components/clients/SocialPostSection.tsx client/src/features/campaigns/components/clients/ClientEditor.tsx client/src/features/campaigns/api/demoClientsApi.ts client/src/locales
git commit -m "feat(clients): edit and regenerate a Client's Instagram post"
```

---

### Task 13: Chats page: the Instagram conversation type

**Files:**
- Modify: `client/src/features/leads/components/conversationType.ts`
- Modify: `client/src/features/leads/components/LeadsToolbarMenus.tsx:62-66`, `client/src/features/leads/components/LeadsListPanel.tsx:206-219` (only if they list the types explicitly rather than mapping `CONVERSATION_TYPES`)
- Modify: `client/src/locales/{en,nl,pt}/leads.json` (`conversationType` block, lines 2-8)
- Test: `client/src/features/leads/components/conversationType.test.ts`

**Interfaces:**
- Produces: `ConversationType` gains `"instagram"`; `getConversationType` returns it for leads on a campaign with `campaignType === "social_reply"`.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/features/leads/components/conversationType.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getConversationType, CONVERSATION_TYPES } from "./conversationType";

const campaigns = new Map([[69, { campaignType: "social_reply" }], [67, { campaignType: "speed_to_lead" }]]);

test("social_reply campaign leads are instagram", () => {
  assert.equal(getConversationType({ Campaigns_id: 69, channel_identifier: "web-demo:abc" }, campaigns), "instagram");
});

test("instagram is a listed type", () => {
  assert.ok(CONVERSATION_TYPES.includes("instagram"));
});

test("existing types unchanged", () => {
  assert.equal(getConversationType({ Source: "Website Chat" }, campaigns), "widget");
  assert.equal(getConversationType({ Campaigns_id: 67 }, campaigns), "dbr");
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --import tsx --test client/src/features/leads/components/conversationType.test.ts`
Expected: FAIL on the first two tests.

- [ ] **Step 3: Implement**

```ts
export type ConversationType = "widget" | "voice" | "dbr" | "instagram" | "other";

export const CONVERSATION_TYPES: ConversationType[] = ["widget", "voice", "dbr", "instagram", "other"];
```

In `getConversationType`, before the reactivation/speed_to_lead line:

```ts
  if (campaignType === "social_reply") return "instagram";
```

Update the header comment's type list with `instagram = Instagram comment-to-DM demo`.

`leads.json` `conversationType` block: `"instagram": "Instagram"` in en, nl and pt.

If `LeadsToolbarMenus.tsx` / `LeadsListPanel.tsx` hardcode the four types, add `instagram` the same way; if they map `CONVERSATION_TYPES`, no change.

- [ ] **Step 4: Run the test**

Run: `node --import tsx --test client/src/features/leads/components/conversationType.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Browser check**

Chats page, type filter: "Instagram" option; selecting it shows the thread from Task 9's browser check. Open it: the messages are there and owner takeover works like on other web-demo leads.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/leads/components/conversationType.ts client/src/features/leads/components/conversationType.test.ts client/src/features/leads/components/LeadsToolbarMenus.tsx client/src/features/leads/components/LeadsListPanel.tsx client/src/locales/en/leads.json client/src/locales/nl/leads.json client/src/locales/pt/leads.json
git commit -m "feat(chats): Instagram conversation type for social reply demo threads"
```

---

### Task 14: End-to-end acceptance and conversation quality

**Files:**
- Modify: `specs/social-reply-demo/requirements.md` (status line)
- Create: `specs/social-reply-demo/action-required.md`

- [ ] **Step 1: Run the spec's acceptance list (requirements.md, "Acceptance" 1-8)** with playwright-cli, one Client, all three languages. For each item, record pass/fail with a screenshot path.

- [ ] **Step 2: First-reply notification (spec E3).** After a real reply on a fresh socials link, check the notification arrived (`server/demo-reply-notifier.ts` polls every 60 s; check Gabriel's notifications list or the `demo_replied` row). Do not assume it works.

- [ ] **Step 3: Conversation quality.** For 3 different Clients (niches) in each of `en`, `nl`, `pt`, run a short conversation on the real page (comment, then 4 to 6 replies as a warm lead: "yes, I have a leak", a price question, "can you come Thursday"). Check across all 9 runs, not per run (`feedback_never_tune_prompts_against_one_sample`):
  - the first AI reply picks up the post's offer and does not ask why they got in touch;
  - messages are short, one question each;
  - language is right (Brazilian Portuguese for `pt`);
  - booking offers slots and books.
  Record results in `action-required.md`. If a pattern fails in most runs, write it up as a finding for Gabriel with 2 or 3 examples; do not edit prompt 108 in this task.

- [ ] **Step 4: Regression check for 67 and 68.** Mint one Speed to Lead link and one widget link; run two turns each. Their openers and replies must look like before (no Instagram wording).

- [ ] **Step 5: Write `action-required.md`** with: campaign id used, the acceptance results, the quality findings, and follow-ups: move `main.js` and `widget.js` onto `transport.js`; decide on a separate prompt only if Step 3 found a consistent gap.

- [ ] **Step 6: Mark the spec built and commit**

Change the status line in `requirements.md` to `**Status:** built <today's date as YYYY-MM-DD>, see action-required.md.`

```bash
git add specs/social-reply-demo/
git commit -m "docs(social-demo): acceptance results and follow-ups"
```
