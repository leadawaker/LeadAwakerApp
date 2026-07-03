import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pool } from "../../server/db";
import { NichePackFile } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");

async function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("No data files found in script/niche-packs/data/");
    await pool.end();
    return;
  }
  let anyMissed = false;
  for (const file of files) {
    const data: NichePackFile = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
    const result = await pool.query(
      `UPDATE "p2mxx34fvbf3ll6"."Niche_Vocabulary"
       SET question_bank = $1::jsonb, bad_examples = $2::jsonb,
           objection_examples = $3::jsonb, scenario_examples = $4::jsonb,
           updated_at = now()
       WHERE niche = $5`,
      [
        JSON.stringify(data.question_bank),
        JSON.stringify(data.bad_examples),
        JSON.stringify(data.objection_examples),
        JSON.stringify(data.scenario_examples),
        data.niche,
      ],
    );
    if (result.rowCount === 0) {
      anyMissed = true;
      console.log(`MISSED ${data.niche} (${file}): no row matched this niche name`);
    } else {
      console.log(`applied ${data.niche} (${file})`);
    }
  }
  await pool.end();
  if (anyMissed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
