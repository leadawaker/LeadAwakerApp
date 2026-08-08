// ⚠️ SUPERSEDED by refresh-account-onboarding-solar.js (2026-08-04).
// This script writes the Dutch KITCHEN copy. The demo account is now aimed at
// SOLAR, so running it (or its --revert) will overwrite the solar content and
// put the onboarding page back to kitchens. Kept only as the record of the
// original English text. Use refresh-account-onboarding-solar.js instead.
//
// Translate the Lead Awaker account (id 1) onboarding knowledge base to Dutch.
// These 17 entries are what the Communication Profile onboarding wizard writes
// (services / pricing / policies / objections / faq / hours).
//
// IMPORTANT — what may and may not be translated:
//   · The six FACT_DEFS entries (profileConstants.ts) are looked up by
//     category + EXACT ENGLISH TITLE. useOnboardingFacts.ts :: matchEntry does
//     a strict equality match, so translating those titles orphans the answer
//     and the wizard step renders empty. Their titles are pinned in English and
//     only the content is translated. They are marked `pinnedTitle` below.
//   · objections + faq are Q&A grids matched by CATEGORY only, so their titles
//     are the questions themselves and translate freely.
//   · hours / extra services entries aren't read by the wizard at all.
//
// Idempotent: matches rows by id, and each id's original English text is kept
// below so translate-account-kb-nl.js --revert can put it back.
// Run:    node --env-file=.env translate-account-kb-nl.js
// Revert: node --env-file=.env translate-account-kb-nl.js --revert
import pg from 'pg';

const SCHEMA = 'p2mxx34fvbf3ll6';
const ACCOUNT_ID = 1;
const revert = process.argv.includes('--revert');

