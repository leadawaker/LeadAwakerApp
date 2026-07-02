# Niche Vocabulary Packs & Niches Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 16 niches real, niche-specific Discovery Prompt example-pack content in English and Dutch (so none silently fall back to `__default__`), fix the pre-existing EN/NL duplication bug on `Kitchens`/`__default__`, and rebuild the Niches management page (and the campaign niche picker) around a free-text, fully dynamic niche list instead of two independent hardcoded 16-item lists.

**Architecture:** Part 1 is a data backfill delivered by a small Node/tsx toolchain (`script/niche-packs/`) that validates and applies JSON content files directly to the `Niche_Vocabulary` table — no schema changes. Part 2 splits `NicheVocabularyPanel.tsx` into a composition + `NicheListRail` (left) + `NicheDetailPanel` (right) so exactly one niche is visible at a time, and switches "add niche" from a fixed `<select>` to free text. Part 3 adds a lightweight `GET /api/niches` endpoint so the campaign settings niche picker reads the same dynamic list instead of its own separate hardcoded array.

**Tech Stack:** React + TypeScript (Vite), Express + Drizzle ORM + PostgreSQL, `pg` Pool for one-off scripts, `tsx` as the script runner, i18n via `react-i18next` (en/nl only).

**Spec:** `docs/superpowers/specs/2026-07-02-niche-vocabulary-packs-and-page-redesign-design.md`

## Global Constraints

- App runs via **pm2** on the Pi; server/client changes hot-reload automatically. Never run `npm run dev`.
- **Never run `tsc`** as part of any task step — verification here is manual (DB queries, browser checks), matching this project's convention (no automated test suite exists).
- **i18n:** every new user-facing string goes through `t()` and both `client/src/locales/en/prompts.json` and `client/src/locales/nl/prompts.json`. No pt-BR (dropped product-wide).
- Keep files under ~500 lines; split into focused modules when a file grows past that (this is why Part 2 splits `NicheVocabularyPanel.tsx`).
- **No em dashes or en dashes** in any generated example-pack text (this is a literal rule inside Prompt 93 §3 that the AI bot itself follows — example content that violates it would contradict the bot's own instructions) — use commas, colons or semicolons instead. This also applies to my own prose/commit messages per house style.
- The database is the **live production Pi database**, not a sandbox. Any niche created for manual verification (Task 13) must be deleted again afterward.
- Never modify `__default__`'s or `Kitchens`' `nl` pack content — only their `en` side is being fixed in this plan.

---

## Part 1 — Content backfill

### Task 1: Niche pack contract + validator/apply tooling

**Files:**
- Create: `script/niche-packs/CONTRACT.md`
- Create: `script/niche-packs/types.ts`
- Create: `script/niche-packs/validate.ts`
- Create: `script/niche-packs/apply.ts`
- Create: `script/niche-packs/data/.gitkeep`

**Interfaces:**
- Produces: the `NichePackFile` type, the `data/` directory convention, and the `validate.ts` / `apply.ts` CLIs that every later task in Part 1 depends on.

- [ ] **Step 1: Write the contract doc**

Create `script/niche-packs/CONTRACT.md`:

```markdown
# Niche Example-Pack Content Contract

Read this before writing any niche's pack content. It defines the exact shape
Prompt 93 ("Discovery Prompt", v8.7+) expects when it substitutes
`{niche_question_bank}`, `{niche_bad_examples}`, `{niche_objection_examples}`,
`{niche_scenario_examples}` for a given niche/language.

## Output file

One JSON file per niche at `script/niche-packs/data/<slug>.json`:

```json
{
  "niche": "Exact Niche Name As Stored In The DB",
  "question_bank": { "en": "...", "nl": "..." },
  "bad_examples": { "en": "...", "nl": "..." },
  "objection_examples": { "en": "...", "nl": "..." },
  "scenario_examples": { "en": "...", "nl": "..." }
}
```

All 8 strings (4 fields x 2 languages) must be non-empty plain text using `\n`
for line breaks, the same way the existing Kitchens content does. `##`
headers are used only inside `scenario_examples`.

## See the gold-standard example first

Before writing anything, pull Kitchens' current content (the one niche that
already has real packs) and read it end to end:

```bash
node --env-file=.env -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('select question_bank, bad_examples, objection_examples, scenario_examples from p2mxx34fvbf3ll6.\"Niche_Vocabulary\" where niche = \$1', ['Kitchens'])
  .then(r => { console.log(JSON.stringify(r.rows[0], null, 2)); pool.end(); });
"
```

Use the **`nl` side** of that output as your structural template. Its `en`
side is a known bug (duplicated Dutch text) — do not copy it, and do not
model your `en` writing on it.

## Per-field structural requirements (do not deviate from these categories)

- **`bad_examples`** — a handful of presumptuous/leading questions to avoid,
  in the niche's own domain (mirrors what sits right after "Bad examples:"
  in the base prompt's question-quality rule).
- **`question_bank`** — five sub-parts, in this order: (1) preferred open
  questions to use when the prospect gave only a bare status, (2)
  price-framed-status examples showing a price remark read as status, not
  objection, with the reframed response, (3) a general good-question bank
  (roughly 15-20 reusable lines mixing questions and short acknowledging
  transitions), (4) the "I need to think about it" special case, (5) the
  "not now" special case (said after the prospect already indicated they
  are comparing).
