// Re-aim the Lead Awaker account (id 1) onboarding page at SOLAR instead of
// kitchens. Supersedes translate-account-kb-nl.js, which left the demo content
// as a Dutch kitchen company (Instakeukens).
//
// Three separate things made that page read "kitchen". All are fixed here:
//
//   1. The 17 Account_Knowledge_Base entries were kitchen copy. Rewritten for
//      solar, in Dutch.
//   2. Accounts.business_niche was 'Lead Reactivation', which has no
//      Niche_Vocabulary row. storage.getNicheVocabulary falls back to the
//      '__default__' row, and that row is kitchen ("keuken", "keukenproject",
//      "keukenadviseur"), so the preferred-words step offered kitchen words.
//      Set to 'Solar Panels', which has a real row.
//   3. The profile differentiator was "Dedicated designer from start to finish".
//
// Also thickens the Solar Panels project_terms (it held a single word, so the
// word-picker step had nothing to pick between).
//
// TITLE PINNING (unchanged rule): the six FACT_DEFS entries in
// profileConstants.ts are looked up by category + EXACT ENGLISH TITLE
// (useOnboardingFacts.ts :: matchEntry, strict equality). Translating those
// titles orphans the answer and blanks the wizard step. Only their content
// changes. objections/faq are matched by category, so their titles are free.
//
// Run:    node --env-file=.env refresh-account-onboarding-solar.js
// Revert: node --env-file=.env refresh-account-onboarding-solar.js --revert
//         (restores the original English kitchen content + old niche)
import pg from 'pg';

const SCHEMA = 'p2mxx34fvbf3ll6';
const ACCOUNT_ID = 1;
const revert = process.argv.includes('--revert');

const OLD_NICHE = 'Lead Reactivation';
const NEW_NICHE = 'Solar Panels';
const OLD_DIFFERENTIATOR = 'Dedicated designer from start to finish';
const NEW_DIFFERENTIATOR = [
  'Eigen montageteams, we besteden het dakwerk niet uit',
  'Vaste prijs vooraf, inclusief steiger en aanmelding bij de netbeheerder',
  'Opbrengstberekening op basis van jouw eigen dak, niet een landelijk gemiddelde',
].join('\n');

