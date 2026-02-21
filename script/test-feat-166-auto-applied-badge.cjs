const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'feat-166');
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
  page.setViewportSize({ width: 1400, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await login(page);

  // Navigate to Tags page as Admin
  await page.goto('http://localhost:5173/agency/tags', { waitUntil: 'domcontentloaded' });

  // Wait for page to mount
  await page.waitForSelector('[data-testid="tags-page"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid^="tag-category-"]', { timeout: 15000 });
  await page.waitForTimeout(800);
  console.log('Tags page loaded');

  await shot(page, '01-tags-page-initial');

  // STEP 1: Verify auto-applied tags show the "Auto" badge
  // Tags with auto_applied=true from the API: "second message", "bump 2 reply", "bump 2.1", "first message",
  // "bump 1 reply", "bump 1.1", "bump 3 reply", "bump response", "multiple messages",
  // "no response", "replied generating", "responded", "bump 3.1"
  // We'll check known auto_applied=true tags by their DB IDs:
  // ID 4 = "bump 1 reply" (auto_applied=true)
  // ID 5 = "bump 1.1" (auto_applied=true)
  // ID 6 = "bump 2 reply" (auto_applied=true)
  // ID 13 = "first message" (auto_applied=true)

  const autoBadgeFor4 = await page.$('[data-testid="badge-auto-applied-4"]');
  const autoBadgeFor5 = await page.$('[data-testid="badge-auto-applied-5"]');
  const autoBadgeFor13 = await page.$('[data-testid="badge-auto-applied-13"]');

  console.log(`STEP 1 - Auto badge on tag ID 4 (bump 1 reply, auto=true): ${autoBadgeFor4 ? 'PASS' : 'FAIL'}`);
  console.log(`STEP 1 - Auto badge on tag ID 5 (bump 1.1, auto=true): ${autoBadgeFor5 ? 'PASS' : 'FAIL'}`);
  console.log(`STEP 1 - Auto badge on tag ID 13 (first message, auto=true): ${autoBadgeFor13 ? 'PASS' : 'FAIL'}`);

  if (autoBadgeFor4) {
    const badgeText = await autoBadgeFor4.textContent();
    console.log(`STEP 1 - Badge text for ID 4: "${badgeText?.trim()}" (expect "Auto")`);
    console.log(`STEP 1 - Badge clearly labeled: ${badgeText?.trim() === 'Auto' ? 'PASS' : 'FAIL'}`);
  }

  // Count total auto badges
  const allAutoBadges = await page.$$('[data-testid^="badge-auto-applied-"]');
  console.log(`STEP 1 - Total Auto badges in list: ${allAutoBadges.length} (expect 10+)`);
  console.log(`STEP 1 - Multiple auto badges present: ${allAutoBadges.length >= 10 ? 'PASS' : 'FAIL (may need investigation)'}`);

  await shot(page, '02-auto-badges-visible');

  // STEP 2: Verify NON-auto-applied tags do NOT show the badge
  // ID 2 = "ai stop" (auto_applied=false)
  // ID 11 = "dnd" (auto_applied=false)
  // ID 14 = "follow-up" (auto_applied=false)
  // ID 22 = "qualify" (auto_applied=false)

  const noBadgeFor2 = await page.$('[data-testid="badge-auto-applied-2"]');
  const noBadgeFor11 = await page.$('[data-testid="badge-auto-applied-11"]');
  const noBadgeFor14 = await page.$('[data-testid="badge-auto-applied-14"]');

  console.log(`STEP 2 - No badge on tag ID 2 (ai stop, auto=false): ${!noBadgeFor2 ? 'PASS' : 'FAIL'}`);
  console.log(`STEP 2 - No badge on tag ID 11 (dnd, auto=false): ${!noBadgeFor11 ? 'PASS' : 'FAIL'}`);
  console.log(`STEP 2 - No badge on tag ID 14 (follow-up, auto=false): ${!noBadgeFor14 ? 'PASS' : 'FAIL'}`);

  // STEP 3: Click an auto-applied tag and verify side panel shows the badge too
  // Click on "first message" (ID 13, auto_applied=true)
  const tagItem13 = await page.$('[data-testid="tag-item-13"]');
  if (tagItem13) {
    await tagItem13.click();
    await page.waitForTimeout(500);
    console.log('Clicked tag ID 13 (first message, auto=true)');

    const sidePanelBadge = await page.$('[data-testid="badge-auto-applied-side-panel"]');
    console.log(`STEP 3 - Side panel shows Auto badge for auto-applied tag: ${sidePanelBadge ? 'PASS' : 'FAIL'}`);

    if (sidePanelBadge) {
      const sidePanelBadgeText = await sidePanelBadge.textContent();
      console.log(`STEP 3 - Side panel badge text: "${sidePanelBadgeText?.trim()}" (expect "Auto")`);
    }

    await shot(page, '03-auto-tag-selected-with-side-panel-badge');
  } else {
    console.log('STEP 3 - SKIP: Could not find tag ID 13 (may be filtered or not rendered)');
  }

  // Deselect and click non-auto tag
  if (tagItem13) {
    await tagItem13.click(); // deselect
    await page.waitForTimeout(300);
  }

  // Click "ai stop" tag (ID 2, auto_applied=false) and verify NO badge in side panel
  const tagItem2 = await page.$('[data-testid="tag-item-2"]');
  if (tagItem2) {
    await tagItem2.click();
    await page.waitForTimeout(500);
    console.log('Clicked tag ID 2 (ai stop, auto=false)');

    const sidePanelBadgeNone = await page.$('[data-testid="badge-auto-applied-side-panel"]');
    console.log(`STEP 3 - Side panel does NOT show Auto badge for non-auto tag: ${!sidePanelBadgeNone ? 'PASS' : 'FAIL'}`);

    await shot(page, '04-non-auto-tag-selected-no-badge');
  }

  // STEP 4: Check console errors
  console.log('\n--- Console Errors ---');
  console.log(`Total errors: ${errors.length}`);
  if (errors.length > 0) errors.forEach(e => console.log(' ERROR:', e));
  console.log(`Console errors: ${errors.length === 0 ? 'PASS (0 errors)' : `WARN (${errors.length} errors)`}`);

  await browser.close();
  console.log('\nTest complete - Feature #166 Auto-applied badge');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
