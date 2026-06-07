/**
 * Shared toolbar-button class strings — extracted from the per-page copies in
 * LeadsTable / Tasks / Prospects / Campaigns so the toolbar look lives in one
 * place. Import these instead of re-declaring `xBase`/`xSpan`/etc per page.
 *
 * Note: the active state now reads `primary` (was `brand-indigo`) so it follows
 * the global accent token.
 */

/** Static pill button (always shows its label). */
export const tbBase =
  "h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";
export const tbDefault =
  "border border-black/[0.125] text-foreground/60 hover:text-foreground hover:bg-card";
export const tbActive = "border border-primary text-primary";

/** Expand-on-hover icon-circle button: collapsed to an icon, grows on hover. */
export const xBase =
  "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
export const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
export const xActive = "border-primary text-primary";
/** The hidden label inside an expand-on-hover button (revealed on hover). */
export const xSpan =
  "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";
/** Pin a button permanently expanded (active filter showing its value). */
export const xExpanded = "max-w-[220px]";
/** Make the label permanently visible (used with xExpanded). */
export const xSpanVisible = "opacity-100";
