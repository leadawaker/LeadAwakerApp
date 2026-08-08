// Message history for the Company Campaign demo (campaign 58).
//
// The Performance panel does NOT read the metrics-history table — it aggregates
// live from Interactions (see metricsWidgets/dashboard/utils.js ::
// liveAggregateByTimeframe). With no interactions it reads 0 / 0 / 0% / 0%.
//
// Leads are bucketed by how recently they were active, so each timeframe of the
// Day/Week/Month control lands on sensible numbers:
//
//            engaged   messaged   replied   booked-in-window
//   1D          45      today          20        3
//   7D         185      +this week     91       15
//   1M         285      +this month   191       33
//
// Aggregation rules being fed (from utils.ts):
//   leadsTargeted = distinct leads with ANY message in the window
//   messagesSent  = outbound rows in the window
//   responseRate  = leads with >=1 inbound / leadsTargeted
//   bookingRate   = leads in window whose status is Booked / leadsTargeted
//
// Every row carries triggered_by='demo-seed' — that is the delete key.
// Run:  node --env-file=.env seed-company-campaign-interactions.js
// Undo: covered by delete-company-campaign-demo.js
import pg from 'pg';

const SCHEMA = 'p2mxx34fvbf3ll6';
const CAMPAIGN_ID = 58;
const ACCOUNT_ID = 1;
const SOURCE_TAG = 'Demo Seed';
const MARKER = 'demo-seed';
const BUSINESS_NUMBER = '31970100000';
const AGENT = 'Thomas';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let seed = 8042026;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

// ── Dutch message pools (kitchen / home improvement reactivation) ─────────────
const OPENERS = [
  'Hoi {name}, dit is {agent} van Instakeukens. Je nam een tijd geleden contact met ons op over je keuken, maar het is er destijds niet van gekomen. Staat dat nog op de planning?',
  'Hoi {name}, {agent} hier van Instakeukens. Je hebt vorig jaar een offerte bij ons opgevraagd voor een nieuwe keuken. Ik was benieuwd of dat nog speelt bij je?',
  'Hoi {name}, met {agent} van Instakeukens. Je had interesse in een keukenrenovatie en toen is het stil geworden. Is dat iets wat nog leeft?',
];
const BUMPS = [
  'Hoi {name}! Ik dacht dat het bij jou misschien gewoon druk was geworden. Staat de keuken nog op de planning?',
  '{name}, wat houdt je op dit moment tegen bij de keuken?',
  'Is het de prijs, of het moment?',
  'Ik laat het hierbij {name}. Wil je er later toch nog over sparren, dan hoor ik het graag :)',
];
const REPLIES_WARM = [
  'Ja hoor, het speelt zeker nog. We hadden het alleen even geparkeerd.',
  'Klopt, we zijn er nog steeds mee bezig. Alleen nog niet doorgepakt.',
  'Ha, goed dat je belt. Het staat nog wel op de lijst ja.',
  'Ja, we willen het nog steeds doen. Alleen niet direct.',
  'We zijn er eigenlijk net weer over begonnen thuis.',
];
const REPLIES_QUESTION = [
  'Wat kost zo een renovatie ongeveer bij jullie?',
  'Hoe lang duurt het van ontwerp tot plaatsing?',
  'Doen jullie het plaatsen ook zelf of besteden jullie dat uit?',
  'Zit er garantie op? En hoe lang dan?',
  'Kunnen we eerst een ontwerp zien voordat we iets tekenen?',
  'Werken jullie ook met betaling in termijnen?',
];
const REPLIES_COOL = [
  'Op dit moment even niet, misschien later dit jaar.',
  'We hebben het even uitgesteld tot na de zomer.',
  'Nog niet, we zijn eerst met de badkamer bezig.',
];
const REPLIES_STOP = [
  'Nee dank je, we hebben het al bij een ander laten doen.',
  'Graag geen berichten meer, bedankt.',
];
const REPLIES_BOOK = [
  'Ja, dat lijkt me een goed idee. Wanneer kan het?',
  'Prima, ik kom graag langs in de showroom.',
  'Ja laten we een afspraak inplannen.',
  'Donderdag zou goed uitkomen bij mij.',
];
const OUT_ANSWERS = [
  'Goede vraag. Een complete renovatie zit meestal tussen de 12.000 en 25.000 euro, afhankelijk van de maat en de afwerking. Een van onze ontwerpers kan er een scherper getal op plakken.',
  'Van definitief ontwerp tot plaatsing is het meestal 6 tot 10 weken, afhankelijk van het maatwerk en de levertijd van het werkblad.',
  'Dat doen we met ons eigen team, we besteden het plaatsen niet uit. Daar zit meestal ook het verschil met andere aanbieders.',
  'Je krijgt 10 jaar garantie op de kasten en 2 jaar op het installatiewerk, plus fabrieksgarantie op de apparatuur.',
  'Zeker, elk traject begint met een 3D-ontwerp dat jij eerst goedkeurt. Er wordt niets geproduceerd voordat jij akkoord bent.',
  'Ja, dat kan in 3 termijnen: aanbetaling, 40% bij levering en de rest bij oplevering. Rentevrije financiering tot 36 maanden kan ook.',
];
const OUT_BOOKING = [
  'Top! Ik heb je ingepland. Je krijgt de bevestiging per mail, tot dan {name}.',
  'Mooi, staat genoteerd. Onze ontwerper neemt de maten dan meteen mee door.',
  'Helemaal goed, ik zet het in de agenda. Tot binnenkort!',
];
const OUT_NUDGE = [
  'Helder {name}, dan laat ik het even rusten. Zal ik over een week of twee nog eens polsen?',
  'Begrijpelijk. Zal ik je een korte samenvatting sturen zodat je het bij de hand hebt?',
  'Prima. Wil je dat ik alvast wat foto’s stuur van recente keukens bij jou in de buurt?',
];

