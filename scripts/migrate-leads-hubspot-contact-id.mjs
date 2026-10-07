// Adds Leads.hubspot_contact_id (Voice calls Callers view, Push to HubSpot).
// Idempotent. Run: node --env-file=.env scripts/migrate-leads-hubspot-contact-id.mjs
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `ALTER TABLE p2mxx34fvbf3ll6."Leads" ADD COLUMN IF NOT EXISTS hubspot_contact_id text`,
  );
  const { rows } = await client.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'p2mxx34fvbf3ll6' AND table_name = 'Leads' AND column_name = 'hubspot_contact_id'`,
  );
  console.log("Leads.hubspot_contact_id:", rows[0]?.data_type ?? "MISSING");
} finally {
  await client.end();
}
