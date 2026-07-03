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
side is a known bug (duplicated Dutch text): do not copy it, and do not
model your `en` writing on it.

## Per-field structural requirements (do not deviate from these categories)

- **`bad_examples`**: a handful of presumptuous/leading questions to avoid,
  in the niche's own domain (mirrors what sits right after "Bad examples:"
  in the base prompt's question-quality rule).
- **`question_bank`**: five sub-parts, in this order: (1) preferred open
  questions to use when the prospect gave only a bare status, (2)
  price-framed-status examples showing a price remark read as status, not
  objection, with the reframed response, (3) a general good-question bank
  (roughly 15-20 reusable lines mixing questions and short acknowledging
  transitions), (4) the "I need to think about it" special case, (5) the
  "not now" special case (said after the prospect already indicated they
  are comparing).
- **`objection_examples`**: exactly these seven named categories, in this
  order, because later prompt sections reference them by name ("the
  commitment-check phrasings in Step 4", "the relevance phrasings in Step
  4"): Price; Cheaper competitor; Reframe after a second objection; Closing
  after two clear rejections; Commitment check (buying signal); Advisor
  relevance (price difference); Advisor relevance (remaining questions).
- **`scenario_examples`**: numbered `## 6.1` through `## 6.7` (do not use
  `6.8`/`6.9`, those are hardcoded in the base prompt right after this
  block). Categories, in order: 6.1 Timing issue; 6.2 Situation outside our
  control; 6.3 AI accusation; 6.4 Pricing and deals; 6.5 Unknown/detailed
  question you cannot answer; 6.6 a niche-flavored "committed elsewhere"
  scenario (Kitchens' version: prospect already purchased from another
  kitchen supplier); 6.7 Data question ("where did you get my details?").

## Language & market grounding

Both `en` and `nl` describe the **same Dutch business reality**: Euro
pricing, BTW, gemeente vergunningen, VvE, subsidy schemes (ISDE, Warmtefonds,
salderingsregeling) where relevant to the niche. `en` is a natural English
rendering for an English-speaking prospect dealing with a Dutch business, not
a US-market scenario set, and not a literal duplicate of the Dutch text.

## Style rules inherited from the base prompt

- No em dashes or en dashes anywhere: use commas, colons or semicolons.
- No emojis.
- No quotation marks wrapping full example messages (short inline quoted
  fragments used purely to classify a reply, like Kitchens' `"we hebben het
  uitgesteld"`, are fine).
- Vary acknowledgement words (Helder / Dat begrijp ik / Ik snap het /
  Natuurlijk, and their English equivalents): the base prompt bans using the
  same one twice in a row.

## Validate before moving on

```bash
npx tsx script/niche-packs/validate.ts script/niche-packs/data/<slug>.json
```

Fix everything it reports before considering the niche done.
