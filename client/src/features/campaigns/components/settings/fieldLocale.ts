/**
 * Campaign-language authoring helpers.
 *
 * Context fields store {en, nl} JSON so each language version is always
 * available. The operator reads the form in their UI language; the engine
 * receives the campaign-language value. Dropdown option lists are index-aligned
 * across languages so a pick in one language maps 1:1 to the other.
 *
 * Adding more options: append to both `en` AND `nl` arrays in the same index
 * position — no component changes required.
 */

export type CampaignLang = "en" | "nl" | "pt";

export function asCampaignLang(v: unknown): CampaignLang {
  return v === "nl" || v === "pt" ? v : "en";
}

/** Placeholder hints for free-text context fields, per campaign language. */
export const FIELD_PLACEHOLDERS: Record<string, Record<CampaignLang, string>> = {
  niche_question: {
    en: "e.g. Are you still looking for…?",
    nl: "bijv. Ben je nog op zoek naar…?",
    pt: "ex.: Você ainda está procurando…?",
  },
  business_description: {
    en: "Business description…",
    nl: "Bedrijfsomschrijving…",
    pt: "Descrição da empresa…",
  },
  kb: {
    en: "Key facts, stats, achievements the AI should know about this business…",
    nl: "Belangrijke feiten, cijfers en prestaties die de AI over dit bedrijf moet weten…",
    pt: "Fatos, números e conquistas importantes que a IA deve saber sobre esta empresa…",
  },
  ai_role: {
    en: "e.g. Sales representative…",
    nl: "bijv. Verkoopmedewerker…",
    pt: "ex.: Representante de vendas…",
  },
};

export function placeholderFor(field: string, lang: CampaignLang): string {
  return FIELD_PLACEHOLDERS[field]?.[lang] ?? FIELD_PLACEHOLDERS[field]?.en ?? "";
}

// ---------------------------------------------------------------------------
// Dropdown option maps (index-aligned: en[i] === nl[i] in meaning)
// Leading "" is the unset option in every list.
// ---------------------------------------------------------------------------

export const USP_OPTIONS: Record<CampaignLang, string[]> = {
  en: ["", "Naturally sourced materials", "Smart technology integration", "Fast delivery: kitchen ready in 6 weeks", "Made in Germany", "Made in Italy", "Dedicated designer: start to finish", "Extended warranty: 10 years"],
  nl: ["", "Natuurlijke materialen", "Slimme technologie-integratie", "Snelle levering: keuken klaar in 6 weken", "Made in Germany", "Made in Italy", "Eigen ontwerper: van begin tot eind", "Verlengde garantie: 10 jaar"],
  pt: ["", "Materiais de origem natural", "Integração de tecnologia inteligente", "Entrega rápida: cozinha pronta em 6 semanas", "Fabricado na Alemanha", "Fabricado na Itália", "Designer dedicado: do início ao fim", "Garantia estendida: 10 anos"],
};

// Mirrors the 3 onboarding communication styles (kept deliberately simple — richer
// tone/style nuance lives in the knowledge base, not in a structured field).
export const AI_STYLE_OPTIONS: Record<CampaignLang, string[]> = {
  en: ["", "Personal", "Practical", "Businesslike"],
  nl: ["", "Persoonlijk", "Praktisch", "Zakelijk"],
  pt: ["", "Pessoal", "Prático", "Profissional"],
};

export const WHAT_LEAD_DID_OPTIONS: Record<CampaignLang, string[]> = {
  en: ["", "Inquired about a quote", "Received a quote", "Had a site visit / assessment", "In the decision phase", "Declined / went with another provider"],
  nl: ["", "Heeft een offerte aangevraagd", "Heeft een offerte ontvangen", "Heeft een bezoek / keuring gehad", "In de beslissingsfase", "Afgewezen / naar een andere aanbieder"],
  pt: ["", "Pediu um orçamento", "Recebeu um orçamento", "Teve uma visita / avaliação", "Na fase de decisão", "Recusou / foi para outro fornecedor"],
};

export const SERVICE_OPTIONS: Record<CampaignLang, string[]> = {
  en: ["", "Design and manufacturing including installation", "Design and manufacturing not including installation", "Supply and installation", "Design consultancy only"],
  nl: ["", "Ontwerp en productie inclusief installatie", "Ontwerp en productie exclusief installatie", "Levering en installatie", "Alleen ontwerpadvies"],
  pt: ["", "Design e fabricação incluindo instalação", "Design e fabricação sem instalação", "Fornecimento e instalação", "Apenas consultoria de design"],
};

export const FIRST_TOUCH_OPTIONS: Record<CampaignLang, string[]> = {
  en: ["", "Showroom visit", "Phone call", "Website", "Social media"],
  nl: ["", "Showroombezoek", "Telefoongesprek", "Website", "Social media"],
  pt: ["", "Visita ao showroom", "Ligação telefônica", "Website", "Redes sociais"],
};

// Map dropdown field names to their option tables
const OPTION_TABLES: Record<string, Record<CampaignLang, string[]>> = {
  campaign_usp: USP_OPTIONS,
  ai_style_override: AI_STYLE_OPTIONS,
  what_lead_did: WHAT_LEAD_DID_OPTIONS,
  service_name: SERVICE_OPTIONS,
  first_touch: FIRST_TOUCH_OPTIONS,
};

/**
 * Find the index of a stored value (any language) in the option table.
 * Returns -1 if not found (custom value typed by operator).
 */
export function optionIndex(field: string, value: string): number {
  const table = OPTION_TABLES[field];
  if (!table || !value) return -1;
  for (const lang of Object.keys(table) as CampaignLang[]) {
    const idx = table[lang].indexOf(value);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Resolve a stored field value (plain string OR JSON {en,nl}) to its
 * display label in `lang`. For JSON values, picks the matching language key.
 * For plain strings, matches against option tables to translate, or returns as-is.
 */
export function optionLabel(field: string, rawValue: unknown, lang: CampaignLang): string {
  if (!rawValue && rawValue !== 0) return "";
  const str = String(rawValue);

  // Try to parse as JSON {en, nl}
  if (str.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === "object" && parsed !== null) {
        return (parsed as Record<string, string>)[lang] || (parsed as Record<string, string>).en || str;
      }
    } catch {
      // fall through
    }
  }

  // Plain string: try to find it in the option table and return the lang equivalent
  const table = OPTION_TABLES[field];
  if (table) {
    const idx = optionIndex(field, str);
    if (idx !== -1) return table[lang]?.[idx] ?? str;
  }

  return str;
}

/**
 * Build the JSON string to store when operator picks `label` (displayed in `displayLang`).
 * Looks up the index, stores both en + nl aligned values.
 * If the label is not in the table (custom typed), stores `{[displayLang]: label}`.
 */
export function optionStore(field: string, label: string, displayLang: CampaignLang): string {
  const table = OPTION_TABLES[field];
  if (!label) return JSON.stringify({ en: "", nl: "" });

  if (table) {
    const idx = table[displayLang]?.indexOf(label) ?? -1;
    if (idx !== -1) {
      return JSON.stringify({
        en: table.en[idx] ?? label,
        nl: table.nl[idx] ?? label,
      });
    }
  }

  // Custom value: store under display language only
  return JSON.stringify({ [displayLang]: label });
}
