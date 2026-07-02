/**
 * Nine pre-written opener archetypes for the First Message field. Picking one
 * from the popup (OpenerTemplatePicker) sets both language slots at once —
 * each entry carries authored en + nl copy so nothing falls back to a raw
 * token. Bodies use only variables buildMap() already resolves
 * ({first_name}, {business}, {project}) — no {month}, since the production
 * sending engine (personalize_message() in automations/_helpers.py) doesn't
 * resolve it yet.
 */

export interface OpenerTemplate {
  id: string; // "A".."I", matches the order they were authored in
  title: { en: string; nl: string };
  body: { en: string; nl: string };
}

export const OPENER_TEMPLATES: OpenerTemplate[] = [
  {
    id: "A",
    title: { en: "Context-first (de-salesed)", nl: "Context eerst (niet verkoperig)" },
    body: {
      en: "Hi {first_name}, it's {business}. You reached out about {project} a while back and it never went ahead. We were curious: is that still on your radar?",
      nl: "Hoi {first_name}, met {business}. Je had een tijd terug contact met ons over {project}, maar het is er toen niet van gekomen. We waren benieuwd: staat het nog op de planning?",
    },
  },
  {
    id: "B",
    title: { en: "Past-quotes ping", nl: "Oude offerte check" },
    body: {
      en: "Hi {first_name}, {business} here. We came across your {project} while going through past quotes. Did that ever get sorted?",
      nl: "Hoi {first_name}, {business} hier. We kwamen je {project} tegen bij het doornemen van eerdere offertes. Is het er nog van gekomen?",
    },
  },
  {
    id: "C",
    title: { en: "Honest-uncertainty (old lists)", nl: "Eerlijke onzekerheid (oude lijsten)" },
    body: {
      en: "Hi {first_name}, {business} here. It's been a while, so not even sure this number is still yours. You once asked us about {project}: is that still on your radar?",
      nl: "Hoi {first_name}, {business} hier. Het is alweer even geleden, dus we weten niet eens zeker of dit nummer nog van jou is. Je vroeg ons ooit naar {project}: staat dat nog op je lijstje?",
    },
  },
  {
    id: "D",
    title: { en: "Premium opt-out", nl: "Premium opt-out" },
    body: {
      en: "Hi {first_name}, {business} here. We never got to finish the conversation about your {project}. If it's still on your mind, happy to pick it up. If not, just say the word and we won't bother you again.",
      nl: "Hoi {first_name}, {business} hier. We hebben het gesprek over je {project} destijds nooit echt afgemaakt. Als het nog speelt, pakken we het graag weer op. Zo niet, zeg het gerust, dan hoor je niets meer van ons.",
    },
  },
  {
    id: "E",
    title: { en: "Keep-or-close the file", nl: "Dossier openhouden of sluiten" },
    body: {
      en: "Hi {first_name}, {business} here. Your {project} quote is still open on our end. Want us to keep it active, or did the project go another way?",
      nl: "Hoi {first_name}, {business} hier. Je offerte voor {project} staat bij ons nog open. Zullen we hem actief houden, of is het project een andere kant op gegaan?",
    },
  },
  {
    id: "F",
    title: { en: "No pretext", nl: "Zonder omhaal" },
    body: {
      en: "Hi {first_name}, {business} here. Checking in on your {project}: still happening, or shelved for now?",
      nl: "Hoi {first_name}, {business} hier. Even kort checken over je {project}: gaat het nog door, of staat het voorlopig in de ijskast?",
    },
  },
  {
    id: "G",
    title: { en: "Quote refresh", nl: "Offerte vernieuwen" },
    body: {
      en: "Hi {first_name}, {business} here. The quote for your {project} is outdated by now, but if the plans are still alive we're happy to update it. Worth doing?",
      nl: "Hoi {first_name}, {business} hier. De offerte voor je {project} is inmiddels verouderd, maar als de plannen nog leven, werken we hem graag even bij. Zullen we dat doen?",
    },
  },
  {
    id: "H",
    title: { en: "Outcome curiosity", nl: "Nieuwsgierig naar de uitkomst" },
    body: {
      en: "Hi {first_name}, {business} here. Quick question: did your {project} ever get finished? Genuinely curious how it turned out, even if it wasn't with us.",
      nl: "Hoi {first_name}, {business} hier. Korte vraag: is je {project} er uiteindelijk nog van gekomen? We zijn oprecht benieuwd hoe het is afgelopen, ook als het niet via ons was.",
    },
  },
  {
    id: "I",
    title: { en: "What changed", nl: "Wat is er veranderd" },
    body: {
      en: "Hi {first_name}, {business} here. When we last spoke, the timing wasn't right for your {project}. Has anything changed since?",
      nl: "Hoi {first_name}, {business} hier. Toen we elkaar voor het laatst spraken, kwam de timing voor je {project} niet goed uit. Is er inmiddels iets veranderd?",
    },
  },
];
