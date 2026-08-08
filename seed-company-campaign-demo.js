// Demo seed for campaign 58 ("Company Campaign", formerly "Home Improvement
// Campaign"). Fills the Summary dashboard so it can be shown live:
//   · renames the campaign
//   · AI analysis (2 sentences) + generated-at
//   · bump stage templates + realistic delays (D+0 / D+2 / D+5 / D+10 / D+17)
//   · A/B test on, 400 leads split 200/200 across variants A and B
//   · 400 leads spread over the pipeline stages, scored for the Lead Heat bands
//   · ~55 leads due today, bucketed across bump stages (Bumps Today panel)
//   · 3 booked calls today + 12 later this week (Next panel + Calendar page)
//
// SAFETY: every seeded lead gets automation_status='demo_pending'. The bump
// scheduler (tools/db/leads.py :: get_active_leads_due) only picks up
// automation_status='active', so nothing here is ever messaged. Phone numbers
// are in the Dutch +3197 machine-to-machine range, which cannot ring a person.
//
// Every seeded row carries Source='Demo Seed' — that is the delete key.
// Run:     node --env-file=.env seed-company-campaign-demo.js
// Undo:    node --env-file=.env delete-company-campaign-demo.js
import pg from 'pg';

const SCHEMA = 'p2mxx34fvbf3ll6';
const CAMPAIGN_ID = 58;
const ACCOUNT_ID = 1;
const SOURCE_TAG = 'Demo Seed';
const CAMPAIGN_NAME = 'Company Campaign';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const L = `"${SCHEMA}"."Leads"`;
const C = `"${SCHEMA}"."Campaigns"`;

// ── Deterministic RNG so re-runs produce the same demo ────────────────────────
let seed = 20260804;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

// ── Dutch names ───────────────────────────────────────────────────────────────
const FIRST = [
  'Daan', 'Sanne', 'Bram', 'Fleur', 'Lars', 'Iris', 'Sven', 'Anouk', 'Jeroen', 'Maaike',
  'Thijs', 'Lotte', 'Ruben', 'Eva', 'Joost', 'Marieke', 'Bas', 'Femke', 'Niels', 'Julia',
  'Koen', 'Noor', 'Tim', 'Sophie', 'Wouter', 'Esmee', 'Rick', 'Lieke', 'Stijn', 'Roos',
  'Mark', 'Nienke', 'Erik', 'Hanne', 'Pieter', 'Merel', 'Jasper', 'Tessa', 'Sander', 'Kim',
];
const LAST = [
  'de Vries', 'Jansen', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer',
  'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen', 'Dekker',
  'Brouwer', 'de Wit', 'Dijkstra', 'van der Berg', 'Kok', 'Willems', 'van Vliet', 'Kuipers',
];

// ── Time helpers (local time) ─────────────────────────────────────────────────
const now = new Date();
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const at = (dayOffset, hour, minute = 0) =>
  new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + dayOffset, hour, minute);
const hoursAgo = (h) => new Date(now.getTime() - h * 3600_000);
const daysAgo = (d) => new Date(now.getTime() - d * 86400_000);

// Days remaining in the current week (today = Tue Aug 4 → +1..+5 reaches Sunday).
const dow = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1 … Sun=7
const daysLeftThisWeek = 7 - dow;

// ── Pipeline plan ─────────────────────────────────────────────────────────────
// variantA/variantB deliberately skew so B wins the A/B test at ~96% confidence
// (two-proportion z-test on booking rate, computed in the ab-stats route).
const PLAN = [
  { status: 'New', a: 58, b: 57, score: [0, 24], sent: [0, 0], recv: [0, 0] },
  { status: 'Contacted', a: 50, b: 44, score: [18, 44], sent: [1, 3], recv: [0, 0] },
  { status: 'Responded', a: 36, b: 35, score: [34, 58], sent: [2, 5], recv: [1, 2] },
  { status: 'Multiple Responses', a: 24, b: 20, score: [50, 70], sent: [3, 7], recv: [2, 5] },
  { status: 'Qualified', a: 15, b: 16, score: [68, 86], sent: [4, 8], recv: [3, 6] },
  { status: 'Booked', a: 9, b: 24, score: [78, 96], sent: [4, 9], recv: [3, 7] },
  { status: 'Lost', a: 5, b: 3, score: [8, 28], sent: [3, 6], recv: [1, 3] },
  { status: 'DND', a: 3, b: 1, score: [0, 14], sent: [1, 4], recv: [1, 2] },
];

