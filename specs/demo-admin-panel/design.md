# Browser demo: presenter panel (admin-only settings menu)

Status: **BUILT and verified live 2026-08-19.**
Date: 2026-08-19

## As built: what the design did not anticipate

Five things surfaced during implementation. Each is folded into the sections
below; collected here so the diff can be read against the design.

1. **A live text save must NOT repaint the panel.** The first cut repainted
   after every PATCH. Because the debounce fires 500ms after the last keystroke,
   that replaced the very input being typed into and dropped the caret. `patch()`
   now takes a `repaint` flag: false for the debounced text fields, true only
   for the language (which shows or hides the market control) and for the two
   restart fields. Verified by typing across the debounce window and confirming
   focus, caret and continued typing all survive.
2. **Which Client a link came from was not recorded anywhere.** `create-link`
   built the persona from a saved Client but stamped nothing identifying it, so
   the picker opened on "Campaign default" even for a link minted from a Client.
   Both mint paths now write `client_niche` into the blob. It is inert to the
   engine: `_overlay_demo_niche_onto_campaign` copies an explicit key list and
   ignores anything not on it. Links minted before this key existed report empty,
   which reads correctly as "not set from the library".
3. **The ⋯ collides with the header below 1080px.** There `.hdr-inner` wraps to
   two or three rows, so a button centred on the header's full height lands on
   the client pill, and at `left:14px` it overlaps the logo as well. Pinned to
   the first row with a 52px gutter on `.hdr`.
4. **Generate takes an optional free-text niche.** One input, and it is the
   difference between re-minting the Client already loaded and creating a demo
   for a brand new prospect niche without leaving the page. It reuses the
   `niche` parameter `create-link` already documents.
5. **The quote/no-quote switch had to become a real control** (added on Gabriel's question,
   2026-08-19). The first cut shipped a "Scenario" select reading `inquired` / `deciding` that did
   nothing on its own: it was only an argument to a Client switch and to Generate, so flipping a
   running demo between quoted and scoping still meant using the Restart popover. Three changes:
   - Relabelled to **"Lead has a quote?" · "Never got a quote" / "Already has a quote"**, the engine's
     own words (`_OPTION_LABELS`, `demo_restart.py:64`) and the same two the Restart popover shows.
     One switch must not have two names.
   - Changing it now restarts through the engine's scenario path (`ctx.restart(value)` →
     `doRestart(scenario)` → `POST /restart {scenario}`). Deliberately NOT a `demo_niche` write from
     Express: `restart_demo()` re-stages the persona itself via `_patch_demo_niche`, and writing
     `what_lead_did` / `lead_stage` here would be a second copy of that logic, free to drift.
   - Disabled with a note on a public session, because the engine 403s `not_invited` and offering a
     control that will be refused is worse than not offering it.

   **The current value must be read from `lead_stage`, not `scenario`.** A scenario restart never
   writes a `scenario` key, so the select reported whatever the link was minted with while the
   conversation had already switched. `lead_stage` is written by both paths, in two vocabularies
   (`demoClientToContext` writes `deciding`, the engine writes `quoted`), so both are accepted.
   Verified in both directions: the config now flips with the quote panel.

6. **`doRestart()` returns its promise.** The panel reported "Restarting…" and sat on it forever,
   which reads as a hang even though the demo behind it restarted fine. It now settles to
   "Now: already has a quote" / "Now: never got a quote", or to a failure.

7. **Testing the page requires a cache-busting reload.** The demo modules and
   `demo.css` are plain static files with no build step or content hash, so a
   browser holds the previous version across a normal reload. Two apparent bugs
   during verification were both stale modules. Reload the stylesheet with a
   query string, or use a fresh browser profile.

Surface: `client/public/premium/demo/` (the `/demo/<token>` page) plus `server/routes/demo.ts`.
The Python engine is **not** touched. `automations/src/webhooks/demo_commands.py` and the WhatsApp
VIP command flow stay exactly as they are.

