// Drops deprecated, unused Account_Communication_Profile columns: brand_feel,
// contact_approach, distinctive, distinctive_other, agent_name_note.
// Run on the Pi with:  node --env-file=.env migrate-drop-communication-profile-deadcols.js
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

  const cols = ['brand_feel', 'contact_approach', 'distinctive', 'distinctive_other', 'agent_name_note'];
  for (const col of cols) {
    await client.query(`ALTER TABLE ${T} DROP COLUMN IF EXISTS "${col}";`);
    console.log(`✓ dropped ${col}`);
  }

  console.log('\n✅ Dead column drop complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