// Variant B answers a little faster and in fewer messages — shows up in the
// "avg messages" / "avg response time" bars on the A/B card.
const RESPONSE_MIN = { A: [26, 140], B: [12, 74] };

const leads = [];
let phoneSeq = 10000;

for (const row of PLAN) {
  for (const variant of ['A', 'B']) {
    for (let i = 0; i < row[variant.toLowerCase()]; i++) {
      const first = pick(FIRST);
      const last = pick(LAST);
      const contacted = row.status !== 'New';
      const responded = row.recv[1] > 0;

      // Timeline: first outbound some days back, reply some minutes later.
      const firstSentAt = contacted ? daysAgo(between(1, 26)) : null;
      const replyMinutes = responded ? between(...RESPONSE_MIN[variant]) : null;
      const lastRecvAt = responded && firstSentAt
        ? new Date(firstSentAt.getTime() + replyMinutes * 60_000)
        : null;

      leads.push({
        first_name: first,
        last_name: last,
        phone: `+3197010${String(phoneSeq++).padStart(5, '0')}`,
        email: `${first.toLowerCase().replace(/\s/g, '')}.${last.toLowerCase().replace(/[\s']/g, '')}${phoneSeq}@example.com`,
        status: row.status,
        variant,
        lead_score: between(...row.score),
        message_count_sent: between(...row.sent),
        message_count_received: between(...row.recv),
        first_message_sent_at: firstSentAt,
        last_message_received_at: lastRecvAt,
        last_interaction_at: lastRecvAt ?? firstSentAt,
        opted_out: row.status === 'DND',
        dnc_reason: row.status === 'DND' ? 'Vroeg om geen berichten meer te ontvangen' : null,
        current_bump_stage: 0,
        next_action_at: null,
        booked_call_date: null,
        manual_takeover: false,
        created_at: daysAgo(between(2, 34)),
      });
    }
  }
}

// ── Bumps Today: ~55 non-terminal leads due today, spread over the stages ─────
// The Bumps Today panel counts leads whose next_action_at is today-or-overdue
// and buckets them by current_bump_stage.
const BUMP_BUCKETS = [
  { stage: 0, count: 18 },
  { stage: 1, count: 14 },
  { stage: 2, count: 11 },
  { stage: 3, count: 8 },
  { stage: 4, count: 4 },
];
const bumpable = leads.filter((l) => ['New', 'Contacted', 'Responded', 'Multiple Responses'].includes(l.status));
let cursor = 0;
for (const bucket of BUMP_BUCKETS) {
  for (let i = 0; i < bucket.count && cursor < bumpable.length; i++, cursor++) {
    const lead = bumpable[cursor];
    lead.current_bump_stage = bucket.stage;
    // Mix of "already due" and "due later today" so the panel isn't uniform.
    lead.next_action_at = rnd() < 0.45 ? hoursAgo(between(1, 9)) : at(0, between(15, 21), pick([0, 15, 30, 45]));
    if (bucket.stage >= 1) lead.bump_1_sent_at = daysAgo(between(2, 9));
    if (bucket.stage >= 2) lead.bump_2_sent_at = daysAgo(between(1, 5));
    if (bucket.stage >= 3) lead.bump_3_sent_at = daysAgo(between(1, 3));
    if (bucket.stage >= 4) lead.bump_4_sent_at = daysAgo(1);
  }
}

