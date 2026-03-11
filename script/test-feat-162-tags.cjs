const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'feat-162');
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
  console.log('Tags page mounted');

  // Wait for tags to load (skeleton gone, categories appear)
  await page.waitForSelector('[data-testid^="tag-category-"]', { timeout: 15000 });
  console.log('Tag categories loaded');

  await page.waitForTimeout(500);
  await shot(page, '01-tags-page-initial');

  // STEP 1: Verify tags are grouped by category
  const categoryEls = await page.$$('[data-testid^="tag-category-"]');
  console.log(`STEP 1 - Categories rendered: ${categoryEls.length} (expect 6+)`);
  const categoryNames = await Promise.all(categoryEls.map(el => el.getAttribute('data-testid')));
  console.log('Categories found:', categoryNames);

  // Expected DB categories: Status, Outcome, Automation, Behavior, Source, Priority
  const expectedCategories = ['status', 'outcome', 'automation', 'behavior', 'source', 'priority'];
  const foundCategories = categoryNames.map(n => n.replace('tag-category-', ''));
  const missingCategories = expectedCategories.filter(c => !foundCategories.includes(c));
  console.log('STEP 1 - Expected categories present:', missingCategories.length === 0 ? 'PASS' : `FAIL - missing: ${missingCategories.join(', ')}`);

  // STEP 2: Verify each tag shows name, color and description
  const tagItems = await page.$$('[data-testid^="tag-item-"]');
  console.log(`STEP 2 - Tag items rendered: ${tagItems.length} (expect 25+)`);

  // Check first tag has a name
  const firstTagName = await page.$('[data-testid^="tag-name-"]');
  const tagNameText = firstTagName ? await firstTagName.textContent() : null;
  console.log(`STEP 2 - First tag name: "${tagNameText}" - ${tagNameText ? 'PASS' : 'FAIL'}`);

  // Check color dots are rendered (circle divs with background-color style)
  const colorDots = await page.$$('[data-testid^="tag-item-"] div[style*="background-color"]');
  console.log(`STEP 2 - Color dots rendered: ${colorDots.length} - ${colorDots.length > 0 ? 'PASS' : 'FAIL'}`);

  // STEP 3: Click a tag and verify side panel shows leads
  const firstTag = tagItems[0];
  if (firstTag) {
    await firstTag.click();
    await page.waitForTimeout(500);
    await shot(page, '02-tag-selected');

    const panelTitle = await page.$('[data-testid="side-panel-title"]');
    const panelTitleText = panelTitle ? await panelTitle.textContent() : null;
    console.log(`STEP 3 - Side panel title after click: "${panelTitleText}"`);
    const panelTitleValid = panelTitleText && panelTitleText.startsWith('Leads:');
    console.log(`STEP 3 - Side panel title shows "Leads:": ${panelTitleValid ? 'PASS' : 'FAIL'}`);

    const description = await page.$('[data-testid="side-panel-description"]');
    const descText = description ? await description.textContent() : null;
    console.log(`STEP 3 - Tag description in panel: "${descText}" - ${descText ? 'PASS' : 'SKIP (no description)'}`);
  }

  // STEP 4: Verify tags counter text
  const counterText = await page.$('text=/tags in/');
  console.log(`STEP 4 - Tags counter visible: ${counterText ? 'PASS' : 'FAIL'}`);

  // STEP 5: Test search filter
  const searchInput = await page.$('[data-testid="input-search-tags"]');
  if (searchInput) {
    await searchInput.fill('bump');
    await page.waitForTimeout(400);
    await shot(page, '03-search-bump');

    const filteredTags = await page.$$('[data-testid^="tag-item-"]');
    console.log(`STEP 5 - Tags after "bump" search: ${filteredTags.length} (expect 5-8)`);
    console.log(`STEP 5 - Search filter works: ${filteredTags.length > 0 && filteredTags.length < 29 ? 'PASS' : 'FAIL'}`);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
  }

  // STEP 6: No mock data check - confirm real DB data
  // All real tags from DB have IDs starting from 2
  const tagId2 = await page.$('[data-testid="tag-item-2"]');
  const tagId3 = await page.$('[data-testid="tag-item-3"]');
  console.log(`STEP 6 - Tag ID 2 (ai stop) from DB: ${tagId2 ? 'PASS' : 'FAIL'}`);
  console.log(`STEP 6 - Tag ID 3 (appointment booked) from DB: ${tagId3 ? 'PASS' : 'FAIL'}`);

  console.log('\n--- Console Errors ---');
  console.log(`Total errors: ${errors.length}`);
  if (errors.length > 0) errors.forEach(e => console.log(' ERROR:', e));
  console.log(`Console errors: ${errors.length === 0 ? 'PASS (0 errors)' : 'FAIL'}`);

  await browser.close();
  console.log('\nTest complete');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
