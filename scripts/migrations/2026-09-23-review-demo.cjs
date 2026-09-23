// scripts/migrations/2026-09-23-review-demo.cjs
// Review demo (specs/review-demo): two Leads columns and the reputation demo
// campaign, cloned from Speed to Lead (67). Idempotent: safe to run twice.
const { Pool } = require("pg");

const S = "p2mxx34fvbf3ll6";
const NAME = "Reputation Demo";

// {service_name} comes from the persona generator as a noun, a verb phrase or a
// business type, so every sentence reads with any of the three ("helped with").
const FIRST_MESSAGE = JSON.stringify({
  en: "Hey {first_name}, it's {agent_name}{disclosure_clause}. Quick check: am I speaking with the same {first_name} we recently helped with {service_name}?",
  nl: "Hoi {first_name}, met {agent_name}{disclosure_clause}. Even checken: spreek ik met de {first_name} die we onlangs hebben geholpen met {service_name}?",
  pt: "Oi {first_name}, aqui é {agent_name}{disclosure_clause}. Só pra confirmar: é você que a gente atendeu recentemente em {service_name}?",
});

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`ALTER TABLE ${S}."Leads" ADD COLUMN IF NOT EXISTS review_rating integer`);
    await pool.query(`ALTER TABLE ${S}."Leads" ADD COLUMN IF NOT EXISTS review_outcome text`);

    const existing = await pool.query(`SELECT id FROM ${S}."Campaigns" WHERE name = $1 LIMIT 1`, [NAME]);
    let id = existing.rows[0]?.id;
    if (!id) {
      const cols = (await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'Campaigns' AND column_name <> 'id'`,
        [S],
      )).rows.map((r) => `"${r.column_name}"`);
      // Select the new name in place of 67's, in case campaign names are unique.
      const select = cols.map((c) => (c === '"name"' ? "$1" : c));
      const inserted = await pool.query(
        `INSERT INTO ${S}."Campaigns" (${cols.join(", ")}) SELECT ${select.join(", ")} FROM ${S}."Campaigns" WHERE id = 67 RETURNING id`,
        [NAME],
      );
      id = inserted.rows[0].id;
    }

    // Clone gotchas (memory: speed-to-lead demo): clear the mode openers or the
    // clone renders 67's opener; niche must stay a real trade (67's is kept);
    // no "from {company_name}" next to {disclosure_clause}.
    await pool.query(
      `UPDATE ${S}."Campaigns"
          SET name = $2, campaign_type = 'reputation', is_demo = true,
              "First_Message" = $3, first_message_scoping = NULL, first_message_quoted = NULL,
              prompt_campaign_id = NULL, message_debounce_seconds = 2,
              updated_at = NOW()
        WHERE id = $1`,
      [id, NAME, FIRST_MESSAGE],
    );
    console.log(`REPUTATION_DEMO_CAMPAIGN_ID=${id}`);
  } finally {
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