## The ask

Gabriel wants to reconfigure a running browser demo without leaving the page: generate a new demo,
share the link (browser and WhatsApp), pick a different saved Client, and change the lead's name,
the company name, the AI disclosure and the language. Changes should take effect on their own, with
no separate save-and-reload step. Visible to Gabriel only.

## Why this is small

Nearly all of it already exists and is already auth-gated:

| Need | Already built |
|---|---|
| Admin detection | `server/routes/demo.ts:630` computes `unlimited` from the CRM session |
| Generate a demo | `POST /api/demo/create-link` (`demo.ts:370`), takes every field in the ask |
| Client list | `GET /api/demo/clients` (`demo.ts:169`) |
| Browser link | `buildDemoPageLink()` (`demo-session.ts:916`) |
| WhatsApp link | `waLink`, already injected onto the state payload (`demo.ts:653`) |
| Popover without re-render | `setPop()` (`main.js:323`) |

The only genuinely new server code is one endpoint that edits the running session.

## Decisions (Gabriel, 2026-08-19)

1. **Panel lives on the demo page**, not in a new CRM page. The demo page already has an admin
   signal, so a CRM console would add a route and an iframe to solve an already-solved problem.
2. **Smart per field.** Name, company and language apply live to the running conversation. Client
   and AI disclosure restart the demo, with a confirm.
3. **Scenario and market are in the panel too**, so Generate covers every knob `create-link` accepts.
4. **English only.** The panel never reaches a prospect, so `copy.js` is not touched and no new keys
   land in the `en`/`nl`/`pt` packs.
5. **Browser demo only.** No engine changes, no changes to the WhatsApp VIP commands.

---

## Part 1: the gate

`server/routes/demo.ts:629-630` already runs, on every state poll:

```js
const user = req.isAuthenticated() ? req.user : undefined;
const unlimited = !!user && (user.accountsId === 1 || user.role === "Owner" || user.role === "Admin");
```

The state response has an injection block at `demo.ts:652-656` that already adds `waLink`. Add one
line beside it:

```js
body.admin = unlimited;
```

That is the whole gate. Consequences worth stating plainly:

- A prospect never receives the markup, not merely a hidden button. The panel is absent from the DOM.
- No query parameter, no PIN, no localStorage flag, nothing to leak in a screen recording.
- The panel appears wherever your CRM session cookie reaches the API. **Verify during implementation**
  which of `app.leadawaker.com` and `leadawaker.com` actually deliver the cookie: the Vercel front end
  talks to `api.leadawaker.com` cross-site, so the panel may only appear on the Pi-served origin. If
  it does not appear on `leadawaker.com`, that is a cookie `SameSite` question, not a bug in this
  feature, and it should be decided separately rather than worked around with a URL secret.
- Every write endpoint below re-checks the same condition server-side. The client flag decides
  rendering only, never authority.

## Part 2: the panel

### Trigger

A `⋯` button at the **left** end of `.hdr-inner` in `main.js` `render()` (currently the block at
`main.js:148-156`, which starts with `.hdr-logo`). Rendered only when `s.admin` is true, in the same
shape as the existing `s.invited` gate on the bump button (`main.js:160-165`).

Icon is `⋯`, not `☰`. A hamburger promises navigation and there is none here. This mirrors the
reasoning already settled in `specs/demo-composer-voice/design.md`.

### The panel lives OUTSIDE `root`

This is the most important implementation decision in the document, and getting it wrong is the
difference between a panel that works and one that eats every keystroke.

`render()` does `root.innerHTML = ...` (`main.js:103`) on every poll that changes anything. Anything
holding user input inside that tree is destroyed and rebuilt. The page already pays this tax twice:
the composer mirrors its textarea into a module-level `draft` var and restores it on each render
(`main.js:40`, `360`, `366`), and recording suppresses rendering wholesale behind a `needsRender`
flag (`main.js:101-107`, `63-65`). Reproducing that bookkeeping for seven panel controls, each with
its own focus and caret state, would be the bulk of the work and the bulk of the bugs.

