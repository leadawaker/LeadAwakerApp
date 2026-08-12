# Clients Tab: Autosave, Entry Actions, Categorized Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Clients tab's Save button with autosave, add a topbar "..." menu for duplicate/delete, show a combined identity title, and group the grid by category with per-Client emoji — backfilled for the 23 existing niches and wired into the persona-minting generator for future ones.

**Architecture:** Two new nullable columns (`category`, `emoji`) on the existing `Niche_Vocabulary` table, threaded through the existing demo-clients server module and demoClientsApi client module. "Which Client is open" moves from `ClientsTab`'s local state up into `CampaignListView`, so the shared topbar (which lives above `ClientsTab` in the tree) can render a duplicate/delete menu for it. `ClientEditor` autosaves using the exact debounced-flush pattern already proven in `useCampaignDetail.ts`.

**Tech Stack:** React + TypeScript (Vite), TanStack Query, Express + Drizzle ORM + PostgreSQL (NocoDB-managed schema `p2mxx34fvbf3ll6`), raw `pg` migration scripts (this table cannot use `db:push`), OpenAI via `generateNicheContext()`.

**Spec:** `docs/superpowers/specs/2026-08-12-clients-tab-autosave-grouping-design.md`

## Global Constraints

- Never run `npx tsc --noEmit` automatically — only if Gabriel explicitly asks.
- Never run `npm run dev` — the app runs via pm2 (`tsx watch`) and hot-reloads `server/` and `shared/` edits in ~5-8s; the client hot-reloads via Vite. Frontend verification happens by loading the running app, not by starting a new dev server.
- No hardcoded strings — every new user-facing string goes through `t()` with an inline English default, and gets an entry in `client/src/locales/en/campaigns.json` **and** `client/src/locales/nl/campaigns.json`. The `clients` section does not exist in the `pt` locale file at all (Portuguese was dropped product-wide 2026-06-30) — do not add one.
- Dark mode is live — no hardcoded `bg-white`/`text-black`/raw hex. Every style in this plan uses existing CSS custom properties (`var(--ink)`, `var(--mute)`, etc.), matching the surrounding code.
- `Niche_Vocabulary` is a NocoDB-managed table in Postgres schema `p2mxx34fvbf3ll6`. Schema changes are raw SQL scripts run with `node --env-file=.env <script>.js`, never `npm run db:push` (needs a TTY unavailable here).
- Out of scope: `server/nicheGenerator.ts` / `NicheSelect.tsx`'s "New niche…" flow (Prompt_Library row `niche_row_generator`). Do not touch it.

---

## Task 1: Category + emoji columns — schema, migration, backfill

**Files:**
- Create: `migrate-demo-client-category-emoji.js`
- Modify: `shared/schema.ts:333-419` (the `nicheVocabulary` table definition)

**Interfaces:**
- Produces: `nicheVocabulary.category: text | null`, `nicheVocabulary.emoji: text | null` — every later task in this plan reads/writes these two Drizzle columns.

- [ ] **Step 1: Add the two columns to the Drizzle schema**

In `shared/schema.ts`, inside the `nicheVocabulary` table definition, add the two new columns right before the closing `isDemoClient` line (after `visitTermsPt`, before `bookingModeCall`, following the file's existing "add new stuff near the end" pattern):

```ts
  // Clients-tab card identity (specs/demo-persona-library): grouping + a
  // per-entry emoji, so a 23+ row grid is scannable. Both nullable with no
  // default — an unset Client is "Uncategorized" in the UI, not an error.
  category: text("category"),
  emoji: text("emoji"),
```

Place this immediately before the `bookingModeCall: boolean(...)` line at `shared/schema.ts:410`.

- [ ] **Step 2: Write the migration + backfill script**

Create `migrate-demo-client-category-emoji.js` at the repo root, mirroring the exact structure of `migrate-demo-client-persona-columns.js`:

```js
// Run with: node --env-file=.env migrate-demo-client-category-emoji.js
// npm run db:push cannot be used here: it requires a TTY.
//
// Adds Niche_Vocabulary.category and .emoji (specs/demo-persona-library design,
// 2026-08-12), and backfills both on the 23 rows that existed at design time.
// Additive and idempotent: the ALTERs are IF NOT EXISTS, and the backfill only
// ever touches a row whose category is still NULL, so re-running this after a
// human has edited a Client's category from the tab is always a safe no-op for
// that row.

import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";
const TABLE = "Niche_Vocabulary";

// niche -> [category, emoji]. Grounded in a live query of every row at design
// time (2026-08-12), not invented in the abstract. New niches minted after
// this point get a category/emoji from the generator instead (server/demo-session.ts).
const BACKFILL = {
  "Doors and Windows company": ["Home & Trades", "🚪"],
  "General Contracting": ["Home & Trades", "🏗️"],
  "Landscaping": ["Home & Trades", "🌳"],
  "loft conversions": ["Home & Trades", "🪜"],
  "loft insulation": ["Home & Trades", "🌡️"],
  "orangeries and garden rooms": ["Home & Trades", "🏡"],
  "Roofing": ["Home & Trades", "🏠"],
  "Windows & Doors": ["Home & Trades", "🪟"],
  "Bathrooms": ["Kitchens & Interiors", "🛁"],
  "Countertops": ["Kitchens & Interiors", "🪨"],
  "Flooring": ["Kitchens & Interiors", "🪵"],
  "Interior Design": ["Kitchens & Interiors", "🛋️"],
  "Kitchens": ["Kitchens & Interiors", "🍳"],
  "Painting": ["Kitchens & Interiors", "🎨"],
  "HVAC": ["Climate & Energy", "❄️"],
  "solar energy installer": ["Climate & Energy", "☀️"],
  "solar energy installer uk": ["Climate & Energy", "☀️"],
  "solar energy installer us": ["Climate & Energy", "☀️"],
  "Solar Panels": ["Climate & Energy", "☀️"],
  "Moving Services": ["Home Services", "📦"],
  "Pest Control": ["Home Services", "🐜"],
  "Pool Installation": ["Home Services", "🏊"],
  "Amusement Park": ["Wellness & Leisure", "🎡"],
  "Wellness": ["Wellness & Leisure", "🧘"],
};

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`ALTER TABLE "${SCHEMA}"."${TABLE}" ADD COLUMN IF NOT EXISTS category text`);
  await client.query(`ALTER TABLE "${SCHEMA}"."${TABLE}" ADD COLUMN IF NOT EXISTS emoji text`);

  let updated = 0;
  for (const [niche, [category, emoji]] of Object.entries(BACKFILL)) {
    const { rowCount } = await client.query(
      `UPDATE "${SCHEMA}"."${TABLE}"
          SET category = $1, emoji = $2
        WHERE niche = $3
          AND category IS NULL`,
      [category, emoji, niche],
    );
    updated += rowCount;
  }
  console.log(`backfilled category + emoji on ${updated} row(s).`);

  const { rows } = await client.query(
    `SELECT niche, category, emoji FROM "${SCHEMA}"."${TABLE}" WHERE niche <> '__default__' ORDER BY niche`,
  );
  console.table(rows);

  const stillNull = rows.filter((r) => !r.category);
  if (stillNull.length) {
    console.log(
      `${stillNull.length} row(s) have no category yet (new since the design's live query, or intentionally uncategorized): ` +
        stillNull.map((r) => r.niche).join(", "),
    );
  }

  console.log("OK: category + emoji columns present.");
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Run the migration and verify**

Run: `node --env-file=.env migrate-demo-client-category-emoji.js`

Expected: a `console.table` listing every non-`__default__` niche with its `category`/`emoji`; all 23 niches named in `BACKFILL` show non-null values; the final line reads `OK: category + emoji columns present.`

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts migrate-demo-client-category-emoji.js
git commit -m "$(cat <<'EOF'
feat(clients): add category + emoji columns to Niche_Vocabulary

Backfills the 23 existing Clients with a category and emoji grounded
in a live query, per the Clients-tab grouping design.
EOF
)"
```

---

## Task 2: Server — category/emoji on the Client read/write paths

**Files:**
- Modify: `server/demo-clients.ts`

**Interfaces:**
- Consumes: `nicheVocabulary.category`, `nicheVocabulary.emoji` (Task 1).
- Produces: `DemoClientSummary.category: string | null`, `.emoji: string | null`; `EditableDemoClient` (return type of `demoClientToEditable`) gains `category`, `emoji`, `label`, `companyName`; `ClientPatch.category?: string | null`, `.emoji?: string | null` — consumed by Task 4 (routes) and Task 8 (client API).

- [ ] **Step 1: Extend `DemoClientSummary`**

In `server/demo-clients.ts:124-134`, add two fields after `companyName: string;`:

```ts
  /** Null until set by hand or by the generator's category preference. */
  category: string | null;
  /** Null until set by hand or by the generator. */
  emoji: string | null;
