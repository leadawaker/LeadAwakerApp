// Adds Leads.hubspot_contact_id and hubspot_pushed_at (Voice calls Callers view,
// Push to HubSpot: the id makes a re-push update, the time limits its note to
// calls since the last push).
// Idempotent. Run: node --env-file=.env scripts/migrate-leads-hubspot-contact-id.mjs
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `ALTER TABLE p2mxx34fvbf3ll6."Leads" ADD COLUMN IF NOT EXISTS hubspot_contact_id text`,
  );
  await client.query(
    `ALTER TABLE p2mxx34fvbf3ll6."Leads" ADD COLUMN IF NOT EXISTS hubspot_pushed_at timestamptz`,
  );
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'p2mxx34fvbf3ll6' AND table_name = 'Leads' AND column_name IN ('hubspot_contact_id', 'hubspot_pushed_at')`,
  );
  console.log("Leads hubspot columns:", rows.length === 2 ? "ok" : "MISSING");
} finally {
  await client.end();
}