So: **build the panel once into `document.body`, not into `root`.** It is admin chrome, not demo
content, and `render()` then cannot touch it. This is the same escape hatch the voice spec chose for
the singleton `<audio>` element, and for the same reason.

What follows from that:

- The panel is constructed on first open (lazily, so a prospect's page never builds it) and its
  listeners are bound once, not re-bound per render.
- Inputs keep their value, focus and caret across polls for free. No mirror variables.
- Only the `⋯` trigger lives inside the header and is re-rendered. It is stateless, so it just
  re-binds on each render exactly as `#bump` and `#restart-toggle` already do (`main.js:354`).
- The panel reads current values when it opens, not continuously, so a poll landing mid-edit cannot
  overwrite what is being typed.

Open/close still follows the `setPop()` precedent (`main.js:323-329`): toggle a `hidden` attribute
and `aria-expanded` rather than re-rendering. It needs its own `adminOpen` variable alongside
`popOpen`, and the existing outside-click and Escape handlers (`main.js:333-343`) must close
whichever is open.

Below 700px the panel renders as a bottom sheet: `position: fixed`, `left/right/bottom: 0`, rounded
top corners, slide-up, dimmed backdrop. Same treatment chosen for the restart popover, and for the
same reason: on a phone the controls belong under the thumb, not at the top of the screen.

### Contents

Three groups, in this order.

**Group 1: live fields.** Edit the running conversation, no restart.

- Lead first name (text input)
- Company name (text input)
- Language (`en` / `nl` / `pt`, segmented)

Text inputs debounce at 600ms and commit on blur. Language commits on click.

**Group 2: restart fields.** Each shows an inline "restarts the demo" note and asks for confirmation
before firing.

- Client (select, from `GET /api/demo/clients`)
- AI disclosure (`off` / `opener` / `second_message`)
- **Lead has a quote?** (`Never got a quote` / `Already has a quote`) — the quote/no-quote axis.
  `inquired` resolves to conversation mode "scoping" and shows no quote panel; `deciding` resolves
  to "decision" and shows it. Invited links only. See "as built" item 5.

**Group 3: actions.** Two distinct jobs that must not be conflated.

*This session* (for continuing or handing over the demo you are currently in):

- **Copy this link.** The current page URL.
- **Open in WhatsApp.** `s.waLink`, already on the state payload.

*A new demo* (the prospect-facing path):

- **Generate.** Mints from the panel's current values via `POST /api/demo/create-link`, then
  **reveals the result rather than navigating**: the returned `demoUrl` and `whatsappUrl` appear as
  two rows with a copy button each, plus an "Open it" link. Same shape as the campaigns share panel
  (`client/src/features/campaigns/components/detailView/atoms.tsx`).

The separation is the point, and it is the single most important thing in this group. The current
token is the session Gabriel has been driving; sending it to a prospect drops them into a
half-finished conversation with someone else's messages in it. A prospect link must always be freshly
minted. Label the two groups so that mistake is impossible to make by accident: "this session" and
"send to a prospect".

The panel's own **Lead name** field doubles as the prospect's name on Generate, which is what makes
this a complete prospect-link flow: type their name, pick their Client, generate, share. `firstName`
is required by `create-link`, so Generate is disabled while the name field is empty.

`create-link` reports `generated` and `reused` on the response. Surface them: a link that fell back
to a generic context instead of the model's niche detail looks identical to a good one, and sending a
prospect a generic demo believing it is theirs is the worst outcome this panel can produce.

Generate also needs **scenario** (`inquired` / `deciding`) and **market** (`uk` / `us` / `nl`), per
decision 3. Market is only meaningful when the language is English (`create-link` resolves `nl` and
`pt` markets internally), so hide the market control unless the language is `en` rather than
rendering a field that silently does nothing.

### Why each field lands where it does

- **Language** re-reads cleanly. `web_demo_routes.py:448` reads `Leads.language` when building state,
  and the AI reads it per reply. Switching mid-conversation is coherent and demos well.
- **Lead name** and **company name** are read per message through
  `_overlay_demo_niche_onto_campaign`, so a change takes effect on the next reply. Earlier messages
  keep the old name. That is visible but harmless, and it is the price of not throwing away the
  conversation for a typo fix.
- **AI disclosure** only ever fires on message one or two. Changing it mid-conversation would appear
  to do nothing, which is worse than restarting. Hence the restart.
- **Client** replaces the entire persona: vocabulary, scoping ladder, opener, company. A conversation
  cannot survive becoming a different business. Restart is the only honest option.

## Part 3: two new endpoints

Both in `server/routes/demo.ts`. Neither touches the engine.

### `GET /api/demo/:token/config` (prefill)

The panel has to open showing what is currently set, or every field is a guess. The state payload
carries `firstName`, `language` and `company` (verified in `web_demo_routes.py:445-450`) but **not**
`ai_disclosure`, the current Client key, the campaign id, the scenario or the market. Without those
the disclosure control and the Client picker would open blank and a Generate would silently drop the
campaign.

Rather than add them to the engine's state payload (decision 5 forbids engine changes, and widening
a payload that is polled every 1.6 to 6 seconds to serve a panel that opens occasionally is the wrong
trade anyway), Express reads the lead row directly and returns the config on demand. Called once per
panel open.

