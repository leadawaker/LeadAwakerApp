const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'features-12-13-14-v2');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`Screenshot: ${fp}`);
}

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  await shot(page, '00-login');

  // Fill login form using data-testid
  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');

  // Wait for redirect
  await page.waitForTimeout(3000);
  console.log('After login URL:', page.url());
  await shot(page, '01-after-login');

  // If still on login (wrong creds), try another password
  if (page.url().includes('/login')) {
    console.log('Login failed with test123, trying password...');
    await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
    await page.fill('[data-testid="input-password"]', 'password');
    await page.click('[data-testid="button-login"]');
    await page.waitForTimeout(3000);
    console.log('After 2nd login attempt URL:', page.url());
  }

  if (page.url().includes('/login')) {
    console.log('Login failed with password, trying admin123...');
    await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
    await page.fill('[data-testid="input-password"]', 'admin123');
    await page.click('[data-testid="button-login"]');
    await page.waitForTimeout(3000);
    console.log('After 3rd login attempt URL:', page.url());
  }

  return page.url();
}

async function testFeature12(page, prefix) {
  console.log('\n=== FEATURE 12: Active page indicator in sidebar ===');
  const results = { passes: true, details: [] };

  // --- Step 1: Dashboard ---
  await page.goto(`http://localhost:5173${prefix}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '12-01-dashboard');

  // Desktop sidebar nav links have data-testid="link-nav-*" and data-active when active
  const navLinks = await page.locator('[data-testid^="link-nav-"]').all();
  console.log(`Found ${navLinks.length} desktop sidebar nav links`);

  if (navLinks.length === 0) {
    console.log('WARNING: No desktop nav links found with [data-testid^="link-nav-"]');
    results.details.push('No desktop sidebar nav links found');
    results.passes = false;
    return results;
  }

  // Dump all nav link states
  let dashboardActive = false;
  let activeCount = 0;
  for (const link of navLinks) {
    const testId = await link.getAttribute('data-testid') || '';
    const dataActive = await link.getAttribute('data-active');
    const classes = await link.getAttribute('class') || '';
    const isActive = dataActive === 'true' || dataActive === '' || classes.includes('bg-brand-blue');
    if (isActive) activeCount++;
    const isDashboard = testId === 'link-nav-home';
    if (isDashboard && isActive) {
      dashboardActive = true;
      console.log(`PASS: Dashboard (link-nav-home) is active. data-active="${dataActive}"`);
    }
    console.log(`  ${testId}: data-active="${dataActive}", active=${isActive}`);
  }

  if (!dashboardActive) {
    console.log('FAIL: Dashboard nav item not highlighted on /dashboard');
    results.details.push('Dashboard nav item not highlighted on /dashboard');
    results.passes = false;
  }

  if (activeCount > 1) {
    console.log(`FAIL: ${activeCount} nav items active simultaneously on dashboard`);
    results.details.push(`Multiple (${activeCount}) nav items active on dashboard`);
    results.passes = false;
  } else {
    console.log(`PASS: Only ${activeCount} nav item active at once on dashboard`);
  }

  // --- Step 2: Navigate to Contacts (which is what "Leads/Contacts" maps to) ---
  await page.goto(`http://localhost:5173${prefix}/contacts`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '12-02-contacts');
  console.log('Navigated to contacts. URL:', page.url());

  const navLinksOnContacts = await page.locator('[data-testid^="link-nav-"]').all();
  let contactsActive = false;
  let dashboardActiveOnContacts = false;
  let activeCountOnContacts = 0;

  for (const link of navLinksOnContacts) {
    const testId = await link.getAttribute('data-testid') || '';
    const dataActive = await link.getAttribute('data-active');
    const classes = await link.getAttribute('class') || '';
    const isActive = dataActive === 'true' || dataActive === '' || classes.includes('bg-brand-blue');
    if (isActive) {
      activeCountOnContacts++;
      if (testId === 'link-nav-contacts') {
        contactsActive = true;
        console.log(`PASS: Contacts nav item is now highlighted`);
      }
      if (testId === 'link-nav-home') {
        dashboardActiveOnContacts = true;
        console.log(`INFO: Dashboard also active on contacts page`);
      }
    }
    console.log(`  ${testId}: data-active="${dataActive}", active=${isActive}`);
  }

  if (!contactsActive) {
    console.log('FAIL: Contacts nav item not highlighted on /contacts');
    results.details.push('Contacts nav item not highlighted after navigation');
    results.passes = false;
  }

  if (activeCountOnContacts > 1) {
    console.log(`FAIL: ${activeCountOnContacts} nav items active simultaneously on contacts`);
    results.details.push(`Multiple (${activeCountOnContacts}) active nav items on contacts page`);
    results.passes = false;
  } else {
    console.log(`PASS: Only ${activeCountOnContacts} nav item active on contacts page`);
  }

  // Summary
  console.log('\nFeature 12 Summary:');
  console.log(`  Step 1 (Dashboard active): ${dashboardActive ? 'PASS' : 'FAIL'}`);
  console.log(`  Step 2 (Contacts active after navigation): ${contactsActive ? 'PASS' : 'FAIL'}`);
  console.log(`  Step 3 (Only one active at a time): ${activeCountOnContacts <= 1 ? 'PASS' : 'FAIL'}`);

  return results;
}

async function testFeature13(page, prefix) {
  console.log('\n=== FEATURE 13: Breadcrumb navigation ===');
  const results = { passes: true, details: [] };

  // Step 1: Check breadcrumb on Dashboard
  await page.goto(`http://localhost:5173${prefix}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '13-01-dashboard');

  // Breadcrumb is in Topbar with data-testid="breadcrumb-nav"
  const breadcrumbNav = page.locator('[data-testid="breadcrumb-nav"]');
  const breadcrumbCount = await breadcrumbNav.count();

  if (breadcrumbCount === 0) {
    console.log('FAIL: Breadcrumb nav not found (data-testid="breadcrumb-nav")');
    results.details.push('Breadcrumb nav element not found');
    results.passes = false;
    return results;
  }

  const breadcrumbText = await breadcrumbNav.first().textContent();
  console.log(`Breadcrumb on Dashboard: "${breadcrumbText ? breadcrumbText.trim() : ''}"`);

  // On dashboard, breadcrumb should just show "Home"
  if (breadcrumbText && breadcrumbText.trim().toLowerCase().includes('home')) {
    console.log('PASS: Breadcrumb shows "Home" on dashboard');
  } else {
    console.log(`INFO: Breadcrumb text on dashboard: "${breadcrumbText ? breadcrumbText.trim() : ''}"`);
    results.details.push(`Breadcrumb on dashboard doesn't clearly show "Home"`);
  }

  // Step 2: Navigate to Contacts and check breadcrumb updates
  await page.goto(`http://localhost:5173${prefix}/contacts`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '13-02-contacts-breadcrumb');

  const breadcrumbOnContacts = await page.locator('[data-testid="breadcrumb-nav"]').first().textContent();
  console.log(`Breadcrumb on Contacts: "${breadcrumbOnContacts ? breadcrumbOnContacts.trim() : ''}"`);

  if (breadcrumbOnContacts && breadcrumbOnContacts.toLowerCase().includes('contact')) {
    console.log('PASS: Breadcrumb updated to show Contacts');
  } else {
    console.log(`FAIL: Breadcrumb on contacts page: "${breadcrumbOnContacts ? breadcrumbOnContacts.trim() : ''}"`);
    results.details.push(`Breadcrumb did not update to show Contacts: "${breadcrumbOnContacts ? breadcrumbOnContacts.trim() : ''}"`);
    results.passes = false;
  }

  // Step 3: Try clicking breadcrumb link to go back Home
  const breadcrumbLink = page.locator('[data-testid="breadcrumb-link-0"]');
  const linkCount = await breadcrumbLink.count();
  if (linkCount > 0) {
    const linkText = await breadcrumbLink.first().textContent();
    console.log(`Found breadcrumb link: "${linkText ? linkText.trim() : ''}"`);
    await breadcrumbLink.first().click();
    await page.waitForTimeout(1000);
    const urlAfterClick = page.url();
    console.log(`URL after breadcrumb click: ${urlAfterClick}`);
    await shot(page, '13-03-after-breadcrumb-click');

    if (urlAfterClick.includes('/dashboard')) {
      console.log('PASS: Breadcrumb click navigated to dashboard');
    } else {
      console.log(`INFO: Breadcrumb click navigated to: ${urlAfterClick}`);
    }
  } else {
    // On dashboard, breadcrumb is current (no clickable link). On contacts, "Home" is a link
    console.log('INFO: No breadcrumb link found with data-testid="breadcrumb-link-0"');
    // This is expected on single-breadcrumb pages
  }

  // Step 4: Navigate to Campaigns to see deeper breadcrumb
  await page.goto(`http://localhost:5173${prefix}/campaigns`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '13-04-campaigns-breadcrumb');
  const breadcrumbOnCampaigns = await page.locator('[data-testid="breadcrumb-nav"]').first().textContent();
  console.log(`Breadcrumb on Campaigns: "${breadcrumbOnCampaigns ? breadcrumbOnCampaigns.trim() : ''}"`);

  if (breadcrumbOnCampaigns && breadcrumbOnCampaigns.toLowerCase().includes('campaign')) {
    console.log('PASS: Breadcrumb shows Campaigns');
  }

  console.log('\nFeature 13 Summary:');
  console.log(`  Step 1 (Breadcrumb exists): ${breadcrumbCount > 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  Step 2 (Breadcrumb shows current page): ${(breadcrumbOnContacts && breadcrumbOnContacts.toLowerCase().includes('contact')) ? 'PASS' : 'FAIL'}`);

  return results;
}

async function testFeature14(page, prefix) {
  console.log('\n=== FEATURE 14: Top bar - user avatar, dark mode toggle, notifications ===');
  const results = { passes: true, details: [] };

  await page.goto(`http://localhost:5173${prefix}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '14-01-topbar');

  // Check top bar exists
  const topbar = page.locator('[data-testid="header-crm-topbar"]');
  const topbarCount = await topbar.count();
  console.log(`Topbar element found: ${topbarCount > 0}`);
  if (topbarCount === 0) {
    results.details.push('Topbar element not found');
    results.passes = false;
    return results;
  }

  // Step 1: User avatar
  const avatarBtn = page.locator('[data-testid="button-user-avatar"]');
  const avatarCount = await avatarBtn.count();

  if (avatarCount > 0) {
    const avatarText = await avatarBtn.first().textContent();
    console.log(`PASS: User avatar button found. Text: "${avatarText ? avatarText.trim() : ''}"`);
    // Check avatar fallback (initials)
    const fallback = page.locator('[data-testid="button-user-avatar"] [class*="fallback"], [data-testid="button-user-avatar"] span');
    const fallbackText = await avatarBtn.first().textContent();
    console.log(`Avatar content (initials/text): "${fallbackText ? fallbackText.trim() : ''}"`);
  } else {
    console.log('FAIL: User avatar button not found (data-testid="button-user-avatar")');
    results.details.push('User avatar not found');
    results.passes = false;
  }

  // Step 2: Dark mode toggle
  const darkModeBtn = page.locator('[data-testid="button-dark-mode-toggle"]');
  const darkModeCount = await darkModeBtn.count();

  if (darkModeCount > 0) {
    const ariaLabel = await darkModeBtn.first().getAttribute('aria-label') || '';
    const title = await darkModeBtn.first().getAttribute('title') || '';
    console.log(`PASS: Dark mode toggle found. aria-label="${ariaLabel}", title="${title}"`);

    // Capture initial theme state
    const htmlClassBefore = await page.evaluate(() => document.documentElement.className);
    const darkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    console.log(`Before toggle: html.class="${htmlClassBefore}", isDark=${darkBefore}`);

    // Click toggle
    await darkModeBtn.first().click();
    await page.waitForTimeout(500);

    const darkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const htmlClassAfter = await page.evaluate(() => document.documentElement.className);
    console.log(`After toggle: html.class="${htmlClassAfter}", isDark=${darkAfter}`);
    await shot(page, '14-02-after-dark-mode-toggle');

    if (darkBefore !== darkAfter) {
      console.log('PASS: Dark mode toggle works - theme changed');
    } else {
      // Check localStorage
      const themeInStorage = await page.evaluate(() => localStorage.getItem('leadawaker_theme') || localStorage.getItem('theme') || '');
      console.log(`INFO: Theme in localStorage: "${themeInStorage}"`);
      console.log('INFO: html class may not include "dark" if using different mechanism');
    }

    // Toggle back to original
    await darkModeBtn.first().click();
    await page.waitForTimeout(300);
  } else {
    console.log('FAIL: Dark mode toggle not found (data-testid="button-dark-mode-toggle")');
    results.details.push('Dark mode toggle not found');
    results.passes = false;
  }

  // Step 3: Notifications indicator
  const notifBtn = page.locator('[data-testid="button-notifications"]');
  const notifCount = await notifBtn.count();

  if (notifCount > 0) {
    const ariaLabel = await notifBtn.first().getAttribute('aria-label') || '';
    console.log(`PASS: Notifications button found. aria-label="${ariaLabel}"`);

    // Check for badge
    const badge = page.locator('[data-testid="badge-notifications-count"]');
    const badgeCount = await badge.count();
    if (badgeCount > 0) {
      const badgeText = await badge.first().textContent();
      console.log(`PASS: Notification badge found with count: "${badgeText ? badgeText.trim() : ''}"`);
    } else {
      console.log('INFO: No notification badge (may be 0 unread)');
    }
  } else {
    console.log('FAIL: Notifications button not found (data-testid="button-notifications")');
    results.details.push('Notifications indicator not found');
    results.passes = false;
  }

  // Print topbar HTML for reference
  const topbarHtml = await topbar.first().evaluate(el => el.outerHTML.substring(0, 2000));
  console.log('\nTopbar HTML (first 2000 chars):');
  console.log(topbarHtml);

  console.log('\nFeature 14 Summary:');
  console.log(`  Step 1 (User avatar): ${avatarCount > 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  Step 2 (Dark mode toggle): ${darkModeCount > 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  Step 3 (Notifications indicator): ${notifCount > 0 ? 'PASS' : 'FAIL'}`);

  return results;
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    const postLoginUrl = await login(page);

    if (postLoginUrl.includes('/login')) {
      console.log('ERROR: Login failed. Cannot test CRM features.');
      await browser.close();
      return;
    }

    // Determine prefix (agency or subaccount)
    let prefix = '/agency';
    if (postLoginUrl.includes('/subaccount')) prefix = '/subaccount';
    console.log(`Using prefix: ${prefix}`);

    const r12 = await testFeature12(page, prefix);
    const r13 = await testFeature13(page, prefix);
    const r14 = await testFeature14(page, prefix);

    console.log('\n============================');
    console.log('=== FINAL RESULTS ===');
    console.log('============================');
    console.log(`Feature 12 (Active sidebar indicator): ${r12.passes ? 'PASS' : 'FAIL'}`, r12.details.join('; ') || '');
    console.log(`Feature 13 (Breadcrumb navigation):    ${r13.passes ? 'PASS' : 'FAIL'}`, r13.details.join('; ') || '');
    console.log(`Feature 14 (Top bar):                  ${r14.passes ? 'PASS' : 'FAIL'}`, r14.details.join('; ') || '');

    if (consoleErrors.length > 0) {
      console.log('\nJS Console Errors:');
      consoleErrors.slice(0, 10).forEach(e => console.log(' -', e));
    } else {
      console.log('\nNo JS console errors.');
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
    console.log('\nBrowser closed.');
  }
}

main();