// id → { pinnedTitle?, en: [title, content], nl: [title, content] }
// `en` = the original English kitchen text, kept so --revert works.
const ENTRIES = {
  // ── services ───────────────────────────────────────────────────────────────
  55: {
    en: ['Kitchen design & installation',
      'Full-service kitchen renovation: 3D design consultation, custom cabinetry, countertops (quartz/granite/butcher block), appliance integration, and installation by our own certified fitters.'],
    nl: ['Zonnepanelen: ontwerp en installatie',
      'Complete installatie van A tot Z: dakinspectie en schaduwanalyse, systeemontwerp op maat, panelen en omvormer, montage door onze eigen gecertificeerde monteurs en de aanmelding bij de netbeheerder.'],
  },
  56: {
    en: ['Refacing & partial renovation',
      'For budget-conscious updates: cabinet door/drawer-front replacement, new countertops, and hardware swaps without a full gut renovation.'],
    nl: ['Thuisbatterij en uitbreiding',
      'Heb je al panelen? We breiden bestaande systemen uit, vervangen een verouderde omvormer en installeren een thuisbatterij of laadpaal, ook als de panelen ooit door een ander zijn gelegd.'],
  },
  96: {
    pinnedTitle: true,
    en: ['Delivery time',
      'Typical timeline is 6-10 weeks from final design approval to installation day, depending on cabinet customization and countertop material lead times.'],
    nl: ['Levertijd',
      'Normaal 3 tot 6 weken van akkoord tot installatiedag. De installatie zelf is meestal op een dag klaar. Bij een complex dak of een systeem met batterij plannen we twee dagen in.'],
  },
  // ── hours ──────────────────────────────────────────────────────────────────
  57: {
    en: ['Opening hours',
      'Showroom open Tue-Sat 10:00-18:00, closed Sundays/Mondays and public holidays. Site visits and installations scheduled on weekdays.'],
    nl: ['Openingstijden',
      'Kantoor bereikbaar maandag t/m vrijdag 08:00-17:30 uur, zaterdag op afspraak. Dakinspecties en installaties plannen we door de week. Op zon- en feestdagen zijn we gesloten.'],
  },
  // ── pricing (all three are wizard fact steps: titles pinned) ───────────────
  93: {
    pinnedTitle: true,
    en: ['Negotiation room',
      "Our quotes are fixed-price and transparent, we don't haggle back and forth. We can flex on payment timing, trimming scope to fit a budget, or bundling in a slower season for a discount."],
    nl: ['Onderhandelingsruimte',
      'Onze offertes zijn transparant en met vaste prijzen, inclusief steiger, materiaal en aanmelding. We onderhandelen niet heen en weer. We kunnen wel meebewegen in de betaaltermijnen, het aantal panelen aanpassen zodat het binnen het budget past, of korting geven bij inplannen in een rustiger periode.'],
  },
  94: {
    pinnedTitle: true,
    en: ['Financing',
      'Yes, we partner with a financing provider for 0%-interest plans up to 36 months, subject to approval.'],
    nl: ['Financiering',
      'Ja, we werken samen met een financieringspartner voor rentevrije regelingen tot 36 maanden, onder voorbehoud van goedkeuring. Veel klanten kiezen een looptijd waarbij de maandlast ongeveer gelijk loopt met wat ze op hun energierekening besparen.'],
  },
  95: {
    pinnedTitle: true,
    en: ['Installments',
      'Standard split is 3 payments: deposit on signing, 40% at delivery, balance on completed installation. Custom schedules available for larger projects.'],
    nl: ['Termijnbetaling',
      'Standaard verdelen we het over 2 termijnen: 30% aanbetaling bij ondertekening en de rest na oplevering van de installatie. Bij grotere systemen of een zakelijk dak is een aangepast schema mogelijk.'],
  },
  // ── policies (wizard fact steps: titles pinned) ────────────────────────────
  97: {
    pinnedTitle: true,
    en: ['Guarantees & warranty',
      '10-year warranty on cabinetry construction, 2-year warranty on installation workmanship, plus manufacturer warranties on appliances (typically 1-2 years). Custom orders aren’t returnable once production starts, but fit/spec issues are caught during the design review before that point.'],
    nl: ['Garanties',
      '25 jaar productgarantie en 25 jaar vermogensgarantie op de panelen, 10 tot 12 jaar op de omvormer en 10 jaar op ons installatiewerk, inclusief de waterdichtheid van de dakdoorvoer. Blijkt het dak bij de inspectie ongeschikt, dan gaat het project niet door en betaal je niets.'],
  },
  98: {
    pinnedTitle: true,
    en: ['Sensitive topics',
      "Don't quote competitor pricing or badmouth other kitchen companies. Don't offer legal advice on building permits, redirect to the municipality or our project manager. Don't discuss internal cost breakdowns or margins."],
    nl: ['Gevoelige onderwerpen',
      'Noem geen prijzen van concurrenten en spreek niet negatief over andere installateurs. Geef geen fiscaal of juridisch advies over de salderingsregeling, subsidies of belastingteruggave, verwijs door naar onze energieadviseur. Doe geen harde uitspraken over toekomstige energieprijzen of terugverdientijd zonder berekening. Bespreek geen interne kostenopbouw of marges.'],
  },
  // ── objections (Q&A grid: matched by category, titles free) ────────────────
  99: {
    en: ["It's too expensive",
      'Our price reflects solid wood construction and a 10-year warranty, cheaper kitchens often cost more in repairs within 5 years. We can also adjust scope to fit your budget.'],
    nl: ['Het is te duur',
      'Dat is ook geen kleine uitgave, en anders dan een keuken of een badkamer verdient dit zichzelf wel terug. Bij de meeste daken die wij doen ligt dat rond de 6 à 7 jaar, en de panelen gaan zeker 25 jaar mee. Zal ik het voor jouw dak concreet doorrekenen, dan zie je het zwart op wit.'],
  },
  100: {
    en: ['I want to get other quotes first',
      "Of course, we recommend comparing. Ask every company for their warranty terms and whether installation is done by their own team or subcontracted, that's usually where the real difference shows up."],
    nl: ['Ik wil eerst andere offertes opvragen',
      'Natuurlijk, vergelijken raden we juist aan. Let er dan op of de steiger, de aanmelding bij de netbeheerder en het meerwerk in de prijs zitten, en of ze met een eigen montageteam werken of het uitbesteden. Daar zit meestal het echte verschil, niet in de prijs per paneel.'],
  },
  101: {
    en: ["I'm not ready to decide yet",
      'No pressure, we can hold your design and quote for 30 days. Want me to check in with you in a couple weeks?'],
    nl: ['Ik wacht liever tot er meer duidelijk is over de salderingsregeling',
      'Begrijpelijk, daar is veel over te doen. Wij rekenen je opbrengst altijd door op basis van de regels zoals ze op dat moment gelden, dus zonder aannames over de toekomst. Dan zie je wat het in jouw situatie oplevert. We houden je berekening en offerte 30 dagen aan.'],
  },
  102: {
    en: ['How do I know the quality will be good?',
      'We can share photos from recent installations in your area, and our showroom has full display kitchens you can see and touch.'],
    nl: ['Hoe weet ik of de kwaliteit goed is?',
      'We kunnen foto’s en opbrengstcijfers delen van installaties bij jou in de buurt, op vergelijkbare daken. We werken met vaste merken panelen en omvormers, en de montage doet ons eigen team, dus we kunnen niet naar een onderaannemer wijzen als er iets is.'],
  },
  103: {
    en: ["Can you match a competitor's price?",
      "We don't price-match blind since we're not sure what's included in their quote, but happy to review it together and show where the difference is."],
    nl: ['Levert mijn dak wel genoeg op?',
      'Dat hangt af van de ligging, de hellingshoek en de schaduw van bomen of schoorstenen. Daarom doen we altijd eerst een dakinspectie en schaduwanalyse voordat we een getal noemen. Valt het tegen, dan zeggen we dat eerlijk en gaan we niet door.'],
  },
  // ── faq (Q&A grid: matched by category, titles free) ───────────────────────
  54: {
    en: ['Financing & installments',
      'We offer 0%-interest financing up to 36 months (subject to approval), or a standard 3-payment installment plan: deposit, 40% at delivery, balance on completion.'],
    nl: ['Financiering en termijnbetaling',
      'We bieden rentevrije financiering tot 36 maanden (onder voorbehoud van goedkeuring), of betaling in 2 termijnen: 30% aanbetaling bij ondertekening en de rest na oplevering.'],
  },
  104: {
    en: ['Do you handle plumbing/electrical changes?',
      'Yes, our installers coordinate licensed plumbers and electricians as part of the project, no need to hire separately.'],
    nl: ['Regelen jullie de aanmelding bij de netbeheerder?',
      'Ja, wij melden je installatie aan bij de netbeheerder en registreren hem, dat zit in de prijs. Ook het aanpassen van de groepenkast doet onze eigen elektricien als dat nodig is, je hoeft daar niemand apart voor in te huren.'],
  },
  105: {
    en: ['Can I see the design before committing?',
      'Yes, every project starts with a 3D render you approve before production begins.'],
    nl: ['Kan ik vooraf zien wat het oplevert?',
      'Ja, je krijgt eerst een legplan van je eigen dak met een opbrengstberekening per jaar en een terugverdientijd. Pas als je daar akkoord op geeft, plannen we de installatie in.'],
  },
};

