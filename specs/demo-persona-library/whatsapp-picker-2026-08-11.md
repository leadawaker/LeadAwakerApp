# WhatsApp saved-client picker (`/clients`, `/client <id>`)

Small addendum to the demo persona library (see `plan.md`): lets a VIP pick a saved
Client from an active WhatsApp demo, instead of only through the CRM's Share dialog or
`/generate <niche>` (which always burns a model call, even for a niche already saved).

## Commands

- `/clients` — lists saved Clients (`Niche_Vocabulary` rows with `isDemoClient = true`),
  each tagged with its real DB id: `` `/client <id>` — <label> — <company> ``.
- `/client <id>` — switches the current WhatsApp demo session to that Client: resets
  history and replays the opener, exactly like `/generate` does today.

Both are VIP-only (`VIP_PHONES`), and both require an active campaign-60 session — same
`_NO_SESSION_PERSONA` refusal every other per-session command in `demo_commands.py` uses.

The id is the table's real serial id, not an ephemeral list index. `/clients` and
`/client <id>` can be sent in either order, any time, with no session state connecting
them — this mirrors `/campaign` (`/campaign` lists ids, `/campaign <id>` switches,
independently).

## Why no new Express endpoint

Both underlying operations already exist:

- **Listing** is a direct read against `Niche_Vocabulary` over the shared Postgres pool
  (`tools/db/connection.py`), the same way `_list_campaigns()` already reads `Campaigns`
  directly for `/campaign`'s list. No business logic to duplicate — it's a SELECT.
- **Switching** reuses `POST /api/demo/niche-context` (`server/routes/demo.ts:323-356`),
  which already accepts a `clientNiche` param and re-picks a saved Client without a model
  call (`demoClientToContext`, same function the CRM's create-link path uses). The route's
  own comment anticipated this: *"The engine sends this when the VIP's free text exactly
  matches a saved Client"* — `cmd_generate` never actually sends `clientNiche` today, so
  this was dead capability until now.

So `/client <id>` is: resolve `id` → `niche` text (one query), call `/api/demo/niche-context`
with `clientNiche` set, then run the same tail `cmd_generate` already runs (carry over
`agent_name`/`ai_disclosure` from the old context, `_replace_demo_niche`,
`_reset_lead_history`, `_send_first_message_for_lead`).

## Implementation (all in `automations/src/webhooks/demo_commands.py`)

1. `_list_saved_clients(lang: str) -> list[dict]` — new helper, mirrors `_get_campaign`'s
   shape:
   ```sql
   SELECT id, niche, "nicheLabel", "companyNameTemplate"
   FROM p2mxx34fvbf3ll6."Niche_Vocabulary"
   WHERE "isDemoClient" = true
   ORDER BY id
   ```
   Label/company resolved per row with `lang` → `en` fallback (same fallback order the
   Express `demoClientToContext` uses).
2. `_get_saved_client(client_id: int) -> dict | None` — same table, `WHERE id = $1`, used
   by `/client <id>` to resolve the niche text key.
3. `cmd_clients(phone, lead) -> None` — no-arg listing, same shape as `cmd_campaign`'s
   empty-arg branch. Empty library replies with an explicit "no saved clients yet"
   message instead of an empty list.
4. `cmd_client(phone, lead, arg) -> None` — parses `arg` as an int id; on a bad/missing id,
   replies with usage + points at `/clients`. On a valid id: same campaign-60 guard as
   `cmd_generate`, calls `/api/demo/niche-context` with `clientNiche`, applies the same
   `agent_name`/`ai_disclosure` carry-over, `_replace_demo_niche`, `_reset_lead_history`,
   `_send_first_message_for_lead`. If the row exists but `demoClientToContext` returns
   nothing (vocabulary-only row, no persona saved — the same edge case
   `create-link`/`niche-context` already guard), report that plainly rather than replaying
   a hollow opener.
5. Dispatch table (`handle_vip_command`): add `/clients` → `cmd_clients`,
   `/client` → `cmd_client`.
6. `/help`: one new line under `*This session only:*`, next to `/generate`.

No Express changes, no schema changes, no new tables.

## Out of scope

- Not exposed to non-VIP phones (prospects never see these commands — matches every other
  command in this file).
- No pagination on `/clients` — the library is small enough today; revisit if it grows.
