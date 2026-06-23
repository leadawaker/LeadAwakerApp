// Phase 1 migration — reputation management columns.
// Run on the Pi with:  node --env-file=.env migrate-reputation-columns.js
// Idempotent: safe to re-run. (campaign_type was added separately in Phase 0.)
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const resolveSchema = async (table) => {
  const r = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = $1 ORDER BY table_schema LIMIT 1;`,
    [table]
  );
  if (r.rowCount === 0) throw new Error(`${table} table not found`);
  return r.rows[0].table_schema;
};

try {
  const schema = await resolveSchema('Campaigns'); // all NocoDB tables share one schema
  const T = (name) => `"${schema}"."${name}"`;
  console.log(`→ schema: ${schema}`);

  const cols = [
    [T('Campaigns'), 'reputation_delay_minutes', 'integer'],
    [T('Leads'), 'service_completed_at', 'timestamptz'],
    [T('Leads'), 'review_request_sent_at', 'timestamptz'],
    [T('Accounts'), 'enable_reputation_management', "boolean DEFAULT false"],
    [T('Accounts'), 'google_review_url', 'text'],
    [T('Accounts'), 'reputation_alert_target', 'text'],
  ];

  for (const [table, col, type] of cols) {
    await client.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "${col}" ${type};`
    );
    console.log(`✓ ${table}.${col} (${type})`);
  }

  console.log('\n✅ Reputation columns migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
