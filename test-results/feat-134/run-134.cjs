const { chromium } = require('/home/gabriel/docker/code-server/config/workspace/LeadAwakerApp/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ executablePath: '/home/gabriel/.cache/ms-playwright/chromium_headless_shell-1208/chrome-linux/headless_shell', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', msg => { if (msg.type() === 'error') errs.push(msg.text()); });

  // Step 1: Login
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/gabriel/docker/code-server/config/workspace/LeadAwakerApp/test-results/feat-134/00-login.png' });
  const emailEl = await page.$('input[type=email]');
  const passEl = await page.$('input[type=password]');
  if (emailEl) await emailEl.fill('leadawaker@gmail.com');
  if (passEl) await passEl.fill('test123');
  const submitEl = await page.$('button[type=submit]');
  if (submitEl) await submitEl.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/home/gabriel/docker/code-server/config/workspace/LeadAwakerApp/test-results/feat-134/01-after-login.png' });
  console.log('URL AeTEGG LOGIN:', page.url());

  // Step 2: Navigate to calendar
  await page.goto('http://localhost:5173/agency/calendar');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/home/gabriel/docker/code-server/config/workspace/LeadAwakerApp/test-results/feat-134/02-calendar.png' });
  console.log('CALENDAR RLL I7RL:', page.url());

  // Step 3: Get view label
  const viewLabelEl = await page.$('[data-testid="text-view-label"]');
  if (viewLabelEl) console.log('VIEW_LABEL:', await viewLabelEl.innerText());

  // Step 4: Collect booking cards
  const cards = await page.$$('[data-testid^="booking-card-"]');
  console.log('BOOKING_CARDS_FOUND:', cards.length);
  for (let i = 0; i < cards.length; i++) {
    const tid = await cards[i].getAttribute('data-testid');
    const txt = (await cards[i].innerText()).replace(/[\r/\n]+/g, ' ').trim().substring(0, 100);
    const box = await cards[i].boundingBox();
    console.log('  CARD:', tid, '| text:', txt, '| y:', box ? box.y : 'N/A');
  }

  // Step 5: Collect day cells
  const days = await page.$$('[data-testid^="day-"]');
  console.log('DAY_CELLS_FOUND:', days.length);
  for (let j = 0; j < days.length; j++) {
    const dtid = await days[j].getAttribute('data-testid');
    const innerCards = await days[j].$$('[data-testid^="booking-card-"]');
    if (innerCards.length > 0) console.log('  DAY_WITH_BOOKING:', dtid, 'count:', innerCards.length);
  }

  // Step 6: Check sidebar appointment list
  const appts = await page.$$('[data-testid^="row-appt-"]');
  console.log('SIDEBAR_APPTS:', appts.length);
  for (let k = 0; k < appts.length; k++) {
    const atid = await appts[k].getAttribute('data-testid');
    const atxt = (await appts[k].innerText()).replace(/[\r/\n]+/g, ' ').trim().substring(0, 100);
    console.log('  APPT:', atid, 'text:', atxt);
  }

  // Step 7: Check card cursor
  if (cards.length > 0) {
    const cursor = await cards[0].evaluate(el => window.getComputedStyle(el).cursor);
    const ta = await cards[0].evaluate(el => window.getComputedStyle(el).touchAction);
    console.log('CARD_CURSOR:', cursor);
    console.log('CARD_TOUCH_ACTION:', ta);
  }

  await page.screenshot({ path: '/home/gabriel/docker/code-server/config/workspace/LeadAwakerApp/test-results/feat-134/03-calendar-full.png', fullPage: true });
  console.log('CONSOLE_ERRORS:', errs.length > 0 ? errs.join(' | ') : 'none');
  await browser.close();
  console.log('DONE');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });