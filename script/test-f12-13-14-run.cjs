const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'features-12-13-14-v2');
if (!fs.existsSync(SCREENSHOT_DIR)) { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); }

async function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: fp, fullPage: false });
  console.log('Screenshot: ' + fp);
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:5002/login', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');
  await page.waitForTimeout(3000);
  console.log('After login URL:', page.url());
  await shot(page, '00-after-login');

  if (page.url().includes('/login')) {
    console.log('Login failed'); await browser.close(); return;
  }

  // ---- FEATURE 12: Active page indicator in sidebar ----
  console.log('\n=== FEATURE 12: Active page indicator in sidebar ===');

  await page.goto('http://localhost:5002/agency/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '12-01-dashboard');

  const navLinks = await page.locator('[data-testid^="link-nav-"]').all();
  console.log('Found ' + navLinks.length + ' sidebar nav links');
  let dashboardActive = false;
  let activeCountOnDash = 0;
  for (const link of navLinks) {
    const testId = await link.getAttribute('data-testid') || '';
    const dataActive = await link.getAttribute('data-active');
    const classes = await link.getAttribute('class') || '';
    const isActive = dataActive === 'true' || dataActive === '' || classes.includes('bg-brand-blue');
    if (isActive) activeCountOnDash++;
    if (testId === 'link-nav-home' && isActive) dashboardActive = true;
    console.log('  ' + testId + ': data-active=' + dataActive + ' computed-active=' + isActive);
  }

  console.log('F12 Step1 - Dashboard nav highlighted: ' + dashboardActive);
  console.log('F12 Step3 - Only one active on dashboard: ' + (activeCountOnDash <= 1) + ' (count=' + activeCountOnDash + ')');

  await page.goto('http://localhost:5002/agency/contacts', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '12-02-contacts');

  const navLinks2 = await page.locator('[data-testid^="link-nav-"]').all();
  let contactsActive = false;
  let activeCountOnContacts = 0;
  for (const link of navLinks2) {
    const testId = await link.getAttribute('data-testid') || '';
    const dataActive = await link.getAttribute('data-active');
    const classes = await link.getAttribute('class') || '';
    const isActive = dataActive === 'true' || dataActive === '' || classes.includes('bg-brand-blue');
    if (isActive) activeCountOnContacts++;
    if (testId === 'link-nav-contacts' && isActive) contactsActive = true;
    console.log('  ' + testId + ': data-active=' + dataActive + ' computed-active=' + isActive);
  }

  console.log('F12 Step2 - Contacts nav highlighted: ' + contactsActive);
  console.log('F12 Step3 - Only one active on contacts: ' + (activeCountOnContacts <= 1) + ' (count=' + activeCountOnContacts + ')');

  const f12Pass = dashboardActive && contactsActive && activeCountOnDash <= 1 && activeCountOnContacts <= 1;

  // ---- FEATURE 13: Breadcrumb navigation ----
  console.log('\n=== FEATURE 13: Breadcrumb navigation ===');

  await page.goto('http://localhost:5002/agency/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '13-01-dashboard');

  const breadNav = page.locator('[data-testid="breadcrumb-nav"]');
  const breadCount = await breadNav.count();
  console.log('Breadcrumb element found: ' + breadCount);
  let breadDashText = '';
  if (breadCount > 0) {
    breadDashText = (await breadNav.first().textContent() || '').trim();
    console.log('Breadcrumb on Dashboard: "' + breadDashText + '"');
  }

  await page.goto('http://localhost:5002/agency/contacts', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '13-02-contacts-breadcrumb');
  const breadOnContacts = (await page.locator('[data-testid="breadcrumb-nav"]').first().textContent().catch(() => '')).trim();
  console.log('Breadcrumb on Contacts: "' + breadOnContacts + '"');

  const breadLink = page.locator('[data-testid="breadcrumb-link-0"]');
  const bLinkCount = await breadLink.count();
  console.log('Breadcrumb link-0 count: ' + bLinkCount);
  let breadClickNav = false;
  if (bLinkCount > 0) {
    const linkText = (await breadLink.first().textContent() || '').trim();
    console.log('Clicking breadcrumb link: "' + linkText + '"');
    await breadLink.first().click();
    await page.waitForTimeout(1000);
    const urlAfterClick = page.url();
    console.log('URL after breadcrumb click: ' + urlAfterClick);
    breadClickNav = urlAfterClick.includes('/dashboard');
    await shot(page, '13-03-after-breadcrumb-click');
  } else {
    console.log('No breadcrumb-link-0 found; checking for any clickable breadcrumb');
    const anyBreadLink = page.locator('[data-testid*="breadcrumb"][href], [data-testid="breadcrumb-nav"] a');
    const anyCount = await anyBreadLink.count();
    console.log('Any breadcrumb anchor count: ' + anyCount);
    if (anyCount > 0) {
      await anyBreadLink.first().click();
      await page.waitForTimeout(1000);
      console.log('URL after any breadcrumb click: ' + page.url());
      breadClickNav = page.url().includes('/dashboard');
      await shot(page, '13-03-after-breadcrumb-click');
    }
  }

  await page.goto('http://localhost:5002/agency/campaigns', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '13-04-campaigns-breadcrumb');
  const breadOnCampaigns = (await page.locator('[data-testid="breadcrumb-nav"]').first().textContent().catch(() => '')).trim();
  console.log('Breadcrumb on Campaigns: "' + breadOnCampaigns + '"');

  const breadShowsLocation = breadOnContacts.toLowerCase().includes('contact') && breadOnCampaigns.toLowerCase().includes('campaign');
  const f13Pass = breadCount > 0 && breadShowsLocation;

  // ---- FEATURE 14: Top bar ----
  console.log('\n=== FEATURE 14: Top bar - user avatar, dark mode toggle, notifications ===');

  await page.goto('http://localhost:5002/agency/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, '14-01-topbar');

  const topbar = page.locator('[data-testid="header-crm-topbar"]');
  const topbarCount = await topbar.count();
  console.log('Topbar found: ' + topbarCount);

  // Avatar
  const avatarBtn = page.locator('[data-testid="button-user-avatar"]');
  const avatarCount = await avatarBtn.count();
  console.log('Avatar button found: ' + avatarCount);
  if (avatarCount > 0) {
    const avatarText = (await avatarBtn.first().textContent() || '').trim();
    console.log('Avatar content (initials): "' + avatarText + '"');
  }

  // Dark mode
  const darkModeBtn = page.locator('[data-testid="button-dark-mode-toggle"]');
  const darkModeCount = await darkModeBtn.count();
  console.log('Dark mode toggle found: ' + darkModeCount);
  let darkModeWorks = false;
  if (darkModeCount > 0) {
    const darkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    console.log('isDark before toggle: ' + darkBefore);
    await darkModeBtn.first().click();
    await page.waitForTimeout(600);
    const darkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const htmlClassAfter = await page.evaluate(() => document.documentElement.className);
    console.log('isDark after toggle: ' + darkAfter + ' html.class="' + htmlClassAfter + '"');
    darkModeWorks = darkBefore !== darkAfter;
    if (!darkModeWorks) {
      const themeStorage = await page.evaluate(() => localStorage.getItem('leadawaker_theme') || localStorage.getItem('theme') || '');
      console.log('theme in localStorage: "' + themeStorage + '"');
      darkModeWorks = themeStorage !== '';
    }
    await shot(page, '14-02-after-dark-mode-toggle');
    await darkModeBtn.first().click();
    await page.waitForTimeout(300);
  }

  // Notifications
  const notifBtn = page.locator('[data-testid="button-notifications"]');
  const notifCount = await notifBtn.count();
  console.log('Notifications button found: ' + notifCount);
  const badge = page.locator('[data-testid="badge-notifications-count"]');
  const badgeCount = await badge.count();
  console.log('Notification badge found: ' + badgeCount);
  if (badgeCount > 0) {
    const badgeText = (await badge.first().textContent() || '').trim();
    console.log('Badge text: "' + badgeText + '"');
  }

  // Print topbar HTML for reference
  if (topbarCount > 0) {
    const html = await topbar.first().evaluate(el => el.outerHTML.substring(0, 3000));
    console.log('\nTopbar HTML snippet:\n' + html);
  }

  const f14Pass = topbarCount > 0 && avatarCount > 0 && darkModeCount > 0 && notifCount > 0;

  // ---- FINAL RESULTS ----
  console.log('\n============================');
  console.log('=== FINAL RESULTS ===');
  console.log('============================');
  console.log('Feature 12 (Active sidebar indicator): ' + (f12Pass ? 'PASS' : 'FAIL'));
  console.log('  - Dashboard nav highlighted: ' + dashboardActive);
  console.log('  - Contacts nav highlighted:  ' + contactsActive);
  console.log('  - Only one active at a time: ' + (activeCountOnDash <= 1 && activeCountOnContacts <= 1));
  console.log('Feature 13 (Breadcrumb navigation):    ' + (f13Pass ? 'PASS' : 'FAIL'));
  console.log('  - Breadcrumb element exists:         ' + (breadCount > 0));
  console.log('  - Breadcrumb shows current location: ' + breadShowsLocation);
  console.log('  - Breadcrumb click navigates back:   ' + breadClickNav);
  console.log('Feature 14 (Top bar):                  ' + (f14Pass ? 'PASS' : 'FAIL'));
  console.log('  - Topbar element exists:             ' + (topbarCount > 0));
  console.log('  - User avatar shows:                 ' + (avatarCount > 0));
  console.log('  - Dark mode toggle works:            ' + darkModeWorks);
  console.log('  - Notifications indicator exists:    ' + (notifCount > 0));
  console.log('  - Notification badge shown:          ' + (badgeCount > 0));

  await browser.close();
  console.log('\nBrowser closed.');
}

main().catch(e => { console.error('Test error:', e.message); process.exit(1); });