// The Solar Panels row held a single project term, so the preferred-words step
// had nothing to choose between. Kitchens has three; match that.
const SOLAR_PROJECT_TERMS = ['zonnepanelen', 'zonnepaneelproject', 'installatie', 'project'];
const SOLAR_PROJECT_TERMS_OLD = ['zonnepanelen'];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query('BEGIN');
  let updated = 0;
  const missing = [];

  for (const [id, e] of Object.entries(ENTRIES)) {
    const [, content] = revert ? e.en : e.nl;
    const title = e.pinnedTitle ? e.en[0] : (revert ? e.en[0] : e.nl[0]);
    const res = await client.query(
      `UPDATE "${SCHEMA}"."Account_Knowledge_Base"
          SET title=$2, content=$3, updated_at=NOW()
        WHERE id=$1 AND account_id=$4 RETURNING id`,
      [Number(id), title, content, ACCOUNT_ID],
    );
    if (res.rowCount === 0) missing.push(id); else updated++;
  }

  // Drives the preferred-words step via getNicheVocabulary.
  await client.query(
    `UPDATE "${SCHEMA}"."Accounts" SET business_niche=$2, updated_at=NOW() WHERE id=$1`,
    [ACCOUNT_ID, revert ? OLD_NICHE : NEW_NICHE],
  );

  await client.query(
    `UPDATE "${SCHEMA}"."Account_Communication_Profile"
        SET differentiator=$2, updated_at=NOW() WHERE "Accounts_id"=$1`,
    [ACCOUNT_ID, revert ? OLD_DIFFERENTIATOR : NEW_DIFFERENTIATOR],
  );

  await client.query(
    `UPDATE "${SCHEMA}"."Niche_Vocabulary" SET project_terms=$2::jsonb, updated_at=NOW() WHERE niche=$1`,
    [NEW_NICHE, JSON.stringify(revert ? SOLAR_PROJECT_TERMS_OLD : SOLAR_PROJECT_TERMS)],
  );

  await client.query('COMMIT');
  console.log(`✓ knowledge base: ${updated} entries → ${revert ? 'English kitchen' : 'Dutch solar'}`);
  console.log(`✓ business_niche  → ${revert ? OLD_NICHE : NEW_NICHE}`);
  console.log(`✓ differentiator  → ${revert ? 'kitchen (en)' : 'solar (nl), 3 USP lines'}`);
  console.log(`✓ Solar Panels project terms → ${(revert ? SOLAR_PROJECT_TERMS_OLD : SOLAR_PROJECT_TERMS).join(', ')}`);
  if (missing.length) console.warn(`⚠ not found (skipped): ${missing.join(', ')}`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