const fill = (s, name) => s.replace(/\{name\}/g, name).replace(/\{agent\}/g, AGENT);

// ── Time helpers ──────────────────────────────────────────────────────────────
const now = new Date();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
// Keep messages inside plausible waking hours so the hourly 1D chart looks real.
function clampToBusiness(d) {
  const h = d.getHours();
  if (h < 8) d.setHours(between(8, 11), between(0, 59));
  else if (h > 21) d.setHours(between(17, 21), between(0, 59));
  return d;
}

try {
  // ── Load the seeded leads ───────────────────────────────────────────────────
  const { rows: leads } = await client.query(
    `SELECT id, first_name, last_name, phone, "Conversion_Status" AS status,
            message_count_sent AS sent, message_count_received AS recv
       FROM "${SCHEMA}"."Leads"
      WHERE "Campaigns_id"=$1 AND "Source"=$2
      ORDER BY id`,
    [CAMPAIGN_ID, SOURCE_TAG],
  );
  if (leads.length === 0) throw new Error(`No '${SOURCE_TAG}' leads on campaign ${CAMPAIGN_ID}. Run seed-company-campaign-demo.js first.`);

  const existing = await client.query(
    `SELECT count(*)::int n FROM "${SCHEMA}"."Interactions" WHERE "Campaigns_id"=$1 AND triggered_by=$2`,
    [CAMPAIGN_ID, MARKER],
  );
  if (existing.rows[0].n > 0) {
    throw new Error(`${existing.rows[0].n} demo interactions already exist. Run delete-company-campaign-demo.js first.`);
  }

  // Only leads that were actually messaged. 'New' leads have no history.
  const active = leads.filter((l) => Number(l.sent) + Number(l.recv) > 0);
  const booked = active.filter((l) => l.status === 'Booked');
  const contacted = active.filter((l) => l.status === 'Contacted');           // messaged, never replied
  const responders = active.filter((l) => l.status !== 'Contacted' && l.status !== 'Booked');

  // ── Bucket assignment (drives the Day / Week / Month numbers) ───────────────
  const take = (arr, n) => arr.splice(0, n);
  const bTodayBooked = take(booked, 3);
  const bWeekBooked = take(booked, 12);
  const bMonthBooked = booked;                                                // remaining 18

  const bTodayContacted = take(contacted, 25);
  const bWeekContacted = contacted;                                           // remaining 69

  const bTodayResp = take(responders, 17);
  const bWeekResp = take(responders, 59);
  const bMonthResp = responders;                                              // remaining

  const BUCKETS = [
    { name: 'today', leads: [...bTodayBooked, ...bTodayContacted, ...bTodayResp], startAgo: [2, 22], spanH: 6 },
    { name: 'week', leads: [...bWeekBooked, ...bWeekContacted, ...bWeekResp], startAgo: [26, 160], spanH: 30 },
    { name: 'month', leads: [...bMonthBooked, ...bMonthResp], startAgo: [190, 700], spanH: 60 },
  ];

  // ── Build rows ──────────────────────────────────────────────────────────────
  const rows = [];
  for (const bucket of BUCKETS) {
    for (const lead of bucket.leads) {
      const name = lead.first_name;
      const nOut = Math.max(1, Number(lead.sent));
      const nIn = Number(lead.recv);
      const startMs = now.getTime() - between(...bucket.startAgo) * HOUR;

      // Interleave: outbound first, then alternate, extra outbounds trail as bumps.
      const thread = [];
      let o = 0, i = 0;
      while (o < nOut || i < nIn) {
        if (o <= i && o < nOut) { thread.push('out'); o++; }
        else if (i < nIn) { thread.push('in'); i++; }
        else { thread.push('out'); o++; }
      }

      let cursor = startMs;
      let bumpNo = 0;
      thread.forEach((dir, idx) => {
        // Replies come back in minutes, new outbound touches hours/days later.
        if (idx > 0) {
          cursor += dir === 'in'
            ? between(4, 90) * MIN
            : between(1, Math.max(2, Math.round(bucket.spanH / 2))) * HOUR;
        }
        const ts = clampToBusiness(new Date(Math.min(cursor, now.getTime() - 2 * MIN)));

        let content, isBump = false, bumpNumber = null;
        if (dir === 'out') {
          if (idx === 0) content = fill(pick(OPENERS), name);
          else if (thread[idx - 1] === 'in') {
            content = lead.status === 'Booked' && idx === thread.length - 1
              ? fill(pick(OUT_BOOKING), name)
              : (rnd() < 0.65 ? pick(OUT_ANSWERS) : fill(pick(OUT_NUDGE), name));
          } else {
            bumpNo = Math.min(bumpNo + 1, BUMPS.length);
            content = fill(BUMPS[bumpNo - 1], name);
            isBump = true;
            bumpNumber = bumpNo;
          }
        } else {
          if (lead.status === 'DND') content = pick(REPLIES_STOP);
          else if (lead.status === 'Lost') content = pick(REPLIES_COOL);
          else if (lead.status === 'Booked' && idx >= thread.length - 3) content = pick(REPLIES_BOOK);
          else if (['Qualified', 'Multiple Responses'].includes(lead.status)) content = rnd() < 0.6 ? pick(REPLIES_QUESTION) : pick(REPLIES_WARM);
          else content = rnd() < 0.5 ? pick(REPLIES_WARM) : pick(REPLIES_QUESTION);
        }

        rows.push({
          lead_id: lead.id,
          who: dir === 'out' ? AGENT : `${lead.first_name} ${lead.last_name ?? ''}`.trim(),
          direction: dir === 'out' ? 'outbound' : 'inbound',
          content,
          status: dir === 'out' ? 'Sent' : 'Received',
          ts,
          is_bump: isBump,
          bump_number: bumpNumber,
          ai_generated: dir === 'out',
          from_number: dir === 'out' ? BUSINESS_NUMBER : (lead.phone ?? ''),
          to_number: dir === 'out' ? (lead.phone ?? '') : BUSINESS_NUMBER,
          lead_name: `${lead.first_name} ${lead.last_name ?? ''}`.trim(),
        });
      });
    }
  }
  rows.sort((a, b) => a.ts - b.ts);

  // ── Insert ──────────────────────────────────────────────────────────────────
  await client.query('BEGIN');
  const cols = ['"Accounts_id"', '"Campaigns_id"', '"Leads_id"', 'account_id', 'campaign_id',
    'lead_id', '"Who"', 'type', 'direction', '"Content"', 'status', 'is_bump', 'bump_number',
    'ai_generated', 'from_number', 'to_number', 'lead_name', 'campaign_name', 'account_name',
    'agent_name', 'triggered_by', 'created_at', 'updated_at', 'sent_at', 'delivered_at', 'is_read'];

  const CHUNK = 200;
  for (let s = 0; s < rows.length; s += CHUNK) {
    const chunk = rows.slice(s, s + CHUNK);
    const values = [];
    const tuples = chunk.map((r, k) => {
      const base = k * 26;
      values.push(
        ACCOUNT_ID, CAMPAIGN_ID, r.lead_id, ACCOUNT_ID, CAMPAIGN_ID,
        r.lead_id, r.who, 'whatsapp_cloud', r.direction, r.content, r.status, r.is_bump, r.bump_number,
        r.ai_generated, r.from_number, r.to_number, r.lead_name, 'Company Campaign', 'Lead Awaker',
        r.direction === 'outbound' ? AGENT : null, MARKER, r.ts, r.ts, r.ts,
        r.direction === 'outbound' ? r.ts : null, true,
      );
      return `(${Array.from({ length: 26 }, (_, j) => `$${base + j + 1}`).join(',')})`;
    });
    await client.query(`INSERT INTO "${SCHEMA}"."Interactions" (${cols.join(',')}) VALUES ${tuples.join(',')}`, values);
  }
  await client.query('COMMIT');

  // ── Report what each timeframe will now show ────────────────────────────────
  const report = async (label, hours) => {
    const q = await client.query(
      `SELECT COUNT(DISTINCT "Leads_id")::int engaged,
              COUNT(*) FILTER (WHERE direction='outbound')::int sent,
              COUNT(DISTINCT "Leads_id") FILTER (WHERE direction='inbound')::int replied
         FROM "${SCHEMA}"."Interactions"
        WHERE "Campaigns_id"=$1 AND triggered_by=$2 AND created_at >= NOW() - ($3 || ' hours')::interval`,
      [CAMPAIGN_ID, MARKER, hours],
    );
    const bk = await client.query(
      `SELECT COUNT(DISTINCT i."Leads_id")::int n
         FROM "${SCHEMA}"."Interactions" i JOIN "${SCHEMA}"."Leads" l ON l.id=i."Leads_id"
        WHERE i."Campaigns_id"=$1 AND i.triggered_by=$2
          AND i.created_at >= NOW() - ($3 || ' hours')::interval AND l."Conversion_Status"='Booked'`,
      [CAMPAIGN_ID, MARKER, hours],
    );
    const { engaged, sent, replied } = q.rows[0];
    console.log(`  ${label.padEnd(4)} leads ${String(engaged).padStart(4)}   sent ${String(sent).padStart(5)}   respons ${String(Math.round(replied / engaged * 100)).padStart(3)}%   boeking ${String(Math.round(bk.rows[0].n / engaged * 100)).padStart(3)}%`);
  };

  console.log(`✓ inserted ${rows.length} interactions (triggered_by='${MARKER}')\n`);
  console.log('  Performance panel will now read:');
  await report('1D', 24);
  await report('7D', 24 * 7);
  await report('1M', 24 * 30);
  console.log('\n✅ interaction seed complete');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('❌ seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
