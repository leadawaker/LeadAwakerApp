import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";
import type { AiDisclosure, DemoMarket } from "@shared/demoProspects";

// The AI disclosure and Market choices of the create and detail forms, kept apart from the
// components so the lists and the empty-setting mapping are tested on their own.

// A Select needs a non-empty item value, so the "" settings (campaign default, language default) travel as this.
export const DEFAULT_OPTION = "default";

export const DISCLOSURES: readonly Exclude<AiDisclosure, "">[] = ["off", "opener", "second_message"];
export const MARKETS: readonly { id: Exclude<DemoMarket, "">; label: string }[] = [
  { id: "uk", label: "UK (£)" },
  { id: "us", label: "US ($)" },
  { id: "nl", label: "NL (€)" },
];

/** The market picks the currency and the accent of the English demo; the other languages resolve their own. */
export function marketApplies(language: DemoLang): boolean {
  return language === "en";
}

/** A stored setting as a Select value ("" is the default). */
export const toOption = (value: string): string => value || DEFAULT_OPTION;

/** A Select value as the stored setting. */
export const fromOption = (option: string): string => (option === DEFAULT_OPTION ? "" : option);
