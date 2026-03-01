/**
 * Mutable per-page accent color map — live-mutated by the Color Tester widget.
 * Values are bare HSL channel strings (no "hsl()" wrapper) matching how Tailwind
 * consumes CSS custom properties: `hsl(var(--highlight-active))`.
 *
 * CrmShell reads this map and applies the current page's active/selected values
 * as inline CSS custom property overrides on the shell div.
 */
export const PAGE_ACCENTS: Record<string, { active: string; selected: string }> = {
  campaigns:          { active: "50 100% 78%",  selected: "45 100% 93%"  }, // warm yellow   (unchanged)
  contacts:           { active: "80 100% 80%",  selected: "80 100% 95%"  }, // #DDFF98 / #F6FFE4
  conversations:      { active: "146 100% 81%", selected: "148 100% 91%" }, // #9FFFC9 / #D0FFE6
  calendar:           { active: "169 100% 86%", selected: "166 100% 94%" }, // #B8FFF2 / #E0FFF8
  accounts:           { active: "192 100% 82%", selected: "190 100% 94%" }, // #A3EDFF / #E0FAFF
  invoices:           { active: "214 100% 83%", selected: "215 100% 92%" }, // #A8CEFF / #D6E7FF
  expenses:           { active: "214 100% 83%", selected: "215 100% 92%" }, // #A8CEFF / #D6E7FF
  contracts:          { active: "214 100% 83%", selected: "215 100% 92%" }, // #A8CEFF / #D6E7FF
  users:              { active: "230 78% 84%",  selected: "230 78% 93%"  }, // indigo         (unchanged)
  "prompt-library":   { active: "257 100% 85%", selected: "259 100% 94%" }, // #C9B3FF / #EAE0FF
  "automation-logs":  { active: "286 100% 83%", selected: "294 100% 96%" }, // #EAA8FF / #FDEAFF
};
