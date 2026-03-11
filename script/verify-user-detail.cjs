const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'user-detail-verify');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
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
  await page.setViewportSize({ width: 1280, height: 900 });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => { consoleErrors.push('[pageerror] ' + err.message); });

  console.log('Step 1: Opening http://localhost:5173');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await shot(page, '01-initial');
  console.log('Step 2: Screenshot taken.');

  console.log('Step 3: Logging in...');
  await login(page);
  await shot(page, '02-after-login');

  console.log('Step  4: Navigating to /agency/users');
  await page.goto('http://localhost:5173/agency/users', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  console.log('Step 5: URL=' + page.url());
  await shot(page, '03-users-page');

  console.log('Step 6: Button snapshot');
  const allBtns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => ({
    testId: b.getAttribute('data-testid'),
    ariaLabel: b.getAttribute('aria-label'),
    title: b.getAttribute('title'),
    text: b.innerText.trim().substring(0, 40),
    hasSvg: !!b.querySelector('svg')
  })));
  console.log('Total buttons: ' + allBtns.length);
  allBtns.forEach((b, i) => {
    if (b.testId || b.ariaLabel || b.title || b.text)
      console.log('  [' + i + '] ' + JSON.stringify(b));
  });

  console.log('Step 7: Clicking view/eye button');
  const viewSels = [
    '[data-testid^=\"button-view-user\"]',
    '[data-testid*=\"view-user\"]',
    '[data-testid*=\"btn-view\"]',
    '[aria-label*=\"View\" i]',
    '[aria-label*=\"Detail\" i]',
    'button[title*=\"view\" i]'
  ];
  let clicked = false;
  for (const sel of viewSels) {
    const btn = await page.$(sel);
    if (btn) { console.log('Found: ' + sel); await btn.click(); clicked = true; break; }
  }
  if (!clicked) {
    const fbBtn = await page.$('tbody tr:first-child button');
    if (fbBtn) { await fbBtn.click(); clicked = true; console.log('Clicked first row button.'); }
    else { console.log('WARNING: No view button found.'); }
  }
  await page.waitForTimeout(1500);

  console.log('Step 8: Dialog screenshot');
  await shot(page, '04-dialog');

  console.log('Step 9: Verifying dialog content');
  const dInfo = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
      || document.querySelector('[data-radix-dialog-content]');
    return d ? { found: true, text: d.innerText.substring(0, 1200) } : { found: false, text: '' };
  });
  if (!dInfo.found) {
    console.log('RESULT: No dialog found - FAIL');
  } else {
    console.log('Dialog found: YES');
    console.log('--- Dialog text ---');
    console.log(dInfo.text);
    console.log('---------------');
    const t = dInfo.text;
    console.log('  userName: ' + (/[A-Za-z]{3,}/.test(t) ? 'PASS' : 'FAIL'));
    console.log('  email: ' + (/@[a-z0-9.]+\.[a-z]{2,}/i.test(t) ? 'PASS' : 'FAIL'));
    console.log('  phone: ' + (/\+?\d[\d\s\-\(\)]{6,}/.test(t) ? 'PASS' : 'FAIL'));
    console.log('  role: ' + (/admin|viewer|agent|manager|owner/i.test(t) ? 'PASS' : 'FAIL'));
    console.log('  lastLogin: ' + (/last.?login|last.?seen|signed.?in/i.test(t) ? 'PASS' : 'FAIL'));
    console.log('  preferences: ' + (/pref|setting|notif|theme/i.test(t) ? 'PASS' : 'FAIL'));
  }

  console.log('Step 10: ' + consoleErrors.length + ' console error(s)');
  if (consoleErrors.length === 0) { console.log('  None (PASS)'); }
  else { consoleErrors.forEach(e => console.log('  ERROR: ' + e)); }

  await browser.close();
  console.log('Step 11: Browser closed. Done.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });