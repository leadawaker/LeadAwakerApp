# Demo Share Panel: Market & Currency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the demo share panel default to the never-quoted conversation, hide the niche field when a saved Client is picked, and let an English demo be pointed at a UK, US or Dutch market so the generated quote is priced in the right currency.

**Architecture:** The market is resolved inside `generateNicheContext()` rather than at each call site, so the panel, the public flow and the WhatsApp `/generate` command all inherit one rule. The resolved market is appended to the system prompt the same way the output language already is. Everything else is local state and conditional rendering in one component.

**Tech Stack:** React + TypeScript (Vite), Express, Drizzle ORM, PostgreSQL, react-i18next, OpenAI chat completions.

**Spec:** [`requirements.md`](./requirements.md)

## Global Constraints

- **No test framework exists in this repo.** `package.json` has no `test` script and neither vitest nor jest is installed. Do not scaffold one for this work. Every task below verifies against the running app or by exercising the function directly with `npx tsx`. Verification steps are mandatory, not optional: run them and paste the real output.
- **Never run `npx tsc --noEmit`** unless Gabriel explicitly asks. Do not run it "to be safe" after edits.
- **The app runs under pm2 and reloads itself.** Never run `npm run dev`. `server/` and `shared/` changes restart in roughly 5-8 seconds; check `pm2 logs` for the restart line before testing a server change.
- **No hardcoded user-facing strings.** Every new string goes through `react-i18next` in `client/src/locales/{en,nl,pt}/campaigns.json`. All three locales get the key in the same commit; a missing key falls back to English silently and you will not notice.
- **Never use em dashes** in code comments, commit messages, or copy.
- **Follow `UI_STANDARDS.md`.** The new control is a copy of an existing control's markup, so do not introduce new colors, spacing or classes.
- **Default market for English is `nl`** (the Netherlands, EUR). This is deliberate and Gabriel chose it.

## Known consequence, already accepted

Resolving the market inside `generateNicheContext()` means **every** caller inherits the English default, not just the share panel. That includes:

- `POST /api/demo/create-session`, the public homepage flow (`server/routes/demo.ts:149`)
- `POST /api/demo/niche-context`, the `/generate` command from Gabriel's WhatsApp (`server/routes/demo.ts:355`)

So after this change an English demo generated from the homepage or from his phone quotes in euros, where today the model picks a market on its own and usually lands on the UK. That is the intended behaviour of a single shared default. No toggle is added to either surface.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `client/src/features/campaigns/demoMode.ts` | modify | Gains `DEMO_MARKETS` / `DemoMarket`, the client half of the market vocabulary |
| `client/src/features/campaigns/components/detailView/atoms.tsx` | modify | `ShareButton`: scoping default, conditional niche block, market toggle, market in the payload |
| `client/src/locales/{en,nl,pt}/campaigns.json` | modify | `share.market`, `share.marketOptions.*`, `share.marketHint` |
| `server/demo-session.ts` | modify | `DemoMarket` type, `MARKET_PROFILE`, `resolveMarket()`, the appended market instruction, and the `quote_context` clause fix in the in-file fallback |
| `server/routes/demo.ts` | modify | `market` on the create-link zod schema, passed through to the generator |
| `Prompt_Library` row `universal_demo_niche_generator` | data | The same `quote_context` clause fix as the in-file fallback |
| `Niche_Vocabulary` row 45 (SolarMax) | data | Dutch-market English slots plus a full Dutch persona |

---

### Task 1: Panel defaults and the conditional niche block

Client-only, no server involvement. Covers spec R1 and R2.

**Files:**
- Modify: `client/src/features/campaigns/components/detailView/atoms.tsx:367-371`, `:403`, `:539-551`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks depend on. Task 3 edits the same component but different lines.

- [ ] **Step 1: Flip the conversation default to `scoping`**

Replace the state declaration and its comment at `atoms.tsx:367-371`:

```tsx
  // Which conversation this minted link should open in: a lead who was never
  // quoted, or one sitting on a quote. Defaults to "scoping" (never quoted),
  // which is also what the API itself defaults to when the field is omitted
  // (server/routes/demo.ts, `scenario` defaults to "inquired"). The panel used
  // to open on "decision" to match the public homepage form, which meant the
  // one surface that always sends the field disagreed with the one that does
  // not. Most links minted here are for a lead who was never quoted anyway.
  const [demoMode, setDemoMode] = useState<DemoMode>("scoping");
```

- [ ] **Step 2: Flip the same default in `reset()`**

At `atoms.tsx:403`, change `setDemoMode("decision");` to:

```tsx
    setDemoMode("scoping");
```

This matters: `reset()` runs on every popover close, so leaving it would make the default correct exactly once per page load.

- [ ] **Step 3: Hide the niche block when a saved Client is picked**

Wrap the whole "Their niche" `<div>` at `atoms.tsx:539-551`. The opening becomes:

