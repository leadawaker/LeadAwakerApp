import { z } from "zod";
import { AFTER_HOURS, type SettingCardKey } from "@shared/voiceSettings";

// The rules for the Voice tab settings a change card can apply. The PUT /voice-line body and the setting
// cards validate with these same schemas, so a card can never hold a value the tab itself would refuse.
// Zod only, no db: the pure review modules import this file.

export const greetingField = z.string().max(500);
/** Trimmed and cut to 6 lines of 120 characters on save (storage/voiceLines.ts). */
export const intakeField = z.string().max(5000);
export const pronunciationField = z.array(z.object({
  word: z.string().max(80),
  sayAs: z.string().max(120),
})).max(50);
export const afterHoursField = z.enum(AFTER_HOURS).nullable();
/** The Voice tab sends one switch at a time. */
export const screeningPatchField = z.object({
  sales: z.boolean().optional(),
  robocalls: z.boolean().optional(),
  abuse: z.boolean().optional(),
}).strict();

/** A card replaces the whole value, so screening needs all three switches. */
export const settingCardSchemas: Record<SettingCardKey, z.ZodTypeAny> = {
  greeting: greetingField,
  intake: intakeField,
  pronunciation: pronunciationField,
  afterHours: afterHoursField,
  screening: z.object({ sales: z.boolean(), robocalls: z.boolean(), abuse: z.boolean() }).strict(),
};
