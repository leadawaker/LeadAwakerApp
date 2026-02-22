const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'calendar-nav');
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

async function getViewLabel(page) {
  try {
    const el = await page.$('[data-testid="text-view-label"]');
    if (el) {
      const text = await el.innerText();
      return text.trim();
    }
    return 'NOT FOUND';
  } catch (e) {
    return 'ERROR: ' + e.message;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect all console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await login(page);

  // Navigate to the Calendar page
  await page.goto('http://localhost:5173/agency/calendar', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for the calendar page to mount
  await page.waitForSelector('[data-testid="page-calendar"]', { timeout: 15000 });
  console.log('Calendar page mounted');
  await page.waitForTimeout(500);

  // STEP 4: Take initial screenshot on calendar page
  await shot(page, '01-calendar-initial');
  console.log('STEP 4 - On Calendar page: PASS');

  // STEP 5: Read current view label
  const initialLabel = await getViewLabel(page);
  console.log('STEP 5 - Initial view label:', initialLabel);

  // STEP 6: Click the "Next" button and verify calendar advanced
  const nextBtn = await page.$('[data-testid="button-next"]');
  if (!nextBtn) {
    console.log('STEP 6 - Next button: NOT FOUND (FAIL)');
  } else {
    await nextBtn.click();
    await page.waitForTimeout(500);
    const afterNextLabel = await getViewLabel(page);
    console.log('STEP 6 - After Next click label:', afterNextLabel);
    const nextWorked = afterNextLabel !== initialLabel;
    console.log('STEP 6 - Next button advanced calendar:', nextWorked ? 'PASS' : 'FAIL (label unchanged)');
    await shot(page, '02-after-next');

    // STEP 7 (already done above - reading new label)
    console.log('STEP 7 - New view label confirmed:', afterNextLabel);

    // STEP 8: Click the "Previous" button to go back
    const prevBtn = await page.$('[data-testid="button-prev"]');
    if (!prevBtn) {
      console.log('STEP 8 - Prev button: NOT FOUND (FAIL)');
    } else {
      await prevBtn.click();
      await page.waitForTimeout(500);
      const afterPrevLabel = await getViewLabel(page);
      console.log('STEP 8 - After Prev click label:', afterPrevLabel);
      const prevWorked = afterPrevLabel === initialLabel;
      console.log('STEP 9 - Prev returned to initial label:', prevWorked ? 'PASS' : 'FAIL (expected: ' + initialLabel + ', got: ' + afterPrevLabel + ')');
      await shot(page, '03-after-prev');

      // STEP 10: Click "Today" button and verify
      // First advance a few times so Today has effect
      await nextBtn.click();
      await page.waitForTimeout(300);
      await nextBtn.click();
      await page.waitForTimeout(300);
      const labelBeforeToday = await getViewLabel(page);
      console.log('STEP 10 - Label before Today click (2 nexts from initial):', labelBeforeToday);

      const todayBtn = await page.$('[data-testid="button-today"]');
      if (!todayBtn) {
        console.log('STEP 10 - Today button: NOT FOUND (FAIL)');
      } else {
        await todayBtn.click();
        await page.waitForTimeout(500);
        const afterTodayLabel = await getViewLabel(page);
        console.log('STEP 10 - After Today click label:', afterTodayLabel);
        const todayWorked = afterTodayLabel === initialLabel;
        console.log('STEP 10 - Today returned to current date:', todayWorked ? 'PASS' : 'FAIL (expected: ' + initialLabel + ', got: ' + afterTodayLabel + ')');
        await shot(page, '04-after-today');
      }
    }
  }

  // STEP 12: Check console errors
  console.log('\n--- Console Errors ---');
  if (errors.length === 0) {
    console.log('No console errors: PASS');
  } else {
    console.log('Console errors found (' + errors.length + '):');
    errors.forEach((e, i) => console.log('  [' + i + ']', e));
  }

  await browser.close();
  console.log('\nTest complete');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
