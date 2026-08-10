// Adds Calendar_Connections.caldiy_event_type_id + caldiy_event_type_slug: the
// account's default provisioned event type, captured once at provisioning time
// since the self-hosted v2 API has no general event-types lookup endpoint the
// engine can call at request time (task #704 gap 3).
// Run on the Pi with:  node --env-file=.env migrate-add-caldiy-event-type-columns.js
// Idempotent: safe to re-run.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = 'Calendar_Connections' ORDER BY table_schema LIMIT 1;`
  );
  if (found.rowCount === 0) throw new Error('Calendar_Connections table not found');
  const T = `"${found.rows[0].table_schema}"."Calendar_Connections"`;
  console.log(`→ target: ${T}`);

  await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS caldiy_event_type_id integer;`);
  console.log('✓ added caldiy_event_type_id');
  await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS caldiy_event_type_slug text;`);
  console.log('✓ added caldiy_event_type_slug');

  console.log('\n✅ Migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
