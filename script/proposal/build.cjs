// Builds one proposal from proposals/<slug>/ into a PDF and a private web page.
//   proposals/<slug>/proposal.html   the content (links the shared kit in script/proposal/)
//   proposals/<slug>/proposal.json   { title, company, contact, lang, pdf, token, prospectId?, crmLink? }
//   proposals/<slug>/img/            this proposal's images
// Output in proposals/<slug>/dist/: index.html (CSS/JS inlined, served at /p/<token>/), the PDF, img/, assets/.
// --previews also renders every PDF page to PNG in proposals/<slug>/previews/ for review.
// Usage: node script/proposal/build.cjs <slug> [--previews]
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require('../../node_modules/playwright');

const ROOT = path.join(__dirname, '../..');
const KIT = __dirname;
const slug = process.argv[2];
if (!slug || slug.startsWith('--')) { console.error('usage: node script/proposal/build.cjs <slug> [--previews]'); process.exit(1); }
const dir = path.join(ROOT, 'proposals', slug);
const metaPath = path.join(dir, 'proposal.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

// The token is the private link. Made once, never changed, so a sent link keeps working.
if (!meta.token) {
  meta.token = crypto.randomBytes(9).toString('base64url');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}
const DOWNLOAD = { en: 'Download PDF', nl: 'Download pdf', pt: 'Baixar PDF' }[meta.lang || 'en'];
const KIT_HREF = '../../script/proposal/';

(async () => {
  const dist = path.join(dir, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  // PDF straight from the source, so relative kit and img paths resolve on disk.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await page.goto('file://' + path.join(dir, 'proposal.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(dist, meta.pdf), printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('pdf:', path.join(dist, meta.pdf));

  // Web: one self-contained page plus its images.
  let html = fs.readFileSync(path.join(dir, 'proposal.html'), 'utf8');
  const css = fs.readFileSync(path.join(KIT, 'proposal.css'), 'utf8');
  const js = fs.readFileSync(path.join(KIT, 'proposal.js'), 'utf8');
  const swap = (from, to) => { if (!html.includes(from)) throw new Error(`proposal.html must contain ${from}`); html = html.replace(from, to); };
  swap(`<link rel="stylesheet" href="${KIT_HREF}proposal.css">`, `<style>\n${css}</style>`);
  swap(`<script src="${KIT_HREF}proposal.js"></script>`, `<script>\n${js}</script>`);
  html = html.split(`${KIT_HREF}assets/`).join('assets/');
  swap('<head>', `<head>\n<base href="/p/${meta.token}/">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="robots" content="noindex,nofollow">`);
  html = html.replace(/<body([^>]*)>/, `<body$1>\n<div class="wbar"><img src="assets/logo.svg" alt="Lead Awaker"><a class="dl" href="${meta.pdf}" download><svg class="ic" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>${DOWNLOAD}</a></div>`);
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  fs.cpSync(path.join(KIT, 'assets'), path.join(dist, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'client/public/site/img/836cc55c31a7.svg'), path.join(dist, 'assets/logo.svg'));
  if (fs.existsSync(path.join(dir, 'img'))) fs.cpSync(path.join(dir, 'img'), path.join(dist, 'img'), { recursive: true, filter: f => !f.endsWith('.png') }); // PNGs are generator originals
  console.log('web:', path.join(dist, 'index.html'));

  if (process.argv.includes('--previews')) {
    const out = path.join(dir, 'previews');
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    require('child_process').execFileSync('pdftoppm', ['-r', '100', '-png', path.join(dist, meta.pdf), path.join(out, 'p')]);
    console.log('previews:', fs.readdirSync(out).length, 'pages in', out);
  }
  console.log(`\nlink:    https://www.leadawaker.com/p/${meta.token}/`);
  console.log(`preview: https://app.leadawaker.com/p/${meta.token}/?preview=1  (does not notify)`);
})();
