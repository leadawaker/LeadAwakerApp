// Social Reply demo: stored dm_opener templates wrote "{agent_name} from
// {company_name}{disclosure_clause}", but the clause already carries the
// company, so every opener named it twice. Rewrite them to
// "{agent_name}{disclosure_clause}". Idempotent.
// Run: node --env-file=.env scripts/migrations/2026-09-social-opener-dedupe.js [--dry]
import pg from "pg";
const { Client } = pg;

const DRY = process.argv.includes("--dry");
const T = 'p2mxx34fvbf3ll6."Niche_Vocabulary"';

function fix(op) {
  let out = op.replace(/,?\s*(?:from|van|da|do|de|at|bij)\s+\{company_name\}\s*\{disclosure_clause\}/gi, "{disclosure_clause}");
  out = out.replace(/\{company_name\}\{disclosure_clause\}/g, "{disclosure_clause}");
  if (!out.includes("{agent_name}{disclosure_clause}")) {
    out = out.replace(/\{agent_name\}\s*(?:from|van|da|do|de|at|bij)\s+\{company_name\}/i, "{agent_name}{disclosure_clause}");
  }
  return out;
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query(`select id, niche, social_post from ${T} where social_post is not null`);
  let changed = 0;
  for (const r of rows) {
    const post = r.social_post;
    let dirty = false;
    for (const lang of Object.keys(post)) {
      const op = post[lang] && post[lang].dm_opener;
      if (typeof op !== "string") continue;
      const next = fix(op);
      if (next !== op) {
        console.log(`#${r.id} ${lang}\n  - ${op}\n  + ${next}`);
        post[lang].dm_opener = next;
        dirty = true;
      }
    }
    if (dirty) {
      changed++;
      if (!DRY) await c.query(`update ${T} set social_post = $1 where id = $2`, [JSON.stringify(post), r.id]);
    }
  }
  console.log(`${DRY ? "would update" : "updated"} ${changed} of ${rows.length} rows`);
  await c.end();
})();
