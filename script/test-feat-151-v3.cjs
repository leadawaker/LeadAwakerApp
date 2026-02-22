// test-feat-151-v3.cjs
// Click on account name cell to open dialog, avoid dropdowns
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
  if (!loginCheck) return;
  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await login(page);

  // Navigate to accounts
  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Enable dark mode
  const toggle = await page.$('[data-testid="button-dark-mode-toggle"]');
  if (toggle) {
    await toggle.click();
    await page.waitForTimeout(500);
  }

  // Verify dark mode is active
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log('Dark mode active:', isDark ? 'YES (PASS)' : 'NO (FAIL)');

  // Verify status badges in the table
  const badgeCheck = await page.evaluate(() => {
    // The DataTable uses inline status cells with colored text/bg
    const allText = document.body.innerText;
    const hasActive = allText.includes('ACTIVE');
    const hasSuspended = allText.includes('SUSPENDED');
    const hasTrial = allText.includes('TRIAL');

    // Look for the actual badge/pill elements (status dropdown triggers)
    const statusDropdowns = document.querySelectorAll('button[class*="rounded"], div[class*="rounded"]');
    const colored = Array.from(statusDropdowns).filter(el => {
      const cls = el.className || '';
      return cls.includes('emerald') || cls.includes('red') || cls.includes('amber') || cls.includes('blue');
    });

    // Try to find status cell content more broadly
    const tableCells = document.querySelectorAll('td');
    const statusCells = Array.from(tableCells).filter(td => {
      const text = td.textContent?.trim();
      return text === 'ACTIVE' || text === 'SUSPENDED' || text === 'TRIAL' || text === 'INACTIVE';
    });

    // Find all elements with status-like text
    const statusElements = document.querySelectorAll('[class*="bg-emerald"], [class*="bg-red"], [class*="bg-amber"], [class*="bg-blue"]');
    const statusInfo = Array.from(statusElements).slice(0, 10).map(el => ({
      text: el.textContent?.trim().slice(0, 30),
      tag: el.tagName,
      cls: el.className?.slice(0, 80),
      computedBg: window.getComputedStyle(el).backgroundColor,
    }));

    return {
      hasActiveText: hasActive,
      hasSuspendedText: hasSuspended,
      hasTrialText: hasTrial,
      coloredButtonCount: colored.length,
      statusCellCount: statusCells.length,
      statusElementCount: statusElements.length,
      statusElementSample: statusInfo,
    };
  });
  console.log('Badge/status verification:', JSON.stringify(badgeCheck, null, 2));

  // Now try to click on the account name text directly (third column in first data row)
  // Find the "Campaign Name" column cell - this is the name cell
  const rowClickResult = await page.evaluate(() => {
    const tbody = document.querySelector('tbody');
    if (!tbody) return { found: false };
    const firstRow = tbody.querySelector('tr');
    if (!firstRow) return { found: false, msg: 'no row' };

    // Get all cells in first row
    const cells = firstRow.querySelectorAll('td');
    const cellInfo = Array.from(cells).map((td, i) => ({
      index: i,
      text: td.textContent?.trim().slice(0, 40),
      hasDropdown: !!td.querySelector('[role="combobox"], select, button'),
    }));
    return { found: true, cells: cellInfo };
  });
  console.log('First row cells:', JSON.stringify(rowClickResult));

  // Click on a cell that doesn't have a dropdown - the name/text column
  // Based on the table structure, let's click on the name text cell
  const clicked = await page.evaluate(() => {
    const tbody = document.querySelector('tbody');
    if (!tbody) return false;
    const firstRow = tbody.querySelector('tr');
    if (!firstRow) return false;
    const cells = firstRow.querySelectorAll('td');

    // Find first cell that has text but no interactive elements
    for (let i = 1; i < cells.length; i++) { // skip checkbox col (0)
      const td = cells[i];
      const hasDropdown = !!td.querySelector('[role="combobox"], [role="listbox"]');
      const text = td.textContent?.trim();
      if (text && !hasDropdown && text.length > 1) {
        // This should be a safe cell to click
        td.click();
        return { clicked: true, cellIndex: i, text };
      }
    }
    return { clicked: false };
  });
  console.log('Click result:', JSON.stringify(clicked));

  await page.waitForTimeout(1500);
  await shot(page, '08-after-name-click');

  // Check dialog
  const dialogResult = await page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="account-detail-dialog"]')
      || document.querySelector('[role="dialog"]');

    if (!dialog) {
      // Check for any overlay/modal
      const overlays = document.querySelectorAll('[data-state="open"]');
      const radixPortal = document.querySelector('[data-radix-portal]');
      return {
        found: false,
        openStateElements: overlays.length,
        radixPortal: !!radixPortal,
        radixContent: radixPortal ? radixPortal.innerHTML.slice(0, 300) : null,
      };
    }

    const bg = window.getComputedStyle(dialog).backgroundColor;
    const hasDarkBg = bg !== 'rgb(255, 255, 255)';

    // Check for white-bg elements in dialog
    const allChildren = dialog.querySelectorAll('*');
    const whiteEls = [];
    for (const el of allChildren) {
      const elBg = window.getComputedStyle(el).backgroundColor;
      if (elBg === 'rgb(255, 255, 255)' && el.offsetWidth > 20 && el.offsetHeight > 10) {
        whiteEls.push({ tag: el.tagName, cls: el.className?.toString().slice(0, 60) });
      }
    }

    // Find account name in dialog
    const dialogTitle = dialog.querySelector('[class*="DialogTitle"], h2, [class*="title"]');
    const titleText = dialogTitle?.textContent?.trim();

    // Check text readability - headings/labels
    const labels = dialog.querySelectorAll('label, [class*="muted"]');
    const sampleColors = Array.from(labels).slice(0, 3).map(l => ({
      text: l.textContent?.trim().slice(0, 20),
      color: window.getComputedStyle(l).color,
    }));

    // Status badges inside dialog
    const statusBadge = dialog.querySelector('[class*="bg-emerald"], [class*="bg-red"], [class*="bg-amber"]');
    const statusBadgeInfo = statusBadge ? {
      text: statusBadge.textContent?.trim(),
      bg: window.getComputedStyle(statusBadge).backgroundColor,
      color: window.getComputedStyle(statusBadge).color,
    } : null;

    return {
      found: true,
      bg,
      hasDarkBg,
      titleText,
      whiteCount: whiteEls.length,
      whiteEls: whiteEls.slice(0, 5),
      sampleColors,
      statusBadgeInfo,
    };
  });
  console.log('Dialog check:', JSON.stringify(dialogResult, null, 2));

  if (dialogResult.found) {
    await shot(page, '09-dialog-in-dark-mode');
    console.log('\nDIALOG DARK MODE RESULTS:');
    console.log(`  Background: ${dialogResult.bg} -> ${dialogResult.hasDarkBg ? 'PASS (dark surface)' : 'FAIL (white/light)'}`);
    console.log(`  Title: "${dialogResult.titleText}"`);
    console.log(`  White elements inside dialog: ${dialogResult.whiteCount} -> ${dialogResult.whiteCount === 0 ? 'PASS' : 'WARN'}`);
    if (dialogResult.statusBadgeInfo) {
      console.log(`  Status badge: text="${dialogResult.statusBadgeInfo.text}" bg=${dialogResult.statusBadgeInfo.bg} color=${dialogResult.statusBadgeInfo.color}`);
    }
  } else {
    console.log('Dialog not opened. Open state elements:', dialogResult.openStateElements);
    console.log('Radix portal:', dialogResult.radixPortal);
    if (dialogResult.radixContent) {
      console.log('Portal content:', dialogResult.radixContent);
    }

    // Try one more approach - use keyboard or look for the Eye icon button
    const viewBtn = await page.$('[data-testid="btn-view-selected"]');
    if (viewBtn) {
      console.log('Found view selected button, trying...');
    }
  }

  // Check the light mode screenshot too
  await shot(page, '10-final-dark-state');

  console.log('\nJS ERRORS:', errors.length === 0 ? 'NONE' : errors);

  await browser.close();
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
