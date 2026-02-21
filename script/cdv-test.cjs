const { chromium } = require('playwright');
const fs = require('fs');
const DIR = '/home/gabriel/docker/code-server/config/workspace/LeadAwakerApp/test-results/campaign-detail-view';
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    executablePath: '/home/gabriel/.cache/ms-playwright/chromium_headless_shell-1208/chrome-linux/headless_shell',
    headless: true
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // STEP 1: Login
  console.log('[STEP 1] Opening http://localhost:5173');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: DIR + '/01-login-page.png' });
  console.log('Screenshot: 01-login-page.png');
  // STEP 2: Login
  console.log('[STEP 2] Logging in');
  await page.fill('[data-testid=input-email]', 'leadawaker@gmail.com');
  await page.fill('[data-testid=input-password]', 'test123');
  await page.click('[data-testid=button-login]');
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('After login URL:', page.url());
  await page.screenshot({ path: DIR + '/02-after-login.png' });
  console.log('Screenshot: 02-after-login.png');
  // STEP 3: Click campaigns nav link
  console.log('[STEP 3] Clicking campaigns nav link');
  await page.locator('[data-testid=link-nav-campaigns]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: DIR + '/03-campaigns-page.png' });
  console.log('Screenshot: 03-campaigns-page.png | URL:', page.url());
  // STEP 4: Check elements
  console.log('[STEP 4] Snapshot page elements');
  const isLoading = await page.locator('[data-testid=campaign-card-grid-loading]').isVisible().catch(() => false);
  console.log('Loading skeleton:', isLoading);
  if (isLoading) {
    await page.waitForSelector('[data-testid=campaign-card-grid]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: DIR + '/04-loaded.png' });
    console.log('Screenshot: 04-loaded.png');
  }
  // Use button selector to avoid matching the search input
  const cards = page.locator('button[data-testid^=campaign-card-]');
  const cardCount = await cards.count();
  console.log('Campaign cards found:', cardCount);
  const allIds = await page.evaluate(() => Array.from(document.querySelectorAll('button[data-testid^=campaign-card-]')).map(el => el.getAttribute('data-testid')));
  console.log('Card button testids:', allIds.join(', '));
  // STEP 5: Click first card
  let clicked = false;
  if (cardCount > 0) {
    const first = cards.first();
    const tid = await first.getAttribute('data-testid');
    console.log('[STEP 1] Clicking card:', tid);
    await first.click();
    clicked = true;
    await page.waitForTimeout(1000);
  }
  console.log('TEST - Card clickable:', clicked ? 'PASS' : 'FAIL');
  await page.screenshot({ path: DIR + '/05-after-click.png' });
  console.log('Screenshot: 05-after-click.png');
  // STEP 10: Verify panel
  const panel = page.locator('[data-testid=campaign-detail-panel]');
  const pVis = await panel.isVisible().catch(() => false);
  console.log('TEST - campaign-detail-panel visible:', pVis ? 'PASS' : 'FAIL');
  if (pVis) {
    const ids = ['campaign-detail-name', 'campaign-detail-status', 'campaign-detail-close', 'campaign-detail-backdrop', 'campaign-detail-section-settings', 'campaign-detail-section-ai', 'campaign-detail-section-templates', 'campaign-detail-section-integrations', 'campaign-detail-first-message', 'campaign-detail-bump-1', 'campaign-detail-bump-2', 'campaign-detail-bump-3'];
    console.log('Panel sub-element checks:');
    for (const id of ids) {
      const v = await page.locator('[data-testid=' + id + ']').isVisible().catch(() => false);
      console.log('  ' + id + ':', v ? 'PASS' : 'FAIL');
    }
    const nameT = await page.locator('[data-testid=campaign-detail-name]').textContent().catch(() => '');
    const statusT = await page.locator('[data-testid=campaign-detail-status]').textContent().catch(() => '');
    console.log('Campaign name in panel:', nameT.trim());
    console.log('Campaign status in panel:', statusT.trim());
    const pIds = await panel.evaluate(el => Array.from(el.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid')));
    console.log('All panel testids:', pIds.join(', '));
    // STEP 11: Close button
    const cb = page.locator('[data-testid=campaign-detail-close]');
    const cbV = await cb.isVisible().catch(() => false);
    console.log('TEST - Close button visible:', cbV ? 'PASS' : 'FAIL');
    if (cbV) { await cb.click(); } else { await page.locator('[data-testid=campaign-detail-backdrop]').click({ force: true }).catch(() => {}); }
    await page.waitForTimeout(600);
    const gone = !(await panel.isVisible().catch(() => false));
    console.log('TEST - Panel closed:', gone ? 'PASS' : 'FAIL');
    await page.screenshot({ path: DIR + '/06-after-close.png' });
    console.log('Screenshot: 06-after-close.png');
    // STEP 12: Backdrop close
    if (cardCount > 0) {
      console.log('[STEP 12] Backdrop close test');
      await cards.first().click();
      await page.waitForTimeout(800);
      const reopened = await panel.isVisible().catch(() => false);
      console.log('Panel re-opened:', reopened ? 'PASS' : 'FAIL');
      if (reopened) {
        await page.locator('[data-testid=campaign-detail-backdrop]').click({ force: true });
        await page.waitForTimeout(600);
        const byBd = !(await panel.isVisible().catch(() => false));
        console.log('TEST - Backdrop closes panel:', byBd ? 'PASS' : 'FAIL');
        await page.screenshot({ path: DIR + '/07-backdrop-close.png' });
        console.log('Screenshot: 07-backdrop-close.png');
      }
    }
  }
  console.log('[STEP 13] Console errors:', errs.length);
  errs.forEach((e, i) => console.log('  Error', i + 1, ':', e.substring(0, 250)));
  await browser.close();
  console.log('=== SUMMARY ===');
  console.log('Campaign cards found:', cardCount);
  console.log('Card clickable:', clicked ? 'PASS' : 'FAIL');
  console.log('Detail panel opened:', pVis ? 'PASS' : 'FAIL');
  console.log('Screenshots in:', DIR);
  console.log('DONE');
}
main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
