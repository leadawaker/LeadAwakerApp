# Action Required — confirmations before building

Quick confirms so Phase 1 can start. Defaults in **bold** if you don't object.

1. **Free-text display language.** Description / KB / Niche question / AI role will display
   and edit the **campaign-language** variant (both stored, switches with the campaign
   language). They will **not** auto-translate to your UI language just for viewing.
   → **Default: yes, campaign-language.** (Dropdowns still read in your UI language.)

2. **Dropdown option lists are currently kitchen/furniture-specific** (e.g. "Made in
   Germany", "kitchen ready in 6 weeks"). `EditCombo` already lets you type your own, so the
   lists are just suggestions. → **Default: keep them as suggestions, add aligned Dutch
   translations.** (Say if you'd rather they become free-text with no fixed suggestions.)

3. **Engine changes are in scope.** Phase 1 edits the Python engine at
   `/home/gabriel/automations/` so prompts read the right-language value. This is required
   for correctness. → **Default: yes.**

4. **Generate endpoint.** I'll evolve `generate-demo` into one `generate` action (fill empty
   + translate). The old route stays working during transition. → **Default: yes.**

5. **Ordering.** Phase 1 (engine tolerant read) ships and is verified **before** the
   frontend writes JSON, so a Dutch campaign never gets raw JSON in a prompt. → **Default: yes.**

Reply with any "no"s; otherwise I'll start at Phase 1.
