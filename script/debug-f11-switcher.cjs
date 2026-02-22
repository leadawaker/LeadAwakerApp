const { chromium } = require('playwright');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('[data-testid="input-email"]').fill('leadawaker@gmail.com');
  await page.locator('[data-testid="input-password"]').fill('test123');
  await page.locator('[data-testid="button-login"]').click();
  await sleep(2500);

  // Set Admin, go to dashboard
  await page.evaluate(() => {
    localStorage.setItem('leadawaker_user_role', 'Admin');
    localStorage.setItem('leadawaker_current_account_id', '1');
    localStorage.removeItem('sidebar-collapsed');
  });
  await page.goto('http://localhost:5173/agency/dashboard', { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  // Open switcher
  await page.locator('[data-testid="sidebar-account-switcher-trigger"]').click();
  await sleep(800);

  // Get all options and their details
  const optionDetails = await page.locator('[data-testid^="sidebar-account-option-"]').evaluateAll(els =>
    els.map(el => ({
      testid: el.getAttribute('data-testid'),
      text: el.textContent.trim().substring(0, 60),
    }))
  );
  console.log('Account options found:', optionDetails.length);
  optionDetails.forEach((o, i) => console.log(`  [${i}] ${o.testid} => "${o.text}"`));

  const initialId = await page.evaluate(() => localStorage.getItem('leadawaker_current_account_id'));
  console.log('Initial accountId in localStorage:', initialId);

  // Click the second option (index 1) and observe what changes
  if (optionDetails.length > 1) {
    console.log('\nClicking option at index 1:', optionDetails[1].testid);
    await page.locator('[data-testid^="sidebar-account-option-"]').nth(1).click();
    await sleep(1200);

    const newId = await page.evaluate(() => localStorage.getItem('leadawaker_current_account_id'));
    const currentUrl = page.url();
    console.log('After click - localStorage accountId:', newId);
    console.log('After click - URL:', currentUrl);

    // Check if the account ID embedded in the option testid differs from localStorage
    const expectedId = optionDetails[1].testid.replace('sidebar-account-option-', '');
    console.log('Expected new accountId from testid:', expectedId);
    console.log('Switch worked correctly:', newId === expectedId && newId !== initialId);
  }

  await browser.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
