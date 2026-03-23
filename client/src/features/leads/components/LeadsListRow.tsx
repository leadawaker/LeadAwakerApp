/**
 * LeadsListRow.tsx — list-view row renderer.
 *
 * In this codebase the card and list row are the same component (LeadCard).
 * This module re-exports it under the "row" name for clarity when used in
 * flat-list contexts (no swipe tray, no mobile footer).
 */
export { LeadCard as LeadsListRow, type LeadCardProps as LeadsListRowProps } from "./LeadCard";
