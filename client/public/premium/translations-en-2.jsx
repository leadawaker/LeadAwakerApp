// English translations — conversations UI and demo messages
// Kept in a second file to avoid bloating translations-en.jsx

window.TRANSLATIONS = window.TRANSLATIONS || {};
window.TRANSLATIONS.en = window.TRANSLATIONS.en || {};

window.TRANSLATIONS.en.convUI = {
  niche_kitchen:    "Kitchen",
  niche_flooring:   "Flooring",
  niche_wellness:   "Wellness",
  niche_landscaping: "Garden",
  niche_roofing:    "Roofing",

  // Solar page (leadawaker.com) — tabs are service angles, not niches.
  // niche_netmetering is deliberately absent: that tab's label is market-
  // specific and comes from the case itself (see DEADLINE_CASES in config.jsx).
  niche_quotes:    "Quotes",
  niche_dbr:       "Old leads",
  niche_referrals: "Referrals",

  enquired_ago:        "inquired",
  installed_ago:       "installed",
  months_ago:          "mo. ago",
  chat_enquired_note:  "inquired 6 months ago",

  // Inquired, no quote yet
  demo_inquired_1: "honestly I'd kind of put it on the back burner",
  demo_inquired_2: "Happens all the time. What's the one thing still holding the project back?",
  demo_inquired_3: "honestly we just never found the time to compare options properly",

  // Got a quote, still deciding
  demo_deciding_1: "got a cheaper quote",
  demo_deciding_2: "Worth checking what's behind the number. The cheapest quote usually leaves something out.",
  demo_deciding_3: "yeah, I can already see some corners cut",
};

// Solar page overrides (leadawaker.com). Only the strings that would read
// wrong for a solar installer are listed; everything else falls through to
// the shared copy above. See the lookup order in config.jsx's I18nProvider.
window.TRANSLATIONS.en.variants = {
  solar: {
    hero: {
      badge: "Solar & renewables",
    },
    cta: {
      brand_desc: "A revival service for solar and renewables installers.",
    },
    demo: {
      h2: "Try our Solar AI",
      chat_lead_label: "Solar enquiry",
    },
  },
};
