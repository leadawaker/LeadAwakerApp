/**
 * One emoji per persona category, for the section titles of the persona list.
 * Categories are free text (the generator invents them, and a person can type
 * any name), so this reads the NAME: a few keywords per emoji, English first
 * with the Dutch and Portuguese words the library also uses. The first rule
 * that matches wins, so the order below is part of the behaviour. Pure.
 */
export const UNCATEGORIZED_EMOJI = "📁";
export const FALLBACK_EMOJI = "✨";
/** Date sections (grouping by date) all share one. */
export const DATE_EMOJI = "📅";

interface Rule {
  emoji: string;
  /** Match at the start of a word: "financ" reads Finance, Financial, Financiën. */
  stems?: string[];
  /** Match a whole word only: "car" must not read Care, Career or Carpentry. */
  words?: string[];
}

const RULES: Rule[] = [
  { emoji: "🦷", stems: ["dental", "dentist", "tandarts", "orthodon", "odonto"] },
  // Before health: "hospitality" must not read as "hospital".
  { emoji: "🍽️", stems: ["hospitality", "hospitalidade", "restaurant", "cafe", "hotel", "horeca", "catering", "bistro", "bakery", "bakker", "gastronomia"] },
  { emoji: "🩺", stems: ["health", "clinic", "medic", "doctor", "physio", "therap", "saude", "zorg", "gezond", "huisarts"], words: ["hospital", "hospitals", "ziekenhuis"] },
  { emoji: "💇", stems: ["beauty", "hair", "salon", "barber", "nail", "cosmetic", "beleza", "schoonheid", "kapper", "cabelo"] },
  { emoji: "🏠", stems: ["real estate", "realty", "propert", "imobil", "makelaar", "vastgoed", "estate"] },
  { emoji: "🏋️", stems: ["fitness", "gym", "crossfit", "sportschool", "personal train"] },
  { emoji: "⚖️", stems: ["legal", "law", "attorney", "advoca", "jurid", "notar"] },
  { emoji: "💰", stems: ["financ", "insurance", "verzeker", "seguro", "bank", "invest", "accounting", "accountant", "boekhoud", "contab", "mortgage", "hypotheek"] },
  { emoji: "💼", stems: ["business", "consult", "professional", "agency", "agentschap", "marketing", "zakelijk", "empresa"] },
  { emoji: "🎯", stems: ["coach"] },
  { emoji: "🎓", stems: ["educa", "school", "onderwijs", "learning", "tutor", "course", "universit"] },
  { emoji: "🛍️", stems: ["retail", "shop", "store", "winkel", "varejo", "loja", "ecommerce", "e-commerce", "fashion"] },
  { emoji: "🚗", stems: ["auto", "vehicle", "dealership", "motor", "garage", "veicul"], words: ["car", "cars", "carro", "carros"] },
  { emoji: "🛋️", stems: ["kitchen", "interior", "furniture", "decor", "marcenaria", "movei", "meubel", "bathroom", "flooring"] },
  { emoji: "🛠️", stems: ["trade", "home", "handyman", "construction", "contractor", "plumb", "electric", "roof", "repair", "renovation", "bouw", "aannemer", "reforma"] },
  { emoji: "⚡", stems: ["climate", "energy", "energie", "energia", "solar", "hvac", "heating", "airco", "sustainab", "duurzaam"] },
  { emoji: "🚴", stems: ["cicl", "cycl", "bike", "bicycle", "fiets", "bicicleta", "mobil"] },
  { emoji: "🧘", stems: ["wellness", "leisure", "spa", "massage", "yoga", "relax", "amusement", "recreation", "lazer", "bem-estar"] },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const START = "(?:^|[^a-z0-9])";

const MATCHERS = RULES.map((r) => {
  const parts = [
    ...(r.stems ?? []).map((s) => `${START}${escape(s)}`),
    ...(r.words ?? []).map((w) => `${START}${escape(w)}(?:$|[^a-z0-9])`),
  ];
  return { emoji: r.emoji, re: new RegExp(parts.join("|")) };
});

/** Lower case, accents off, padding trimmed: "  Saúde " reads as "saude". */
function normalise(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** The emoji for a category name: the folder when there is none, the sparkle when nothing fits. */
export function categoryEmoji(category: string | null | undefined): string {
  const name = normalise(category ?? "");
  if (!name) return UNCATEGORIZED_EMOJI;
  return MATCHERS.find((m) => m.re.test(name))?.emoji ?? FALLBACK_EMOJI;
}
