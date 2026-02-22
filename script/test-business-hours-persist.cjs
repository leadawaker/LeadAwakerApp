/**
 * Test: Business Hours Persistence
 * Verifies that editing business_hours_start for the "van de Kerkhof" account
 * actually saves to the database and persists after reopening the dialog.
 *
 * Steps:
 *  1. Login
 *  2. Navigate to /agency/accounts, wait for table
 *  3. Click the "van de Kerkhof" row
 *  4. Screenshot the initial Business Hours Open value (view mode)
 *  5. Click Edit
 *  6. Change business_hours_start to "10:00"
 *  7. Click Save
 *  8. Screenshot after save (should show "10:00 AM")
 *  9. Close dialog
 * 10. Re-click the "van de Kerkhof" row
 * 11. Screenshot — value should still be "10:00 AM" (persistence check)
 * 12. Edit again and restore to "09:00"
 * 13. Save and close
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'business-hours-persist');
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

/**
 * Find and click the row containing "van de Kerkhof" (case-insensitive).
 * Returns true if found and clicked, false otherwise.
 */
async function clickVanDeKerkhofRow(page) {
  // Rows have id="row-{Id}" — scan each for the account name
  const rows = await page.$$('tr[id^="row-"]');
  for (const row of rows) {
    const text = await row.textContent();
    if (text && text.toLowerCase().includes('van de kerkhof')) {
      const rowId = await row.getAttribute('id');
      console.log(`Found "van de Kerkhof" in row: ${rowId}`);
      // Click a non-checkbox cell (second td, index 1)
      const cells = await row.$$('td');
      if (cells.length > 1) {
        await cells[1].click();
      } else {
        await row.click();
      }
      return true;
    }
  }
  console.log('FAIL: Could not find a row containing "van de Kerkhof"');
  return false;
}

/**
 * Get the text content of the "Business Hours Open" field row in view mode.
 * We look for the label "Business Hours Open" and read the sibling element's text.
 */
