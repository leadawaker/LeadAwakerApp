const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'prompt-library-verify');
if (!fs.existsSync(SCREENSHOT_DIR)) { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); }

async function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  console.log('Screenshot:', fp);
  return fp;
}

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Logged in:', page.url());
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1400, height: 900 });

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await login(page);

  await page.goto( 'http://localhost:5173/agency/prompt-library', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('Prompt library URL:', page.url());

  await shot(page, '01-prompt-library');

  const activeArchived = await page.evaluate(function() {
    var result = [];
    document.querySelectorAll('*').forEach(function(el) {
      if (el.children.length === 0) {
        var t = (el.textContent || '').trim();
        if (t === 'Active' || t === 'Archived') {
          result.push({ text: t, tag: el.tagName, className: el.className });
        }
      }
    });
    return result;
  });
  console.log('Active/Archived badges:', JSON.stringify(activeArchived, null, 2));

  const versions = await page.evaluate(function() {
    var result = [];
    document.querySelectorAll('*').forEach(function(el) {
      if (el.children.length === 0) {
        var t = (el.textContent || '').trim();
        if (/^v\d/.test(t)) {
          result.push({ text: t, tag: el.tagName, className: el.className });
        }
      }
    });
    return result;
  });
  console.log('Version elements:', JSON.stringify(versions, null, 2));

  const heading = await page.evaluate(function() {
    var h = document.querySelector('h1');
    return h ? h.textContent.trim() : 'No h1 found';
  });
  console.log('Page heading:', heading);

  const cardCount = await page.evaluate(function() {
    var cards = document.querySelectorAll('[data-testid^="prompt-card-"]');
    return cards.length;
  });
  console.log('Prompt card count (data-testid):', cardCount);

  const badgeInfo = await page.evaluate(function() {
    var result = [];
    var badges = document.querySelectorAll('[data-testid^="badge-prompt-status-"]');
    badges.forEach(function(el) {
      result.push({ text: el.textContent.trim(), className: el.className, testid: el.getAttribute('data-testid') });
    });
    return result;
  });
  console.log('Badge prompt status elements:', JSON.stringify(badgeInfo, null, 2));

  console.log('Console errors:', errors.length, errors.length > 0 ? errors : 'None');
  await browser.close();
}

main().catch(err => { console.error('TEST FAILED:', err.message); process.exit(1); });
