const http = require('http');

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
        resolve({
          status: res.statusCode,
          body: chunks,
          cookie: setCookie ? setCookie[0].split(';')[0] : null,
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// 3 lead templates per campaign slot — different personas per slot index (0, 1, 2)
const LEAD_TEMPLATES = [
  {
    firstName: 'Sarah',
    lastName: 'Mitchell',
    email: 'sarah.mitchell@gmail.com',
    phone: '+15550147',
    conversionStatus: 'New',
    source: 'Facebook Ads',
    priority: 'High',
    language: 'en',
    notes: 'Interested in the premium tier. Filled out the landing page form.',
  },
  {
    firstName: 'James',
    lastName: 'Rodriguez',
    email: 'james.r.business@outlook.com',
    phone: '+15550238',
    conversionStatus: 'Contacted',
    source: 'Google Ads',
    priority: 'Medium',
    language: 'en',
    notes: 'Opened the first WhatsApp message but did not reply yet.',
  },
  {
    firstName: 'Emily',
    lastName: 'Chen',
    email: 'emily.chen.mktg@yahoo.com',
    phone: '+15550392',
    conversionStatus: 'Responded',
    source: 'Referral',
    priority: 'High',
    language: 'en',
    notes: 'Replied asking for more details about pricing and timeline.',
  },
  {
    firstName: 'Michael',
    lastName: 'Torres',
    email: 'm.torres.consulting@gmail.com',
    phone: '+15550451',
    conversionStatus: 'Multiple Responses',
    source: 'LinkedIn',
    priority: 'High',
    language: 'en',
    notes: 'Active back-and-forth conversation. Expressed strong buying intent.',
  },
  {
    firstName: 'Amanda',
    lastName: 'Kowalski',
    email: 'a.kowalski@hotmail.com',
    phone: '+15550563',
    conversionStatus: 'Qualified',
    source: 'Cold Outreach',
    priority: 'High',
    language: 'en',
    notes: 'Confirmed budget and timeline. Waiting to book a discovery call.',
  },
  {
    firstName: 'David',
    lastName: 'Park',
    email: 'davidpark.ventures@gmail.com',
    phone: '+15550671',
    conversionStatus: 'Call Booked',
    source: 'Instagram Ads',
    priority: 'High',
    language: 'en',
    notes: 'Call scheduled. Sent calendar confirmation. Very engaged.',
    bookedCallDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  {
    firstName: 'Jessica',
    lastName: 'Thompson',
    email: 'jessica.t.realtor@gmail.com',
    phone: '+15550782',
    conversionStatus: 'New',
    source: 'Facebook Ads',
    priority: 'Low',
    language: 'en',
    notes: 'Just added to the campaign. First message not sent yet.',
  },
  {
    firstName: 'Robert',
    lastName: 'Garcia',
    email: 'r.garcia.sales@outlook.com',
    phone: '+15550893',
    conversionStatus: 'Contacted',
    source: 'Google Ads',
    priority: 'Medium',
    language: 'en',
    notes: 'Delivered initial WhatsApp message. Awaiting reply.',
  },
  {
    firstName: 'Lauren',
    lastName: 'Walsh',
    email: 'lauren.walsh.biz@gmail.com',
    phone: '+15550914',
    conversionStatus: 'Lost',
    source: 'Referral',
    priority: 'Low',
    language: 'en',
    notes: 'Said she already signed with a competitor. Marked as lost.',
  },
];

async function main() {
  // 1. Login
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email: 'leadawaker@gmail.com',
    password: 'test123',
  });

  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes.status, loginRes.body);
    process.exit(1);
  }
  const cookie = loginRes.cookie;
  console.log('Logged in successfully');

  // 2. Fetch campaigns
  const campaignsRes = await makeRequest('GET', '/api/campaigns?limit=100', null, cookie);
  if (campaignsRes.status !== 200) {
    console.error('Failed to fetch campaigns:', campaignsRes.status, campaignsRes.body);
    process.exit(1);
  }

  const campaignsData = JSON.parse(campaignsRes.body);
  const campaigns = Array.isArray(campaignsData)
    ? campaignsData
    : (campaignsData.campaigns || campaignsData.data || []);

  if (campaigns.length === 0) {
    console.error('No campaigns found. Please create campaigns first.');
    process.exit(1);
  }

  console.log(`Found ${campaigns.length} campaigns: ${campaigns.map(c => `#${c.id} "${c.name}"`).join(', ')}`);

  // 3. Seed 3 leads per campaign
  let templateIndex = 0;
  let totalCreated = 0;
  const errors = [];

  for (const campaign of campaigns) {
    console.log(`\nSeeding leads for campaign #${campaign.id} "${campaign.name}"...`);

    for (let slot = 0; slot < 3; slot++) {
      const template = LEAD_TEMPLATES[templateIndex % LEAD_TEMPLATES.length];
      templateIndex++;

      const leadData = {
        ...template,
        accountsId: campaign.accountsId || campaign.Accounts_id || 1,
        campaignsId: campaign.id,
      };

      const res = await makeRequest('POST', '/api/leads', leadData, cookie);

      if (res.status === 201 || res.status === 200) {
        const created = JSON.parse(res.body);
        console.log(`  ✓ Created lead #${created.id}: ${leadData.firstName} ${leadData.lastName} <${leadData.email}> (${leadData.conversionStatus})`);
        totalCreated++;
      } else {
        const msg = `  ✗ Failed to create ${leadData.firstName} ${leadData.lastName} for campaign #${campaign.id}: ${res.status} ${res.body}`;
        console.error(msg);
        errors.push(msg);
      }
    }
  }

  // 4. Summary
  console.log(`\n--- Done ---`);
  console.log(`Leads created: ${totalCreated}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.forEach(e => console.error(e));
  }

  // 5. Verify
  const verifyRes = await makeRequest('GET', '/api/leads?limit=100', null, cookie);
  if (verifyRes.status === 200) {
    const verifyData = JSON.parse(verifyRes.body);
    const total = Array.isArray(verifyData) ? verifyData.length : (verifyData.total || '?');
    console.log(`Total leads now in DB: ${total}`);
  }
}

main().catch(console.error);
