// Touch-target sizes for the Demos page: 44px below 768px, desktop untouched (R5).
// One home, so the table cells, the topbar and the panels cannot drift apart.

/** A 36px round `IconBtn` grows to 44px on a phone. */
export const TOUCH = "max-md:h-11 max-md:w-11";

/**
 * The same for a `.la-btn--icon` (the topbar's `TopbarIconButton`): its 32px comes
 * from an unlayered rule, which only an important utility beats.
 */
export const TOUCH_TOPBAR = "max-md:!h-11 max-md:!w-11";

/** A row, menu item or text button that needs the 44px height but keeps its natural width. */
export const TOUCH_ROW = "max-md:min-h-11";
