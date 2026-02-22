const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login as admin
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill('leadawaker@gmail.com');
  await page.locator('input[type=password]').fill('test123');
  await page.locator('button[type=submit]').click();
  await page.waitForTimeout(2500);
  console.log('URL after login:', page.url());

  // --- TEST EXPANDED STATE ---
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const sb = page.locator('aside[data-sidebar-focus]');
  const sbBoxExpanded = await sb.boundingBox();
  const navSpanCountExpanded = await sb.locator('nav a span').count();
  const navLinkCountExpanded = await sb.locator('nav a').count();
  console.log('EXPANDED  | width=' + sbBoxExpanded?.width + ' | nav a count=' + navLinkCountExpanded + ' | nav a span count=' + navSpanCountExpanded);
  await page.screenshot({ path: '/tmp/verify-expanded.png' });

  // --- TEST COLLAPSED STATE ---
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'true'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const sbBoxCollapsed = await sb.boundingBox();
  const navSpanCountCollapsed = await sb.locator('nav a span').count();
  const navLinkCountCollapsed = await sb.locator('nav a').count();
  console.log('COLLAPSED | width=' + sbBoxCollapsed?.width + ' | nav a count=' + navLinkCountCollapsed + ' | nav a span count=' + navSpanCountCollapsed);
  await page.screenshot({ path: '/tmp/verify-collapsed.png' });

  // --- TEST PHYSICAL TOGGLE BUTTON ---
  // First expand
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'false'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Find and click the collapse button (the button at the bottom of the sidebar)
  const allSbBtns = await sb.locator('button').all();
  console.log('Sidebar button count:', allSbBtns.length);

  // The Collapse button is near the bottom — check each button text/icon
  for (let i = 0; i < allSbBtns.length; i++) {
    const txt = await allSbBtns[i].textContent();
    const box = await allSbBtns[i].boundingBox();
    console.log('  btn[' + i + '] text="' + txt?.trim() + '" y=' + box?.y);
  }

  // Click the "Collapse" button (it has text "Collapse" in expanded state)
  const collapseBtn = sb.locator('button', { hasText: 'Collapse' }).first();
  const collapseBtnCount = await collapseBtn.count();
  console.log('Collapse button found:', collapseBtnCount);

  if (collapseBtnCount > 0) {
    const widthBefore = (await sb.boundingBox())?.width;
    await collapseBtn.click();
    await page.waitForTimeout(800);
    const widthAfter = (await sb.boundingBox())?.width;
    const navSpansAfter = await sb.locator('nav a span').count();
    console.log('TOGGLE CLICK: before=' + widthBefore + ' after=' + widthAfter + ' spans=' + navSpansAfter);
    await page.screenshot({ path: '/tmp/verify-toggle-collapse.png' });

    // Expand again by clicking the toggle
    const allBtnsCollapsed = await sb.locator('button').all();
    // In collapsed state the Collapse button has no text (only icon)
    // Click the 3rd-from-last button (Collapse toggle)
    const reExpandBtn = sb.locator('button').nth(allBtnsCollapsed.length - 3);
    await reExpandBtn.click();
    await page.waitForTimeout(800);
    const widthFinal = (await sb.boundingBox())?.width;
    const navSpansFinal = await sb.locator('nav a span').count();
    console.log('RE-EXPAND : width=' + widthFinal + ' spans=' + navSpansFinal);
    await page.screenshot({ path: '/tmp/verify-toggle-expand.png' });
  }

  await browser.close();
  console.log('Done - check /tmp/verify-*.png');
}

run().catch(function(err) { console.error('Error:', err.message); process.exit(1); });
