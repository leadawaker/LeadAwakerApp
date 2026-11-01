import type { SettingCardKey, SettingValues } from "@shared/voiceSettings";
import { normalizeIntake } from "@shared/voiceIntake";
import { settingCardSchemas } from "../voiceLineFields";

// The values a setting change card holds, and the checks around them (pure: no db).

/** The five settings a card can apply, read off a Voice tab line (nulls become "" and []). */
export function settingsOf(line: {
  greeting: string | null;
  intake: string | null;
  pronunciation: { word: string; sayAs: string }[] | null;
  afterHours: SettingValues["afterHours"];
  screening: SettingValues["screening"];
}): SettingValues {
  return {
    greeting: line.greeting ?? "",
    intake: normalizeIntake(line.intake),
    pronunciation: line.pronunciation ?? [],
    afterHours: line.afterHours,
    screening: line.screening,
  };
}

/**
 * A proposed value as text, to the value a card stores. Greeting and intake are plain text, the others JSON.
 * It must pass the same rules as the Voice tab (voiceLineFields.ts); intake is normalised as the tab saves it.
 */
export function parseSettingValue(key: SettingCardKey, raw: string): { ok: true; value: unknown } | { ok: false } {
  let candidate: unknown = raw;
  if (key !== "greeting" && key !== "intake") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return { ok: false };
    }
  }
  const parsed = settingCardSchemas[key].safeParse(candidate);
  if (!parsed.success) return { ok: false };
  return { ok: true, value: key === "intake" ? normalizeIntake(parsed.data) : parsed.data };
}

/** JSON with object keys in sorted order, so two objects with the same content compare equal. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0)))
    : x));

export function sameSetting(key: SettingCardKey, a: unknown, b: unknown): boolean {
  if (key === "intake") return normalizeIntake(a) === normalizeIntake(b);
  return canonical(a) === canonical(b);
}

/** A value as the card's replace text and the prompts show it: strings as is, everything else JSON. */
export const settingText = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value));
