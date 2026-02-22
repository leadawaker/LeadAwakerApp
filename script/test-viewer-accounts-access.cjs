const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'viewer-access-test');
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

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

  // ---- STEP 1: Open the app ----
  console.log('\n=== STEP 1: Open app ===');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
  const step1Url = page.url();
  console.log('URL after open:', step1Url);
  await shot(page, '01-initial-page');

  // ---- STEP 2: Login as admin ----
  console.log('\n=== STEP 2: Login as admin ===');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('[data-testid="input-email"]', { timeout: 8000 }).catch(() => {});

  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');

  try {
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Login SUCCESS, URL:', page.url());
  } catch (e) {
    console.log('Login may have failed or redirected differently. URL:', page.url());
  }
  await shot(page, '02-after-login');

  // ---- STEP 3: Check localStorage ----
  console.log('\n=== STEP 3: Check localStorage ===');
  const lsData = await page.evaluate(() => {
    const keys = ['leadawaker_auth', 'leadawaker_user_role', 'leadawaker_current_account_id', 'leadawaker_user'];
    const result = {};
    keys.forEach(k => { result[k] = localStorage.getItem(k); });
    return result;
  });
  console.log('localStorage values:', JSON.stringify(lsData, null, 2));

  // ---- STEP 4: Manually set role to "Viewer" with non-agency account ----
  console.log('\n=== STEP 4: Set role=Viewer, accountId=5 in localStorage ===');
  await page.evaluate(() => {
    localStorage.setItem('leadawaker_user_role', 'Viewer');
    localStorage.setItem('leadawaker_current_account_id', '5');
  });

  const lsAfter = await page.evaluate(() => {
    return {
      role: localStorage.getItem('leadawaker_user_role'),
      accountId: localStorage.getItem('leadawaker_current_account_id'),
    };
  });
  console.log('localStorage after override:', JSON.stringify(lsAfter));

  // ---- STEP 5: Navigate directly to /agency/accounts ----
  console.log('\n=== STEP 5: Navigate to /agency/accounts as Viewer (accountId=5) ===');
  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);

  const finalUrl = page.url();
  console.log('Final URL after navigation:', finalUrl);
  await shot(page, '03-viewer-accountId5-result');

  // ---- STEP 6: Analyze what's on screen ----
  console.log('\n=== STEP 6: Analyze page content (Viewer + accountId=5) ===');

  const accountsPageEl = await page.$('[data-testid="page-accounts"]');
  const dataTableEl = await page.$('[data-testid="data-table"]');
  const accessDenied = await page.evaluate(() =>
    document.body.innerText.toLowerCase().includes('access denied') ||
    document.body.innerText.toLowerCase().includes('agency only')
  );
  const redirectedToDashboard = finalUrl.includes('/dashboard');
  const stillOnAccounts = finalUrl.includes('/accounts');
  const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 600));

  console.log('Final URL:', finalUrl);
  console.log('Still on /accounts URL:', stillOnAccounts);
  console.log('Redirected to /dashboard:', redirectedToDashboard);
  console.log('[page-accounts] element found (real accounts content visible):', !!accountsPageEl);
  console.log('[data-table] element found:', !!dataTableEl);
  console.log('"Access denied"/"Agency only" text visible:', accessDenied);
  console.log('Body text snippet:\n', bodySnippet);

  // ---- STEP 7: Test with account_id=1 (agency account) but Viewer role ----
  console.log('\n=== STEP 7: Set role=Viewer, accountId=1 (agency account) ===');
  await page.evaluate(() => {
    localStorage.setItem('leadawaker_user_role', 'Viewer');
    localStorage.setItem('leadawaker_current_account_id', '1');
  });

  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);

  const finalUrl2 = page.url();
  const accessDenied2 = await page.evaluate(() =>
    document.body.innerText.toLowerCase().includes('access denied') ||
    document.body.innerText.toLowerCase().includes('agency only')
  );
  const accountsPageEl2 = await page.$('[data-testid="page-accounts"]');
  const dataTableEl2 = await page.$('[data-testid="data-table"]');
  const bodySnippet2 = await page.evaluate(() => document.body.innerText.substring(0, 600));

  console.log('Final URL (Viewer + accountId=1):', finalUrl2);
  console.log('Still on /accounts URL:', finalUrl2.includes('/accounts'));
  console.log('Redirected to /dashboard:', finalUrl2.includes('/dashboard'));
  console.log('[page-accounts] element found:', !!accountsPageEl2);
  console.log('[data-table] element found:', !!dataTableEl2);
  console.log('"Access denied"/"Agency only" text visible:', accessDenied2);
  console.log('Body text snippet:\n', bodySnippet2);
  await shot(page, '04-viewer-accountId1-result');

  // ---- STEP 8: Test with Manager role ----
  console.log('\n=== STEP 8: Set role=Manager, accountId=5 ===');
  await page.evaluate(() => {
    localStorage.setItem('leadawaker_user_role', 'Manager');
    localStorage.setItem('leadawaker_current_account_id', '5');
  });

  await page.goto('http://localhost:5173/agency/accounts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);

  const finalUrl3 = page.url();
  const accessDenied3 = await page.evaluate(() =>
    document.body.innerText.toLowerCase().includes('access denied') ||
    document.body.innerText.toLowerCase().includes('agency only')
  );
  const accountsPageEl3 = await page.$('[data-testid="page-accounts"]');
  const bodySnippet3 = await page.evaluate(() => document.body.innerText.substring(0, 600));

  console.log('Final URL (Manager + accountId=5):', finalUrl3);
  console.log('Still on /accounts URL:', finalUrl3.includes('/accounts'));
  console.log('Redirected to /dashboard:', finalUrl3.includes('/dashboard'));
  console.log('[page-accounts] element found:', !!accountsPageEl3);
  console.log('"Access denied"/"Agency only" text visible:', accessDenied3);
  console.log('Body text snippet:\n', bodySnippet3);
  await shot(page, '05-manager-accountId5-result');

  // ---- Summary ----
  console.log('\n========== FINAL SUMMARY ==========');
  console.log('isAgencyUser() logic in app.tsx:');
  console.log('  -> role === "Admin" OR role === "Operator" OR accountId === "1"');
  console.log('  -> Non-agency users get redirected to /dashboard');
  console.log('');
  console.log('TEST 1 - role=Viewer, accountId=5:');
  console.log('  URL result:', finalUrl);
  console.log('  Protected:', redirectedToDashboard ? 'YES (redirected to dashboard)' : (stillOnAccounts ? 'NO (stayed on /accounts)' : 'UNKNOWN'));
  console.log('');
  console.log('TEST 2 - role=Viewer, accountId=1 (agency account):');
  console.log('  URL result:', finalUrl2);
  console.log('  Can access:', finalUrl2.includes('/accounts') ? 'YES (bypass via account_id=1)' : 'NO');
  console.log('');
  console.log('TEST 3 - role=Manager, accountId=5:');
  console.log('  URL result:', finalUrl3);
  console.log('  Protected:', finalUrl3.includes('/dashboard') ? 'YES (redirected to dashboard)' : (finalUrl3.includes('/accounts') ? 'NO (stayed on /accounts)' : 'UNKNOWN'));

  await browser.close();
  console.log('\nTest complete');
}

main().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
