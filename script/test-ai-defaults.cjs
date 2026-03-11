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

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  await shot(page, '00-login-page');

  // Check for login form
  const emailInput = await page.$('[data-testid="input-email"]');
  const passwordInput = await page.$('[data-testid="input-password"]');
  console.log('Login form - email input:', emailInput ? 'FOUND' : 'NOT FOUND');
  console.log('Login form - password input:', passwordInput ? 'FOUND' : 'NOT FOUND');

  if (emailInput && passwordInput) {
    await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
    await page.fill('[data-testid="input-password"]', 'test123');
    await page.click('[data-testid="button-login"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('Logged in, current URL:', page.url());
    await shot(page, '01-after-login');
  } else {
    console.log('Login form not found, may already be logged in');
    await shot(page, '01-no-login-form');
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1280, height: 900 });

  // Collect console errors
  const consoleErrors = [];
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warn') {
      consoleLogs.push('[WARN] ' + msg.text());
    }
  });

  // STEP 1: Login
  console.log('\n=== STEP 1: Login ===');
  await login(page);

  // STEP 2: Navigate to accounts page
  console.log('\n=== STEP 2: Navigate to accounts page ===');
  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
  console.log('Accounts page URL:', page.url());
  await shot(page, '02-accounts-page');

  // Check for accounts list
  await page.waitForTimeout(1000);
  const accountRows = await page.$$('tr, [data-testid*="account"], [role="row"]');
  console.log('Account rows found:', accountRows.length);

  // STEP 3: Find and click on an account row
  console.log('\n=== STEP 3: Click on account row ===');

  // Try to find a clickable row - look for account names
  const allText = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    return Array.from(rows).slice(0, 5).map(r => r.textContent?.trim().substring(0, 100));
  });
  console.log('Table rows text (first 5):', allText);

  // Try clicking the first data row (skip header)
  let clicked = false;

  // Try various selectors for account rows
  const rowSelectors = [
    'tbody tr:first-child',
    'tr:nth-child(2)',
    '[data-testid*="account-row"]',
    '[role="row"]:nth-child(2)',
  ];

  for (const sel of rowSelectors) {
    const el = await page.$(sel);
    if (el) {
      const text = await el.textContent();
      console.log(`Clicking row with selector "${sel}", text: ${text?.trim().substring(0, 80)}`);
      await el.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    // Try clicking any link/button that could open an account
    const links = await page.$$('a[href*="account"], button');
    if (links.length > 0) {
      console.log('Clicking first available link/button');
      await links[0].click();
      clicked = true;
    }
  }

  await page.waitForTimeout(1500);
  await shot(page, '03-after-click');

  // STEP 4: Look for dialog
  console.log('\n=== STEP 4: Check dialog ===');
  const dialog = await page.$('[role="dialog"], [data-testid*="dialog"], .dialog, [aria-modal="true"]');
  console.log('Dialog found:', dialog ? 'YES' : 'NO');

  if (dialog) {
    const dialogText = await dialog.evaluate(el => el.textContent?.substring(0, 200));
    console.log('Dialog content preview:', dialogText);
  }

  await shot(page, '04-dialog-open');

  // STEP 5: Scroll to find AI & Messaging section
  console.log('\n=== STEP 5: Scroll to AI & Messaging section ===');

  // Try to find the AI section by scrolling the dialog
  const aiSectionSelectors = [
    '[data-testid*="ai"]',
    '[data-testid*="AI"]',
    'text=AI & Messaging',
    '[aria-label*="AI"]',
  ];

  // Look for AI-related text
  const aiSection = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.textContent?.includes('AI & Messaging') && el.children.length < 5) {
        return {
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 100),
          id: el.id,
          className: el.className?.substring(0, 80)
        };
      }
    }
    return null;
  });
  console.log('AI & Messaging section element:', aiSection);

  // Scroll down in dialog to find AI section
  if (dialog) {
    await dialog.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
  }

  // Also try scrolling the page
  await page.evaluate(() => {
    // Find scrollable dialog
    const dialogs = document.querySelectorAll('[role="dialog"], [data-radix-dialog-content]');
    for (const d of dialogs) {
      d.scrollTop = 500;
    }
  });
  await page.waitForTimeout(500);

  await shot(page, '05-dialog-scrolled');

  // STEP 6: Find AI fields
  console.log('\n=== STEP 6: Find AI fields ===');

  const aiFields = await page.evaluate(() => {
    const fields = {};

    // Look for labels with AI field names
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const text = label.textContent?.trim();
      if (text === 'AI Name' || text?.includes('AI Name')) {
        const forId = label.getAttribute('for');
        const input = forId ? document.getElementById(forId) : label.closest('div')?.querySelector('input, select, [role="combobox"]');
        fields['AI Name'] = {
          found: true,
          value: input ? (input.value || input.textContent?.trim()) : 'input not found'
        };
      }
      if (text === 'AI Role' || text?.includes('AI Role')) {
        const forId = label.getAttribute('for');
        const input = forId ? document.getElementById(forId) : label.closest('div')?.querySelector('input, select, [role="combobox"]');
        fields['AI Role'] = {
          found: true,
          value: input ? (input.value || input.textContent?.trim()) : 'input not found'
        };
      }
      if (text === 'AI Style' || text?.includes('AI Style')) {
        const forId = label.getAttribute('for');
        const input = forId ? document.getElementById(forId) : label.closest('div')?.querySelector('input, select, [role="combobox"]');
        fields['AI Style'] = {
          found: true,
          value: input ? (input.value || input.textContent?.trim()) : 'input not found'
        };
      }
      if (text === 'Typo Frequency' || text?.includes('Typo Frequency')) {
        const forId = label.getAttribute('for');
        const input = forId ? document.getElementById(forId) : label.closest('div')?.querySelector('input, select, [role="combobox"]');
        fields['Typo Frequency'] = {
          found: true,
          value: input ? (input.value || input.textContent?.trim()) : 'input not found'
        };
      }
    }
    return fields;
  });

  console.log('AI fields found:', JSON.stringify(aiFields, null, 2));

  // Also check with a broader search
  const allLabels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('label')).map(l => l.textContent?.trim()).filter(Boolean);
  });
  console.log('All labels in page:', allLabels);

  // Check for any text containing AI
  const aiTextElements = await page.evaluate(() => {
    const results = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && (text.includes('AI Name') || text.includes('AI Role') || text.includes('AI Style') || text.includes('Typo Frequency'))) {
        results.push(text);
      }
    }
    return results;
  });
  console.log('Text nodes containing AI fields:', aiTextElements);

  // Try scrolling more
  await page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"], [data-radix-dialog-content], [data-state="open"]');
    for (const d of dialogs) {
      d.scrollTop = d.scrollHeight;
    }
    // Also try any overflow-y-auto containers
    const scrollable = document.querySelectorAll('[class*="overflow"]');
    for (const el of scrollable) {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
      }
    }
  });
  await page.waitForTimeout(500);
  await shot(page, '06-dialog-scrolled-bottom');

  // Try to click through tabs if dialog has tabs
  const tabs = await page.$$('[role="tab"]');
  console.log('Tabs found in dialog:', tabs.length);
  for (let i = 0; i < tabs.length; i++) {
    const tabText = await tabs[i].textContent();
    console.log(`Tab ${i}: ${tabText?.trim()}`);
  }

  // Look for AI-related tab
  for (const tab of tabs) {
    const tabText = await tab.textContent();
    if (tabText?.includes('AI') || tabText?.includes('Messaging')) {
      console.log('Clicking AI/Messaging tab:', tabText?.trim());
      await tab.click();
      await page.waitForTimeout(500);
      await shot(page, '07-ai-tab-clicked');
      break;
    }
  }

  // Final check for AI fields after potential tab click
  const finalAiFields = await page.evaluate(() => {
    const fields = {};
    const allText = document.body.innerText;

    // Check if fields appear anywhere in page
    fields['AI Name visible'] = allText.includes('AI Name');
    fields['AI Role visible'] = allText.includes('AI Role');
    fields['AI Style visible'] = allText.includes('AI Style');
    fields['Typo Frequency visible'] = allText.includes('Typo Frequency');

    // Get values if visible
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const text = label.textContent?.trim();
      if (text === 'AI Name') {
        const container = label.closest('[class*="field"], [class*="form"], div');
        const input = container?.querySelector('input, textarea, [data-value], [data-testid]');
        fields['AI Name value'] = input?.value || input?.textContent?.trim() || input?.getAttribute('data-value') || 'n/a';
      }
      if (text === 'AI Role') {
        const container = label.closest('[class*="field"], [class*="form"], div');
        const input = container?.querySelector('input, textarea, [data-value]');
        fields['AI Role value'] = input?.value || input?.textContent?.trim() || 'n/a';
      }
      if (text === 'AI Style') {
        const container = label.closest('[class*="field"], [class*="form"], div');
        const input = container?.querySelector('input, textarea, select, [role="combobox"]');
        fields['AI Style value'] = input?.value || input?.textContent?.trim() || 'n/a';
      }
      if (text === 'Typo Frequency') {
        const container = label.closest('[class*="field"], [class*="form"], div');
        const input = container?.querySelector('input, textarea, select, [role="combobox"]');
        fields['Typo Frequency value'] = input?.value || input?.textContent?.trim() || 'n/a';
      }
    }
    return fields;
  });

  console.log('\n=== FINAL AI FIELD CHECK ===');
  console.log(JSON.stringify(finalAiFields, null, 2));

  await shot(page, '08-final-ai-section');

  // STEP 7: Check console errors
  console.log('\n=== STEP 7: Console errors ===');
  console.log('Total errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:');
    consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  } else {
    console.log('No console errors detected.');
  }

  if (consoleLogs.length > 0) {
    console.log('Warnings (first 5):');
    consoleLogs.slice(0, 5).forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('AI Name field visible:', finalAiFields['AI Name visible'] ? 'PASS' : 'FAIL');
  console.log('AI Role field visible:', finalAiFields['AI Role visible'] ? 'PASS' : 'FAIL');
  console.log('AI Style field visible:', finalAiFields['AI Style visible'] ? 'PASS' : 'FAIL');
  console.log('Typo Frequency field visible:', finalAiFields['Typo Frequency visible'] ? 'PASS' : 'FAIL');

  await browser.close();
  console.log('\nTest complete. Screenshots saved to:', SCREENSHOT_DIR);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
