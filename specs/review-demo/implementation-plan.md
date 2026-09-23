# Review Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A two-phone Reputation demo page (customer chat with SMS/WhatsApp skins, manager lock screen) that runs on the real engine, plus the engine rewrite that turns the reputation reply into a multi-turn AI conversation.

**Architecture:** The page talks to the existing browser-demo path (`/api/web-demo/<token>` in Express, proxied to `src/webhooks/web_demo_routes.py` in the engine, which feeds `process_inbound`). A new demo campaign with `campaign_type='reputation'` makes `inbound_handler` Step 11.6 route those turns to `reputation_handler.handle_reply`, which is rewritten around a pure, unit-tested turn function. The web-demo state gains a `reputation` block that drives the manager phone.

**Tech Stack:** Python 3 + FastAPI + asyncpg + pytest (engine, `/home/gabriel/automations`), Express + Drizzle (CRM server), React + TypeScript + Tailwind + framer-motion (CRM client).

**Spec:** `specs/review-demo/requirements.md`

## Global Constraints

- Two repos. Engine: `/home/gabriel/automations` (not file-watched: run `pm2 restart leadawaker-engine` after engine edits). CRM: `/home/gabriel/LeadAwakerApp` (`server/` and `shared/` auto-reload via pm2 watch; client is served live by the dev server at `app.leadawaker.com`).
- Never run `npm run dev`. Never run `npx tsc` unless Gabriel asks. Never use `process.exit()` in server handlers.
- Engine tests: `cd /home/gabriel/automations && .venv/bin/pytest <path> -v`. The client has no test runner; client tasks are verified with `playwright-cli` against `https://app.leadawaker.com` (login `leadawaker@gmail.com` / `Admin1234`). Always close the playwright browser afterwards.
- DB schema is `p2mxx34fvbf3ll6`. Schema changes go through a direct `pg` script run with `node --env-file=.env` (`db:push` needs a TTY). Leads columns use snake_case; `"Conversion_Status"`, `"Campaigns_id"`, `"Accounts_id"`, `"Source"` are quoted PascalCase.
- The review URL is never written by the model. Code appends it. Every customer who gives a rating of 4 or less is offered the public review link in the same reply. (Spec: "Compliance lives in code, not the prompt".)
- Demo leads (`channel_identifier` starting `web-demo:` or `wa-demo:`) never alert a real manager and always use `https://g.page/r/demo-business/review` as the review link.
- Page copy lives in `client/src/features/reviewDemo/copy.ts` (EN/NL/PT-BR), not react-i18next: the page's language belongs to the link, like `features/voiceDemo/copy.ts`. Portuguese is always Brazilian.
- iMessage and WhatsApp colours in the chat skins are hard-coded on purpose (they are mockups of other apps). Everything else on the page uses Tailwind classes; no `bg-white`/`text-black` outside the skins and the Google popup mockup.
- No em dashes in code comments, copy, or commit messages.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The engine repo commits separately from the CRM repo.

## Deviations from the spec (decided while planning, from reading the code)

1. **Opener:** no reputation branch in `demo_recap.render_demo_first_message`. That function already renders the campaign's `First_Message` with the persona overlaid for any campaign in `PERSONA_DEMO_CAMPAIGN_IDS`, so the new campaign only needs an authored `First_Message` and a place in that list.
2. **Customer name:** the opener uses the first name typed when the link is minted (the prospect sees their own name as the customer), not a fixed per-language name. Nothing to build.
3. **Demo review link:** a constant in the engine for demo leads, not a value configured on Account 52. Real accounts keep using `Accounts.google_review_url`.
4. **Manager alert for demo leads:** skipped in code. `_resolve_alert_user_id` falls back to the account owner, so an empty `reputation_alert_target` would still have alerted Gabriel.
5. **Handoff:** `manual_takeover` is set when the customer accepts the callback, not when the rating is low, so the AI can still answer "yes, send the link". Demo restart already resets `manual_takeover`.
6. **Prompt:** one English system prompt with a `{language_name}` instruction plus a `Prompt_Library` override hook (`use_case='reputation_conversation'`), instead of three language copies. The short templates that code appends (public invite, referral ask) get Brazilian Portuguese versions.
7. **Actions:** `continue | send_review_link | offer_callback | callback_accepted | close` (`offer_review` folded into `continue`; `callback_accepted` added so the handoff has a trigger).

## Review Focus

1. **Stale rating after Replay.** A restarted demo must start with no rating, or the manager phone shows last run's alert and the ≤4 invite rule never fires. Pinned in Task 4 (restart clears `review_rating`/`review_outcome`) and Task 9 (Replay check).
2. **Model writes its own link or a fake URL.** Any `http(s)://` in the model reply is stripped before code appends the real one. Pinned in Task 1 (`test_model_written_url_is_stripped`).
3. **Model returns prose or broken JSON.** The raw text is used as the reply with `action=continue`, never a crash and never a silent turn. Pinned in Task 1 (`test_parse_garbage_falls_back_to_raw_text`).
4. **Low rating given in the same message as the first answer** (for example "3, the crew was late"). The invite must still be appended on that turn even if the model forgets. Pinned in Task 1 (`test_low_rating_forces_invite_even_when_model_says_continue`).
5. **Customer asks for the link twice.** A second `send_review_link` resends it rather than going quiet. Pinned in Task 1 (`test_send_review_link_again_resends`).

---

## File Structure

Engine (`/home/gabriel/automations`):
- Create `src/automations/reputation_conversation.py`: pure turn logic (parse model output, apply compliance, derive outcome). No I/O.
- Modify `src/automations/reputation_prompts.py`: add PT, add `DEFAULT_CONVERSATION_PROMPT`, delete the single-shot templates and classifier prompt.
- Modify `src/automations/reputation_handler.py`: `handle_reply` becomes one conversation turn built on the pure module.
- Modify `src/automations/review_drafter.py`: expose `draft_reply_text(...)` so the demo can draft a reply without a DB row.
- Modify `src/webhooks/web_demo_routes.py`: `reputation` block in state, `POST /{token}/review-draft`.
- Modify `src/webhooks/demo_commands.py`: restart clears the two new lead fields.
- Modify `src/automations/demo_campaigns.py`: add the new campaign id.
- Create tests: `tests/test_reputation_conversation.py`, `tests/test_reputation_handler.py`, `tests/test_web_demo_reputation_state.py`.

CRM (`/home/gabriel/LeadAwakerApp`):
- Create `scripts/migrations/2026-09-23-review-demo.cjs`: Leads columns + demo campaign row.
- Modify `shared/schema.ts`: `reviewRating`, `reviewOutcome` on Leads.
- Modify `server/demo-session.ts`: add the campaign id to `SERVICE_DEMO_CAMPAIGN_IDS`.
- Modify `server/routes/demo.ts`: allow the `review-draft` suffix and the `reputation` service key.
- Create `client/src/features/reviewDemo/`: `types.ts`, `api.ts`, `copy.ts`, `useReviewDemo.ts`, `components/PhoneFrame.tsx`, `components/MessageText.tsx`, `components/SmsBubble.tsx`, `components/WhatsAppBubble.tsx`, `components/CustomerPhone.tsx`, `components/ManagerPhone.tsx`, `components/ReviewPopup.tsx`.
- Create `client/src/pages/review-demo.tsx`.
- Modify `client/src/App.tsx`, `client/src/features/demos/services.ts`, `client/src/features/demos/components/ProspectDemoPanel.tsx`.

---

### Task 1: Pure reputation turn logic

**Files:**
- Create: `/home/gabriel/automations/src/automations/reputation_conversation.py`
- Test: `/home/gabriel/automations/tests/test_reputation_conversation.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DEMO_REVIEW_URL: str = "https://g.page/r/demo-business/review"`
  - `LANGUAGE_NAMES: dict[str, str]`
  - `ACTIONS: frozenset[str]`
  - `is_demo_lead(lead: dict) -> bool`
  - `parse_model_output(raw: str) -> tuple[str, int | None, str]` returns `(reply, rating, action)`
  - `sentiment_for(rating: int | None) -> str | None` (`5 -> "positive"`, `4 -> "neutral"`, `1..3 -> "negative"`, `None -> None`)
  - `@dataclass(frozen=True) class Turn: reply: str; rating: int | None; action: str; link_sent_now: bool; outcome: str | None; newly_rated: bool`
  - `apply_turn(*, reply: str, rating: int | None, action: str, prior_rating: int | None, prior_outcome: str | None, review_url: str | None, public_invite: str) -> Turn`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_reputation_conversation.py
"""Pure turn logic for the reputation conversation.

The rules pinned here are the compliance ones: the model never writes a link,
and every customer who rates 4 or less is offered the public review link.
"""
from src.automations import reputation_conversation as rc

URL = "https://g.page/r/demo-business/review"
INVITE = f"If you'd like, you're also welcome to share your honest feedback here: {URL}"


def turn(**kw):
    base = dict(reply="Thanks!", rating=None, action="continue", prior_rating=None,
                prior_outcome=None, review_url=URL, public_invite=INVITE)
    base.update(kw)
    return rc.apply_turn(**base)


def test_parse_valid_json():
    assert rc.parse_model_output('{"reply": "Hi", "rating": 5, "action": "send_review_link"}') == ("Hi", 5, "send_review_link")


def test_parse_fenced_json():
    raw = '```json\n{"reply": "Hi", "rating": null, "action": "continue"}\n```'
    assert rc.parse_model_output(raw) == ("Hi", None, "continue")


def test_parse_garbage_falls_back_to_raw_text():
    assert rc.parse_model_output("Sorry, one sec") == ("Sorry, one sec", None, "continue")


def test_parse_unknown_action_and_bad_rating():
    assert rc.parse_model_output('{"reply": "Hi", "rating": 9, "action": "dance"}') == ("Hi", None, "continue")
    assert rc.parse_model_output('{"reply": "Hi", "rating": "4", "action": "CLOSE"}') == ("Hi", 4, "close")


def test_five_star_send_link_appends_url():
    t = turn(reply="All set. Here's the link:", rating=5, action="send_review_link", prior_rating=5)
    assert t.reply == f"All set. Here's the link:\n{URL}"
    assert t.link_sent_now and t.outcome == "link_sent" and not t.newly_rated


def test_model_written_url_is_stripped():
    t = turn(reply="Here you go: https://evil.example/x thanks", rating=5, action="send_review_link", prior_rating=5)
    assert "evil.example" not in t.reply
    assert t.reply.endswith(URL)


def test_low_rating_forces_invite_even_when_model_says_continue():
    t = turn(reply="Sorry to hear that. What could we have done better?", rating=3, action="continue")
    assert t.reply.endswith(INVITE)
    assert t.newly_rated and t.rating == 3 and t.link_sent_now and t.outcome == "link_sent"


def test_low_rating_invite_not_repeated_once_link_sent():
    t = turn(reply="Noted, thank you.", rating=None, action="continue", prior_rating=2, prior_outcome="link_sent")
    assert URL not in t.reply and not t.link_sent_now and t.rating == 2


