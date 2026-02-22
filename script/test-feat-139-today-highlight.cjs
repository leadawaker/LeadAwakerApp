const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'feat-139');
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
  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Logged in:', page.url());
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await login(page);

  // Navigate to the calendar page
  await page.goto('http://localhost:5173/agency/calendar', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('[data-testid="page-calendar"]', { timeout: 10000 });
  await page.waitForTimeout(1500); // let data load

  // --- MONTH VIEW ---
  console.log('\n--- MONTH VIEW ---');
  await shot(page, '01-month-view');

  // Find today's date cell (Feb 21, 2026)
  // Today is highlighted via isToday check in the code
  // The date number div has class: isToday ? "text-primary bg-primary/10" : ...
  const todayCells = await page.$$eval('[data-testid^="day-"]', (cells) => {
    const results = [];
    cells.forEach((cell, idx) => {
      const dateNumEl = cell.querySelector('div > div');
      if (!dateNumEl) return;
      const text = dateNumEl.textContent?.trim();
      const classList = Array.from(dateNumEl.classList);
      const cellClass = Array.from(cell.classList);
      results.push({
        idx,
        dateText: text,
        numElClasses: classList,
        cellClasses: cellClass,
      });
    });
    return results;
  });

  // Find day 21 (today) among them
  const todayCell = todayCells.find(c => c.dateText === '21');
  console.log('Today cell (day 21) found:', todayCell ? 'YES' : 'NO');
  if (todayCell) {
    console.log('  Date number element classes:', todayCell.numElClasses.join(' '));
    console.log('  Cell container classes:', todayCell.cellClasses.join(' '));
    const hasPrimaryColor = todayCell.numElClasses.some(c => c.includes('primary') || c.includes('text-primary'));
    const hasBg = todayCell.numElClasses.some(c => c.includes('bg-'));
    const cellHasTodayBg = todayCell.cellClasses.some(c => c.includes('primary') || c.includes('bg-primary'));
    console.log('  Number has primary color class:', hasPrimaryColor ? 'YES (PASS)' : 'NO (FAIL)');
    console.log('  Number has background class:', hasBg ? 'YES (PASS)' : 'NO (FAIL)');
    console.log('  Cell container has today bg highlight:', cellHasTodayBg ? 'YES (PASS)' : 'NO (FAIL)');
  }

  // Also check computed styles for today's number element
  // Look for the rounded circle around the date number
  const todayHighlightInfo = await page.evaluate(() => {
    // Find all day cells, look for the one with today marker
    const grid = document.querySelector('[data-testid="grid-days"]');
    if (!grid) return null;
    const cells = Array.from(grid.querySelectorAll(':scope > [data-testid^="day-"]'));
    for (const cell of cells) {
      const numEl = cell.querySelector('div > div'); // the date number div
      if (!numEl) continue;
      const text = numEl.textContent?.trim();
      if (text !== '21') continue;
      const numStyles = window.getComputedStyle(numEl);
      const cellStyles = window.getComputedStyle(cell);
      return {
        dateText: text,
        numEl: {
          className: numEl.className,
          color: numStyles.color,
          backgroundColor: numStyles.backgroundColor,
          borderRadius: numStyles.borderRadius,
          width: numStyles.width,
          height: numStyles.height,
        },
        cell: {
          className: cell.className,
          backgroundColor: cellStyles.backgroundColor,
        },
      };
    }
    return null;
  });

  if (todayHighlightInfo) {
    console.log('\nComputed styles for today (day 21) in month view:');
    console.log('  Number element className:', todayHighlightInfo.numEl.className);
    console.log('  Number color:', todayHighlightInfo.numEl.color);
    console.log('  Number background:', todayHighlightInfo.numEl.backgroundColor);
    console.log('  Number border-radius:', todayHighlightInfo.numEl.borderRadius);
    console.log('  Number width/height:', todayHighlightInfo.numEl.width, '/', todayHighlightInfo.numEl.height);
    console.log('  Cell className:', todayHighlightInfo.cell.className);
    console.log('  Cell background:', todayHighlightInfo.cell.backgroundColor);
  } else {
    console.log('Could not find day-21 cell or compute styles');
  }

  // --- WEEK VIEW ---
  console.log('\n--- WEEK VIEW ---');
  // Switch to week view
  await page.click('[data-testid="button-view-mode"]');
  await page.waitForTimeout(400);
  // Click "Week View" from dropdown
  const weekOption = await page.locator('text=Week View').first();
  await weekOption.click();
  await page.waitForTimeout(800);

  await shot(page, '02-week-view');

  // In week view, today column header is highlighted via:
  // isToday && "bg-primary/5" on the sticky header div
  // isToday ? "text-primary" : "text-foreground" on the date number
  const weekTodayInfo = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="grid-time"]');
    if (!grid) return null;
    // Find all day column headers (sticky top-0 divs with date numbers)
    const dayHeaders = Array.from(grid.querySelectorAll('.sticky'));
    const results = [];
    dayHeaders.forEach(el => {
      // Find the date number (text-lg element)
      const numEl = el.querySelector('.text-lg');
      if (!numEl) return;
      const text = numEl.textContent?.trim();
      const numStyles = window.getComputedStyle(numEl);
      const headerStyles = window.getComputedStyle(el);
      results.push({
        dateText: text,
        numClassName: numEl.className,
        numColor: numStyles.color,
        headerClassName: el.className,
        headerBg: headerStyles.backgroundColor,
      });
    });
    return results;
  });

  if (weekTodayInfo) {
    console.log('Week view day headers:');
    weekTodayInfo.forEach(h => {
      console.log(`  Day ${h.dateText}: numClass="${h.numClassName}", color=${h.numColor}, headerClass="${h.headerClassName}", headerBg=${h.headerBg}`);
    });

    const todayHeader = weekTodayInfo.find(h => h.dateText === '21');
    if (todayHeader) {
      console.log('\nToday (21) week header analysis:');
      const hasTextPrimary = todayHeader.numClassName.includes('text-primary');
      const headerHasBg = todayHeader.headerClassName.includes('primary');
      console.log('  Number has text-primary class:', hasTextPrimary ? 'YES (PASS)' : 'NO (FAIL)');
      console.log('  Header has primary bg class:', headerHasBg ? 'YES (PASS)' : 'NO (FAIL)');
    } else {
      console.log('\nToday (21) NOT found in current week view. Current week might not include Feb 21.');
      console.log('Current week dates shown:', weekTodayInfo.map(h => h.dateText).join(', '));
    }
  }

  // Check for today's red current-time line in week view
  const redTimeLine = await page.$('.border-red-500.border-t-2');
  console.log('\nCurrent-time red line present:', redTimeLine ? 'YES (PASS)' : 'NO');

  // Navigate back to today using "Today" button to ensure we're on the right week
  await page.click('[data-testid="button-today"]');
  await page.waitForTimeout(600);
  await shot(page, '03-week-view-today');

  const weekTodayInfoAfterNav = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="grid-time"]');
    if (!grid) return null;
    const dayHeaders = Array.from(grid.querySelectorAll('.sticky'));
    const results = [];
    dayHeaders.forEach(el => {
      const numEl = el.querySelector('.text-lg');
      if (!numEl) return;
      const text = numEl.textContent?.trim();
      const numStyles = window.getComputedStyle(numEl);
      const headerStyles = window.getComputedStyle(el);
      results.push({
        dateText: text,
        numClassName: numEl.className,
        numColor: numStyles.color,
        headerClassName: el.className,
        headerBg: headerStyles.backgroundColor,
      });
    });
    return results;
  });

  if (weekTodayInfoAfterNav) {
    console.log('\nWeek view day headers after navigating to today:');
    weekTodayInfoAfterNav.forEach(h => {
      const isToday = h.dateText === '21';
      console.log(`  Day ${h.dateText}${isToday ? ' (TODAY)' : ''}: numColor=${h.numColor}, headerBg=${h.headerBg}`);
    });

    const todayCol = weekTodayInfoAfterNav.find(h => h.dateText === '21');
    if (todayCol) {
      console.log('\nToday column summary:');
      console.log('  numClassName:', todayCol.numClassName);
      console.log('  headerClassName:', todayCol.headerClassName);
      const pass = todayCol.numClassName.includes('text-primary') && todayCol.headerClassName.includes('primary');
      console.log('  Today highlight PASS:', pass ? 'YES' : 'NO');
    }
  }

  console.log('\n--- CONSOLE ERRORS ---');
  console.log('Count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log(' ', e));
  } else {
    console.log('None');
  }

  await browser.close();
  console.log('\nTest complete. Screenshots in:', SCREENSHOT_DIR);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
