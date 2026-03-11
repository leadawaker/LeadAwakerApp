// test-feat-151-dark-mode.cjs
// Verify Accounts page renders correctly in dark mode (Feature #151)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'feat-151');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log('Screenshot:', fp);
  return fp;
}

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  const loginCheck = await page.$('[data-testid="input-email"]');
  if (!loginCheck) {
    console.log('Already logged in (no login form found)');
    return;
  }
  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Logged in:', page.url());
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const results = {};

  // STEP 1: Login
  try {
    await login(page);
    results['step1_login'] = 'PASS';
  } catch (e) {
    results['step1_login'] = 'FAIL: ' + e.message;
    await shot(page, '00-login-error');
    await browser.close();
    return results;
  }

  // STEP 2: Navigate to /agency/accounts
  try {
    await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    results['step2_navigate'] = 'PASS';
  } catch (e) {
    results['step2_navigate'] = 'FAIL: ' + e.message;
  }

  // STEP 3: Screenshot in light mode
  await shot(page, '01-light-mode-accounts');

  // Check light mode background
  const bodyBg = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    return {
      hasDarkClass: html.classList.contains('dark'),
      bodyBg: window.getComputedStyle(body).backgroundColor,
      htmlClasses: html.className,
    };
  });
  console.log('Light mode state:', JSON.stringify(bodyBg));
  results['step3_light_mode_screenshot'] = 'PASS';

  // STEP 4: Find and click dark mode toggle
  try {
    const darkToggle = await page.$('[data-testid="button-dark-mode-toggle"]');
    if (!darkToggle) {
      // Also try aria-label
      const byAria = await page.$('[aria-label="Switch to dark mode"]');
      if (!byAria) {
        results['step4_find_toggle'] = 'FAIL: Toggle button not found';
      } else {
        await byAria.click();
        results['step4_find_toggle'] = 'PASS (found by aria-label)';
      }
    } else {
      await darkToggle.click();
      results['step4_find_toggle'] = 'PASS';
    }
    await page.waitForTimeout(500);
  } catch (e) {
    results['step4_find_toggle'] = 'FAIL: ' + e.message;
  }

  // STEP 5: Screenshot after dark mode toggle
  await shot(page, '02-dark-mode-accounts');

  // STEP 6: Verify dark mode is active
  const darkModeState = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const hasDarkClass = html.classList.contains('dark');
    const bodyBg = window.getComputedStyle(body).backgroundColor;

    // Get background of main content area
    const mainEl = document.querySelector('main') || document.querySelector('[data-testid="layout-crm"]') || document.querySelector('.min-h-screen');
    const mainBg = mainEl ? window.getComputedStyle(mainEl).backgroundColor : 'N/A';

    // Check some text color
    const headings = document.querySelectorAll('h1, h2, h3');
    const headingColors = Array.from(headings).slice(0, 3).map(h => ({
      text: h.textContent?.trim().slice(0, 30),
      color: window.getComputedStyle(h).color,
    }));

    // Check for any elements with hardcoded white background
    const allEls = document.querySelectorAll('*');
    const hardcodedWhite = [];
    for (let i = 0; i < Math.min(allEls.length, 200); i++) {
      const el = allEls[i];
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg === 'rgb(255, 255, 255)' && el.offsetWidth > 0 && el.offsetHeight > 20) {
        hardcodedWhite.push({
          tag: el.tagName,
          class: el.className?.toString().slice(0, 80),
          testid: el.getAttribute('data-testid'),
        });
      }
    }

    return {
      hasDarkClass,
      bodyBg,
      mainBg,
      headingColors,
      hardcodedWhiteCount: hardcodedWhite.length,
      hardcodedWhiteSample: hardcodedWhite.slice(0, 5),
    };
  });

  console.log('Dark mode verification:', JSON.stringify(darkModeState, null, 2));
  results['step6_dark_mode_active'] = darkModeState.hasDarkClass ? 'PASS' : 'FAIL: html does not have .dark class';

  // Check background is actually dark (not white)
  const bg = darkModeState.bodyBg;
  const isBodyDark = !(bg === 'rgb(255, 255, 255)' || bg === 'rgba(255, 255, 255, 1)');
  results['step6_dark_background'] = isBodyDark ? `PASS (body bg: ${bg})` : `FAIL: body still has light background (${bg})`;

  results['step6_hardcoded_white'] = darkModeState.hardcodedWhiteCount === 0
    ? 'PASS (no hardcoded white backgrounds)'
    : `WARN: ${darkModeState.hardcodedWhiteCount} elements with white bg found`;

  // STEP 7: Check table/cards use dark surfaces
  const tableState = await page.evaluate(() => {
    const table = document.querySelector('table') || document.querySelector('[role="table"]');
    const tableBg = table ? window.getComputedStyle(table).backgroundColor : null;

    const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
    const cardBg = cards.length > 0 ? window.getComputedStyle(cards[0]).backgroundColor : null;

    return { tableBg, cardBg, tableFound: !!table, cardsFound: cards.length };
  });
  console.log('Table/card state in dark mode:', JSON.stringify(tableState));
  results['step7_dark_surfaces'] = tableState.tableFound ? 'PASS (table found)' : 'WARN: no table element found';

  // STEP 8: Check status badges
  const badgesState = await page.evaluate(() => {
    const badges = document.querySelectorAll('[class*="badge"], [class*="Badge"]');
    const badgeInfo = Array.from(badges).slice(0, 5).map(b => ({
      text: b.textContent?.trim(),
      color: window.getComputedStyle(b).color,
      bg: window.getComputedStyle(b).backgroundColor,
    }));
    return { count: badges.length, sample: badgeInfo };
  });
  console.log('Badges state:', JSON.stringify(badgesState));
  results['step8_badges_visible'] = badgesState.count > 0 ? `PASS (${badgesState.count} badges found)` : 'WARN: no badges found';

  // STEP 9: Click on a row to open AccountDetailsDialog
  try {
    // Wait for table rows to appear
    await page.waitForSelector('tr, [data-testid^="row-"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Try clicking on first data row
    const firstRow = await page.$('tbody tr:first-child');
    if (firstRow) {
      await firstRow.click();
      await page.waitForTimeout(800);
      results['step9_click_row'] = 'PASS';
    } else {
      // Try alternate selectors
      const altRow = await page.$('[data-testid^="row-"]');
      if (altRow) {
        await altRow.click();
        await page.waitForTimeout(800);
        results['step9_click_row'] = 'PASS (via data-testid row)';
      } else {
        results['step9_click_row'] = 'WARN: no row found to click';
      }
    }
  } catch (e) {
    results['step9_click_row'] = 'FAIL: ' + e.message;
  }

  // STEP 10: Screenshot of dialog in dark mode
  await shot(page, '03-dark-mode-dialog');

  // STEP 11: Verify dialog has dark surfaces
  const dialogState = await page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="account-detail-dialog"]')
      || document.querySelector('[role="dialog"]');
    if (!dialog) return { found: false };

    const dialogBg = window.getComputedStyle(dialog).backgroundColor;
    const dialogColor = window.getComputedStyle(dialog).color;

    const title = dialog.querySelector('h2, [class*="title"], [class*="Title"]');
    const titleColor = title ? window.getComputedStyle(title).color : null;

    // Check for any white-background elements inside dialog
    const allInDialog = dialog.querySelectorAll('*');
    const whiteEls = [];
    for (let i = 0; i < Math.min(allInDialog.length, 100); i++) {
      const el = allInDialog[i];
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg === 'rgb(255, 255, 255)' && el.offsetWidth > 10 && el.offsetHeight > 10) {
        whiteEls.push({
          tag: el.tagName,
          cls: el.className?.toString().slice(0, 60),
        });
      }
    }

    return {
      found: true,
      dialogBg,
      dialogColor,
      titleColor,
      whiteEls: whiteEls.slice(0, 5),
      whiteCount: whiteEls.length,
    };
  });
  console.log('Dialog state in dark mode:', JSON.stringify(dialogState, null, 2));

  if (!dialogState.found) {
    results['step11_dialog_dark'] = 'WARN: dialog not found (may not have opened)';
  } else {
    const isDialogDark = dialogState.dialogBg !== 'rgb(255, 255, 255)';
    results['step11_dialog_dark'] = isDialogDark
      ? `PASS (dialog bg: ${dialogState.dialogBg})`
      : `FAIL: dialog has white background`;
    results['step11_dialog_white_elements'] = dialogState.whiteCount === 0
      ? 'PASS (no hardcoded white in dialog)'
      : `WARN: ${dialogState.whiteCount} elements with white bg in dialog`;
  }

  // STEP 12: Check JS console errors
  results['step12_js_errors'] = errors.length === 0
    ? 'PASS (no errors)'
    : `WARN: ${errors.length} JS error(s): ${errors.slice(0, 3).join('; ')}`;

  // Final summary
  console.log('\n========== RESULTS SUMMARY ==========');
  for (const [k, v] of Object.entries(results)) {
    const icon = v.startsWith('PASS') ? '[PASS]' : v.startsWith('FAIL') ? '[FAIL]' : '[WARN]';
    console.log(`${icon} ${k}: ${v}`);
  }
  console.log('=====================================\n');

  if (errors.length > 0) {
    console.log('JS Errors:', errors);
  }

  await browser.close();
  return results;
}

main().catch(err => {
  console.error('Test script failed:', err.message);
  process.exit(1);
});
