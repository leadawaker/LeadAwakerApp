// messaging-provisioning Phase 1 migration — Accounts lifecycle + WhatsApp status.
// Run on the Pi with:  node --env-file=.env migrate-messaging-columns.js
// Idempotent: safe to re-run. (twilio_* creds columns already exist.)
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
    ['messaging_provisioned_at', 'timestamptz'],
    ['whatsapp_sender_status', 'text'],
    ['whatsapp_sender_sid', 'text'],
    ['whatsapp_display_name', 'text'],
  ];
  for (const [col, type] of cols) {
    await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
    console.log(`✓ ${col} (${type})`);
  }

  console.log('\n✅ Messaging columns migration complete');
} catch (err) {
  console.error('❌ migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
