// How the Settings editors are laid out: three side by side only when all three fit at their minimum
// width, otherwise every card full width, one under the other (never two plus one).

export const EDITOR_MIN_WIDTH = 680;
export const EDITOR_GAP = 16;
export const EDITOR_HEIGHT_ACROSS = 780;
export const EDITOR_HEIGHT_STACKED = 520;

export interface SettingsLayout { columns: 1 | 3; editorMinHeight: number }

export function settingsLayout(width: number, cards: number): SettingsLayout {
  const fitsAll = cards === 3 && width >= 3 * EDITOR_MIN_WIDTH + 2 * EDITOR_GAP;
  return fitsAll ? { columns: 3, editorMinHeight: EDITOR_HEIGHT_ACROSS } : { columns: 1, editorMinHeight: EDITOR_HEIGHT_STACKED };
}
