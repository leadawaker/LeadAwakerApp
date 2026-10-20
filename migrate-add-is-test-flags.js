// Adds is_test (boolean NOT NULL DEFAULT false) to Leads and Voice_Calls so the
// Owner can hide his own test calls/leads from client views and Home numbers.
// Run on the Pi with:  node --env-file=.env migrate-add-is-test-flags.js
// Idempotent: safe to re-run.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  for (const table of ['Leads', 'Voice_Calls']) {
    const found = await client.query(
      `SELECT table_schema FROM information_schema.tables WHERE table_name = $1 ORDER BY table_schema LIMIT 1;`,
      [table]
    );
    if (found.rowCount === 0) throw new Error(`${table} table not found`);
    const T = `"${found.rows[0].table_schema}"."${table}"`;
    await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;`);
    console.log(`✓ added is_test to ${T}`);
  }
  console.log('\n✅ Migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
