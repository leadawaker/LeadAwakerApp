// Run with: npx tsx --env-file=.env script/seed-lead-scores.ts
import { pool } from "../server/db";

const SCHEMA = "p2mxx34fvbf3ll6";

async function seed() {
  // 1. Ensure the column exists
  await pool.query(`
    ALTER TABLE "${SCHEMA}"."Leads"
    ADD COLUMN IF NOT EXISTS "lead_score" integer
  `);
  console.log("Ensured lead_score column exists on Leads table");

  // 2. Fetch all lead IDs
  const { rows } = await pool.query(
    `SELECT id FROM "${SCHEMA}"."Leads" ORDER BY id`
  );
  console.log(`Found ${rows.length} leads to seed scores for`);

  // 3. Update each lead with a random score 20-95
  let updated = 0;
  for (const row of rows) {
    const score = Math.floor(Math.random() * 76) + 20;
    await pool.query(
      `UPDATE "${SCHEMA}"."Leads" SET "lead_score" = $1 WHERE id = $2`,
      [score, row.id]
    );
    updated++;
  }
  console.log(`Seeded lead_score for ${updated} leads (range 20-95)`);

  // 4. Verify
  const verify = await pool.query(
    `SELECT id, lead_score FROM "${SCHEMA}"."Leads" ORDER BY id LIMIT 10`
  );
  console.log("\nSample scores:");
  verify.rows.forEach((r: any) => console.log(`  Lead #${r.id}: score=${r.lead_score}`));

  await pool.end();
}

seed().catch(console.error);
