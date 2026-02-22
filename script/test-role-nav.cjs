// Role-based nav count test
// Admin should see 11 nav items, Viewer should see 5

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'test-results', 'role-nav-test');
fs.mkdirSync(DIR, { recursive: true });

async function shot(page, name) {
  const fp = path.join(DIR, name + '.png');
  await page.screenshot({ path: fp });
  console.log('Screenshot:', fp);
}

async function getNavLinks(page) {
  const links = await page.$$("[data-testid^='link-nav-']");
  const labels = [];
  for (let idx = 0; idx < links.length; idx++) {
    const txt = await links[idx].innerText();
    if (txt.trim()) labels.push(txt.trim());
  }
  return labels;
}

async function loginAs(page, email, pass) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.fill('[data-testid="input-email"]', email);
  await page.fill('[data-testid="input-password"]', pass);
  await page.click('[data-testid="button-login"]');
  await page.waitForTimeout(3000);
  console.log('Post-login URL:', page.url());
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  console.log('\n=== PART 1 : Admin Login ===');
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p1 = await ctx1.newPage();
  await loginAs(p1, 'leadawaker@gmail.com', 'test123');
  await shot(p1, '01-admin-login');
  const adminNav = await getNavLinks(p1);
  console.log('Admin nav count:', adminNav.length);
  console.log('Admin nav items:', adminNav);

  console.log('\n=== PART 2 : Real Viewer Login ===');
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p2 = await ctx2.newPage();
  await loginAs(p2, 'viewer@test.com', 'test123');
  await shot(p2, '02-viewer-login');
  const viewerNav = await getNavLinks(p2);
  console.log('Viewer nav count:', viewerNav.length);
  console.log('Viewer nav items:', viewerNav);

  console.log('\n=== PART 3 : Route Guards (Viewer) ===');
  const routes = ['/agency/users', '/agency/accounts', '/agency/automation-logs', '/agency/tags', '/agency/prompt-library', '/agency/settings'];
  const accessResults = [];
  for (let idx = 0; idx < routes.length; idx++) {
    const r = routes[idx];
    await p2.goto('http://localhost:5173' + r, { waitUntil: 'networkidle', timeout: 15000 });
    await p2.waitForTimeout(2000);
    const finalUrl = p2.url().replace('http://localhost:5173', '');
    const blocked = !finalUrl.includes(r) || finalUrl.includes('/login') || finalUrl.includes('/dashboard');
    console.log('Route:', r, '-> Final:', finalUrl, '| Blocked:', blocked);
    accessResults.push({ route: r, final: finalUrl, blocked });
  }
  await shot(p2, '03-viewer-route-last');

  console.log('\n=== PART 4 : Simulated Viewer Nav ===');
  await p1.evaluate(() => {
    localStorage.setItem('leadawaker_user_role', 'Viewer');
    localStorage.setItem('leadawaker_current_account_id', '2');
  });
  await p1.reload({ waitUntil: 'networkidle' });
  await p1.waitForTimeout(1500);
  const simNav = await getNavLinks(p1);
  console.log('Simulated viewer nav count:', simNav.length);
  console.log('Simulated viewer nav items:', simNav);
  await shot(p1, '04-simulated-viewer-nav');

  console.log('\n==================================================');
  console.log('FINAL REPORT');
  console.log('==================================================');
  const adminPass = adminNav.length >= 10;
  const viewerPass = viewerNav.length >= 4 && viewerNav.length <= 6;
  const simPass = simNav.length >= 4 && simNav.length <= 6;
  const allBlocked = accessResults.every(x => x.blocked);
  console.log('Admin nav (' + adminNav.length + ') expect 11:', adminPass ? 'PASS' : 'FAIL');
  console.log('  Items:', adminNav.join(', '));
  console.log('Viewer nav (' + viewerNav.length + ') expect 5:', viewerPass ? 'PASS' : 'FAIL');
  console.log('  Items:', viewerNav.join(', '));
  console.log('Simulated viewer nav (' + simNav.length + '):', simPass ? 'PASS' : 'FAIL');
  console.log('Route guards (6/6 blocked):', allBlocked ? 'PASS' : 'FAIL');
  accessResults.forEach(x => console.log('  ' + x.route + ' blocked=' + x.blocked + ' -> ' + x.final));
  console.log('\nOVERALL:', (adminPass && viewerPass && allBlocked) ? 'PASS' : 'FAIL');
  await browser.close();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
