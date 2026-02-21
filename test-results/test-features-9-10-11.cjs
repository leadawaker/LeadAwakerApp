/**
 * Live test for Features 9, 10, 11
 * Admin: leadawaker@gmail.com / test123
 * Viewer: viewer@test.com / test123
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RESULTS_DIR = path.join(__dirname, 'live-test-9-10-11');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

async function screenshot(page, name) {
  const file = path.join(RESULTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`Screenshot: ${name}.png`);
}

async function loginAs(page, email, password) {
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('[data-testid="input-email"]', { timeout: 10000 });
  await page.fill('[data-testid="input-email"]', email);
  await page.fill('[data-testid="input-password"]', password);
  await page.click('[data-testid="button-login"]');
  await page.waitForURL(/\/(agency|subaccount)\/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function logout(page) {
  try {
    await page.evaluate(() => {
      localStorage.clear();
    });
    // Call logout API
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {}));
    await page.goto('http://localhost:5173/login');
    await page.waitForTimeout(800);
  } catch(e) {
    console.log('Logout fallback:', e.message);
    await page.goto('http://localhost:5173/login');
    await page.waitForTimeout(500);
  }
}

// Click the collapse toggle button in the sidebar bottom area
async function clickCollapseToggle(page) {
  // The collapse button is in the desktop sidebar bottom section
  // It's the button that shows PanelRightOpen/PanelRightClose icon
  const sidebar = page.locator('aside[data-sidebar-focus]');
  // Find button containing PanelRight icon - it's the first button in the bottom section
  // We can click by finding the button that toggles collapse via its position in sidebar footer
  // The button has the text "Collapse" when expanded or just an icon when collapsed
  const collapseWithText = sidebar.locator('button:has-text("Collapse")');
  const count1 = await collapseWithText.count();
  if (count1 > 0) {
    await collapseWithText.first().click();
    return;
  }
  // When collapsed, find the expand button by its SVG icon class or position
  // The button is in mb-1 section, at top of bottom actions
  const bottomButtons = sidebar.locator('div.px-3.mb-1.space-y-1 button').first();
  await bottomButtons.click();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ----------------------------------------------------------------
  console.log('\n=== FEATURE 9: Collapsible sidebar ===');
  // ----------------------------------------------------------------

  await loginAs(page, 'leadawaker@gmail.com', 'test123');
  await screenshot(page, 'f9-01-admin-logged-in');

  const sidebar = page.locator('aside[data-sidebar-focus]').first();

  // Ensure sidebar starts expanded (reset localStorage)
  await page.evaluate(() => localStorage.removeItem('sidebar-collapsed'));
  await page.reload();
  await page.waitForTimeout(1500);
  await screenshot(page, 'f9-02-sidebar-initial-expanded');

  const boxExpanded = await sidebar.boundingBox();
  console.log('Step 1 - Initial sidebar width:', boxExpanded?.width, '(should be ~180)');
  const isInitiallyExpanded = (boxExpanded?.width ?? 0) > 100;
  console.log('Step 1 - Sidebar starts expanded:', isInitiallyExpanded);

  // Step 1: Click collapse toggle
  await clickCollapseToggle(page);
  await page.waitForTimeout(600);
  await screenshot(page, 'f9-03-sidebar-collapsed');

  const boxCollapsed = await sidebar.boundingBox();
  console.log('Step 1 - Sidebar width after collapse:', boxCollapsed?.width, '(should be ~60)');
  const isCollapsed = (boxCollapsed?.width ?? 999) < 100;
  console.log('Step 1 - Collapsed to icon-only:', isCollapsed);

  // Verify labels are hidden
  const dashboardLabel = await page.locator('aside[data-sidebar-focus] span:has-text("Dashboard")').isVisible({ timeout: 1000 }).catch(() => false);
  console.log('Step 1 - Nav labels hidden in collapsed state:', !dashboardLabel);

  // Step 2: Click expand toggle
  await clickCollapseToggle(page);
  await page.waitForTimeout(600);
  await screenshot(page, 'f9-04-sidebar-expanded-again');

  const boxExpandedAgain = await sidebar.boundingBox();
  console.log('Step 2 - Sidebar width after expand:', boxExpandedAgain?.width, '(should be ~180)');
  const isExpandedAgain = (boxExpandedAgain?.width ?? 0) > 100;
  console.log('Step 2 - Sidebar re-expanded with full labels:', isExpandedAgain);

  const dashboardLabelVisible = await page.locator('aside[data-sidebar-focus] span:has-text("Dashboard")').isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Step 2 - Nav labels visible when expanded:', dashboardLabelVisible);

  // Step 3: Test persistence across navigation
  // Collapse it, navigate, and verify it stays collapsed
  await clickCollapseToggle(page);
  await page.waitForTimeout(400);

  const lsBeforeNav = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  console.log('Step 3 - localStorage before nav:', lsBeforeNav);

  await page.goto('http://localhost:5173/agency/campaigns');
  await page.waitForTimeout(1500);
  await screenshot(page, 'f9-05-collapsed-after-navigation');

  const sidebarAfterNav = page.locator('aside[data-sidebar-focus]').first();
  const boxAfterNav = await sidebarAfterNav.boundingBox();
  console.log('Step 3 - Sidebar width after navigation:', boxAfterNav?.width);
  const persistedCollapsed = (boxAfterNav?.width ?? 999) < 100;
  const lsAfterNav = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  console.log('Step 3 - localStorage after nav:', lsAfterNav);
  console.log('Step 3 - Collapse state persisted across navigation:', persistedCollapsed);

  // ----------------------------------------------------------------
  console.log('\n=== FEATURE 10: Role-based navigation items ===');
  // ----------------------------------------------------------------

  // Ensure sidebar expanded to count nav items
  await page.goto('http://localhost:5173/agency/dashboard');
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
  await page.reload();
  await page.waitForTimeout(1500);

  // Step 1: Admin nav items (count DOM elements, not visible text)
  const adminNavLinks = await page.locator('[data-testid^="link-nav-"]').all();
  const adminNavCount = adminNavLinks.length;
  const adminNavLabels = [];
  for (const link of adminNavLinks) {
    const testId = await link.getAttribute('data-testid');
    adminNavLabels.push(testId);
  }
  console.log('Step 1 - Admin nav item count:', adminNavCount, '(expected: 11)');
  console.log('Step 1 - Admin nav items:', adminNavLabels);
  await screenshot(page, 'f10-01-admin-nav-expanded');

  // Step 2 & 3: Viewer user nav items
  await logout(page);
  await loginAs(page, 'viewer@test.com', 'test123');
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
  await page.reload();
  await page.waitForTimeout(1500);
  await screenshot(page, 'f10-02-viewer-dashboard');

  const viewerNavLinks = await page.locator('[data-testid^="link-nav-"]').all();
  const viewerNavCount = viewerNavLinks.length;
  const viewerNavLabels = [];
  for (const link of viewerNavLinks) {
    const testId = await link.getAttribute('data-testid');
    viewerNavLabels.push(testId);
  }
  console.log('Step 2 - Viewer nav item count:', viewerNavCount, '(expected: 5 or fewer)');
  console.log('Step 2 - Viewer nav items:', viewerNavLabels);

  const agencyOnlyVisible = await page.locator('[data-testid="link-nav-accounts"]').isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Step 2 - "Accounts" (agency-only) visible for viewer:', agencyOnlyVisible, '(expected: false)');

  const tagsVisible = await page.locator('[data-testid="link-nav-tags"]').isVisible({ timeout: 2000 }).catch(() => false);
  const libraryVisible = await page.locator('[data-testid="link-nav-library"]').isVisible({ timeout: 2000 }).catch(() => false);
  const usersVisible = await page.locator('[data-testid="link-nav-users"]').isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Step 2 - Hidden items check: tags=', tagsVisible, 'library=', libraryVisible, 'users=', usersVisible);

  // Step 3: Try to access agency URL directly as viewer
  await page.goto('http://localhost:5173/agency/accounts');
  await page.waitForTimeout(2000);
  const urlAfterDirectAccess = page.url();
  console.log('Step 3 - URL after direct access to /agency/accounts as viewer:', urlAfterDirectAccess);
  await screenshot(page, 'f10-03-viewer-agency-direct-url');

  // ----------------------------------------------------------------
  console.log('\n=== FEATURE 11: Account switcher dropdown ===');
  // ----------------------------------------------------------------

  // Admin - account switcher should be visible
  await logout(page);
  await loginAs(page, 'leadawaker@gmail.com', 'test123');
  await page.waitForTimeout(1000);
  await screenshot(page, 'f11-01-admin-sidebar');

  const accountSwitcherDiv = page.locator('[data-testid="sidebar-account-switcher"]');
  const switcherVisible = await accountSwitcherDiv.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Step 1 - Account switcher visible for Admin:', switcherVisible, '(expected: true)');

  // Open the switcher
  const switcherTrigger = page.locator('[data-testid="sidebar-account-switcher-trigger"]').first();
  await switcherTrigger.click();
  await page.waitForTimeout(600);
  await screenshot(page, 'f11-02-switcher-dropdown-open');

  // Count account options
  const accountOptions = await page.locator('[data-testid^="sidebar-account-option-"]').all();
  console.log('Step 2 - Account options available:', accountOptions.length);

  // Switch to a non-agency account
  const nonAgencyOption = page.locator('[data-testid^="sidebar-account-option-"]:not([data-testid="sidebar-account-option-1"])').first();
  const nonAgencyCount = await nonAgencyOption.count();

  if (nonAgencyCount > 0) {
    const optText = await nonAgencyOption.innerText();
    console.log('Step 2 - Switching to account:', optText.trim().split('\n')[0]);
    await nonAgencyOption.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'f11-03-after-account-switch');

    const urlAfterSwitch = page.url();
    console.log('Step 2 - URL after switch:', urlAfterSwitch);
    console.log('Step 2 - Navigated to subaccount route:', urlAfterSwitch.includes('/subaccount/'));

    // Check the switcher now shows the new account
    const switcherText = await page.locator('[data-testid="sidebar-account-switcher-trigger"]').first().innerText();
    console.log('Step 2 - Switcher now shows:', switcherText.trim().slice(0, 30));
  }

  // Viewer - account switcher should be hidden
  await logout(page);
  await loginAs(page, 'viewer@test.com', 'test123');
  await page.waitForTimeout(1000);
  await screenshot(page, 'f11-04-viewer-sidebar-no-switcher');

  const viewerSwitcherVisible = await page.locator('[data-testid="sidebar-account-switcher"]').isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Step 3 - Account switcher visible for Viewer:', viewerSwitcherVisible, '(expected: false)');

  // ----------------------------------------------------------------
  console.log('\n=== CONSOLE ERRORS ===');
  if (consoleErrors.length === 0) {
    console.log('No console errors detected.');
  } else {
    consoleErrors.slice(0, 10).forEach(e => console.log('ERROR:', e));
  }

  await browser.close();
  console.log('\nDone. Screenshots saved to:', RESULTS_DIR);
})();