def test_send_review_link_again_resends():
    t = turn(reply="Sure, here it is again:", action="send_review_link", prior_rating=5, prior_outcome="link_sent")
    assert t.reply.endswith(URL) and t.link_sent_now


def test_five_star_without_send_action_gets_no_link():
    t = turn(reply="Right on. Up for a quick Google review?", rating=5, action="continue")
    assert URL not in t.reply and t.newly_rated and t.outcome is None


def test_callback_accepted_outcome_wins_over_link():
    t = turn(reply="Great, the manager will call you today.", action="callback_accepted", prior_rating=2, prior_outcome="link_sent")
    assert t.outcome == "callback_requested"


def test_close_without_link_is_declined():
    t = turn(reply="No worries, have a good day!", action="close")
    assert t.outcome == "declined"


def test_no_review_url_appends_nothing():
    t = turn(reply="Sorry to hear that.", rating=2, review_url=None)
    assert t.reply == "Sorry to hear that." and not t.link_sent_now


def test_is_demo_lead():
    assert rc.is_demo_lead({"channel_identifier": "web-demo:abc123"})
    assert rc.is_demo_lead({"channel_identifier": "wa-demo:abc123"})
    assert not rc.is_demo_lead({"channel_identifier": "+31612345678"})
    assert not rc.is_demo_lead({})


