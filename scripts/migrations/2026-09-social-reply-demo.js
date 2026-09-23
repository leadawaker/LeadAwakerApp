// Run with: node --env-file=.env scripts/migrations/2026-09-social-reply-demo.js
// npm run db:push cannot be used here: it requires a TTY.
import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";
const q = (t) => `"${SCHEMA}"."${t}"`;

const FALLBACK_OPENER = {
  en: "Hey, thanks for commenting on the post! It's {agent_name} from {company_name}{disclosure_clause}, how's your day going?",
  nl: "Hoi, bedankt voor je reactie op de post! Met {agent_name} van {company_name}{disclosure_clause}, hoe gaat het vandaag?",
  pt: "Oi, obrigado por comentar no post! Aqui é {agent_name} da {company_name}{disclosure_clause}, tudo bem com você hoje?",
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query(`ALTER TABLE ${q("Niche_Vocabulary")} ADD COLUMN IF NOT EXISTS social_post jsonb`);
  await c.query(`ALTER TABLE ${q("Niche_Vocabulary")} ADD COLUMN IF NOT EXISTS social_image_path text`);
  console.log("OK: Niche_Vocabulary columns");

  const existing = await c.query(`SELECT id FROM ${q("Campaigns")} WHERE name = 'Social Reply Demo' LIMIT 1`);
  if (existing.rows[0]) {
    console.log("Campaign exists, id =", existing.rows[0].id);
  } else {
    const src = (await c.query(`SELECT * FROM ${q("Campaigns")} WHERE id = 67`)).rows[0];
    if (!src) throw new Error("campaign 67 not found");

    // Identity/generated columns (like id's nextval default) cannot be inserted
    // explicitly, so skip whatever Postgres itself flags rather than hand-coding
    // a column list.
    const nonInsertable = await c.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
         AND (is_identity = 'YES' OR is_generated <> 'NEVER' OR column_default LIKE 'nextval%')`,
      [SCHEMA, "Campaigns"]
    );
    const skip = new Set(nonInsertable.rows.map((r) => r.column_name));

    const row = { ...src };
    for (const k of Object.keys(row)) {
      if (skip.has(k)) delete row[k];
    }
    delete row.id;
    // Timestamps and counters belong to 67, not to the copy.
    for (const k of Object.keys(row)) {
      if (/^(created_at|updated_at|CreatedAt|UpdatedAt)$/.test(k)) delete row[k];
    }
    row.name = "Social Reply Demo";
    row.campaign_type = "social_reply";
    row.is_demo = true;
    row.prompt_campaign_id = 67;
    row.First_Message = JSON.stringify(FALLBACK_OPENER);
    // apply_mode_opener would swap these in over First_Message and the social opener.
    if ("first_message_scoping" in row) row.first_message_scoping = null;
    if ("first_message_quoted" in row) row.first_message_quoted = null;
    // node-pg does not auto-stringify plain objects/arrays for jsonb columns
    // on every driver version, so serialize them explicitly here.
    const serialize = (v) => {
      if (v !== null && typeof v === "object" && !(v instanceof Date)) {
        return JSON.stringify(v);
      }
      return v;
    };
    const cols = Object.keys(row);
    const sql = `INSERT INTO ${q("Campaigns")} (${cols.map((k) => `"${k}"`).join(", ")})
                 VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`;
    const res = await c.query(sql, cols.map((k) => serialize(row[k])));
    console.log("Created campaign, id =", res.rows[0].id);
  }
  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
