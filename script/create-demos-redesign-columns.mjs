// Adds what the Demos page redesign stores: the Demo_Prospects table (one row of settings per prospect group),
// Leads.demo_revoked_at (the revoke marker on a demo link), and the product, stock page, city and phone columns
// on Niche_Vocabulary. Purely additive and idempotent: CREATE ... IF NOT EXISTS and ADD COLUMN IF NOT EXISTS only,
// no existing table, column or row is changed. Every new column is inert until the new code reads it.
// Run: node --env-file=.env script/create-demos-redesign-columns.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)
const S = `"${SCHEMA}"`;

const sql = `
-- ─── Demo_Prospects (settings per prospect group: how the demo introduces the prospect) ───
CREATE TABLE IF NOT EXISTS ${S}."Demo_Prospects" (
  "id" serial PRIMARY KEY,
  "prospect_group" text NOT NULL,
  "first_name" text NOT NULL,
  "company_name" text NOT NULL DEFAULT '',
  "client_niche" text NOT NULL DEFAULT '',
  "language" text NOT NULL DEFAULT 'en',
  "ai_disclosure" text NOT NULL DEFAULT '',
  "market" text NOT NULL DEFAULT '',
  "notes" text NOT NULL DEFAULT '',
  "website_url" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "demo_prospects_group_idx" ON ${S}."Demo_Prospects" ("prospect_group");

-- ─── Revoke marker: set on both rows of a demo token, honoured by every token lookup ───
ALTER TABLE ${S}."Leads" ADD COLUMN IF NOT EXISTS "demo_revoked_at" timestamptz;

-- ─── Niche_Vocabulary: products per language, the stock page, and the business city and phone ───
ALTER TABLE ${S}."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS "products" jsonb NOT NULL DEFAULT '{}';
ALTER TABLE ${S}."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS "stock_url" text;
ALTER TABLE ${S}."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE ${S}."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS "phone" text;
`;

const NICHE_COLUMNS = ["products", "stock_url", "city", "phone"];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);

  const prospects = await pool.query(
    `SELECT count(*)::int AS columns FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'Demo_Prospects'`,
    [SCHEMA],
  );
  console.log(`Demo_Prospects: ${prospects.rows[0].columns} columns`);

  const revoked = await pool.query(
    `SELECT count(*)::int AS n FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'Leads' AND column_name = 'demo_revoked_at'`,
    [SCHEMA],
  );
  console.log(`Leads.demo_revoked_at: ${revoked.rows[0].n === 1 ? "present" : "missing"}`);

  const niche = await pool.query(
    `SELECT count(*)::int AS n FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'Niche_Vocabulary' AND column_name = ANY($2)`,
    [SCHEMA, NICHE_COLUMNS],
  );
  console.log(`Niche_Vocabulary new columns: ${niche.rows[0].n}/${NICHE_COLUMNS.length}`);
} finally {
  await pool.end();
}