def test_sentiment_for():
    assert [rc.sentiment_for(r) for r in (None, 1, 3, 4, 5)] == [None, "negative", "negative", "neutral", "positive"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/test_reputation_conversation.py -v`
Expected: FAIL with `ImportError: cannot import name 'reputation_conversation'`.

- [ ] **Step 3: Write the implementation**

```python
# src/automations/reputation_conversation.py
"""Turn logic for the reputation conversation. Pure: no I/O, so it is unit tested.

The model writes the words; this module owns the two compliance rules, because
a prompt can be ignored and code cannot:
  1. The review link is never model-written. Any URL in the reply is removed and
     the real one is appended by code.
  2. Once a customer rates 4 or less, the public review link is offered in that
     same reply (alongside the callback offer). Withholding it is review gating.
"""
import json
import re
from dataclasses import dataclass

DEMO_REVIEW_URL = "https://g.page/r/demo-business/review"

LANGUAGE_NAMES = {"en": "English", "nl": "Dutch", "pt": "Brazilian Portuguese"}

ACTIONS = frozenset({"continue", "send_review_link", "offer_callback", "callback_accepted", "close"})

_URL_RE = re.compile(r"https?://\S+")


def is_demo_lead(lead: dict) -> bool:
    ci = str(lead.get("channel_identifier") or "")
    return ci.startswith("web-demo:") or ci.startswith("wa-demo:")


def _rating(value) -> int | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if 1 <= n <= 5 else None


def parse_model_output(raw: str) -> tuple[str, int | None, str]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    match = re.search(r"\{.*\}", text, re.S)
    try:
        data = json.loads(match.group(0) if match else text)
    except (ValueError, TypeError):
        return text, None, "continue"
    if not isinstance(data, dict):
        return text, None, "continue"
    action = str(data.get("action") or "continue").strip().lower()
    return (
        str(data.get("reply") or "").strip(),
        _rating(data.get("rating")),
        action if action in ACTIONS else "continue",
    )


def sentiment_for(rating: int | None) -> str | None:
    if rating is None:
        return None
    if rating >= 5:
        return "positive"
    return "neutral" if rating == 4 else "negative"


@dataclass(frozen=True)
class Turn:
    reply: str
    rating: int | None
    action: str
    link_sent_now: bool
    outcome: str | None
    newly_rated: bool


def apply_turn(*, reply: str, rating: int | None, action: str, prior_rating: int | None,
               prior_outcome: str | None, review_url: str | None, public_invite: str) -> Turn:
    effective = rating if rating is not None else prior_rating
    link_already = prior_outcome == "link_sent"
    body = re.sub(r"[ \t]{2,}", " ", _URL_RE.sub("", reply)).strip()

    link_now = False
    if review_url and action == "send_review_link":
        body = f"{body}\n{review_url}".strip()
        link_now = True
    elif review_url and effective is not None and effective <= 4 and not link_already:
        body = f"{body}\n\n{public_invite}".strip()
        link_now = True

    if action == "callback_accepted" or prior_outcome == "callback_requested":
        outcome = "callback_requested"
    elif link_now or link_already:
        outcome = "link_sent"
    elif action == "close":
        outcome = "declined"
    else:
        outcome = prior_outcome

    return Turn(
        reply=body,
        rating=effective,
        action=action,
        link_sent_now=link_now,
        outcome=outcome,
        newly_rated=prior_rating is None and effective is not None,
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/test_reputation_conversation.py -v`
Expected: 15 passed.

- [ ] **Step 5: Commit (engine repo)**

```bash
cd /home/gabriel/automations
git add src/automations/reputation_conversation.py tests/test_reputation_conversation.py
git commit -m "$(cat <<'EOF'
feat(reputation): pure turn logic for the multi-turn review conversation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Lead columns, demo campaign row, persona-campaign lists

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/scripts/migrations/2026-09-23-review-demo.cjs`
- Modify: `/home/gabriel/LeadAwakerApp/shared/schema.ts` (Leads table, next to `reviewRequestSentAt`, around line 932)
- Modify: `/home/gabriel/LeadAwakerApp/server/demo-session.ts` (`SERVICE_DEMO_CAMPAIGN_IDS`, around line 863)
- Modify: `/home/gabriel/automations/src/automations/demo_campaigns.py` (`_DEFAULT_IDS`)

**Interfaces:**
- Consumes: nothing.
- Produces: Leads columns `review_rating integer NULL`, `review_outcome text NULL`; a Campaigns row whose id the script prints as `REPUTATION_DEMO_CAMPAIGN_ID=<n>`. Every later step that says `REPUTATION_DEMO_CAMPAIGN_ID` means that printed number.

- [ ] **Step 1: Check the target does not already exist**

Run:
```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e '
const {Pool}=require("pg");const p=new Pool({connectionString:process.env.DATABASE_URL});
(async()=>{
 const c=await p.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name IN ($3,$4)`,["p2mxx34fvbf3ll6","Leads","review_rating","review_outcome"]);
 const k=await p.query(`SELECT id,name FROM p2mxx34fvbf3ll6."Campaigns" WHERE campaign_type=$1`,["reputation"]);
 console.log(c.rows,k.rows);await p.end();})()'
```
Expected: `[] []`. If either is non-empty, stop and report: someone else created them.

- [ ] **Step 2: Write the migration script**

```js
// scripts/migrations/2026-09-23-review-demo.cjs
// Review demo (specs/review-demo): two Leads columns and the reputation demo
// campaign, cloned from Speed to Lead (67). Idempotent: safe to run twice.
const { Pool } = require("pg");

const S = "p2mxx34fvbf3ll6";
const NAME = "Reputation Demo";

const FIRST_MESSAGE = JSON.stringify({
  en: "Hey {first_name}, it's {agent_name}{disclosure_clause}. Just checking in: are you the same {first_name} who recently had {service_name} done with us?",
  nl: "Hoi {first_name}, met {agent_name}{disclosure_clause}. Even checken: ben jij dezelfde {first_name} die onlangs {service_name} bij ons heeft laten doen?",
});

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`ALTER TABLE ${S}."Leads" ADD COLUMN IF NOT EXISTS review_rating integer`);
    await pool.query(`ALTER TABLE ${S}."Leads" ADD COLUMN IF NOT EXISTS review_outcome text`);

    const existing = await pool.query(`SELECT id FROM ${S}."Campaigns" WHERE name = $1 LIMIT 1`, [NAME]);
    let id = existing.rows[0]?.id;
    if (!id) {
      const cols = (await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'Campaigns' AND column_name <> 'id'`,
        [S],
      )).rows.map((r) => `"${r.column_name}"`);
      // Select the new name in place of 67's, in case campaign names are unique.
      const select = cols.map((c) => (c === '"name"' ? "$1" : c));
      const inserted = await pool.query(
        `INSERT INTO ${S}."Campaigns" (${cols.join(", ")}) SELECT ${select.join(", ")} FROM ${S}."Campaigns" WHERE id = 67 RETURNING id`,
        [NAME],
      );
      id = inserted.rows[0].id;
    }

    // Clone gotchas (memory: speed-to-lead demo): clear the mode openers or the
    // clone renders 67's opener; niche must stay a real trade (67's is kept);
    // no "from {company_name}" next to {disclosure_clause}.
    await pool.query(
      `UPDATE ${S}."Campaigns"
          SET name = $2, campaign_type = 'reputation', is_demo = true,
              "First_Message" = $3, first_message_scoping = NULL, first_message_quoted = NULL,
              prompt_campaign_id = NULL, message_debounce_seconds = 2,
              updated_at = NOW()
        WHERE id = $1`,
      [id, NAME, FIRST_MESSAGE],
    );
    console.log(`REPUTATION_DEMO_CAMPAIGN_ID=${id}`);
  } finally {
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
```

- [ ] **Step 3: Run it and record the id**

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env scripts/migrations/2026-09-23-review-demo.cjs`
Expected: `REPUTATION_DEMO_CAMPAIGN_ID=<n>`. If it errors on a column name (for example `first_message_quoted` or `updated_at` not existing), check the column list with `\d` via a query on `information_schema.columns`, fix the UPDATE, and rerun (it is idempotent).

- [ ] **Step 4: Add the columns to the Drizzle schema**

In `shared/schema.ts`, directly after `reviewRequestSentAt: timestamp("review_request_sent_at", { withTimezone: true }),` add:

```ts
  // Reputation conversation: the 1-5 rating the customer gave, and where the
  // conversation landed (link_sent | callback_requested | declined).
  reviewRating: integer("review_rating"),
  reviewOutcome: text("review_outcome"),
```

- [ ] **Step 5: Add the id to both persona-campaign lists**

`server/demo-session.ts`: in `SERVICE_DEMO_CAMPAIGN_IDS`, replace both `[60, 67, 68` literals with `[60, 67, 68, REPUTATION_DEMO_CAMPAIGN_ID` (the real number, twice).

`/home/gabriel/automations/src/automations/demo_campaigns.py`: change `_DEFAULT_IDS = {60, 67, 68}` to `_DEFAULT_IDS = {60, 67, 68, REPUTATION_DEMO_CAMPAIGN_ID}` (the real number).

- [ ] **Step 6: Verify**

Run the Step 1 query again. Expected: both columns listed, one campaign named `Reputation Demo`.
Run: `cd /home/gabriel/automations && .venv/bin/python -c "from src.automations.demo_campaigns import is_persona_demo_campaign as f; print(f(REPUTATION_DEMO_CAMPAIGN_ID))"` (real number). Expected: `True`.

- [ ] **Step 7: Commit (both repos)**

```bash
cd /home/gabriel/LeadAwakerApp
git add scripts/migrations/2026-09-23-review-demo.cjs shared/schema.ts server/demo-session.ts
git commit -m "$(cat <<'EOF'
feat(review-demo): review rating/outcome on Leads and the Reputation demo campaign

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
cd /home/gabriel/automations
git add src/automations/demo_campaigns.py
git commit -m "$(cat <<'EOF'
feat(reputation): Reputation demo campaign carries the prospect persona

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Conversation prompt and Portuguese templates

**Files:**
- Modify: `/home/gabriel/automations/src/automations/reputation_prompts.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `norm_lang()` now returns `"en" | "nl" | "pt"`; `DEFAULT_CONVERSATION_PROMPT: str` with placeholders `{agent_name} {company_name} {service} {niche} {first_name} {language_name}`; PT keys on `DEFAULT_REQUEST`, `DEFAULT_PUBLIC_INVITE`, `DEFAULT_REFERRAL_ASK`, `DEFAULT_REFERRAL_THANKS`. Removes `DEFAULT_REVIEW_ASK`, `DEFAULT_NEGATIVE_ACK`, `DEFAULT_NEUTRAL_ACK`, `DEFAULT_CLASSIFIER_PROMPT` (their only user is the handler being rewritten in Task 4). `_safe_format` keeps its name: `channel_fallback.py` imports it.

- [ ] **Step 1: Confirm nothing else uses the templates being removed**

Run: `cd /home/gabriel/automations && grep -rn "DEFAULT_REVIEW_ASK\|DEFAULT_NEGATIVE_ACK\|DEFAULT_NEUTRAL_ACK\|DEFAULT_CLASSIFIER_PROMPT" --include=*.py src tools tests | grep -v "reputation_prompts.py\|reputation_handler.py"`
Expected: no output.

- [ ] **Step 2: Edit the module**

1. Update the module docstring's last paragraph to: `Per-language defaults (en / nl / pt) are used when no Prompt_Library override exists. An override supplies a single text for all languages. Portuguese is Brazilian.`
2. Replace `norm_lang` with:

```python
def norm_lang(language: str | None) -> str:
    """Map a free-form language label to one of en / nl / pt. Defaults to en."""
    if not language:
        return "en"
    l = language.strip().lower()
    if l.startswith("nl") or "dutch" in l or "nederlands" in l:
        return "nl"
    if l.startswith("pt") or "portug" in l:
        return "pt"
    return "en"
```

3. Add a `"pt"` key to each remaining template:

```python
# DEFAULT_REQUEST
    "pt": "Oi {first_name}! Obrigado por escolher a {business}. Queremos muito saber: como foi sua experiência com a gente?",
# DEFAULT_PUBLIC_INVITE
    "pt": "Se quiser, você também pode deixar sua opinião sincera aqui: {review_url}",
# DEFAULT_REFERRAL_ASK
    "pt": "Mais uma coisa, {first_name}: conhece alguém que também ia adorar a {business}? É só me mandar o nome, ou encaminhar esta mensagem direto pra pessoa. 🙌",
# DEFAULT_REFERRAL_THANKS
    "pt": "Que demais, muito obrigado, {first_name}! Vamos cuidar muito bem dessa pessoa. 🙏",
```

4. Delete `DEFAULT_REVIEW_ASK`, `DEFAULT_NEGATIVE_ACK`, `DEFAULT_NEUTRAL_ACK` and the classifier section (`DEFAULT_CLASSIFIER_PROMPT` and its comment block).
5. Add, after the referral templates:

```python
# ── Conversation system prompt (Prompt_Library override: "reputation_conversation") ──
# Placeholders: {agent_name} {company_name} {service} {niche} {first_name} {language_name}
# The model never writes a link: code appends the review link (see
# reputation_conversation.apply_turn), so the prompt only decides WHEN.
DEFAULT_CONVERSATION_PROMPT = """\
You are {agent_name}, texting for {company_name} ({niche}). {first_name} is a recent customer who had {service} done. You are checking in after the job. Your first message, already sent, asked if you have the right person.

Work through this in order, one short question per message:
1. Once they confirm, ask what they liked most about the job.
2. Then ask them to rate the overall experience from 1 to 5, 5 being the best.
3. If they rate 5: thank them and ask if they would be up for a quick Google review (it takes about 20 seconds). When they say yes, reply with a short line like "All set, here's the link:" and set action "send_review_link".
4. If they rate 1 to 4: thank them for being honest, say you are sorry it was not perfect, and offer a call from the manager to put it right. Set action "offer_callback". The system also adds a link where they can share their feedback publicly, so mention they are welcome to do that too.
5. If they accept the call, confirm the manager will reach out today and set action "callback_accepted".
6. If it is the wrong person, or they do not want to chat, apologise briefly and set action "close".

If they give a rating before you ask for it, use it and move on. If they ask something off-topic, answer in one line and steer back.

Style: sound like a real person texting. One to three short sentences. Match their tone. No emojis unless they use one first. No links or URLs. Write in {language_name}.

Output ONLY a JSON object:
{"reply": "<your message>", "rating": <1-5 if they have given a rating, else null>, "action": "continue" | "send_review_link" | "offer_callback" | "callback_accepted" | "close"}"""
```

- [ ] **Step 3: Verify it imports and the fallback consumer still works**

Run: `cd /home/gabriel/automations && .venv/bin/python -c "from src.automations import reputation_prompts as rp, channel_fallback; print(rp.norm_lang('pt-BR'), rp.render_message(rp.DEFAULT_PUBLIC_INVITE, 'pt', None, review_url='X'))"`
Expected: `pt Se quiser, você também pode deixar sua opinião sincera aqui: X`. (The handler import is expected to break until Task 4; do not import it here.)

- [ ] **Step 4: Commit (engine repo)**

```bash
cd /home/gabriel/automations
git add src/automations/reputation_prompts.py
git commit -m "$(cat <<'EOF'
feat(reputation): conversation prompt and Brazilian Portuguese templates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Rewrite the reputation handler as a conversation turn

**Files:**
- Modify: `/home/gabriel/automations/src/automations/reputation_handler.py`
- Modify: `/home/gabriel/automations/src/webhooks/demo_commands.py` (`_reset_lead_history` UPDATE, around line 402)
- Test: `/home/gabriel/automations/tests/test_reputation_handler.py`

**Interfaces:**
- Consumes: Task 1 (`reputation_conversation`), Task 3 (`DEFAULT_CONVERSATION_PROMPT`, `norm_lang`, `_safe_format`, `render_message`, `DEFAULT_PUBLIC_INVITE`, `load_override`).
- Produces: `handle_reply(lead, campaign_account, inbound_message, exec_id)` with the same signature `inbound_handler.py` Step 11.6 already calls. Writes `review_rating`, `review_outcome`, `ai_sentiment` on the lead.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_reputation_handler.py
"""handle_reply wiring: one model call per turn, compliance applied, side
effects in the right cases. All I/O is replaced; the pure rules are covered in
test_reputation_conversation.py."""
import json

import pytest

from src.automations import reputation_handler as rh

URL = "https://g.page/r/demo-business/review"


@pytest.fixture
def io(monkeypatch):
    calls = {"sent": [], "fields": [], "tags": [], "alerts": [], "referral": [], "model": None}

    async def fake_generate(messages, **kw):
        calls["prompt"] = messages
        return {"content": calls["model"]}

    async def fake_history(lead_id, limit=20):
        return [{"direction": "inbound", "Content": "Yes that's me"},
                {"direction": "outbound", "Content": "Hey Jamie, are you the same Jamie?"}]

    async def fake_send(lead, campaign_account, body):
        calls["sent"].append(body)
        return {"result": {"success": True}, "send_id": "s1", "from_addr": "a", "to_addr": "b"}

    async def fake_record(*a, **kw):
        return None

    async def fake_fields(lead_id, **fields):
        calls["fields"].append(fields)

    async def fake_tags(lead_id, account_id, event, **kw):
        calls["tags"].append(event)

    async def fake_alert(lead, campaign_account, account_id, message):
        calls["alerts"].append(message)

    async def fake_referral(*a, **kw):
        calls["referral"].append(True)

    async def fake_override(*a, **kw):
        return None

    class FakeStep:
        output = ""

        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(rh, "AsyncLogStep", FakeStep)
    monkeypatch.setattr(rh, "generate_response", fake_generate)
    monkeypatch.setattr(rh, "get_interactions_for_lead", fake_history)
    monkeypatch.setattr(rh, "_send_ack", fake_send)
    monkeypatch.setattr(rh, "_record_outbound", fake_record)
    monkeypatch.setattr(rh, "update_lead_fields", fake_fields)
    monkeypatch.setattr(rh, "apply_event_tags", fake_tags)
    monkeypatch.setattr(rh, "_alert_manager", fake_alert)
    monkeypatch.setattr(rh, "_send_referral_ask", fake_referral)
    monkeypatch.setattr(rh.rp, "load_override", fake_override)
    return calls


def lead(**kw):
    base = {"id": 7, "Accounts_id": 1, "Campaigns_id": 999, "language": "en", "first_name": "Jamie",
            "channel_identifier": "+31600000000", "review_rating": None, "review_outcome": None}
    base.update(kw)
    return base


CAMPAIGN = {"id": 999, "Accounts_id": 1, "account_name": "Manchester Roofs", "name": "Rep",
            "google_review_url": "https://g.page/r/real/review", "enable_referral_ask": False}


def model(reply, rating=None, action="continue"):
    return json.dumps({"reply": reply, "rating": rating, "action": action})


async def test_low_rating_real_lead_alerts_and_invites(io):
    io["model"] = model("Sorry it wasn't perfect. Want the manager to call you?", 3, "offer_callback")
    await rh.handle_reply(lead(), CAMPAIGN, "3, they were late", "exec")
    assert io["sent"][0].endswith("https://g.page/r/real/review")
    assert io["alerts"] == ["3, they were late"]
    assert "reputation_negative" in io["tags"] and "review_requested" in io["tags"]
    assert io["fields"][0] == {"review_rating": 3, "review_outcome": "link_sent", "ai_sentiment": "negative"}


async def test_demo_lead_uses_demo_url_and_never_alerts(io):
    io["model"] = model("Sorry to hear that.", 2, "offer_callback")
    await rh.handle_reply(lead(channel_identifier="web-demo:abc123"), CAMPAIGN, "2", "exec")
    assert io["sent"][0].endswith(URL)
    assert io["alerts"] == []


async def test_five_star_link_and_referral_when_enabled(io):
    io["model"] = model("All set, here's the link:", None, "send_review_link")
    campaign = {**CAMPAIGN, "enable_referral_ask": True}
    await rh.handle_reply(lead(review_rating=5), campaign, "Yes please", "exec")
    assert io["sent"][0] == "All set, here's the link:\nhttps://g.page/r/real/review"
    assert io["referral"] == [True]
    assert io["fields"][0]["review_outcome"] == "link_sent"


async def test_callback_accepted_sets_takeover(io):
    io["model"] = model("Great, the manager will call you today.", None, "callback_accepted")
    await rh.handle_reply(lead(review_rating=2, review_outcome="link_sent"), CAMPAIGN, "yes call me", "exec")
    assert {"manual_takeover": True, "handoff_reason": "reputation_callback"} in io["fields"]


async def test_empty_reply_sends_nothing(io):
    io["model"] = model("", None, "continue")
    await rh.handle_reply(lead(), CAMPAIGN, "hmm", "exec")
    assert io["sent"] == [] and io["fields"] == []


async def test_prompt_has_persona_language_and_transcript(io):
    io["model"] = model("What did you like most?")
    await rh.handle_reply(lead(language="pt"), CAMPAIGN, "Yes that's me", "exec")
    system = io["prompt"][0]["content"]
    assert "Manchester Roofs" in system and "Brazilian Portuguese" in system and "Jamie" in system
    assert [m["role"] for m in io["prompt"][1:]] == ["assistant", "user"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/test_reputation_handler.py -v`
Expected: FAIL (import error on removed templates, or `generate_response` not an attribute of the module).

- [ ] **Step 3: Rewrite the handler**

In `reputation_handler.py`:

1. Replace the module docstring's "Flow" section with:

```
Flow, one call per customer message:
  1. The model continues the conversation (confirm the job, what they liked,
     a 1-5 rating, then act on it) and returns {reply, rating, action}.
  2. reputation_conversation.apply_turn enforces compliance in code: the model
     never writes a link, and a rating of 4 or less always gets the public
     review link offered in the same reply.
  3. Side effects: rating + outcome on the lead, tags, a manager alert on a new
     rating of 4 or less (never for demo leads), handoff when the customer
     accepts the callback, and the opt-in referral ask after a 5-star link.
```
(Keep the Phase 4 referral paragraph.)

2. Imports: remove `generate_response_groq`; add

```python
from tools.ai_service import generate_response
from tools.db.interactions import create_interaction, get_interactions_for_lead
from src.automations import reputation_conversation as rc
from src.automations.demo_campaigns import is_persona_demo_campaign
```
(`create_interaction` is already imported from the same module: merge into one line.)

3. Delete `_classify`.

4. Add after `_resolve_alert_user_id`:

```python
def _persona(campaign_account: dict, lead: dict, campaign_id: int | None) -> dict:
    """Company, agent and service for the prompt. Demo campaigns overlay the
    prospect's generated persona so the AI speaks as their business."""
    ctx = dict(campaign_account)
    if is_persona_demo_campaign(campaign_id):
        from src.automations.conversation.prompt_builder import _overlay_demo_niche_onto_campaign
        ctx = _overlay_demo_niche_onto_campaign(ctx, lead)
    return {
        "company_name": ctx.get("company_name") or ctx.get("account_name") or ctx.get("name") or "us",
        "agent_name": ctx.get("agent_name") or "the team",
        "service": ctx.get("service_name") or ctx.get("campaign_service") or "the job",
        "niche": ctx.get("niche") or "local business",
    }


async def _model_turn(lead: dict, persona: dict, language: str, first_name: str,
                      campaign_id: int | None, account_id: int | None, inbound_message: str) -> str:
    template = (
        await rp.load_override(campaign_id, account_id, "reputation_conversation")
        or rp.DEFAULT_CONVERSATION_PROMPT
    )
    system = rp._safe_format(
        template, **persona, first_name=first_name or "there",
        language_name=rc.LANGUAGE_NAMES.get(language, "English"),
    )
    history = list(reversed(await get_interactions_for_lead(lead["id"], limit=30)))
    messages = [{"role": "system", "content": system}]
    for row in history:
        text = str(row.get("Content") or "").strip()
        if not text:
            continue
        outbound = str(row.get("direction") or "").strip().lower() == "outbound"
        messages.append({"role": "assistant" if outbound else "user", "content": text})
    if messages[-1]["role"] != "user":
        messages.append({"role": "user", "content": inbound_message})
    result = await generate_response(messages, max_tokens=800, temperature=0.4)
    return result.get("content") or ""
```

Note: `get_interactions_for_lead` returns newest first, hence `reversed`. The test fixture returns rows newest first too (inbound "Yes that's me" is newest).

5. Replace the whole body of `handle_reply` after the referral-capture block with:

```python
    demo = rc.is_demo_lead(lead)
    review_url = rc.DEMO_REVIEW_URL if demo else campaign_account.get("google_review_url")
    prior_rating = lead.get("review_rating")
    prior_outcome = lead.get("review_outcome")

    async with AsyncLogStep(
        "reputation_handler", "conversation_turn",
        workflow_execution_id=exec_id,
        accounts_id=account_id, campaigns_id=campaign_id, leads_id=lead_id,
    ) as step:
        raw = await _model_turn(lead, persona, language, first_name, campaign_id, account_id, inbound_message)
        reply, rating, action = rc.parse_model_output(raw)
        if reply == raw.strip() and raw.strip().startswith("{"):
            log.warning("reputation_handler.unparsed_model_output", lead_id=lead_id)
        turn = rc.apply_turn(
            reply=reply, rating=rating, action=action,
            prior_rating=prior_rating, prior_outcome=prior_outcome, review_url=review_url,
            public_invite=rp.render_message(rp.DEFAULT_PUBLIC_INVITE, language, None, review_url=review_url or ""),
        )
        if not turn.reply:
            step.output = "empty model reply, nothing sent"
            log.warning("reputation_handler.empty_reply", lead_id=lead_id)
            return

        sent = await _send_ack(lead, campaign_account, turn.reply)
        if not sent["result"].get("success"):
            raise RuntimeError(f"Send failed: {sent['result'].get('error')}")
        await _record_outbound(lead, campaign_account, account_id, campaign_id, turn.reply, sent)

        fields = {"review_rating": turn.rating, "review_outcome": turn.outcome}
        if turn.rating is not None:
            fields["ai_sentiment"] = rc.sentiment_for(turn.rating)
        await update_lead_fields(lead_id, **fields)

        tag_kw = dict(workflow="reputation_handler", workflow_step=f"turn_{turn.action}",
                      campaign_id=campaign_id, campaign_name=campaign_account.get("name"))
        if turn.newly_rated:
            await apply_event_tags(lead_id, account_id, f"reputation_{rc.sentiment_for(turn.rating)}", **tag_kw)
            if turn.rating <= 4 and not demo:
                await _alert_manager(lead, campaign_account, account_id, inbound_message)
        if turn.link_sent_now:
            await apply_event_tags(lead_id, account_id, "review_requested", **tag_kw)
            if referral_enabled and turn.rating == 5 and prior_outcome != "link_sent":
                try:
                    await _send_referral_ask(lead, campaign_account, account_id, campaign_id,
                                             language, first_name, business, exec_id)
                except Exception as exc:
                    log.error("reputation_handler.referral_ask_error", lead_id=lead_id, error=str(exc))
        if turn.action == "callback_accepted" and prior_outcome != "callback_requested":
            await update_lead_fields(lead_id, manual_takeover=True, handoff_reason="reputation_callback")

        step.output = f"action={turn.action} rating={turn.rating} link={turn.link_sent_now} outcome={turn.outcome}"

    log.info("reputation_handler.handled", lead_id=lead_id, action=turn.action, rating=turn.rating)
```

6. At the top of `handle_reply`, replace the `language`/`business` lines with:

```python
    language = rp.norm_lang(lead.get("language") or campaign_account.get("language"))
    first_name = lead.get("first_name") or ""
    persona = _persona(campaign_account, lead, campaign_id)
    business = persona["company_name"]
```

7. In `_alert_manager`, change `title` to `"Low rating: needs a personal response"` and `body` to `f"{name} gave a low rating to the feedback request: \"{message[:160]}\""`, and the type string stays `reputation_negative_feedback` (existing notification type).

- [ ] **Step 4: Clear the new fields on demo restart**

In `src/webhooks/demo_commands.py`, `_reset_lead_history`, in the big `UPDATE ... SET` string, change `f'    no_show = NULL, '` to `f'    no_show = NULL, review_rating = NULL, review_outcome = NULL, '`.

- [ ] **Step 5: Run the tests**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/test_reputation_handler.py tests/test_reputation_conversation.py -v`
Expected: all pass.
Run: `cd /home/gabriel/automations && .venv/bin/pytest tests -q`
Expected: no new failures compared with `git stash; .venv/bin/pytest tests -q; git stash pop` (run that baseline first if anything fails).

- [ ] **Step 6: Commit (engine repo)**

```bash
cd /home/gabriel/automations
git add src/automations/reputation_handler.py src/webhooks/demo_commands.py tests/test_reputation_handler.py
git commit -m "$(cat <<'EOF'
feat(reputation): multi-turn review conversation with compliance enforced in code

Replaces the single-shot classify-and-template reply. The neutral branch no
longer dead-ends without a review link.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Web-demo state block, review-draft endpoint, Express allowlist

**Files:**
- Modify: `/home/gabriel/automations/src/automations/review_drafter.py`
- Modify: `/home/gabriel/automations/src/webhooks/web_demo_routes.py`
- Modify: `/home/gabriel/LeadAwakerApp/server/routes/demo.ts` (lines 574 and 812)
- Test: `/home/gabriel/automations/tests/test_web_demo_reputation_state.py`

**Interfaces:**
- Consumes: Task 2 columns, Task 1 `is_demo_lead` not needed here.
- Produces:
  - `review_drafter.draft_reply_text(*, account_id: int | None, rating: int | None, review_text: str, business: str, author_name: str) -> tuple[str, str]`
  - `web_demo_routes.reputation_state(lead: dict) -> dict` returning `{"rating": int|None, "outcome": str|None, "managerAlerted": bool}`
  - `GET /api/web-demo/<token>` JSON gains `"reputation": {...} | null`
  - `POST /api/web-demo/<token>/review-draft` body `{"stars": 1-5, "text": str}` returns `{"draft": str}`; 400 on bad input; 502 `{"code": "draft_failed"}` on model failure.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_web_demo_reputation_state.py
from src.webhooks.web_demo_routes import reputation_state


def test_unrated():
    assert reputation_state({"review_rating": None, "review_outcome": None}) == {
        "rating": None, "outcome": None, "managerAlerted": False}


def test_low_rating_alerts_manager():
    assert reputation_state({"review_rating": 4, "review_outcome": "link_sent"})["managerAlerted"] is True


def test_five_star_does_not():
    assert reputation_state({"review_rating": 5, "review_outcome": "link_sent"})["managerAlerted"] is False
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/test_web_demo_reputation_state.py -v`
Expected: FAIL with `ImportError: cannot import name 'reputation_state'`.

- [ ] **Step 3: Expose the drafter**

In `review_drafter.py`, replace `_draft_reply` with:

```python
async def draft_reply_text(*, account_id: int | None, rating: int | None, review_text: str,
                           business: str, author_name: str) -> tuple[str, str]:
    """Return (reply_text, language). Raises on AI failure. Used by the poller and the review demo."""
    language = rvp.detect_language(review_text)
    system_prompt = (await rvp.load_system_prompt(account_id)).replace("{language}", language)
    user_prompt = rvp.build_user_prompt(
        author_name=author_name, rating=rating, review_text=review_text,
        business=business, language=language,
    )
    result = await generate_response(
        [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        max_tokens=300,
        temperature=0.6,
    )
    reply = (result.get("content") or "").strip()
    if not reply:
        raise RuntimeError("Empty AI draft")
    return reply, language


async def _draft_reply(review: dict) -> tuple[str, str]:
    """Return (reply_text, language). Raises on AI failure so the row stays 'new'."""
    return await draft_reply_text(
        account_id=review.get("accounts_id"),
        rating=review.get("rating"),
        review_text=review.get("review_text") or "",
        business=review.get("account_name") or "us",
        author_name=review.get("author_name") or "",
    )
```

- [ ] **Step 4: Add the state helper and the endpoint**

In `web_demo_routes.py`, add near `_stage`:

```python
def reputation_state(lead: dict) -> dict:
    """What the review demo's manager phone reacts to. A rating of 4 or less
    is the moment a real manager would be alerted."""
    rating = lead.get("review_rating")
    return {
        "rating": rating,
        "outcome": lead.get("review_outcome"),
        "managerAlerted": rating is not None and rating <= 4,
    }
```

In `_build_state`, after the `quote` block, add:

```python
    reputation = None
    if lead.get("Campaigns_id"):
        from src.automations.demo_recap import _load_campaign
        campaign = await _load_campaign(lead["Campaigns_id"])
        if campaign and campaign.get("campaign_type") == "reputation":
            reputation = reputation_state(lead)
```

and add `"reputation": reputation,` to the returned dict (after `"quote": quote,`).

If `_load_campaign` selects an explicit column list without `campaign_type`, read it with a one-line `SELECT campaign_type FROM {fq(Table.CAMPAIGNS)} WHERE id = $1` instead of widening that shared loader.

Before verifying, check `_build_state` receives a lead read fresh from the DB on every poll (it is the `_find_lead` / `_get_or_create_web_lead` row, a `SELECT *`), so the two new columns are present.

Add the endpoint after the `restart` route:

```python
@router.post("/{token}/review-draft")
async def web_demo_review_draft(token: str, body: dict = Body(...)):
    """The review demo's last beat: the AI drafts the owner's reply to the
    review the visitor just 'posted'. Same drafter as Reputation v2."""
    lead = await _find_lead(token)
    if lead is None:
        return _err(404, "not_found", "This demo link has expired.")
    try:
        stars = int(body.get("stars"))
    except (TypeError, ValueError):
        return _err(400, "bad_stars", "Pick a rating.")
    text = str(body.get("text") or "").strip()[:1000]
    if not 1 <= stars <= 5:
        return _err(400, "bad_stars", "Pick a rating.")
    company, _agent = await _company_and_agent(lead)
    from src.automations.review_drafter import draft_reply_text
    try:
        draft, _lang = await draft_reply_text(
            account_id=lead.get("Accounts_id"), rating=stars, review_text=text,
            business=company or "us", author_name=str(lead.get("first_name") or ""),
        )
    except Exception as exc:
        log.warning("web_demo.review_draft_failed", lead_id=lead["id"], error=str(exc))
        return _err(502, "draft_failed", "Could not draft a reply.")
    return {"draft": draft}
```

Check the top of the file imports `Body` from `fastapi` (add it to the existing `from fastapi import ...` line if missing).

- [ ] **Step 5: Allow the suffix and service key in Express**

`server/routes/demo.ts`:
- line 812: `new Set(["", "message", "restart", "recap", "bump", "voice", "audio"])` becomes `new Set(["", "message", "restart", "recap", "bump", "voice", "audio", "review-draft"])`.
- line 574: `z.enum(["dbr", "quote", "speed", "widget", "voice"])` becomes `z.enum(["dbr", "quote", "speed", "widget", "voice", "reputation"])`.

- [ ] **Step 6: Run the tests, restart the engine**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/test_web_demo_reputation_state.py -v` (expected: 3 passed), then `pm2 restart leadawaker-engine && sleep 5 && pm2 logs leadawaker-engine --lines 30 --nostream | grep -i error`.
Expected: tests pass; no import errors in the log.

- [ ] **Step 7: Commit (both repos)**

```bash
cd /home/gabriel/automations
git add src/automations/review_drafter.py src/webhooks/web_demo_routes.py tests/test_web_demo_reputation_state.py
git commit -m "$(cat <<'EOF'
feat(web-demo): reputation state and review-draft endpoint for the review demo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
cd /home/gabriel/LeadAwakerApp
git add server/routes/demo.ts
git commit -m "$(cat <<'EOF'
feat(review-demo): allow the review-draft suffix and reputation service key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Engine end-to-end check on a test token

**Files:** none changed (verification task; fixes found here go back into Tasks 3 to 5 files).

**Interfaces:**
- Consumes: Tasks 1 to 5.
- Produces: confidence that a browser turn on the new campaign reaches `reputation_handler` and the state reports it.

- [ ] **Step 1: Create a test wa-demo lead**

```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e '
const {Pool}=require("pg");const p=new Pool({connectionString:process.env.DATABASE_URL});
(async()=>{
 await p.query(`INSERT INTO p2mxx34fvbf3ll6."Leads" ("Accounts_id","Campaigns_id",first_name,language,"Source",channel_identifier,"Conversion_Status",automation_status,demo_invited,created_at,updated_at) VALUES (1,$1,$2,$3,$4,$5,$6,$7,false,NOW(),NOW())`,
  [REPUTATION_DEMO_CAMPAIGN_ID,"Jamie","en","Web Demo","wa-demo:revtest01","New","demo_pending"]);
 console.log("ok");await p.end();})()'
```
(Put the real campaign id in place of `REPUTATION_DEMO_CAMPAIGN_ID`.)

- [ ] **Step 2: Walk the 3-star path against the engine**

```bash
curl -s localhost:8100/web-demo/revtest01 | python3 -m json.tool | head -40
curl -s -XPOST localhost:8100/web-demo/revtest01/message -H 'content-type: application/json' -d '{"text":"Yes that is me"}'
sleep 12; curl -s localhost:8100/web-demo/revtest01 | python3 -c "import sys,json;d=json.load(sys.stdin);print([m['text'] for m in d['messages']], d['reputation'])"
curl -s -XPOST localhost:8100/web-demo/revtest01/message -H 'content-type: application/json' -d '{"text":"3, the crew was late but the roof is fine"}'
sleep 12; curl -s localhost:8100/web-demo/revtest01 | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['messages'][-1]['text'], d['reputation'])"
```
Expected: an opener bubble on the first GET; an AI question after the first message; after the rating, the last AI message ends with the public invite containing `https://g.page/r/demo-business/review` and `reputation` is `{"rating": 3, "outcome": "link_sent", "managerAlerted": true}`. If the message body key is not `text`, read `POST /{token}/message` in `web_demo_routes.py` for the field name and use it here and in Task 7's `api.ts`.

- [ ] **Step 3: Draft endpoint and restart**

```bash
curl -s -XPOST localhost:8100/web-demo/revtest01/review-draft -H 'content-type: application/json' -d '{"stars":5,"text":"Great job, tidy crew"}'
curl -s -XPOST localhost:8100/web-demo/revtest01/restart -H 'content-type: application/json' -d '{}' | head -c 300
curl -s localhost:8100/web-demo/revtest01 | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['messages']), d['reputation'])"
```
Expected: `{"draft": "..."}`; restart ok; after restart one message (the opener) and `reputation` rating `None`.

- [ ] **Step 4: Remove the test leads**

```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e '
const {Pool}=require("pg");const p=new Pool({connectionString:process.env.DATABASE_URL});
(async()=>{
 const ids=(await p.query(`SELECT id FROM p2mxx34fvbf3ll6."Leads" WHERE channel_identifier IN ($1,$2)`,["wa-demo:revtest01","web-demo:revtest01"])).rows.map(r=>r.id);
 if(ids.length){await p.query(`DELETE FROM p2mxx34fvbf3ll6."Interactions" WHERE "Leads_id" = ANY($1)`,[ids]);await p.query(`DELETE FROM p2mxx34fvbf3ll6."Leads" WHERE id = ANY($1)`,[ids]);}
 console.log("removed",ids);await p.end();})()'
```

---

### Task 7: Client data layer (types, API, copy, hook)

**Files:**
- Create: `client/src/features/reviewDemo/types.ts`
- Create: `client/src/features/reviewDemo/api.ts`
- Create: `client/src/features/reviewDemo/copy.ts`
- Create: `client/src/features/reviewDemo/useReviewDemo.ts`

**Interfaces:**
- Consumes: Task 5 JSON shapes; `apiFetch(url, options)` from `@/lib/apiUtils` (prefixes `API_BASE`, sends credentials).
- Produces (exact names used by Tasks 8 and 9):
  - types: `Skin = "sms" | "wa"`, `DemoMessage`, `ReputationState`, `ReviewDemoState`, `ManagerEvent`
  - `DEMO_REVIEW_URL` (same string as the engine constant)
  - `api`: `getState(token)`, `sendMessage(token, text)`, `restart(token)`, `reviewDraft(token, stars, text)`
  - `copyFor(lang: string): ReviewCopy`, `UiLang`
  - `useReviewDemo(token: string)` returning `{ state, error, typing, send, events, reviewPosted, postReview, replay, busy }`

- [ ] **Step 1: types.ts**

```ts
export type Skin = "sms" | "wa";

export interface DemoMessage {
  id: number;
  role: "ai" | "visitor";
  text: string;
  at: string | null;
}

export interface ReputationState {
  rating: number | null;
  outcome: "link_sent" | "callback_requested" | "declined" | null;
  managerAlerted: boolean;
}

export interface ReviewDemoState {
  token: string;
  firstName: string;
  language: string;
  company: string;
  agent: string;
  messages: DemoMessage[];
  done: boolean;
  restartsUsed: number;
  restartsMax: number;
  reputation: ReputationState | null;
}

export type ManagerEvent =
  | { id: string; kind: "alert"; stars: number; quote: string }
  | { id: string; kind: "review"; stars: number; text: string }
  | { id: string; kind: "draft"; draft: string | null };

/** Must match DEMO_REVIEW_URL in the engine (reputation_conversation.py). */
export const DEMO_REVIEW_URL = "https://g.page/r/demo-business/review";
```

- [ ] **Step 2: api.ts**

```ts
import { apiFetch } from "@/lib/apiUtils";
import type { ReviewDemoState } from "./types";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || `HTTP ${res.status}`);
  return body as T;
}

const base = (token: string) => `/api/web-demo/${encodeURIComponent(token)}`;
const post = (url: string, body: unknown) =>
  apiFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getState = (token: string) => apiFetch(base(token)).then((r) => json<ReviewDemoState>(r));
export const sendMessage = (token: string, text: string) => post(`${base(token)}/message`, { text }).then((r) => json<unknown>(r));
export const restart = (token: string) => post(`${base(token)}/restart`, {}).then((r) => json<unknown>(r));
export const reviewDraft = (token: string, stars: number, text: string) =>
  post(`${base(token)}/review-draft`, { stars, text }).then((r) => json<{ draft: string }>(r));
```

(Use the message field name confirmed in Task 6 Step 2 if it is not `text`.)

- [ ] **Step 3: copy.ts**

```ts
/**
 * Everything the review demo says, in the language of the link (not the CRM
 * user's), same reasoning as features/voiceDemo/copy.ts. Portuguese is Brazilian.
 */
export type UiLang = "en" | "nl" | "pt";

export interface ReviewCopy {
  customerTitle: string;
  customerHint: string;
  managerTitle: string;
  managerHint: (company: string) => string;
  channelSms: string;
  channelWa: string;
  smsDivider: string;
  today: string;
  placeholder: string;
  silent: string;
  managerLabel: (company: string) => string;
  alertTitle: (name: string, stars: number) => string;
  reviewApp: string;
  reviewTitle: (name: string, stars: number) => string;
  draftTitle: string;
  draftTap: string;
  draftLoading: string;
  draftFailed: string;
  approve: string;
  edit: string;
  approved: string;
  popupQuestion: string;
  popupPlaceholder: string;
  popupPost: string;
  popupDisclaimer: string;
  replay: string;
  offline: string;
  expired: string;
  now: string;
}

const en: ReviewCopy = {
  customerTitle: "The customer's phone",
  customerHint: "You're texting as the customer",
  managerTitle: "The manager's phone",
  managerHint: (c) => `${c} stays silent until it matters`,
  channelSms: "Text Message · SMS",
  channelWa: "WhatsApp",
  smsDivider: "Text Message",
  today: "Today",
  placeholder: "Text Message",
  silent: "Silent until a human is actually needed",
  managerLabel: (c) => `${c} · Manager`,
  alertTitle: (n, s) => `${n} rated ${s}/5: needs a call`,
  reviewApp: "Google Business",
  reviewTitle: (n, s) => `New ${s}-star review from ${n}`,
  draftTitle: "AI drafted a reply",
  draftTap: "Tap to review and approve",
  draftLoading: "Drafting a reply...",
  draftFailed: "Could not draft a reply this time.",
  approve: "Approve",
  edit: "Edit",
  approved: "Approved. It will be posted to Google.",
  popupQuestion: "How was your experience?",
  popupPlaceholder: "Share details of your experience (optional)",
  popupPost: "Post review",
  popupDisclaimer: "Demo only, nothing is posted publicly",
  replay: "Replay demo",
  offline: "The assistant is offline. Try again in a minute.",
  expired: "This demo link has expired.",
  now: "now",
};

const nl: ReviewCopy = {
  customerTitle: "De telefoon van de klant",
  customerHint: "Jij appt als de klant",
  managerTitle: "De telefoon van de manager",
  managerHint: (c) => `${c} blijft stil tot het ertoe doet`,
  channelSms: "Sms-bericht",
  channelWa: "WhatsApp",
  smsDivider: "Sms-bericht",
  today: "Vandaag",
  placeholder: "Sms-bericht",
  silent: "Stil tot er echt een mens nodig is",
  managerLabel: (c) => `${c} · Manager`,
  alertTitle: (n, s) => `${n} gaf een ${s}/5: wil gebeld worden`,
  reviewApp: "Google Bedrijfsprofiel",
  reviewTitle: (n, s) => `Nieuwe ${s}-sterren review van ${n}`,
  draftTitle: "AI heeft een reactie opgesteld",
  draftTap: "Tik om te bekijken en goed te keuren",
  draftLoading: "Reactie opstellen...",
  draftFailed: "Het lukte niet om een reactie op te stellen.",
  approve: "Goedkeuren",
  edit: "Aanpassen",
  approved: "Goedgekeurd. Hij wordt op Google geplaatst.",
  popupQuestion: "Hoe was je ervaring?",
  popupPlaceholder: "Vertel over je ervaring (optioneel)",
  popupPost: "Review plaatsen",
  popupDisclaimer: "Alleen een demo, er wordt niets openbaar geplaatst",
  replay: "Demo opnieuw",
  offline: "De assistent is offline. Probeer het zo nog eens.",
  expired: "Deze demolink is verlopen.",
  now: "nu",
};

const pt: ReviewCopy = {
  customerTitle: "O celular do cliente",
  customerHint: "Você está conversando como o cliente",
  managerTitle: "O celular do gerente",
  managerHint: (c) => `${c} fica em silêncio até ser necessário`,
  channelSms: "Mensagem de texto · SMS",
  channelWa: "WhatsApp",
  smsDivider: "Mensagem de texto",
  today: "Hoje",
  placeholder: "Mensagem de texto",
  silent: "Em silêncio até alguém realmente precisar",
  managerLabel: (c) => `${c} · Gerente`,
  alertTitle: (n, s) => `${n} deu ${s}/5: quer uma ligação`,
  reviewApp: "Google Meu Negócio",
  reviewTitle: (n, s) => `Nova avaliação de ${s} estrelas de ${n}`,
  draftTitle: "A IA escreveu uma resposta",
  draftTap: "Toque para revisar e aprovar",
  draftLoading: "Escrevendo uma resposta...",
  draftFailed: "Não deu para escrever uma resposta agora.",
  approve: "Aprovar",
  edit: "Editar",
  approved: "Aprovada. Vai ser publicada no Google.",
  popupQuestion: "Como foi sua experiência?",
  popupPlaceholder: "Conte como foi sua experiência (opcional)",
  popupPost: "Publicar avaliação",
  popupDisclaimer: "Só uma demo, nada é publicado",
  replay: "Repetir demo",
  offline: "O assistente está offline. Tente de novo daqui a pouco.",
  expired: "Este link de demo expirou.",
  now: "agora",
};

const TABLE: Record<UiLang, ReviewCopy> = { en, nl, pt };

export function copyFor(lang: string): ReviewCopy {
  const l = (lang || "en").slice(0, 2).toLowerCase() as UiLang;
  return TABLE[l] ?? en;
}
```

- [ ] **Step 4: useReviewDemo.ts**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";
import type { DemoMessage, ManagerEvent, ReviewDemoState } from "./types";

const FAST_POLL_MS = 1500;
const IDLE_POLL_MS = 5000;

/**
 * One demo session: polls the engine's web-demo state (post-then-poll, like
 * the /demo page), sends visitor turns, and derives the manager phone's
 * events. The alert comes from the engine (a rating of 4 or less); the review
 * and draft banners come from the popup, which only exists on this page.
 */
export function useReviewDemo(token: string) {
  const [state, setState] = useState<ReviewDemoState | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<DemoMessage[]>([]);
  const [localEvents, setLocalEvents] = useState<ManagerEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const waiting = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getState(token);
      setState(s);
      setError("");
      const last = s.messages[s.messages.length - 1];
      if (last?.role === "ai") waiting.current = false;
      setPending((p) => p.filter((m) => !s.messages.some((x) => x.role === "visitor" && x.text === m.text)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (alive) timer = setTimeout(loop, waiting.current ? FAST_POLL_MS : IDLE_POLL_MS);
    };
    void loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [token, refresh]);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      setPending((p) => [...p, { id: -Date.now(), role: "visitor", text: t, at: null }]);
      waiting.current = true;
      try {
        await api.sendMessage(token, t);
        await refresh();
      } catch (e) {
        setError((e as Error).message);
        waiting.current = false;
      }
    },
    [token, refresh],
  );

  const postReview = useCallback(
    async (stars: number, text: string) => {
      setLocalEvents((ev) => [
        ...ev,
        { id: `review-${Date.now()}`, kind: "review", stars, text },
      ]);
      const draftId = `draft-${Date.now()}`;
      setLocalEvents((ev) => [...ev, { id: draftId, kind: "draft", draft: null }]);
      try {
        const { draft } = await api.reviewDraft(token, stars, text);
        setLocalEvents((ev) => ev.map((e) => (e.id === draftId ? { ...e, draft } : e)));
      } catch {
        setLocalEvents((ev) => ev.map((e) => (e.id === draftId ? { ...e, draft: "" } : e)));
      }
    },
    [token],
  );

  const replay = useCallback(async () => {
    setBusy(true);
    try {
      await api.restart(token);
      setLocalEvents([]);
      setPending([]);
      waiting.current = false;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, refresh]);

  const messages = [...(state?.messages ?? []), ...pending];
  const last = messages[messages.length - 1];
  const typing = waiting.current && last?.role === "visitor";

  const rep = state?.reputation;
  const lastVisitor = [...(state?.messages ?? [])].reverse().find((m) => m.role === "visitor");
  const alert: ManagerEvent[] =
    rep?.managerAlerted && rep.rating
      ? [{ id: "alert", kind: "alert", stars: rep.rating, quote: lastVisitor?.text ?? "" }]
      : [];

  return {
    state: state ? { ...state, messages } : null,
    error,
    typing,
    send,
    events: [...alert, ...localEvents],
    reviewPosted: localEvents.some((e) => e.kind === "review"),
    postReview,
    replay,
    busy,
  };
}
```

Known limitation, accepted: the alert quote is the customer's latest message, not necessarily the one that carried the rating. Good enough for a demo banner.

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add client/src/features/reviewDemo/types.ts client/src/features/reviewDemo/api.ts client/src/features/reviewDemo/copy.ts client/src/features/reviewDemo/useReviewDemo.ts
git commit -m "$(cat <<'EOF'
feat(review-demo): client data layer, copy and session hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

(No verification run here: nothing renders these yet. Task 9 exercises them in the browser.)

---

### Task 8: Phones, bubbles, popup

**Files:**
- Create: `client/src/features/reviewDemo/components/PhoneFrame.tsx`
- Create: `client/src/features/reviewDemo/components/MessageText.tsx`
- Create: `client/src/features/reviewDemo/components/SmsBubble.tsx`
- Create: `client/src/features/reviewDemo/components/WhatsAppBubble.tsx`
- Create: `client/src/features/reviewDemo/components/CustomerPhone.tsx`
- Create: `client/src/features/reviewDemo/components/ManagerPhone.tsx`
- Create: `client/src/features/reviewDemo/components/ReviewPopup.tsx`

**Interfaces:**
- Consumes: Task 7 types and `ReviewCopy`.
- Produces:
  - `PhoneFrame({ time, children, className? })`
  - `MessageText({ text, onOpenReview })`
  - `SmsBubble({ msg, tail, onOpenReview })`, `WhatsAppBubble({ msg, tail, onOpenReview })` where `tail: boolean` is true for the last bubble of a same-sender run
  - `CustomerPhone({ copy, skin, onToggleSkin, agent, messages, typing, onSend, onOpenReview, time })`
  - `ManagerPhone({ copy, company, firstName, events, time, dateLabel })`
  - `ReviewPopup({ copy, company, open, onClose, onPost })` where `onPost(stars: number, text: string)`

- [ ] **Step 1: PhoneFrame.tsx**

```tsx
import type { ReactNode } from "react";

