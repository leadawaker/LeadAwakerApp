export interface NichePackBilingual {
  en: string;
  nl: string;
}

export interface NichePackFile {
  niche: string;
  question_bank: NichePackBilingual;
  bad_examples: NichePackBilingual;
  objection_examples: NichePackBilingual;
  scenario_examples: NichePackBilingual;
}

export const PACK_FIELD_NAMES = [
  "question_bank",
  "bad_examples",
  "objection_examples",
  "scenario_examples",
] as const;

export const REQUIRED_SCENARIO_MARKERS = [
  "## 6.1", "## 6.2", "## 6.3", "## 6.4", "## 6.5", "## 6.6", "## 6.7",
];

export const MIN_FIELD_LENGTH = 150;
