// Seeds one account's Socials studio from a data file: caption style, voice guide, Sobre mim, and the
// scripts / themes. Idempotent: settings fields are only filled while still empty (an edit made in the
// CRM is never overwritten), scripts are keyed by seed_key and never added twice. Writes nothing else.
// Needs script/create-social-studio-tables.mjs first.
// Run: node --env-file=.env script/seed-social-studio.mjs --account 56 --data server/social/seedData/augusto.json [--dry-run]
import { readFileSync } from "node:fs";
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)
const S = `"${SCHEMA}"`;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const accountId = Number(arg("account"));
const dataPath = arg("data");
const dryRun = process.argv.includes("--dry-run");
if (!Number.isInteger(accountId) || accountId <= 0 || !dataPath) {
  console.error("Usage: node --env-file=.env script/seed-social-studio.mjs --account <id> --data <file.json> [--dry-run]");
  process.exit(1);
}
const data = JSON.parse(readFileSync(dataPath, "utf8"));
const SCRIPT_STATUSES = new Set(["idea", "draft", "approved"]);
for (const s of data.scripts ?? []) {
  if (!s.seedKey || !s.title || !SCRIPT_STATUSES.has(s.status)) throw new Error(`Bad script entry: ${JSON.stringify(s).slice(0, 120)}`);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const acc = await client.query(`SELECT id, name FROM ${S}."Accounts" WHERE id = $1`, [accountId]);
  if (acc.rowCount === 0) throw new Error(`Account ${accountId} not found`);
  console.log(`Account ${accountId}: ${acc.rows[0].name}${dryRun ? " (dry run, rolled back at the end)" : ""}`);

  // Only empty fields are filled: NULLIF(existing, '') keeps whatever someone already wrote.
  const settings = await client.query(
    `INSERT INTO ${S}."Social_Settings" ("accounts_id", "caption_style", "voice_guide", "about_me")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("accounts_id") DO UPDATE SET
       "caption_style" = COALESCE(NULLIF(${S}."Social_Settings"."caption_style", ''), EXCLUDED."caption_style"),
       "voice_guide"   = COALESCE(NULLIF(${S}."Social_Settings"."voice_guide", ''), EXCLUDED."voice_guide"),
       "about_me"      = COALESCE(NULLIF(${S}."Social_Settings"."about_me", ''), EXCLUDED."about_me"),
       "updated_at"    = now()
     WHERE ${S}."Social_Settings"."caption_style" = '' OR ${S}."Social_Settings"."voice_guide" = '' OR ${S}."Social_Settings"."about_me" = ''
     RETURNING (xmax = 0) AS inserted`,
    [accountId, data.captionStyle ?? "", data.voiceGuide ?? "", data.aboutMe ?? ""],
  );
  console.log(`Social_Settings: ${settings.rowCount === 0 ? "kept as it is (nothing empty to fill)" : settings.rows[0].inserted ? "created" : "empty fields filled"}`);

  let added = 0;
  for (const s of data.scripts ?? []) {
    const r = await client.query(
      `INSERT INTO ${S}."Social_Scripts" ("accounts_id", "title", "body", "status", "seed_key")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("accounts_id", "seed_key") WHERE "seed_key" IS NOT NULL DO NOTHING`,
      [accountId, s.title, s.body ?? "", s.status, s.seedKey],
    );
    added += r.rowCount;
  }
  console.log(`Social_Scripts: ${added} added, ${(data.scripts?.length ?? 0) - added} already there`);
  await client.query(dryRun ? "ROLLBACK" : "COMMIT");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