```tsx
                    {/* Hidden, not disabled, on the re-pick path: a saved
                        Client already carries its own vocabulary, so the field
                        can never be used there and a greyed-out input is just
                        height. "Their company" below stays, because that one
                        IS live on both paths. */}
                    {!savedClient && (
                      <div>
                        <label className="block text-[12px] font-medium mb-1">{t("share.niche", "Their niche")}</label>
                        <input
                          type="text" value={niche} onChange={(e) => setNiche(e.target.value)}
                          placeholder={t("share.nichePlaceholder", "e.g. cabinet hardware, dental implants")}
                          maxLength={300}
                          className="w-full h-8 rounded-md border border-black/[0.125] bg-white px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors"
                        />
                        <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                          {t("share.nicheHint", "Leave blank to send the campaign as it is. Filling it in generates this prospect's own vocabulary, questions and opener.")}
                        </p>
                      </div>
                    )}
```

Note what changed inside: the `disabled={Boolean(savedClient)}` prop and the `disabled:opacity-50` class are gone, because the element no longer renders in the state that used them.

Do **not** clear `niche` when a saved Client is picked. The payload already ignores it (`savedClient` wins in the ternary at `atoms.tsx:428-432`), and keeping it means switching the dropdown back to "Generate a new one" restores what was typed.

Do **not** touch the "Their company" block at `atoms.tsx:552-568`. Its `disabled={!niche.trim() && !savedClient}` rule stays exactly as written.

- [ ] **Step 4: Verify in the running app**

The app is already running under pm2 and Vite hot-reloads the client. Open `app.leadawaker.com`, go to Campaigns, select the Universal Demo campaign (id 60), click Share, then Demo link.

Confirm all four:
1. "Never quoted" is the highlighted button under Conversation on first open.
2. Picking a saved Client from the dropdown makes the "Their niche" label, input and hint disappear.
3. "Their company" is still visible and typeable while a saved Client is selected.
4. Closing and reopening the popover shows "Never quoted" again, not "Has a quote".

- [ ] **Step 5: Commit**

```bash
git add client/src/features/campaigns/components/detailView/atoms.tsx
git commit -m "fix(demo): default the share panel to the never-quoted conversation

The panel opened on \"Has a quote\" while the API it posts to defaults to
\"inquired\", so the one surface that always sends the field disagreed with
the one that does not. Most links minted here are for a lead who was never
quoted.

Also hides \"Their niche\" on the saved-Client path instead of greying it
out. It can never be used there. \"Their company\" stays: that one is a
per-link override that works on both paths."
```

---

### Task 2: Market resolution in the generator, and the prompt clause fix

Server plus one data write. Covers spec R4 and R5. Do this before Task 3 so the API accepts `market` by the time the panel starts sending it.

**Files:**
- Modify: `server/demo-session.ts` (new types near the top of the niche-generator section, plus `:223` and `:263-300`)
- Modify: `server/routes/demo.ts:190-212`, `:263`
- Data: `Prompt_Library` row where `use_case = 'universal_demo_niche_generator'`