/** A dark iPhone-style shell with status bar. Page-local mockup styling. */
export function PhoneFrame({ time, children, className = "" }: { time: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto flex h-[640px] w-[310px] flex-col overflow-hidden rounded-[46px] border-[6px] border-[#2a2b31] bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ${className}`}>
      <div className="relative z-20 flex h-11 shrink-0 items-center justify-between px-7 text-[13px] font-semibold text-white">
        <span>{time}</span>
        <span className="absolute left-1/2 top-2 h-7 w-24 -translate-x-1/2 rounded-full bg-black" />
        <span className="flex items-center gap-1 text-[11px]">
          <span className="tracking-tighter">▂▄▆</span>
          <span className="inline-block h-[10px] w-[20px] rounded-[3px] border border-white/70 p-[1px]">
            <span className="block h-full w-3/4 rounded-[1px] bg-white" />
          </span>
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      <div className="absolute bottom-2 left-1/2 z-20 h-1 w-28 -translate-x-1/2 rounded-full bg-white/80" />
    </div>
  );
}
```

- [ ] **Step 2: MessageText.tsx**

```tsx
import { DEMO_REVIEW_URL } from "../types";

/** Renders bubble text; the demo review link opens the in-page popup instead of navigating. */
export function MessageText({ text, onOpenReview }: { text: string; onOpenReview: () => void }) {
  const parts = text.split(DEMO_REVIEW_URL);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <button type="button" onClick={onOpenReview} className="break-all text-left text-[#4ea1ff] underline">
              {DEMO_REVIEW_URL.replace("https://", "")}
            </button>
          )}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 3: SmsBubble.tsx and WhatsAppBubble.tsx**

