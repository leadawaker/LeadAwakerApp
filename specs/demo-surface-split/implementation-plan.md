# Implementation Plan: Demo Surface Split

> **STATUS 2026-08-12: BUILT and verified live on the Pi.** All phases done, plus a
> Phase 5 added during implementation (see below). Two corrections found while building:
> the real columns are `first_name` and `"Source"` (not `firstName`/`source` as first
> written here), and the `Leads` table is schema-qualified `p2mxx34fvbf3ll6."Leads"`.
> Verification evidence is recorded at the bottom.

## Overview

Give each demo token two independent leads instead of one shared, claimed one:

- `wa-demo:<token>` — minted eagerly by the CRM at link-creation time. **Unchanged.**
- `web-demo:<token>` — minted lazily by the engine on the first browser GET, cloned from
  the WhatsApp lead.

Then delete the mutual-exclusion machinery (`_claim_for_web`, the four
`claimed_by_whatsapp` guards, and the page's handling of that error code).

**Two repos are involved:**

| Repo | Path | Restart |
|---|---|---|
| Automation engine (Python) | `/home/gabriel/automations/` | `pm2 restart leadawaker-engine` |
| CRM (Express + static page) | `/home/gabriel/LeadAwakerApp/` | auto via pm2 watch (~5-8s); `demo.html` is static, no restart |

Phase 1 is the whole behavioural change and is self-contained in the engine. Phases 2-3
are cleanup of now-dead code and stale comments in the CRM repo.

---

## Phase 1: Lazily create an independent browser lead

Replace claim-the-shared-lead with clone-into-your-own-lead, in
`/home/gabriel/automations/src/webhooks/web_demo_routes.py`.

### Tasks

- [x] Narrow `_find_lead(token)` to the browser lead only — match `web-demo:<token>`, drop `wa-demo:<token>` from the `ANY($1::text[])` array
- [x] Add `_find_wa_lead(token)` that resolves `wa-demo:<token>` (the persona source / template row)
- [x] Add `_get_or_create_web_lead(token)` — find-or-create the browser lead, race-safe [complex]
  - [x] Return the existing `web-demo:<token>` lead when there is one
  - [x] Otherwise read the `wa-demo:<token>` lead and clone its persona fields into a new row
  - [x] Return `None` when neither exists (unknown or expired token → 404)
  - [x] Serialize concurrent first-GETs with a transaction-scoped Postgres advisory lock
- [x] Delete `_claim_for_web()` entirely (no longer called)
- [x] Rewrite `web_demo_state` (GET `/{token}`) to call `_get_or_create_web_lead`, and remove both `claimed_by_whatsapp` guards (the `lead.get("phone")` test and the `startswith` test)
- [x] Remove the `claimed_by_whatsapp` guard from `web_demo_message` (POST `/{token}/message`)
- [x] Remove the `claimed_by_whatsapp` guard from `web_demo_restart` (POST `/{token}/restart`)
- [x] Update the module docstring: the token no longer "claims" a surface; it addresses two independent sessions
- [x] Restart the engine and confirm it comes up clean

### Technical Details

**File:** `/home/gabriel/automations/src/webhooks/web_demo_routes.py`

**Current `_find_lead` (lines ~90-104) — narrow it:**

```python
async def _find_lead(token: str) -> dict | None:
    """Resolve a demo token to its BROWSER lead, if one has been opened.

    Browser-only by design. The wa-demo: row is a separate, independent
    conversation now (see specs/demo-surface-split): matching it here is what
    used to let the two surfaces continue each other's transcript.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f'SELECT * FROM {fq(Table.LEADS)} '
            f'WHERE channel_identifier = $1 '
            f"AND created_at > NOW() - INTERVAL '{TOKEN_TTL_DAYS} days' "
            f'ORDER BY created_at DESC NULLS LAST LIMIT 1',
            f"web-demo:{token}",
        )
    return dict(row) if row else None


async def _find_wa_lead(token: str) -> dict | None:
    """The CRM-minted row for this token. Read as a persona template only:
    the browser never writes to it, never adds Interactions to it, and never
    rewrites its channel_identifier."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f'SELECT * FROM {fq(Table.LEADS)} '
            f'WHERE channel_identifier = $1 '
            f"AND created_at > NOW() - INTERVAL '{TOKEN_TTL_DAYS} days' "
            f'ORDER BY created_at DESC NULLS LAST LIMIT 1',
            f"wa-demo:{token}",
        )
    return dict(row) if row else None
```

**Replace `_claim_for_web` (lines ~107-121) with:**

```python
async def _get_or_create_web_lead(token: str) -> dict | None:
    """The browser's own lead for this token, created on first open.

    Two leads per token, not one claimed by whichever surface got there first.
    The old claim model let WhatsApp attach a phone to a lead the browser had
    already started on (its claim only tested `phone IS NULL`, which a browser
    claim never sets), so a prospect who opened the page and then WhatsApp
    picked up mid-transcript. Separate rows remove the shared resource instead
    of adding another guard to it.

    Cloned, not shared: campaign, name, language, demo_niche and demo_invited
    all come from the wa-demo row so both surfaces demo the same configured
    persona. `phone` stays NULL forever — that is what makes send_service
    short-circuit the transport and demo_recap skip the WhatsApp recap.
    """
    existing = await _find_lead(token)
    if existing is not None:
        return existing

    wa = await _find_wa_lead(token)
    if wa is None:
        return None          # unknown or expired token

    pool = get_pool()
    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        async with conn.transaction():
            # channel_identifier has no unique index, so two first-GETs racing
            # each other would otherwise both insert. Serialize on the token
            # itself; the lock releases with the transaction.
            await conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext($1))", f"web-demo:{token}"
            )
            row = await conn.fetchrow(
                f'SELECT * FROM {fq(Table.LEADS)} WHERE channel_identifier = $1 LIMIT 1',
                f"web-demo:{token}",
            )
            if row:                       # lost the race; the winner's row is fine
                return dict(row)

            row = await conn.fetchrow(
                f'INSERT INTO {fq(Table.LEADS)} '
                f'("Accounts_id", "Campaigns_id", first_name, language, "Source", '
                f' channel_identifier, "Conversion_Status", automation_status, '
                f' demo_invited, demo_niche, created_at, updated_at) '
                f'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) '
                f'RETURNING *',
                wa.get("Accounts_id") or 1,
                wa.get("Campaigns_id"),
                wa.get("first_name"),
                wa.get("language") or "en",
                "Web Demo",
                f"web-demo:{token}",
                "New",
                "demo_pending",      # never 'queued': campaign_launcher must skip it
                bool(wa.get("demo_invited")),
                wa.get("demo_niche"),
                now,
            )

    log.info("web_demo.lead_created", lead_id=row["id"], wa_lead_id=wa["id"],
             campaign_id=wa.get("Campaigns_id"))
    return dict(row)
```

**Column-name caution (this bit off, and was corrected during the build):** the real
columns are **`first_name`** and **`"Source"`** — *not* `firstName`/`source`, which is what
the Drizzle model calls them. The table is also schema-qualified: raw `"Leads"` fails with
*relation does not exist*, it must be `p2mxx34fvbf3ll6."Leads"` (`fq(Table.LEADS)` handles
this inside the engine). The codebase mixes quoted PascalCase (`"Accounts_id"`,
`"Campaigns_id"`, `"Source"`, `"Conversion_Status"`) with bare snake_case
(`first_name`, `language`, `channel_identifier`, `automation_status`, `demo_invited`,
`demo_niche`, `created_at`, `updated_at`). Confirm each against a live row before running:

```bash
cd /home/gabriel/automations && python3 -c "
import asyncio, os, asyncpg
async def m():
    c = await asyncpg.connect(os.environ['DATABASE_URL'])
    rows = await c.fetch(\"\"\"SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name='Leads' AND column_name IN
        ('Accounts_id','Campaigns_id','firstName','language','source','channel_identifier',
         'Conversion_Status','automation_status','demo_invited','demo_niche','phone',
         'demo_restarts','created_at','updated_at') ORDER BY column_name\"\"\")
    for r in rows: print(r['column_name'], '|', r['data_type'])
    await c.close()
asyncio.run(m())"
```

**`web_demo_state` (lines ~263-280) becomes:**

```python
@router.get("/{token}")
async def web_demo_state(token: str):
    """Everything the page renders, in one call. Also the poll endpoint.

    First call for a token creates the browser's own lead; later calls reuse it.
    """
    lead = await _get_or_create_web_lead(token)
    if lead is None:
        return _err(404, "not_found", "This demo link is not valid, or it has expired.")

    await _ensure_opener(lead)
    return await _build_state(lead, token)
```

Both guards at lines 271 and 274-277 are deleted with it.

**`web_demo_message` (lines ~290-292)** — delete:

```python
    identifier = str(lead.get("channel_identifier") or "")
    if not identifier.startswith("web-demo:"):
        return _err(409, "claimed_by_whatsapp", "This demo is already running in WhatsApp.")
```

`_find_lead` now only ever returns a `web-demo:` row, so the test can never fire.

**`web_demo_restart` (lines ~362-364)** — delete the identical three lines.

**Docstring (lines ~1-36)** — the "No transport" bullet stays accurate. Add, near it:

```
* **One token, two independent sessions.** The token addresses a browser lead
  (`web-demo:<token>`) and a WhatsApp lead (`wa-demo:<token>`) that share a
  persona and nothing else: separate rows, separate transcripts, separate
  restart budgets. Neither surface can advance or lock the other. Replaces an
  earlier first-writer-wins claim that let WhatsApp resume a transcript the
  browser had already started. See specs/demo-surface-split.
```

**Verify:**

```bash
pm2 restart leadawaker-engine && sleep 6 && pm2 logs leadawaker-engine --lines 40 --nostream
cd /home/gabriel/automations && grep -n "claimed_by_whatsapp\|_claim_for_web" src/webhooks/web_demo_routes.py   # expect no matches
```

---

## Phase 2: Drop the error code from the browser page

`claimed_by_whatsapp` can no longer be returned, so the page's handling of it is dead.

### Tasks

- [x] Remove the `claimed_by_whatsapp` branch from `handleError` in `demo.html`
- [x] Remove `claimed_by_whatsapp` from the `poll()` catch's fatal-error test

### Technical Details

**File:** `/home/gabriel/LeadAwakerApp/client/public/premium/demo.html`

Line ~576, delete:

```js
      } else if (err && err.code === "claimed_by_whatsapp") {
        fatal = { title: "Already running in WhatsApp", body: "This demo was opened on WhatsApp. Continue the conversation there." };
```

Line ~631, narrow to 404 only:

```js
        if (err && err.status === 404) return handleError(err);
```

Static file served by Vercel from `main` — no engine restart, but it **does** need a
deploy to reach `leadawaker.com` (see Phase 4).

---

## Phase 3: Correct the now-false comments in the CRM

No behaviour change; these comments actively describe the deleted model.

### Tasks

- [x] Fix the `buildDemoPageLink` docstring in `server/demo-session.ts` — it claims "whichever the prospect opens first claims it"
- [x] Delete the unused `findPendingLeadByToken` export, or document why it stays

### Technical Details

**File:** `/home/gabriel/LeadAwakerApp/server/demo-session.ts`

Lines ~801-808, replace the docstring:

```ts
/**
 * The browser demo link: /demo/<token>, served by client/public/premium/demo.html.
 * Same token as the wa.me link, but the two surfaces run independent
 * conversations: the engine keeps a separate lead per surface
 * (web-demo:<token> and wa-demo:<token>), created on first open. Opening one
 * never advances or locks the other. See specs/demo-surface-split.
 */
```

`findPendingLeadByToken` (line ~789) has **no callers anywhere in `server/`** — verified
with `grep -rn "findPendingLeadByToken" server/`. It queries `wa-demo:<token>`, which is
still the correct WhatsApp identifier, so it is not *wrong*, only unused. Prefer deleting
it; if kept, note that it resolves the WhatsApp lead specifically.

---

## Phase 4: Deploy

### Tasks

- [x] Commit the engine change in `/home/gabriel/automations/` and restart `leadawaker-engine`
- [x] Commit the CRM changes and push to `main` so Vercel redeploys `demo.html`

### Technical Details

The two repos are separate; the engine is **not** deployed by the CRM push.

```bash
# engine
cd /home/gabriel/automations && git add -A && git commit -m "fix(demo): one lead per surface, not one claimed by whichever opens first"
pm2 restart leadawaker-engine

# CRM — Vercel builds leadawaker.com from main
cd /home/gabriel/LeadAwakerApp && git add -A && git commit -m "fix(demo): drop the claimed_by_whatsapp path, surfaces are independent now"
git push origin HEAD:main
```

Note: `leadawaker.com` 308-redirects to `www.leadawaker.com`; check deploys with
`curl -sL` or the apex will look like a failure.

**Manual check after deploy** (the acceptance criteria, in order — no automated tests are
in scope):

1. Mint a fresh link from the Share button.
2. Open the browser link, send two messages.
3. Open the WhatsApp link from the same mint → must start at the **opener**.
4. Reload the browser tab → its own two-message transcript is still there, not WhatsApp's.
5. Restart from the browser → succeeds, WhatsApp thread unaffected.
6. Confirm two rows exist and the WhatsApp one was never rewritten:

```sql
SELECT id, channel_identifier, phone, "Campaigns_id", demo_invited, demo_restarts, created_at
FROM "Leads" WHERE channel_identifier IN ('wa-demo:<token>', 'web-demo:<token>')
ORDER BY created_at;
```

Expect exactly two rows; the `wa-demo:` row keeps its identifier, and its `phone` is NULL
until WhatsApp is actually opened.

---

## Phase 5: Tell the two surfaces apart in the CRM

Added during implementation, at Gabriel's request: *"in the lead info, where it says phone
number, if they go via the browser I imagine we are not capturing their number, so the
claim 'browser test' should be used."*

Building it surfaced a second, unrequested bug: `isDemo` in both card views tested
`Source === "WhatsApp Demo" || channel_identifier.startsWith("wa-demo:")`. A browser lead
matches neither, so it would have rendered as a **real client lead** — wrong styling, and a
`sourceLabel` shown where demo leads deliberately show none.

### Tasks

- [x] Add `client/src/features/leads/demoLead.ts` with `isDemoLead()` and `isBrowserDemoLead()`
- [x] Point `LeadCard.tsx` and `cardView/LeadListCard.tsx` at `isDemoLead()` so browser leads keep demo styling
- [x] Add a `readOnly` prop to `InlineEditField` in `leadDetail/atoms.tsx`
- [x] Show "Browser test" in the phone row of `leadDetail/LeadContactSection.tsx` for browser leads
- [x] Add `detail.browserTest` to `en` and `nl` leads locales

### Technical Details

`demoLead.ts` reads both casings (`channel_identifier`/`channelIdentifier`,
`source`/`Source`) because the leads list API and the detail endpoint disagree on which
they return.

**Never write a placeholder into the `phone` column.** `phone IS NULL` is load-bearing in
three places: `send_service` short-circuits the transport on it, `demo_recap` skips the
WhatsApp recap on it, and WhatsApp's own claim tests it. "Browser test" is display-only —
the field is rendered read-only (muted italic, no pencil affordance) rather than editable,
since there is no number to correct.

i18n: `detail.browserTest` = "Browser test" (en) / "Browsertest" (nl). Per project policy
new work is en+nl only; pt was dropped 2026-06-30.

---

## Verification (2026-08-12, live on the Pi)

Ran against two throwaway tokens seeded as `wa-demo:` leads (`first_name = 'SplitTest'`),
all four rows deleted afterwards (`SplitTest rows remaining: 0`).

| Check | Result |
|---|---|
| First browser GET creates its own lead | `web-demo:…` row created, `Source = 'Web Demo'`, persona cloned (campaign 60, name, `demo_invited = true`) |
| WhatsApp lead untouched by browser use | `channel_identifier` unchanged, `phone` still NULL, **0 Interactions** |
| Opener lands on the browser lead only | web lead 1 Interaction, wa lead 0 |
| Second GET is idempotent | still one web lead, still one opener |
| **6 concurrent first-GETs** | exactly **one** web lead + **one** opener — advisory lock holds |
| **The reported bug**: browser first, then WhatsApp claims | WhatsApp resolves to the `wa-demo:` row (not the browser's), claim succeeds, and that row still has **0 Interactions** → WhatsApp opens at its opener instead of resuming the browser transcript |
| Browser after WhatsApp claimed the token | `HTTP 200` with its own transcript (was `409 claimed_by_whatsapp`) |
| Restart from the browser while WhatsApp holds the token | `HTTP 200`; `demo_restarts` 0→1 on the **web lead only**, wa lead stays 0 (per-surface budgets, 5 each) |

**Not exercised live:** `POST /{token}/message` (would spend a real model call). The change
there is a pure deletion of a guard that can no longer fire, since `_find_lead` now only
ever returns a `web-demo:` row.

**Not type-checked:** per project rule, `npx tsc --noEmit` is only run when Gabriel asks.
