const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'feat-prompt-toggle');
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
const toggleBtns = await page.$$('[data-testid^="button-toggle-status-"]');
  console.log(`Toggle buttons found: ${toggleBtns.length}`);
  
    for (const el of toggleBtns) {
      const tid = await el.getAttribute('data-testid');
      console.log(tid);
    }
const firstBtn = toggleBtns[0];
  if (firstBtn) {
    await firstBtn.click();
    await page.waitForTimeout(2500);
    await shot(page, '02-after-toggle-click');
   await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, '03-after-reload');

 
  }

  
  if (errors.length > 0) errors.forEach(e => console.log(' ERROR:', e));
  console.log(`Console errors: ${errors.length === 0 ? 'PASS (0 errors)' : 'FAIL'}`);

  await browser.close();
  console.log('\nTest complete');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
