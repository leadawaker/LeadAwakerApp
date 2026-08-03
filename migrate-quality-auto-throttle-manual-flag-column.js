// whatsapp-quality-auto-throttle addendum — explicit manual-override flag column.
// See specs/whatsapp-quality-auto-throttle/addendum-manual-override-flag.md
// Run on the Pi with:  node --env-file=.env migrate-quality-auto-throttle-manual-flag-column.js
// Idempotent: safe to re-run.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = 'Accounts' ORDER BY table_schema LIMIT 1;`
  );
  if (found.rowCount === 0) throw new Error('Accounts table not found');
  const T = `"${found.rows[0].table_schema}"."Accounts"`;
  console.log(`→ target: ${T}`);

  const cols = [
    ['whatsapp_max_daily_sends_is_manual', 'boolean DEFAULT false'],
  ];
  for (const [col, type] of cols) {
    await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
    console.log(`✓ ${col} (${type})`);
  }

  console.log('\n✅ Manual-override flag column migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
