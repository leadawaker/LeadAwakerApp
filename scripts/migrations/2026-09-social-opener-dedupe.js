// Social Reply demo: stored dm_opener templates wrote "{agent_name} from
// {company_name}{disclosure_clause}", but the clause already carries the
// company, so every opener named it twice. Rewrite them to
// "{agent_name}{disclosure_clause}". Idempotent.
//
// Second pass: every Leads.demo_niche on campaign 70 is a frozen copy of the
// Client post taken at mint, so links minted before the fix still carry the
// doubled opener in social_dm_opener (and possibly in a per-language
// social_post[lang].dm_opener or first_message). Same fix(), same idempotence.
// Run: node --env-file=.env scripts/migrations/2026-09-social-opener-dedupe.js [--dry]
import pg from "pg";
const { Client } = pg;

const DRY = process.argv.includes("--dry");
const T = 'p2mxx34fvbf3ll6."Niche_Vocabulary"';
const L = 'p2mxx34fvbf3ll6."Leads"';
const SOCIAL_CAMPAIGN = 70;

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

  const leads = await c.query(
    `select id, channel_identifier, demo_niche from ${L} where "Campaigns_id" = $1 and demo_niche is not null`,
    [SOCIAL_CAMPAIGN],
  );
  let leadsChanged = 0;
  for (const r of leads.rows) {
    let blob;
    try { blob = JSON.parse(r.demo_niche); } catch { continue; }
    if (!blob || typeof blob !== "object") continue;
    let dirty = false;
    const patch = (obj, key, label) => {
      if (!obj || typeof obj[key] !== "string") return;
      const next = fix(obj[key]);
      if (next === obj[key]) return;
      console.log(`lead #${r.id} ${r.channel_identifier} ${label}\n  - ${obj[key]}\n  + ${next}`);
      obj[key] = next;
      dirty = true;
    };
    patch(blob, "social_dm_opener", "social_dm_opener");
    patch(blob, "first_message", "first_message");
    const sp = blob.social_post;
    if (sp && typeof sp === "object") {
      patch(sp, "dm_opener", "social_post.dm_opener");
      for (const lang of ["en", "nl", "pt"]) patch(sp[lang], "dm_opener", `social_post.${lang}.dm_opener`);
    }
    if (dirty) {
      leadsChanged++;
      if (!DRY) await c.query(`update ${L} set demo_niche = $1 where id = $2`, [JSON.stringify(blob), r.id]);
    }
  }
  console.log(`${DRY ? "would update" : "updated"} ${leadsChanged} of ${leads.rows.length} campaign-${SOCIAL_CAMPAIGN} leads`);
  await c.end();
})();