**Interfaces:**
- Produces, and Task 3 consumes:
  - `export type DemoMarket = "uk" | "us" | "nl"` from `server/demo-session.ts` (Task 3 declares its own client-side copy in `demoMode.ts`; the two are mirrored deliberately, the same way `DEMO_MODES` mirrors the server's scenario enum).
  - `generateNicheContext(niche: string, language: "en" | "nl" | "pt", scenario?: DemoScenario, market?: DemoMarket): Promise<NicheContext | null>` — the fourth parameter is new and optional, so the three existing call sites keep compiling untouched.
  - `POST /api/demo/create-link` accepts an optional body field `market: "uk" | "us" | "nl"`.

- [ ] **Step 1: Add the market vocabulary to `server/demo-session.ts`**

Insert immediately above `const NICHE_GENERATOR_SYSTEM_FALLBACK` (currently line 200):

```ts
/** The markets the English demo can be pointed at. English alone needs this:
 *  "the English market" is the UK, the US, Ireland or Australia, and left to
 *  itself the model picks one (which is where the £ on the SolarMax persona
 *  came from). Dutch and Portuguese each have one market and resolve on their
 *  own. Mirrored client-side in client/src/features/campaigns/demoMode.ts. */
export type DemoMarket = "uk" | "us" | "nl";

/** Every market the generator can be pointed at. Wider than DemoMarket: "br"
 *  is implied by the Portuguese language and never appears in the toggle. */
type ResolvedMarket = DemoMarket | "br";

const MARKET_PROFILE: Record<ResolvedMarket, { name: string; currency: string; symbol: string }> = {
  uk: { name: "the United Kingdom", currency: "GBP", symbol: "£" },
  us: { name: "the United States", currency: "USD", symbol: "$" },
  nl: { name: "the Netherlands", currency: "EUR", symbol: "€" },
  br: { name: "Brazil", currency: "BRL", symbol: "R$" },
};

/** Language and market are independent: a Dutch prospect demoed to in English
 *  still sells into the Netherlands and still needs euros. This is the same
 *  conflation already corrected for AI disclosure, which used to be derived
 *  from the language picker.
 *
 *  Resolving here rather than at each call site is deliberate: the public
 *  homepage flow and the /generate command from WhatsApp both call this
 *  function without a market, and both should get the same answer the share
 *  panel would give them. English defaults to the Netherlands. */
function resolveMarket(language: "en" | "nl" | "pt", market?: DemoMarket): ResolvedMarket {
  if (language === "nl") return "nl";
  if (language === "pt") return "br";
  return market ?? "nl";
}
```

- [ ] **Step 2: Fix the contradicting clause in the in-file fallback prompt**

In `NICHE_GENERATOR_SYSTEM_FALLBACK`, in the `quote_context` bullet (currently line 223), replace this exact fragment:

```
a total amount in the currency of the output language's market, plausible for this niche and this job size
```

with:

```
a total amount in the target market's currency, named in the Target market line at the end of this prompt, plausible for this niche and this job size in that market
```

Leave the rest of that bullet alone. This is the sentence that would otherwise fight the appended instruction on the English-plus-Netherlands combination.

- [ ] **Step 3: Take the market as a parameter and append it to the prompt**

Change the signature at `demo-session.ts:263-267` to:

```ts
export async function generateNicheContext(
  niche: string,
  language: "en" | "nl" | "pt",
  scenario: DemoScenario = "inquired",
  market?: DemoMarket,
): Promise<NicheContext | null> {
```

Then replace the single appended line at `demo-session.ts:300`:

```ts
  const profile = MARKET_PROFILE[resolveMarket(language, market)];
  system =
    system +
    `\n\nOutput language: ${langLabel}.` +
    `\nTarget market: ${profile.name}.` +
    ` Every money amount you write, including the quote total, its line items and any figure inside kb, must be in ${profile.currency} (${profile.symbol}) and priced realistically for ${profile.name}.` +
    ` This overrides any other instruction about which currency to use.` +
    ` Regulations, grid and tax rules, housing stock, units of measurement and company naming must all be the ones a business operating in ${profile.name} would actually deal with, regardless of the output language.`;
```

- [ ] **Step 4: Put the market in the user message too**

The user message already repeats the output language, so the model sees it twice. Do the same for the market. At `demo-session.ts:333`, change the user content to:

```ts
          { role: "user", content: `Business niche: ${niche}\nOutput language: ${langLabel}\nTarget market: ${profile.name} (${profile.currency})\nLead scenario: ${scenarioHint}` },
```

- [ ] **Step 5: Accept `market` on the create-link route**

In `server/routes/demo.ts`, add to `adminSchema` immediately after the `aiDisclosure` field (currently line 211):

```ts
    // Which market the prospect sells into, which is NOT the language they read
    // in: a Dutch firm demoed to in English still quotes in euros. Only sent
    // when the language is English; nl and pt resolve their own market inside
    // generateNicheContext().
    market: z.enum(["uk", "us", "nl"]).optional(),
```

Add `market` to the destructure at line 221:

```ts
      const { firstName, language, campaignId, niche, clientNiche, companyName, scenario, aiDisclosure, market } = parsed.data;
```

And pass it at line 263:

```ts
        const model = await generateNicheContext(niche, language, scenario, market);
```

Import the type alongside the existing imports from `../demo-session`. Leave the other two `generateNicheContext` call sites (`:149` and `:355`) untouched: they deliberately inherit the default.

- [ ] **Step 6: Apply the same clause fix to Prompt_Library**

This is the copy that actually runs. `generateNicheContext` reads the `universal_demo_niche_generator` row first and only falls back to the in-file constant when the read fails.

Write and run `/tmp/claude-1000/-home-gabriel-LeadAwakerApp/afdb81dc-71b9-485b-a12e-60e80e00c563/scratchpad/fix-prompt-clause.cjs`:

```js
const { Client } = require("pg");
const OLD = "a total amount in the currency of the output language's market, plausible for this niche and this job size";
const NEW = "a total amount in the target market's currency, named in the Target market line at the end of this prompt, plausible for this niche and this job size in that market";

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query(
    `select id, prompt_text from "p2mxx34fvbf3ll6"."Prompt_Library" where use_case = 'universal_demo_niche_generator'`,
  );
  if (rows.length !== 1) throw new Error(`expected 1 row, found ${rows.length}`);
  const text = rows[0].prompt_text;
  const hits = text.split(OLD).length - 1;
  // Guard, not ceremony: if the DB copy has drifted from the in-file one this
  // silently replaces nothing and the two paths disagree forever.
  if (hits !== 1) throw new Error(`expected exactly 1 occurrence, found ${hits}. The DB prompt has drifted; fix it by hand.`);
  await c.query(`update "p2mxx34fvbf3ll6"."Prompt_Library" set prompt_text = $1 where id = $2`, [text.replace(OLD, NEW), rows[0].id]);
  console.log(`patched Prompt_Library row ${rows[0].id}`);
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
```

Run it:

```bash
node --env-file=.env /tmp/claude-1000/-home-gabriel-LeadAwakerApp/afdb81dc-71b9-485b-a12e-60e80e00c563/scratchpad/fix-prompt-clause.cjs
```

Expected: `patched Prompt_Library row <n>`. If it throws "found 0", the DB prompt has drifted from the in-file fallback: stop, print both versions of that bullet, and ask Gabriel which one is current. Do not guess.

- [ ] **Step 7: Verify the generator actually swings the currency**

Wait for pm2 to restart the server (`pm2 logs --lines 20` shows the restart), then exercise the function directly. Write `.../scratchpad/market-check.ts`:

```ts
import { generateNicheContext } from "../../../../home/gabriel/LeadAwakerApp/server/demo-session";

async function run(market: "uk" | "us" | "nl") {
  const ctx = await generateNicheContext("bespoke kitchens", "en", "deciding", market);
  console.log(`\n===== market: ${market} =====`);
  console.log(ctx?.quote_context ?? "GENERATION FAILED (null)");
}

(async () => {
  await run("uk");
  await run("nl");
})();
```

Use an absolute import path that actually resolves from wherever you place the file, or simply put the script at the repo root as `market-check.ts` and delete it after. Run:

```bash
npx tsx --env-file=.env market-check.ts
```

Expected: the `uk` block quotes a total with `£`, the `nl` block quotes a total with `€`. Both should read as plausible kitchen prices, not the same number with a swapped symbol. Paste both blocks into the task report.

If either says `GENERATION FAILED (null)`, check `pm2 logs` for a `[demo-niche]` line: the function logs every null path.

- [ ] **Step 8: Commit**

```bash
rm -f market-check.ts
git add server/demo-session.ts server/routes/demo.ts
git commit -m "feat(demo): point the niche generator at a market, not a language

Currency was inferred from the output language, which resolves for nl (EUR)
and pt (BRL) but not for en: \"the English market\" is the UK, the US or
Ireland, and the model picked one on its own. Language and market are
independent, so a Dutch prospect demoed to in English now gets euros.

Resolution lives inside generateNicheContext rather than at each call site,
so the public homepage flow and the /generate command from WhatsApp inherit
the same rule. English defaults to the Netherlands.

The quote_context clause that told the model to use the output language's
currency directly contradicted English-plus-Netherlands. It exists in two
copies and both were fixed: the in-file fallback here and the
universal_demo_niche_generator row in Prompt_Library, which is the one that
actually runs."
```

Note the Prompt_Library edit is data, not a tracked file, so it is not in the commit. Say so in the task report.

---

### Task 3: The market toggle in the share panel

Client-only. Covers spec R3. Depends on Task 2 having shipped the `market` field on the route.

**Files:**
- Modify: `client/src/features/campaigns/demoMode.ts`
- Modify: `client/src/features/campaigns/components/detailView/atoms.tsx` (state, `reset()`, payload, and a new block after the Language row)
- Modify: `client/src/locales/en/campaigns.json`, `client/src/locales/nl/campaigns.json`, `client/src/locales/pt/campaigns.json`

**Interfaces:**
- Consumes: `POST /api/demo/create-link` accepting an optional `market: "uk" | "us" | "nl"` (Task 2).
- Produces: `DEMO_MARKETS` / `DemoMarket` exported from `client/src/features/campaigns/demoMode.ts`.

- [ ] **Step 1: Add the market vocabulary client-side**

Append to `client/src/features/campaigns/demoMode.ts`:

```ts
// The market an English demo is pointed at. Only English needs it: Dutch and
// Portuguese each have one market and the server resolves those itself. This
// mirrors DemoMarket in server/demo-session.ts, the same way DEMO_MODES above
// mirrors the server's scenario enum. Keep the two lists in step.
export const DEMO_MARKETS = ["uk", "us", "nl"] as const;
export type DemoMarket = (typeof DEMO_MARKETS)[number];
```

- [ ] **Step 2: Add the state and reset it**

In `atoms.tsx`, extend the existing import at line 11:

```tsx
import { DEMO_MODES, DEMO_MODE_SCENARIO, DEMO_MARKETS, type DemoMode, type DemoMarket } from "../../demoMode";
```

Add the state immediately after the `aiDisclosure` state (currently line 379):

```tsx
  // Which market the prospect sells into. Only asked when the language is
  // English, because that is the only language whose market is ambiguous.
  // Defaults to the Netherlands rather than the UK: that is where the demos
  // are actually being run, and it was what the model got wrong on its own.
  const [market, setMarket] = useState<DemoMarket>("nl");
```

And in `reset()`, next to `setAiDisclosure("off");`:

```tsx
    setMarket("nl");
```

- [ ] **Step 3: Send it, but only when it can mean something**

In `handleGenerateWa`, add to the request body immediately after the `aiDisclosure` spread (currently line 440):

```tsx
          // English only, and generate-only. A saved Client's currency is
          // already baked into its stored quote text, so sending a market on
          // that path would be a field the server can do nothing with.
          ...(canGenerateNiche && !savedClient && language === "en" ? { market } : {}),
```

- [ ] **Step 4: Render the toggle under the Language row**

Insert immediately after the closing `</div>` of the Language block (currently line 599), before the `aiDisclosure` block:

```tsx
                {canGenerateNiche && !savedClient && language === "en" && (
                  <div>
                    <label className="block text-[12px] font-medium mb-1">{t("share.market", "Market")}</label>
                    <div className="flex gap-1.5">
                      {DEMO_MARKETS.map((m) => (
                        <button key={m} type="button" onClick={() => setMarket(m)}
                          className={cn("px-3 py-1 rounded-md border text-[12px] font-medium transition-colors",
                            market === m ? "border-brand-indigo bg-brand-indigo text-white" : "border-black/[0.125] bg-white hover:bg-muted/50")}>
                          {t(`share.marketOptions.${m}`)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                      {t("share.marketHint", "Which market they sell into, not the language they read in. Sets the currency on the quote and the local rules the AI knows. Dutch and Portuguese set their own.")}
                    </p>
                  </div>
                )}
```

- [ ] **Step 5: Add the strings to all three locales**

In each of `client/src/locales/{en,nl,pt}/campaigns.json`, inside the existing `share` object, next to the `language` key.

`en`:

```json
    "market": "Market",
    "marketOptions": { "uk": "UK", "us": "US", "nl": "NL" },
    "marketHint": "Which market they sell into, not the language they read in. Sets the currency on the quote and the local rules the AI knows. Dutch and Portuguese set their own.",
```

`nl`:

```json
    "market": "Markt",
    "marketOptions": { "uk": "VK", "us": "VS", "nl": "NL" },
    "marketHint": "In welke markt ze verkopen, niet in welke taal ze lezen. Bepaalt de valuta op de offerte en de lokale regels die de AI kent. Nederlands en Portugees bepalen dat zelf.",
```

`pt`:

```json
    "market": "Mercado",
    "marketOptions": { "uk": "RU", "us": "EUA", "nl": "NL" },
    "marketHint": "Em qual mercado eles vendem, não em qual idioma eles leem. Define a moeda do orçamento e as regras locais que a IA conhece. Holandês e português definem isso sozinhos.",
```

Portuguese uses unicode escapes for accented characters, matching the existing convention in that file.

- [ ] **Step 6: Verify in the running app**

Open the share panel on campaign 60, Demo link.

1. With EN selected and no saved Client: the Market row is visible under Language, NL is preselected.
2. Switch the language to NL: the Market row disappears. Switch back to EN: it reappears, still on NL.
3. Pick a saved Client while EN is selected: the Market row disappears (along with "Their niche" from Task 1).
4. Fill in a first name and a fresh niche such as `bespoke kitchens`, leave Market on NL, generate. Then read back what was written:

```bash
node --env-file=.env -e "
const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});
c.connect().then(async()=>{
const r=await c.query('select id, first_name, demo_niche from \"p2mxx34fvbf3ll6\".\"Leads\" where demo_niche is not null order by id desc limit 1');
const ctx=JSON.parse(r.rows[0].demo_niche);
console.log('lead', r.rows[0].id, r.rows[0].first_name);
console.log(ctx.quote_context);
await c.end()})"
```

Expected: a euro total. Repeat with Market on UK and confirm pounds. Paste both.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/campaigns/demoMode.ts client/src/features/campaigns/components/detailView/atoms.tsx client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json client/src/locales/pt/campaigns.json
git commit -m "feat(demo): pick the prospect's market when the demo is in English

A UK/US/NL row appears under Language when English is selected, and sets the
currency the generated quote is priced in. It is hidden on the saved-Client
path, where the currency is already baked into the stored persona and the
control could do nothing."
```

---

### Task 4: Move SolarMax to the Dutch market in both languages

Data only. Covers spec R6. Independent of Tasks 1-3, but do it last so the finished toggle exists to regenerate with if anything looks wrong.

Row 45 of `Niche_Vocabulary` (`niche = 'solar energy installer'`, `is_demo_client = true`) is a UK persona with only its English slots filled. Currency leaks into `quote_context` and `kb_template`; the market also shows in `enquiry_context`, `scoping_ladder`, `question_bank` and `niche_label`.

The English slots are **hand-patched, not regenerated**. Regenerating would discard a tuned persona and risks the two languages describing different companies, which matters because one row serves demos in either language.

**Files:**
- Data: `Niche_Vocabulary` row 45. Nothing in git changes.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Back the row up before touching it**

```bash
node --env-file=.env -e "
const {Client}=require('pg');const fs=require('fs');
const c=new Client({connectionString:process.env.DATABASE_URL});
c.connect().then(async()=>{
const r=await c.query('select * from \"p2mxx34fvbf3ll6\".\"Niche_Vocabulary\" where id=45');
fs.writeFileSync(process.env.HOME+'/.solarmax_row45_backup_2026-08-12.json', JSON.stringify(r.rows[0],null,2));
console.log('backed up to ~/.solarmax_row45_backup_2026-08-12.json');
await c.end()})"
```

Confirm the file exists and is non-empty before continuing.

- [ ] **Step 2: Write the patch script**

Create `.../scratchpad/solarmax-nl.cjs`. Each field is a per-language JSON object, so the update merges the new `en` and `nl` values over whatever is there.

```js
const { Client } = require("pg");

const EN = {
  niche_label: "Solar - NL",
  company_name_template: "SolarMax",
  service_name: "getting solar panels installed",
  opener_phrase: "solar panels",
  usp: "innovation",
  when_label: "a few months ago",
  niche_question: "Roughly how much are you currently paying per month on electricity?",
  first_message: "Hi it's {agent_name} {disclosure_clause}, is that the same {first_name} who was looking at solar panels a while back?",
  description_template: "SolarMax provides innovative solar energy systems designed to help Dutch homeowners generate and use more of their own electricity. We combine smart monitoring, efficient panels and tailored battery options for practical long-term savings.",
  enquiry_context: "Enquired through the website about solar panels for a terraced house with a pitched roof.",
  quote_context: [
    "Total: €11,450",
    "10 × 430W panels, inverter and roof mounting system; 5kWh home battery",
    "Installation, monitoring setup and registration with the grid operator",
    "Sent about five months ago; reviewed by a solar advisor",
  ].join("\n"),
  kb_template: [
    "Standard installations typically take 1 to 2 days once the design and the grid-operator registration are approved.",
    "Most residential systems include a 10-year workmanship warranty and panel warranties of 25 years or more.",
    "Battery storage lets you use more of your own generated power in the evening instead of feeding it back to the grid.",
    "The net-metering scheme (salderingsregeling) ends on 1 January 2027, after which using your own power matters more than feeding it back.",
    "The final system design depends on roof orientation, shading, available roof space and the household's electricity usage.",
    "A typical 10-panel system with a 5kWh battery starts from around €9,500, depending on roof access and electrical work.",
  ].join("\n"),
  question_bank: [
    "How important is evening electricity use to you compared with feeding power back to the grid, now that the net-metering scheme is ending?",
    "Are you mainly comparing expected savings, battery capacity or the quality of the installation team?",
    "What concerns you most about the options you have seen so far: roof appearance, system output, maintenance or payback time?",
    "Would you prefer a smaller system now, or the capacity to add more panels or storage later?",
  ].join("\n"),
  objection_examples: [
    "“The upfront cost is higher than I expected.”",
    "Which part of the proposal would you most like to compare: the expected bill reduction, the battery sizing or the installation scope?",
    "",
    "“I’m not sure the panels will generate enough on my roof.”",
    "Would it help to look at the projected output by roof section and compare that with your actual daytime and evening electricity use?",
  ].join("\n"),
  scoping_ladder: [
    "SLOT 1 - electricity usage",
    "Purpose: sizes the system against household demand and affects the recommended inverter and battery capacity.",
    'Ask: "what is your typical electricity use, and do you have any high-use appliances such as an electric car or a heat pump?"',
    "Options: low usage, average usage, high usage, electric car, heat pump, other high-use equipment, not sure.",
    "",
    "SLOT 2 - roof sections",
    "Purpose: determines how many panels can fit and whether separate inverters or optimisers are needed.",
    'Ask: "which roof sections were you considering, front, rear, the shed or somewhere else?"',
    "Options: front roof, rear roof, side roof, shed or garage, multiple sections.",
    "",
    "SLOT 3 - roof type and dimensions",
    "Purpose: sets the maximum panel count and which mounting system goes on the quote, since a flat roof needs ballasted frames.",
    'Ask: "is it a pitched or a flat roof, and roughly how much usable space is there?"',
    "Options: pitched, flat, both, not sure.",
    "",
    "SLOT 4 - roof orientation and shading",
    "Purpose: changes the expected yield and may require panel optimisers or a revised system design.",
    'Ask: "which way do the main roof sections face, and are they shaded by trees or nearby buildings?"',
    "Options: south, east, west, north, mixed directions, significant shading, little or no shading.",
    "",
    "SLOT 5 - existing electrical connection",
    "Purpose: determines whether the meter cupboard and the connection can carry the proposed system without upgrade work.",
    'Ask: "do you know whether the meter cupboard is up to date, and is the connection single-phase or three-phase?"',
    "Options: up to date and single-phase, older meter cupboard, three-phase, not sure.",
    "",
    "SLOT 6 - battery storage",
    "Purpose: changes the equipment cost, the electrical work and how much of your own solar power is left after sunset.",
    'Ask: "were you thinking of including a battery, and if so roughly how much storage?"',
    "Options: no battery, 5kWh, 10kWh, more than 10kWh, not sure.",
  ].join("\n"),
};

const NL = {
  niche_label: "Zonne-energie - NL",
  company_name_template: "SolarMax",
  service_name: "zonnepanelen laten installeren",
  opener_phrase: "zonnepanelen",
  usp: "innovatie",
  when_label: "een paar maanden geleden",
  niche_question: "Hoeveel betaal je op dit moment ongeveer per maand aan stroom?",
  first_message: "Hoi, dit is {agent_name} {disclosure_clause}, ben jij dezelfde {first_name} die een tijd geleden naar zonnepanelen keek?",
  description_template: "SolarMax levert slimme zonne-energiesystemen waarmee huiseigenaren meer van hun eigen stroom opwekken en gebruiken. We combineren efficiënte panelen, slimme monitoring en een thuisbatterij op maat voor besparing op de lange termijn.",
  enquiry_context: "Via de website geïnformeerd naar zonnepanelen voor een tussenwoning met een schuin dak.",
  quote_context: [
    "Totaal: € 11.450",
    "10 × 430Wp panelen, omvormer en montagesysteem; thuisbatterij van 5 kWh",
    "Installatie, monitoring en aanmelding bij de netbeheerder",
    "Ongeveer vijf maanden geleden verstuurd; opgesteld door een adviseur",
  ].join("\n"),
  kb_template: [
    "Een standaardinstallatie duurt meestal 1 tot 2 dagen zodra het ontwerp en de aanmelding bij de netbeheerder rond zijn.",
    "Op de meeste installaties zit 10 jaar garantie op het werk en 25 jaar of meer op de panelen.",
    "Met een thuisbatterij gebruik je 's avonds meer van je eigen stroom in plaats van terug te leveren.",
    "De salderingsregeling stopt op 1 januari 2027; daarna weegt zelf verbruiken zwaarder dan terugleveren.",
    "Het uiteindelijke ontwerp hangt af van dakoriëntatie, schaduw, beschikbaar dakoppervlak en het verbruik van het huishouden.",
    "Een set van 10 panelen met een thuisbatterij van 5 kWh begint rond de € 9.500, afhankelijk van de bereikbaarheid van het dak en het elektrawerk.",
  ].join("\n"),
  question_bank: [
    "Wanneer gebruiken jullie de meeste stroom, overdag of 's avonds?",
    "Vergelijk je vooral de verwachte besparing, de capaciteit van de batterij of de kwaliteit van de installateur?",
    "Wat zit je het meest dwars aan de opties die je tot nu toe hebt gezien: het uiterlijk op het dak, de opbrengst, het onderhoud of de terugverdientijd?",
    "Wil je liever nu een kleiner systeem, of de ruimte om later panelen of opslag bij te plaatsen?",
  ].join("\n"),
  objection_examples: [
    "“De aanschafkosten vallen hoger uit dan ik had verwacht.”",
    "Welk deel van de offerte wil je het liefst vergelijken: de verwachte besparing op je rekening, de grootte van de batterij of het installatiewerk dat erin zit?",
    "",
    "“Ik weet niet of mijn dak wel genoeg opbrengt.”",
    "Zou het helpen om per dakvlak de verwachte opbrengst naast je eigen verbruik overdag en 's avonds te leggen?",
  ].join("\n"),
  scoping_ladder: [
    "SLOT 1 - stroomverbruik",
    "Doel: bepaalt de omvang van het systeem ten opzichte van het verbruik en daarmee de omvormer en de capaciteit van de batterij.",
    'Vraag: "wat is jullie verbruik ongeveer, en hebben jullie grootverbruikers zoals een elektrische auto of een warmtepomp?"',
    "Opties: laag verbruik, gemiddeld verbruik, hoog verbruik, elektrische auto, warmtepomp, andere grootverbruikers, weet ik niet.",
    "",
    "SLOT 2 - dakvlakken",
    "Doel: bepaalt hoeveel panelen erop passen en of er losse omvormers of optimizers nodig zijn.",
    'Vraag: "welke dakvlakken had je in gedachten, voor, achter, de schuur of ergens anders?"',
    "Opties: voordak, achterdak, zijdak, schuur of garage, meerdere vlakken.",
    "",
    "SLOT 3 - daktype en afmetingen",
    "Doel: bepaalt het maximale aantal panelen en welk montagesysteem in de offerte komt, want een plat dak vraagt om ballastframes.",
    'Vraag: "is het een schuin of een plat dak, en hoeveel bruikbare ruimte is er ongeveer?"',
    "Opties: schuin, plat, allebei, weet ik niet.",
    "",
    "SLOT 4 - oriëntatie en schaduw",
    "Doel: verandert de verwachte opbrengst en kan optimizers of een ander ontwerp nodig maken.",
    'Vraag: "welke kant op liggen de belangrijkste dakvlakken, en is er schaduw van bomen of gebouwen?"',
    "Opties: zuid, oost, west, noord, gemengd, veel schaduw, weinig of geen schaduw.",
    "",
    "SLOT 5 - bestaande aansluiting",
    "Doel: bepaalt of de meterkast en de aansluiting het systeem aankunnen zonder extra werk.",
    'Vraag: "weet je of de meterkast nog bij de tijd is, en heb je een 1-fase of 3-fase aansluiting?"',
    "Opties: bij de tijd en 1-fase, oudere meterkast, 3-fase, weet ik niet.",
    "",
    "SLOT 6 - thuisbatterij",
    "Doel: verandert de kosten van de apparatuur, het elektrawerk en hoeveel eigen stroom er na zonsondergang overblijft.",
    'Vraag: "dacht je aan een thuisbatterij, en zo ja, ongeveer hoeveel opslag?"',
    "Opties: geen batterij, 5 kWh, 10 kWh, meer dan 10 kWh, weet ik niet.",
  ].join("\n"),
};

// Dutch-language term lists. The unsuffixed columns ARE the Dutch ones; the
// _en and _pt suffixed columns hold the other two languages.
const NL_TERMS = {
  project_terms: ["installatie"],
  proposal_terms: ["offerte"],
  decision_terms: ["beslissing"],
  advisor_terms: ["adviseur"],
  visit_terms: ["schouw"],
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query(`select * from "p2mxx34fvbf3ll6"."Niche_Vocabulary" where id = 45`);
  if (rows.length !== 1) throw new Error(`expected row 45, found ${rows.length}`);
  const row = rows[0];

  const sets = [];
  const vals = [];
  let i = 1;
  for (const field of Object.keys(EN)) {
    const merged = { ...(row[field] || {}), en: EN[field], nl: NL[field] };
    sets.push(`"${field}" = $${i++}`);
    vals.push(JSON.stringify(merged));
  }
  for (const [field, value] of Object.entries(NL_TERMS)) {
    sets.push(`"${field}" = $${i++}`);
    vals.push(JSON.stringify(value));
  }
  sets.push(`updated_at = now()`);
  vals.push(45);
  await c.query(`update "p2mxx34fvbf3ll6"."Niche_Vocabulary" set ${sets.join(", ")} where id = $${i}`, vals);
  console.log(`patched ${sets.length - 1} fields on row 45`);
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 3: Run it**

```bash
node --env-file=.env /tmp/claude-1000/-home-gabriel-LeadAwakerApp/afdb81dc-71b9-485b-a12e-60e80e00c563/scratchpad/solarmax-nl.cjs
```

Expected: `patched 20 fields on row 45` (15 per-language text fields plus 5 Dutch term lists).

- [ ] **Step 4: Confirm no pounds survive anywhere on the row**

```bash
node --env-file=.env -e "
const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});
c.connect().then(async()=>{
const r=await c.query('select * from \"p2mxx34fvbf3ll6\".\"Niche_Vocabulary\" where id=45');
const blob=JSON.stringify(r.rows[0]);
console.log('pound signs:', (blob.match(/£/g)||[]).length);
console.log('euro signs:', (blob.match(/€/g)||[]).length);
for (const k of ['scaffolding','consumer unit','semi-detached','export tariff']) {
  if (blob.toLowerCase().includes(k)) console.log('STILL PRESENT:', k);
}
await c.end()})"
```

Expected: `pound signs: 0`, a non-zero euro count, and no `STILL PRESENT` lines.

- [ ] **Step 5: Mint SolarMax in both languages and read the result**

In the share panel on campaign 60, pick the saved Client whose label reads `Solar - NL`, generate a link with language EN, then repeat with language NL. After each, read the lead back:

```bash
node --env-file=.env -e "
const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});
c.connect().then(async()=>{
const r=await c.query('select id, demo_niche from \"p2mxx34fvbf3ll6\".\"Leads\" where demo_niche is not null order by id desc limit 1');
const ctx=JSON.parse(r.rows[0].demo_niche);
console.log(ctx.company_name); console.log(ctx.quote_context); console.log(ctx.first_message);
await c.end()})"
```

Expected: both languages quote in euros, both say SolarMax, and the Dutch one is in Dutch rather than falling back to English. Paste both.

- [ ] **Step 6: Report, do not commit**

Nothing in git changed. State in the task report that row 45 was patched, that the backup is at `~/.solarmax_row45_backup_2026-08-12.json`, and paste the two minted quotes.

---

## Rollback

- Tasks 1, 2 (code half) and 3: `git revert` the relevant commit.
- Task 2's Prompt_Library edit: re-run the patch script with `OLD` and `NEW` swapped.
- Task 4: restore row 45 from `~/.solarmax_row45_backup_2026-08-12.json`.

## Self-review notes

Spec coverage: R1 → Task 1 steps 1-2. R2 → Task 1 step 3. R3 → Task 3. R4 → Task 2 steps 1, 3, 4, 5. R5 → Task 2 steps 2 and 6. R6 → Task 4.

The one thing the spec did not call out and this plan does: the English default reaches the public homepage flow and the WhatsApp `/generate` command, not just the share panel. Documented under "Known consequence, already accepted" above.
