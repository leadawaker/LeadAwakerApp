// Discovery Demo Trust Kit — add Campaigns.objection_playbook (Part 3 of spec).
// Run on the Pi with:  node --env-file=.env migrate-objection-playbook.js
// Idempotent: safe to re-run. db:push has no TTY on the Pi, so we go direct.
// NocoDB keeps tables in a generated schema (not public), so resolve it first.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = 'Campaigns' ORDER BY table_schema LIMIT 1;`
  );
  if (found.rowCount === 0) throw new Error('Campaigns table not found in any schema');
  const schema = found.rows[0].table_schema;
  const T = `"${schema}"."Campaigns"`;
  console.log(`→ target: ${T}`);

  await client.query(
    `ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "objection_playbook" jsonb DEFAULT NULL;`
  );
  console.log('✓ column objection_playbook ensured (jsonb, default NULL)');

  const check = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'Campaigns' AND column_name = 'objection_playbook';`,
    [schema]
  );
  console.log('column check:', check.rows[0]);

  console.log('\n✅ objection_playbook migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