```

- [ ] **Step 2: Return them from `listDemoClients()`**

In the `return rows.map((r) => {...})` block at `server/demo-clients.ts:147-164`, add to the returned object (after `companyName: pick(...)`):

```ts
      category: r.category ?? null,
      emoji: r.emoji ?? null,
```

- [ ] **Step 3: Extend `ClientPatch` and `updateDemoClient()`**

In the `ClientPatch` interface at `server/demo-clients.ts:278-284`, add:

```ts
  /** Empty/whitespace collapses to null, same as clearing any other field. */
  category?: string | null;
  emoji?: string | null;
```

In `updateDemoClient()`, right before the existing `if (patch.bookingModeCall !== undefined) values.bookingModeCall = patch.bookingModeCall;` line (`server/demo-clients.ts:331`), add:

```ts
  if (patch.category !== undefined) values.category = (patch.category ?? "").trim() || null;
  if (patch.emoji !== undefined) values.emoji = (patch.emoji ?? "").trim() || null;
```

- [ ] **Step 4: Extend `demoClientToEditable()`**

In `server/demo-clients.ts:364-386`, add to the returned object (after `id: row.id,`):

```ts
    label: pick(row.nicheLabel as NicheText, "en") || row.niche,
    companyName: pick(row.companyNameTemplate as NicheText, "en"),
    category: row.category ?? null,
    emoji: row.emoji ?? null,
```

(`label`/`companyName` mirror exactly what `listDemoClients()` already computes, so the editor never reimplements the language-fallback logic — spec §4.)

- [ ] **Step 5: Write emoji/category in `saveDemoClient()`, only if not already set**

In `saveDemoClient()`, `server/demo-clients.ts:226-231`, change:

```ts
    const values = {
      ...text,
      ...terms,
      bookingModeCall: ctx.booking_mode_call,
      updatedAt: new Date(),
    };
```

to:

```ts
    const values: Record<string, unknown> = {
      ...text,
      ...terms,
      bookingModeCall: ctx.booking_mode_call,
      updatedAt: new Date(),
    };
    // Written once, never clobbered: a human editing the Clients tab, or a
    // second demo minted later for the same niche, must win over whatever a
    // fresh generation returns.
    if (!existing?.category && ctx.category) values.category = ctx.category.trim();
    if (!existing?.emoji && ctx.emoji) values.emoji = ctx.emoji.trim();
```

(`ctx.category`/`ctx.emoji` don't exist on `NicheContext` yet — that's Task 5. This will not compile cleanly until Task 5 lands; that's expected within this plan's sequencing, and both land before Task 6/7 touch routes that exercise this path over HTTP.)

- [ ] **Step 6: Verify with a one-off script**

Create a scratch file (not committed) `/tmp/verify-demo-clients.ts`:

```ts
import { listDemoClients, getDemoClient, updateDemoClient, demoClientToEditable } from "../LeadAwakerApp/server/demo-clients";

