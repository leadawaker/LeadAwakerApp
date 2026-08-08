// Undo for seed-company-campaign-demo.js.
// Deletes every lead tagged Source='Demo Seed' on campaign 58 and restores the
// campaign's original name / AI summary / A/B flag / bump cadence.
// The 9 pre-existing 'WhatsApp Demo' leads are left untouched.
// Run: node --env-file=.env delete-company-campaign-demo.js
import pg from 'pg';

const SCHEMA = 'p2mxx34fvbf3ll6';
const CAMPAIGN_ID = 58;
const SOURCE_TAG = 'Demo Seed';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const L = `"${SCHEMA}"."Leads"`;
const C = `"${SCHEMA}"."Campaigns"`;

try {
  await client.query('BEGIN');

  // Interactions are never created by the seed, but clear any that got attached
  // to a seeded lead (e.g. by manual testing) so the delete can't be blocked.
  const ints = await client.query(
    `DELETE FROM "${SCHEMA}"."Interactions"
      WHERE "Leads_id" IN (SELECT id FROM ${L} WHERE "Campaigns_id"=$1 AND "Source"=$2)`,
    [CAMPAIGN_ID, SOURCE_TAG],
  );

  const del = await client.query(
    `DELETE FROM ${L} WHERE "Campaigns_id"=$1 AND "Source"=$2`,
    [CAMPAIGN_ID, SOURCE_TAG],
  );

  // Restore the campaign to its pre-seed state.
  const camp = await client.query(
    `UPDATE ${C} SET
       name = 'Home Improvement Campaign',
       ai_summary = NULL,
       ai_summary_generated_at = NULL,
       ab_enabled = false,
       bump_1_delay_hours = 1,
       bump_2_delay_hours = 1,
       bump_3_delay_hours = 24,
       bump_4_delay_hours = 24,
       bump_1_template = $2,
       bump_2_template = $3,
       bump_3_template = $4,
       bump_4_template = $5,
       reengagement_bump_template = NULL,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, name;`,
    [
      CAMPAIGN_ID,
      "Hi {first_name}! Just checking in, I figured you got busy before.",
      "{first_name}, what's holding you back from your next checkup?",
      "Is it a trust thing?",
      "I won't bother you anymore {first_name}. If you ever need to discuss your dental health, I will be here for you :)",
    ],
  );

  await client.query('COMMIT');
  console.log(`✓ deleted ${del.rowCount} seeded leads (+ ${ints.rowCount} interactions)`);
  console.log(`✓ campaign restored: ${camp.rows[0].id} → "${camp.rows[0].name}"`);
  console.log('\n✅ cleanup complete');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ cleanup failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
