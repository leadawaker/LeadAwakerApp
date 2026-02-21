const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'features-9-10-11-v2');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log('Screenshot:', fp);
  return fp;
}

async function loginAs(page, email, password) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('[data-testid="input-email"]', email);
  await page.fill('[data-testid="input-password"]', password);
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/{dashboard,agency,subaccount}**', { timeout: 10000 });
  console.log('Logged in as:', email, '| URL:', page.url());
}

async function ensureExpandedSidebar(page) {
  await page.evaluate(() => localStorage.removeItem('sidebar-collapsed'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('aside[data-sidebar-focus]', { timeout: 10000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--window-size=1280,800'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // =======================================================================
  // FEATURE 9 — STEP 2: Expand from collapsed, verify labels appear
  // =======================================================================
  console.log('\n=== FEATURE 9 STEP 2: Expand from collapsed ===');
  await loginAs(page, 'leadawaker@gmail.com', 'test123');
  await page.goto('http://localhost:5173/agency/dashboard', { waitUntil: 'networkidle' });
  await ensureExpandedSidebar(page);

  // Collapse sidebar via JS (avoid the overlay timing issue)
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'true'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('aside[data-sidebar-focus]', { timeout: 10000 });
  await page.waitForTimeout(300);

  const sidebar = page.locator('aside[data-sidebar-focus]');
  const collapsedBox = await sidebar.boundingBox();
  console.log('Confirmed collapsed width:', collapsedBox?.width);
  await shot(page, 'f9-step2-start-collapsed');

  // Now use JS to expand - using the collapse button (no text in collapsed mode)
  // Force click using JS evaluate to avoid overlay intercept
  await page.evaluate(() => {
    // Find the collapse button by looking for buttons in the sidebar
    const sidebar = document.querySelector('aside[data-sidebar-focus]');
    if (!sidebar) return;
    const buttons = sidebar.querySelectorAll('button');
    // The collapse button is near the bottom - look for one near the collapse area
    // In collapsed mode, it shows PanelRightClose icon. We need to find it.
    // The button should be in the bottom actions area
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      // Look for button in the lower portion of the sidebar (y > 500)
      if (rect.y > 450 && rect.y < 680) {
        // Check if it's not the help or db-status button
        const svg = btn.querySelector('svg');
        if (svg) {
          btn.click();
          console.log('Clicked button at y:', rect.y);
          break;
        }
      }
    }
  });
  await page.waitForTimeout(500);

  const expandedBox = await sidebar.boundingBox();
  console.log('After clicking expand button, sidebar width:', expandedBox?.width);
  const labelVisible = await page.locator('aside[data-sidebar-focus] span:text("Dashboard")').isVisible().catch(() => false);
  const lsVal = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  console.log('localStorage sidebar-collapsed:', lsVal, '| label visible:', labelVisible);

  const step2Pass = expandedBox && expandedBox.width > 100 && labelVisible;
  console.log(`STEP 2 - Expand to full labels: ${step2Pass ? 'PASS' : 'FAIL'}`);
  await shot(page, 'f9-step2-expanded');

  // =======================================================================
  // FEATURE 9 — STEP 3: Persistence across navigation
  // =======================================================================
  console.log('\n=== FEATURE 9 STEP 3: Persistence ===');

  // Collapse sidebar
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'true'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('aside[data-sidebar-focus]', { timeout: 10000 });
  await page.waitForTimeout(300);

  const collapsedBeforeNav = await sidebar.boundingBox();
  console.log('Before navigation (collapsed) width:', collapsedBeforeNav?.width);

  // Navigate to a different page
  await page.goto('http://localhost:5173/agency/campaigns', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('aside[data-sidebar-focus]', { timeout: 10000 });
  await page.waitForTimeout(300);

  const afterNavBox = await sidebar.boundingBox();
  const lsAfterNav = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  const labelAfterNav = await page.locator('aside[data-sidebar-focus] span:text("Dashboard")').isVisible().catch(() => false);
  console.log('After navigation - width:', afterNavBox?.width, '| localStorage:', lsAfterNav, '| label visible:', labelAfterNav);

  const step3Pass = afterNavBox && afterNavBox.width <= 80 && lsAfterNav === 'true' && !labelAfterNav;
  console.log(`STEP 3 - Collapse persists after navigation: ${step3Pass ? 'PASS' : 'FAIL'}`);
  await shot(page, 'f9-step3-after-nav');

  // Now navigate again (to contacts) and verify STILL collapsed
  await page.goto('http://localhost:5173/agency/contacts', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('aside[data-sidebar-focus]', { timeout: 10000 });
  const afterNav2Box = await sidebar.boundingBox();
  console.log('After 2nd navigation - width:', afterNav2Box?.width);
  await shot(page, 'f9-step3-after-nav2');

  // =======================================================================
  // FEATURE 10 — STEP 3: Direct URL access for hidden pages
  // =======================================================================
  console.log('\n=== FEATURE 10 STEP 3: Direct URL access ===');

  // Simulate Viewer role
  await loginAs(page, 'leadawaker@gmail.com', 'test123');
  await page.goto('http://localhost:5173/agency/dashboard', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('leadawaker_user_role', 'Viewer');
    localStorage.setItem('leadawaker_current_account_id', '2');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Test 1: /subaccount/accounts (should show "Access denied. Agency only.")
  await page.goto('http://localhost:5173/subaccount/accounts', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(500);
  const urlSubaccountAccounts = page.url();
  const accessDeniedText1 = await page.locator('text=Access denied').count();
  const pageAccountsPresent1 = await page.locator('[data-testid="page-accounts"]').count();
  console.log('/subaccount/accounts - URL:', urlSubaccountAccounts, '| "Access denied" text:', accessDeniedText1, '| page-accounts present:', pageAccountsPresent1);
  await shot(page, 'f10-step3-subaccount-accounts');

  // Test 2: /agency/accounts (URL is in agency context — isAgencyView true, but user role is Viewer)
  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(500);
  const urlAgencyAccounts = page.url();
  const accessDeniedText2 = await page.locator('text=Access denied').count();
  const pageAccountsPresent2 = await page.locator('[data-testid="page-accounts"]').count();
  console.log('/agency/accounts - URL:', urlAgencyAccounts, '| "Access denied" text:', accessDeniedText2, '| page-accounts present:', pageAccountsPresent2);
  await shot(page, 'f10-step3-agency-accounts-as-viewer');

  // For /subaccount/accounts: shows "Access denied. Agency only." — PROTECTED
  const subaccountProtected = accessDeniedText1 > 0 && pageAccountsPresent1 === 0;
  // For /agency/accounts: isAgencyView is true (URL starts /agency), so it renders the page even for Viewer role
  // This is a gap: URL-based isAgencyView check doesn't enforce role
  const agencyProtected = accessDeniedText2 > 0 || pageAccountsPresent2 === 0;
  console.log(`/subaccount/accounts protected: ${subaccountProtected}`);
  console.log(`/agency/accounts protected (as Viewer): ${agencyProtected}`);

  const step10_3Pass = subaccountProtected; // Partial — at least subaccount path is protected

  // Restore admin role
  await page.evaluate(() => {
    localStorage.setItem('leadawaker_user_role', 'Admin');
    localStorage.setItem('leadawaker_current_account_id', '1');
  });

  // =======================================================================
  // SUMMARY
  // =======================================================================
  console.log('\n========================================');
  console.log('V2 TEST SUMMARY');
  console.log('========================================');
  console.log(`Feature 9 Step 2 - Expand sidebar: ${step2Pass ? 'PASS' : 'FAIL'}`);
  console.log(`Feature 9 Step 3 - State persists: ${step3Pass ? 'PASS' : 'FAIL'}`);
  console.log(`Feature 10 Step 3 - Direct URL access blocked: ${step10_3Pass ? 'PARTIAL PASS' : 'FAIL'}`);
  console.log(`  - /subaccount/accounts shows "Access denied": ${subaccountProtected ? 'YES' : 'NO'}`);
  console.log(`  - /agency/accounts blocked for Viewer: ${agencyProtected ? 'YES' : 'NO'}`);

  await browser.close();
  console.log('Done.');
}

main().catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
