// Adds the two-rung booking-reminder columns + booked_at to Leads.
// db:push needs a TTY on the Pi, so we ALTER directly.
// Run: node --env-file=.env scripts/add-booking-reminder-ladder-columns.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)

const sql = `
ALTER TABLE "${SCHEMA}"."Leads"
  ADD COLUMN IF NOT EXISTS "booking_reminder_24h_sent_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "booking_reminder_1h_sent_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "booked_at" timestamptz;
`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'Leads'
       AND column_name IN ('booking_reminder_24h_sent_at','booking_reminder_1h_sent_at','booked_at')
     ORDER BY column_name`,
    [SCHEMA],
  );
  console.log("✅ Leads reminder-ladder columns ready:", rows.map((r) => r.column_name).join(", "));
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
