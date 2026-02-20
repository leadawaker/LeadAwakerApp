const http = require('http');

const LOGIN_URL = '/api/auth/login';
const METRICS_URL = '/api/campaign-metrics-history';
const HOST = 'localhost';
const PORT = 5001;

function makeRequest(method, path, data, cookie) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request({ hostname: HOST, port: PORT, path, method, headers }, (res) => {
      let chunks = '';
      res.on('data', (d) => chunks += d);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({ status: res.statusCode, body: chunks, cookie: setCookie ? setCookie[0].split(';')[0] : null });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Login
  const loginRes = await makeRequest('POST', LOGIN_URL, { email: 'leadawaker@gmail.com', password: 'test123' });
  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes.status, loginRes.body);
    process.exit(1);
  }
  const cookie = loginRes.cookie;
  console.log('Logged in successfully');

  // Seed metrics for 3 campaigns over 14 days
  const campaignConfigs = [
    { id: 1, baseResp: 35, baseBooking: 10, baseMsgs: 20, baseCost: 80 },
    { id: 3, baseResp: 25, baseBooking: 6, baseMsgs: 15, baseCost: 50 },
    { id: 4, baseResp: 18, baseBooking: 4, baseMsgs: 10, baseCost: 35 },
  ];

  let total = 0;
  for (const cfg of campaignConfigs) {
    for (let i = 0; i < 14; i++) {
      const date = new Date(2026, 1, 6 + i); // Feb 6 to Feb 19
      const dateStr = date.toISOString().split('T')[0];

      const variation = () => Math.floor(Math.random() * 15) - 7;
      const respRate = Math.max(5, cfg.baseResp + variation());
      const bookingRate = Math.max(1, cfg.baseBooking + variation());
      const msgsSent = Math.max(3, cfg.baseMsgs + Math.floor(Math.random() * 10) - 5);
      const responses = Math.max(0, Math.round(msgsSent * respRate / 100));
      const bookings = Math.max(0, Math.round(msgsSent * bookingRate / 100));
      const leadsTargeted = msgsSent + Math.floor(Math.random() * 10);
      const cost = Math.max(10, cfg.baseCost + Math.floor(Math.random() * 40) - 20);

      const data = {
        campaignsId: cfg.id,
        metricDate: dateStr,
        totalLeadsTargeted: leadsTargeted,
        totalMessagesSent: msgsSent,
        totalResponsesReceived: responses,
        responseRatePercent: respRate,
        bookingsGenerated: bookings,
        bookingRatePercent: bookingRate,
        totalCost: cost,
        costPerLead: leadsTargeted > 0 ? Math.round(cost / leadsTargeted) : 0,
        costPerBooking: bookings > 0 ? Math.round(cost / bookings) : 0,
        roiPercent: Math.max(0, 100 + Math.floor(Math.random() * 200) - 50),
      };

      const res = await makeRequest('POST', METRICS_URL, data, cookie);
      if (res.status === 201) {
        total++;
      } else {
        console.error('Failed to create metric:', res.status, res.body);
      }
    }
    console.log('Seeded 14 days for campaign', cfg.id);
  }

  console.log('Total metrics created:', total);

  // Verify
  const verifyRes = await makeRequest('GET', METRICS_URL, null, cookie);
  const metrics = JSON.parse(verifyRes.body);
  console.log('Total metrics in DB:', Array.isArray(metrics) ? metrics.length : 'unknown');
}

main().catch(console.error);