async function getBusinessHoursOpenText(page) {
  // In view mode, the time field renders as a <span> inside a FieldRow.
  // The FieldRow has a Label with text "Business Hours Open".
  // We can get text from the sibling div.
  const value = await page.evaluate(() => {
    const labels = document.querySelectorAll('label');
    for (const lbl of labels) {
      if (lbl.textContent && lbl.textContent.trim() === 'Business Hours Open') {
        // The parent is the grid container; sibling is the second child div
        const container = lbl.closest('.grid');
        if (container) {
          const divs = container.querySelectorAll('div');
          if (divs.length > 0) {
            return divs[divs.length - 1].textContent?.trim() || '';
          }
        }
      }
    }
    return null;
  });
  return value;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });

  // ── STEP 1: Login ────────────────────────────────────────────────────────────
  console.log('\n=== STEP 1: Login ===');
  await login(page);

  // ── STEP 2: Navigate to /agency/accounts ────────────────────────────────────
  console.log('\n=== STEP 2: Navigate to /agency/accounts ===');
  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000); // wait for table rows to render
  await shot(page, '01-accounts-page');

  const rowCount = await page.$$eval('tr[id^="row-"]', rows => rows.length);
  console.log(`Table rows loaded: ${rowCount}`);
  if (rowCount === 0) {
    console.log('FAIL: No rows found in the accounts table');
    await browser.close();
    return;
  }

  // ── STEP 3: Click "van de Kerkhof" row ──────────────────────────────────────
  console.log('\n=== STEP 3: Click "van de Kerkhof" row ===');
  const found = await clickVanDeKerkhofRow(page);
  if (!found) {
    await shot(page, '02-row-not-found');
    await browser.close();
    return;
  }

  await page.waitForTimeout(800);

  // ── STEP 4: Verify dialog open + screenshot initial value ────────────────────
  console.log('\n=== STEP 4: Verify dialog open and note initial Business Hours Open ===');
  const dialog = await page.$('[data-testid="account-detail-dialog"]');
  if (!dialog) {
    console.log('FAIL: Dialog did not open after row click');
    await shot(page, '02-dialog-not-opened');
    await browser.close();
    return;
  }
  console.log('Dialog opened: YES (PASS)');

  // Scroll the dialog to the Schedule section so the screenshot shows it
  await page.evaluate(() => {
    const dialogContent = document.querySelector('[data-testid="account-detail-dialog"]');
    if (dialogContent) dialogContent.scrollTop = 300;
  });
  await page.waitForTimeout(300);

  const initialValue = await getBusinessHoursOpenText(page);
  console.log(`Initial Business Hours Open text: "${initialValue}"`);
  await shot(page, '03-initial-view-mode');

  // ── STEP 5: Click Edit ───────────────────────────────────────────────────────
  console.log('\n=== STEP 5: Click Edit button ===');
  const editBtn = await page.$('[data-testid="btn-edit-account"]');
  if (!editBtn) {
    console.log('FAIL: Edit button (data-testid="btn-edit-account") not found');
    await browser.close();
    return;
  }
  await editBtn.click();
  await page.waitForTimeout(500);
  console.log('Edit mode activated');

  // ── STEP 6: Change business_hours_start to "10:00" ──────────────────────────
  console.log('\n=== STEP 6: Change business_hours_start to "10:00" ===');
  const timeInput = await page.$('[data-testid="field-business_hours_start"]');
  if (!timeInput) {
    console.log('FAIL: Input [data-testid="field-business_hours_start"] not found in edit mode');
    // List all field testids to help debugging
    const fieldEls = await page.$$('[data-testid^="field-"]');
    const fieldIds = [];
    for (const el of fieldEls) {
      const tid = await el.getAttribute('data-testid');
      fieldIds.push(tid);
    }
    console.log('Fields found in edit mode:', fieldIds);
    await shot(page, '04-edit-mode-no-field');
    await browser.close();
    return;
  }

  const currentInputValue = await timeInput.inputValue();
  console.log(`Current input value: "${currentInputValue}"`);

  await timeInput.fill('10:00');
  const newInputValue = await timeInput.inputValue();
  console.log(`New input value after fill: "${newInputValue}"`);
  console.log(`Fill correct: ${newInputValue === '10:00' ? 'PASS' : `FAIL (got: ${newInputValue})`}`);

  await shot(page, '04-edit-mode-value-changed');

  // ── STEP 7: Click Save ───────────────────────────────────────────────────────
  console.log('\n=== STEP 7: Click Save ===');
  const saveBtn = await page.$('[data-testid="btn-save-account"]');
  if (!saveBtn) {
    console.log('FAIL: Save button (data-testid="btn-save-account") not found');
    await browser.close();
    return;
  }

  // Listen for PATCH/PUT network requests
  const apiRequests = [];
  page.on('request', req => {
    if (req.method() === 'PATCH' || req.method() === 'PUT') {
      apiRequests.push({ method: req.method(), url: req.url(), postData: req.postData() });
    }
  });
  const apiResponses = [];
  page.on('response', resp => {
    if ((resp.request().method() === 'PATCH' || resp.request().method() === 'PUT') &&
        resp.url().includes('/api/')) {
      apiResponses.push({ url: resp.url(), status: resp.status() });
    }
  });

  await saveBtn.click();
  // Wait for save to complete (network + state update)
  await page.waitForTimeout(2500);

  // ── STEP 8: Screenshot after save — should be back in view mode ──────────────
  console.log('\n=== STEP 8: Screenshot after save ===');

  // Check if returned to view mode
  const editBtnAfterSave = await page.$('[data-testid="btn-edit-account"]');
  const saveBtnAfterSave = await page.$('[data-testid="btn-save-account"]');
  console.log(`Returned to view mode (Edit button visible): ${editBtnAfterSave ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log(`Save button gone: ${!saveBtnAfterSave ? 'YES (PASS)' : 'NO (still in edit mode — FAIL)'}`);

  // Log network activity
  if (apiRequests.length > 0) {
    console.log('API requests sent during save:');
    apiRequests.forEach(r => console.log(`  ${r.method} ${r.url}`));
    if (apiRequests[0].postData) {
      console.log('  Request body:', apiRequests[0].postData);
    }
  } else {
    console.log('WARNING: No PATCH/PUT requests observed during save');
  }
  if (apiResponses.length > 0) {
    console.log('API responses:');
    apiResponses.forEach(r => console.log(`  ${r.status} ${r.url}`));
  }

  // Scroll to show Schedule section
  await page.evaluate(() => {
    const dialogContent = document.querySelector('[data-testid="account-detail-dialog"]');
    if (dialogContent) dialogContent.scrollTop = 300;
  });
  await page.waitForTimeout(200);

  const valueAfterSave = await getBusinessHoursOpenText(page);
  console.log(`Business Hours Open after save: "${valueAfterSave}"`);
  console.log(`Shows "10:00 AM": ${valueAfterSave && valueAfterSave.includes('10:00') ? 'YES (PASS)' : `NO (FAIL — got: "${valueAfterSave}")`}`);

  await shot(page, '05-after-save-view-mode');

  // ── STEP 9: Close the dialog ─────────────────────────────────────────────────
  console.log('\n=== STEP 9: Close the dialog ===');
  const closeBtn = await page.$('[data-testid="btn-close-detail"]');
  if (closeBtn) {
    await closeBtn.click();
  } else {
    // Try pressing Escape
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(800);

  const dialogAfterClose = await page.$('[data-testid="account-detail-dialog"]');
  console.log(`Dialog closed: ${!dialogAfterClose ? 'YES (PASS)' : 'NO (FAIL)'}`);
  await shot(page, '06-after-close');

  // ── STEP 10: Re-click "van de Kerkhof" row (persistence check) ───────────────
  console.log('\n=== STEP 10: Re-open "van de Kerkhof" to verify persistence ===');
  const found2 = await clickVanDeKerkhofRow(page);
  if (!found2) {
    console.log('FAIL: Could not find "van de Kerkhof" row on second open');
    await browser.close();
    return;
  }

  await page.waitForTimeout(800);

  const dialog2 = await page.$('[data-testid="account-detail-dialog"]');
  if (!dialog2) {
    console.log('FAIL: Dialog did not open on second click');
    await browser.close();
    return;
  }

  // Scroll to Schedule section
  await page.evaluate(() => {
    const dialogContent = document.querySelector('[data-testid="account-detail-dialog"]');
    if (dialogContent) dialogContent.scrollTop = 300;
  });
  await page.waitForTimeout(300);

  const valueAfterReopen = await getBusinessHoursOpenText(page);
  console.log(`Business Hours Open after reopen: "${valueAfterReopen}"`);

  const persisted = valueAfterReopen && valueAfterReopen.includes('10:00');
  console.log(`\n*** PERSISTENCE CHECK: Data saved to DB? ${persisted ? 'YES — PASS' : 'NO — FAIL'} ***`);
  if (!persisted) {
    console.log(`  Expected "10:00 AM", got "${valueAfterReopen}"`);
    console.log('  This indicates the save did not persist to the database.');
  }

  await shot(page, '07-reopened-persistence-check');

  // ── STEP 11: Edit again and restore to "09:00" ──────────────────────────────
  console.log('\n=== STEP 11: Restore to "09:00" ===');
  const editBtn2 = await page.$('[data-testid="btn-edit-account"]');
  if (!editBtn2) {
    console.log('FAIL: Edit button not found for restore step');
    await browser.close();
    return;
  }
  await editBtn2.click();
  await page.waitForTimeout(500);

  const timeInput2 = await page.$('[data-testid="field-business_hours_start"]');
  if (timeInput2) {
    await timeInput2.fill('09:00');
    const restoreValue = await timeInput2.inputValue();
    console.log(`Restore input value: "${restoreValue}"`);
  } else {
    console.log('WARNING: Could not find time input for restore step');
  }

  await shot(page, '08-restore-edit-mode');

  // ── STEP 12: Save the restore ────────────────────────────────────────────────
  console.log('\n=== STEP 12: Save restoration to 09:00 ===');
  const saveBtn2 = await page.$('[data-testid="btn-save-account"]');
  if (!saveBtn2) {
    console.log('FAIL: Save button not found during restore');
    await browser.close();
    return;
  }
  await saveBtn2.click();
  await page.waitForTimeout(2500);

  const valueAfterRestore = await getBusinessHoursOpenText(page);
  console.log(`Business Hours Open after restore: "${valueAfterRestore}"`);
  console.log(`Restored to "09:00 AM": ${valueAfterRestore && valueAfterRestore.includes('09:00') ? 'YES (PASS)' : `NO (check value: "${valueAfterRestore}")`}`);

  await shot(page, '09-after-restore');

  // ── STEP 13: Close browser ───────────────────────────────────────────────────
  console.log('\n=== STEP 13: Close browser ===');
  if (consoleErrors.length > 0) {
    console.log(`Console errors encountered (${consoleErrors.length}):`);
    consoleErrors.forEach(e => console.log('  ERROR:', e));
  } else {
    console.log('No console errors');
  }

  await browser.close();
  console.log('\n=== Test complete ===');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
