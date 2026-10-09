// Builds the Dutch and Portuguese Report funnel pages from the English ones in client/public/site/:
// report.html, report-thanks.html and audit.html become <name>-nl.html and <name>-pt.html.
// The copy lives in lang/pages-<code>.cjs. Every English fragment must still exist, so an edit to an
// English page fails loudly here instead of leaking English onto /nl or /pt.
// Usage: node script/report/build-pages.cjs
const path = require('path');
const fs = require('fs');

const ANY = 0;
const SITE = path.join(__dirname, '../../client/public/site');
let failed = false;

for (const code of ['nl', 'pt']) {
  const pages = require(path.join(__dirname, 'lang', `pages-${code}.cjs`));
  for (const [file, pairs] of Object.entries(pages)) {
    let html = fs.readFileSync(path.join(SITE, file), 'utf8');
    const problems = [];
    for (const [en, tr, want = 1] of pairs) {
      const found = html.split(en).length - 1;
      if ((want === ANY && found === 0) || (want !== ANY && found !== want)) {
        problems.push(`expected ${want === ANY ? '1+' : want}, found ${found}: ${JSON.stringify(en.slice(0, 90))}`);
        continue;
      }
      html = html.split(en).join(tr);
    }
    const out = file.replace('.html', `-${code}.html`);
    if (problems.length) {
      failed = true;
      console.error(`${file} changed; update these pairs in lang/pages-${code}.cjs:\n  - ` + problems.join('\n  - '));
      continue;
    }
    fs.writeFileSync(path.join(SITE, out), html);
    console.log(`wrote client/public/site/${out} (${pairs.length} replacements)`);
  }
}
if (failed) process.exitCode = 1;