- **`objection_examples`** — exactly these seven named categories, in this
  order, because later prompt sections reference them by name ("the
  commitment-check phrasings in Step 4", "the relevance phrasings in Step
  4"): Price; Cheaper competitor; Reframe after a second objection; Closing
  after two clear rejections; Commitment check (buying signal); Advisor
  relevance (price difference); Advisor relevance (remaining questions).
- **`scenario_examples`** — numbered `## 6.1` through `## 6.7` (do not use
  `6.8`/`6.9`, those are hardcoded in the base prompt right after this
  block). Categories, in order: 6.1 Timing issue; 6.2 Situation outside our
  control; 6.3 AI accusation; 6.4 Pricing and deals; 6.5 Unknown/detailed
  question you cannot answer; 6.6 a niche-flavored "committed elsewhere"
  scenario (Kitchens' version: prospect already purchased from another
  kitchen supplier); 6.7 Data question ("where did you get my details?").

## Language & market grounding

Both `en` and `nl` describe the **same Dutch business reality** — Euro
pricing, BTW, gemeente vergunningen, VvE, subsidy schemes (ISDE, Warmtefonds,
salderingsregeling) where relevant to the niche. `en` is a natural English
rendering for an English-speaking prospect dealing with a Dutch business, not
a US-market scenario set, and not a literal duplicate of the Dutch text.

## Style rules inherited from the base prompt

- No em dashes or en dashes anywhere — use commas, colons or semicolons.
- No emojis.
- No quotation marks wrapping full example messages (short inline quoted
  fragments used purely to classify a reply, like Kitchens' `"we hebben het
  uitgesteld"`, are fine).
- Vary acknowledgement words (Helder / Dat begrijp ik / Ik snap het /
  Natuurlijk, and their English equivalents) — the base prompt bans using the
  same one twice in a row.

## Validate before moving on

```bash
npx tsx script/niche-packs/validate.ts script/niche-packs/data/<slug>.json
```

Fix everything it reports before considering the niche done.
```

- [ ] **Step 2: Write the shared type**

Create `script/niche-packs/types.ts`:

```typescript
export interface NichePackBilingual {
  en: string;
  nl: string;
}

export interface NichePackFile {
  niche: string;
  question_bank: NichePackBilingual;
  bad_examples: NichePackBilingual;
  objection_examples: NichePackBilingual;
  scenario_examples: NichePackBilingual;
}

export const PACK_FIELD_NAMES = [
  "question_bank",
  "bad_examples",
  "objection_examples",
  "scenario_examples",
] as const;

export const REQUIRED_SCENARIO_MARKERS = [
  "## 6.1", "## 6.2", "## 6.3", "## 6.4", "## 6.5", "## 6.6", "## 6.7",
];

export const MIN_FIELD_LENGTH = 150;
```

- [ ] **Step 3: Write the validator**

Create `script/niche-packs/validate.ts`:

```typescript
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  NichePackFile, PACK_FIELD_NAMES, REQUIRED_SCENARIO_MARKERS, MIN_FIELD_LENGTH,
} from "./types";

const DATA_DIR = join(__dirname, "data");
const DASH_RE = /[–—]/;

function validateFile(path: string): string[] {
  const errors: string[] = [];
  let data: NichePackFile;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return [`invalid JSON: ${(e as Error).message}`];
  }

  if (!data.niche || typeof data.niche !== "string") {
    errors.push("missing 'niche' string");
  }

  for (const field of PACK_FIELD_NAMES) {
    const val = (data as any)[field];
    if (!val || typeof val !== "object") {
      errors.push(`missing '${field}'`);
      continue;
    }
    for (const lang of ["en", "nl"] as const) {
      const text = val[lang];
      if (typeof text !== "string" || text.trim().length < MIN_FIELD_LENGTH) {
        errors.push(`${field}.${lang} is missing or shorter than ${MIN_FIELD_LENGTH} chars`);
        continue;
      }
      if (DASH_RE.test(text)) {
        errors.push(`${field}.${lang} contains an em/en dash, which the base prompt bans`);
      }
    }
  }

  if (data.scenario_examples) {
    for (const lang of ["en", "nl"] as const) {
      const text = data.scenario_examples[lang] || "";
      for (const marker of REQUIRED_SCENARIO_MARKERS) {
        if (!text.includes(marker)) {
          errors.push(`scenario_examples.${lang} is missing marker "${marker}"`);
        }
      }
    }
  }

  return errors;
}

const args = process.argv.slice(2);
const targets = args.length > 0
  ? args
  : readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).map((f) => join(DATA_DIR, f));

let anyFail = false;
for (const path of targets) {
  const errors = validateFile(path);
  if (errors.length === 0) {
    console.log(`OK   ${path}`);
  } else {
    anyFail = true;
    console.log(`FAIL ${path}`);
    for (const e of errors) console.log(`     - ${e}`);
  }
}
process.exit(anyFail ? 1 : 0);
```

- [ ] **Step 4: Prove the validator catches bad content**

Run:
```bash
mkdir -p /tmp/niche-pack-check && cat > /tmp/niche-pack-check/bad.json <<'EOF'
{ "niche": "Test", "question_bank": { "en": "too short", "nl": "too short" } }
EOF
npx tsx script/niche-packs/validate.ts /tmp/niche-pack-check/bad.json
```
Expected: exits non-zero, prints `FAIL`, and lists missing `bad_examples`,
missing `objection_examples`, missing `scenario_examples`, plus the length
errors on `question_bank.en`/`question_bank.nl`.

```bash
rm -rf /tmp/niche-pack-check
```

- [ ] **Step 5: Write the apply script**

Create `script/niche-packs/apply.ts`:

```typescript
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import { NichePackFile } from "./types";

const DATA_DIR = join(__dirname, "data");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("No data files found in script/niche-packs/data/");
    await pool.end();
    return;
  }
  for (const file of files) {
    const data: NichePackFile = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
    await pool.query(
      `UPDATE "p2mxx34fvbf3ll6"."Niche_Vocabulary"
       SET question_bank = $1::jsonb, bad_examples = $2::jsonb,
           objection_examples = $3::jsonb, scenario_examples = $4::jsonb,
           updated_at = now()
       WHERE niche = $5`,
      [
        JSON.stringify(data.question_bank),
        JSON.stringify(data.bad_examples),
        JSON.stringify(data.objection_examples),
        JSON.stringify(data.scenario_examples),
        data.niche,
      ],
    );
    console.log(`applied ${data.niche} (${file})`);
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Create the empty data directory placeholder and commit**

```bash
touch script/niche-packs/data/.gitkeep
git add script/niche-packs/CONTRACT.md script/niche-packs/types.ts \
  script/niche-packs/validate.ts script/niche-packs/apply.ts \
  script/niche-packs/data/.gitkeep
git commit -m "chore(niche-packs): add content contract, validator and apply tooling"
```

---

### Task 2: Draft content — Bathrooms, Countertops, Flooring

**Files:**
- Create: `script/niche-packs/data/bathrooms.json`
- Create: `script/niche-packs/data/countertops.json`
- Create: `script/niche-packs/data/flooring.json`

**Interfaces:**
- Consumes: `script/niche-packs/CONTRACT.md` and `validate.ts` (Task 1).
- Produces: three files matching the `NichePackFile` shape, consumed generically by `apply.ts` in Task 8.

- [ ] **Step 1: Read the contract and the live Kitchens reference**

Read `script/niche-packs/CONTRACT.md` in full, then run the DB query it
specifies to pull Kitchens' current `nl` pack content as your structural
template.

- [ ] **Step 2: Write `script/niche-packs/data/bathrooms.json`**

Write realistic, niche-specific content for a Dutch bathroom-renovation
business, following the CONTRACT's per-field structure exactly (same
sub-parts for `question_bank`, same seven named categories for
`objection_examples` in the same order, `scenario_examples` numbered `##
6.1` through `## 6.7`). Ground it in real bathroom-renovation
specifics: waterproofing/tegelwerk quality concerns, "goedkopere aannemer"
comparisons, VvE approval when plumbing risers are shared, planning around
a single working bathroom during the renovation. Write both `en` and `nl`
as natural, distinct language versions of the same Dutch-market content per
the CONTRACT's language rule. No em/en dashes anywhere.

- [ ] **Step 3: Write `script/niche-packs/data/countertops.json`**

Same structure, themed to countertops/worktops (material comparisons:
composiet, natuursteen, kwarts; measuring/template lead times; overlap with
an existing kitchen renovation project; "goedkoper alternatief" objections
around material grade).

- [ ] **Step 4: Write `script/niche-packs/data/flooring.json`**

Same structure, themed to flooring (vloerverwarming compatibility,
ondervloer/subfloor condition, material choice: PVC, laminaat, houten
vloer; scheduling around moving furniture out; a cheaper flooring quote
objection).

- [ ] **Step 5: Validate all three**

```bash
npx tsx script/niche-packs/validate.ts \
  script/niche-packs/data/bathrooms.json \
  script/niche-packs/data/countertops.json \
  script/niche-packs/data/flooring.json
```
Expected: all three print `OK`. Fix and re-run until they do.

- [ ] **Step 6: Commit**

```bash
git add script/niche-packs/data/bathrooms.json \
  script/niche-packs/data/countertops.json \
  script/niche-packs/data/flooring.json
git commit -m "content(niche-packs): draft Bathrooms, Countertops, Flooring example packs"
```

---

### Task 3: Draft content — General Contracting, HVAC, Interior Design