```tsx
// SmsBubble.tsx
import type { DemoMessage } from "../types";
import { MessageText } from "./MessageText";

/** iMessage look for an SMS thread: grey incoming, green outgoing. */
export function SmsBubble({ msg, tail, onOpenReview }: { msg: DemoMessage; tail: boolean; onOpenReview: () => void }) {
  const mine = msg.role === "visitor";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${tail ? "mb-2" : "mb-[3px]"}`}>
      <div
        className={`max-w-[78%] px-3.5 py-2 text-[15px] leading-snug ${
          mine ? "bg-[#34c759] text-white" : "bg-[#26252a] text-white"
        } ${tail ? (mine ? "rounded-[20px] rounded-br-[6px]" : "rounded-[20px] rounded-bl-[6px]") : "rounded-[20px]"}`}
      >
        <MessageText text={msg.text} onOpenReview={onOpenReview} />
      </div>
    </div>
  );
}
```

```tsx
// WhatsAppBubble.tsx
import type { DemoMessage } from "../types";
import { MessageText } from "./MessageText";

function hhmm(at: string | null): string {
  const d = at ? new Date(at) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** WhatsApp dark look: grey incoming, green outgoing, time and ticks inside the bubble. */
export function WhatsAppBubble({ msg, tail, onOpenReview }: { msg: DemoMessage; tail: boolean; onOpenReview: () => void }) {
  const mine = msg.role === "visitor";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${tail ? "mb-2" : "mb-[2px]"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-2.5 pb-1 pt-1.5 text-[14.5px] leading-snug text-[#e9edef] ${
          mine ? "bg-[#005c4b]" : "bg-[#202c33]"
        } ${tail ? (mine ? "rounded-tr-none" : "rounded-tl-none") : ""}`}
      >
        <MessageText text={msg.text} onOpenReview={onOpenReview} />
        <span className="float-right ml-2 mt-1.5 text-[10.5px] text-[#8696a0]">
          {hhmm(msg.at)}
          {mine && <span className="ml-1 text-[#53bdeb]">✓✓</span>}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: CustomerPhone.tsx**

```tsx
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, Plus, SendHorizontal } from "lucide-react";
import type { ReviewCopy } from "../copy";
import type { DemoMessage, Skin } from "../types";
import { PhoneFrame } from "./PhoneFrame";
import { SmsBubble } from "./SmsBubble";
import { WhatsAppBubble } from "./WhatsAppBubble";

interface Props {
  copy: ReviewCopy;
  skin: Skin;
  onToggleSkin: () => void;
  agent: string;
  messages: DemoMessage[];
  typing: boolean;
  onSend: (text: string) => void;
  onOpenReview: () => void;
  time: string;
}

export function CustomerPhone({ copy, skin, onToggleSkin, agent, messages, typing, onSend, onOpenReview, time }: Props) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const wa = skin === "wa";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing]);

  const submit = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  const Bubble = wa ? WhatsAppBubble : SmsBubble;
  const initial = (agent || "?").trim().charAt(0).toUpperCase();

  return (
    <PhoneFrame time={time}>
      <div className={`flex shrink-0 items-center gap-2 border-b px-3 pb-2 ${wa ? "border-transparent bg-[#202c33]" : "flex-col border-white/10 bg-[#1c1c1e]/90"}`}>
        {wa ? (
          <>
            <ChevronLeft className="h-5 w-5 text-[#e9edef]" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6b7c85] text-sm font-semibold text-white">{initial}</div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium text-[#e9edef]">{agent}</div>
              {/* The nearly invisible channel switch: tap the subtitle. */}
              <button type="button" onClick={onToggleSkin} className="text-[11px] text-[#8696a0]">{copy.channelWa}</button>
            </div>
          </>
        ) : (
          <>
            <ChevronLeft className="absolute left-3 top-14 h-5 w-5 text-[#0a84ff]" />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-[#a1a1aa] to-[#6b6b73] text-lg font-semibold text-white">{initial}</div>
            <div className="text-[12px] font-medium text-white">{agent}</div>
            <button type="button" onClick={onToggleSkin} className="text-[10px] text-white/45">{copy.channelSms}</button>
          </>
        )}
      </div>

      <div ref={listRef} className={`min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3 ${wa ? "bg-[#0b141a]" : "bg-black"}`}>
        {!wa && (
          <div className="mb-3 text-center text-[11px] text-white/45">
            {copy.smsDivider}
            <br />
            {copy.today}
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={m.id} msg={m} tail={messages[i + 1]?.role !== m.role} onOpenReview={onOpenReview} />
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className={`flex gap-1 px-3.5 py-3 ${wa ? "rounded-lg bg-[#202c33]" : "rounded-[20px] bg-[#26252a]"}`}>
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex shrink-0 items-center gap-2 px-3 pb-7 pt-2 ${wa ? "bg-[#0b141a]" : "bg-black"}`}
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${wa ? "text-[#8696a0]" : "bg-[#26252a] text-white/70"}`}>
          <Plus className="h-4 w-4" />
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={wa ? "" : copy.placeholder}
          className={`min-w-0 flex-1 rounded-full px-3.5 py-1.5 text-[14px] text-white outline-none placeholder:text-white/35 ${
            wa ? "bg-[#202c33]" : "border border-white/15 bg-transparent"
          }`}
        />
        <button
          type="submit"
          aria-label="Send"
          className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${wa ? "bg-[#00a884]" : draft.trim() ? "bg-[#34c759]" : "bg-[#3a3a3c]"}`}
        >
          {wa ? <SendHorizontal className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>
    </PhoneFrame>
  );
}
```

- [ ] **Step 5: ManagerPhone.tsx**

```tsx
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, PhoneCall, Sparkles, Star } from "lucide-react";
import type { ReviewCopy } from "../copy";
import type { ManagerEvent } from "../types";
import { PhoneFrame } from "./PhoneFrame";

interface Props {
  copy: ReviewCopy;
  company: string;
  firstName: string;
  events: ManagerEvent[];
  time: string;
  dateLabel: string;
}

export function ManagerPhone({ copy, company, firstName, events, time, dateLabel }: Props) {
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const name = firstName || "Jamie";

  return (
    <PhoneFrame time={time} className="bg-gradient-to-b from-[#26324a] via-[#1a2233] to-[#121826]">
      <div className="flex flex-1 flex-col items-center px-4 pt-6 text-white">
        <Lock className="h-4 w-4 text-white/80" />
        <div className="mt-1 text-[64px] font-semibold leading-none tracking-tight">{time}</div>
        <div className="mt-2 text-[15px] text-white/80">{dateLabel}</div>

        <div className="mt-6 w-full space-y-2">
          <AnimatePresence initial={false}>
            {events.map((ev) => (
              <motion.button
                type="button"
                key={ev.id}
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                onClick={() => ev.kind === "draft" && ev.draft && setOpenDraft(ev.draft)}
                className="w-full rounded-2xl bg-white/15 p-3 text-left backdrop-blur-md"
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-white/60">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-[#f5b301]">
                    {ev.kind === "alert" ? <PhoneCall className="h-2.5 w-2.5 text-black" /> : ev.kind === "review" ? <Star className="h-2.5 w-2.5 text-black" /> : <Sparkles className="h-2.5 w-2.5 text-black" />}
                  </span>
                  <span className="flex-1">{ev.kind === "alert" ? company : copy.reviewApp}</span>
                  <span className="normal-case">{copy.now}</span>
                </div>
                <div className="text-[13.5px] font-semibold">
                  {ev.kind === "alert" && copy.alertTitle(name, ev.stars)}
                  {ev.kind === "review" && copy.reviewTitle(name, ev.stars)}
                  {ev.kind === "draft" && copy.draftTitle}
                </div>
                <div className="line-clamp-2 text-[12.5px] text-white/80">
                  {ev.kind === "alert" && `"${ev.quote}"`}
                  {ev.kind === "review" && (ev.text || "★".repeat(ev.stars))}
                  {ev.kind === "draft" && (ev.draft === null ? copy.draftLoading : ev.draft === "" ? copy.draftFailed : copy.draftTap)}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {events.length === 0 && (
          <div className="mt-auto mb-24 flex items-center gap-2 text-[12px] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
            {copy.silent}
          </div>
        )}
        <div className="mb-8 mt-auto text-[11px] text-white/60">{copy.managerLabel(company)}</div>
      </div>

      <AnimatePresence>
        {openDraft && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-[#1c1c1e] p-4 pb-8 text-white"
          >
            <div className="mb-2 text-[13px] font-semibold">{copy.draftTitle}</div>
            <p className="mb-4 whitespace-pre-wrap text-[13px] text-white/85">{openDraft}</p>
            {approved ? (
              <div className="text-[12.5px] text-[#34c759]">{copy.approved}</div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => setApproved(true)} className="flex-1 rounded-full bg-[#0a84ff] py-2 text-[13px] font-semibold">{copy.approve}</button>
                <button type="button" onClick={() => setOpenDraft(null)} className="flex-1 rounded-full bg-white/10 py-2 text-[13px]">{copy.edit}</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PhoneFrame>
  );
}
```

- [ ] **Step 6: ReviewPopup.tsx**

```tsx
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, X } from "lucide-react";
import type { ReviewCopy } from "../copy";

interface Props {
  copy: ReviewCopy;
  company: string;
  open: boolean;
  onClose: () => void;
  onPost: (stars: number, text: string) => void;
}

/** Mockup of Google's review dialog. Nothing leaves the page. */
export function ReviewPopup({ copy, company, open, onClose, onPost }: Props) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[380px] rounded-3xl bg-white p-6 text-center text-[#202124] shadow-2xl"
          >
            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-[#f1f3f4] p-1.5 text-[#5f6368]">
              <X className="h-4 w-4" />
            </button>
            <div className="text-[26px] font-medium tracking-tight">
              <span className="text-[#4285f4]">G</span><span className="text-[#ea4335]">o</span><span className="text-[#fbbc05]">o</span>
              <span className="text-[#4285f4]">g</span><span className="text-[#34a853]">l</span><span className="text-[#ea4335]">e</span>
            </div>
            <div className="mt-1 text-[18px] font-semibold">{company}</div>
            <div className="mt-1 text-[14px] text-[#5f6368]">{copy.popupQuestion}</div>
            <div className="my-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setStars(n)} aria-label={`${n}`}>
                  <Star className={`h-8 w-8 ${n <= stars ? "fill-[#fbbc05] text-[#fbbc05]" : "text-[#dadce0]"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.popupPlaceholder}
              rows={3}
              className="w-full resize-none rounded-xl border border-[#1a73e8] p-3 text-[14px] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                onPost(stars, text);
                onClose();
              }}
              className="mt-4 w-full rounded-full bg-[#1a73e8] py-3 text-[15px] font-semibold text-white"
            >
              {copy.popupPost}
            </button>
            <div className="mt-2 text-[11.5px] text-[#80868b]">{copy.popupDisclaimer}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add client/src/features/reviewDemo/components
