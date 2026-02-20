const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/gabriel/.cache/ms-playwright/chromium_headless_shell-1208/chrome-linux/headless_shell',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  // Set auth in localStorage before navigating
  await page.goto('http://localhost:5174/login');
  await page.evaluate(() => {
    localStorage.setItem('leadawaker_auth', 'session');
    localStorage.setItem('leadawaker_user_role', 'Admin');
    localStorage.setItem('leadawaker_current_account_id', '1');
    localStorage.setItem('leadawaker_user_name', 'Test User');
    localStorage.setItem('leadawaker_user_email', 'test@test.com');
  });

  // Navigate to agency dashboard
  await page.goto('http://localhost:5174/agency/dashboard');
  await page.waitForTimeout(2000);

  // Take screenshot of mobile view
  await page.screenshot({ path: '.playwright-cli/mobile-test-1.png', fullPage: false });
  console.log('Screenshot 1: mobile dashboard view saved');

  // TEST 1: Hamburger button is visible on mobile
  const hamburger = page.locator('[data-testid="button-hamburger-menu"]');
  const isHamburgerVisible = await hamburger.isVisible();
  console.log('TEST 1 - Hamburger visible on mobile:', isHamburgerVisible ? 'PASS' : 'FAIL');

  // TEST 2: Desktop sidebar is hidden on mobile
  // The desktop sidebar has classes "hidden md:block"
  const desktopSidebarLocator = page.locator('aside.hidden');
  const desktopSidebarCount = await desktopSidebarLocator.count();
  let desktopSidebarHidden = true;
  for (let i = 0; i < desktopSidebarCount; i++) {
    const visible = await desktopSidebarLocator.nth(i).isVisible();
    if (visible) desktopSidebarHidden = false;
  }
  console.log('TEST 2 - Desktop sidebar hidden on mobile:', desktopSidebarHidden ? 'PASS' : 'FAIL');

  // TEST 3: Click hamburger opens sidebar overlay
  await hamburger.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.playwright-cli/mobile-test-2.png', fullPage: false });
  console.log('Screenshot 2: mobile sidebar open saved');

  const overlay = page.locator('[data-testid="mobile-sidebar-overlay"]');
  const isOverlayVisible = await overlay.isVisible();
  console.log('TEST 3 - Mobile sidebar overlay opens:', isOverlayVisible ? 'PASS' : 'FAIL');

  const panel = page.locator('[data-testid="mobile-sidebar-panel"]');
  const isPanelVisible = await panel.isVisible();
  console.log('TEST 3b - Mobile sidebar panel visible:', isPanelVisible ? 'PASS' : 'FAIL');

  // TEST 4: Tap outside (backdrop) to close
  const backdrop = page.locator('[data-testid="mobile-sidebar-backdrop"]');
  // Click on the right side of the backdrop (outside the sidebar panel)
  await backdrop.click({ position: { x: 350, y: 400 } });
  await page.waitForTimeout(500);

  const isOverlayAfterBackdropClick = await page.locator('[data-testid="mobile-sidebar-overlay"]').isVisible().catch(() => false);
  console.log('TEST 4 - Sidebar closes on backdrop click:', !isOverlayAfterBackdropClick ? 'PASS' : 'FAIL');
  await page.screenshot({ path: '.playwright-cli/mobile-test-3.png', fullPage: false });
  console.log('Screenshot 3: after closing sidebar saved');

  // TEST 5: Hamburger toggle - open then close by clicking hamburger again
  await hamburger.click();
  await page.waitForTimeout(500);
  const overlayOpenAgain = await page.locator('[data-testid="mobile-sidebar-overlay"]').isVisible();
  console.log('TEST 5a - Sidebar opens on hamburger click:', overlayOpenAgain ? 'PASS' : 'FAIL');

  await hamburger.click();
  await page.waitForTimeout(500);
  const overlayClosedByHamburger = !(await page.locator('[data-testid="mobile-sidebar-overlay"]').isVisible().catch(() => false));
  console.log('TEST 5b - Sidebar closes on second hamburger click:', overlayClosedByHamburger ? 'PASS' : 'FAIL');

  // TEST 6: Nav items in mobile sidebar work
  await hamburger.click();
  await page.waitForTimeout(500);
  const navDashboard = page.locator('[data-testid="mobile-nav-home"]');
  const hasDashboardNav = await navDashboard.isVisible();
  console.log('TEST 6 - Dashboard nav item in mobile sidebar:', hasDashboardNav ? 'PASS' : 'FAIL');

  // TEST 7: Menu button in bottom bar toggles sidebar
  // Close current sidebar first
  await hamburger.click();
  await page.waitForTimeout(300);

  const bottomMenuBtn = page.locator('[data-testid="mobile-nav-menu"]');
  const isBottomMenuVisible = await bottomMenuBtn.isVisible();
  console.log('TEST 7a - Bottom bar menu button visible:', isBottomMenuVisible ? 'PASS' : 'FAIL');

  if (isBottomMenuVisible) {
    await bottomMenuBtn.click();
    await page.waitForTimeout(500);
    const overlayViaBottom = await page.locator('[data-testid="mobile-sidebar-overlay"]').isVisible();
    console.log('TEST 7b - Sidebar opens via bottom bar menu:', overlayViaBottom ? 'PASS' : 'FAIL');
    await page.screenshot({ path: '.playwright-cli/mobile-test-4.png', fullPage: false });
    console.log('Screenshot 4: sidebar via bottom bar saved');
  }

  // TEST 8: Verify at desktop width, sidebar is visible and hamburger hidden
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);
  const hamburgerAtDesktop = await hamburger.isVisible();
  console.log('TEST 8 - Hamburger hidden at desktop width:', !hamburgerAtDesktop ? 'PASS' : 'FAIL');
  await page.screenshot({ path: '.playwright-cli/mobile-test-5-desktop.png', fullPage: false });
  console.log('Screenshot 5: desktop view saved');

  // Report console errors
  console.log('\nConsole errors found:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e, i) => console.log(`  Error ${i+1}: ${e.substring(0, 200)}`));
  }

  await browser.close();
  console.log('\nDONE - All mobile sidebar tests completed');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
