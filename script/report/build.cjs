// Renders The Report to PDF (A4). report.html is the English source; --lang nl|pt applies the
// copy in lang/<code>.cjs to it first (written next to it as report.<code>.html, so img/ paths work).
// --previews also renders every PDF page to PNG in previews/<lang>/.
// Usage: node script/report/build.cjs [--lang nl|pt] [--previews]
const path = require('path');
const fs = require('fs');
const { chromium } = require('../../node_modules/playwright');

const ANY = 0;
const dir = __dirname;
const argLang = process.argv.indexOf('--lang');
const lang = argLang > -1 ? process.argv[argLang + 1] : 'en';

function localize(code) {
  const { pdf, pairs } = require(path.join(dir, 'lang', code + '.cjs'));
  let html = fs.readFileSync(path.join(dir, 'report.html'), 'utf8');
  const problems = [];
  for (const [en, tr, want = 1] of pairs) {
    const found = html.split(en).length - 1;
    if ((want === ANY && found === 0) || (want !== ANY && found !== want)) {
      problems.push(`expected ${want === ANY ? '1+' : want}, found ${found}: ${JSON.stringify(en.slice(0, 90))}`);
      continue;
    }
    html = html.split(en).join(tr);
  }
  if (problems.length) {
    console.error(`report.html changed; update these pairs in lang/${code}.cjs:\n  - ` + problems.join('\n  - '));
    process.exit(1);
  }
  const src = `report.${code}.html`;
  fs.writeFileSync(path.join(dir, src), html);
  return { src, pdf };
}

(async () => {
  const { src, pdf } = lang === 'en' ? { src: 'report.html', pdf: 'the-report.pdf' } : localize(lang);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(dir, src), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(dir, pdf), printBackground: true, preferCSSPageSize: true });
  console.log('pdf:', path.join(dir, pdf));
  await browser.close();

  // Previews come from the PDF itself (via poppler), so they show what PDF viewers show.
  if (process.argv.includes('--previews')) {
    const out = path.join(dir, 'previews', lang);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    require('child_process').execFileSync('pdftoppm', ['-r', '100', '-png', path.join(dir, pdf), path.join(out, 'p')]);
    console.log('previews:', fs.readdirSync(out).length, 'pages in', out);
  }
})();
