// test-feat-151-dialog.cjs
// Targeted test for AccountDetailsDialog in dark mode + badge verification
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
    console.log('Already logged in');
    return;
  }
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
    console.log('Dark mode toggled');
  }

  // Screenshot accounts page in dark mode (wider viewport for better view)
  await shot(page, '04-dark-accounts-full');

  // Check what badge-related elements exist
  const badgeInfo = await page.evaluate(() => {
    // Look for status text in rows
    const statusCells = document.querySelectorAll('[class*="status"], [class*="Status"]');
    const spanBadges = document.querySelectorAll('span[class*="bg-"], span[class*="text-emerald"], span[class*="text-red"]');
    const allSpans = Array.from(spanBadges).slice(0, 10).map(s => ({
      text: s.textContent?.trim(),
      cls: s.className?.slice(0, 80),
    }));

    // Check for any colored pill/badge elements
    const pills = document.querySelectorAll('[class*="rounded-full"], [class*="rounded-md"]');
    const coloredPills = Array.from(pills).filter(p => {
      const cls = p.className || '';
      return (cls.includes('bg-emerald') || cls.includes('bg-red') || cls.includes('bg-amber') || cls.includes('bg-blue') || cls.includes('bg-slate')) && p.textContent?.trim().length > 0;
    }).slice(0, 10).map(p => ({
      text: p.textContent?.trim().slice(0, 30),
      cls: p.className?.slice(0, 80),
    }));

    return {
      statusCellCount: statusCells.length,
      spanBadgeCount: spanBadges.length,
      spanBadgeSample: allSpans,
      coloredPillCount: coloredPills.length,
      coloredPillSample: coloredPills,
    };
  });
  console.log('Badge analysis:', JSON.stringify(badgeInfo, null, 2));

  // Scroll to see table content
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(300);
  await shot(page, '05-dark-table-scrolled');

  // Try to find and click the first row more aggressively
  // Wait for data to load first
  await page.waitForTimeout(2000);

  const rowInfo = await page.evaluate(() => {
    const tbody = document.querySelector('tbody');
    if (!tbody) return { found: false, msg: 'no tbody' };
    const rows = tbody.querySelectorAll('tr');
    if (rows.length === 0) return { found: false, msg: 'no rows in tbody' };
    return { found: true, count: rows.length, firstRowText: rows[0].textContent?.slice(0, 100) };
  });
  console.log('Row info:', JSON.stringify(rowInfo));

  if (rowInfo.found) {
    // Click on first data row
    const firstRow = await page.$('tbody tr:first-child');
    if (firstRow) {
      // Scroll it into view
      await firstRow.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await firstRow.click({ force: true });
      console.log('Clicked first row');
      await page.waitForTimeout(1500);
    }
  }

  // Screenshot after attempting to open dialog
  await shot(page, '06-after-row-click');

  // Check if dialog is open
  const dialogInfo = await page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="account-detail-dialog"]')
      || document.querySelector('[role="dialog"]');
    if (!dialog) {
      // See what dialogs/modals exist
      const portals = document.querySelectorAll('[data-radix-portal]');
      return {
        found: false,
        portals: portals.length,
        portalHtml: portals.length > 0 ? portals[0].innerHTML.slice(0, 200) : null,
      };
    }

    const bg = window.getComputedStyle(dialog).backgroundColor;
    const color = window.getComputedStyle(dialog).color;

    // Check all children for white backgrounds
    const children = dialog.querySelectorAll('*');
    const whiteEls = [];
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const elBg = window.getComputedStyle(el).backgroundColor;
      if (elBg === 'rgb(255, 255, 255)' && el.offsetWidth > 20 && el.offsetHeight > 10) {
        whiteEls.push({ tag: el.tagName, cls: el.className?.toString().slice(0, 60) });
      }
    }

    const title = dialog.querySelector('[class*="DialogTitle"], h2');
    const titleText = title?.textContent?.trim();
    const titleColor = title ? window.getComputedStyle(title).color : null;

    // Get badge-like elements in dialog
    const badges = dialog.querySelectorAll('[class*="badge"], [class*="Badge"], [class*="bg-emerald"], [class*="bg-red"], [class*="bg-amber"]');
    const badgeSamples = Array.from(badges).slice(0, 5).map(b => ({
      text: b.textContent?.trim(),
      bg: window.getComputedStyle(b).backgroundColor,
      color: window.getComputedStyle(b).color,
    }));

    return {
      found: true,
      bg,
      color,
      titleText,
      titleColor,
      whiteCount: whiteEls.length,
      whiteEls: whiteEls.slice(0, 5),
      badgeCount: badges.length,
      badges: badgeSamples,
    };
  });
  console.log('Dialog info:', JSON.stringify(dialogInfo, null, 2));

  if (dialogInfo.found) {
    await shot(page, '07-dialog-dark-mode');
    console.log('\nDIALOG DARK MODE CHECK:');
    const isDialogDark = dialogInfo.bg !== 'rgb(255, 255, 255)';
    console.log(`  Background: ${dialogInfo.bg} -> ${isDialogDark ? 'PASS (dark)' : 'FAIL (white)'}`);
    console.log(`  Text color: ${dialogInfo.color}`);
    console.log(`  Title: "${dialogInfo.titleText}" (color: ${dialogInfo.titleColor})`);
    console.log(`  White elements in dialog: ${dialogInfo.whiteCount}`);
    if (dialogInfo.whiteCount > 0) {
      console.log('  White element samples:', JSON.stringify(dialogInfo.whiteEls));
    }
    console.log(`  Badges in dialog: ${dialogInfo.badgeCount}`);
  } else {
    console.log('Dialog not found. Portals:', dialogInfo.portals);
  }

  // Final dark mode assessment
  const finalState = await page.evaluate(() => {
    const html = document.documentElement;
    return {
      hasDarkClass: html.classList.contains('dark'),
      htmlClasses: html.className,
    };
  });
  console.log('\nFinal dark mode state:', JSON.stringify(finalState));

  console.log('\nJS Errors:', errors.length, errors.length > 0 ? errors : 'none');

  await browser.close();
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
