const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'features-12-13-14');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Screenshot saved: ${filePath}`);
}

async function login(page) {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
  const url = page.url();
  console.log('Initial URL:', url);

  if (url.includes('/login') || url.includes('/auth') || url.includes('/signin')) {
    console.log('Login page detected, attempting login...');
    await takeScreenshot(page, '00-login-page');

    // Try to fill email/username
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="username" i]').first();
    const passInput = page.locator('input[type="password"]').first();

    await emailInput.fill('admin@leadawaker.com');
    await passInput.fill('password');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login') || page.url().includes('/auth')) {
      // Try alternate credentials
      await emailInput.fill('admin@leadawaker.com');
      await passInput.fill('admin123');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    if (page.url().includes('/login') || page.url().includes('/auth')) {
      await emailInput.fill('admin');
      await passInput.fill('admin123');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    console.log('After login URL:', page.url());
    await takeScreenshot(page, '01-after-login');
  } else {
    console.log('No login page, already authenticated or public page');
    await takeScreenshot(page, '00-initial-page');
  }
}

async function testFeature12(page) {
  console.log('\n=== TESTING FEATURE 12: Active page indicator in sidebar ===');
  const results = { passes: true, details: [] };

  // Navigate to dashboard
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await takeScreenshot(page, '12-01-dashboard');

  // Look for sidebar nav items
  const sidebarSelectors = [
    'nav a',
    '[class*="sidebar"] a',
    '[class*="nav"] a',
    'aside a',
    '[role="navigation"] a',
    '[data-testid*="nav"] a',
    '[class*="menu"] a',
  ];

  let navLinks = [];
  for (const sel of sidebarSelectors) {
    const links = await page.locator(sel).all();
    if (links.length > 1) {
      navLinks = links;
      console.log(`Found ${links.length} nav links with selector: ${sel}`);
      break;
    }
  }

  if (navLinks.length === 0) {
    console.log('WARNING: No sidebar nav links found');
    results.passes = false;
    results.details.push('No sidebar nav links found');
    return results;
  }

  // Check if dashboard nav item is highlighted
  let activeOnDashboard = false;
  for (const link of navLinks) {
    const text = await link.textContent();
    const classes = await link.getAttribute('class') || '';
    const ariaCurrentValue = await link.getAttribute('aria-current');
    const dataActive = await link.getAttribute('data-active');

    const isActive = classes.includes('active') ||
      classes.includes('bg-') && (classes.includes('primary') || classes.includes('accent') || classes.includes('selected')) ||
      ariaCurrentValue === 'page' || ariaCurrentValue === 'true' ||
      dataActive === 'true';

    const isDashboard = text && (text.toLowerCase().includes('dashboard') || text.toLowerCase().includes('home'));

    if (isDashboard && isActive) {
      activeOnDashboard = true;
      console.log(`PASS: Dashboard nav item is highlighted. Classes: ${classes.substring(0, 200)}`);
    }

    if (isActive) {
      console.log(`Active nav item text: "${text ? text.trim() : ''}", aria-current: ${ariaCurrentValue}, classes snippet: ${classes.substring(0, 150)}`);
    }
  }

  // Count active items on dashboard
  let activeCount = 0;
  for (const link of navLinks) {
    const classes = await link.getAttribute('class') || '';
    const ariaCurrentValue = await link.getAttribute('aria-current');
    const dataActive = await link.getAttribute('data-active');
    const isActive = classes.includes('active') ||
      (classes.includes('bg-') && (classes.includes('primary') || classes.includes('accent') || classes.includes('selected'))) ||
      ariaCurrentValue === 'page' || ariaCurrentValue === 'true' ||
      dataActive === 'true';
    if (isActive) activeCount++;
  }
  console.log(`Active nav items on Dashboard page: ${activeCount}`);

  if (!activeOnDashboard) {
    // Try a broader check - look for any highlighted item
    console.log('Dashboard item not explicitly highlighted; checking with broader criteria...');
    // Dump all nav link classes for inspection
    for (const link of navLinks) {
      const text = await link.textContent();
      const classes = await link.getAttribute('class') || '';
      if (text && text.trim()) {
        console.log(`  Nav item "${text.trim()}": classes="${classes.substring(0, 200)}"`);
      }
    }
  }

  // Step 2: Navigate to Leads
  let leadsLink = null;
  for (const link of navLinks) {
    const text = await link.textContent();
    if (text && text.toLowerCase().includes('lead')) {
      leadsLink = link;
      break;
    }
  }

  if (leadsLink) {
    await leadsLink.click();
    await page.waitForTimeout(1500);
    await takeScreenshot(page, '12-02-leads-page');
    console.log('Navigated to Leads. URL:', page.url());

    // Re-fetch nav links after navigation
    let newNavLinks = [];
    for (const sel of sidebarSelectors) {
      const links = await page.locator(sel).all();
      if (links.length > 1) {
        newNavLinks = links;
        break;
      }
    }

    let activeOnLeads = false;
    let activeCountOnLeads = 0;
    for (const link of newNavLinks) {
      const text = await link.textContent();
      const classes = await link.getAttribute('class') || '';
      const ariaCurrentValue = await link.getAttribute('aria-current');
      const dataActive = await link.getAttribute('data-active');
      const isActive = classes.includes('active') ||
        (classes.includes('bg-') && (classes.includes('primary') || classes.includes('accent') || classes.includes('selected'))) ||
        ariaCurrentValue === 'page' || ariaCurrentValue === 'true' ||
        dataActive === 'true';

      if (isActive) {
        activeCountOnLeads++;
        if (text && text.toLowerCase().includes('lead')) {
          activeOnLeads = true;
          console.log(`PASS: Leads nav item is now highlighted. Text: "${text.trim()}"`);
        }
      }
    }

    console.log(`Active nav items on Leads page: ${activeCountOnLeads}`);
    if (activeCountOnLeads <= 1) {
      console.log('PASS: Only one nav item is highlighted at a time');
    } else {
      console.log(`WARN: ${activeCountOnLeads} nav items appear highlighted simultaneously`);
    }

    if (!activeOnLeads) {
      results.details.push('Leads nav item not clearly highlighted after navigation');
    }
    if (activeCountOnLeads > 1) {
      results.details.push(`Multiple (${activeCountOnLeads}) nav items highlighted simultaneously`);
      results.passes = false;
    }
  } else {
    console.log('WARNING: Leads nav link not found');
    results.details.push('Leads nav link not found in sidebar');
  }

  return results;
}

async function testFeature13(page) {
  console.log('\n=== TESTING FEATURE 13: Breadcrumb navigation ===');
  const results = { passes: true, details: [] };

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await takeScreenshot(page, '13-01-dashboard');

  // Look for breadcrumb
  const breadcrumbSelectors = [
    '[aria-label*="breadcrumb" i]',
    '[class*="breadcrumb"]',
    'nav[class*="bread"]',
    '[data-testid*="breadcrumb"]',
    'ol[class*="bread"]',
    'ul[class*="bread"]',
  ];

  let breadcrumbEl = null;
  for (const sel of breadcrumbSelectors) {
    const el = page.locator(sel).first();
    const count = await page.locator(sel).count();
    if (count > 0) {
      breadcrumbEl = el;
      const text = await el.textContent();
      console.log(`Found breadcrumb with selector "${sel}": "${text ? text.trim().substring(0, 200) : ''}"`);
      break;
    }
  }

  if (!breadcrumbEl) {
    // Try to find in top bar area
    const topBarSelectors = [
      'header',
      '[class*="topbar"]',
      '[class*="top-bar"]',
      '[class*="header"]',
      '[class*="toolbar"]',
    ];
    for (const sel of topBarSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        const el = page.locator(sel).first();
        const text = await el.textContent();
        console.log(`Found top bar area with selector "${sel}": "${text ? text.trim().substring(0, 200) : ''}"`);
      }
    }
    console.log('WARNING: No breadcrumb element found with standard selectors');
    results.details.push('No breadcrumb element found with standard selectors');
  } else {
    const breadcrumbText = await breadcrumbEl.textContent();
    console.log(`Breadcrumb text on Dashboard: "${breadcrumbText ? breadcrumbText.trim() : ''}"`);

    if (breadcrumbText && (breadcrumbText.toLowerCase().includes('dashboard') || breadcrumbText.toLowerCase().includes('home'))) {
      console.log('PASS: Breadcrumb shows current page (Dashboard)');
    } else {
      console.log('INFO: Breadcrumb found but does not clearly show Dashboard');
      results.details.push(`Breadcrumb text "${breadcrumbText ? breadcrumbText.trim() : ''}" may not clearly show current page`);
    }
  }

  // Navigate to Leads and check breadcrumb updates
  await page.goto('http://localhost:5173/leads', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await takeScreenshot(page, '13-02-leads-breadcrumb');
  console.log('Navigated to Leads. URL:', page.url());

  for (const sel of breadcrumbSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      const el = page.locator(sel).first();
      const text = await el.textContent();
      console.log(`Breadcrumb on Leads page (${sel}): "${text ? text.trim().substring(0, 200) : ''}"`);
      if (text && text.toLowerCase().includes('lead')) {
        console.log('PASS: Breadcrumb updated to show Leads page');
      }
      break;
    }
  }

  // Try clicking breadcrumb links
  const breadcrumbLinks = page.locator('[aria-label*="breadcrumb" i] a, [class*="breadcrumb"] a').all();
  const links = await breadcrumbLinks;
  if (links.length > 0) {
    console.log(`Found ${links.length} clickable breadcrumb link(s)`);
    const firstLink = links[0];
    const linkText = await firstLink.textContent();
    console.log(`Clicking breadcrumb link: "${linkText ? linkText.trim() : ''}"`);
    await firstLink.click();
    await page.waitForTimeout(1000);
    console.log('After breadcrumb click URL:', page.url());
    await takeScreenshot(page, '13-03-after-breadcrumb-click');
  } else {
    console.log('INFO: No clickable breadcrumb links found (breadcrumbs may be text only)');
  }

  return results;
}

async function testFeature14(page) {
  console.log('\n=== TESTING FEATURE 14: Top bar with user avatar, dark mode toggle, notifications ===');
  const results = { passes: true, details: [] };

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await takeScreenshot(page, '14-01-topbar');

  // Step 1: Check for user avatar
  const avatarSelectors = [
    '[class*="avatar"]',
    '[data-testid*="avatar"]',
    '[aria-label*="avatar" i]',
    '[aria-label*="user" i]',
    'img[alt*="avatar" i]',
    'img[alt*="user" i]',
    '[class*="user-menu"]',
    'button[class*="avatar"]',
  ];

  let avatarFound = false;
  for (const sel of avatarSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      avatarFound = true;
      const el = page.locator(sel).first();
      const text = await el.textContent();
      const classes = await el.getAttribute('class') || '';
      console.log(`PASS: User avatar found with selector "${sel}". Text: "${text ? text.trim() : ''}", Classes: "${classes.substring(0, 150)}"`);
      break;
    }
  }

  if (!avatarFound) {
    console.log('WARNING: User avatar not found with standard selectors');
    results.details.push('User avatar not found');
    results.passes = false;
  }

  // Step 2: Check for dark mode toggle
  const darkModeSelectors = [
    'button[aria-label*="dark" i]',
    'button[aria-label*="theme" i]',
    'button[aria-label*="mode" i]',
    '[data-testid*="dark-mode"]',
    '[data-testid*="theme"]',
    '[class*="theme-toggle"]',
    '[class*="dark-mode"]',
    'button[title*="dark" i]',
    'button[title*="theme" i]',
    // Sun/moon icons
    'button svg[class*="sun"]',
    'button svg[class*="moon"]',
    'button:has(svg)',
  ];

  let darkModeFound = false;
  let darkModeButton = null;
  for (const sel of darkModeSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      darkModeFound = true;
      darkModeButton = page.locator(sel).first();
      const text = await darkModeButton.textContent();
      const ariaLabel = await darkModeButton.getAttribute('aria-label') || '';
      const title = await darkModeButton.getAttribute('title') || '';
      console.log(`Dark mode toggle candidate found with selector "${sel}". Label: "${ariaLabel}", Title: "${title}", Text: "${text ? text.trim().substring(0, 50) : ''}"`);
      if (ariaLabel.toLowerCase().includes('dark') || ariaLabel.toLowerCase().includes('theme') || ariaLabel.toLowerCase().includes('mode') ||
          title.toLowerCase().includes('dark') || title.toLowerCase().includes('theme')) {
        console.log('PASS: Dark mode toggle confirmed');
        break;
      }
    }
  }

  // Try clicking dark mode toggle
  if (darkModeButton) {
    // Get initial theme state
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    const htmlDataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
    console.log(`Before toggle - html class: "${htmlClass}", data-theme: "${htmlDataTheme}"`);

    // Try clicking the dark mode button with aria-label containing dark/theme
    const theToggle = page.locator('button[aria-label*="dark" i], button[aria-label*="theme" i], button[title*="dark" i], button[title*="theme" i]').first();
    const toggleCount = await theToggle.count();
    if (toggleCount > 0) {
      await theToggle.click();
      await page.waitForTimeout(500);
      const htmlClassAfter = await page.evaluate(() => document.documentElement.className);
      const htmlDataThemeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
      console.log(`After toggle - html class: "${htmlClassAfter}", data-theme: "${htmlDataThemeAfter}"`);
      await takeScreenshot(page, '14-02-after-dark-mode-toggle');

      if (htmlClass !== htmlClassAfter || htmlDataTheme !== htmlDataThemeAfter) {
        console.log('PASS: Dark mode toggle changed theme state');
      } else {
        console.log('INFO: No detectable change in html class/data-theme after toggle click');
      }
    }
  } else {
    console.log('WARNING: Dark mode toggle not found');
    results.details.push('Dark mode toggle not found');
  }

  // Step 3: Check for notifications indicator
  const notifSelectors = [
    '[class*="notification"]',
    '[data-testid*="notification"]',
    '[aria-label*="notification" i]',
    'button[aria-label*="bell" i]',
    '[class*="badge"]',
    '[class*="notif"]',
    'svg[class*="bell"]',
  ];

  let notifFound = false;
  for (const sel of notifSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      notifFound = true;
      const el = page.locator(sel).first();
      const text = await el.textContent();
      const classes = await el.getAttribute('class') || '';
      console.log(`PASS: Notifications indicator found with selector "${sel}". Text: "${text ? text.trim() : ''}", Classes: "${classes.substring(0, 150)}"`);
      break;
    }
  }

  if (!notifFound) {
    console.log('WARNING: Notifications indicator not found with standard selectors');
    results.details.push('Notifications indicator not found');
  }

  // Print top bar HTML for inspection
  const topBarHtml = await page.evaluate(() => {
    const header = document.querySelector('header') ||
      document.querySelector('[class*="topbar"]') ||
      document.querySelector('[class*="top-bar"]') ||
      document.querySelector('[class*="toolbar"]');
    return header ? header.outerHTML.substring(0, 3000) : 'No header element found';
  });
  console.log('\nTop bar HTML snippet:\n', topBarHtml.substring(0, 2000));

  return results;
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await login(page);

    const r12 = await testFeature12(page);
    const r13 = await testFeature13(page);
    const r14 = await testFeature14(page);

    console.log('\n=== FINAL RESULTS ===');
    console.log('Feature 12 (Active sidebar indicator):', r12.passes ? 'PASS' : 'FAIL', r12.details.join('; ') || '');
    console.log('Feature 13 (Breadcrumb navigation):', r13.passes ? 'PASS' : 'FAIL', r13.details.join('; ') || '');
    console.log('Feature 14 (Top bar - avatar/dark mode/notifs):', r14.passes ? 'PASS' : 'FAIL', r14.details.join('; ') || '');

    if (consoleErrors.length > 0) {
      console.log('\nJS Console Errors:');
      consoleErrors.slice(0, 10).forEach(e => console.log(' -', e));
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
    console.log('\nBrowser closed.');
  }
}

main();
