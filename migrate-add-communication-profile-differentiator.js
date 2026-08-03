// Re-adds the differentiator storage that migrate-drop-communication-profile-deadcols.js
// removed while the wizard still used it (as distinctive_other). The wizard's
// "why customers choose you" answer now persists to this dedicated column.
// Run on the Pi with:  node --env-file=.env migrate-add-communication-profile-differentiator.js
// Idempotent: safe to re-run.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const found = await client.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = 'Account_Communication_Profile' ORDER BY table_schema LIMIT 1;`
  );
  if (found.rowCount === 0) throw new Error('Account_Communication_Profile table not found');
  const T = `"${found.rows[0].table_schema}"."Account_Communication_Profile"`;
  console.log(`→ target: ${T}`);

  await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "differentiator" text;`);
  console.log('✓ added differentiator');

  console.log('\n✅ differentiator column migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
