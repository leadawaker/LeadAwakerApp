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
