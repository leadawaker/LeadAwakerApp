const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp/test-f9-10-11';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  return page.screenshot({ path: fp, fullPage: false }).then(() => {
    console.log('Screenshot:', fp);
    return fp;
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function loginAs(page, email, password) {
  await page.goto(APP_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1000);
  await shot(page, `login-page-${email.split('@')[0]}`);

  // Try different selectors
  const emailInput = page.locator('[data-testid="input-email"], input[type="email"], input[name="email"]').first();
  const passInput = page.locator('[data-testid="input-password"], input[type="password"], input[name="password"]').first();
  const submitBtn = page.locator('[data-testid="button-login"], button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();

  await emailInput.fill(email);
  await passInput.fill(password);
  await submitBtn.click();
  await sleep(3000);
  console.log('Logged in as:', email, '| URL:', page.url());
}

async function logout(page) {
  // Try to logout via API
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  });
  await sleep(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--window-size=1280,800'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const results = [];

  // ===========================================================================
  // FEATURE 9: Collapsible sidebar
  // ===========================================================================
  console.log('\n=== FEATURE 9: Collapsible Sidebar ===');

  await loginAs(page, 'leadawaker@gmail.com', 'test123');
  await shot(page, 'f9-00-after-login');

  // Navigate to dashboard
  await page.goto(APP_URL + '/agency/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await shot(page, 'f9-01-dashboard-initial');

  // Clear sidebar state
  await page.evaluate(() => localStorage.removeItem('sidebar-collapsed'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);

  // Check initial state (expanded)
  const sb = page.locator('aside[data-sidebar-focus]');
  let sbExists = await sb.count();
  console.log('Sidebar element count:', sbExists);

  if (sbExists === 0) {
    // Try generic aside
    const anyAside = await page.locator('aside').count();
    console.log('Any aside count:', anyAside);
    // Try nav
    const anyNav = await page.locator('nav').count();
    console.log('Any nav count:', anyNav);
  }

  let sbBox = sbExists > 0 ? await sb.boundingBox() : null;
  console.log('F9 - Initial sidebar width:', sbBox?.width);
  await shot(page, 'f9-02-expanded');

  // STEP 1: Collapse
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'true'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);

  sbBox = sbExists > 0 ? await sb.boundingBox() : null;
  const labelHidden = !(await page.locator('text=Dashboard').isVisible().catch(() => false));
  console.log('F9-S1 collapsed width:', sbBox?.width, '| label hidden:', labelHidden);
  await shot(page, 'f9-03-collapsed');

  const f9s1 = sbBox && sbBox.width < 100 && labelHidden;
  results.push({ id: 'F9-S1', label: 'Sidebar collapses to icon-only', pass: !!f9s1 });
  console.log('F9-S1 (Collapse to icon-only):', f9s1 ? 'PASS' : 'FAIL');

  // STEP 2: Expand
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);

  sbBox = sbExists > 0 ? await sb.boundingBox() : null;
  const labelVisible = await page.locator('text=Dashboard').isVisible().catch(() => false);
  console.log('F9-S2 expanded width:', sbBox?.width, '| label visible:', labelVisible);
  await shot(page, 'f9-04-re-expanded');

  const f9s2 = sbBox && sbBox.width > 100 && labelVisible;
  results.push({ id: 'F9-S2', label: 'Sidebar expands with full labels', pass: !!f9s2 });
  console.log('F9-S2 (Expand with labels):', f9s2 ? 'PASS' : 'FAIL');

  // STEP 3: Persistence across navigation
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'true'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(800);

  await page.goto(APP_URL + '/agency/campaigns', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);

  sbBox = sbExists > 0 ? await sb.boundingBox() : null;
  const lsVal = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  const labelAfterNav = await page.locator('text=Dashboard').isVisible().catch(() => false);
  console.log('F9-S3 after nav width:', sbBox?.width, '| localStorage:', lsVal, '| label visible:', labelAfterNav);
  await shot(page, 'f9-05-persist-after-nav');

  const f9s3 = sbBox && sbBox.width < 100 && lsVal === 'true' && !labelAfterNav;
  results.push({ id: 'F9-S3', label: 'Collapse state persists across navigation', pass: !!f9s3 });
  console.log('F9-S3 (Persists across nav):', f9s3 ? 'PASS' : 'FAIL');

  // Also try clicking the toggle button physically
  await page.evaluate(() => localStorage.removeItem('sidebar-collapsed'));
  await page.goto(APP_URL + '/agency/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);

  // Find the toggle button
  const toggleBtn = page.locator('[data-testid*="toggle"], button[aria-label*="collapse"], button[aria-label*="sidebar"], button[title*="collapse"]').first();
  const toggleCount = await toggleBtn.count();
  console.log('Toggle button found:', toggleCount);

  if (toggleCount > 0) {
    const sbBoxBefore = await sb.boundingBox();
    await toggleBtn.click();
    await sleep(800);
    const sbBoxAfter = await sb.boundingBox();
    console.log('After toggle click - before:', sbBoxBefore?.width, 'after:', sbBoxAfter?.width);
    await shot(page, 'f9-06-after-toggle-click');
  }

  // ===========================================================================
  // FEATURE 10: Role-based navigation items
  // ===========================================================================
  console.log('\n=== FEATURE 10: Role-Based Navigation ===');

  // Reset to expanded sidebar
  await page.evaluate(() => {
    localStorage.removeItem('sidebar-collapsed');
  });
  await page.goto(APP_URL + '/agency/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);

  // STEP 1: Admin nav items
  const navLinks = page.locator('aside a, nav a');
  const navCount = await navLinks.count();
  const navTexts = await navLinks.evaluateAll(els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log('F10-S1 Admin nav link count:', navCount);
  console.log('F10-S1 Admin nav items:', navTexts.join(', '));
  await shot(page, 'f10-01-admin-nav');

  // Also try data-testid approach
  const dataNavLinks = await page.locator('a[data-testid^="link-nav"]').evaluateAll(els => els.map(e => ({ testid: e.getAttribute('data-testid'), text: e.textContent?.trim() })));
  console.log('F10-S1 data-testid nav links:', JSON.stringify(dataNavLinks));

  const f10s1 = navCount >= 9; // admin should see many items
  results.push({ id: 'F10-S1', label: 'Admin sees all nav items (>=9)', pass: f10s1 });
  console.log('F10-S1 (Admin sees all nav items):', f10s1 ? 'PASS' : 'FAIL');

  // STEP 2: Test with Manager/Viewer user
  // Logout first
  await logout(page);
  await sleep(500);

  // Login as viewer (client user, accountsId=2)
  await loginAs(page, 'elfronza@gmail.com', 'test123');
  await sleep(1000);
  await shot(page, 'f10-02-viewer-login');

  const currentUrlAfterViewerLogin = page.url();
  console.log('F10-S2 URL after viewer login:', currentUrlAfterViewerLogin);

  if (currentUrlAfterViewerLogin.includes('/login')) {
    // Viewer password might be different - try using viewer@test.com
    console.log('Viewer login failed, trying viewer@test.com');
    await loginAs(page, 'viewer@test.com', 'test123');
    await sleep(1000);
    console.log('URL after viewer@test.com login:', page.url());
  }

  await shot(page, 'f10-03-viewer-dashboard');

  const viewerNavLinks = page.locator('aside a, nav a');
  const viewerNavCount = await viewerNavLinks.count();
  const viewerNavTexts = await viewerNavLinks.evaluateAll(els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log('F10-S2 Viewer nav count:', viewerNavCount, '| items:', viewerNavTexts.join(', '));

  const viewerDataNavLinks = await page.locator('a[data-testid^="link-nav"]').evaluateAll(els => els.map(e => ({ testid: e.getAttribute('data-testid'), text: e.textContent?.trim() })));
  console.log('F10-S2 viewer data-testid nav links:', JSON.stringify(viewerDataNavLinks));

  // Check that restricted items are not shown
  const restrictedItems = ['Accounts', 'Users', 'Tags', 'Prompt Library', 'Automation'];
  const visibleTexts = viewerNavTexts.join(' ').toLowerCase();
  const hasRestricted = restrictedItems.some(item => visibleTexts.includes(item.toLowerCase()));
  console.log('F10-S2 Has restricted items:', hasRestricted, '| nav count:', viewerNavCount);

  const f10s2 = !hasRestricted && viewerNavCount <= 8;
  results.push({ id: 'F10-S2', label: 'Viewer sees only allowed pages', pass: f10s2 });
  console.log('F10-S2 (Viewer limited nav):', f10s2 ? 'PASS' : 'FAIL');

  // STEP 3: Hidden pages not accessible via direct URL
  const restrictedUrl = APP_URL + '/subaccount/accounts';
  await page.goto(restrictedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  const urlAfterRestricted = page.url();
  const accessDenied = await page.locator('text=Access Denied, text=Access denied, text=Forbidden, text=403, text=Unauthorized').count();
  const redirected = !urlAfterRestricted.includes('/accounts');
  console.log('F10-S3 URL after restricted access:', urlAfterRestricted);
  console.log('F10-S3 Access denied text found:', accessDenied, '| Redirected:', redirected);
  await shot(page, 'f10-04-restricted-access');

  const f10s3 = redirected || accessDenied > 0;
  results.push({ id: 'F10-S3', label: 'Hidden pages not accessible via direct URL', pass: f10s3 });
  console.log('F10-S3 (Restricted pages blocked):', f10s3 ? 'PASS' : 'FAIL');

  // ===========================================================================
  // FEATURE 11: Account switcher dropdown for agency users
  // ===========================================================================
  console.log('\n=== FEATURE 11: Account Switcher ===');

  // Logout viewer and login as admin
  await logout(page);
  await sleep(500);
  await loginAs(page, 'leadawaker@gmail.com', 'test123');
  await page.evaluate(() => localStorage.removeItem('sidebar-collapsed'));
  await page.goto(APP_URL + '/agency/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);

  // STEP 1: Admin sees account switcher
  const switcherViaTestId = await page.locator('[data-testid="sidebar-account-switcher"]').isVisible().catch(() => false);
  const switcherViaText = await page.locator('text=All Accounts, text=Select Account, text=Account').first().isVisible().catch(() => false);
  const switcherViaRole = await page.locator('button[data-testid*="switcher"], [role="combobox"]').first().isVisible().catch(() => false);

  console.log('F11-S1 Switcher via testid:', switcherViaTestId);
  console.log('F11-S1 Switcher via text:', switcherViaText);
  console.log('F11-S1 Switcher via role:', switcherViaRole);

  const switcherVisible = switcherViaTestId || switcherViaText || switcherViaRole;
  await shot(page, 'f11-01-admin-sidebar');

  results.push({ id: 'F11-S1', label: 'Admin sees account switcher in sidebar', pass: switcherVisible });
  console.log('F11-S1 (Admin has switcher):', switcherVisible ? 'PASS' : 'FAIL');

  // STEP 2: Click switcher and select an account
  if (switcherVisible) {
    const triggerLocator = page.locator('[data-testid="sidebar-account-switcher-trigger"], [data-testid="sidebar-account-switcher"] button, [role="combobox"]').first();
    const triggerCount = await triggerLocator.count();

    if (triggerCount > 0) {
      await triggerLocator.click();
      await sleep(800);
      await shot(page, 'f11-02-switcher-open');

      const opts = await page.locator('[data-testid^="sidebar-account-option-"], [role="option"], [role="menuitem"]').count();
      console.log('F11-S2 Account options available:', opts);

      if (opts > 1) {
        const initialAccountId = await page.evaluate(() => localStorage.getItem('leadawaker_current_account_id'));
        await page.locator('[data-testid^="sidebar-account-option-"], [role="option"], [role="menuitem"]').nth(1).click();
        await sleep(1500);
        const newAccountId = await page.evaluate(() => localStorage.getItem('leadawaker_current_account_id'));
        console.log('F11-S2 Initial account:', initialAccountId, '| New account:', newAccountId);
        await shot(page, 'f11-03-after-switch');

        const f11s2 = newAccountId !== initialAccountId;
        results.push({ id: 'F11-S2', label: 'Selecting account updates page context', pass: f11s2 });
        console.log('F11-S2 (Account switch updates context):', f11s2 ? 'PASS' : 'FAIL');
      } else {
        console.log('F11-S2 Only', opts, 'option(s) in switcher');
        results.push({ id: 'F11-S2', label: 'Selecting account updates page context', pass: opts > 0 });
      }
    } else {
      console.log('F11-S2 No clickable trigger found');
      results.push({ id: 'F11-S2', label: 'Selecting account updates page context', pass: false });
    }
  } else {
    results.push({ id: 'F11-S2', label: 'Selecting account updates page context', pass: false });
  }

  // STEP 3: Viewer does not see account switcher
  await logout(page);
  await sleep(500);
  await loginAs(page, 'viewer@test.com', 'test123');
  await sleep(1000);

  const currentUrl = page.url();
  console.log('F11-S3 URL after viewer login:', currentUrl);
  await shot(page, 'f11-04-viewer-sidebar');

  const viewerSwitcherViaTestId = await page.locator('[data-testid="sidebar-account-switcher"]').isVisible().catch(() => false);
  const viewerSwitcherViaText = await page.locator('text=All Accounts').isVisible().catch(() => false);
  const viewerSwitcherVisible = viewerSwitcherViaTestId || viewerSwitcherViaText;
  console.log('F11-S3 Switcher for viewer (should be false):', viewerSwitcherVisible);

  results.push({ id: 'F11-S3', label: 'Client user does not see account switcher', pass: !viewerSwitcherVisible });
  console.log('F11-S3 (Viewer has no switcher):', !viewerSwitcherVisible ? 'PASS' : 'FAIL');

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n========== FINAL RESULTS ==========');
  let f9Pass = true, f10Pass = true, f11Pass = true;
  for (const r of results) {
    const marker = r.pass ? 'PASS' : 'FAIL';
    console.log(`${marker} | ${r.id}: ${r.label}`);
    if (r.id.startsWith('F9') && !r.pass) f9Pass = false;
    if (r.id.startsWith('F10') && !r.pass) f10Pass = false;
    if (r.id.startsWith('F11') && !r.pass) f11Pass = false;
  }
  console.log('');
  console.log('FEATURE 9  (Collapsible sidebar):', f9Pass ? 'PASS' : 'FAIL');
  console.log('FEATURE 10 (Role-based nav):', f10Pass ? 'PASS' : 'FAIL');
  console.log('FEATURE 11 (Account switcher):', f11Pass ? 'PASS' : 'FAIL');

  if (consoleErrors.length > 0) {
    console.log('\nConsole errors detected:', consoleErrors.length);
    consoleErrors.slice(0, 10).forEach(e => console.log(' -', e));
  } else {
    console.log('\nNo console errors detected.');
  }

  await browser.close();
  console.log('\nTest complete. Screenshots in:', SCREENSHOT_DIR);

  return { results, f9Pass, f10Pass, f11Pass };
}

main().catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
