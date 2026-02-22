/**
 * Focused test for Feature 9: Collapsible Sidebar
 * Uses more robust click strategies
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'feat9-focused');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  [screenshot] ${name}.png`);
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function findCollapseButton(page) {
  // Try to find buttons with "Collapse" text
  const allSidebarBtns = await page.$$('aside[data-sidebar-focus] button');
  for (const btn of allSidebarBtns) {
    const text = await btn.evaluate(el => el.textContent || '');
    if (text.includes('Collapse')) {
      return btn;
    }
  }
  // When collapsed, the expand button has no text - look for the bottom-most button by position
  const btnInfos = [];
  for (const btn of allSidebarBtns) {
    const bbox = await btn.boundingBox();
    if (bbox) btnInfos.push({ btn, y: bbox.y, x: bbox.x, h: bbox.height, w: bbox.width });
  }
  // Sort by Y position, take the one with highest Y (bottom of sidebar) that looks like a toggle
  btnInfos.sort((a, b) => b.y - a.y);
  // The collapse/expand toggle is near the bottom but above user footer
  // Usually around the 3rd or 4th button from bottom
  for (let i = 0; i < Math.min(5, btnInfos.length); i++) {
    console.log(`  Button at y=${btnInfos[i].y.toFixed(0)}, h=${btnInfos[i].h.toFixed(0)}, w=${btnInfos[i].w.toFixed(0)}`);
  }
  return btnInfos[2]?.btn || btnInfos[1]?.btn;
}

async function main() {
  console.log('=== Feature 9 Focused Test ===\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const results = [];

  try {
    // Ensure clean sidebar state (expanded)
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));

    await loginAs(page, 'leadawaker@gmail.com', 'test123');
    await page.waitForTimeout(1000);
    await screenshot(page, '01-initial-after-login');

    // Check sidebar exists and initial width
    const sidebar = await page.$('aside[data-sidebar-focus]');
    if (!sidebar) {
      console.log('ERROR: Desktop sidebar not found! Looking for any sidebar...');
      const allAsides = await page.$$('aside');
      console.log(`  Found ${allAsides.length} aside elements`);
      for (const a of allAsides) {
        const attrs = await a.evaluate(el => ({
          className: el.className,
          testId: el.getAttribute('data-testid'),
          width: el.getBoundingClientRect().width
        }));
        console.log('  aside:', attrs);
      }
      results.push({ step: 'Find sidebar', pass: false, note: 'Sidebar not found' });
      await browser.close();
      return results;
    }

    const initialWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    console.log(`\nInitial sidebar width: ${initialWidth}px`);
    results.push({
      step: 'Initial state: sidebar is expanded (width > 100px)',
      pass: initialWidth > 100,
      note: `Width=${initialWidth}px`
    });

    // Check nav labels are visible in expanded state
    const initialNavHtml = await page.evaluate(() => {
      const nav = document.querySelector('aside[data-sidebar-focus] nav');
      return nav ? nav.innerHTML.substring(0, 500) : 'not found';
    });
    console.log('Nav HTML preview:', initialNavHtml.substring(0, 200));

    const labelsExpandedInitial = await page.$$eval(
      'aside[data-sidebar-focus] nav a span.text-sm',
      spans => spans.filter(s => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).map(s => s.textContent)
    );
    console.log(`Nav labels visible initially: ${labelsExpandedInitial.join(', ')}`);
    results.push({
      step: 'Initial state: Nav labels visible (expanded)',
      pass: labelsExpandedInitial.length > 0,
      note: `Labels: ${labelsExpandedInitial.join(', ')}`
    });

    // === STEP 1: COLLAPSE ===
    console.log('\n--- Step 1: Collapsing sidebar ---');
    const collapseBtn = await findCollapseButton(page);
    if (collapseBtn) {
      // Use JavaScript click to avoid pointer-interception issues
      await collapseBtn.evaluate(btn => btn.click());
      await page.waitForTimeout(500);
    } else {
      console.log('  WARNING: Could not find collapse button');
    }

    await screenshot(page, '02-after-collapse');

    const collapsedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    console.log(`Collapsed sidebar width: ${collapsedWidth}px`);
    results.push({
      step: 'Step 1: Sidebar collapses to icon-only mode (width < 100px)',
      pass: collapsedWidth < 100,
      note: `Width after collapse=${collapsedWidth}px`
    });

    // Check no span labels visible in collapsed state
    const labelsCollapsed = await page.$$eval(
      'aside[data-sidebar-focus] nav a span.text-sm',
      spans => spans.filter(s => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).map(s => s.textContent)
    );
    console.log(`Nav labels visible when collapsed: ${labelsCollapsed.length} (${labelsCollapsed.join(', ')})`);
    results.push({
      step: 'Step 1b: Nav text labels hidden in collapsed (icon-only) state',
      pass: labelsCollapsed.length === 0,
      note: `Visible labels: ${labelsCollapsed.length} - ${labelsCollapsed.join(', ')}`
    });

    // Check localStorage
    const savedCollapsed = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
    console.log(`localStorage sidebar-collapsed: "${savedCollapsed}"`);

    // === STEP 2: EXPAND ===
    console.log('\n--- Step 2: Expanding sidebar ---');
    // In collapsed state, the button has the PanelRightClose icon (to re-expand)
    const expandBtn = await findCollapseButton(page);
    if (expandBtn) {
      await expandBtn.evaluate(btn => btn.click());
      await page.waitForTimeout(500);
    } else {
      console.log('  WARNING: Could not find expand button');
    }

    await screenshot(page, '03-after-expand');

    const reExpandedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    console.log(`Re-expanded sidebar width: ${reExpandedWidth}px`);
    results.push({
      step: 'Step 2: Sidebar expands back to full width with labels',
      pass: reExpandedWidth > 100,
      note: `Width after re-expand=${reExpandedWidth}px`
    });

    const labelsReexpanded = await page.$$eval(
      'aside[data-sidebar-focus] nav a span.text-sm',
      spans => spans.filter(s => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).map(s => s.textContent)
    );
    console.log(`Nav labels visible after re-expand: ${labelsReexpanded.join(', ')}`);
    results.push({
      step: 'Step 2b: Nav labels visible again after expand',
      pass: labelsReexpanded.length > 0,
      note: `Labels: ${labelsReexpanded.join(', ')}`
    });

    // === STEP 3: PERSIST ACROSS NAVIGATION ===
    console.log('\n--- Step 3: Persistence across navigation ---');
    // Collapse again
    const collapseBtn2 = await findCollapseButton(page);
    if (collapseBtn2) {
      await collapseBtn2.evaluate(btn => btn.click());
      await page.waitForTimeout(400);
    }

    const widthBeforeNav = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    const savedBeforeNav = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
    console.log(`Before nav: width=${widthBeforeNav}px, localStorage=${savedBeforeNav}`);

    // Navigate to a different page
    await page.goto(`${BASE_URL}/agency/campaigns`);
    await page.waitForTimeout(1500);
    await screenshot(page, '04-after-nav-campaigns');

    const sidebarAfterNav = await page.$('aside[data-sidebar-focus]');
    const widthAfterNav = sidebarAfterNav
      ? await sidebarAfterNav.evaluate(el => el.getBoundingClientRect().width)
      : 0;
    const savedAfterNav = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
    console.log(`After nav: width=${widthAfterNav}px, localStorage=${savedAfterNav}`);

    results.push({
      step: 'Step 3: Collapse state persists after navigation (localStorage + visual)',
      pass: widthAfterNav < 100 && savedAfterNav === 'true',
      note: `Width after nav=${widthAfterNav}px, localStorage="sidebar-collapsed:${savedAfterNav}"`
    });

    // Navigate back and verify persistence still works
    await page.goto(`${BASE_URL}/agency/contacts`);
    await page.waitForTimeout(1500);
    await screenshot(page, '05-after-nav-contacts');

    const sidebarAfterNav2 = await page.$('aside[data-sidebar-focus]');
    const widthAfterNav2 = sidebarAfterNav2
      ? await sidebarAfterNav2.evaluate(el => el.getBoundingClientRect().width)
      : 0;
    console.log(`After second nav: width=${widthAfterNav2}px`);
    results.push({
      step: 'Step 3b: Collapse state persists across multiple navigations',
      pass: widthAfterNav2 < 100,
      note: `Width after second nav=${widthAfterNav2}px`
    });

  } catch (err) {
    console.error('Test error:', err.message);
    results.push({ step: 'Unexpected error', pass: false, note: err.message });
  }

  await browser.close();

  // Summary
  console.log('\n========================================');
  console.log('         FEATURE 9 TEST SUMMARY');
  console.log('========================================');
  let allPass = true;
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.step}`);
    if (r.note) console.log(`       ${r.note}`);
    if (!r.pass) allPass = false;
  }
  console.log(`\nOVERALL: ${allPass ? 'PASS' : 'FAIL'}`);

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'results.json'), JSON.stringify({ pass: allPass, steps: results }, null, 2));
  return allPass;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
