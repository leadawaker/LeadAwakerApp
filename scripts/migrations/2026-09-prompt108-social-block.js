// Run with: node --env-file=.env scripts/migrations/2026-09-prompt108-social-block.js
import { Client } from "pg";

const TABLE = '"p2mxx34fvbf3ll6"."Prompt_Library"';
const MARK = '{{#if lead_source == "social_comment"}}';
const BLOCK = `${MARK}
### HOW THEY GOT IN TOUCH: A COMMENT ON YOUR INSTAGRAM POST
{social_context}
They typed that word under the post because they want what it offers. Your opener in their DMs thanked them for commenting, and they are now replying to it. Treat the offer in the post as the reason they are here: pick up from it in your first reply, and do not ask why they got in touch.
This is an Instagram DM. Keep every message short and casual, one question at a time.
{{/if}}

`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const cols = (await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='p2mxx34fvbf3ll6' AND table_name='Prompt_Library'`)).rows.map((r) => r.column_name);
  const col = ["prompt_text", "Prompt_Text", "prompt", "content", "system_prompt"].find((k) => cols.includes(k));
  if (!col) throw new Error("prompt text column not found: " + cols.join(","));
  const text = (await c.query(`SELECT "${col}" AS t FROM ${TABLE} WHERE id = 108`)).rows[0]?.t;
  if (!text) throw new Error("prompt 108 not found");
  if (text.includes(MARK)) { console.log("Already present, nothing to do"); process.exit(0); }
  const anchor = text.indexOf("# 2. PRIMARY OBJECTIVE");
  if (anchor < 0) throw new Error("anchor '# 2. PRIMARY OBJECTIVE' not found");
  const next = text.slice(0, anchor) + BLOCK + text.slice(anchor);
  await c.query(`UPDATE ${TABLE} SET "${col}" = $1 WHERE id = 108`, [next]);
  const back = (await c.query(`SELECT "${col}" AS t FROM ${TABLE} WHERE id = 108`)).rows[0].t;
  console.log(back.includes(MARK) ? "OK: block inserted" : "FAILED: not found after write");
  await c.end();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
