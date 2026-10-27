// Knowledge base constants shared by the Knowledge panel and the knowledge change cards.

// Category order for grouping / display. The panel shows only these.
export const KB_CATEGORIES = [
  "pricing",
  "services",
  "faq",
  "objections",
  "team",
  "hours",
  "location",
  "policies",
  "testimonials",
] as const;

/** The category a new entry gets when none is given. */
export const KB_DEFAULT_CATEGORY = "faq";

/** Title prefix of the generated stock entry: a card never edits it. */
export const KB_STOCK_PREFIX = "Current stock";