async function main() {
  const list = await listDemoClients();
  const kitchens = list.find((c) => c.niche === "Kitchens");
  console.log("Kitchens summary:", kitchens);
  if (kitchens?.category !== "Kitchens & Interiors" || kitchens?.emoji !== "🍳") {
    throw new Error("backfilled category/emoji not showing up in listDemoClients()");
  }

  const row = await getDemoClient("Kitchens");
  const editable = demoClientToEditable(row!);
  console.log("Kitchens editable:", { label: editable.label, companyName: editable.companyName, category: editable.category, emoji: editable.emoji });

  const ok = await updateDemoClient("Kitchens", { emoji: "🍽️" });
  console.log("update ok:", ok);
  const after = await getDemoClient("Kitchens");
  if (after?.emoji !== "🍽️") throw new Error("updateDemoClient did not persist emoji");
  await updateDemoClient("Kitchens", { emoji: "🍳" }); // restore
  console.log("PASS");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
```

Run from the repo root: `npx tsx --env-file=.env /tmp/verify-demo-clients.ts`

Expected: prints the Kitchens summary/editable objects with `category: "Kitchens & Interiors"`, `emoji: "🍳"`, then `update ok: true`, then `PASS`. Delete the scratch file afterward (`rm /tmp/verify-demo-clients.ts`) — it is not part of the plan's file set.

- [ ] **Step 7: Commit**

```bash
git add server/demo-clients.ts
git commit -m "$(cat <<'EOF'
feat(clients): read/write category + emoji on the Client server module

listDemoClients/demoClientToEditable now surface category, emoji,
label and companyName; updateDemoClient and saveDemoClient can write
category/emoji (the latter only when the row doesn't already have one).
EOF
)"
```

---

## Task 3: Server — duplicate a Client

**Files:**
- Modify: `server/demo-clients.ts`

**Interfaces:**
- Consumes: `getDemoClient()`, `nicheVocabulary` (existing).
- Produces: `duplicateDemoClient(sourceNiche: string, newNiche: string): Promise<{ ok: true; row: ClientRow } | { ok: false; reason: "missing" | "conflict" }>` — consumed by Task 4's route.

- [ ] **Step 1: Add `duplicateDemoClient()`**

In `server/demo-clients.ts`, add this function right after `deleteDemoClient()` (after `server/demo-clients.ts:356`) and before `demoClientToEditable()`:

```ts
/**
 * Copy a Client under a new niche key. Always creates a saved (deletable)
 * Client, even when the source is one of the curated packs the engine reads
 * for real campaigns — duplicating a curated niche is exactly how you get an
 * editable, deletable copy of it without touching the shared original.
 */
export async function duplicateDemoClient(
  sourceNiche: string,
  newNiche: string,
): Promise<{ ok: true; row: ClientRow } | { ok: false; reason: "missing" | "conflict" }> {
  const source = await getDemoClient(sourceNiche);
  if (!source) return { ok: false, reason: "missing" };

  const key = newNiche.trim();
  const conflict = await getDemoClient(key);
  if (conflict) return { ok: false, reason: "conflict" };

  const { id: _id, niche: _niche, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
  const [row] = await db
    .insert(nicheVocabulary)
    .values({
      ...(rest as typeof nicheVocabulary.$inferInsert),
      niche: key,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDemoClient: true,
    })
    .returning();
  return { ok: true, row };
}
```

- [ ] **Step 2: Verify with a one-off script**

Create scratch file `/tmp/verify-duplicate.ts`:

```ts
import { duplicateDemoClient, getDemoClient, deleteDemoClient } from "../LeadAwakerApp/server/demo-clients";

async function main() {
  // Clean slate if a previous failed run left this behind.
  await deleteDemoClient("__plan-verify-copy__").catch(() => {});

  const missing = await duplicateDemoClient("__nonexistent_niche__", "__plan-verify-copy__");
  if (missing.ok) throw new Error("expected missing source to fail");
  console.log("missing source ->", missing.reason);

  const conflict = await duplicateDemoClient("Kitchens", "Kitchens");
  if (conflict.ok) throw new Error("expected existing target to conflict");
  console.log("conflict ->", conflict.reason);

  const created = await duplicateDemoClient("Kitchens", "__plan-verify-copy__");
  if (!created.ok) throw new Error("expected duplicate to succeed");
  console.log("created:", { niche: created.row.niche, category: created.row.category, emoji: created.row.emoji, isDemoClient: created.row.isDemoClient });
  if (!created.row.isDemoClient) throw new Error("duplicate must always be isDemoClient=true");

  const cleanup = await deleteDemoClient("__plan-verify-copy__");
  console.log("cleanup ->", cleanup);
  console.log("PASS");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
```

Run: `npx tsx --env-file=.env /tmp/verify-duplicate.ts`

Expected: `missing source -> missing`, `conflict -> conflict`, a `created:` line showing `category`/`emoji` copied from Kitchens and `isDemoClient: true`, `cleanup -> deleted`, `PASS`. Delete the scratch file afterward.

- [ ] **Step 3: Commit**

```bash
git add server/demo-clients.ts
git commit -m "feat(clients): add duplicateDemoClient()"
```

---

## Task 4: Server — PATCH schema + duplicate route

**Files:**
- Modify: `server/routes/demo.ts`

**Interfaces:**
- Consumes: `duplicateDemoClient()` (Task 3), `demoClientToEditable()` (Task 2).
- Produces: `POST /api/demo/clients/:niche/duplicate` — consumed by Task 8's client hook.

- [ ] **Step 1: Import `duplicateDemoClient`**

In `server/routes/demo.ts:22-30`, add `duplicateDemoClient` to the import list from `../demo-clients`:

```ts
import {
  saveDemoClient,
  listDemoClients,
  getDemoClient,
  demoClientToContext,
  demoClientToEditable,
  updateDemoClient,
  deleteDemoClient,
  duplicateDemoClient,
} from "../demo-clients";
```

- [ ] **Step 2: Extend `clientPatchSchema`**

At `server/routes/demo.ts:110-114`, add two fields:

```ts
  const clientPatchSchema = z.object({
    text: z.record(z.record(z.string())).optional(),
    terms: z.record(z.record(z.array(z.string()))).optional(),
    bookingModeCall: z.boolean().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    emoji: z.string().trim().max(8).nullable().optional(),
  });
```

- [ ] **Step 3: Add the duplicate route**

After the existing `app.delete("/api/demo/clients/:niche", ...)` block (ends at `server/routes/demo.ts:143`), and before `app.post("/api/demo/create-session", ...)` (starts at `server/routes/demo.ts:145`), insert:

```ts
  const duplicateSchema = z.object({
    newNiche: z.string().trim().min(1).max(300),
  });

  app.post(
    "/api/demo/clients/:niche/duplicate",
    requireAgency,
    wrapAsync(async (req, res) => {
      const parsed = duplicateSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const result = await duplicateDemoClient(String(req.params.niche), parsed.data.newNiche);
      if (!result.ok) {
        if (result.reason === "missing") return res.status(404).json({ message: "No such Client." });
        return res.status(409).json({
          message: `A Client named "${parsed.data.newNiche.trim()}" already exists.`,
        });
      }
      res.json({ client: demoClientToEditable(result.row) });
    }),
  );

```

- [ ] **Step 4: Verify over HTTP**

The server auto-restarts on save (pm2 watches `server/`). Confirm it came back up:

Run: `pm2 logs leadawaker --lines 15 --nostream --err`
Expected: no new TypeScript/syntax errors after the restart timestamp.

Then, using the agency internal-key bypass (`requireAgency` accepts `X-Internal-Key`, same header the automations engine uses — see `server/auth.ts:183-194`):

```bash
KEY=$(grep -E '^INTERNAL_API_KEY=' /home/gabriel/LeadAwakerApp/.env | cut -d= -f2-)
curl -s -X POST "http://localhost:5001/api/demo/clients/Kitchens/duplicate" \
  -H "content-type: application/json" -H "x-internal-key: $KEY" \
  -d '{"newNiche":"__plan-verify-route__"}' | head -c 400
echo
curl -s -X DELETE "http://localhost:5001/api/demo/clients/__plan-verify-route__" \
  -H "x-internal-key: $KEY"
```

Expected: the POST returns `{"client":{"id":...,"niche":"__plan-verify-route__","label":"Kitchens",...,"category":"Kitchens & Interiors","emoji":"🍳",...}}`; the DELETE returns `{"ok":true}`.

(If port 5001 is not the live dev API port, check `PORT`/`STANDALONE_API` in `.env` or `ecosystem.config.cjs` and adjust; the goal is just hitting the same process the app.leadawaker.com traffic reaches.)

- [ ] **Step 5: Commit**

```bash
git add server/routes/demo.ts
git commit -m "feat(clients): add POST /api/demo/clients/:niche/duplicate route"
```

---

## Task 5: Server — generator prompt gains emoji + category

**Files:**
- Modify: `server/demo-session.ts`

**Interfaces:**
- Consumes: `nicheVocabulary.category` (Task 1).
- Produces: `NicheContext.emoji?: string`, `NicheContext.category?: string` — consumed by Task 2's `saveDemoClient()` (already written to expect these).

- [ ] **Step 1: Import `nicheVocabulary` and `isNotNull`**

At the top of `server/demo-session.ts:1-4`, change:

```ts
import { leads, campaigns, promptLibrary } from "@shared/schema";
import { eq } from "drizzle-orm";
```

to:

```ts
import { leads, campaigns, promptLibrary, nicheVocabulary } from "@shared/schema";
import { eq, isNotNull } from "drizzle-orm";
```

- [ ] **Step 2: Add the two fields to `NicheContext`**

At `server/demo-session.ts:77-78`, right before the interface's closing brace, add:

```ts
  // Clients-tab card identity (specs/demo-persona-library). Optional: an
  // older or hand-generated Client may not have either, and neither is ever
  // required for the demo conversation itself to work.
  emoji?: string;
  category?: string;
```

- [ ] **Step 3: Document the two new JSON keys in the fallback prompt**

At `server/demo-session.ts:250`, the line `advisor_term, project_term, proposal_term, visit_term and decision_term MUST be in the output language and natural for the niche.` is immediately followed by a blank line, then `- niche_question_bank: ...`. Insert two new bullet lines right after that sentence, before the blank line:

```
advisor_term, project_term, proposal_term, visit_term and decision_term MUST be in the output language and natural for the niche.
- emoji: ONE emoji that best represents this niche visually (e.g. "☀️" for solar, "🍳" for kitchens). Return a single emoji character, no text.
- category: a short category name (1-3 words) grouping this niche with similar ones (e.g. "Climate & Energy", "Kitchens & Interiors"). If the caller lists EXISTING CATEGORIES below, reuse one of them when it genuinely fits this niche; only invent a new one if none do.

- niche_question_bank: ...
```

(i.e. add the two `- emoji:` / `- category:` lines into `NICHE_GENERATOR_SYSTEM_FALLBACK` at that exact spot, keeping the existing blank line before `niche_question_bank`.)

- [ ] **Step 4: Query existing categories and append them to the system prompt**

At `server/demo-session.ts:334-341`, change:

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

to:

```ts
  const profile = MARKET_PROFILE[resolveMarket(language, market)];

  // Existing categories, so a freshly generated niche prefers reusing one
  // instead of fragmenting the Clients-tab taxonomy every time it runs.
  // Best-effort: a DB failure here degrades to "no preference list", it
  // never blocks generation.
  let categoryList: string[] = [];
  try {
    const rows = await db
      .selectDistinct({ category: nicheVocabulary.category })
      .from(nicheVocabulary)
      .where(isNotNull(nicheVocabulary.category));
    categoryList = rows
      .map((r) => (r.category ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.error("[demo-niche] failed to load existing categories:", (err as Error)?.message);
  }

  system =
    system +
    `\n\nOutput language: ${langLabel}.` +
    `\nTarget market: ${profile.name}.` +
    ` Every money amount you write, including the quote total, its line items and any figure inside kb, must be in ${profile.currency} (${profile.symbol}) and priced realistically for ${profile.name}.` +
    ` This overrides any other instruction about which currency to use.` +
    ` Regulations, grid and tax rules, housing stock, units of measurement and company naming must all be the ones a business operating in ${profile.name} would actually deal with, regardless of the output language.` +
    (categoryList.length
      ? `\n\nEXISTING CATEGORIES: ${categoryList.join(", ")}. Reuse one of these for the "category" key if it genuinely fits this niche; only invent a new one if none do.`
      : "");
```

- [ ] **Step 5: Trim the two new fields out of the model's response**

At `server/demo-session.ts:511`, right after the `niche_question_bank`/`niche_objection_examples` coercion loop and before `return applyDemoDefaults(parsed, language, scenario);` (`server/demo-session.ts:513`), add:

```ts
    parsed.emoji = (parsed.emoji || "").toString().trim() || undefined;
    parsed.category = (parsed.category || "").toString().trim() || undefined;
    return applyDemoDefaults(parsed, language, scenario);
```

- [ ] **Step 6: Verify with a one-off script**

Requires `OPEN_AI_API_KEY` to be set (it already is on the Pi — this hits the real model, costs a few cents, takes ~15-20s). Create scratch file `/tmp/verify-generator.ts`:

```ts
import { generateNicheContext } from "../LeadAwakerApp/server/demo-session";

async function main() {
  const ctx = await generateNicheContext("dental implants", "en", "inquired");
  if (!ctx) throw new Error("generation returned null — check OPEN_AI_API_KEY / pm2 logs");
  console.log({ emoji: ctx.emoji, category: ctx.category, niche_label: ctx.niche_label });
  if (!ctx.emoji || !ctx.category) throw new Error("model did not return emoji/category — check the prompt edit");
  console.log("PASS");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
```

Run: `npx tsx --env-file=.env /tmp/verify-generator.ts`

Expected: an object with a non-empty `emoji` and `category` (ideally reusing one of the 5 seeded categories, e.g. "Kitchens & Interiors" would be a poor fit for dental implants — watch for it inventing something like "Health & Wellness" instead, which is correct behavior, not a bug), then `PASS`. Delete the scratch file afterward.

- [ ] **Step 7: Commit**

```bash
git add server/demo-session.ts
git commit -m "$(cat <<'EOF'
feat(clients): generator produces emoji + category for new Clients

generateNicheContext() now asks the model for a representative emoji
and a category, preferring an existing category when the DB has any.
saveDemoClient() (already wired in the prior commit) only writes these
onto a row that doesn't already have them.
EOF
)"
```

---

## Task 6: Update the live Prompt_Library row

**Files:**
- Create: `update-niche-generator-prompt-emoji-category.js`

**Interfaces:**
- Consumes: Prompt_Library row `use_case = "universal_demo_niche_generator"` (production source of truth per the `_load_prompt()` convention — the in-file fallback from Task 5 only fires if this DB read fails).
- Produces: the same emoji/category lines added in Task 5's fallback, present in the live row.

- [ ] **Step 1: Write the update script**

```js
// Run with: node --env-file=.env update-niche-generator-prompt-emoji-category.js
//
// Adds the emoji + category keys to the LIVE Prompt_Library row that backs
// generateNicheContext() (server/demo-session.ts). Prompt_Library is the
// actual source of truth in production — NICHE_GENERATOR_SYSTEM_FALLBACK only
// fires if this DB read fails — so editing the in-file constant alone (done in
// the prior commit) does not change what a real demo generates until this
// script also runs.
//
// Idempotent: no-ops if the row already documents the "emoji" key.

import { Client } from "pg";

const USE_CASE = "universal_demo_niche_generator";

const ANCHOR =
  /(advisor_term, project_term, proposal_term, visit_term and decision_term MUST be in the output language and natural for the niche\.\n)/;

const NEW_LINES =
  `- emoji: ONE emoji that best represents this niche visually (e.g. "☀️" for solar, "🍳" for kitchens). Return a single emoji character, no text.\n` +
  `- category: a short category name (1-3 words) grouping this niche with similar ones (e.g. "Climate & Energy", "Kitchens & Interiors"). If the caller lists EXISTING CATEGORIES below, reuse one of them when it genuinely fits this niche; only invent a new one if none do.\n`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(
    `SELECT id, prompt_text FROM "p2mxx34fvbf3ll6"."Prompt_Library" WHERE use_case = $1 LIMIT 1`,
    [USE_CASE],
  );
  if (rows.length === 0) {
    throw new Error(`No Prompt_Library row with use_case="${USE_CASE}". Nothing to update.`);
  }
  const { id, prompt_text: text } = rows[0];

  if (text.includes("- emoji:")) {
    console.log(`Row ${id} already documents the emoji key. No-op.`);
    await client.end();
    return;
  }

  if (!ANCHOR.test(text)) {
    throw new Error(
      `Could not find the decision_term anchor sentence in row ${id}'s prompt_text. ` +
        `The live row has drifted from NICHE_GENERATOR_SYSTEM_FALLBACK — edit it by hand in the Prompt Library UI instead, ` +
        `pasting in:\n\n${NEW_LINES}`,
    );
  }

  const updated = text.replace(ANCHOR, (match) => match + NEW_LINES);

  await client.query(`UPDATE "p2mxx34fvbf3ll6"."Prompt_Library" SET prompt_text = $1 WHERE id = $2`, [updated, id]);
  console.log(`Updated Prompt_Library row ${id} (${USE_CASE}) with emoji + category keys.`);
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Run it and verify**

Run: `node --env-file=.env update-niche-generator-prompt-emoji-category.js`

Expected outcome A: `Updated Prompt_Library row <id> (universal_demo_niche_generator) with emoji + category keys.`
Expected outcome B (if the row was already hand-edited to match, or this is re-run): `Row <id> already documents the emoji key. No-op.`
Failure mode to watch for: the "Could not find the decision_term anchor" error — if this fires, STOP and open Prompt Library in the CRM UI to edit row `universal_demo_niche_generator` by hand instead (paste in the two lines the error message prints), rather than forcing a different regex match against unknown drifted content.

Run again to confirm idempotency: `node --env-file=.env update-niche-generator-prompt-emoji-category.js` → expect the "No-op" line this second time.

- [ ] **Step 3: Commit**

```bash
git add update-niche-generator-prompt-emoji-category.js
git commit -m "feat(clients): update live Prompt_Library row for emoji + category"
```

---

## Task 7: i18n — new Clients-tab copy (en + nl)

**Files:**
- Modify: `client/src/locales/en/campaigns.json`
- Modify: `client/src/locales/nl/campaigns.json`

**Interfaces:**
- Produces: `clients.moreActions`, `clients.duplicate`, `clients.duplicating`, `clients.duplicateNamePrompt`, `clients.duplicateFailed`, `clients.categoryLabel`, `clients.emojiLabel`, `clients.noCategory`, `clients.newCategory`, `clients.newCategoryPlaceholder`, `clients.addCategory` — consumed by Tasks 9, 10, 11.

- [ ] **Step 1: Add the English keys**

In `client/src/locales/en/campaigns.json`, inside the `"clients"` object, right after `"confirmDeleteBody": "..."` (line 791) and before `"termsTitle"` (line 792), insert:

```json
    "moreActions": "More actions",
    "duplicate": "Duplicate",
    "duplicating": "Duplicating…",
    "duplicateNamePrompt": "Name for the new Client",
    "duplicateFailed": "Could not duplicate this Client.",
    "categoryLabel": "Category",
    "emojiLabel": "Emoji",
    "noCategory": "Uncategorized",
    "newCategory": "New category…",
    "newCategoryPlaceholder": "e.g. Wellness & Leisure",
    "addCategory": "Add",
```

- [ ] **Step 2: Add the Dutch keys**

In `client/src/locales/nl/campaigns.json`, inside the `"clients"` object, at the equivalent position (right after `"confirmDeleteBody"` at line 791, before `"termsTitle"`), insert:

```json
    "moreActions": "Meer acties",
    "duplicate": "Dupliceren",
    "duplicating": "Dupliceren...",
    "duplicateNamePrompt": "Naam voor de nieuwe klant",
    "duplicateFailed": "Kon deze klant niet dupliceren.",
    "categoryLabel": "Categorie",
    "emojiLabel": "Emoji",
    "noCategory": "Zonder categorie",
    "newCategory": "Nieuwe categorie…",
    "newCategoryPlaceholder": "bijv. Wellness & Vrije tijd",
    "addCategory": "Toevoegen",
```

- [ ] **Step 3: Verify both files are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('client/src/locales/en/campaigns.json','utf8')); JSON.parse(require('fs').readFileSync('client/src/locales/nl/campaigns.json','utf8')); console.log('OK')"`

Expected: `OK` (no `SyntaxError`).

- [ ] **Step 4: Commit**

```bash
git add client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json
git commit -m "feat(clients): add i18n keys for duplicate/delete menu + category/emoji fields"
```

---

## Task 8: Client API layer — types, duplicate hook, title formatter

**Files:**
- Modify: `client/src/features/campaigns/api/demoClientsApi.ts`

**Interfaces:**
- Consumes: `POST /api/demo/clients/:niche/duplicate` (Task 4), `apiFetch` (existing).
- Produces: `DemoClientSummary.category/emoji`, `EditableDemoClient.label/companyName/category/emoji`, `DemoClientPatch.category/emoji`, `useDuplicateDemoClient()`, `formatClientTitle()` — consumed by Tasks 9, 10, 11.

- [ ] **Step 1: Extend `DemoClientSummary`**

At `client/src/features/campaigns/api/demoClientsApi.ts:50-59`, add after `companyName: string;`:

```ts
  category: string | null;
  emoji: string | null;
```

- [ ] **Step 2: Extend `EditableDemoClient`**

At `client/src/features/campaigns/api/demoClientsApi.ts:61-69`, add after `niche: string;`:

```ts
  label: string;
  companyName: string;
  category: string | null;
  emoji: string | null;
```

- [ ] **Step 3: Extend `DemoClientPatch`**

At `client/src/features/campaigns/api/demoClientsApi.ts:71-77`, add after `bookingModeCall?: boolean;`:

```ts
  category?: string | null;
  emoji?: string | null;
```

- [ ] **Step 4: Add `formatClientTitle()`**

Add this exported function near the top of the file, after the `TermGroup` type definition (`client/src/features/campaigns/api/demoClientsApi.ts:48`) and before `DemoClientSummary`:

```ts
/**
 * "🍳 kitchens — Kitchens NL — Keukens BV — #12", dropping the label segment
 * when it equals niche (no custom label) and the company segment when empty.
 * Shared by ClientEditor's header and ClientsTab's grid cards (spec §4).
 */
export function formatClientTitle(client: {
  id: number;
  niche: string;
  label: string;
  companyName: string;
  emoji: string | null;
}): string {
  const parts = [client.niche];
  if (client.label && client.label !== client.niche) parts.push(client.label);
  if (client.companyName) parts.push(client.companyName);
  const prefix = client.emoji ? `${client.emoji} ` : "";
  return `${prefix}${parts.join(" — ")} — #${client.id}`;
}
```

- [ ] **Step 5: Add `useDuplicateDemoClient()`**

Add this after `useDeleteDemoClient()` at the bottom of the file:

```ts
export function useDuplicateDemoClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ niche, newNiche }: { niche: string; newNiche: string }) => {
      const res = await apiFetch(`/api/demo/clients/${encodeURIComponent(niche)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newNiche }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || "Could not duplicate this Client.");
      return data as { client: EditableDemoClient };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}
```

- [ ] **Step 6: Verify with the app running**

This file has no runtime effect on its own until Tasks 9-11 use it. Confirm it at least parses/typechecks in isolation by loading the page: open `https://app.leadawaker.com` (or wherever the Pi dev instance is reachable) in a browser, navigate to Campaigns → Clients. The existing (not-yet-updated) `ClientsTab`/`ClientEditor` should still render exactly as before — this task only adds exports, it does not change any existing behavior.

Expected: Clients tab loads with no console errors from this file (check the browser devtools console for a Vite overlay/red screen, which would indicate a type or import error surfaced at runtime).

- [ ] **Step 7: Commit**

```bash
git add client/src/features/campaigns/api/demoClientsApi.ts
git commit -m "feat(clients): client API layer gains category/emoji + duplicate hook"
```

---

## Task 9: `CategorySelect` — creatable category picker

**Files:**
- Create: `client/src/features/campaigns/components/clients/CategorySelect.tsx`

**Interfaces:**
- Consumes: `useDemoClients()` (existing, for the list of in-use categories).
- Produces: `<CategorySelect value={string} onChange={(v: string) => void} />` — consumed by Task 10.

- [ ] **Step 1: Write the component**

Mirrors the inline-create pattern in `client/src/features/campaigns/components/settings/NicheSelect.tsx`, minus the server round-trip (a new category needs no generation step, it just becomes a selectable value once this Client saves).

```tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { useDemoClients } from "../../api/demoClientsApi";

// Radix SelectItem cannot have value="" (throws), so "no category" is
// represented by this sentinel and swapped back to "" at the boundary.
const NONE = "__none__";

export function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation("campaigns");
  const { data: clients } = useDemoClients();
  const [showInput, setShowInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const categories = useMemo(() => {
    const set = new Set(
      (clients ?? [])
        .map((c) => (c.category ?? "").trim())
        .filter(Boolean),
    );
    if (value.trim()) set.add(value.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients, value]);

  const commitNew = () => {
    const name = newCategory.trim();
    if (!name) return;
    onChange(name);
    setShowInput(false);
    setNewCategory("");
  };

  return (
    <Select value={value.trim() || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="la-input" style={{ width: "100%" }}>
        <span>{value.trim() || t("clients.noCategory", "Uncategorized")}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("clients.noCategory", "Uncategorized")}</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}>
          {showInput ? (
            <div style={{ display: "flex", gap: 6, padding: "4px 6px" }} onKeyDown={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNew();
                }}
                placeholder={t("clients.newCategoryPlaceholder", "e.g. Wellness & Leisure")}
                maxLength={60}
                className="flex-1 h-8 rounded-md border border-black/[0.125] bg-background px-2.5 text-[12px] outline-none focus:border-brand-indigo"
              />
              <button
                onClick={commitNew}
                disabled={!newCategory.trim()}
                className="h-8 px-2 rounded-md bg-brand-indigo text-white disabled:opacity-50 text-[11px] shrink-0"
              >
                {t("clients.addCategory", "Add")}
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowInput(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 8px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--wine)",
                fontSize: 13,
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {t("clients.newCategory", "New category…")}
            </button>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Verify**

This component is not yet imported anywhere, so there's nothing to click yet. Confirm it doesn't break the build by checking the Vite terminal/pm2-equivalent client process for a transform error after saving the file (Vite HMR logs to the browser devtools console and/or the terminal running the client dev process).

Expected: no red overlay, no new errors in the client console.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/campaigns/components/clients/CategorySelect.tsx
git commit -m "feat(clients): add CategorySelect (creatable category picker)"
```

---

## Task 10: `ClientEditor` — autosave, combined title, category/emoji fields

**Files:**
- Modify: `client/src/features/campaigns/components/clients/ClientEditor.tsx`

**Interfaces:**
- Consumes: `useDemoClient`, `useUpdateDemoClient`, `formatClientTitle`, `TERM_GROUPS` (Task 8); `CategorySelect` (Task 9).
- Produces: `<ClientEditor niche={string} onBack={() => void} />` — note `onDeleted` is **removed** from the props (deletion now happens from the topbar menu in Task 11, which independently sets `selectedClientNiche` to `null`). Consumed by Task 12 (`ClientsTab`).

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `client/src/features/campaigns/components/clients/ClientEditor.tsx` with:

```tsx
/**
 * Edit one saved demo persona.
 *
 * The layout encodes a tested finding (specs/demo-persona-library/plan.md, "A
 * Client is ENGLISH, except its terms"): everything the MODEL reads works in
 * English alone, because the model translates as it writes. Only the five term
 * lists are substituted verbatim into the opener with no model in the loop, so
 * only those get a slot per language. That is why the long fields below are a
 * single English column and the terms are a three-column grid.
 *
 * Autosaves 1.5s after the last edit (mirrors useCampaignDetail.ts). Duplicate
 * and Delete live in the topbar's "..." menu (ClientActionsMenu.tsx), not here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import {
  TERM_GROUPS,
  useDemoClient,
  useUpdateDemoClient,
  formatClientTitle,
  type ClientTextField,
  type DemoLang,
  type DemoClientPatch,
  type EditableDemoClient,
  type TermGroup,
} from "../../api/demoClientsApi";
import { CategorySelect } from "./CategorySelect";

/** Long fields, in the order they read as a persona. `multiline` drives height. */
const TEXT_FIELDS: Array<{ field: ClientTextField; labelKey: string; rows?: number }> = [
  { field: "nicheLabel", labelKey: "clients.fields.nicheLabel" },
  { field: "companyNameTemplate", labelKey: "clients.fields.companyName" },
  { field: "serviceName", labelKey: "clients.fields.serviceName" },
  { field: "usp", labelKey: "clients.fields.usp", rows: 2 },
  { field: "descriptionTemplate", labelKey: "clients.fields.description", rows: 3 },
  { field: "kbTemplate", labelKey: "clients.fields.kb", rows: 6 },
  { field: "nicheQuestion", labelKey: "clients.fields.nicheQuestion", rows: 2 },
  { field: "enquiryContext", labelKey: "clients.fields.enquiryContext", rows: 2 },
  { field: "quoteContext", labelKey: "clients.fields.quoteContext", rows: 5 },
  { field: "scopingLadder", labelKey: "clients.fields.scopingLadder", rows: 8 },
  { field: "questionBank", labelKey: "clients.fields.questionBank", rows: 4 },
  { field: "objectionExamples", labelKey: "clients.fields.objections", rows: 4 },
];

/** Fields that ARE substituted verbatim, so they get the per-language treatment. */
const OPENER_FIELDS: Array<{ field: ClientTextField; labelKey: string; rows?: number }> = [
  { field: "firstMessage", labelKey: "clients.fields.firstMessage", rows: 3 },
  { field: "openerPhrase", labelKey: "clients.fields.openerPhrase" },
  { field: "whenLabel", labelKey: "clients.fields.whenLabel" },
];

const LANGS: DemoLang[] = ["en", "nl", "pt"];

const labelStyle: React.CSSProperties = {
  fontFamily: "Geist Mono, ui-monospace, monospace",
  fontSize: 10,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: "var(--mute-2)",
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--ink)",
  background: "var(--input)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-input, 10px)",
  padding: "9px 12px",
  resize: "vertical",
};

interface ClientEditorProps {
  niche: string;
  onBack: () => void;
}

/** Everything ClientEditor autosaves, as one flat draft object. */
interface Draft {
  text: Partial<Record<ClientTextField, Partial<Record<DemoLang, string>>>>;
  terms: Partial<Record<TermGroup, Partial<Record<DemoLang, string>>>>;
  category: string;
  emoji: string;
}

function buildDraft(client: EditableDemoClient): Draft {
  const terms: Draft["terms"] = {};
  for (const group of TERM_GROUPS) {
    terms[group] = {
      en: (client.terms[group]?.en ?? []).join(", "),
      nl: (client.terms[group]?.nl ?? []).join(", "),
      pt: (client.terms[group]?.pt ?? []).join(", "),
    };
  }
  return {
    text: client.text,
    terms,
    category: client.category ?? "",
    emoji: client.emoji ?? "",
  };
}

/** "keuken, keukenproject" -> ["keuken", "keukenproject"]. */
function splitTerms(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

function buildPatch(d: Draft): DemoClientPatch {
  const patch: DemoClientPatch = {
    text: d.text as DemoClientPatch["text"],
    terms: {},
    category: d.category.trim() || null,
    emoji: d.emoji.trim() || null,
  };
  for (const group of TERM_GROUPS) {
    patch.terms![group] = {
      en: splitTerms(d.terms[group]?.en),
      nl: splitTerms(d.terms[group]?.nl),
      pt: splitTerms(d.terms[group]?.pt),
    };
  }
  return patch;
}

function draftsEqual(a: Draft | null, b: Draft | null): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ClientEditor({ niche, onBack }: ClientEditorProps) {
  const { t } = useTranslation("campaigns");
  const { data: client, isLoading } = useDemoClient(niche);
  const update = useUpdateDemoClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [originalDraft, setOriginalDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const originalDraftRef = useRef(originalDraft);
  originalDraftRef.current = originalDraft;
  const nicheRef = useRef(niche);
  nicheRef.current = niche;

  // Load this Client's data into the draft. Re-fires when the fetched row
  // actually changes (new niche resolved, or a save round-tripped a fresh
  // updatedAt) — never on every render.
  useEffect(() => {
    if (!client) return;
    const d = buildDraft(client);
    setDraft(d);
    setOriginalDraft(d);
  }, [client?.niche, client?.updatedAt]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    (d: Draft) => {
      setSaving(true);
      update.mutate(
        { niche: nicheRef.current, patch: buildPatch(d) },
        {
          onSuccess: () => {
            setOriginalDraft(d);
            setSaving(false);
          },
          onError: () => setSaving(false),
        },
      );
    },
    [update],
  );

  // Fire-and-forget variant for the flush paths below: the component is
  // switching to a different Client (or unmounting), so there is no local
  // state left to reconcile an onSuccess into.
  const flushSave = useCallback(
    (targetNiche: string, d: Draft) => {
      update.mutate({ niche: targetNiche, patch: buildPatch(d) });
    },
    [update],
  );

  // Debounced autosave: 1.5s after the last edit, mirrors useCampaignDetail.ts.
  useEffect(() => {
    if (draftsEqual(draft, originalDraft)) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (draftRef.current) doSave(draftRef.current);
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [draft, originalDraft, doSave]);

  // Flush a pending save for the PREVIOUS niche when the parent switches which
  // Client is open (no remount: ClientsTab swaps the `niche` prop in place).
  const prevNicheRef = useRef(niche);
  useEffect(() => {
    if (autoSaveTimer.current && prevNicheRef.current !== niche) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
      const prevNiche = prevNicheRef.current;
      const d = draftRef.current;
      const orig = originalDraftRef.current;
      if (d && !draftsEqual(d, orig)) flushSave(prevNiche, d);
    }
    prevNicheRef.current = niche;
  }, [niche, flushSave]);

  // Flush on unmount (navigating off the Clients tab entirely).
  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        const d = draftRef.current;
        const orig = originalDraftRef.current;
        if (d && !draftsEqual(d, orig)) flushSaveRef.current(nicheRef.current, d);
      }
    };
  }, []);

  const setTextSlot = (field: ClientTextField, lang: DemoLang, value: string) => {
    setDraft((d) => (d ? { ...d, text: { ...d.text, [field]: { ...(d.text[field] ?? {}), [lang]: value } } } : d));
  };

  const setTermSlot = (group: TermGroup, lang: DemoLang, value: string) => {
    setDraft((d) => (d ? { ...d, terms: { ...d.terms, [group]: { ...(d.terms[group] ?? {}), [lang]: value } } } : d));
  };

  const setCategory = (value: string) => setDraft((d) => (d ? { ...d, category: value } : d));
  const setEmoji = (value: string) => setDraft((d) => (d ? { ...d, emoji: value } : d));

  const languagesWithTerms = useMemo(
    () => (draft ? LANGS.filter((l) => TERM_GROUPS.some((g) => (draft.terms[g]?.[l] ?? "").trim())) : []),
    [draft],
  );

  if (isLoading || !client || !draft) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 48, color: "var(--mute)" }}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="la-btn la-btn--soft la-btn--icon" onClick={onBack} title={t("clients.back", "Back")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="eyebrow wine">{t("clients.editing", "Client")}</div>
          <div className="serif italic" style={{ fontSize: 26, color: "var(--ink)", lineHeight: 1.25 }}>
            {formatClientTitle(client)}
          </div>
        </div>
        {saving && (
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--mute)" }}>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            {t("clients.saving", "Saving...")}
          </span>
        )}
      </div>

      {/* ── Identity: category + emoji ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 240 }}>
          <label style={labelStyle}>{t("clients.categoryLabel", "Category")}</label>
          <CategorySelect value={draft.category} onChange={setCategory} />
        </div>
        <div style={{ width: 90 }}>
          <label style={labelStyle}>{t("clients.emojiLabel", "Emoji")}</label>
          <input
            value={draft.emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            placeholder="🍳"
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── Terms: the only genuinely per-language part ── */}
      <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
        <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.termsTitle", "Words")}</div>
        <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
          {t("clients.termsHint")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "110px repeat(3, 1fr)", gap: 10, alignItems: "center" }}>
          <span />
          {LANGS.map((l) => (
            <span key={l} style={{ ...labelStyle, marginBottom: 0 }}>
              {l.toUpperCase()}
              {!languagesWithTerms.includes(l) && (
                <span style={{ color: "var(--mute-2)", opacity: 0.6 }}> {t("clients.empty", "(empty)")}</span>
              )}
            </span>
          ))}
          {TERM_GROUPS.map((group) => (
            <ClientTermRow
              key={group}
              label={t(`clients.terms.${group}`)}
              values={draft.terms[group] ?? {}}
              onChange={(lang, v) => setTermSlot(group, lang, v)}
            />
          ))}
        </div>
      </section>

      {/* ── Opener: substituted verbatim, so per-language too ── */}
      <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
        <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.openerTitle", "Opener")}</div>
        <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
          {t("clients.openerHint")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {OPENER_FIELDS.map(({ field, labelKey, rows }) => (
            <div key={field}>
              <label style={labelStyle}>{t(labelKey)}</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {LANGS.map((l) => (
                  <textarea
                    key={l}
                    value={draft.text[field]?.[l] ?? ""}
                    onChange={(e) => setTextSlot(field, l, e.target.value)}
                    rows={rows ?? 1}
                    placeholder={l.toUpperCase()}
                    style={inputStyle}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Everything the model reads: English is enough ── */}
      <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
        <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.personaTitle", "Persona")}</div>
        <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
          {t("clients.personaHint")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {TEXT_FIELDS.map(({ field, labelKey, rows }) => (
            <div key={field}>
              <label style={labelStyle}>{t(labelKey)}</label>
              <textarea
                value={draft.text[field]?.en ?? ""}
                onChange={(e) => setTextSlot(field, "en", e.target.value)}
                rows={rows ?? 1}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** One term group across the three languages. */
function ClientTermRow({
  label,
  values,
  onChange,
}: {
  label: string;
  values: Partial<Record<DemoLang, string>>;
  onChange: (lang: DemoLang, value: string) => void;
}) {
  return (
    <>
      <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{label}</span>
      {LANGS.map((l) => (
        <input
          key={l}
          value={values[l] ?? ""}
          onChange={(e) => onChange(l, e.target.value)}
          style={{ ...inputStyle, padding: "7px 10px" }}
        />
      ))}
    </>
  );
}
```

Note: `ClientEditor`'s only caller (`ClientsTab`, rewritten in Task 12) still passes `onDeleted` today — that call site is updated in the same task that removes it here, so don't worry about a dangling prop in between if working sequentially; if working via parallel subagents, land Task 12 in the same batch as this one.

- [ ] **Step 2: Verify in the browser**

Navigate to Campaigns → Clients (agency user — see `reference_app_admin_login.md`-style credentials, or your own agency login) and open any existing Client (e.g. "Kitchens").

Expected:
- No Save button; no Delete button in the header.
- The header title reads like `🍳 Kitchens — #<id>` (or with a label/company segment if that Client has one).
- Category and Emoji fields appear below the header, pre-filled from the backfill (Category should show "Kitchens & Interiors" for the Kitchens row).
- Typing into any field, waiting ~1.5s, shows a "Saving..." indicator briefly next to the header, then it disappears.
- Reload the page and reopen the same Client: the edit persisted.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/campaigns/components/clients/ClientEditor.tsx
git commit -m "$(cat <<'EOF'
feat(clients): ClientEditor autosaves, shows combined title, edits category/emoji

Replaces the Save button with a 1.5s debounced autosave (mirrors
useCampaignDetail.ts, including flush-on-switch and flush-on-unmount).
Delete moves out to the topbar's "..." menu. Header now reads
"{emoji} {niche} — {label} — {companyName} — #{id}".
EOF
)"
```

---

## Task 11: `ClientActionsMenu` — the topbar duplicate/delete menu

**Files:**
- Create: `client/src/features/campaigns/components/clients/ClientActionsMenu.tsx`

**Interfaces:**
- Consumes: `useDemoClient`, `useDuplicateDemoClient`, `useDeleteDemoClient` (Task 8).
- Produces: `<ClientActionsMenu niche={string} onDeleted={() => void} onDuplicated={(newNiche: string) => void} />` — consumed by Task 12 (`CampaignListView`'s topbar).

- [ ] **Step 1: Write the component**

Uses a `Popover` for the menu + the inline duplicate-name form (matches `ShareButton`'s step-based Popover pattern in the same topbar), and the original `ConfirmDelete` full-screen overlay (moved here verbatim from `ClientEditor.tsx`) for the destructive delete confirmation — per the house rule that Dialog-style overlays are for destructive confirmations, Popovers are for menus/forms.

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Copy, Trash2, ChevronLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDemoClient, useDuplicateDemoClient, useDeleteDemoClient } from "../../api/demoClientsApi";

export function ClientActionsMenu({
  niche,
  onDeleted,
  onDuplicated,
}: {
  niche: string;
  onDeleted: () => void;
  onDuplicated: (newNiche: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  const { data: client } = useDemoClient(niche);
  const duplicate = useDuplicateDemoClient();
  const remove = useDeleteDemoClient();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "duplicate">("menu");
  const [newNiche, setNewNiche] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Curated niche packs are listed and editable but not deletable: real
  // campaigns read their word lists. Duplicating one is still fine (it always
  // creates a NEW, deletable row) — only Delete is gated.
  const canDelete = client?.isDemoClient ?? false;

  const reset = () => {
    setStep("menu");
    setNewNiche("");
    setError(null);
  };

  const handleDuplicate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newNiche.trim();
    if (!name) return;
    setError(null);
    duplicate.mutate(
      { niche, newNiche: name },
      {
        onSuccess: (data) => {
          setOpen(false);
          reset();
          onDuplicated(data.client.niche);
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : t("clients.duplicateFailed", "Could not duplicate this Client."));
        },
      },
    );
  };

  const handleDelete = () => {
    remove.mutate(niche, {
      onSuccess: () => {
        setConfirmDelete(false);
        onDeleted();
      },
    });
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <PopoverTrigger asChild>
          <button className="la-btn la-btn--soft la-btn--icon" title={t("clients.moreActions", "More actions")}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          {step === "menu" && (
            <div className="space-y-1">
              <button
                onClick={() => {
                  setNewNiche(`${niche} copy`);
                  setStep("duplicate");
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted/50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />
                {t("clients.duplicate", "Duplicate")}
              </button>
              {canDelete && (
                <button
                  onClick={() => {
                    setOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  {t("clients.delete", "Delete")}
                </button>
              )}
            </div>
          )}

          {step === "duplicate" && (
            <form onSubmit={handleDuplicate} className="space-y-3">
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3 w-3" /> {t("clients.back", "Back")}
              </button>
              <div>
                <label className="block text-[12px] font-medium mb-1">
                  {t("clients.duplicateNamePrompt", "Name for the new Client")}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newNiche}
                  onChange={(e) => setNewNiche(e.target.value)}
                  maxLength={300}
                  className="w-full h-8 rounded-md border border-black/[0.125] bg-white px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors"
                />
              </div>
              {error && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={!newNiche.trim() || duplicate.isPending}
                className="w-full h-9 rounded-full bg-brand-indigo text-white font-medium text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {duplicate.isPending ? t("clients.duplicating", "Duplicating…") : t("clients.duplicate", "Duplicate")}
              </button>
            </form>
          )}
        </PopoverContent>
      </Popover>

      {confirmDelete && (
        <ConfirmDelete
          niche={niche}
          pending={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

/** Destructive confirmation. Moved here from ClientEditor.tsx: deletion now
 *  triggers from this topbar menu, not from the editor's own header. */
function ConfirmDelete({
  niche,
  pending,
  onCancel,
  onConfirm,
}: {
  niche: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("campaigns");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onCancel}
    >
      <div
        className="neu-raised"
        style={{ background: "var(--card)", padding: 26, borderRadius: "var(--r-card)", maxWidth: 380, margin: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="serif" style={{ fontSize: 20, color: "var(--ink)", marginBottom: 8 }}>
          {t("clients.confirmDeleteTitle", "Delete this Client?")}
        </div>
        <p style={{ fontSize: 13, color: "var(--mute)", lineHeight: 1.5, marginBottom: 18 }}>
          {t("clients.confirmDeleteBody", { niche })}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="la-btn la-btn--soft" onClick={onCancel}>
            {t("clients.cancel", "Cancel")}
          </button>
          <button className="la-btn la-btn--wine" onClick={onConfirm} disabled={pending}>
            {pending ? t("clients.deleting", "Deleting...") : t("clients.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Not yet rendered anywhere (Task 12 wires it into the topbar) — confirm the file compiles cleanly by checking the client dev process/browser console for transform errors after saving, same as Task 9 Step 2.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/campaigns/components/clients/ClientActionsMenu.tsx
git commit -m "feat(clients): add ClientActionsMenu (topbar duplicate/delete menu)"
```

---

## Task 12: Wire it up — `CampaignListView` topbar + `ClientsTab` grouping

**Files:**
- Modify: `client/src/features/campaigns/components/CampaignListView.tsx`
- Modify: `client/src/features/campaigns/components/clients/ClientsTab.tsx`

**Interfaces:**
- Consumes: `ClientActionsMenu` (Task 11), `ClientEditor` (Task 10, now takes only `niche`/`onBack`), `formatClientTitle` (Task 8), `GroupHeader` from `@/components/crm/primitives/GroupHeader` (existing, unrelated to the differently-shaped `GroupHeader` already imported in `CampaignListView.tsx` from `./CampaignListCard` — no collision since `ClientsTab.tsx` is a separate module).

- [ ] **Step 1: Add `selectedClientNiche` state and import `ClientActionsMenu`**

In `client/src/features/campaigns/components/CampaignListView.tsx`, add the import near the existing `ShareButton` import (`client/src/features/campaigns/components/CampaignListView.tsx:58`):

```ts
import { ShareButton } from "./detailView/atoms";
import { ClientActionsMenu } from "./clients/ClientActionsMenu";
```

Add state right after `const [filterSheetOpen, setFilterSheetOpen] = useState(false);` (`client/src/features/campaigns/components/CampaignListView.tsx:185`):

```ts
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Which Client is open in the Clients tab. Lifted up here (not local to
  // ClientsTab) because the topbar's "..." menu below needs to know, and the
  // topbar is a sibling of ClientsTab's body in this tree, the same reason
  // selectedCampaign is a prop of this component rather than local to
  // whatever renders the campaign list.
  const [selectedClientNiche, setSelectedClientNiche] = useState<string | null>(null);
```

- [ ] **Step 2: Render the menu in the topbar, left of Share**

At `client/src/features/campaigns/components/CampaignListView.tsx:654`, change:

```tsx
          {/* Share — demo campaigns only */}
          {selectedCampaign?.is_demo && <ShareButton campaign={selectedCampaign} />}
```

to:

```tsx
          {/* Duplicate/Delete — Clients tab only, when a Client is open */}
          {detailTab === "clients" && isAgencyUser && selectedClientNiche && (
            <ClientActionsMenu
              niche={selectedClientNiche}
              onDeleted={() => setSelectedClientNiche(null)}
              onDuplicated={(newNiche) => setSelectedClientNiche(newNiche)}
            />
          )}
          {/* Share — demo campaigns only */}
          {selectedCampaign?.is_demo && <ShareButton campaign={selectedCampaign} />}
```

- [ ] **Step 3: Pass the controlled props to `ClientsTab`**

At `client/src/features/campaigns/components/CampaignListView.tsx:891-893`, change:

```tsx
          {detailTab === "clients" && isAgencyUser ? (
            <ClientsTab />
          ) : loading && !selectedCampaign ? (
```

to:

```tsx
          {detailTab === "clients" && isAgencyUser ? (
            <ClientsTab selectedNiche={selectedClientNiche} onSelectNiche={setSelectedClientNiche} />
          ) : loading && !selectedCampaign ? (
```

- [ ] **Step 4: Rewrite `ClientsTab.tsx`**

Replace the full contents of `client/src/features/campaigns/components/clients/ClientsTab.tsx` with:

```tsx
/**
 * The Clients tab on the Campaigns page — the saved demo persona library
 * (specs/demo-persona-library/plan.md, phase 1).
 *
 * "Which Client is open" is controlled from CampaignListView (selectedNiche /
 * onSelectNiche), not local state here: the topbar's "..." menu
 * (ClientActionsMenu.tsx) needs to know which Client is open too, and it
 * lives in CampaignListView's shared topbar, a sibling of this tab's body.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Users, Loader2 } from "lucide-react";
import { GroupHeader } from "@/components/crm/primitives/GroupHeader";
import { useDemoClients, formatClientTitle, type DemoClientSummary } from "../../api/demoClientsApi";
import { ClientEditor } from "./ClientEditor";

export function ClientsTab({
  selectedNiche,
  onSelectNiche,
}: {
  selectedNiche: string | null;
  onSelectNiche: (niche: string | null) => void;
}) {
  const { t } = useTranslation("campaigns");
  const { data: clients, isLoading } = useDemoClients();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = clients ?? [];
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.niche.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q),
    );
  }, [clients, search]);

  // Grouped by category, alphabetical, "Uncategorized" last — the fix for a
  // flat 23+ card grid nobody could scan.
  const groups = useMemo(() => {
    const byCategory = new Map<string, DemoClientSummary[]>();
    for (const c of filtered) {
      const key = (c.category ?? "").trim();
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(c);
    }
    const named = Array.from(byCategory.keys())
      .filter((k) => k !== "")
      .sort((a, b) => a.localeCompare(b))
      .map((label) => ({ label, items: byCategory.get(label)! }));
    const uncategorized = byCategory.get("");
    if (uncategorized?.length) {
      named.push({ label: t("clients.noCategory", "Uncategorized"), items: uncategorized });
    }
    return named;
  }, [filtered, t]);

  return (
    <div className="h-full overflow-y-auto min-h-0" style={{ padding: "22px 24px" }}>
      <div className="max-w-[1386px] mr-auto">
        {selectedNiche ? (
          <ClientEditor niche={selectedNiche} onBack={() => onSelectNiche(null)} />
        ) : (
          <>
            {/* ── Header ── */}
            <div style={{ marginBottom: 20 }}>
              <div className="eyebrow wine" style={{ marginBottom: 8 }}>
                {t("clients.eyebrow", "Demo personas")}
              </div>
              <div
                className="serif italic"
                style={{ fontSize: 40, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em", marginBottom: 10 }}
              >
                {t("clients.title", "Clients")}
              </div>
              <p style={{ fontSize: 14, color: "var(--mute)", maxWidth: 620, lineHeight: 1.55 }}>
                {t("clients.intro")}
              </p>
            </div>

            {/* ── Search ── */}
            <div style={{ position: "relative", maxWidth: 320, marginBottom: 18 }}>
              <Search
                className="h-4 w-4"
                style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--mute-2)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("clients.searchPlaceholder", "Search Clients...")}
                style={{
                  width: "100%",
                  fontSize: 13,
                  color: "var(--ink)",
                  background: "var(--input)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-input, 10px)",
                  padding: "9px 12px 9px 34px",
                }}
              />
            </div>

            {/* ── Grouped list ── */}
            {isLoading ? (
              <div className="flex items-center gap-2" style={{ color: "var(--mute)", padding: 24 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span style={{ fontSize: 13 }}>{t("clients.loading", "Loading...")}</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasClients={(clients ?? []).length > 0} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {groups.map((g) => (
                  <div key={g.label}>
                    <GroupHeader label={g.label} count={g.items.length} />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
                        gap: 12,
                        padding: "12px 0 20px",
                      }}
                    >
                      {g.items.map((c) => (
                        <ClientCard key={c.id} client={c} onOpen={() => onSelectNiche(c.niche)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClientCard({ client, onOpen }: { client: DemoClientSummary; onOpen: () => void }) {
  const { t } = useTranslation("campaigns");
  return (
    <button
      onClick={onOpen}
      className="neu-raised"
      style={{
        textAlign: "left",
        padding: 18,
        borderRadius: "var(--r-card)",
        border: "none",
        cursor: "pointer",
        background: "var(--paper)",
        transition: "box-shadow 150ms, transform 150ms",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>
        {formatClientTitle(client)}
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
        {client.languages.length === 0 ? (
          <span
            style={{
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 9.5,
              letterSpacing: "0.1em",
              color: "var(--mute-2)",
            }}
          >
            {t("clients.vocabOnly", "WORDS ONLY")}
          </span>
        ) : (
          client.languages.map((l) => (
            <span
              key={l}
              style={{
                fontFamily: "Geist Mono, ui-monospace, monospace",
                fontSize: 9.5,
                letterSpacing: "0.1em",
                color: "var(--wine)",
                border: "1px solid var(--line)",
                borderRadius: 999,
                padding: "2px 7px",
              }}
            >
              {l.toUpperCase()}
            </span>
          ))
        )}
      </div>
    </button>
  );
}

function EmptyState({ hasClients }: { hasClients: boolean }) {
  const { t } = useTranslation("campaigns");
  return (
    <div
      className="neu-inset"
      style={{
        padding: 40,
        borderRadius: "var(--r-card)",
        textAlign: "center",
        color: "var(--mute)",
      }}
    >
      <Users className="h-6 w-6" style={{ margin: "0 auto 12px", color: "var(--mute-2)" }} />
      <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
        {hasClients ? t("clients.noMatches") : t("clients.emptyLibrary")}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Verify end-to-end in the browser**

Navigate to Campaigns → Clients as an agency user.

Expected — grid view:
- Clients render grouped under sticky section headers: "Climate & Energy", "Home & Trades", "Home Services", "Kitchens & Interiors", "Wellness & Leisure" (alphabetical), with each group's count shown.
- Each card's title is the combined format (e.g. `☀️ solar energy installer — SolarMax — #44` for whichever row has a company name set, or just `🍳 Kitchens — #<id>` for one that doesn't).
- Typing in the search box still filters across all groups; a group with zero matches disappears.

Expected — editor + topbar:
- Opening a Client shows the "..." button in the shared topbar, immediately left of the Share button (Share only shows when a *campaign* is also selected and is a demo campaign — the "..." button doesn't depend on that).
- Clicking "..." → "Duplicate" shows an inline name field pre-filled with `"<niche> copy"`; submitting creates a new Client, closes the popover, and immediately opens the new Client (still under the same category, since duplication copies it).
- Clicking "..." → "Delete" (only visible for Clients with `isDemoClient: true`, i.e. ones minted by a demo or by Duplicate — the 23 curated/backfilled rows should NOT show Delete) opens the same full-screen confirm dialog as before; confirming returns to the grid.
- Going back to the grid (← button) and reopening the tab strip on a different tab hides the "..." button (it only shows on the Clients tab).

Optionally, drive this with `playwright-cli` instead of a manual click-through (per project convention for UI verification) — log in per `reference_app_admin_login.md`, navigate to Campaigns, click the Clients tab, and screenshot the grouped grid + an open editor + the topbar menu open.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/campaigns/components/CampaignListView.tsx client/src/features/campaigns/components/clients/ClientsTab.tsx
git commit -m "$(cat <<'EOF'
feat(clients): wire up the topbar actions menu + categorized grouping

selectedClientNiche moves from ClientsTab's local state up into
CampaignListView, so the shared topbar can render ClientActionsMenu
for the open Client. ClientsTab now groups its grid by category using
the shared GroupHeader primitive, sorted alphabetically with
Uncategorized last, and cards show the combined identity title.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** §1 autosave → Task 10. §2 topbar menu → Tasks 11-12. §3 duplicate → Tasks 3-4, 8, 11. §4 combined title → Task 8 (`formatClientTitle`), used in Tasks 10 and 12. §5 schema → Task 1. §6 backfill → Task 1. §7 category/emoji editing + grouping → Tasks 9-10, 12. §8 generator prompt → Tasks 5-6. Out-of-scope note (§ "Explicitly not building") respected: `nicheGenerator.ts`/`NicheSelect.tsx` untouched throughout.
- **Type consistency checked:** `EditableDemoClient.category/emoji: string | null` (Task 8) matches `demoClientToEditable()`'s `row.category ?? null` (Task 2). `DemoClientPatch.category/emoji?: string | null` (Task 8) matches `clientPatchSchema`'s `.nullable().optional()` (Task 4) and `updateDemoClient()`'s `(patch.category ?? "").trim() || null` handling (Task 2). `ClientActionsMenu`'s `onDuplicated(data.client.niche)` matches `useDuplicateDemoClient()`'s returned `{ client: EditableDemoClient }` shape (Task 8) and the route's `res.json({ client: demoClientToEditable(result.row) })` (Task 4). `ClientEditor`'s dropped `onDeleted` prop is removed at its only call site in the same task batch (Task 12) that adds `ClientActionsMenu`'s independent `onDeleted`.
- **No placeholders:** every step has literal code, not a description of code.
- **Ordering:** Task 2's `saveDemoClient()` edit references `ctx.category`/`ctx.emoji`, which don't exist on `NicheContext` until Task 5 — flagged inline in Task 2 as an expected, temporary non-compiling intermediate state within the plan's sequencing (both land well before any task that exercises that path over HTTP or in the browser).
