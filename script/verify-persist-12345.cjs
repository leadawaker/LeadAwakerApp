const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'persist-verify');
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
  await page.setViewportSize({ width: 1440, height: 900 });

  // Collect all console messages
  const consoleMessages = [];
  const consoleErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') consoleErrors.push(text);
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });

  // ── STEP 1: Login ──────────────────────────────────────────────────────────
  console.log('\n=== STEP 1: Login ===');
  await login(page);

  // ── STEP 2: Navigate to /agency/accounts ──────────────────────────────────
  console.log('\n=== STEP 2: Navigate to /agency/accounts ===');
  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot(page, '01-accounts-page');
  console.log('Current URL:', page.url());

  // ── STEP 3: Find the first data row and click it ──────────────────────────
  console.log('\n=== STEP 3: Find TEST_CREATE_12345 (row-34) ===');
  // Rows have id="row-{Id}" — find the first one
  const firstRow = await page.$('tr[id="row-34"]');
  if (!firstRow) {
    console.log('FAIL: row-34 (TEST_CREATE_12345) not found in table');
    await shot(page, '02-no-rows');
    await browser.close();
    return;
  }

  // Get the row id to identify which account we clicked
  const rowId = await firstRow.getAttribute('id');
  console.log('Clicking row:', rowId);

  // Click a non-checkbox cell in the row (second cell = first data column)
  const cells = await firstRow.$$('td');
  if (cells.length > 1) {
    await cells[1].click(); // skip checkbox cell (index 0)
  } else {
    await firstRow.click();
  }

  await page.waitForTimeout(800);
  await shot(page, '02-after-row-click');

  // ── STEP 4: Verify dialog is open ─────────────────────────────────────────
  console.log('\n=== STEP 4: Verify detail dialog ===');
  const dialog = await page.$('[data-testid="account-detail-dialog"]');
  console.log('Dialog visible:', dialog ? 'YES (PASS)' : 'NO (FAIL)');

  if (!dialog) {
    console.log('FAIL: Dialog did not open after row click');
    await browser.close();
    return;
  }

  // Gather all visible field data-testids inside the dialog
  const fieldEls = await page.$$('[data-testid^="field-"]');
  const fieldIds = [];
  for (const el of fieldEls) {
    const tid = await el.getAttribute('data-testid');
    fieldIds.push(tid);
  }
  console.log('Fields visible in dialog:', fieldIds);

  // ── STEP 5: Click Edit button ──────────────────────────────────────────────
  console.log('\n=== STEP 5: Click Edit button ===');
  const editBtn = await page.$('[data-testid="btn-edit-account"]');
  console.log('Edit button found:', editBtn ? 'YES' : 'NO');
  if (!editBtn) {
    console.log('FAIL: Edit button not found');
    await browser.close();
    return;
  }
  await editBtn.click();
  await page.waitForTimeout(500);
  await shot(page, '03-edit-mode');

  // ── STEP 6: Find notes textarea and update it ─────────────────────────────
  console.log('\n=== STEP 6: Edit notes field ===');
  const notesField = await page.$('[data-testid="field-notes"]');
  console.log('Notes field found:', notesField ? 'YES' : 'NO');
  if (!notesField) {
    console.log('FAIL: Notes textarea (data-testid="field-notes") not found');
    // List all field testids in edit mode
    const editFields = await page.$$('[data-testid^="field-"]');
    const editFieldIds = [];
    for (const el of editFields) {
      const tid = await el.getAttribute('data-testid');
      editFieldIds.push(tid);
    }
    console.log('Fields in edit mode:', editFieldIds);
    await browser.close();
    return;
  }

  // Clear the textarea and type the test value
  const tagName = await notesField.evaluate(el => el.tagName.toLowerCase());
  console.log('Notes field tag:', tagName);
  await notesField.click({ clickCount: 3 });
  await notesField.fill('FINAL_VERIFY_TEST');
  const notesValue = await notesField.inputValue();
  console.log('Notes value after fill:', notesValue);
  console.log('Notes fill correct:', notesValue === 'FINAL_VERIFY_TEST' ? 'PASS' : `FAIL (got: ${notesValue})`);

  await shot(page, '04-notes-filled');

  // ── STEP 7: Click Save Changes button ─────────────────────────────────────
  console.log('\n=== STEP 7: Click Save Changes ===');
  const saveBtn = await page.$('[data-testid="btn-save-account"]');
  console.log('Save button found:', saveBtn ? 'YES' : 'NO');
  if (!saveBtn) {
    console.log('FAIL: Save button not found');
    await browser.close();
    return;
  }
  await saveBtn.click();
  // Wait for save to complete and return to view mode
  await page.waitForTimeout(2000);
  await shot(page, '05-after-save');

  // ── STEP 8: Verify back in view mode ──────────────────────────────────────
  console.log('\n=== STEP 8: Verify save succeeded ===');
  const editBtnAfterSave = await page.$('[data-testid="btn-edit-account"]');
  const saveBtnAfterSave = await page.$('[data-testid="btn-save-account"]');
  console.log('Edit button visible (view mode):', editBtnAfterSave ? 'YES (PASS)' : 'NO');
  console.log('Save button gone (edit mode closed):', !saveBtnAfterSave ? 'YES (PASS)' : 'NO (FAIL - still in edit mode)');

  // Verify notes field in view mode shows updated value
  const notesViewEl = await page.$('[data-testid="field-notes"]');
  if (notesViewEl) {
    const viewTagName = await notesViewEl.evaluate(el => el.tagName.toLowerCase());
    let notesDisplayValue = '';
    if (viewTagName === 'textarea' || viewTagName === 'input') {
      notesDisplayValue = await notesViewEl.inputValue();
    } else {
      notesDisplayValue = await notesViewEl.textContent();
    }
    console.log('Notes display value after save:', notesDisplayValue.trim());
    console.log('Notes shows FINAL_VERIFY_TEST:', notesDisplayValue.trim() === 'FINAL_VERIFY_TEST' ? 'PASS' : `FAIL (got: ${notesDisplayValue.trim()})`);
  } else {
    // In view mode, notes might be displayed differently
    console.log('Notes field (data-testid="field-notes") not found in view mode');
    // Try to find any text containing FINAL_VERIFY_TEST
    const pageContent = await page.content();
    const found = pageContent.includes('FINAL_VERIFY_TEST');
    console.log('FINAL_VERIFY_TEST found anywhere in dialog content:', found ? 'YES (PASS)' : 'NO (FAIL)');
  }

  await shot(page, '06-view-mode-after-save');

  // ── STEP 9: Console summary ────────────────────────────────────────────────
  console.log('\n=== STEP 9: Console errors ===');
  console.log('Total console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log(' ERROR:', e));
  } else {
    console.log('No console errors (PASS)');
  }

  await browser.close();
  console.log('\n=== Test complete ===');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
