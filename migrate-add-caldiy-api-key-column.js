// Adds Calendar_Connections.caldiy_api_key_encrypted: a second secret slot for
// caldiy rows, holding the engine's Bearer API key (distinct from the existing
// api_key_encrypted column, which stores the caldiy login PASSWORD).
// Run on the Pi with:  node --env-file=.env migrate-add-caldiy-api-key-column.js
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

  await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS caldiy_api_key_encrypted text;`);
  console.log('✓ added caldiy_api_key_encrypted');

  console.log('\n✅ Migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