**Files:**
- Create: `script/niche-packs/data/general-contracting.json`
- Create: `script/niche-packs/data/hvac.json`
- Create: `script/niche-packs/data/interior-design.json`

**Interfaces:**
- Consumes: `script/niche-packs/CONTRACT.md` and `validate.ts` (Task 1).
- Produces: three files matching the `NichePackFile` shape, consumed generically by `apply.ts` in Task 8.

- [ ] **Step 1: Read the contract and the live Kitchens reference**

Read `script/niche-packs/CONTRACT.md` in full, then run the DB query it
specifies to pull Kitchens' current `nl` pack content as your structural
template.

- [ ] **Step 2: Write `script/niche-packs/data/general-contracting.json`**

Theme to general/verbouwing contracting (multi-trade project scope
uncertainty, gemeente vergunning timelines for structural work, comparing
a full-service aannemer quote against separate specialist quotes, planning
around living in the house during the verbouwing).

- [ ] **Step 3: Write `script/niche-packs/data/hvac.json`**

Theme to HVAC/heat pumps (ISDE subsidy timing and amount, warmtepomp vs
gas ketel payback period, geluidsnormen for outdoor units near
buren/neighbors, comparing installers on merk/brand and garantie).

- [ ] **Step 4: Write `script/niche-packs/data/interior-design.json`**

Theme to interior design (styling vs full renovation scope confusion,
comparing a fixed-fee vs hourly-rate voorstel, partner alignment on style
direction, timeline tied to furniture/material lead times).

- [ ] **Step 5: Validate all three**

```bash
npx tsx script/niche-packs/validate.ts \
  script/niche-packs/data/general-contracting.json \
  script/niche-packs/data/hvac.json \
  script/niche-packs/data/interior-design.json
```
Expected: all three print `OK`. Fix and re-run until they do.

- [ ] **Step 6: Commit**

```bash
git add script/niche-packs/data/general-contracting.json \
  script/niche-packs/data/hvac.json \
  script/niche-packs/data/interior-design.json
git commit -m "content(niche-packs): draft General Contracting, HVAC, Interior Design example packs"
```

---

### Task 4: Draft content — Landscaping, Moving Services, Painting

**Files:**
- Create: `script/niche-packs/data/landscaping.json`
- Create: `script/niche-packs/data/moving-services.json`
- Create: `script/niche-packs/data/painting.json`

**Interfaces:**
- Consumes: `script/niche-packs/CONTRACT.md` and `validate.ts` (Task 1).
- Produces: three files matching the `NichePackFile` shape, consumed generically by `apply.ts` in Task 8.

- [ ] **Step 1: Read the contract and the live Kitchens reference**

Read `script/niche-packs/CONTRACT.md` in full, then run the DB query it
specifies to pull Kitchens' current `nl` pack content as your structural
template.

- [ ] **Step 2: Write `script/niche-packs/data/landscaping.json`**

Theme to landscaping/tuinaanleg (seasonal planting windows, gemeente
vergunning for a kapvergunning or bestrating drainage rules, plant
choice/onderhoud trade-offs, comparing a cheaper hovenier's material
quality).

- [ ] **Step 3: Write `script/niche-packs/data/moving-services.json`**

Theme to moving services (verhuisdatum flexibility tied to key handover,
inpakservice vs zelf inpakken scope, comparing a cheaper verhuisbedrijf's
insurance/verzekering coverage, parking/laadzone permit at both addresses).

- [ ] **Step 4: Write `script/niche-packs/data/painting.json`**

