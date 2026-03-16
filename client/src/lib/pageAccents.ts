/**
 * Mutable per-page accent color map — live-mutated by the Color Tester widget.
 * Values are bare HSL channel strings (no "hsl()" wrapper) matching how Tailwind
 * consumes CSS custom properties: `hsl(var(--highlight-active))`.
 *
 * CrmShell reads this map and applies the current page's active/selected values
 * as inline CSS custom property overrides on the shell div.
 *
 * Light mode: bright pastels (78-86% L active, 91-96% L selected)
 * Dark mode:  deep tints  (24-30% L active, 14-18% L selected)
 */

/* ── Light-mode accents ──────────────────────────────────────────────────── */
export const PAGE_ACCENTS: Record<string, { active: string; selected: string }> = {
  campaigns:          { active: "50 100% 78%",  selected: "45 100% 93%"  }, // warm yellow
  contacts:           { active: "80 100% 80%",  selected: "80 100% 95%"  }, // #DDFF98 / #F6FFE4
  conversations:      { active: "146 100% 81%", selected: "148 100% 91%" }, // #9FFFC9 / #D0FFE6
  calendar:           { active: "169 100% 86%", selected: "166 100% 94%" }, // #B8FFF2 / #E0FFF8
  accounts:           { active: "192 100% 82%", selected: "190 100% 94%" }, // #A3EDFF / #E0FAFF
  prospects:          { active: "280 80% 82%",  selected: "280 85% 93%"  }, // purple-pink
  invoices:           { active: "214 100% 83%", selected: "215 100% 92%" }, // #A8CEFF / #D6E7FF
  expenses:           { active: "214 100% 83%", selected: "215 100% 92%" }, // #A8CEFF / #D6E7FF
  contracts:          { active: "214 100% 83%", selected: "215 100% 92%" }, // #A8CEFF / #D6E7FF
  users:              { active: "230 78% 84%",  selected: "230 78% 93%"  }, // indigo
  "prompt-library":   { active: "257 100% 85%", selected: "259 100% 94%" }, // #C9B3FF / #EAE0FF
  tasks:              { active: "245 100% 83%", selected: "244 100% 94%" }, // #B0ABFF / #E1DFFF
  "automation-logs":  { active: "286 100% 83%", selected: "294 100% 96%" }, // #EAA8FF / #FDEAFF
};

/* ── Dark-mode accents — same hues, deep tinted backgrounds ──────────────
 * `active`   = sidebar pill / active tab
 * `selected` = highlighted card / row — 25% brighter than active (L × 1.25)
 */
export const PAGE_ACCENTS_DARK: Record<string, { active: string; selected: string }> = {
  campaigns:          { active: "50 50% 22%",   selected: "50 55% 28%"   }, // deep amber
  contacts:           { active: "80 40% 22%",   selected: "80 45% 28%"   }, // deep green-yellow
  conversations:      { active: "146 40% 22%",  selected: "146 45% 28%"  }, // deep mint
  calendar:           { active: "169 40% 22%",  selected: "169 45% 28%"  }, // deep teal
  accounts:           { active: "192 40% 22%",  selected: "192 45% 28%"  }, // deep cyan
  prospects:          { active: "280 40% 24%",   selected: "280 45% 30%"  }, // deep purple-pink
  invoices:           { active: "214 40% 24%",  selected: "214 45% 30%"  }, // deep blue
  expenses:           { active: "214 40% 24%",  selected: "214 45% 30%"  }, // deep blue
  contracts:          { active: "214 40% 24%",  selected: "214 45% 30%"  }, // deep blue
  users:              { active: "230 35% 24%",  selected: "230 40% 30%"  }, // deep indigo
  "prompt-library":   { active: "257 40% 24%",  selected: "257 45% 30%"  }, // deep violet
  tasks:              { active: "220 40% 24%",  selected: "220 45% 30%"  }, // deep blue
  "automation-logs":  { active: "286 40% 24%",  selected: "286 45% 30%"  }, // deep magenta
};
