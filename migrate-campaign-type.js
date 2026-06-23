// Phase 0 migration — add Campaigns.campaign_type discriminator.
// Run on the Pi with:  node --env-file=.env migrate-campaign-type.js
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
    `ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "campaign_type" text DEFAULT 'reactivation';`
  );
  console.log('✓ column campaign_type ensured (default reactivation)');

  const res = await client.query(
    `UPDATE ${T} SET "campaign_type" = 'reactivation' WHERE "campaign_type" IS NULL;`
  );
  console.log(`✓ backfilled ${res.rowCount} existing campaign(s) to 'reactivation'`);

  const dist = await client.query(
    `SELECT COALESCE("campaign_type", '(null)') AS type, COUNT(*)::int AS n
       FROM ${T} GROUP BY 1 ORDER BY 2 DESC;`
  );
  console.log('campaign_type distribution:');
  dist.rows.forEach((r) => console.log(`  ${r.type}: ${r.n}`));

  console.log('\n✅ Phase 0 migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