// id → { en: [title, content], nl: [title, content] }
const ENTRIES = {
  54: {
    en: ['Financing & installments',
      'We offer 0%-interest financing up to 36 months (subject to approval), or a standard 3-payment installment plan: deposit, 40% at delivery, balance on completion.'],
    nl: ['Financiering en termijnbetaling',
      'We bieden rentevrije financiering tot 36 maanden (onder voorbehoud van goedkeuring), of onze standaard betaling in 3 termijnen: aanbetaling, 40% bij levering, de rest bij oplevering.'],
  },
  55: {
    en: ['Kitchen design & installation',
      'Full-service kitchen renovation: 3D design consultation, custom cabinetry, countertops (quartz/granite/butcher block), appliance integration, and installation by our own certified fitters.'],
    nl: ['Keukenontwerp en installatie',
      'Complete keukenrenovatie: 3D-ontwerpgesprek, maatwerkkasten, werkbladen (composiet, graniet of massief hout), inbouwapparatuur en installatie door onze eigen gecertificeerde monteurs.'],
  },
  56: {
    en: ['Refacing & partial renovation',
      'For budget-conscious updates: cabinet door/drawer-front replacement, new countertops, and hardware swaps without a full gut renovation.'],
    nl: ['Renovatie van fronten en deelrenovatie',
      'Voor een update met een kleiner budget: vervanging van kastdeuren en ladefronten, nieuwe werkbladen en nieuw beslag, zonder dat de hele keuken eruit hoeft.'],
  },
  57: {
    en: ['Opening hours',
      'Showroom open Tue-Sat 10:00-18:00, closed Sundays/Mondays and public holidays. Site visits and installations scheduled on weekdays.'],
    nl: ['Openingstijden',
      'Showroom open van dinsdag t/m zaterdag, 10:00-18:00 uur. Zondag, maandag en op feestdagen zijn we gesloten. Inmetingen en installaties plannen we door de week.'],
  },
  93: {
    pinnedTitle: true, // FACT_DEFS lookup key — must stay English
    en: ['Negotiation room',
      "Our quotes are fixed-price and transparent, we don't haggle back and forth. We can flex on payment timing, trimming scope to fit a budget, or bundling in a slower season for a discount."],
    nl: ['Onderhandelingsruimte',
      'Onze offertes zijn transparant en met vaste prijzen, we onderhandelen niet heen en weer. We kunnen wel meebewegen in de betaaltermijnen, de omvang aanpassen zodat het binnen het budget past, of korting geven bij inplannen in een rustiger seizoen.'],
  },
  94: {
    pinnedTitle: true, // FACT_DEFS lookup key — must stay English
    en: ['Financing',
      'Yes, we partner with a financing provider for 0%-interest plans up to 36 months, subject to approval.'],
    nl: ['Financiering',
      'Ja, we werken samen met een financieringspartner voor rentevrije regelingen tot 36 maanden, onder voorbehoud van goedkeuring.'],
  },
  95: {
    pinnedTitle: true, // FACT_DEFS lookup key — must stay English
    en: ['Installments',
      'Standard split is 3 payments: deposit on signing, 40% at delivery, balance on completed installation. Custom schedules available for larger projects.'],
    nl: ['Termijnbetaling',
      'Standaard verdelen we het over 3 termijnen: aanbetaling bij ondertekening, 40% bij levering en de rest na afronding van de installatie. Bij grotere projecten is een aangepast schema mogelijk.'],
  },
  96: {
    pinnedTitle: true, // FACT_DEFS lookup key — must stay English
    en: ['Delivery time',
      'Typical timeline is 6-10 weeks from final design approval to installation day, depending on cabinet customization and countertop material lead times.'],
    nl: ['Levertijd',
      'Normaal duurt het 6 tot 10 weken van de definitieve goedkeuring van het ontwerp tot de installatiedag, afhankelijk van het maatwerk in de kasten en de levertijd van het materiaal voor het werkblad.'],
  },
  97: {
    pinnedTitle: true, // FACT_DEFS lookup key — must stay English
    en: ['Guarantees & warranty',
      '10-year warranty on cabinetry construction, 2-year warranty on installation workmanship, plus manufacturer warranties on appliances (typically 1-2 years). Custom orders aren’t returnable once production starts, but fit/spec issues are caught during the design review before that point.'],
    nl: ['Garanties',
      '10 jaar garantie op de constructie van de kasten, 2 jaar garantie op het installatiewerk, plus fabrieksgarantie op de apparatuur (meestal 1 tot 2 jaar). Maatwerkorders kunnen niet retour zodra de productie is gestart, maar problemen met maatvoering of specificaties halen we er daarvoor al uit tijdens de ontwerpcontrole.'],
  },
  98: {
    pinnedTitle: true, // FACT_DEFS lookup key — must stay English
    en: ['Sensitive topics',
      "Don't quote competitor pricing or badmouth other kitchen companies. Don't offer legal advice on building permits, redirect to the municipality or our project manager. Don't discuss internal cost breakdowns or margins."],
    nl: ['Gevoelige onderwerpen',
      'Noem geen prijzen van concurrenten en spreek niet negatief over andere keukenbedrijven. Geef geen juridisch advies over vergunningen, verwijs door naar de gemeente of naar onze projectleider. Bespreek geen interne kostenopbouw of marges.'],
  },
  99: {
    en: ["It's too expensive",
      'Our price reflects solid wood construction and a 10-year warranty, cheaper kitchens often cost more in repairs within 5 years. We can also adjust scope to fit your budget.'],
    nl: ['Het is te duur',
      'Onze prijs komt voort uit massief houten constructie en 10 jaar garantie. Goedkopere keukens kosten binnen 5 jaar vaak meer aan reparaties. We kunnen de omvang ook aanpassen zodat het binnen je budget past.'],
  },
  100: {
    en: ['I want to get other quotes first',
      "Of course, we recommend comparing. Ask every company for their warranty terms and whether installation is done by their own team or subcontracted, that's usually where the real difference shows up."],
    nl: ['Ik wil eerst andere offertes opvragen',
      'Natuurlijk, vergelijken raden we juist aan. Vraag bij elk bedrijf naar de garantievoorwaarden en of ze de installatie met een eigen team doen of uitbesteden. Daar zit meestal het echte verschil.'],
  },
  101: {
    en: ["I'm not ready to decide yet",
      'No pressure, we can hold your design and quote for 30 days. Want me to check in with you in a couple weeks?'],
    nl: ['Ik ben er nog niet uit',
      'Geen druk, we houden je ontwerp en offerte 30 dagen aan. Zal ik over een paar weken even bij je terugkomen?'],
  },
  102: {
    en: ['How do I know the quality will be good?',
      'We can share photos from recent installations in your area, and our showroom has full display kitchens you can see and touch.'],
    nl: ['Hoe weet ik of de kwaliteit goed is?',
      'We kunnen foto’s delen van recente installaties bij jou in de buurt, en in onze showroom staan complete keukens die je kunt zien en voelen.'],
  },
  103: {
    en: ["Can you match a competitor's price?",
      "We don't price-match blind since we're not sure what's included in their quote, but happy to review it together and show where the difference is."],
    nl: ['Kunnen jullie de prijs van een concurrent evenaren?',
      'We gaan niet blind mee in een prijs, omdat we niet weten wat er in die offerte zit. Maar we nemen hem graag samen door en laten zien waar het verschil zit.'],
  },
  104: {
    en: ['Do you handle plumbing/electrical changes?',
      'Yes, our installers coordinate licensed plumbers and electricians as part of the project, no need to hire separately.'],
    nl: ['Regelen jullie ook loodgieters- en elektrawerk?',
      'Ja, onze monteurs schakelen erkende loodgieters en elektriciens in als onderdeel van het project. Je hoeft die niet apart in te huren.'],
  },
  105: {
    en: ['Can I see the design before committing?',
      'Yes, every project starts with a 3D render you approve before production begins.'],
    nl: ['Kan ik het ontwerp zien voordat ik me vastleg?',
      'Ja, elk project begint met een 3D-ontwerp dat jij goedkeurt voordat de productie start.'],
  },
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query('BEGIN');
  let updated = 0;
  const missing = [];

  for (const [id, e] of Object.entries(ENTRIES)) {
    const [, content] = revert ? e.en : e.nl;
    // A pinned title is a lookup key for the onboarding wizard, never translated.
    const title = e.pinnedTitle ? e.en[0] : (revert ? e.en[0] : e.nl[0]);
    const res = await client.query(
      `UPDATE "${SCHEMA}"."Account_Knowledge_Base"
          SET title = $2, content = $3, updated_at = NOW()
        WHERE id = $1 AND account_id = $4
        RETURNING id`,
      [Number(id), title, content, ACCOUNT_ID],
    );
    if (res.rowCount === 0) missing.push(id); else updated++;
  }

  await client.query('COMMIT');
  console.log(`✓ ${revert ? 'reverted to English' : 'translated to Dutch'}: ${updated} knowledge base entries (account ${ACCOUNT_ID})`);
  if (missing.length) console.warn(`⚠ not found (skipped): ${missing.join(', ')}`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
