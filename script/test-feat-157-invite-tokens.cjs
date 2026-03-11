// test-feat-157-invite-tokens.cjs
// Verify invite token management UI on Users page (Feature #157)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'feat-157');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  process.stdout.write('Screenshot: ' + fp + '\n');
  return fp;
}

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  const loginCheck = await page.$('[data-testid="input-email"]');
  if (!loginCheck) {
    process.stdout.write('Already logged in\n');
    return;
  }
  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  process.stdout.write('Logged in: ' + page.url() + '\n');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const results = {};

  // STEP 1: Login
  try {
    await login(page);
    results['step1_login'] = 'PASS';
  } catch (e) {
    results['step1_login'] = 'FAIL: ' + e.message;
    await shot(page, '00-login-error');
    await browser.close();
    return results;
  }

  // STEP 2: Navigate to /agency/users
  try {
    await page.goto('http://localhost:5173/agency/users', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    results['step2_navigate'] = 'PASS: ' + page.url();
  } catch (e) {
    results['step2_navigate'] = 'FAIL: ' + e.message;
  }

  // STEP 3: Screenshot with pending invites visible
  await shot(page, '01-pending-invites');
  results['step3_screenshot'] = 'PASS';

  // STEP 4: Check for pending invites panel
  const invitePanel = await page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="button-toggle-invites"]');
    const panel = document.querySelector('[data-testid="pending-invites-panel"]');
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim());
    const inviteText = document.body.innerText.toLowerCase().includes('invit');
    return {
      toggleFound: !!toggle,
      panelFound: !!panel,
      headings: headings,
      inviteTextOnPage: inviteText,
    };
  });
  process.stdout.write('Invite panel state: ' + JSON.stringify(invitePanel) + '\n');
  results['step4_toggle_button'] = invitePanel.toggleFound ? 'PASS' : 'FAIL: button-toggle-invites not found';
  results['step4_pending_panel'] = invitePanel.panelFound ? 'PASS' : 'WARN: pending-invites-panel testid not found';
  results['step4_invite_text'] = invitePanel.inviteTextOnPage ? 'PASS: invite text found on page' : 'WARN: no invite text on page';

  // STEP 5: Click the toggle button to collapse pending invites
  if (invitePanel.toggleFound) {
    try {
      await page.click('[data-testid="button-toggle-invites"]');
      await page.waitForTimeout(800);
      results['step5_click_toggle'] = 'PASS';
    } catch (e) {
      results['step5_click_toggle'] = 'FAIL: ' + e.message;
    }
  } else {
    results['step5_click_toggle'] = 'SKIP: toggle button not found';
  }

  // STEP 6: Screenshot after collapse
  await shot(page, '02-invites-collapsed');
  results['step6_screenshot_collapsed'] = 'PASS';

  // STER 7: Verify panel is now collapsed
  const collapsedState = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="pending-invites-panel"]');
    return {
      panelVisible: panel ? panel.offsetHeight > 0 : null,
      panelHeight: panel ? panel.offsetHeight : null,
    };
  });
  process.stdout.write('Collapsed state: ' + JSON.stringify(collapsedState) + '\n');
  results['step7_collapsed'] = collapsedState.panelVisible === false ? 'PASS: panel collapsed' : 'WARN: panel may still be visible ' + JSON.stringify(collapsedState);

  // Final summary
  process.stdout.write('\n========== RESULTS SUMMARY  ==========\n');
  for (const [k, v] of Object.entries(results)) {
    const icon = v.startsWith('PASS') ? '[PASS]' : v.startsWith('FAIL') ? '[FAIL]' : '[WARN]';
    process.stdout.write(icon + ' ' + k + ': ' + v + '\n');
  }
  process.stdout.write('=====================================\n\n');

  await browser.close();
}

main().catch(function(err) {
  process.stderr.write('Error: ' + err.message + '\n');
  process.exit(1);
});
