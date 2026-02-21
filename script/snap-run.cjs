const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'feature-104');
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

  // Listen for console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await login(page);

  // Navigate to conversations and intercept API calls to simulate slow loading
  // We'll delay the leads and interactions endpoints
  await page.route('**/api/leads**', async route => {
    await new Promise(r => setTimeout(r, 2000)); // 2 second delay
    await route.continue();
  });
  await page.route('**/api/interactions**', async route => {
    await new Promise(r => setTimeout(r, 2000));
    await route.continue();
  });

  // Go to conversations page
  await page.goto('http://localhost:5173/agency/conversations', { waitUntil: 'domcontentloaded' });

  // Wait for React to mount the page shell (before data arrives)
  await page.waitForSelector('[data-testid="page-conversations"]', { timeout: 10000 });
  console.log('Page shell mounted');

  // Give React a moment to render the loading state
  await page.waitForTimeout(200);

  // STEP 1: Check for skeleton placeholders during loading
  await shot(page, '01-loading-state');

  const inboxSkel = await page.$('[data-testid="list-inbox"] .animate-pulse');
  console.log('STEP 1 - Inbox list skeleton:', inboxSkel ? 'FOUND (PASS)' : 'NOT FOUND (FAIL)');

  const chatSkel = await page.$('[data-testid="skeleton-chat-thread"]');
  console.log('STEP 1 - ChatPanel skeleton:', chatSkel ? 'FOUND (PASS)' : 'NOT FOUND (FAIL)');

  const contactSkel = await page.$('[data-testid="skeleton-contact-panel"]');
  console.log('STEP 1 - ContactSidebar skeleton:', contactSkel ? 'FOUND (PASS)' : 'NOT FOUND (FAIL)');

  // STEP 2: Wait for data to load and check skeletons are gone
  await page.waitForSelector('[data-testid^="button-thread-"]', { timeout: 20000 });
  await page.waitForTimeout(500);

  await shot(page, '02-loaded-state');

  const threads = await page.$$('[data-testid^="button-thread-"]');
  console.log('STEP 2 - Threads after load:', threads.length);

  const inboxSkelGone = await page.$('[data-testid="list-inbox"] .animate-pulse');
  console.log('STEP 2 - Inbox skeleton gone after load:', !inboxSkelGone ? 'PASS' : 'FAIL (still present)');

  const chatSkelGone = await page.$('[data-testid="skeleton-chat-thread"]');
  console.log('STEP 2 - ChatPanel skeleton gone after load:', !chatSkelGone ? 'PASS' : 'FAIL (still present)');

  const contactSkelGone = await page.$('[data-testid="skeleton-contact-panel"]');
  console.log('STEP 2 - ContactSidebar skeleton gone after load:', !contactSkelGone ? 'PASS' : 'FAIL (still present)');

  // STEP 3: Verify smooth transition - real content present
  const firstThread = await page.$('[data-testid^="button-thread-"]');
  if (firstThread) await firstThread.click();
  await page.waitForTimeout(500);

  await shot(page, '03-thread-selected');

  const chatScroll = await page.$('[data-testid="chat-scroll"]');
  console.log('STEP 3 - Chat messages area present:', chatScroll ? 'PASS' : 'FAIL');

  const contactPanel = await page.$('[data-testid="contact-identity"]');
  console.log('STEP 3 - Lead identity in contact panel:', contactPanel ? 'PASS' : 'FAIL');

  console.log('Console errors:', errors.length, errors.length > 0 ? errors : '');

  await browser.close();
  console.log('Test complete');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