// ── Appointments ──────────────────────────────────────────────────────────────
// Deliberately sparse so the calendar reads like a real week rather than a wall
// of blocks: 1 today, 2 tomorrow, 1 on Friday, nothing Thursday, nothing on the
// weekend. Remaining booked leads sit in the past so they still count as Booked
// without cluttering the Next panel (which looks back only 1 day).
const booked = leads.filter((l) => l.status === 'Booked');

// dayOffset is relative to today; entries landing on Sat/Sun are dropped.
const APPOINTMENTS = [
  { dayOffset: 0, hour: 11, minute: 0, handoff: false },  // today
  { dayOffset: 1, hour: 10, minute: 30, handoff: false }, // tomorrow
  { dayOffset: 1, hour: 14, minute: 30, handoff: true },  // tomorrow, AI Handoff
  { dayOffset: 3, hour: 13, minute: 30, handoff: false }, // Friday (today is Tue)
];

let bi = 0;
const weekAppointments = [];
for (const slot of APPOINTMENTS) {
  const when = at(slot.dayOffset, slot.hour, slot.minute);
  const weekday = when.getDay();
  if (weekday === 0 || weekday === 6) continue; // never book the weekend
  const lead = booked[bi];
  if (!lead) break;
  bi++;
  lead.booked_call_date = when;
  lead.booked_at = daysAgo(between(1, 6));
  lead.booking_confirmed_at_ = daysAgo(between(1, 5));
  lead.manual_takeover = slot.handoff;
  weekAppointments.push(lead);
}
// Everything still unbooked = calls already held (older than yesterday, so the
// Next panel's now-1day window excludes them).
for (; bi < booked.length; bi++) {
  booked[bi].booked_call_date = daysAgo(between(3, 30));
  booked[bi].booked_at = daysAgo(between(31, 40));
  booked[bi].billable_booking = true;
}

