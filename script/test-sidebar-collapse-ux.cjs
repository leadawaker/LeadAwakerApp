/**
 * Sidebar Collapse/Expand UX Bug Investigation
 * Tests whether the expand button is clickable after sidebar collapses.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'sidebar-collapse-ux');
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

  // Use desktop viewport so sidebar is visible (not mobile mode)
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

  await login(page);

  // Wait for the CRM shell to render
  await page.waitForSelector('[data-testid="shell-crm"]', { timeout: 10000 });
  // Wait for the desktop sidebar to appear (it uses `hidden md:block` so requires a wide viewport)
  await page.waitForSelector('aside[data-sidebar-focus]', { timeout: 5000 });
  await page.waitForTimeout(500);

  // ─── STEP 1: Snapshot the dashboard in EXPANDED state ──────────────────────
  console.log('\n=== STEP 1: Expanded sidebar state ===');
  const expandedAside = await page.$('aside[data-sidebar-focus]');
  if (expandedAside) {
    const box = await expandedAside.boundingBox();
    console.log('Sidebar bounding box (expanded):', JSON.stringify(box));
  }

  // Ensure sidebar is expanded to start
  // Check localStorage first
  const sidebarState = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  console.log('localStorage sidebar-collapsed:', sidebarState);

  // If it's collapsed from a prior test run, expand it first
  if (sidebarState === 'true') {
    console.log('Sidebar was stored as collapsed, expanding first...');
    await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
    await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('[data-testid="shell-crm"]', { timeout: 10000 });
    await page.waitForTimeout(500);
  }

  await shot(page, '01-expanded-state');

  // Find the collapse button - it shows PanelRightOpen icon with "Collapse" text when expanded
  // No data-testid on this button, so we search by text content
  const collapseBtn = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside[data-sidebar-focus] button'));
    for (const btn of buttons) {
      if (btn.textContent && btn.textContent.includes('Collapse')) return btn.className;
    }
    return null;
  });
  console.log('Collapse button found (by text "Collapse"):', collapseBtn ? 'YES' : 'NO');

  // Get its bounding box
  const collapseBtnEl = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('aside[data-sidebar-focus] button'));
    for (const btn of buttons) {
      if (btn.textContent && btn.textContent.includes('Collapse')) return btn;
    }
    return null;
  });

  const collapseBtnBox = await collapseBtnEl.asElement()?.boundingBox();
  console.log('Collapse button bounding box:', JSON.stringify(collapseBtnBox));

  // ─── STEP 2: Click collapse and check sidebar shrinks ──────────────────────
  console.log('\n=== STEP 2: Clicking collapse button ===');
  await collapseBtnEl.asElement()?.click();
  await page.waitForTimeout(400); // allow CSS transition

  const sidebarAfterCollapse = await page.$('aside[data-sidebar-focus]');
  const collapsedBox = sidebarAfterCollapse ? await sidebarAfterCollapse.boundingBox() : null;
  console.log('Sidebar bounding box (after collapse):', JSON.stringify(collapsedBox));

  const collapsedStateInLS = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  console.log('localStorage sidebar-collapsed after click:', collapsedStateInLS);

  await shot(page, '02-after-collapse');

  // ─── STEP 3: Find the expand button in collapsed state ─────────────────────
  console.log('\n=== STEP 3: Finding expand button in collapsed state ===');

  // When collapsed, the button shows PanelRightClose icon and NO text label
  // It's still rendered with the same onClick handler
  const allButtons = await page.evaluate(() => {
    const sidebar = document.querySelector('aside[data-sidebar-focus]');
    if (!sidebar) return [];
    const btns = Array.from(sidebar.querySelectorAll('button'));
    return btns.map((btn, i) => ({
      index: i,
      textContent: btn.textContent?.trim() || '',
      className: btn.className,
      title: btn.title,
      ariaLabel: btn.getAttribute('aria-label'),
      type: btn.type,
      boundingRect: (() => {
        const r = btn.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, left: r.left };
      })(),
      hasPointerEvents: getComputedStyle(btn).pointerEvents,
      visibility: getComputedStyle(btn).visibility,
      display: getComputedStyle(btn).display,
      zIndex: getComputedStyle(btn).zIndex,
    }));
  });

  console.log('All buttons in collapsed sidebar:');
  allButtons.forEach(b => {
    console.log(` [${b.index}] text="${b.textContent}" class="${b.className.substring(0, 80)}" rect=${JSON.stringify(b.boundingRect)} pointer-events=${b.hasPointerEvents} z-index=${b.zIndex}`);
  });

  // The collapse/expand button is the first one in the "BOTTOM ACTIONS" section
  // When collapsed, it has PanelRightClose icon only (no text)
  // It should be the button that does NOT have a data-testid value (no testid set on collapse btn)
  // Let's find it: it will be the button in .bottom-actions area with no label text and has SVG
  // Actually just look for the one with no textContent after 'Collapse' text is gone
  const expandBtnInfo = await page.evaluate(() => {
    const sidebar = document.querySelector('aside[data-sidebar-focus]');
    if (!sidebar) return null;
    const btns = Array.from(sidebar.querySelectorAll('button'));
    // When collapsed, the collapse button has no text - but it's still the same button
    // It renders PanelRightClose icon only. It's in .px-3.mb-1.space-y-1.shrink-0 div
    for (const btn of btns) {
      // No text content means no label (collapsed state shows icon only)
      // Also check it has the right classes (w-full h-10 rounded-xl)
      const text = btn.textContent?.trim() || '';
      if (text === '' && btn.className.includes('h-10') && btn.className.includes('rounded-xl')) {
        const r = btn.getBoundingClientRect();
        const style = getComputedStyle(btn);
        return {
          found: true,
          text,
          className: btn.className,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          pointerEvents: style.pointerEvents,
          visibility: style.visibility,
          zIndex: style.zIndex,
          parentZIndex: getComputedStyle(btn.parentElement).zIndex,
          sidebarZIndex: getComputedStyle(sidebar).zIndex,
          isInteractable: r.width > 0 && r.height > 0,
        };
      }
    }
    return null;
  });

  console.log('Expand (toggle) button info in collapsed state:', JSON.stringify(expandBtnInfo, null, 2));

  // ─── STEP 4: Check what element is on top at the expand button's location ──
  console.log('\n=== STEP 4: Hit-test at expand button location ===');
  if (expandBtnInfo && expandBtnInfo.rect) {
    const cx = expandBtnInfo.rect.x + expandBtnInfo.rect.width / 2;
    const cy = expandBtnInfo.rect.y + expandBtnInfo.rect.height / 2;
    console.log(`Hit-testing at (${cx}, ${cy})`);

    const topElement = await page.evaluate((coords) => {
      const el = document.elementFromPoint(coords.cx, coords.cy);
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        tagName: el.tagName,
        className: el.className,
        textContent: el.textContent?.trim()?.substring(0, 50),
        id: el.id,
        dataTestId: el.getAttribute('data-testid'),
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
        position: style.position,
        isButton: el.tagName === 'BUTTON',
        isSVG: el.tagName === 'svg' || el.tagName === 'path',
      };
    }, { cx, cy });

    console.log('Element at expand button center point:', JSON.stringify(topElement, null, 2));

    // Check parent chain
    const parentChain = await page.evaluate((coords) => {
      let el = document.elementFromPoint(coords.cx, coords.cy);
      const chain = [];
      while (el && chain.length < 8) {
        const style = getComputedStyle(el);
        const cls = typeof el.className === 'string' ? el.className.substring(0, 60) : String(el.className?.baseVal || '').substring(0, 60);
        chain.push({
          tagName: el.tagName,
          className: cls,
          dataTestId: el.getAttribute ? el.getAttribute('data-testid') : null,
          zIndex: style.zIndex,
          position: style.position,
          pointerEvents: style.pointerEvents,
        });
        el = el.parentElement;
      }
      return chain;
    }, { cx, cy });

    console.log('Element parent chain from click point:');
    parentChain.forEach((el, i) => {
      console.log(`  ${'  '.repeat(i)}[${i}] ${el.tagName} testid="${el.dataTestId}" z=${el.zIndex} pos=${el.position} pe=${el.pointerEvents} class="${el.className}"`);
    });
  }

  // ─── STEP 5: Try clicking the expand button using Playwright's click ────────
  console.log('\n=== STEP 5: Clicking expand button ===');

  let expandClicked = false;
  try {
    // Find and click the button that has no text (the toggle button in collapsed mode)
    const expandBtnHandle = await page.evaluateHandle(() => {
      const sidebar = document.querySelector('aside[data-sidebar-focus]');
      if (!sidebar) return null;
      const btns = Array.from(sidebar.querySelectorAll('button'));
      for (const btn of btns) {
        const text = btn.textContent?.trim() || '';
        if (text === '' && btn.className.includes('h-10') && btn.className.includes('rounded-xl')) {
          return btn;
        }
      }
      return null;
    });

    const expandBtnElem = expandBtnHandle.asElement();
    if (expandBtnElem) {
      const box = await expandBtnElem.boundingBox();
      console.log('Expand button bounding box:', JSON.stringify(box));

      // Try regular click
      await expandBtnElem.click({ timeout: 5000 });
      expandClicked = true;
      console.log('Regular click: SUCCESS');
    } else {
      console.log('Could not get element handle for expand button');
    }
  } catch (err) {
    console.log('Regular click FAILED:', err.message);

    // Try force click
    try {
      const expandBtnHandle2 = await page.evaluateHandle(() => {
        const sidebar = document.querySelector('aside[data-sidebar-focus]');
        if (!sidebar) return null;
        const btns = Array.from(sidebar.querySelectorAll('button'));
        for (const btn of btns) {
          const text = btn.textContent?.trim() || '';
          if (text === '' && btn.className.includes('h-10') && btn.className.includes('rounded-xl')) {
            return btn;
          }
        }
        return null;
      });
      const expandBtnElem2 = expandBtnHandle2.asElement();
      if (expandBtnElem2) {
        await expandBtnElem2.click({ force: true, timeout: 5000 });
        expandClicked = true;
        console.log('Force click: SUCCESS');
      }
    } catch (err2) {
      console.log('Force click also FAILED:', err2.message);
    }
  }

  await page.waitForTimeout(400);
  await shot(page, '03-after-expand-click');

  // ─── STEP 6: Check sidebar width after expand click ─────────────────────────
  console.log('\n=== STEP 6: Sidebar state after expand attempt ===');
  const sidebarAfterExpand = await page.$('aside[data-sidebar-focus]');
  const expandedBoxAgain = sidebarAfterExpand ? await sidebarAfterExpand.boundingBox() : null;
  console.log('Sidebar bounding box after expand click:', JSON.stringify(expandedBoxAgain));
  const lsAfterExpand = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  console.log('localStorage sidebar-collapsed after expand click:', lsAfterExpand);

  const didExpand = lsAfterExpand === 'false' || lsAfterExpand === null;
  console.log('Did sidebar expand?', didExpand ? 'YES (PASS)' : 'NO (FAIL - BUG CONFIRMED)');

  // ─── STEP 7: Also check if main content area blocks the sidebar ─────────────
  console.log('\n=== STEP 7: Checking for overlay / z-index blocking ===');
  const blockingCheck = await page.evaluate(() => {
    const sidebar = document.querySelector('aside[data-sidebar-focus]');
    const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;

    const wrapNav = document.querySelector('[data-testid="wrap-left-nav"]');
    const wrapNavStyle = wrapNav ? getComputedStyle(wrapNav) : null;

    const mainCrm = document.querySelector('[data-testid="main-crm"]');
    const mainStyle = mainCrm ? getComputedStyle(mainCrm) : null;

    const topbar = document.querySelector('[data-testid="topbar"]');
    const topbarStyle = topbar ? getComputedStyle(topbar) : null;

    return {
      sidebar: sidebar ? {
        zIndex: sidebarStyle.zIndex,
        position: sidebarStyle.position,
        width: sidebarStyle.width,
        overflow: sidebarStyle.overflow,
      } : null,
      wrapNav: wrapNav ? {
        zIndex: wrapNavStyle.zIndex,
        position: wrapNavStyle.position,
      } : null,
      main: mainCrm ? {
        zIndex: mainStyle.zIndex,
        position: mainStyle.position,
        paddingLeft: mainStyle.paddingLeft,
        overflow: mainStyle.overflow,
      } : null,
      topbar: topbar ? {
        zIndex: topbarStyle.zIndex,
        position: topbarStyle.position,
      } : null,
    };
  });
  console.log('Layout element styles:', JSON.stringify(blockingCheck, null, 2));

  // ─── STEP 8: Console errors ─────────────────────────────────────────────────
  console.log('\n=== STEP 8: Console errors collected ===');
  console.log('Total JS errors:', errors.length);
  if (errors.length > 0) {
    errors.forEach(e => console.log(' -', e));
  } else {
    console.log('No JS errors');
  }

  // ─── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  console.log('Collapse button found:', collapseBtn ? 'YES' : 'NO');
  console.log('Sidebar collapsed after click:', collapsedStateInLS === 'true' ? 'YES' : 'NO');
  console.log('Expand button info found:', expandBtnInfo ? 'YES' : 'NO');
  if (expandBtnInfo) {
    console.log('  - pointer-events:', expandBtnInfo.pointerEvents);
    console.log('  - z-index:', expandBtnInfo.zIndex);
    console.log('  - is interactable (has size):', expandBtnInfo.isInteractable);
  }
  console.log('Expand click attempted:', expandClicked ? 'YES' : 'NO');
  console.log('Sidebar expanded after click:', didExpand ? 'YES (PASS)' : 'NO (BUG!)');

  await browser.close();
  console.log('\nTest complete. Screenshots in:', SCREENSHOT_DIR);
}

main().catch(err => {
  console.error('Test script failed:', err.message);
  process.exit(1);
});
