// Bump System Overhaul — add Campaigns.bump_N_ai_prompt (x4) + Leads.pending_booking_context.
// Run on the Pi with:  node --env-file=.env migrate-bump-system-columns.js
// Idempotent: safe to re-run. db:push has no TTY on the Pi, so we go direct.
// NocoDB keeps tables in a generated schema (not public), so resolve it first.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function ensureColumn(table, column, type) {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = $1 ORDER BY table_schema LIMIT 1;`,
    [table]
  );
  if (found.rowCount === 0) throw new Error(`${table} table not found in any schema`);
  const schema = found.rows[0].table_schema;
  const T = `"${schema}"."${table}"`;

  await client.query(
    `ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "${column}" ${type} DEFAULT NULL;`
  );

  const check = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3;`,
    [schema, table, column]
  );
  console.log(`✓ ${table}.${column} ensured:`, check.rows[0]);
}

async function setDefault(table, column, sqlLiteral) {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = $1 ORDER BY table_schema LIMIT 1;`,
    [table]
  );
  const schema = found.rows[0].table_schema;
  const T = `"${schema}"."${table}"`;
  await client.query(`ALTER TABLE ${T} ALTER COLUMN "${column}" SET DEFAULT ${sqlLiteral};`);
  console.log(`✓ ${table}.${column} default set`);
}

try {
  await ensureColumn('Campaigns', 'bump_1_ai_prompt', 'text');
  await ensureColumn('Campaigns', 'bump_2_ai_prompt', 'text');
  await ensureColumn('Campaigns', 'bump_3_ai_prompt', 'text');
  await ensureColumn('Campaigns', 'bump_4_ai_prompt', 'text');
  await ensureColumn('Leads', 'pending_booking_context', 'text');

  // Wardrope cadence becomes the DB-level default for NEW campaign rows only
  // (existing rows are untouched — Postgres column defaults never retroactively
  // backfill existing data). This is what makes "new campaigns get these as
  // defaults" true without having to find every campaign-creation code path.
  await setDefault('Campaigns', 'bump_1_template', `'Hi {first_name}! Just checking in, I figured you got busy before.'`);
  await setDefault('Campaigns', 'bump_2_template', `'{first_name}, what''s holding you back from {service}?'`);
  await setDefault('Campaigns', 'bump_3_template', `'Is it a trust thing?'`);
  await setDefault('Campaigns', 'bump_4_template', `'I won''t bother you anymore {first_name}. If you ever need to discuss {service}, I will be here for you :)'`);
  await setDefault('Campaigns', 'max_bumps', `4`);

  console.log('\n✅ bump-system-columns migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
