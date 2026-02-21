/**
 * Test script for Features 15, 16, 17
 *
 * Feature 15: Route guards preventing unauthorized URL access
 * Feature 16: Responsive sidebar collapse on mobile
 * Feature 17: Quick-jump shortcuts from dashboard
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'features-15-16-17');
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
  await page.waitForURL(/\/(agency|subaccount|login)/, { timeout: 15000 });
  console.log('Post-login URL:', page.url());
}

async function getConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function main() {
  const results = {
    feature15: { pass: false, notes: [] },
    feature16: { pass: false, notes: [] },
    feature17: { pass: false, notes: [] },
  };

  const consoleErrors = [];

  const browser = await chromium.launch({ headless: true, args: ['--window-size=1280,800'] });

  // =====================================================================
  // FEATURE 15 — Route guards preventing unauthorized URL access
  // =====================================================================
  console.log('\n=== FEATURE 15: Route Guards ===');

  let context15 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page15 = await context15.newPage();
  page15.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[F15] ${msg.text()}`); });

  try {
    // Login as admin first to find a viewer user, then login as viewer
    await loginAs(page15, 'leadawaker@gmail.com', 'test123');
    await page15.waitForTimeout(1500);
    const postLoginUrl = page15.url();
    console.log('Admin logged in at:', postLoginUrl);
    await shot(page15, 'f15-01-admin-login');

    // Simulate Viewer access: set role to Viewer and a non-agency account
    await page15.evaluate(() => {
      localStorage.setItem('leadawaker_user_role', 'Viewer');
      localStorage.setItem('leadawaker_current_account_id', '2');
    });
    await page15.reload({ waitUntil: 'networkidle' });
    await page15.waitForTimeout(1000);
    await shot(page15, 'f15-02-viewer-mode-dashboard');
    console.log('Set role to Viewer, accountId=2, URL:', page15.url());

    // Test 1: Navigate directly to /agency/accounts - should redirect
    await page15.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 15000 });
    await page15.waitForTimeout(1000);
    const urlAfterAccounts = page15.url();
    console.log('After navigating to /agency/accounts as Viewer:', urlAfterAccounts);
    await shot(page15, 'f15-03-viewer-access-accounts');
    const redirectedFromAccounts = !urlAfterAccounts.includes('/accounts');
    results.feature15.notes.push(`/agency/accounts redirect: ${redirectedFromAccounts ? 'PASS' : 'FAIL'} (landed at ${urlAfterAccounts})`);

    // Test 2: Navigate to /agency/users - should redirect
    await page15.goto('http://localhost:5173/agency/users', { waitUntil: 'networkidle', timeout: 15000 });
    await page15.waitForTimeout(1000);
    const urlAfterUsers = page15.url();
    console.log('After navigating to /agency/users as Viewer:', urlAfterUsers);
    await shot(page15, 'f15-04-viewer-access-users');
    const redirectedFromUsers = !urlAfterUsers.includes('/users');
    results.feature15.notes.push(`/agency/users redirect: ${redirectedFromUsers ? 'PASS' : 'FAIL'} (landed at ${urlAfterUsers})`);

    // Test 3: Navigate to /agency/tags - should redirect
    await page15.goto('http://localhost:5173/agency/tags', { waitUntil: 'networkidle', timeout: 15000 });
    await page15.waitForTimeout(1000);
    const urlAfterTags = page15.url();
    console.log('After navigating to /agency/tags as Viewer:', urlAfterTags);
    const redirectedFromTags = !urlAfterTags.includes('/tags');
    results.feature15.notes.push(`/agency/tags redirect: ${redirectedFromTags ? 'PASS' : 'FAIL'} (landed at ${urlAfterTags})`);

    // Test 4: Navigate to /agency/prompt-library - should redirect
    await page15.goto('http://localhost:5173/agency/prompt-library', { waitUntil: 'networkidle', timeout: 15000 });
    await page15.waitForTimeout(1000);
    const urlAfterPrompts = page15.url();
    console.log('After navigating to /agency/prompt-library as Viewer:', urlAfterPrompts);
    const redirectedFromPrompts = !urlAfterPrompts.includes('/prompt-library');
    results.feature15.notes.push(`/agency/prompt-library redirect: ${redirectedFromPrompts ? 'PASS' : 'FAIL'} (landed at ${urlAfterPrompts})`);

    // Test 5: Navigate to /agency/automation-logs - should redirect
    await page15.goto('http://localhost:5173/agency/automation-logs', { waitUntil: 'networkidle', timeout: 15000 });
    await page15.waitForTimeout(1000);
    const urlAfterLogs = page15.url();
    console.log('After navigating to /agency/automation-logs as Viewer:', urlAfterLogs);
    const redirectedFromLogs = !urlAfterLogs.includes('/automation-logs');
    results.feature15.notes.push(`/agency/automation-logs redirect: ${redirectedFromLogs ? 'PASS' : 'FAIL'} (landed at ${urlAfterLogs})`);

    await shot(page15, 'f15-05-viewer-access-automations');

    const allRedirects = redirectedFromAccounts && redirectedFromUsers && redirectedFromTags && redirectedFromPrompts && redirectedFromLogs;
    results.feature15.pass = allRedirects;
    console.log('Feature 15 result:', allRedirects ? 'PASS' : 'FAIL');

  } catch (err) {
    results.feature15.notes.push(`Error: ${err.message}`);
    console.error('Feature 15 error:', err.message);
    await shot(page15, 'f15-error');
  }

  await context15.close();

  // =====================================================================
  // FEATURE 16 — Responsive sidebar collapse on mobile
  // =====================================================================
  console.log('\n=== FEATURE 16: Mobile Sidebar ===');

  let context16 = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 14 width
  let page16 = await context16.newPage();
  page16.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[F16] ${msg.text()}`); });

  try {
    await loginAs(page16, 'leadawaker@gmail.com', 'test123');
    await page16.waitForTimeout(1500);

    // Ensure we have a clean dashboard
    const currentUrl = page16.url();
    if (!currentUrl.includes('/dashboard')) {
      await page16.goto('http://localhost:5173/agency/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
      await page16.waitForTimeout(1000);
    }

    await shot(page16, 'f16-01-mobile-initial');
    console.log('Mobile viewport loaded at:', page16.url());

    // Check desktop sidebar is NOT visible on mobile
    const desktopSidebar = page16.locator('aside[data-sidebar-focus]');
    const desktopSidebarVisible = await desktopSidebar.isVisible().catch(() => false);
    console.log('Desktop sidebar visible on mobile:', desktopSidebarVisible);

    // Check hamburger button exists and is visible
    // The hamburger is in the Topbar - look for it
    const hamburgerBtn = page16.locator('[data-testid="hamburger-menu-btn"], button[aria-label*="menu"], button[aria-label*="Menu"]').first();
    const hamburgerVisible = await hamburgerBtn.isVisible().catch(() => false);
    console.log('Hamburger button visible:', hamburgerVisible);

    // Also try to find it in topbar
    const topbarHamburger = page16.locator('[data-testid="topbar-mobile-menu-btn"]').first();
    const topbarHamburgerVisible = await topbarHamburger.isVisible().catch(() => false);
    console.log('Topbar hamburger visible:', topbarHamburgerVisible);

    // Get page content to see what's there
    const topbarContent = await page16.locator('[data-testid="topbar"], header, nav').first().innerHTML().catch(() => 'not found');
    console.log('Topbar/header innerHTML snippet:', topbarContent.substring(0, 300));

    // Try clicking the hamburger (Menu icon in topbar)
    const menuButtons = await page16.locator('button').all();
    console.log('Total buttons found:', menuButtons.length);

    // Look for the hamburger - it might be a Menu icon in Topbar
    let hamburgerClicked = false;
    for (const btn of menuButtons) {
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) continue;
      const bbox = await btn.boundingBox();
      if (!bbox) continue;
      // Hamburger is typically in the top-left or top area
      if (bbox.y < 100) {
        const svgContent = await btn.innerHTML().catch(() => '');
        if (svgContent.includes('svg') || svgContent.includes('Menu') || svgContent.includes('menu')) {
          console.log('Found potential hamburger at y:', bbox.y, 'x:', bbox.x);
          await btn.click();
          hamburgerClicked = true;
          await page16.waitForTimeout(500);
          break;
        }
      }
    }

    await shot(page16, 'f16-02-after-hamburger-click');

    // Check if mobile sidebar overlay appeared
    const mobileOverlay = page16.locator('[data-testid="mobile-sidebar-overlay"]');
    const overlayVisible = await mobileOverlay.isVisible().catch(() => false);
    console.log('Mobile sidebar overlay visible after click:', overlayVisible);

    const mobileSidebarPanel = page16.locator('[data-testid="mobile-sidebar-panel"]');
    const mobilePanelVisible = await mobileSidebarPanel.isVisible().catch(() => false);
    console.log('Mobile sidebar panel visible:', mobilePanelVisible);

    // Close by clicking backdrop
    if (overlayVisible || mobilePanelVisible) {
      const backdrop = page16.locator('[data-testid="mobile-sidebar-backdrop"]');
      await backdrop.click().catch(async () => {
        // Click outside panel area
        await page16.mouse.click(380, 400);
      });
      await page16.waitForTimeout(500);
      await shot(page16, 'f16-03-after-close');
      const overlayAfterClose = await mobileOverlay.isVisible().catch(() => false);
      console.log('Mobile overlay after close:', overlayAfterClose);
      results.feature16.notes.push(`Sidebar opened on hamburger click: PASS`);
      results.feature16.notes.push(`Sidebar closed on backdrop click: ${!overlayAfterClose ? 'PASS' : 'FAIL'}`);
    }

    // Verify the hamburger itself
    results.feature16.notes.push(`Hamburger clicked: ${hamburgerClicked ? 'PASS' : 'FAIL (could not click hamburger)'}`);
    results.feature16.notes.push(`Mobile overlay appeared: ${overlayVisible || mobilePanelVisible ? 'PASS' : 'FAIL'}`);

    // Feature passes if mobile sidebar works (hamburger + overlay)
    results.feature16.pass = hamburgerClicked && (overlayVisible || mobilePanelVisible);
    console.log('Feature 16 result:', results.feature16.pass ? 'PASS' : 'FAIL');

  } catch (err) {
    results.feature16.notes.push(`Error: ${err.message}`);
    console.error('Feature 16 error:', err.message);
    await shot(page16, 'f16-error');
  }

  await context16.close();

  // =====================================================================
  // FEATURE 17 — Quick-jump shortcuts from dashboard
  // =====================================================================
  console.log('\n=== FEATURE 17: Quick-Jump Shortcuts ===');

  let context17 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page17 = await context17.newPage();
  page17.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[F17] ${msg.text()}`); });

  try {
    await loginAs(page17, 'leadawaker@gmail.com', 'test123');
    await page17.waitForTimeout(1500);

    // Navigate to dashboard
    await page17.goto('http://localhost:5173/agency/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
    await page17.waitForTimeout(1500);
    await shot(page17, 'f17-01-dashboard');
    console.log('Dashboard URL:', page17.url());

    // Check quick-jump cards container exists
    const quickJumpContainer = page17.locator('[data-testid="quick-jump-cards"]');
    const containerVisible = await quickJumpContainer.isVisible().catch(() => false);
    console.log('Quick-jump container visible:', containerVisible);
    results.feature17.notes.push(`Quick-jump container present: ${containerVisible ? 'PASS' : 'FAIL'}`);

    // Test Leads quick-jump
    const leadsBtn = page17.locator('[data-testid="quick-jump-leads"]');
    const leadsVisible = await leadsBtn.isVisible().catch(() => false);
    console.log('Leads quick-jump button visible:', leadsVisible);

    if (leadsVisible) {
      await leadsBtn.click();
      await page17.waitForTimeout(1000);
      const leadsUrl = page17.url();
      console.log('After Leads click:', leadsUrl);
      const leadsNavigated = leadsUrl.includes('/contacts') || leadsUrl.includes('/leads');
      results.feature17.notes.push(`Leads quick-jump navigation: ${leadsNavigated ? 'PASS' : 'FAIL'} (${leadsUrl})`);
      await shot(page17, 'f17-02-after-leads-click');

      // Go back to dashboard
      await page17.goto('http://localhost:5173/agency/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
      await page17.waitForTimeout(1500);
    } else {
      results.feature17.notes.push('Leads quick-jump button: NOT FOUND');
    }

    // Test Campaigns quick-jump
    const campaignsBtn = page17.locator('[data-testid="quick-jump-campaigns"]');
    const campaignsVisible = await campaignsBtn.isVisible().catch(() => false);
    if (campaignsVisible) {
      await campaignsBtn.click();
      await page17.waitForTimeout(1000);
      const campaignsUrl = page17.url();
      console.log('After Campaigns click:', campaignsUrl);
      const campaignsNavigated = campaignsUrl.includes('/campaigns');
      results.feature17.notes.push(`Campaigns quick-jump navigation: ${campaignsNavigated ? 'PASS' : 'FAIL'} (${campaignsUrl})`);
      await shot(page17, 'f17-03-after-campaigns-click');

      await page17.goto('http://localhost:5173/agency/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
      await page17.waitForTimeout(1500);
    } else {
      results.feature17.notes.push('Campaigns quick-jump button: NOT FOUND');
    }

    // Test Inbox quick-jump
    const inboxBtn = page17.locator('[data-testid="quick-jump-inbox"]');
    const inboxVisible = await inboxBtn.isVisible().catch(() => false);
    if (inboxVisible) {
      await inboxBtn.click();
      await page17.waitForTimeout(1000);
      const inboxUrl = page17.url();
      console.log('After Inbox click:', inboxUrl);
      const inboxNavigated = inboxUrl.includes('/conversations');
      results.feature17.notes.push(`Inbox quick-jump navigation: ${inboxNavigated ? 'PASS' : 'FAIL'} (${inboxUrl})`);
      await shot(page17, 'f17-04-after-inbox-click');

      await page17.goto('http://localhost:5173/agency/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
      await page17.waitForTimeout(1500);
    } else {
      results.feature17.notes.push('Inbox quick-jump button: NOT FOUND');
    }

    // Test Calendar quick-jump
    const calendarBtn = page17.locator('[data-testid="quick-jump-calendar"]');
    const calendarVisible = await calendarBtn.isVisible().catch(() => false);
    if (calendarVisible) {
      await calendarBtn.click();
      await page17.waitForTimeout(1000);
      const calendarUrl = page17.url();
      console.log('After Calendar click:', calendarUrl);
      const calendarNavigated = calendarUrl.includes('/calendar');
      results.feature17.notes.push(`Calendar quick-jump navigation: ${calendarNavigated ? 'PASS' : 'FAIL'} (${calendarUrl})`);
      await shot(page17, 'f17-05-after-calendar-click');
    } else {
      results.feature17.notes.push('Calendar quick-jump button: NOT FOUND');
    }

    // Feature passes if container is visible and all 4 links navigate correctly
    const allNotes = results.feature17.notes;
    const passCount = allNotes.filter(n => n.includes('PASS')).length;
    const failCount = allNotes.filter(n => n.includes('FAIL')).length;
    results.feature17.pass = containerVisible && failCount === 0 && passCount >= 4;
    console.log('Feature 17 result:', results.feature17.pass ? 'PASS' : 'FAIL', `(${passCount} pass, ${failCount} fail)`);

  } catch (err) {
    results.feature17.notes.push(`Error: ${err.message}`);
    console.error('Feature 17 error:', err.message);
    await shot(page17, 'f17-error');
  }

  await context17.close();
  await browser.close();

  // =====================================================================
  // SUMMARY
  // =====================================================================
  console.log('\n\n========= TEST SUMMARY =========');
  console.log(`Feature 15 (Route Guards):    ${results.feature15.pass ? 'PASS' : 'FAIL'}`);
  results.feature15.notes.forEach(n => console.log('  -', n));

  console.log(`Feature 16 (Mobile Sidebar):  ${results.feature16.pass ? 'PASS' : 'FAIL'}`);
  results.feature16.notes.forEach(n => console.log('  -', n));

  console.log(`Feature 17 (Quick-Jump):      ${results.feature17.pass ? 'PASS' : 'FAIL'}`);
  results.feature17.notes.forEach(n => console.log('  -', n));

  if (consoleErrors.length > 0) {
    console.log('\nConsole Errors:');
    consoleErrors.forEach(e => console.log(' !', e));
  } else {
    console.log('\nNo console errors detected.');
  }

  // Write results JSON
  const resultsFile = path.join(SCREENSHOT_DIR, 'results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({ results, consoleErrors }, null, 2));
  console.log('\nResults written to:', resultsFile);

  process.exit(results.feature15.pass && results.feature16.pass && results.feature17.pass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
