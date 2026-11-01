// Voice tab settings shared by the server (storage, PUT validation, setting change cards) and the client.

/** What the receptionist does with a call outside opening hours. */
export const AFTER_HOURS = ["message", "callback", "ringHot"] as const;

/**
 * The only settings a change card can apply on Accept (and Undo). Every other Voice tab setting (hours,
 * transfer number, voice, live switch, follow-up, number) is a note card: the card tells Gabriel what to
 * change by hand.
 */
export const SETTING_CARD_KEYS = ["greeting", "intake", "pronunciation", "afterHours", "screening"] as const;
export type SettingCardKey = (typeof SETTING_CARD_KEYS)[number];

export const isSettingCardKey = (k: unknown): k is SettingCardKey =>
  typeof k === "string" && (SETTING_CARD_KEYS as readonly string[]).includes(k);

/** The values of those settings, as a card stores them (and as the Voice tab saves them). */
export interface SettingValues {
  greeting: string;
  /** One item per line, normalised (shared/voiceIntake.ts). */
  intake: string;
  pronunciation: { word: string; sayAs: string }[];
  afterHours: (typeof AFTER_HOURS)[number] | null;
  screening: { sales: boolean; robocalls: boolean; abuse: boolean };
}
