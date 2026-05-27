/**
 * Per-page accent color map.
 *
 * Values are bare HSL channel strings (no "hsl()" wrapper) matching how Tailwind
 * consumes CSS custom properties: `hsl(var(--highlight-active))`.
 *
 * CrmShell reads this map and applies the current page's active/selected values
 * as inline CSS custom property overrides on the shell div.
 */

const AMBER_ACTIVE_LIGHT = "53 100% 78%";
const AMBER_SELECTED_LIGHT = "51 100% 93%";
const AMBER_ACTIVE_DARK = "40 50% 24%";
const AMBER_SELECTED_DARK = "40 55% 30%";

const LIGHT = { active: AMBER_ACTIVE_LIGHT, selected: AMBER_SELECTED_LIGHT };
const DARK = { active: AMBER_ACTIVE_DARK, selected: AMBER_SELECTED_DARK };

/* ── Light-mode accents ──────────────────────────────────────────────────── */
export const PAGE_ACCENTS: Record<string, { active: string; selected: string }> = {
  campaigns:          LIGHT,
  contacts:           LIGHT,
  conversations:      LIGHT,
  calendar:           LIGHT,
  accounts:           LIGHT,
  prospects:          LIGHT,
  invoices:           LIGHT,
  expenses:           LIGHT,
  contracts:          LIGHT,
  users:              LIGHT,
  "prompt-library":   LIGHT,
  tasks:              LIGHT,
  "automation-logs":  LIGHT,
};

/* ── Dark-mode accents ──────────────────────────────────────────────────── */
export const PAGE_ACCENTS_DARK: Record<string, { active: string; selected: string }> = {
  campaigns:          DARK,
  contacts:           DARK,
  conversations:      DARK,
  calendar:           DARK,
  accounts:           DARK,
  prospects:          DARK,
  invoices:           DARK,
  expenses:           DARK,
  contracts:          DARK,
  users:              DARK,
  "prompt-library":   DARK,
  tasks:              DARK,
  "automation-logs":  DARK,
};
