/**
 * Checks pixel-level hit testing in collapsed sidebar state.
 * Determines whether the main content area or topbar overlaps/blocks the sidebar toggle button.
 */
const { chromium } = require('playwright');

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('[data-testid="input-email"]', 'leadawaker@gmail.com');
  await page.fill('[data-testid="input-password"]', 'test123');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await login(page);
  await page.waitForSelector('aside[data-sidebar-focus]', { timeout: 5000 });

  // Ensure sidebar is expanded first
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
  await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('aside[data-sidebar-focus]', { timeout: 5000 });
  await page.waitForTimeout(300);

  // Click collapse
  const collapseBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('aside[data-sidebar-focus] button'));
    return btns.find(b => b.textContent && b.textContent.includes('Collapse')) || null;
  });
  await collapseBtn.asElement().click();
  await page.waitForTimeout(400);

  // ─── Hit-test grid across the collapse button area ────────────────────────
  const hitTestResult = await page.evaluate(() => {
    const checkPoints = [
      { label: 'x=20 (sidebar left edge)', x: 20, y: 620 },
      { label: 'x=46 (sidebar button center)', x: 46, y: 620 },
      { label: 'x=60 (sidebar right area)', x: 60, y: 620 },
      { label: 'x=76 (past sidebar)', x: 76, y: 620 },
      { label: 'x=80 (main content pl edge)', x: 80, y: 620 },
      { label: 'x=100 (main content area)', x: 100, y: 620 },
    ];
    return checkPoints.map(pt => {
      const el = document.elementFromPoint(pt.x, pt.y);
      if (!el) return { ...pt, element: 'null' };
      const style = getComputedStyle(el);
      const cls = typeof el.className === 'string' ? el.className : '';
      return {
        label: pt.label,
        x: pt.x,
        y: pt.y,
        tagName: el.tagName,
        className: cls.substring(0, 80),
        testId: el.getAttribute('data-testid'),
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
        position: style.position,
      };
    });
  });

  console.log('=== Hit-test at y=620 (collapse/expand toggle button row) ===');
  hitTestResult.forEach(r => console.log(JSON.stringify(r)));

  // ─── Main content bounding box and styles ────────────────────────────────
  const mainBox = await page.evaluate(() => {
    const main = document.querySelector('[data-testid="main-crm"]');
    if (!main) return null;
    const r = main.getBoundingClientRect();
    const style = getComputedStyle(main);
    return {
      rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      paddingLeft: style.paddingLeft,
      zIndex: style.zIndex,
      position: style.position,
      overflow: style.overflow,
    };
  });
  console.log('\n=== main-crm element ===');
  console.log(JSON.stringify(mainBox, null, 2));

  // ─── All fixed-positioned elements and their z-indices ───────────────────
  const fixedEls = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('*'));
    const fixed = candidates.filter(el => {
      const s = getComputedStyle(el);
      return s.position === 'fixed' || s.position === 'sticky';
    });
    return fixed.slice(0, 20).map(el => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const cls = typeof el.className === 'string' ? el.className.substring(0, 80) : '';
      return {
        tagName: el.tagName,
        testId: el.getAttribute('data-testid'),
        className: cls,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        zIndex: style.zIndex,
        position: style.position,
        pointerEvents: style.pointerEvents,
      };
    });
  });
  console.log('\n=== Fixed/sticky positioned elements ===');
  fixedEls.forEach(el => console.log(JSON.stringify(el)));

  // ─── Check if topbar overlaps the sidebar vertically ─────────────────────
  const topbarDetails = await page.evaluate(() => {
    // Look for elements that sit at the top with high z-index
    const topbar = document.querySelector('header') || document.querySelector('[class*="topbar"]') || document.querySelector('[data-testid*="topbar"]');
    if (!topbar) return null;
    const r = topbar.getBoundingClientRect();
    const style = getComputedStyle(topbar);
    return {
      tagName: topbar.tagName,
      testId: topbar.getAttribute('data-testid'),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents,
    };
  });
  console.log('\n=== Topbar element ===');
  console.log(JSON.stringify(topbarDetails));

  // ─── Check wrap-left-nav and sidebar z-indices ────────────────────────────
  const navWrapInfo = await page.evaluate(() => {
    const wrap = document.querySelector('[data-testid="wrap-left-nav"]');
    const sidebar = document.querySelector('aside[data-sidebar-focus]');
    if (!wrap || !sidebar) return null;
    const wStyle = getComputedStyle(wrap);
    const sStyle = getComputedStyle(sidebar);
    const wRect = wrap.getBoundingClientRect();
    const sRect = sidebar.getBoundingClientRect();
    return {
      wrapNav: {
        zIndex: wStyle.zIndex,
        position: wStyle.position,
        rect: { x: Math.round(wRect.x), y: Math.round(wRect.y), w: Math.round(wRect.width), h: Math.round(wRect.height) },
        pointerEvents: wStyle.pointerEvents,
      },
      sidebar: {
        zIndex: sStyle.zIndex,
        position: sStyle.position,
        overflow: sStyle.overflow,
        rect: { x: Math.round(sRect.x), y: Math.round(sRect.y), w: Math.round(sRect.width), h: Math.round(sRect.height) },
        pointerEvents: sStyle.pointerEvents,
      },
    };
  });
  console.log('\n=== wrap-left-nav and sidebar ===');
  console.log(JSON.stringify(navWrapInfo, null, 2));

  // ─── Simulate a real user click sequence ─────────────────────────────────
  // A real user clicks at the center of the screen (not using element handle)
  // They see a small icon at roughly x=46, y=620. Can they click it?
  console.log('\n=== Simulating real user click at sidebar icon area ===');
  const preClickLS = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  console.log('Before click - sidebar-collapsed:', preClickLS);

  // Click at the coordinates where the icon appears (center of the toggle button)
  await page.mouse.click(46, 620);
  await page.waitForTimeout(400);

  const postClickLS = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
  console.log('After mouse.click(46, 620) - sidebar-collapsed:', postClickLS);

  const sidebarWidthAfter = await page.evaluate(() => {
    const s = document.querySelector('aside[data-sidebar-focus]');
    return s ? getComputedStyle(s).width : 'not found';
  });
  console.log('Sidebar width after click:', sidebarWidthAfter);

  if (postClickLS === 'false') {
    console.log('RESULT: Expand button IS clickable via normal user click - NO BUG');
  } else {
    console.log('RESULT: Expand button is NOT responding to normal click - BUG CONFIRMED');
  }

  await browser.close();
  console.log('\nOverlap check complete.');
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