Returns `firstName`, `language`, `companyName`, `aiDisclosure`, `clientNiche`, `campaignId`,
`scenario`, `market`, reading the scalars from the lead columns and the rest out of the `demo_niche`
JSON blob.

### `PATCH /api/demo/:token/config` (writes)

**Auth:** `requireAuth`, plus the same `accountsId === 1 || role === "Owner" || role === "Admin"`
condition as the state route. Factor that predicate into a small named helper and use it in both
places, so the gate cannot drift between the route that shows the panel and the route that obeys it.

**Target row:** the lead whose `channel_identifier` is `web-demo:<token>`.

This is the critical detail. Per `specs/demo-surface-split`, each token has **two independent leads**:
`web-demo:<token>` for the browser page and `wa-demo:<token>` for WhatsApp
(`demo-session.ts:889`, `web_demo_routes.py:190`). Writing the wrong one would edit the WhatsApp demo
and leave the browser page unchanged, which looks exactly like the endpoint silently failing. The
browser row is created by the engine on first open, so 404 when it is absent rather than creating it.

Because the panel only ever writes `web-demo:`, this feature cannot disturb a WhatsApp demo, which is
what makes decision 5 hold by construction rather than by care.

**Body** (all optional, at least one required):

```
{ firstName?, language?, companyName?, aiDisclosure?, clientNiche?, scenario? }
```

**Writes:**

| Field | Destination |
|---|---|
| `firstName` | `leads.first_name` |
| `language` | `leads.language` |
| `companyName` | merge `company_name` into the `leads.demo_niche` JSON |
| `aiDisclosure` | merge `ai_disclosure` into the `leads.demo_niche` JSON |
| `clientNiche` | replace `demo_niche` wholesale via `demoClientToContext(row, language, scenario)` |

Merge, never overwrite, for the two scalar fields. `demo_niche` holds the whole persona and clobbering
it to set one key would erase the vocabulary and the ladder.

On `clientNiche`, reuse the validation `create-link` already performs at `demo.ts:397-420`:
`clientSupportsLanguage()` and the vocabulary-only-row check both return specific, actionable errors.
Surface those messages verbatim in the panel rather than a generic failure.

**Raw SQL gotchas** if this touches Postgres directly rather than through storage: the Leads columns
are `first_name` and `"Source"` (quoted), and table names need schema qualification. Documented in
`specs/demo-surface-split`.