git commit -m "$(cat <<'EOF'
feat(review-demo): customer phone with SMS/WhatsApp skins, manager lock screen, review popup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

(Verified in Task 9 once the page mounts them.)

---

### Task 9: Page, route, Demos wiring, browser verification

**Files:**
- Create: `client/src/pages/review-demo.tsx`
- Modify: `client/src/App.tsx` (lazy import near line 21, route near line 125, `isAppArea` near line 232)
- Modify: `client/src/features/demos/services.ts`
- Modify: `client/src/features/demos/components/ProspectDemoPanel.tsx` (around lines 57-65)

**Interfaces:**
- Consumes: Tasks 7 and 8; `tokenFromUrl(demoUrl)` from `services.ts`.
- Produces: route `/review-demo?token=<token>[&ch=wa|sms]`; `ServiceDef.reviewPage?: boolean`; `reviewDemoUrl(demoUrl: string): string` in `services.ts`.

- [ ] **Step 1: The page**

```tsx
// client/src/pages/review-demo.tsx
import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { CustomerPhone } from "@/features/reviewDemo/components/CustomerPhone";
import { ManagerPhone } from "@/features/reviewDemo/components/ManagerPhone";
import { ReviewPopup } from "@/features/reviewDemo/components/ReviewPopup";
import { copyFor } from "@/features/reviewDemo/copy";
import { useReviewDemo } from "@/features/reviewDemo/useReviewDemo";
import type { Skin } from "@/features/reviewDemo/types";

function useClock(locale: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return {
    time: now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, ""),
    date: now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" }),
  };
}

const LOCALES: Record<string, string> = { en: "en-GB", nl: "nl-NL", pt: "pt-BR" };

export default function ReviewDemoPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const [skin, setSkin] = useState<Skin>(params.get("ch") === "wa" ? "wa" : "sms");
  const [popupOpen, setPopupOpen] = useState(false);
  const demo = useReviewDemo(token);
  const lang = demo.state?.language || "en";
  const copy = copyFor(lang);
  const clock = useClock(LOCALES[lang.slice(0, 2)] || "en-GB");
  const company = demo.state?.company || "";

  return (
    <div className="min-h-[100dvh] bg-[#07080b] px-4 py-10 text-white">
      <div className="mx-auto flex max-w-[860px] flex-col items-center gap-12 md:flex-row md:items-start md:justify-center">
        <section className="flex flex-col items-center">
          <CustomerPhone
            copy={copy}
            skin={skin}
            onToggleSkin={() => setSkin((s) => (s === "sms" ? "wa" : "sms"))}
            agent={demo.state?.agent || company}
            messages={demo.state?.messages ?? []}
            typing={demo.typing}
            onSend={demo.send}
            onOpenReview={() => setPopupOpen(true)}
            time={clock.time}
          />
          <div className="mt-5 text-center">
            <div className="text-[13px] font-semibold uppercase tracking-[0.12em]">{copy.customerTitle}</div>
            <div className="text-[12.5px] text-white/55">{copy.customerHint}</div>
          </div>
        </section>

        <section className="flex flex-col items-center">
          <ManagerPhone
            copy={copy}
            company={company}
            firstName={demo.state?.firstName || ""}
            events={demo.events}
            time={clock.time}
            dateLabel={clock.date}
          />
          <div className="mt-5 text-center">
            <div className="text-[13px] font-semibold uppercase tracking-[0.12em]">{copy.managerTitle}</div>
            <div className="text-[12.5px] text-white/55">{copy.managerHint(company)}</div>
          </div>
        </section>
      </div>

      {(demo.reviewPosted || demo.state?.done) && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void demo.replay()}
            disabled={demo.busy}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-[14px] disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {copy.replay}
          </button>
        </div>
      )}

      {demo.error && <div className="mt-6 text-center text-[13px] text-white/60">{token ? copy.offline : copy.expired}</div>}

      <ReviewPopup copy={copy} company={company} open={popupOpen} onClose={() => setPopupOpen(false)} onPost={demo.postReview} />
    </div>
  );
}
```

