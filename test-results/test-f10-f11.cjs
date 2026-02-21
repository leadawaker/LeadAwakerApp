/**
 * Live test for Features 10, 11
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
  await page.goto('http://localhost:5173/login', { timeout: 20000 });
  await page.waitForSelector('[data-testid="input-email"]', { timeout: 15000 });
  await page.fill('[data-testid="input-email"]', email);
  await page.fill('[data-testid="input-password"]', password);
  await page.click('[data-testid="button-login"]');
  await page.waitForURL(/\/(agency|subaccount)\/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const consoleErrors = [];

  // ----------------------------------------------------------------
  console.log('\n=== FEATURE 10: Role-based navigation (Admin) ===');
  // ----------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await loginAs(page, 'leadawaker@gmail.com', 'test123');
    await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
    await page.reload();
    await page.waitForTimeout(1500);

    const adminNavLinks = await page.locator('[data-testid^="link-nav-"]').all();
    const adminNavCount = adminNavLinks.length;
    const adminNavLabels = [];
    for (const link of adminNavLinks) {
      adminNavLabels.push((await link.innerText()).trim());
    }
    console.log('Step 1 - Admin nav count:', adminNavCount, '(expected: 11)');
    console.log('Step 1 - Admin nav items:', adminNavLabels);
    await screenshot(page, 'f10-01-admin-nav');

    await context.close();
  }

  // ----------------------------------------------------------------
  console.log('\n=== FEATURE 10: Role-based navigation (Viewer) ===');
  // ----------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await loginAs(page, 'viewer@test.com', 'test123');
    await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
    await page.reload();
    await page.waitForTimeout(1500);
    await screenshot(page, 'f10-02-viewer-nav');

    const viewerNavLinks = await page.locator('[data-testid^="link-nav-"]').all();
    const viewerNavCount = viewerNavLinks.length;
    const viewerNavLabels = [];
    for (const link of viewerNavLinks) {
      viewerNavLabels.push((await link.innerText()).trim());
    }
    console.log('Step 2 - Viewer nav count:', viewerNavCount, '(expected: 5 or fewer)');
    console.log('Step 2 - Viewer nav items:', viewerNavLabels);

    const accountsHidden = !(await page.locator('[data-testid="link-nav-accounts"]').isVisible({ timeout: 1000 }).catch(() => false));
    const tagsHidden = !(await page.locator('[data-testid="link-nav-tags"]').isVisible({ timeout: 1000 }).catch(() => false));
    const libraryHidden = !(await page.locator('[data-testid="link-nav-library"]').isVisible({ timeout: 1000 }).catch(() => false));
    const usersHidden = !(await page.locator('[data-testid="link-nav-users"]').isVisible({ timeout: 1000 }).catch(() => false));
    const automationsHidden = !(await page.locator('[data-testid="link-nav-automations"]').isVisible({ timeout: 1000 }).catch(() => false));
    const settingsHidden = !(await page.locator('[data-testid="link-nav-settings"]').isVisible({ timeout: 1000 }).catch(() => false));
    console.log('Step 2 - Agency-only items hidden: accounts=', accountsHidden, 'tags=', tagsHidden, 'library=', libraryHidden, 'users=', usersHidden, 'automations=', automationsHidden, 'settings=', settingsHidden);

    // Step 3: Try to access /agency/accounts directly as viewer
    await page.goto('http://localhost:5173/agency/accounts', { timeout: 15000 });
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log('Step 3 - URL after direct /agency/accounts access as viewer:', currentUrl);
    const wasRedirected = !currentUrl.includes('/agency/accounts') || currentUrl.includes('/subaccount') || currentUrl.includes('/login');
    console.log('Step 3 - Was redirected away from agency/accounts:', wasRedirected);
    await screenshot(page, 'f10-03-viewer-direct-url-access');

    await context.close();
  }

  // ----------------------------------------------------------------
  console.log('\n=== FEATURE 11: Account switcher (Admin) ===');
  // ----------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await loginAs(page, 'leadawaker@gmail.com', 'test123');
    await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
    await page.reload();
    await page.waitForTimeout(1500);
    await screenshot(page, 'f11-01-admin-sidebar');

    // Check account switcher present
    const switcherVisible = await page.locator('[data-testid="sidebar-account-switcher"]').isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Step 1 - Account switcher visible for Admin:', switcherVisible, '(expected: true)');

    // Open switcher
    await page.locator('[data-testid="sidebar-account-switcher-trigger"]').first().click();
    await page.waitForTimeout(700);
    await screenshot(page, 'f11-02-switcher-open');

    const accountOptions = await page.locator('[data-testid^="sidebar-account-option-"]').all();
    console.log('Step 2 - Account options count:', accountOptions.length);
    const optionLabels = [];
    for (const opt of accountOptions) {
      optionLabels.push((await opt.innerText()).trim().split('\n')[0]);
    }
    console.log('Step 2 - Accounts listed:', optionLabels);

    // Switch to non-agency account
    const nonAgency = page.locator('[data-testid^="sidebar-account-option-"]:not([data-testid="sidebar-account-option-1"])').first();
    if (await nonAgency.count() > 0) {
      const optText = (await nonAgency.innerText()).trim().split('\n')[0];
      console.log('Step 2 - Switching to:', optText);
      await nonAgency.click();
      await page.waitForTimeout(2500);
      await screenshot(page, 'f11-03-after-switch');

      const urlAfterSwitch = page.url();
      console.log('Step 2 - URL after switch:', urlAfterSwitch);
      console.log('Step 2 - Page data filtered to subaccount (URL changed):', urlAfterSwitch.includes('/subaccount/'));

      // Check switcher shows new account name
      const switcherNow = await page.locator('[data-testid="sidebar-account-switcher-trigger"]').first().innerText();
      console.log('Step 2 - Switcher now shows:', switcherNow.trim().slice(0, 40));
    } else {
      console.log('Step 2 - No non-agency accounts found to switch to');
    }

    await context.close();
  }

  // ----------------------------------------------------------------
  console.log('\n=== FEATURE 11: Account switcher (Viewer - should be hidden) ===');
  // ----------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await loginAs(page, 'viewer@test.com', 'test123');
    await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
    await page.reload();
    await page.waitForTimeout(1500);
    await screenshot(page, 'f11-04-viewer-sidebar');

    const viewerSwitcherVisible = await page.locator('[data-testid="sidebar-account-switcher"]').isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Step 3 - Account switcher visible for Viewer:', viewerSwitcherVisible, '(expected: false)');

    await context.close();
  }

  // ----------------------------------------------------------------
  console.log('\n=== CONSOLE ERRORS ===');
  if (consoleErrors.length === 0) {
    console.log('No console errors detected.');
  } else {
    consoleErrors.slice(0, 10).forEach(e => console.log('ERROR:', e));
  }

  await browser.close();
  console.log('\nDone. Screenshots in:', RESULTS_DIR);
})();
