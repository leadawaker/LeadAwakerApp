import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  NichePackFile, PACK_FIELD_NAMES, REQUIRED_SCENARIO_MARKERS, MIN_FIELD_LENGTH,
} from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const DASH_RE = /[–—]/;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

function validateFile(path: string): string[] {
  const errors: string[] = [];
  let data: NichePackFile;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return [`invalid JSON: ${(e as Error).message}`];
  }

  if (!data.niche || typeof data.niche !== "string") {
    errors.push("missing 'niche' string");
  }

  for (const field of PACK_FIELD_NAMES) {
    const val = (data as any)[field];
    if (!val || typeof val !== "object") {
      errors.push(`missing '${field}'`);
      continue;
    }
    for (const lang of ["en", "nl"] as const) {
      const text = val[lang];
      if (typeof text !== "string" || text.trim().length < MIN_FIELD_LENGTH) {
        errors.push(`${field}.${lang} is missing or shorter than ${MIN_FIELD_LENGTH} chars`);
        continue;
      }
      if (DASH_RE.test(text)) {
        errors.push(`${field}.${lang} contains an em/en dash, which the base prompt bans`);
      }
      if (EMOJI_RE.test(text)) {
        errors.push(`${field}.${lang} contains an emoji, which the base prompt bans`);
      }
    }
  }

  if (data.scenario_examples) {
    for (const lang of ["en", "nl"] as const) {
      const text = data.scenario_examples[lang] || "";
      let lastIndex = -1;
      for (const marker of REQUIRED_SCENARIO_MARKERS) {
        const index = text.indexOf(marker);
        if (index === -1) {
          errors.push(`scenario_examples.${lang} is missing marker "${marker}"`);
        } else if (index < lastIndex) {
          errors.push(`scenario_examples.${lang} has marker "${marker}" out of order (expected ascending 6.1-6.7)`);
        } else {
          lastIndex = index;
        }
      }
    }
  }

  return errors;
}

const args = process.argv.slice(2);
const targets = args.length > 0
  ? args
  : readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).map((f) => join(DATA_DIR, f));

let anyFail = false;
for (const path of targets) {
  const errors = validateFile(path);
  if (errors.length === 0) {
    console.log(`OK   ${path}`);
  } else {
    anyFail = true;
    console.log(`FAIL ${path}`);
    for (const e of errors) console.log(`     - ${e}`);
  }
}
process.exit(anyFail ? 1 : 0);
