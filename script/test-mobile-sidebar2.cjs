const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/gabriel/.cache/ms-playwright/chromium_headless_shell-1208/chrome-linux/headless_shell',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();

  // Set auth
  await page.goto('http://localhost:5174/login');
  await page.evaluate(() => {
    localStorage.setItem('leadawaker_auth', 'session');
    localStorage.setItem('leadawaker_user_role', 'Admin');
    localStorage.setItem('leadawaker_current_account_id', '1');
    localStorage.setItem('leadawaker_user_name', 'Test User');
  });

  await page.goto('http://localhost:5174/agency/dashboard');
  await page.waitForTimeout(2000);

  // Open mobile sidebar
  const hamburger = page.locator('[data-testid="button-hamburger-menu"]');
  await hamburger.click();
  await page.waitForTimeout(500);

  // Check if desktop sidebar is visible (it should NOT be)
  const desktopSidebarSwitcher = page.locator('[data-testid="sidebar-account-switcher"]');
  const switcherCount = await desktopSidebarSwitcher.count();
  console.log('Account switcher elements found:', switcherCount);
  for (let i = 0; i < switcherCount; i++) {
    const visible = await desktopSidebarSwitcher.nth(i).isVisible();
    console.log(`  Switcher ${i} visible:`, visible);
  }

  // Check all nav link testids
  const navLinks = ['nav-home', 'nav-accounts', 'nav-campaigns', 'nav-contacts', 'nav-chats', 'nav-calendar'];
  for (const testId of navLinks) {
    const mobileLink = page.locator(`[data-testid="mobile-${testId}"]`);
    const desktopLink = page.locator(`[data-testid="link-${testId}"]`);
    const mobileVis = await mobileLink.isVisible().catch(() => false);
    const desktopVis = await desktopLink.isVisible().catch(() => false);
    console.log(`${testId}: mobile=${mobileVis}, desktop=${desktopVis}`);
  }

  // Test navigation - click Contacts in mobile sidebar
  const contactsLink = page.locator('[data-testid="mobile-nav-contacts"]');
  await contactsLink.click();
  await page.waitForTimeout(1000);

  const url = page.url();
  console.log('After clicking Contacts, URL:', url);
  console.log('Navigated to contacts:', url.includes('/contacts') ? 'PASS' : 'FAIL');

  // Verify sidebar closed after navigation
  const overlayAfterNav = await page.locator('[data-testid="mobile-sidebar-overlay"]').isVisible().catch(() => false);
  console.log('Sidebar closed after navigation:', !overlayAfterNav ? 'PASS' : 'FAIL');

  await page.screenshot({ path: '.playwright-cli/mobile-test-nav.png', fullPage: false });
  console.log('Screenshot saved: after navigation to contacts');

  await browser.close();
  console.log('DONE');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
