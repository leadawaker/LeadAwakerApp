// Bump System Overhaul — fill the Discovery Demo campaign (id 61) with the
// Wardrope cadence as its default bump content, and a starter reengagement line.
// Run on the Pi with:  node --env-file=.env seed-discovery-demo-bumps.js
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

  const result = await client.query(
    `UPDATE ${T} SET
       bump_1_template = $1,
       bump_2_template = $2,
       bump_3_template = $3,
       bump_4_template = $4,
       max_bumps = 4,
       reengagement_bump_template = $5
     WHERE id = 61
     RETURNING id, name;`,
    [
      "Hi {first_name}! Just checking in, I figured you got busy before.",
      "{first_name}, what's holding you back from {service}?",
      "Is it a trust thing?",
      "I won't bother you anymore {first_name}. If you ever need to discuss {service}, I will be here for you :)",
      "Hi {first_name}! You mentioned this timing would work better for you, so here I am, is now a good moment?",
    ]
  );

  if (result.rowCount === 0) {
    throw new Error('Campaign id 61 not found — check _DEMO_CAMPAIGN_IDS is still {60, 61} before re-running.');
  }
  console.log('✓ updated campaign:', result.rows[0]);
  console.log('\n✅ discovery demo bump seed complete');
} catch (err) {
  console.error('❌ seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
