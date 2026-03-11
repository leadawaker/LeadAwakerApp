const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'feat-167');
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
  page.setViewportSize({ width: 1400, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await login(page);

  // Navigate to Tags page
  await page.goto('http://localhost:5173/agency/tags', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tags-page"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid^="tag-category-"]', { timeout: 15000 });
  await page.waitForTimeout(800);
  console.log('Tags page loaded');

  // STEP 1: Take screenshot to confirm tags page loaded
  await shot(page, '01-tags-page-loaded');
  console.log('STEP 1 - Tags page loaded: PASS');

  // STEP 2: Take a snapshot to find element refs - list all tag items
  const tagItems = await page.$$('[data-testid^="tag-item-"]');
  console.log(`STEP 2 - Found ${tagItems.length} tag items on page`);

  // Print out ids of available tags
  const tagTestIds = [];
  for (const ti of tagItems) {
    const testId = await ti.getAttribute('data-testid');
    tagTestIds.push(testId);
  }
  console.log('STEP 2 - Tag item testids:', tagTestIds.slice(0, 10).join(', '));

  // STEP 3: Hover over a tag card to reveal the delete button
  // Try to find the first tag item and hover to reveal controls
  let firstTagId = null;
  let firstTagCard = null;

  // Try known IDs first (from previous tests we know IDs like 2, 4, 5, etc.)
  const knownIds = [2, 4, 5, 11, 13, 14];
  for (const id of knownIds) {
    const card = await page.$(`[data-testid="tag-item-${id}"]`);
    if (card) {
      firstTagId = id;
      firstTagCard = card;
      console.log(`STEP 3 - Found tag card with ID ${id}`);
      break;
    }
  }

  if (!firstTagCard && tagItems.length > 0) {
    firstTagCard = tagItems[0];
    const testId = await firstTagCard.getAttribute('data-testid');
    firstTagId = testId.replace('tag-item-', '');
    console.log(`STEP 3 - Using first available tag: ${testId}`);
  }

  if (!firstTagCard) {
    console.log('STEP 3 - FAIL: No tag cards found on page');
    await shot(page, '03-no-tags-found');
    await browser.close();
    process.exit(1);
  }

  // Hover over the tag card to reveal delete button
  await firstTagCard.hover();
  await page.waitForTimeout(500);
  await shot(page, '03-hovered-tag-card');
  console.log(`STEP 3 - Hovered over tag card ID ${firstTagId}`);

  // STEP 4: Click the delete button on the tag
  let deleteBtn = await page.$(`[data-testid="button-delete-tag-${firstTagId}"]`);

  // If the specific testid not found, try generic delete button hover reveal
  if (!deleteBtn) {
    console.log(`STEP 4 - button-delete-tag-${firstTagId} not found directly, trying to find any delete button in hovered card`);
    // Try clicking on the hovered card area and look for delete
    deleteBtn = await page.$('[data-testid^="button-delete-tag-"]');
  }

  if (!deleteBtn) {
    console.log('STEP 4 - FAIL: Delete button not found after hover');
    await shot(page, '04-delete-btn-not-found');
    // Try to take a snapshot of what's available
    const allButtons = await page.$$('button');
    console.log(`Found ${allButtons.length} buttons total`);
    await browser.close();
    process.exit(1);
  }

  console.log(`STEP 4 - Delete button found: PASS`);
  await deleteBtn.click();
  await page.waitForTimeout(600);
  await shot(page, '04-after-delete-click');

  // STEP 5: Verify confirmation dialog appeared
  const dialog = await page.$('[data-testid="dialog-delete-tag"]');
  if (dialog) {
    console.log('STEP 5 - Confirmation dialog appeared: PASS');
  } else {
    // Try alternative selectors
    const dialogAlt = await page.$('[role="dialog"]');
    if (dialogAlt) {
      console.log('STEP 5 - Confirmation dialog appeared (via role=dialog): PASS');
    } else {
      console.log('STEP 5 - FAIL: Confirmation dialog did NOT appear');
    }
  }
  await shot(page, '05-confirmation-dialog');

  // STEP 6: Click Cancel button and verify tag still exists
  const cancelBtn = await page.$('[data-testid="button-cancel-delete-tag"]');
  if (cancelBtn) {
    console.log('STEP 6 - Cancel button found: PASS');
    await cancelBtn.click();
    await page.waitForTimeout(600);
    console.log('STEP 6 - Clicked cancel');
  } else {
    // Try generic cancel/close button
    const cancelGeneric = await page.$('button:has-text("Cancel")');
    if (cancelGeneric) {
      console.log('STEP 6 - Cancel button found (generic): PASS');
      await cancelGeneric.click();
      await page.waitForTimeout(600);
    } else {
      console.log('STEP 6 - WARN: Cancel button not found, pressing Escape');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }
  }

  // Verify tag still exists after cancel
  const tagStillExists = await page.$(`[data-testid="tag-item-${firstTagId}"]`);
  if (tagStillExists) {
    console.log(`STEP 6 - Tag ${firstTagId} still exists after cancel: PASS`);
  } else {
    console.log(`STEP 6 - FAIL: Tag ${firstTagId} was deleted even though user clicked cancel`);
  }
  await shot(page, '06-after-cancel-tag-still-exists');

  // STEP 7: Create a test tag "FEAT167_TEST_DELETE"
  console.log('\n--- Creating test tag FEAT167_TEST_DELETE ---');
  const createBtn = await page.$('[data-testid="button-create-tag"]');
  if (createBtn) {
    console.log('STEP 7 - Create tag button found: PASS');
    await createBtn.click();
    await page.waitForTimeout(600);
    await shot(page, '07-create-tag-dialog-open');
  } else {
    console.log('STEP 7 - FAIL: Create tag button not found');
    await shot(page, '07-create-btn-not-found');
    await browser.close();
    process.exit(1);
  }

  // Fill in the tag name
  const nameInput = await page.$('[data-testid="input-tag-name"]');
  if (nameInput) {
    await nameInput.fill('FEAT167_TEST_DELETE');
    console.log('STEP 7 - Tag name filled: PASS');
  } else {
    // Try generic name input
    const nameInputGeneric = await page.$('input[placeholder*="name" i], input[placeholder*="tag" i], input[name="name"]');
    if (nameInputGeneric) {
      await nameInputGeneric.fill('FEAT167_TEST_DELETE');
      console.log('STEP 7 - Tag name filled (generic input): PASS');
    } else {
      console.log('STEP 7 - WARN: Name input not found, trying first input in dialog');
      const firstInput = await page.$('[role="dialog"] input');
      if (firstInput) {
        await firstInput.fill('FEAT167_TEST_DELETE');
        console.log('STEP 7 - Tag name filled via dialog first input: PASS');
      }
    }
  }

  // Select blue color if possible
  const blueColorBtn = await page.$('[data-testid="color-option-blue"], [data-testid*="color"][data-testid*="blue"]');
  if (blueColorBtn) {
    await blueColorBtn.click();
    console.log('STEP 7 - Blue color selected: PASS');
  } else {
    // Try to find any color swatch
    const colorSwatch = await page.$('[data-testid^="color-swatch-"], [data-testid^="color-option-"]');
    if (colorSwatch) {
      await colorSwatch.click();
      console.log('STEP 7 - Color selected (first available): PASS');
    } else {
      console.log('STEP 7 - SKIP: No color picker found, continuing without color selection');
    }
  }

  await shot(page, '07b-create-tag-form-filled');

  // Submit the create tag form
  const submitBtn = await page.$('[data-testid="button-submit-tag"], [data-testid="button-save-tag"], [data-testid="button-create-tag-submit"]');
  if (submitBtn) {
    await submitBtn.click();
    console.log('STEP 7 - Clicked submit (testid): PASS');
  } else {
    const submitGeneric = await page.$('button[type="submit"], [role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Add")');
    if (submitGeneric) {
      await submitGeneric.click();
      console.log('STEP 7 - Clicked submit (generic): PASS');
    } else {
      console.log('STEP 7 - FAIL: Submit button not found');
      await shot(page, '07c-submit-not-found');
    }
  }

  await page.waitForTimeout(1500);
  await shot(page, '08-after-tag-created');

  // STEP 8: Find the newly created test tag
  console.log('\n--- Finding newly created test tag ---');
  // Look for a tag with name FEAT167_TEST_DELETE
  const allTagItemsAfterCreate = await page.$$('[data-testid^="tag-item-"]');
  let testTagId = null;
  let testTagCard = null;

  for (const ti of allTagItemsAfterCreate) {
    const text = await ti.textContent();
    if (text && text.includes('FEAT167_TEST_DELETE')) {
      const testId = await ti.getAttribute('data-testid');
      testTagId = testId.replace('tag-item-', '');
      testTagCard = ti;
      console.log(`STEP 8 - Found test tag with testid: ${testId}`);
      break;
    }
  }

  if (!testTagCard) {
    // Try to find by text in the page
    const tagByText = await page.$('text=FEAT167_TEST_DELETE');
    if (tagByText) {
      console.log('STEP 8 - Found test tag by text (but no testid match)');
      // Try to get the parent card
      testTagCard = await tagByText.evaluateHandle(el => el.closest('[data-testid^="tag-item-"]'));
      if (testTagCard) {
        testTagId = await testTagCard.evaluate(el => el.getAttribute('data-testid').replace('tag-item-', ''));
        console.log(`STEP 8 - Test tag ID from parent: ${testTagId}`);
      }
    } else {
      console.log('STEP 8 - WARN: Test tag FEAT167_TEST_DELETE not found in DOM, searching via API');
    }
  }

  if (!testTagCard) {
    console.log('STEP 8 - FAIL: Test tag not found after creation');
    await shot(page, '08-test-tag-not-found');
    await browser.close();
    process.exit(1);
  }

  console.log(`STEP 8 - Test tag found (ID: ${testTagId}): PASS`);

  // STEP 9: Hover over the test tag to reveal delete button
  await testTagCard.hover();
  await page.waitForTimeout(500);
  await shot(page, '09-hovered-test-tag');
  console.log('STEP 9 - Hovered over test tag card');

  // STEP 10: Click delete on the test tag
  let testDeleteBtn = await page.$(`[data-testid="button-delete-tag-${testTagId}"]`);
  if (!testDeleteBtn) {
    testDeleteBtn = await page.$('[data-testid^="button-delete-tag-"]');
  }

  if (!testDeleteBtn) {
    console.log('STEP 10 - FAIL: Delete button not found for test tag');
    await shot(page, '10-test-delete-btn-not-found');
    await browser.close();
    process.exit(1);
  }

  await testDeleteBtn.click();
  await page.waitForTimeout(600);
  await shot(page, '10-confirmation-dialog-for-test-tag');
  console.log('STEP 10 - Clicked delete on test tag: PASS');

  // STEP 11: Verify confirmation dialog shows the tag name "FEAT167_TEST_DELETE"
  const dialogForTest = await page.$('[data-testid="dialog-delete-tag"]');
  if (dialogForTest) {
    const dialogText = await dialogForTest.textContent();
    const hasTagName = dialogText && dialogText.includes('FEAT167_TEST_DELETE');
    console.log(`STEP 11 - Confirmation dialog appeared: PASS`);
    console.log(`STEP 11 - Dialog shows tag name "FEAT167_TEST_DELETE": ${hasTagName ? 'PASS' : 'FAIL'}`);
    if (!hasTagName) {
      console.log(`STEP 11 - Dialog content: "${dialogText?.substring(0, 200)}"`);
    }
  } else {
    // Try role=dialog
    const dialogAlt = await page.$('[role="dialog"]');
    if (dialogAlt) {
      const dialogText = await dialogAlt.textContent();
      const hasTagName = dialogText && dialogText.includes('FEAT167_TEST_DELETE');
      console.log(`STEP 11 - Confirmation dialog appeared (role=dialog): PASS`);
      console.log(`STEP 11 - Dialog shows tag name "FEAT167_TEST_DELETE": ${hasTagName ? 'PASS' : 'FAIL'}`);
      if (!hasTagName) {
        console.log(`STEP 11 - Dialog content: "${dialogText?.substring(0, 300)}"`);
      }
    } else {
      console.log('STEP 11 - FAIL: Confirmation dialog did NOT appear for test tag');
    }
  }

  // STEP 12: Click confirm delete
  const confirmBtn = await page.$('[data-testid="button-confirm-delete-tag"]');
  if (confirmBtn) {
    console.log('STEP 12 - Confirm delete button found: PASS');
    await confirmBtn.click();
    await page.waitForTimeout(1500);
    console.log('STEP 12 - Clicked confirm delete: PASS');
  } else {
    // Try generic confirm button
    const confirmGeneric = await page.$('button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")');
    if (confirmGeneric) {
      const btnText = await confirmGeneric.textContent();
      console.log(`STEP 12 - Confirm button found via text "${btnText}": PASS`);
      await confirmGeneric.click();
      await page.waitForTimeout(1500);
      console.log('STEP 12 - Clicked confirm delete (generic): PASS');
    } else {
      console.log('STEP 12 - FAIL: Confirm delete button not found');
      await shot(page, '12-confirm-btn-not-found');
      await browser.close();
      process.exit(1);
    }
  }

  await shot(page, '12-after-confirm-delete');

  // STEP 13: Verify the tag is removed from the list
  await page.waitForTimeout(500);

  const tagGone = await page.$(`[data-testid="tag-item-${testTagId}"]`);
  if (!tagGone) {
    console.log(`STEP 13 - Test tag removed from list: PASS`);
  } else {
    // Double-check by looking for the text
    const tagTextGone = await page.$('text=FEAT167_TEST_DELETE');
    if (!tagTextGone) {
      console.log(`STEP 13 - Test tag text removed from list: PASS`);
    } else {
      console.log(`STEP 13 - FAIL: Test tag still present in list after confirmation`);
    }
  }

  // Check for success toast
  const successToast = await page.$('[data-testid*="toast"], .toast, [role="status"]');
  if (successToast) {
    const toastText = await successToast.textContent();
    console.log(`STEP 13 - Success toast appeared: PASS (text: "${toastText?.trim().substring(0, 100)}")`);
  } else {
    console.log('STEP 13 - NOTE: Success toast not detected (may have already dismissed)');
  }

  await shot(page, '13-tag-deleted-final-state');

  // STEP 14: Console errors summary
  console.log('\n--- Console Errors ---');
  console.log(`Total JS errors: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach(e => console.log('  ERROR:', e));
    console.log(`Console errors: WARN (${errors.length} errors found)`);
  } else {
    console.log('Console errors: PASS (0 errors)');
  }

  await browser.close();
  console.log('\nTest complete - Feature #167 Delete tag with confirmation');
}

main().catch(err => {
  console.error('Test failed with exception:', err.message);
  process.exit(1);
});
