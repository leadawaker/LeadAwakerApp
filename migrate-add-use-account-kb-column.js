// Per-campaign toggle for account Knowledge Base injection into the AI prompt.
// NULL/true = inject (existing behavior); false = skip for this campaign.
// Seeds the demo campaigns (60 universal, 61 discovery) to false: their KB is
// either generated per lead (60) or authored in the campaign kb field (61).
// Run on the Pi with:  node --env-file=.env migrate-add-use-account-kb-column.js
// Idempotent: safe to re-run (the seed only fires when the column is new).
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = 'Campaigns' ORDER BY table_schema LIMIT 1;`
  );
  if (found.rowCount === 0) throw new Error('Campaigns table not found');
  const schema = found.rows[0].table_schema;
  const T = `"${schema}"."Campaigns"`;
  console.log(`→ target: ${T}`);

  const existing = await client.query(
    `SELECT 1 FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'Campaigns' AND column_name = 'use_account_kb';`,
    [schema]
  );
  await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "use_account_kb" boolean DEFAULT true;`);
  console.log('✓ use_account_kb (boolean DEFAULT true)');

  if (existing.rowCount === 0) {
    await client.query(`UPDATE ${T} SET use_account_kb = false WHERE id IN (60, 61);`);
    console.log('✓ seeded false for demo campaigns 60, 61');
  } else {
    console.log('· column pre-existed, seed skipped');
  }

  console.log('\n✅ use_account_kb migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
