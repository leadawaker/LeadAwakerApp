# Demo share panel: market, currency and defaults

**Date:** 2026-08-12
**Status:** designed, not built
**Surface:** `ShareButton` on the Campaigns detail view (Universal Demo, campaign 60 only)

## Problem

Three separate things, one panel.

**1. The panel defaults to the wrong conversation.** The share panel opens on
`decision` ("Has a quote"), while the API it posts to defaults to `inquired`
(`server/routes/demo.ts:47`, `:208`). The comment justifying the panel's default
cites the public homepage form, which is no longer the reason it should hold.
Most links minted here are for a lead who was never quoted.

**2. The niche section stays on screen when it cannot be used.** Picking a saved
Client disables "Their niche" but leaves it rendered, so the form is as tall on
the re-pick path as on the generate path, with a dead field in the middle of it.

**3. Currency is inferred from language, and language is not a market.** The
niche generator is told to price the quote in "the currency of the output
language's market" (`server/demo-session.ts:223`). That resolves cleanly for
Dutch (EUR) and, via the "Brazilian Portuguese" language label, for Portuguese
(BRL). It does not resolve for English: "the English market" is the UK, the US,
Ireland or Australia, and the model picks one on its own. That is where the
existing `£10,480` on the SolarMax persona came from.

The deeper issue is that *what the prospect reads in* and *which market they
sell into* are independent. A Dutch prospect demoed to in English must still see
euros. This is the same conflation already corrected for AI disclosure, which
used to be derived from the language picker and is now its own control.

## Decisions

- The English sub-control is a **market**, not a currency symbol. Picking NL
  under English means Dutch market, English language: euros, Dutch grid rules,
  Dutch housing stock.
- Default market for English is **NL**.
- The market toggle is **share-panel only**. The public `/try` demo form is not
  touched: it exists to get a stranger into a chat with as few questions as
  possible.
- The toggle **hides when a saved Client is picked**, because a saved Client's
  currency is already baked into its stored text and the control would do
  nothing.
- SolarMax becomes a Dutch-market persona in **both** languages.

## Requirements

### R1 — Conversation defaults to "Never quoted"

The `demoMode` state and its reset both initialise to `scoping`. The stale
comment explaining the `decision` default is replaced with one noting that
`scoping` matches the server's own `inquired` default.

### R2 — "Their niche" hides on the re-pick path

When `savedClient` is set, the "Their niche" label, input and hint are not
rendered. The now-unreachable `disabled` prop comes off the input.

"Their company" **stays visible and unchanged**, including its existing
`disabled={!niche.trim() && !savedClient}` rule: it is the per-link company
override that does not write back to the saved persona, and it is live on both
paths.

The typed `niche` value is **not** cleared when a saved Client is picked. The
request payload already ignores it (saved Client wins), and keeping it means
switching back to "Generate a new one" restores what was typed.

### R3 — Market toggle under Language

A three-button row (UK / US / NL), rendered directly beneath the Language row,
visible only when all of these hold:

- the campaign is the Universal Demo (`canGenerateNiche`)
- `language === "en"`
- no saved Client is selected

Default `nl`. Sent in the `/api/demo/create-link` body under the same
conditions.

### R4 — Market resolution lives in the generator

`generateNicheContext()` takes an optional market and resolves the effective
market and currency itself:

| Language | Market | Currency |
|----------|-------------|----------|
| `nl`     | Netherlands | EUR |
| `pt`     | Brazil      | BRL |
| `en`     | from the toggle, default NL | GBP / USD / EUR |

