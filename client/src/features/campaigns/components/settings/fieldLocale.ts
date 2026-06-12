/**
 * Campaign-language authoring helpers.
 *
 * The campaign `language` field decides what language the AI speaks. To get
 * natural output (not "translated English"), the operator should author the
 * free-text context fields in that language, and the enum context fields should
 * store their value in that language too. These maps drive placeholders + option
 * sets off the *campaign* language — independent of the UI locale (which only
 * controls the chrome around the form).
 *
 * Scope is intentionally "context fields only": niche_question, business
 * description, KB, AI role, USP, AI style. First_Message and what_lead_did stay
 * English-canonical because the engine translates the opener downstream.
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

/**
 * Enum context options. The stored value differs per language because the value
 * itself is injected into the prompt, so it must already be in the target
 * language. Leading "" is the unset option.
 */
export const USP_OPTIONS: Record<CampaignLang, string[]> = {
  en: ["", "Naturally sourced materials", "Smart technology integration", "Fast delivery: kitchen ready in 6 weeks", "Made in Germany", "Made in Italy", "Dedicated designer: start to finish", "Extended warranty: 10 years"],
  nl: ["", "Natuurlijke materialen", "Slimme technologie-integratie", "Snelle levering: keuken klaar in 6 weken", "Made in Germany", "Made in Italy", "Eigen ontwerper: van begin tot eind", "Verlengde garantie: 10 jaar"],
  pt: ["", "Materiais de origem natural", "Integração de tecnologia inteligente", "Entrega rápida: cozinha pronta em 6 semanas", "Fabricado na Alemanha", "Fabricado na Itália", "Designer dedicado: do início ao fim", "Garantia estendida: 10 anos"],
};

export const AI_STYLE_OPTIONS: Record<CampaignLang, string[]> = {
  en: ["", "Professional & consultative", "Warm & educational", "Direct & results-focused", "Friendly & reassuring", "Premium & exclusive"],
  nl: ["", "Professioneel & adviserend", "Warm & informatief", "Direct & resultaatgericht", "Vriendelijk & geruststellend", "Premium & exclusief"],
  pt: ["", "Profissional e consultivo", "Acolhedor e educativo", "Direto e focado em resultados", "Amigável e tranquilizador", "Premium e exclusivo"],
};