// ── Write ─────────────────────────────────────────────────────────────────────
try {
  await client.query('BEGIN');

  // Guard: never run twice without cleaning up first.
  const existing = await client.query(
    `SELECT count(*)::int AS n FROM ${L} WHERE "Campaigns_id"=$1 AND "Source"=$2`,
    [CAMPAIGN_ID, SOURCE_TAG],
  );
  if (existing.rows[0].n > 0) {
    throw new Error(
      `${existing.rows[0].n} '${SOURCE_TAG}' leads already exist on campaign ${CAMPAIGN_ID}. ` +
      `Run delete-company-campaign-demo.js first.`,
    );
  }

  // 1. Campaign: rename, AI analysis, A/B on, bump cadence + templates.
  const aiSummary =
    'Company Campaign loopt voor op de verwachting: 45% van de heractiveerde leads heeft gereageerd en 34 daarvan ' +
    'hebben een afspraak geboekt, waarbij variant B duidelijk beter presteert dan variant A op boekingspercentage ' +
    '(12,0% tegenover 4,5%) met 98% betrouwbaarheid. Het knelpunt zit bij de 94 leads die nog op Contacted staan ' +
    'zonder enige reactie, dus daar valt de meeste winst te halen met een strakkere bumpcadans.';

  const campaign = await client.query(
    `UPDATE ${C} SET
       name = $2,
       ai_summary = $3,
       ai_summary_generated_at = NOW(),
       ab_enabled = true,
       ab_split_ratio = 50,
       max_bumps = 4,
       bump_1_delay_hours = 48,
       bump_2_delay_hours = 72,
       bump_3_delay_hours = 120,
       bump_4_delay_hours = 168,
       bump_1_template = $4,
       bump_2_template = $5,
       bump_3_template = $6,
       bump_4_template = $7,
       reengagement_bump_template = $8,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, name;`,
    [
      CAMPAIGN_ID,
      CAMPAIGN_NAME,
      aiSummary,
      // Bump copy retuned for the kitchen/home-improvement niche. The previous
      // templates were leftovers from a dental campaign ("your next checkup").
      'Hoi {first_name}! Ik dacht dat het bij jou misschien gewoon druk was geworden. Staat {project} nog op de planning?',
      '{first_name}, wat houdt je op dit moment tegen bij {project}?',
      'Is het de prijs, of het moment?',
      'Ik laat het hierbij {first_name}. Wil je er later toch nog over sparren, dan hoor ik het graag :)',
      'Hoi {first_name}! Je gaf aan dat dit moment beter zou uitkomen, dus bij deze: schikt het nu?',
    ],
  );
  if (campaign.rowCount === 0) throw new Error(`Campaign ${CAMPAIGN_ID} not found`);

  // 2. Leads.
  const cols = [
    '"Accounts_id"', '"Campaigns_id"', 'account_id', 'campaign_id', 'account_name', 'campaign_name',
    'first_name', 'last_name', 'phone', '"Email"', '"Conversion_Status"', '"Source"',
    'automation_status', 'ab_variant', 'lead_score', 'lead_score_updated_at',
    'message_count_sent', 'message_count_received', 'first_message_sent_at',
    'last_message_received_at', 'last_message_sent_at', 'last_interaction_at',
    'current_bump_stage', 'next_action_at', 'bump_1_sent_at', 'bump_2_sent_at',
    'bump_3_sent_at', 'bump_4_sent_at', 'booked_call_date', 'booked_at',
    'booking_confirmed_at_', 'billable_booking', 'manual_takeover', 'opted_out',
    'dnc_reason', 'language', 'created_at', 'updated_at',
  ];

  let inserted = 0;
  for (const l of leads) {
    const values = [
      ACCOUNT_ID, CAMPAIGN_ID, ACCOUNT_ID, CAMPAIGN_ID, 'Lead Awaker', CAMPAIGN_NAME,
      l.first_name, l.last_name, l.phone, l.email, l.status, SOURCE_TAG,
      'demo_pending', l.variant, l.lead_score, l.last_interaction_at ?? l.created_at,
      l.message_count_sent, l.message_count_received, l.first_message_sent_at,
      l.last_message_received_at, l.first_message_sent_at, l.last_interaction_at,
      String(l.current_bump_stage), l.next_action_at, l.bump_1_sent_at ?? null,
      l.bump_2_sent_at ?? null, l.bump_3_sent_at ?? null, l.bump_4_sent_at ?? null,
      l.booked_call_date, l.booked_at ?? null, l.booking_confirmed_at_ ?? null,
      l.billable_booking ?? false, l.manual_takeover, l.opted_out,
      l.dnc_reason, 'nl', l.created_at, new Date(),
    ];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(`INSERT INTO ${L} (${cols.join(', ')}) VALUES (${placeholders})`, values);
    inserted++;
  }

  await client.query('COMMIT');

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log(`✓ campaign renamed: ${campaign.rows[0].id} → "${campaign.rows[0].name}"`);
  console.log(`✓ inserted ${inserted} leads (Source='${SOURCE_TAG}', automation_status='demo_pending')`);
  console.log('\n  pipeline:');
  for (const row of PLAN) console.log(`    ${row.status.padEnd(20)} ${String(row.a + row.b).padStart(3)}   (A ${row.a} / B ${row.b})`);
  console.log('\n  bumps due today:');
  for (const b of BUMP_BUCKETS) console.log(`    stage ${b.stage}  ${b.count}`);
  console.log('\n  appointments:');
  for (const l of weekAppointments) {
    console.log(`    ${l.booked_call_date.toDateString()} ${String(l.booked_call_date.getHours()).padStart(2, '0')}:${String(l.booked_call_date.getMinutes()).padStart(2, '0')}  ${l.first_name} ${l.last_name}${l.manual_takeover ? '  [AI Handoff]' : ''}`);
  }
  console.log('\n✅ seed complete');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