**Response:** the updated config, so the panel can re-sync without waiting for the next poll.

**Restart:** for `clientNiche` and `aiDisclosure` the panel calls the existing restart endpoint after
a successful PATCH. The endpoint itself does not restart, so the two concerns stay separable and a
future field can pick either behaviour without an endpoint change.

**Verified: restart preserves `demo_niche`.** `restart_demo()` in
`automations/src/automations/demo_restart.py:172-253` wipes history and replays the opener, and its
only write to `demo_niche` is `_patch_demo_niche(lead_id, {"what_lead_did": ..., "lead_stage": ...})`
at line 253, which merges two keys. It never replaces the blob. So a persona written by the PATCH
above survives the restart that follows it. Had it re-seeded from the campaign or from the
`wa-demo:` row, the whole client-switch design would have been broken, and the failure would have
looked like the PATCH silently doing nothing.

## Part 4: the repaint gotcha

`signature()` in `format.js:74-86` is the page's change detector. It returns:

```
stage | done | turnsUsed | messages.length | last.text | last.id | last.kind
```

Renaming the company changes none of those. The header pill would sit stale until the AI's next
reply, which makes a working feature look broken. This is the same class of bug the voice-memo spec
caught for arriving transcripts.

Fix: the state payload already carries `company`, `firstName` and `language` (confirmed emitted at
`web_demo_routes.py:445-450`, not merely read). Append the three to the signature. Cheap, and it
makes every live field repaint on the poll that follows the write.

## Files touched (as built)

- `server/routes/demo.ts`: `body.admin` injection, extracted `isDemoAdmin()`, `DEMO_TOKEN_RE`,
  `GET` and `PATCH /api/demo/:token/config`, `client_niche` stamped on the `create-link` reuse path.
- `server/demo-session.ts`: `findWebDemoLead()`, `getWebDemoConfig()`, `updateWebDemoConfig()`.
- `client/public/premium/demo/admin.js`: **new**, the whole panel.
- `client/public/premium/demo/main.js`: `⋯` trigger in the header, `admin.init()`, `admin.bindTrigger()`,
  and the composer focus guard extended with `!admin.isOpen()`.
- `client/public/premium/demo/format.js`: `signature()` gains `company`, `firstName`, `language`.
- `client/public/premium/demo/icons.js`: `more-horizontal`.
- `client/public/premium/demo/demo.css`: panel, bottom sheet, mobile header gutter.

Not touched: `copy.js` (decision 4), the Python engine, `demo_commands.py`, `demo.test.mjs`
(the existing suite covers `signature()` indirectly and still passes; the new fields are additive).

## Verified live (2026-08-19, app.leadawaker.com)

- `admin: true` on the state payload for an Owner session, `false` for none; both config routes 401
  without a session and 403 for a non-admin one.
- A live company rename reaches the header pill on its own, which also proves the `signature()` fix:
  without it nothing the poll watches would have changed.
- Typing across the debounce keeps focus, caret and subsequent keystrokes.
- The `demo_niche` merge preserved all 31 persona keys while changing only `company_name`.
- A Client switch replaced the persona, and **the switch survived the restart that followed** —
  the design's central assumption, now confirmed rather than reasoned.
- The PT-Client-on-EN-demo guard returns the actionable message from the mint path.
- Generate minted both links and reported which Client it reused.
- Bottom sheet renders correctly at 390×780 with no header collision.

## Deliberately not in scope

- **Campaign switching.** Generate inherits the current session's campaign. Switching campaigns is a
  different demo entirely and the CRM already has that flow.
- **Editing the saved Client itself.** The panel picks from the library and overrides for this one
  lead. Editing a Client row is the Clients tab's job, and per `feedback_demo_niche_frozen_snapshot`
  those edits deliberately do not reach a live session.
- **Any change to the WhatsApp VIP commands.** They keep working, unchanged, on their own leads.

## Open questions

None. Ready for an implementation plan.
