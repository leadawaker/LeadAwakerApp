// Copies script/site-sections/try-sara.html into the en/nl/pt landing pages,
// replacing the block that starts at its "Public website demo" comment.
// Usage: node script/site-sections/sync-try-sara.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, "../../client/public/site");
const section = fs.readFileSync(path.join(here, "try-sara.html"), "utf8").replace(/\n+$/, "");
const START = "  <!-- Public website demo (specs/public-website-demo).";

for (const file of ["index.html", "nl.html", "pt.html"]) {
  const p = path.join(site, file);
  const html = fs.readFileSync(p, "utf8");
  const a = html.indexOf(START);
  const open = html.indexOf('<section class="band" id="try-sara"', a);
  if (a < 0 || open < 0) throw new Error(`${file}: #try-sara block not found`);
  // The section holds no nested <section>, so its first closing tag ends it.
  const b = html.indexOf("  </section>", open) + "  </section>".length;
  fs.writeFileSync(p, html.slice(0, a) + section + html.slice(b));
  console.log(`${file}: synced`);
}