Note: `demo.error` shows the offline line for any fetch error. A 404 from the engine means an expired link; if Task 6 showed the 404 body has `code: "not_found"`, you may refine this to `copy.expired`, but do not add a separate state machine for it.

- [ ] **Step 2: Route**

In `client/src/App.tsx`:
- after line 21 add `const ReviewDemo = lazy(() => import("@/pages/review-demo"));`
- after the `/voice-demo` route add `<Route path="/review-demo" component={ReviewDemo} />`
- in `isAppArea`, change `location.startsWith("/voice-demo");` to `location.startsWith("/voice-demo") ||\n    location.startsWith("/review-demo");`

- [ ] **Step 3: services.ts**

1. Add to `ServiceDef`, after `widgetPage?`:

```ts
  /** The review demo opens its own two-phone page (/review-demo?token=...,
   *  specs/review-demo). Chat runs on the web-demo path, so the page works on
   *  both the Pi and Vercel origins. */
  reviewPage?: boolean;
```

2. Change the reputation entry to `{ key: "reputation", labelKey: "services.reputation", icon: Star, campaignId: REPUTATION_DEMO_CAMPAIGN_ID, scenario: "inquired", reviewPage: true },` (the real number).

3. Add after `widgetDemoUrl`:

```ts
/** The two-phone review demo for a minted link, on the given origin. */
export function reviewDemoUrl(demoUrl: string, origin: string = window.location.origin): string {
  return `${origin}/review-demo?token=${tokenFromUrl(demoUrl)}`;
}
```

