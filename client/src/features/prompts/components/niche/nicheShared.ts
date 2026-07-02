import type { ElementType } from "react";
import {
  UtensilsCrossed, Bath, Layers, Grid3x3, Hammer, Sun, Wind,
  Home, TreePine, DoorOpen, Paintbrush, Bug, Waves, Truck,
  Heart, Sofa, Building2,
} from "lucide-react";

// Mirrors shared/schema's NICHE_WORD_GROUPS. Defined locally so the client
// bundle does not pull the Drizzle schema module just for these constants.
export const NICHE_WORD_GROUPS = [
  "projectTerm", "proposalTerm", "decisionTerm", "advisorTerm", "visitTerm",
] as const;
export type NicheWordGroup = (typeof NICHE_WORD_GROUPS)[number];
export type NicheWordGroups = Record<NicheWordGroup, string[]>;
export type NicheLang = "nl" | "en";
export type NicheTemplate = { nl: string; en: string };
export const EMPTY_NICHE_GROUPS: NicheWordGroups = {
  projectTerm: [], proposalTerm: [], decisionTerm: [], advisorTerm: [], visitTerm: [],
};
export const EMPTY_TEMPLATE: NicheTemplate = { nl: "", en: "" };

export type NicheRow = {
  niche: string;
  nl: NicheWordGroups;
  en: NicheWordGroups;
  companyNameTemplate: NicheTemplate;
  descriptionTemplate: NicheTemplate;
  kbTemplate: NicheTemplate;
  questionBank: NicheTemplate;
  badExamples: NicheTemplate;
  objectionExamples: NicheTemplate;
  scenarioExamples: NicheTemplate;
};

export const PACK_FIELDS = ["questionBank", "badExamples", "objectionExamples", "scenarioExamples"] as const;
export type PackField = (typeof PACK_FIELDS)[number];
export type TemplateFieldName = "companyNameTemplate" | "descriptionTemplate" | "kbTemplate" | PackField;

export const DEFAULT_NICHE = "__default__";

const NICHE_ICONS: Record<string, ElementType> = {
  "Kitchens": UtensilsCrossed,
  "Bathrooms": Bath,
  "Countertops": Layers,
  "Flooring": Grid3x3,
  "General Contracting": Hammer,
  "Solar Panels": Sun,
  "HVAC": Wind,
  "Roofing": Home,
  "Landscaping": TreePine,
  "Windows & Doors": DoorOpen,
  "Painting": Paintbrush,
  "Pest Control": Bug,
  "Pool Installation": Waves,
  "Moving Services": Truck,
  "Wellness": Heart,
  "Interior Design": Sofa,
};

export function resolveNicheIcon(niche: string, isDefault: boolean): ElementType {
  if (isDefault) return Building2;
  return NICHE_ICONS[niche] ?? Building2;
}
