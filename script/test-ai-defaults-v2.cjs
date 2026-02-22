const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'ai-defaults');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  console.log('Screenshot:', fp);
  return fp;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // STEP 1: Login
  console.log('\n=== STEP 1: Login ===');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  await shot(page, '00-login-page');

  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('Logged in, current URL:', page.url());
  await shot(page, '01-after-login');

  // STEP 2: Navigate to accounts page
  console.log('\n=== STEP 2: Navigate to accounts page ===');
  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);
  console.log('Accounts page URL:', page.url());
  await shot(page, '02-accounts-page');

  // STEP 3: Find and click a row - use the row ID attribute to target the right row
  // and click on the "Id" cell (first column after checkbox, not the status dropdown)
  console.log('\n=== STEP 3: Click on an account row ===');

  // Get list of rows to find one to click
  const rowIds = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr[id^="row-"]');
    return Array.from(rows).map(r => ({
      id: r.id,
      text: r.textContent?.trim().substring(0, 100)
    }));
  });
  console.log('Found rows with IDs:', rowIds);

  let clicked = false;

  if (rowIds.length > 0) {
    // Click on the "van de Kerkhof" row or fallback to first data row
    let targetRowId = rowIds.find(r => r.text?.includes('van de Kerkhof'))?.id
      || rowIds.find(r => r.text?.includes('Astra'))?.id
      || rowIds[0]?.id;

    if (targetRowId) {
      console.log(`Clicking row: ${targetRowId}`);

      // Click specifically on the Id cell (3rd cell, after checkbox and Image columns)
      // We'll use JS to click the row element directly to trigger the onRowClick handler
      await page.evaluate((rowId) => {
        const row = document.getElementById(rowId);
        if (row) {
          // Find the Id cell (the # column) - first non-checkbox td
          const cells = row.querySelectorAll('td');
          // cells[0] = checkbox, cells[1] = Id number
          if (cells.length > 1) {
            cells[1].click();
          }
        }
      }, targetRowId);

      clicked = true;
      await page.waitForTimeout(800);
    }
  }

  if (!clicked) {
    console.log('Could not find row by ID, trying first tbody row');
    await page.click('tbody tr:first-child td:nth-child(2)');
    await page.waitForTimeout(800);
  }

  await shot(page, '03-after-row-click');

  // STEP 4: Check if dialog opened
  console.log('\n=== STEP 4: Check dialog opened ===');
  const dialogEl = await page.$('[data-testid="account-detail-dialog"]');
  console.log('AccountDetailsDialog found:', dialogEl ? 'YES (PASS)' : 'NO');

  if (!dialogEl) {
    // Try clicking a different way
    console.log('Dialog not found, trying alternative click method...');

    // Try clicking on the Campaign Name cell text
    const accountNameCell = await page.$('tbody tr td:nth-child(3)');
    if (accountNameCell) {
      const cellText = await accountNameCell.textContent();
      console.log('Clicking on account name cell:', cellText?.trim());
      await accountNameCell.click();
      await page.waitForTimeout(800);
      await shot(page, '03b-after-name-click');
    }
  }

  const dialog = await page.$('[data-testid="account-detail-dialog"]');
  console.log('Dialog after retry:', dialog ? 'FOUND' : 'NOT FOUND');

  if (dialog) {
    const dialogTitle = await page.$('text=van de Kerkhof, text=Astra, h2, [role="dialog"] h2');
    const titleEl = await page.$('[role="dialog"] [class*="DialogTitle"], [role="dialog"] h2, [role="dialog"] h3');
    if (titleEl) {
      const titleText = await titleEl.textContent();
      console.log('Dialog title:', titleText?.trim());
    }
  }

  await shot(page, '04-dialog-state');

  // STEP 5: If dialog is open, check its content
  console.log('\n=== STEP 5: Check dialog content ===');

  const dialogTestId = await page.$('[data-testid="account-detail-dialog"]');
  if (dialogTestId) {
    // Get all visible text in dialog
    const dialogContent = await dialogTestId.evaluate(el => el.innerText?.substring(0, 500));
    console.log('Dialog content preview:', dialogContent);

    // Scroll to AI section
    await dialogTestId.evaluate(el => { el.scrollTop = 600; });
    await page.waitForTimeout(300);
    await shot(page, '05-dialog-scrolled-to-ai');

    // Check for AI fields by label text
    const aiSectionCheck = await page.evaluate(() => {
      const allText = document.body.innerText;
      return {
        hasAIMessagingHeader: allText.includes('AI & Messaging') || allText.includes('AI &amp; Messaging'),
        hasAIName: allText.includes('AI Name'),
        hasAIRole: allText.includes('AI Role'),
        hasAIStyle: allText.includes('AI Style'),
        hasTypoFrequency: allText.includes('Typo Frequency'),
      };
    });
    console.log('AI section check:', JSON.stringify(aiSectionCheck, null, 2));

    // Get the actual field values using data-testid
    const fieldValues = await page.evaluate(() => {
      const fields = ['default_ai_name', 'default_ai_role', 'default_ai_style', 'default_typo_frequency'];
      const result = {};
      for (const field of fields) {
        const el = document.querySelector(`[data-testid="field-${field}"]`);
        result[field] = el ? (el.value || el.textContent) : null;
        if (!result[field]) {
          // Also try select trigger
          const selectTrigger = document.querySelector(`[data-testid="field-${field}"] + *, [id="${field}"]`);
          result[field + '_selector_found'] = el ? 'element found' : 'NOT FOUND';
        }
      }
      return result;
    });
    console.log('Field values by data-testid:', JSON.stringify(fieldValues, null, 2));

    // Also get label + value pairs by finding labels in dialog
    const labelValues = await page.evaluate(() => {
      const result = {};
      const dialog = document.querySelector('[data-testid="account-detail-dialog"]');
      if (!dialog) return result;

      const labels = dialog.querySelectorAll('label');
      for (const label of labels) {
        const labelText = label.textContent?.trim() || '';
        // Get the sibling field value
        const fieldContainer = label.closest('div[class*="grid"]');
        if (fieldContainer) {
          const input = fieldContainer.querySelector('input, textarea');
          const selectSpan = fieldContainer.querySelector('[data-radix-select-trigger] span, [role="combobox"] span');
          result[labelText] = input?.value || selectSpan?.textContent?.trim() || '(no value found)';
        }
      }
      return result;
    });
    console.log('\nLabel => Value pairs in dialog:');
    for (const [label, value] of Object.entries(labelValues)) {
      console.log(`  "${label}": "${value}"`);
    }

  } else {
    console.log('Dialog not open - cannot check AI fields');

    // Debug: check page structure
    const pageInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        rowsFound: document.querySelectorAll('tr[id^="row-"]').length,
        dialogsFound: document.querySelectorAll('[role="dialog"]').length,
        openDialogs: document.querySelectorAll('[data-state="open"]').length,
      };
    });
    console.log('Page debug info:', pageInfo);
  }

  await shot(page, '06-final-state');

  // STEP 6: Console errors
  console.log('\n=== STEP 6: Console errors ===');
  console.log('Total JS errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e, i) => console.log(`  Error ${i + 1}: ${e}`));
  } else {
    console.log('No console errors.');
  }

  // Summary
  const finalCheck = await page.evaluate(() => {
    const allText = document.body.innerText;
    const dialog = document.querySelector('[data-testid="account-detail-dialog"]');
    return {
      dialogOpen: !!dialog,
      'AI Name visible': allText.includes('AI Name'),
      'AI Role visible': allText.includes('AI Role'),
      'AI Style visible': allText.includes('AI Style'),
      'Typo Frequency visible': allText.includes('Typo Frequency'),
    };
  });

  console.log('\n=== FINAL SUMMARY ===');
  console.log('Dialog open:', finalCheck.dialogOpen ? 'YES' : 'NO');
  console.log('AI Name label:', finalCheck['AI Name visible'] ? 'PASS' : 'FAIL');
  console.log('AI Role label:', finalCheck['AI Role visible'] ? 'PASS' : 'FAIL');
  console.log('AI Style label:', finalCheck['AI Style visible'] ? 'PASS' : 'FAIL');
  console.log('Typo Frequency label:', finalCheck['Typo Frequency visible'] ? 'PASS' : 'FAIL');

  await browser.close();
  console.log('\nTest complete. Screenshots in:', SCREENSHOT_DIR);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