4. In `serviceCopyUrl`, after the `widgetPage` line add:

```ts
  if (svc.reviewPage) {
    let origin = window.location.origin;
    try {
      origin = new URL(session.demoUrl).origin;
    } catch {
      /* keep the CRM origin */
    }
    return reviewDemoUrl(session.demoUrl, origin);
  }
```

5. In `serviceOpenUrl`, after the `widgetPage` line add `if (svc.reviewPage) return reviewDemoUrl(session.demoUrl);`.

6. In `serviceOf`, add before `return "";`: `if (session.campaignId === REPUTATION_DEMO_CAMPAIGN_ID) return "reputation";` (the real number).

- [ ] **Step 4: ProspectDemoPanel.tsx**

Import `reviewDemoUrl` from `../services` alongside `widgetDemoUrl`. Replace the `const url = ...` expression with:

```tsx
      const url = svc.widgetPage
        ? widgetDemoUrl(body.demoUrl)
        : svc.reviewPage
          ? reviewDemoUrl(body.demoUrl)
          : svc.voice
            ? `${window.location.origin}/voice-demo?token=${tokenFromUrl(body.demoUrl)}`
            : demoOpenUrl(body.demoUrl);
```

and the stored whatsapp link line with `[svc.key]: { url, whatsapp: svc.voice || svc.reviewPage ? undefined : body.whatsappUrl },` (the review demo is browser-only).

Check whether the panel renders reputation as disabled because of a "soon" flag derived from `campaignId === null`; with a real id it should become clickable. If the label shows "soon" from somewhere else (grep `soon` in `client/src/features/demos`), remove that for reputation.

- [ ] **Step 5: Browser verification (playwright-cli)**

Using `playwright-cli` on `https://app.leadawaker.com` logged in as `leadawaker@gmail.com` / `Admin1234`:

1. Open `/platform/demos`, generate or pick a client, click the Reputation button. Expected: a link appears and opens `/review-demo?token=...` with two phones, the opener bubble in the customer phone naming the client's company persona, and "Silent until a human is actually needed" on the manager phone.
2. Type "yes that's me", then an answer, then "3". Expected: typing dots while waiting; the AI reply after "3" offers a manager call and contains the demo review link; within one poll the manager phone shows the "rated 3/5: needs a call" banner.
3. Tap the subtitle under the contact name. Expected: the skin flips SMS to WhatsApp and back; the messages stay.
4. Click the review link in the bubble. Expected: Google popup; set 5 stars, type "Tidy crew", Post. Expected: "New 5-star review" banner, then "AI drafted a reply" which fills in within a few seconds; tapping it opens the draft with Approve/Edit; Approve shows the approved line.
5. Click "Replay demo". Expected: customer phone back to just the opener, manager phone back to silent (this is Review Focus item 1).
6. Replay again and walk the 5-star path: answer, "5", "yes please". Expected: link sent after "yes please", no alert banner.
7. Open `/review-demo?token=<same>&ch=wa`. Expected: starts in the WhatsApp skin.
8. Resize to 390px wide. Expected: phones stack, manager phone second, no horizontal scroll.
9. Close the playwright browser.

- [ ] **Step 6: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add client/src/pages/review-demo.tsx client/src/App.tsx client/src/features/demos/services.ts client/src/features/demos/components/ProspectDemoPanel.tsx
git commit -m "$(cat <<'EOF'
feat(review-demo): two-phone review demo page, wired into the Demos Reputation button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Prompt check across languages and ratings

**Files:** none unless the prompt needs changes (then `src/automations/reputation_prompts.py`, re-run Task 4 tests).

**Interfaces:**
- Consumes: everything above.
- Produces: a short results table in the final report to Gabriel.

- [ ] **Step 1: Run the matrix in the browser demo**

For each language EN, NL, PT (mint one Reputation link per language on the Demos page) run five conversations: ratings 5, 4, 3, 1, and "wrong person". Use Replay between runs. For each, record: did the AI ask one question at a time, was the language right, did every rated path of 4 or less get the link and a callback offer, did 5 get the link only after "yes", did "wrong person" close politely.

- [ ] **Step 2: Fix only patterns, not single conversations**

A change to `DEFAULT_CONVERSATION_PROMPT` is justified only by a failure that repeats across at least two conversations. Report changes as "should fix, test it", never "fixes it".

- [ ] **Step 3: Commit any prompt change (engine repo)** with a message describing the pattern it addresses, then `pm2 restart leadawaker-engine`.