Resolving inside the generator rather than at the call site means
`/api/demo/niche-context` (the `/generate` command from Gabriel's WhatsApp)
inherits the rule with no schema change: English from the phone produces a
Dutch-market persona, the same as the panel.

The market instruction is **appended** to the system prompt after the prompt
body, the way the output-language line already is (`server/demo-session.ts:300`).
It names the market and the currency explicitly.

### R5 — The contradicting prompt clause is fixed in both copies

The `quote_context` clause reading "a total amount in the currency of the output
language's market" directly contradicts English-plus-Netherlands and must be
reworded to defer to the named target market.

It exists in two places and **both** must be edited or they drift:

1. `NICHE_GENERATOR_SYSTEM_FALLBACK` in `server/demo-session.ts`
2. the `universal_demo_niche_generator` row in `Prompt_Library`

Prompt_Library is the one that actually runs: `generateNicheContext` reads that
row first and only falls back to the in-file constant when the DB read fails or
the row is missing. A fix applied to only one copy is invisible until the other
path is hit.

### R6 — SolarMax moves to the Dutch market in both languages

`Niche_Vocabulary` row 45 (`niche: "solar energy installer"`,
`is_demo_client: true`) is currently a UK persona with only its `en` slots
filled. Currency and market leak into more than one field:

| Field | Today | Change |
|-------|-------|--------|
| `niche_label` | `Solar - UK` | `Solar - NL` |
| `quote_context` | `Total: £10,480`, scaffolding line | euro total, no scaffolding |
| `kb_template` | "starts from around £9,000", export tariff | euro figure, salderingsregeling ends 1 Jan 2027 |
| `enquiry_context` | "3-bedroom semi-detached home" | Dutch housing (rijtjeshuis / twee-onder-een-kap) |
| `scoping_ladder` | scaffolding, UK roof sections | Dutch roof types (schuin / plat), no scaffolding slot |
| `question_bank`, `objection_examples` | export-vs-savings framing | saldering-vs-self-consumption framing |
| all `nl` slots | empty, falls back to English | filled |

The English slots are **hand-patched, not regenerated**. Regenerating would
discard a well-tuned persona and risks the two languages describing different
companies, which matters because one row serves demos in either language. The
Dutch slots are written as the same company in Dutch, not a separate invention.

## Slice 2 — the landing page's own market (built same day)

The "out of scope" note below was wrong within hours of being written, because
the landing page already has a market and slice 1 put it out of step.

`client/public/premium/config.jsx` resolves `window.MARKET` from the `/uk` and
`/us` paths, then `?m=`, then the geo value `middleware.ts` injects from
`x-vercel-ip-country`, then `nl`. That market already drives the page's
currency, its deadline case study and the names in its illustrations, on the
stated reasoning that a Dutch name list in front of a UK prospect is a tell. It
is the same `"uk" | "us" | "nl"` union slice 1 introduced.

The demo form never sent it, so once slice 1 defaulted English to the
Netherlands, a visitor on `/uk` read a page priced in pounds and got a demo
quoting euros.

Three surfaces exist, and only two matter:

| URL | Variant | Demo behaviour |
|-----|---------|----------------|
| `leadawaker.com`, `/uk`, `/us`, `/nl` | solar | `preset: "solar"`, never called the generator |
| `leadawaker.com/home` | home improvement, same file, chosen by path | calls the generator |
| `/legacy` | retired | untouched |

**R7 — the form sends `window.MARKET`.** On both variants, since both paths now
consume it.

**R8 — `/home` passes it to the generator.** `market` joins
`universalSessionSchema` and reaches `generateNicheContext`. Language still wins
for `nl` and `pt`; only English reads the market. That precedence is deliberate
and unchanged from slice 1.

**R9 — the solar site picks a saved Client by market.**
`SOLAR_CLIENT_BY_MARKET` maps `nl` to `solar energy installer` (row 45) and `uk`
to `solar energy installer uk` (row 49, created for this). A market with no
entry, which today means US, falls through to `buildSolarNicheContext()` as
before. So does a mapped market whose row has been renamed or deleted from the
Clients tab: the public page must not break because of an edit made in an admin
UI. The visitor's own company name still overrides the Client's default, exactly
as on the admin create-link path.

This replaces a hardcoded context with data that is editable from the Clients
tab without a deploy.

**Known consequence:** `buildSolarNicheContext` ships an empty `quote_context`
and `enquiry_context` on purpose, reasoning that a stranger who typed only a
first name should not be told they already said something specific. But the form
defaults to `scenario: "deciding"`, so the default public demo claimed a quote it
had no detail for. The saved Clients carry a real quote, so a stranger on
leadawaker.com now sees one. That is a visible change to the top-of-funnel page
and it was made deliberately: the visitor chose "already has a quote", so
honouring that choice is not the lie the original comment guarded against.

## Out of scope

- Retro-fitting a market onto the other four saved demo Clients (rows 43, 44,
  46, 47). They keep whatever currency they were generated with; regenerate them
  through the new toggle if and when they are next needed.
- A US solar Client. The US deadline case on the landing page is a different
  argument entirely (the §25D credit terminated after 31 Dec 2025), so a US
  persona is a copy job, not a currency swap. US falls through to the hardcoded
  context until one is written.
- Storing a market on the saved Client row. The persona's currency is already
  implicit in its stored text, and adding a column would create a second source
  of truth that the text could contradict.

## Verification

1. Mint a link on campaign 60 with a fresh niche, EN + market **NL** → quote
   totals in euros.
2. Mint the same niche with EN + market **UK** → quote totals in pounds. Confirms
   the toggle has teeth and the default is not hard-wired.
3. Mint with language **NL** → Dutch text, euros, no market row shown.
4. Pick a saved Client → niche field and market row both absent, company field
   still present and editable.
5. Open the share panel cold → "Never quoted" is preselected.
6. Mint SolarMax in EN and in NL → both quote in euros, both describe the same
   company.
