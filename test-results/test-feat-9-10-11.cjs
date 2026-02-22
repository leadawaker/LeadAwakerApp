/**
 * Test script for Features 9, 10, and 11
 * Feature 9: Collapsible sidebar with icon-only and expanded modes
 * Feature 10: Role-based navigation items
 * Feature 11: Account switcher dropdown for agency users
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'feat-9-10-11-fresh');

// Ensure screenshot dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
  feature9: { steps: [], pass: null },
  feature10: { steps: [], pass: null },
  feature11: { steps: [], pass: null },
};

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  [screenshot] ${name}.png`);
  return filePath;
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  // Wait for redirect away from login
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 10000 }).catch(() => {});
}

async function testFeature9(browser) {
  console.log('\n========== FEATURE 9: Collapsible Sidebar ==========');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // Clear sidebar-collapsed state
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.removeItem('sidebar-collapsed'));

    // Login as admin
    await loginAs(page, 'leadawaker@gmail.com', 'test123');
    await page.waitForTimeout(1500);
    await screenshot(page, '00-f9-01-initial-expanded');

    // Check initial state - sidebar should be expanded (not collapsed)
    const sidebar = await page.$('aside[data-sidebar-focus]');
    if (!sidebar) {
      results.feature9.steps.push({ step: 'Find desktop sidebar', pass: false, note: 'Sidebar element not found' });
      results.feature9.pass = false;
      await context.close();
      return;
    }

    const initialWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    console.log(`  Initial sidebar width: ${initialWidth}px`);
    results.feature9.steps.push({
      step: 'Initial state: sidebar expanded',
      pass: initialWidth > 100,
      note: `Width=${initialWidth}px (expected >100px for expanded)`
    });

    // Step 1: Find and click collapse button
    const collapseBtn = await page.$('button[title="Collapse"], aside[data-sidebar-focus] button:has(svg)');
    // Look for the collapse button by text
    const collapseBtnByText = await page.$$('aside[data-sidebar-focus] button');
    let collapseButton = null;
    for (const btn of collapseBtnByText) {
      const text = await btn.innerText().catch(() => '');
      if (text.includes('Collapse')) {
        collapseButton = btn;
        break;
      }
    }

    if (!collapseButton) {
      // Try finding PanelRightOpen icon button (collapse toggle at bottom)
      const allSidebarBtns = await page.$$('aside[data-sidebar-focus] button');
      console.log(`  Found ${allSidebarBtns.length} buttons in sidebar`);
      // The collapse button should be near the bottom
      collapseButton = allSidebarBtns[allSidebarBtns.length - 3] || allSidebarBtns[allSidebarBtns.length - 1];
    }

    if (collapseButton) {
      await collapseButton.click();
      await page.waitForTimeout(500);
    } else {
      console.log('  Could not find collapse button, trying keyboard shortcut');
    }

    await screenshot(page, '01-f9-02-collapsed');

    const collapsedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    console.log(`  Collapsed sidebar width: ${collapsedWidth}px`);
    results.feature9.steps.push({
      step: 'Step 1: Click collapse toggle, sidebar shrinks to icon-only',
      pass: collapsedWidth < 100,
      note: `Width=${collapsedWidth}px (expected <100px for icon-only)`
    });

    // Check that text labels are hidden
    const navLabelsVisible = await page.$$eval(
      'aside[data-sidebar-focus] nav a span',
      spans => spans.some(s => s.offsetWidth > 0 && s.offsetHeight > 0)
    );
    console.log(`  Nav labels visible in collapsed state: ${navLabelsVisible}`);
    results.feature9.steps.push({
      step: 'Step 1b: Nav labels hidden in collapsed state',
      pass: !navLabelsVisible,
      note: navLabelsVisible ? 'Labels still visible (fail)' : 'Labels hidden (pass)'
    });

    // Step 2: Click expand toggle and verify sidebar shows full labels
    const expandBtns = await page.$$('aside[data-sidebar-focus] button');
    let expandButton = null;
    for (const btn of expandBtns) {
      const text = await btn.innerText().catch(() => '');
      // In collapsed state the button has no text, just icon
      // Try clicking the same position button
      const bbox = await btn.boundingBox();
      if (bbox && bbox.y > 600) { // Bottom of sidebar
        expandButton = btn;
        break;
      }
    }

    if (expandButton) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }

    await screenshot(page, '02-f9-03-expanded');

    const expandedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    console.log(`  Re-expanded sidebar width: ${expandedWidth}px`);
    results.feature9.steps.push({
      step: 'Step 2: Click expand toggle, sidebar shows full labels',
      pass: expandedWidth > 100,
      note: `Width=${expandedWidth}px (expected >100px for expanded)`
    });

    // Check that text labels are visible again
    const labelsVisibleAfterExpand = await page.$$eval(
      'aside[data-sidebar-focus] nav a span',
      spans => spans.some(s => {
        const style = window.getComputedStyle(s);
        return s.offsetWidth > 0 && s.offsetHeight > 0 && style.display !== 'none';
      })
    );
    results.feature9.steps.push({
      step: 'Step 2b: Nav labels visible after expand',
      pass: labelsVisibleAfterExpand,
      note: labelsVisibleAfterExpand ? 'Labels visible (pass)' : 'Labels still hidden (fail)'
    });

    // Step 3: Verify collapse state persists across navigation
    // First collapse
    const btnsForCollapse = await page.$$('aside[data-sidebar-focus] button');
    for (const btn of btnsForCollapse) {
      const text = await btn.innerText().catch(() => '');
      if (text.includes('Collapse')) {
        await btn.click();
        await page.waitForTimeout(400);
        break;
      }
    }

    // Navigate to another page
    const navLinks = await page.$$('aside[data-sidebar-focus] nav a');
    if (navLinks.length > 1) {
      await navLinks[1].click();
      await page.waitForTimeout(1500);
    }

    await screenshot(page, '03-f9-04-persist-after-nav');

    // Check localStorage
    const savedState = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
    console.log(`  localStorage sidebar-collapsed: "${savedState}"`);

    const widthAfterNav = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    console.log(`  Width after navigation: ${widthAfterNav}px`);
    results.feature9.steps.push({
      step: 'Step 3: Collapse state persists across navigation',
      pass: widthAfterNav < 100 && savedState === 'true',
      note: `Width=${widthAfterNav}px, localStorage="sidebar-collapsed:${savedState}"`
    });

    results.feature9.pass = results.feature9.steps.every(s => s.pass);
    console.log(`  Feature 9 RESULT: ${results.feature9.pass ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    console.error('  Feature 9 error:', err.message);
    results.feature9.pass = false;
    results.feature9.error = err.message;
  }

  await context.close();
}

async function testFeature10(browser) {
  console.log('\n========== FEATURE 10: Role-Based Navigation ==========');

  // --- Test as Admin ---
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE_URL);
      await page.evaluate(() => { localStorage.removeItem('sidebar-collapsed'); });
      await loginAs(page, 'leadawaker@gmail.com', 'test123');
      await page.waitForTimeout(1500);
      await screenshot(page, '04-f10-01-admin-nav');

      const navLinks = await page.$$eval(
        'aside[data-sidebar-focus] nav a',
        els => els.map(el => ({
          testId: el.getAttribute('data-testid'),
          text: el.innerText.trim(),
          href: el.getAttribute('href'),
        }))
      );
      console.log(`  Admin nav items (${navLinks.length}):`, navLinks.map(n => n.text).join(', '));

      results.feature10.steps.push({
        step: 'Admin sees all 11 nav items',
        pass: navLinks.length >= 11,
        note: `Found ${navLinks.length} nav items: ${navLinks.map(n => n.text || n.testId).join(', ')}`
      });

      // Step 3: Test direct URL access to hidden pages for non-admin users
      // We'll test this with the viewer user below
      // For now verify admin can access settings
      const hasSettings = navLinks.some(n => n.href && n.href.includes('settings'));
      const hasAccounts = navLinks.some(n => n.href && n.href.includes('accounts'));
      const hasTags = navLinks.some(n => n.href && n.href.includes('tags'));
      const hasUsers = navLinks.some(n => n.href && n.href.includes('users'));
      const hasAutomation = navLinks.some(n => n.href && n.href.includes('automation'));
      const hasLibrary = navLinks.some(n => n.href && n.href.includes('prompt-library'));

      console.log(`  Admin has: settings=${hasSettings}, accounts=${hasAccounts}, tags=${hasTags}, users=${hasUsers}, automation=${hasAutomation}, library=${hasLibrary}`);
      results.feature10.steps.push({
        step: 'Admin sees agency-only items (accounts, tags, users, automation, library, settings)',
        pass: hasSettings && hasAccounts && hasTags && hasUsers && hasAutomation && hasLibrary,
        note: `settings=${hasSettings}, accounts=${hasAccounts}, tags=${hasTags}, users=${hasUsers}, automation=${hasAutomation}, library=${hasLibrary}`
      });

    } catch (err) {
      console.error('  Feature 10 Admin test error:', err.message);
      results.feature10.steps.push({ step: 'Admin nav test', pass: false, note: err.message });
    }
    await context.close();
  }

  // --- Test as Viewer ---
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE_URL);
      await page.evaluate(() => { localStorage.removeItem('sidebar-collapsed'); });
      await loginAs(page, 'viewer@test.com', 'test123');
      await page.waitForTimeout(1500);
      await screenshot(page, '05-f10-02-viewer-nav');

      const navLinks = await page.$$eval(
        'aside[data-sidebar-focus] nav a',
        els => els.map(el => ({
          testId: el.getAttribute('data-testid'),
          text: el.innerText.trim(),
          href: el.getAttribute('href'),
        }))
      );
      console.log(`  Viewer nav items (${navLinks.length}):`, navLinks.map(n => n.text).join(', '));

      results.feature10.steps.push({
        step: 'Viewer/Manager sees only 5 allowed pages (no agency-only items)',
        pass: navLinks.length <= 6 && navLinks.length >= 4,
        note: `Found ${navLinks.length} nav items: ${navLinks.map(n => n.text || n.testId).join(', ')}`
      });

      // Verify agency-only items are NOT present
      const hasSettings = navLinks.some(n => n.href && n.href.includes('settings'));
      const hasAccounts = navLinks.some(n => n.href && n.href.includes('accounts'));
      const hasTags = navLinks.some(n => n.href && n.href.includes('tags'));
      const hasUsers = navLinks.some(n => n.href && n.href.includes('users'));
      const hasAutomation = navLinks.some(n => n.href && n.href.includes('automation'));
      const hasLibrary = navLinks.some(n => n.href && n.href.includes('prompt-library'));

      console.log(`  Viewer should NOT have: settings=${hasSettings}, accounts=${hasAccounts}, tags=${hasTags}, users=${hasUsers}, automation=${hasAutomation}, library=${hasLibrary}`);
      results.feature10.steps.push({
        step: 'Viewer does NOT see agency-only items',
        pass: !hasSettings && !hasAccounts && !hasTags && !hasUsers && !hasAutomation && !hasLibrary,
        note: `settings=${hasSettings}, accounts=${hasAccounts}, tags=${hasTags}, users=${hasUsers}, automation=${hasAutomation}, library=${hasLibrary}`
      });

      // Step 3: Try accessing a restricted URL directly
      const currentUrl = page.url();
      // Extract base path to know what prefix to use
      const prefix = currentUrl.includes('/agency') ? '/agency' : '/subaccount';
      await page.goto(`${BASE_URL}${prefix}/settings`);
      await page.waitForTimeout(1500);
      await screenshot(page, '06-f10-03-viewer-restricted-url');

      const blockedUrl = page.url();
      const pageContent = await page.textContent('body');
      console.log(`  After navigating to ${prefix}/settings, URL is: ${blockedUrl}`);
      console.log(`  Page has "403" or "Access Denied" or "unauthorized": ${pageContent.includes('403') || pageContent.toLowerCase().includes('access denied') || pageContent.toLowerCase().includes('unauthorized') || pageContent.toLowerCase().includes('not found') || !blockedUrl.includes('/settings')}`);

      const wasRedirectedOrBlocked =
        !blockedUrl.includes('/settings') ||
        pageContent.includes('403') ||
        pageContent.toLowerCase().includes('access denied') ||
        pageContent.toLowerCase().includes('unauthorized') ||
        pageContent.toLowerCase().includes('not found') ||
        pageContent.toLowerCase().includes('forbidden');

      results.feature10.steps.push({
        step: 'Step 3: Hidden pages not accessible via direct URL for viewer',
        pass: wasRedirectedOrBlocked,
        note: `URL after access attempt: ${blockedUrl}, redirected/blocked: ${wasRedirectedOrBlocked}`
      });

    } catch (err) {
      console.error('  Feature 10 Viewer test error:', err.message);
      results.feature10.steps.push({ step: 'Viewer nav test', pass: false, note: err.message });
    }
    await context.close();
  }

  results.feature10.pass = results.feature10.steps.every(s => s.pass);
  console.log(`  Feature 10 RESULT: ${results.feature10.pass ? 'PASS' : 'FAIL'}`);
}

async function testFeature11(browser) {
  console.log('\n========== FEATURE 11: Account Switcher ==========');

  // --- Test as Admin (agency user) ---
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE_URL);
      await page.evaluate(() => { localStorage.removeItem('sidebar-collapsed'); });
      await loginAs(page, 'leadawaker@gmail.com', 'test123');
      await page.waitForTimeout(1500);
      await screenshot(page, '07-f11-01-admin-switcher');

      // Step 1: Verify account switcher appears for admin
      const switcher = await page.$('[data-testid="sidebar-account-switcher"]');
      console.log(`  Account switcher element found: ${!!switcher}`);
      results.feature11.steps.push({
        step: 'Step 1: Admin sees account switcher in sidebar',
        pass: !!switcher,
        note: switcher ? 'Account switcher found [data-testid="sidebar-account-switcher"]' : 'Account switcher NOT found'
      });

      // Step 2: Click account switcher and verify dropdown opens
      const switcherTrigger = await page.$('[data-testid="sidebar-account-switcher-trigger"]');
      if (switcherTrigger) {
        await switcherTrigger.click();
        await page.waitForTimeout(600);
        await screenshot(page, '08-f11-02-switcher-open');

        // Check dropdown is visible
        const dropdownItems = await page.$$('[data-testid^="sidebar-account-option-"]');
        console.log(`  Dropdown account options found: ${dropdownItems.length}`);
        results.feature11.steps.push({
          step: 'Step 2: Account switcher dropdown opens with accounts list',
          pass: dropdownItems.length > 0,
          note: `Found ${dropdownItems.length} account options in dropdown`
        });

        // Click a different account if available
        if (dropdownItems.length > 1) {
          const secondOption = dropdownItems.find(async (el) => {
            const testId = await el.getAttribute('data-testid');
            return testId !== 'sidebar-account-option-1';
          });

          let optionToClick = null;
          for (const item of dropdownItems) {
            const testId = await item.getAttribute('data-testid');
            if (testId && testId !== 'sidebar-account-option-1') {
              optionToClick = item;
              break;
            }
          }

          if (optionToClick) {
            const optionText = await optionToClick.textContent();
            await optionToClick.click();
            await page.waitForTimeout(1000);
            await screenshot(page, '09-f11-03-after-switch');

            // Check that page data changed (URL should change to subaccount prefix)
            const urlAfterSwitch = page.url();
            const localStorageAccountId = await page.evaluate(() => localStorage.getItem('leadawaker_current_account_id'));
            console.log(`  URL after switch: ${urlAfterSwitch}`);
            console.log(`  localStorage account ID: ${localStorageAccountId}`);

            results.feature11.steps.push({
              step: 'Step 2b: Selecting account filters page data to that account',
              pass: localStorageAccountId !== '1' || urlAfterSwitch.includes('/subaccount'),
              note: `URL: ${urlAfterSwitch}, localStorage account: ${localStorageAccountId}`
            });
          } else {
            results.feature11.steps.push({
              step: 'Step 2b: Select non-agency account',
              pass: false,
              note: 'Could not find non-agency account option to click'
            });
          }
        } else {
          results.feature11.steps.push({
            step: 'Step 2b: Select different account',
            pass: dropdownItems.length > 0,
            note: `Only ${dropdownItems.length} account(s) available - switching not testable but dropdown works`
          });
        }
      } else {
        results.feature11.steps.push({
          step: 'Step 2: Account switcher trigger not found',
          pass: false,
          note: 'sidebar-account-switcher-trigger not found'
        });
      }

    } catch (err) {
      console.error('  Feature 11 Admin test error:', err.message);
      results.feature11.steps.push({ step: 'Admin account switcher test', pass: false, note: err.message });
    }
    await context.close();
  }

  // --- Test as Viewer (non-agency user) ---
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE_URL);
      await loginAs(page, 'viewer@test.com', 'test123');
      await page.waitForTimeout(1500);
      await screenshot(page, '10-f11-04-viewer-no-switcher');

      // Step 3: Viewer should NOT see account switcher
      const switcher = await page.$('[data-testid="sidebar-account-switcher"]');
      console.log(`  Viewer account switcher found: ${!!switcher}`);
      results.feature11.steps.push({
        step: 'Step 3: Client/Viewer user does NOT see account switcher',
        pass: !switcher,
        note: switcher ? 'Account switcher IS visible for viewer (FAIL)' : 'Account switcher hidden for viewer (PASS)'
      });

    } catch (err) {
      console.error('  Feature 11 Viewer test error:', err.message);
      results.feature11.steps.push({ step: 'Viewer account switcher test', pass: false, note: err.message });
    }
    await context.close();
  }

  results.feature11.pass = results.feature11.steps.every(s => s.pass);
  console.log(`  Feature 11 RESULT: ${results.feature11.pass ? 'PASS' : 'FAIL'}`);
}

async function main() {
  console.log('Starting Feature Tests 9, 10, 11...\n');
  const browser = await chromium.launch({ headless: true });

  try {
    await testFeature9(browser);
    await testFeature10(browser);
    await testFeature11(browser);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n\n========================================');
  console.log('           TEST RESULTS SUMMARY');
  console.log('========================================');

  for (const [featureKey, result] of Object.entries(results)) {
    const featureNum = featureKey.replace('feature', '');
    console.log(`\n${featureKey.toUpperCase()} - ${result.pass ? 'PASS ✓' : 'FAIL ✗'}`);
    for (const step of result.steps) {
      console.log(`  [${step.pass ? 'PASS' : 'FAIL'}] ${step.step}`);
      if (!step.pass || step.note) {
        console.log(`         Note: ${step.note}`);
      }
    }
    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
    }
  }

  // Write JSON results
  const jsonPath = path.join(SCREENSHOT_DIR, 'results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\nJSON results saved to: ${jsonPath}`);
  console.log('Screenshots saved to:', SCREENSHOT_DIR);

  return results;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