Theme to painting (binnen vs buiten scope, kleurkeuze indecision,
scheduling around occupancy/uitvoerbaarheid while living in the house,
comparing a cheaper schilder's aantal lagen/prep work).

- [ ] **Step 5: Validate all three**

```bash
npx tsx script/niche-packs/validate.ts \
  script/niche-packs/data/landscaping.json \
  script/niche-packs/data/moving-services.json \
  script/niche-packs/data/painting.json
```
Expected: all three print `OK`. Fix and re-run until they do.

- [ ] **Step 6: Commit**

```bash
git add script/niche-packs/data/landscaping.json \
  script/niche-packs/data/moving-services.json \
  script/niche-packs/data/painting.json
git commit -m "content(niche-packs): draft Landscaping, Moving Services, Painting example packs"
```

---

### Task 5: Draft content — Pest Control, Pool Installation, Roofing

**Files:**
- Create: `script/niche-packs/data/pest-control.json`
- Create: `script/niche-packs/data/pool-installation.json`
- Create: `script/niche-packs/data/roofing.json`

**Interfaces:**
- Consumes: `script/niche-packs/CONTRACT.md` and `validate.ts` (Task 1).
- Produces: three files matching the `NichePackFile` shape, consumed generically by `apply.ts` in Task 8.

- [ ] **Step 1: Read the contract and the live Kitchens reference**

Read `script/niche-packs/CONTRACT.md` in full, then run the DB query it
specifies to pull Kitchens' current `nl` pack content as your structural
template.

- [ ] **Step 2: Write `script/niche-packs/data/pest-control.json`**

Theme to pest control (urgency vs recurring-contract framing, comparing a
one-time behandeling against a jaarcontract, effectiveness doubts after a
cheaper provider's earlier failed treatment, tenant/verhuurder
responsibility questions).

- [ ] **Step 3: Write `script/niche-packs/data/pool-installation.json`**

Theme to pool installation (gemeente vergunning and grondwaterstand
survey timing, seasonal installation window, comparing a cheaper
zwembadbouwer's materiaal/garantie, onderhoudscontract add-on decision).

- [ ] **Step 4: Write `script/niche-packs/data/roofing.json`**

Theme to roofing (dakisolatie subsidy overlap with re-roofing, weather
window for the werkzaamheden, comparing a cheaper dakdekker's
materiaalkwaliteit and garantietermijn, VvE approval for a shared roof).

- [ ] **Step 5: Validate all three**

```bash
npx tsx script/niche-packs/validate.ts \
  script/niche-packs/data/pest-control.json \
  script/niche-packs/data/pool-installation.json \
  script/niche-packs/data/roofing.json
```
Expected: all three print `OK`. Fix and re-run until they do.

- [ ] **Step 6: Commit**

```bash
git add script/niche-packs/data/pest-control.json \
  script/niche-packs/data/pool-installation.json \
  script/niche-packs/data/roofing.json
git commit -m "content(niche-packs): draft Pest Control, Pool Installation, Roofing example packs"
```

---

### Task 6: Draft content — Solar Panels, Wellness, Windows & Doors

**Files:**
- Create: `script/niche-packs/data/solar-panels.json`
- Create: `script/niche-packs/data/wellness.json`
- Create: `script/niche-packs/data/windows-and-doors.json`

**Interfaces:**
- Consumes: `script/niche-packs/CONTRACT.md` and `validate.ts` (Task 1).
- Produces: three files matching the `NichePackFile` shape, consumed generically by `apply.ts` in Task 8.

- [ ] **Step 1: Read the contract and the live Kitchens reference**

Read `script/niche-packs/CONTRACT.md` in full, then run the DB query it
specifies to pull Kitchens' current `nl` pack content as your structural
template.

- [ ] **Step 2: Write `script/niche-packs/data/solar-panels.json`**

Theme to solar panels (terugverdientijd/payback period, salderingsregeling
phase-out changing the calculation, dakoriëntatie and schaduw affecting
panel count, VvE approval for apartment roofs, comparing a cheaper
installer's paneelmerk and garantie).

- [ ] **Step 3: Write `script/niche-packs/data/wellness.json`**

Theme to home wellness installs (sauna/infrarood/whirlpool), covering
ruimte and elektra requirements, comparing a cheaper leverancier's
materiaalkwaliteit, partner alignment on whether it's worth the investment,
installation scheduling.

- [ ] **Step 4: Write `script/niche-packs/data/windows-and-doors.json`**

Theme to windows & doors (glasisolatie/HR++ or triple glas upgrade
subsidy, monumentenstatus restrictions on some properties, comparing a
cheaper leverancier's kozijnmateriaal, installation timing around weather).

- [ ] **Step 5: Validate all three**

```bash
npx tsx script/niche-packs/validate.ts \
  script/niche-packs/data/solar-panels.json \
  script/niche-packs/data/wellness.json \
  script/niche-packs/data/windows-and-doors.json
```
Expected: all three print `OK`. Fix and re-run until they do.

- [ ] **Step 6: Commit**

```bash
git add script/niche-packs/data/solar-panels.json \
  script/niche-packs/data/wellness.json \
  script/niche-packs/data/windows-and-doors.json
git commit -m "content(niche-packs): draft Solar Panels, Wellness, Windows & Doors example packs"
```

---

### Task 7: Fix Kitchens + `__default__` English packs

**Files:**
- Create: `script/niche-packs/data/kitchens.json`
- Create: `script/niche-packs/data/default.json`

**Interfaces:**
- Consumes: `script/niche-packs/CONTRACT.md` and `validate.ts` (Task 1); the current DB rows for `Kitchens` and `__default__`.
- Produces: two files matching the `NichePackFile` shape (with `nl` copied verbatim from the DB and only `en` newly written), consumed generically by `apply.ts` in Task 8.

- [ ] **Step 1: Pull both current rows**

```bash
node --env-file=.env -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('select niche, question_bank, bad_examples, objection_examples, scenario_examples from p2mxx34fvbf3ll6.\"Niche_Vocabulary\" where niche in (\$1, \$2)', ['Kitchens', '__default__'])
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); pool.end(); });
"
```
Confirm both rows currently have `en` identical to `nl` for all four fields
(this is the bug being fixed).

- [ ] **Step 2: Write `script/niche-packs/data/kitchens.json`**

Set `"niche": "Kitchens"`. For every field's `nl` value, copy the exact
string from the query output in Step 1 (unchanged, byte-for-byte). For
every field's `en` value, write a natural, non-duplicated English
translation of that same `nl` content, keeping the exact same structure
(same sub-parts, same seven objection categories, same `## 6.1`-`## 6.7`
numbering) and the same kitchen-specific specifics, just genuinely in
English rather than copy-pasted Dutch. No em/en dashes.

- [ ] **Step 3: Write `script/niche-packs/data/default.json`**

Set `"niche": "__default__"`. Same process as Step 2, applied to the
`__default__` row's content instead.

- [ ] **Step 4: Validate both**

```bash
npx tsx script/niche-packs/validate.ts \
  script/niche-packs/data/kitchens.json \
  script/niche-packs/data/default.json
```
Expected: both print `OK`.

- [ ] **Step 5: Confirm `nl` is untouched**

```bash
node -e "
const fs = require('fs');
const kitchens = JSON.parse(fs.readFileSync('script/niche-packs/data/kitchens.json', 'utf8'));
console.log('question_bank.nl length:', kitchens.question_bank.nl.length);
"
```
Cross-check this length (and a spot-check of the text) against the Step 1
query output to confirm the `nl` side was copied verbatim, not
paraphrased.

- [ ] **Step 6: Commit**

```bash
git add script/niche-packs/data/kitchens.json script/niche-packs/data/default.json
git commit -m "content(niche-packs): fix Kitchens/__default__ en packs (were duplicated Dutch)"
```

---

### Task 8: Apply all pack content to the database and verify

**Files:**
- None created or modified (this task runs the tooling from Task 1 against the data from Tasks 2-7).

**Interfaces:**
- Consumes: `script/niche-packs/apply.ts` (Task 1) and all 17 files in `script/niche-packs/data/` (Tasks 2-7).

- [ ] **Step 1: Validate everything at once**

```bash
npx tsx script/niche-packs/validate.ts
```
Expected: 17 `OK` lines (15 new niches + `kitchens.json` + `default.json`),
exit code 0. Fix any `FAIL` before continuing.

- [ ] **Step 2: Apply to the database**

```bash
npx tsx --env-file=.env script/niche-packs/apply.ts
```
Expected: 17 `applied <niche> (<file>)` lines, no errors.

- [ ] **Step 3: Verify completeness in the database**

```bash
node --env-file=.env -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`select niche,
  (question_bank->>'en' is not null and length(question_bank->>'en') > 0) as has_qb_en,
  (question_bank->>'nl' is not null and length(question_bank->>'nl') > 0) as has_qb_nl,
  (bad_examples->>'en' is not null and length(bad_examples->>'en') > 0) as has_bad_en,
  (objection_examples->>'en' is not null and length(objection_examples->>'en') > 0) as has_obj_en,
  (scenario_examples->>'en' is not null and length(scenario_examples->>'en') > 0) as has_scen_en
  from p2mxx34fvbf3ll6.\"Niche_Vocabulary\" order by niche\`)
  .then(r => { console.table(r.rows); pool.end(); });
"
```
Expected: every row (all 17, including `__default__`) shows `true` in
every column.

- [ ] **Step 4: No commit needed**

This task only mutates the live database; there is nothing new to commit
to git (the files it consumed were already committed in Tasks 1-7).

---

## Part 2 — Niches page redesign

### Task 9: Extract shared niche types + `NicheDetailPanel` (pure refactor)

**Files:**
- Create: `client/src/features/prompts/components/niche/nicheShared.ts`
- Create: `client/src/features/prompts/components/niche/NicheDetailPanel.tsx`
- Modify: `client/src/features/prompts/components/NicheVocabularyPanel.tsx`

**Interfaces:**
- Produces: `nicheShared.ts` exports (`NicheRow`, `NicheWordGroup`, `NicheWordGroups`, `NicheLang`, `NicheTemplate`, `TemplateFieldName`, `PackField`, `PACK_FIELDS`, `NICHE_WORD_GROUPS`, `EMPTY_NICHE_GROUPS`, `EMPTY_TEMPLATE`, `DEFAULT_NICHE`, `resolveNicheIcon(niche, isDefault)`), and `NicheDetailPanel` (a component taking the same props the old inline `NicheCard` took, plus a new `onBack` callback). Both are consumed by Task 10.
- This task does not change behavior: the page still stacks every niche as a full card, in the same order, with the same interactions. Only the file layout changes.

- [ ] **Step 1: Create `nicheShared.ts`**

```typescript
import type { ElementType } from "react";
import {
  UtensilsCrossed, Bath, Layers, Grid3x3, Hammer, Sun, Wind,
  Home, TreePine, DoorOpen, Paintbrush, Bug, Waves, Truck,
  Heart, Sofa, Building2,
} from "lucide-react";

// Mirrors shared/schema's NICHE_WORD_GROUPS. Defined locally so the client
// bundle does not pull the Drizzle schema module just for these constants.
export const NICHE_WORD_GROUPS = [
  "projectTerm", "proposalTerm", "decisionTerm", "advisorTerm", "visitTerm",
] as const;
export type NicheWordGroup = (typeof NICHE_WORD_GROUPS)[number];
export type NicheWordGroups = Record<NicheWordGroup, string[]>;
export type NicheLang = "nl" | "en";
export type NicheTemplate = { nl: string; en: string };
export const EMPTY_NICHE_GROUPS: NicheWordGroups = {
  projectTerm: [], proposalTerm: [], decisionTerm: [], advisorTerm: [], visitTerm: [],
};
export const EMPTY_TEMPLATE: NicheTemplate = { nl: "", en: "" };

export type NicheRow = {
  niche: string;
  nl: NicheWordGroups;
  en: NicheWordGroups;
  companyNameTemplate: NicheTemplate;
  descriptionTemplate: NicheTemplate;
  kbTemplate: NicheTemplate;
  questionBank: NicheTemplate;
  badExamples: NicheTemplate;
  objectionExamples: NicheTemplate;
  scenarioExamples: NicheTemplate;
};

export const PACK_FIELDS = ["questionBank", "badExamples", "objectionExamples", "scenarioExamples"] as const;
export type PackField = (typeof PACK_FIELDS)[number];
export type TemplateFieldName = "companyNameTemplate" | "descriptionTemplate" | "kbTemplate" | PackField;

export const DEFAULT_NICHE = "__default__";

const NICHE_ICONS: Record<string, ElementType> = {
  "Kitchens": UtensilsCrossed,
  "Bathrooms": Bath,
  "Countertops": Layers,
  "Flooring": Grid3x3,
  "General Contracting": Hammer,
  "Solar Panels": Sun,
  "HVAC": Wind,
  "Roofing": Home,
  "Landscaping": TreePine,
  "Windows & Doors": DoorOpen,
  "Painting": Paintbrush,
  "Pest Control": Bug,
  "Pool Installation": Waves,
  "Moving Services": Truck,
  "Wellness": Heart,
  "Interior Design": Sofa,
};

export function resolveNicheIcon(niche: string, isDefault: boolean): ElementType {
  if (isDefault) return Building2;
  return NICHE_ICONS[niche] ?? Building2;
}
```

- [ ] **Step 2: Create `NicheDetailPanel.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DEFAULT_NICHE, EMPTY_TEMPLATE, NICHE_WORD_GROUPS, PACK_FIELDS, resolveNicheIcon,
  type NicheLang, type NicheRow, type NicheTemplate, type NicheWordGroup, type TemplateFieldName,
} from "./nicheShared";

export function NicheDetailPanel({ row, lang, busyKey, onBack, onAdd, onRemove, onSaveTemplate, onDeleteNiche }: {
  row: NicheRow;
  lang: NicheLang;
  busyKey: string | null;
  onBack: () => void;
  onAdd: (group: NicheWordGroup, word: string) => void;
  onRemove: (group: NicheWordGroup, word: string) => void;
  onSaveTemplate: (field: TemplateFieldName, val: NicheTemplate) => void;
  onDeleteNiche?: () => void;
}) {
  const { t } = useTranslation("prompts");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTemplate, setShowTemplate] = useState(true);
  const [showPacks, setShowPacks] = useState(true);
  const isDefault = row.niche === DEFAULT_NICHE;
  const groups = row[lang];
  const NicheIcon = resolveNicheIcon(row.niche, isDefault);

  return (
    <div data-testid={`vocab-card-${row.niche}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button type="button" className="lg:hidden text-muted-foreground shrink-0" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center w-8 h-8 rounded-md shrink-0" style={{ background: "var(--wine)", opacity: 0.9 }}>
            <NicheIcon className="h-4 w-4 text-white" strokeWidth={1.75} />
          </div>
          <span className="serif truncate" style={{ fontSize: 17, color: "var(--ink)" }}>
            {isDefault ? t("vocabulary.defaultNiche") : row.niche}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            onClick={() => setShowTemplate((v) => !v)}
          >
            {showTemplate ? t("vocabulary.hideTemplates") : t("vocabulary.showTemplates")}
          </button>
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            onClick={() => setShowPacks((v) => !v)}
          >
            {showPacks ? t("vocabulary.hidePacks") : t("vocabulary.showPacks")}
          </button>
          {onDeleteNiche && (
            <>
              <button
                className="text-muted-foreground hover:text-red-500 transition-colors"
                onClick={() => setConfirmOpen(true)}
                disabled={busyKey === row.niche}
                aria-label={t("vocabulary.deleteNiche")}
                data-testid={`vocab-delete-${row.niche}`}
              >
                {busyKey === row.niche ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("vocabulary.delete.title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("vocabulary.delete.body", { niche: row.niche })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("vocabulary.delete.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => { setConfirmOpen(false); onDeleteNiche(); }}
                    >
                      {t("vocabulary.delete.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {showTemplate && !isDefault && (
        <div className="mb-5 p-3 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t("vocabulary.templates.title")}
          </div>
          <div className="flex flex-col gap-3">
            <TemplateField
              label={t("vocabulary.templates.companyName")}
              value={(row.companyNameTemplate ?? EMPTY_TEMPLATE)[lang]}
              busy={!!busyKey?.startsWith(`${row.niche}:template:companyNameTemplate`)}
              onSave={(v) => onSaveTemplate("companyNameTemplate", { ...row.companyNameTemplate, [lang]: v })}
            />
            <TemplateField
              label={t("vocabulary.templates.description")}
              value={(row.descriptionTemplate ?? EMPTY_TEMPLATE)[lang]}
              multiline
              busy={!!busyKey?.startsWith(`${row.niche}:template:descriptionTemplate`)}
              onSave={(v) => onSaveTemplate("descriptionTemplate", { ...row.descriptionTemplate, [lang]: v })}
            />
            <TemplateField
              label={t("vocabulary.templates.kb")}
              value={(row.kbTemplate ?? EMPTY_TEMPLATE)[lang]}
              multiline
              busy={!!busyKey?.startsWith(`${row.niche}:template:kbTemplate`)}
              onSave={(v) => onSaveTemplate("kbTemplate", { ...row.kbTemplate, [lang]: v })}
            />
          </div>
        </div>
      )}

      {showPacks && (
        <div className="mb-5 p-3 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t("vocabulary.packs.title")}
          </div>
          <div className="flex flex-col gap-3">
            {PACK_FIELDS.map((field) => (
              <TemplateField
                key={field}
                label={t(`vocabulary.packs.${field}`)}
                value={(row[field] ?? EMPTY_TEMPLATE)[lang]}
                multiline
                busy={!!busyKey?.startsWith(`${row.niche}:template:${field}`)}
                onSave={(v) => onSaveTemplate(field, { ...row[field], [lang]: v })}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {NICHE_WORD_GROUPS.map((group) => (
          <WordGroup
            key={group}
            label={t(`vocabulary.groups.${group}`)}
            placeholder={t("vocabulary.addWord")}
            words={groups[group]}
            busy={busyKey === `${row.niche}:${group}`}
            onAdd={(w) => onAdd(group, w)}
            onRemove={(w) => onRemove(group, w)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateField({ label, value, multiline = false, busy, onSave }: {
  label: string;
  value: string;
  multiline?: boolean;
  busy: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(value);
    setDirty(false);
  }, [value]);

  const submit = () => { if (dirty) { onSave(draft); setDirty(false); } };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        {multiline ? (
          <textarea
            className="w-full bg-transparent border border-border/40 focus:border-[color:var(--wine)] outline-none rounded-md px-2.5 py-2 text-xs resize-none min-h-[64px] leading-relaxed placeholder:text-muted-foreground/50"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
            onBlur={submit}
            rows={3}
          />
        ) : (
          <input
            className="w-full bg-transparent border border-border/40 focus:border-[color:var(--wine)] outline-none rounded-md px-2.5 py-2 text-xs placeholder:text-muted-foreground/50"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
            onBlur={submit}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
        )}
        {busy && (
          <div className="absolute right-2 top-2">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        )}
        {dirty && !busy && (
          <div className="absolute right-2 top-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--wine)]" title="Unsaved" />
          </div>
        )}
      </div>
    </div>
  );
}

function WordGroup({ label, placeholder, words, busy, onAdd, onRemove }: {
  label: string;
  placeholder: string;
  words: string[];
  busy: boolean;
  onAdd: (word: string) => void;
  onRemove: (word: string) => void;
}) {
  const [input, setInput] = useState("");
  const submit = () => { if (input.trim()) { onAdd(input); setInput(""); } };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => (
          <span key={w} className="neu-inset-super-crisp pl-2.5 pr-1 py-0.5 text-xs inline-flex items-center gap-1" style={{ color: "var(--ink)" }}>
            {w}
            <button onClick={() => onRemove(w)} className="text-muted-foreground hover:text-red-500" aria-label="remove">
              <Loader2 className="hidden" />
            </button>
          </span>
        ))}
        {words.length === 0 && <span className="text-xs text-muted-foreground/60 italic">-</span>}
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-muted-foreground/70 text-sm leading-none select-none">+</span>
        <input
          className="bg-transparent border-0 border-b border-border/40 focus:border-[color:var(--wine)] outline-none px-1 py-1 text-xs flex-1 min-w-0 placeholder:text-muted-foreground/50"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          disabled={busy}
        />
        {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
```

**Note on the `X` icon:** the original file imports `X` from `lucide-react`
for the word-remove button. Use that import (`X` from `lucide-react`,
alongside `ArrowLeft, Loader2, Trash2`) and render `<X className="h-3 w-3" />`
in place of the `<Loader2 className="hidden" />` placeholder above — copy
the remove-button markup byte-for-byte from the current file's `WordGroup`
(`client/src/features/prompts/components/NicheVocabularyPanel.tsx:478`)
rather than retyping it, to avoid introducing a mismatch. Likewise use `—`
(em dash) only if the *current* file already uses it for the empty-state
placeholder at line 483 (`<span ...>—</span>`) — keep that character
exactly as it is today; the "no em dashes" rule in Global Constraints
applies to generated AI-conversation example text, not to this UI glyph.

- [ ] **Step 3: Update `NicheVocabularyPanel.tsx` to use the extracted pieces**

In `client/src/features/prompts/components/NicheVocabularyPanel.tsx`:
1. Delete the local `NicheCard`, `TemplateField`, `WordGroup` function
   definitions (everything from the `function NicheCard(...)` line to the
   end of the file).
2. Delete the local type/constant definitions that now live in
   `nicheShared.ts` (`NICHE_WORD_GROUPS`, `NicheWordGroup`,
   `NicheWordGroups`, `NicheLang`, `NicheTemplate`, `EMPTY_NICHE_GROUPS`,
   `EMPTY_TEMPLATE`, `NicheRow`, `PACK_FIELDS`, `PackField`,
   `TemplateFieldName`, `DEFAULT_NICHE`) and the `NICHE_ICONS` map.
3. Add:
```typescript
import {
  DEFAULT_NICHE, EMPTY_NICHE_GROUPS, EMPTY_TEMPLATE,
  type NicheRow, type NicheWordGroup, type NicheLang, type NicheTemplate, type TemplateFieldName,
} from "./niche/nicheShared";
import { NicheDetailPanel } from "./niche/NicheDetailPanel";
```
4. In the JSX where `<NicheCard ... />` was rendered per row, temporarily
   rename it to `<NicheDetailPanel ... onBack={() => {}} ... />` (the
   `onBack` no-op is fine here; Task 10 wires it for real). Everything
   else about this render call stays the same for now — the page still
   maps over every row and stacks them, unchanged behavior.
5. Remove the now-unused lucide-react icon imports at the top of the file
   (`UtensilsCrossed, Bath, Layers, Grid3x3, Hammer, Sun, Wind, Home,
   TreePine, DoorOpen, Paintbrush, Bug, Waves, Truck, Heart, Sofa,
   Building2, X, Trash2`) since those now live in `nicheShared.ts` /
   `NicheDetailPanel.tsx`. Keep `Plus, Loader2` (still used by the
   top-of-panel add-niche controls in this file for now).

- [ ] **Step 4: Verify no behavior changed**

Use the `playwright-cli` skill to open the app, log in
(`leadawaker@gmail.com` / `Admin1234`), go to Prompts -> the "Niche Words"
tab. Confirm: the page still renders every niche as a stacked card in the
same order as before, template/pack fields still save on blur, word groups
still add/remove, and there are no console errors. This is a pure
refactor, so nothing should look different yet.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/prompts/components/niche/nicheShared.ts \
  client/src/features/prompts/components/niche/NicheDetailPanel.tsx \
  client/src/features/prompts/components/NicheVocabularyPanel.tsx
git commit -m "refactor(prompts): extract niche shared types + NicheDetailPanel"
```

---

### Task 10: Rail/detail split, free-text add-niche, tab rename

**Files:**
- Create: `client/src/features/prompts/components/niche/NicheListRail.tsx`
- Modify: `client/src/features/prompts/components/NicheVocabularyPanel.tsx`
- Modify: `client/src/locales/en/prompts.json`
- Modify: `client/src/locales/nl/prompts.json`

**Interfaces:**
- Consumes: `nicheShared.ts` and `NicheDetailPanel` (Task 9).
- Produces: the final Niches page layout — this is the deliverable Part 2 exists for.

- [ ] **Step 1: Update locale files**

In `client/src/locales/en/prompts.json`, inside the `vocabulary` object,
change:
```json
"title": "Niches",
"addNichePlaceholder": "New niche name…",
```
and add a new key in the same object:
```json
"selectNiche": "Select a niche to view its details.",
```

In `client/src/locales/nl/prompts.json`, inside the `vocabulary` object,
change:
```json
"title": "Niches",
"addNichePlaceholder": "Naam nieuwe niche…",
```
and add:
```json
"selectNiche": "Selecteer een niche om de details te bekijken.",
```

- [ ] **Step 2: Create `NicheListRail.tsx`**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Loader2 } from "lucide-react";
import { DEFAULT_NICHE, resolveNicheIcon, type NicheRow } from "./nicheShared";

export function NicheListRail({ rows, selectedNiche, onSelect, onAdd, addBusy }: {
  rows: NicheRow[];
  selectedNiche: string | null;
  onSelect: (niche: string) => void;
  onAdd: (niche: string) => void;
  addBusy: boolean;
}) {
  const { t } = useTranslation("prompts");
  const [newNiche, setNewNiche] = useState("");

  const submitAdd = () => {
    const trimmed = newNiche.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewNiche("");
  };

  return (
    <div
      className="flex flex-col min-h-0 w-full lg:w-[var(--toolbar-w)] lg:shrink-0"
      style={{ borderRight: "1px solid var(--line)", background: "var(--bg)" }}
    >
      <div className="flex items-center gap-1.5 p-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
        <input
          className="neu-inset rounded-md px-2.5 py-2 text-xs bg-transparent flex-1 min-w-0"
          value={newNiche}
          onChange={(e) => setNewNiche(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitAdd(); } }}
          placeholder={t("vocabulary.addNichePlaceholder")}
          data-testid="vocab-new-niche-input"
        />
        <button
          className="neu-raised rounded-md px-2.5 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50 shrink-0"
          onClick={submitAdd}
          disabled={!newNiche.trim() || addBusy}
          data-testid="vocab-add-niche"
        >
          {addBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] p-2 flex flex-col gap-1">
        {rows.map((row) => {
          const isDefault = row.niche === DEFAULT_NICHE;
          const Icon = resolveNicheIcon(row.niche, isDefault);
          const isActive = row.niche === selectedNiche;
          return (
            <button
              key={row.niche}
              type="button"
              onClick={() => onSelect(row.niche)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors"
              style={{
                background: isActive ? "var(--card)" : "transparent",
                boxShadow: isActive ? "var(--sh-raised-crisp)" : "none",
              }}
              data-testid={`vocab-rail-${row.niche}`}
            >
              <div
                className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
                style={{ background: "var(--wine)", opacity: isActive ? 0.9 : 0.6 }}
              >
                <Icon className="h-3.5 w-3.5 text-white" strokeWidth={1.75} />
              </div>
              <span
                className="text-sm truncate"
                style={{ color: "var(--ink)", fontWeight: isActive ? 600 : 400 }}
              >
                {isDefault ? t("vocabulary.defaultNiche") : row.niche}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `NicheVocabularyPanel.tsx`'s composition**

Replace the whole file's contents with:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { NicheListRail } from "./niche/NicheListRail";
import { NicheDetailPanel } from "./niche/NicheDetailPanel";
import {
  DEFAULT_NICHE, EMPTY_NICHE_GROUPS, EMPTY_TEMPLATE,
  type NicheRow, type NicheWordGroup, type NicheLang, type NicheTemplate, type TemplateFieldName,
} from "./niche/nicheShared";

export function NicheVocabularyPanel() {
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [rows, setRows] = useState<NicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [lang, setLang] = useState<NicheLang>("nl");
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  useEffect(() => {
    apiFetch("/api/niche-vocabulary")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NicheRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const sortedRows = useMemo(() => {
    const def = rows.find((r) => r.niche === DEFAULT_NICHE);
    const rest = rows.filter((r) => r.niche !== DEFAULT_NICHE).sort((a, b) => a.niche.localeCompare(b.niche));
    return def ? [def, ...rest] : rest;
  }, [rows]);

  useEffect(() => {
    if (selectedNiche || sortedRows.length === 0) return;
    const firstReal = sortedRows.find((r) => r.niche !== DEFAULT_NICHE);
    setSelectedNiche(firstReal ? firstReal.niche : sortedRows[0].niche);
  }, [sortedRows, selectedNiche]);

  const defaultRow = useMemo(() => rows.find((r) => r.niche === DEFAULT_NICHE), [rows]);
  const existingNiches = useMemo(() => new Set(rows.map((r) => r.niche)), [rows]);
  const selectedRow = rows.find((r) => r.niche === selectedNiche) ?? null;

  const patchRow = useCallback((niche: string, updates: Partial<NicheRow>) => {
    setRows((prev) => prev.map((r) => (r.niche === niche ? { ...r, ...updates } : r)));
  }, []);

  const mutateWord = useCallback(async (
    niche: string, group: NicheWordGroup, word: string, method: "POST" | "DELETE",
  ) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    setBusy(`${niche}:${group}`);
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}/words`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, word: trimmed, lang }),
      });
      if (!res.ok) throw new Error("save failed");
      const both = await res.json();
      patchRow(niche, both);
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [patchRow, t, toast, lang]);

  const saveTemplate = useCallback(async (
    niche: string,
    field: TemplateFieldName,
    value: NicheTemplate,
  ) => {
    setBusy(`${niche}:template:${field}`);
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("save failed");
      patchRow(niche, { [field]: value });
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [patchRow, t, toast]);

  const addNiche = useCallback(async (niche: string) => {
    if (!niche || existingNiches.has(niche)) return;
    setBusy("__new__");
    try {
      const seed = defaultRow
        ? { nl: { ...defaultRow.nl }, en: { ...defaultRow.en } }
        : { nl: { ...EMPTY_NICHE_GROUPS }, en: { ...EMPTY_NICHE_GROUPS } };
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seed),
      });
      if (!res.ok) throw new Error("create failed");
      const both = await res.json();
      setRows((prev) => [...prev, {
        niche,
        ...both,
        companyNameTemplate: EMPTY_TEMPLATE,
        descriptionTemplate: EMPTY_TEMPLATE,
        kbTemplate: EMPTY_TEMPLATE,
        questionBank: EMPTY_TEMPLATE,
        badExamples: EMPTY_TEMPLATE,
        objectionExamples: EMPTY_TEMPLATE,
        scenarioExamples: EMPTY_TEMPLATE,
      }]);
      setSelectedNiche(niche);
      setMobileView("detail");
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [existingNiches, defaultRow, t, toast]);

  const deleteNiche = useCallback(async (niche: string) => {
    setBusy(niche);
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setRows((prev) => prev.filter((r) => r.niche !== niche));
      setSelectedNiche(null);
      setMobileView("list");
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [t, toast]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-5 h-full min-h-0">
      <p className="text-sm text-muted-foreground max-w-[680px]">{t("vocabulary.intro")}</p>

      <div className="la-seg shrink-0" role="tablist" aria-label={t("vocabulary.title")}>
        {(["nl", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            className={`la-seg-btn${lang === l ? " on" : ""}`}
            onClick={() => setLang(l)}
            role="tab"
            aria-selected={lang === l}
          >
            {l === "nl" ? "🇳🇱" : "🇬🇧"} {t(`vocabulary.lang.${l}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden rounded-lg" style={{ border: "1px solid var(--line)" }}>
        <div className={mobileView === "detail" ? "hidden lg:flex" : "flex"}>
          <NicheListRail
            rows={sortedRows}
            selectedNiche={selectedNiche}
            onSelect={(niche) => { setSelectedNiche(niche); setMobileView("detail"); }}
            onAdd={addNiche}
            addBusy={busy === "__new__"}
          />
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] p-4 ${mobileView === "list" ? "hidden lg:block" : "block"}`}>
          {selectedRow ? (
            <NicheDetailPanel
              row={selectedRow}
              lang={lang}
              busyKey={busy}
              onBack={() => setMobileView("list")}
              onAdd={(g, w) => mutateWord(selectedRow.niche, g, w, "POST")}
              onRemove={(g, w) => mutateWord(selectedRow.niche, g, w, "DELETE")}
              onSaveTemplate={(field, val) => saveTemplate(selectedRow.niche, field, val)}
              onDeleteNiche={selectedRow.niche === DEFAULT_NICHE ? undefined : () => deleteNiche(selectedRow.niche)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {t("vocabulary.selectNiche")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Use `playwright-cli` to log in and open Prompts -> the tab (now labeled
"Niches"). Confirm:
- The tab reads "Niches" (not "Niche Words").
- The left rail shows one row per niche, `__default__` first, labeled
  "Default (fallback)".
- Clicking a row shows only that niche's detail on the right (templates,
  packs, word groups) — no other niches are stacked below it.
- Typing a brand-new name (e.g. "Test Niche QA") into the rail's input and
  clicking the add button creates a new row, selects it, and shows an
  empty detail panel for it (no dropdown, no restriction to the old
  16-item list).
- Deleting that "Test Niche QA" row (trash icon in the detail header, with
  confirm dialog) removes it from the rail again. **Do this now** so no
  test data is left in the live database (see Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add client/src/features/prompts/components/niche/NicheListRail.tsx \
  client/src/features/prompts/components/NicheVocabularyPanel.tsx \
  client/src/locales/en/prompts.json client/src/locales/nl/prompts.json
git commit -m "feat(prompts): rail/detail split + free-text add-niche on the Niches page"
```

---

## Part 3 — Campaign niche picker becomes dynamic

### Task 11: Backend — `GET /api/niches` + `storage.listNicheNames`

**Files:**
- Modify: `server/storage/accounts.ts`
- Modify: `server/routes/accounts.ts`

**Interfaces:**
- Produces: `storage.listNicheNames(): Promise<string[]>` and route `GET /api/niches` (`requireAuth`) returning that array as JSON. Consumed by Task 12.

- [ ] **Step 1: Add the storage method**

In `server/storage/accounts.ts`, add `ne` to the existing drizzle-orm
import (`import { eq, desc, asc, count, sum, SQL, inArray, and, or, ilike, gte, lt, isNotNull, isNull, getTableColumns, sql } from "drizzle-orm";`
becomes `import { eq, ne, desc, asc, count, sum, SQL, inArray, and, or, ilike, gte, lt, isNotNull, isNull, getTableColumns, sql } from "drizzle-orm";`).

Then add this method directly after `listNicheVocabularies` (around line
243, right before the `// Upsert ALL groups...` comment):

```typescript
  // Niche names only (no vocabulary payload) — powers the campaign settings
  // niche picker, which any campaign editor (not just agency) can load.
  // Excludes __default__ since it is a fallback row, not a selectable niche.
  async listNicheNames(): Promise<string[]> {
    const rows = await db.select({ niche: nicheVocabulary.niche }).from(nicheVocabulary)
      .where(ne(nicheVocabulary.niche, "__default__"))
      .orderBy(nicheVocabulary.niche);
    return rows.map((r) => r.niche);
  },

```

- [ ] **Step 2: Add the route**

In `server/routes/accounts.ts`, directly after the existing
`GET /api/niche-vocabulary` route (the one returning
`storage.listNicheVocabularies()`), add:

```typescript
  // Niche names only, for the campaign settings niche picker. requireAuth
  // (not requireAgency) since non-agency client users edit campaigns too.
  app.get("/api/niches", requireAuth, wrapAsync(async (_req, res) => {
    res.json(await storage.listNicheNames());
  }));

```

- [ ] **Step 3: Verify with curl**

```bash
source .env
curl -s -H "x-internal-key: $INTERNAL_API_KEY" http://localhost:5000/api/niches
```
Expected: a JSON array of niche name strings (alphabetical, no
`__default__`), e.g. `["Bathrooms","Countertops",...]`.

- [ ] **Step 4: Commit**

```bash
git add server/storage/accounts.ts server/routes/accounts.ts
git commit -m "feat(api): add GET /api/niches for the dynamic campaign niche picker"
```

---

### Task 12: Wire `BehaviorSectionFields`'s niche picker to the dynamic list

**Files:**
- Modify: `client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx`

**Interfaces:**
- Consumes: `GET /api/niches` (Task 11).

- [ ] **Step 1: Fetch the list inside `NicheSelect`**

In `client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx`:

1. Add imports:
```typescript
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
```

2. Delete the `NICHE_ORDER` constant (lines 18-24).

3. Replace the `NicheSelect` function (lines 45-77) with:

```tsx
function NicheSelect({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [niches, setNiches] = useState<string[]>([]);

  useEffect(() => {
    apiFetch("/api/niches")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: string[]) => setNiches(Array.isArray(data) ? data : []))
      .catch(() => setNiches([]));
  }, []);

  const CurIcon = value ? NICHE_ICONS[value] : null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="la-input"
        autoFocus={autoFocus}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', gap: 8, boxSizing: 'border-box', width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {CurIcon && <CurIcon style={{ width: 14, height: 14, color: 'var(--wine)', flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || "Select niche…"}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {niches.map((niche) => {
          const Icon = NICHE_ICONS[niche];
          return (
            <SelectItem key={niche} value={niche}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {Icon && <Icon style={{ width: 14, height: 14, color: 'var(--wine)', flexShrink: 0 }} />}
                {niche}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
```

`NICHE_ICONS` (lines 26-43) stays exactly as-is — it is now purely a bonus
lookup, unmapped/custom niche names simply render without an icon (same
graceful-fallback behavior the `value ? NICHE_ICONS[value] : null` line
already had before this change).

- [ ] **Step 2: Verify in the browser**

Use `playwright-cli` to open any campaign's settings, Behavior tab.
Confirm the niche dropdown still lists all real niches (now fetched from
`/api/niches` instead of the hardcoded array) in alphabetical order. Then
temporarily create a throwaway niche on the Niches page (Task 10's UI),
confirm it now appears in this campaign's niche dropdown without any code
change or restart, select it, then go back to the Niches page and delete
the throwaway niche (see Global Constraints — no test data left in prod).

- [ ] **Step 3: Commit**

```bash
git add client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx
git commit -m "feat(campaigns): niche picker reads the dynamic niche list instead of a hardcoded array"
```

---

### Task 13: End-to-end verification

**Files:**
- None (verification only).

- [ ] **Step 1: Re-run the pack-completeness check**

```bash
node --env-file=.env -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`select count(*) filter (where
    length(question_bank->>'en') > 0 and length(question_bank->>'nl') > 0 and
    length(bad_examples->>'en') > 0 and length(bad_examples->>'nl') > 0 and
    length(objection_examples->>'en') > 0 and length(objection_examples->>'nl') > 0 and
    length(scenario_examples->>'en') > 0 and length(scenario_examples->>'nl') > 0
  ) as complete, count(*) as total
  from p2mxx34fvbf3ll6.\"Niche_Vocabulary\"\`)
  .then(r => { console.log(r.rows[0]); pool.end(); });
"
```
Expected: `complete` equals `total` (17 rows: 16 named niches + `__default__`).

- [ ] **Step 2: Full end-to-end product walkthrough**

Using `playwright-cli`, logged in as `leadawaker@gmail.com`:
1. Open Prompts -> Niches tab. Confirm the tab label, the rail, and that
   `Solar Panels`' detail panel (for example) now shows real,
   solar-specific text in its example packs, not generic kitchen text.
2. Add a niche called "QA Verification Niche" via the rail's free-text
   input.
3. Open any campaign's settings, Behavior tab. Confirm "QA Verification
   Niche" appears in the niche dropdown and can be selected and saved.
4. Change the campaign's niche back to whatever it was before (avoid
   leaving a real campaign pointed at test data).
5. Go back to the Niches page, select "QA Verification Niche", delete it
   via the trash icon.
6. Reload the campaign settings and confirm "QA Verification Niche" is
   gone from the dropdown.

- [ ] **Step 3: No commit needed**

This task is verification only.
