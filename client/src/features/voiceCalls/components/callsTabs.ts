import { List, Users, type LucideIcon } from "lucide-react";
import type { CallsTab } from "../callers";

/** Icon per Calls page tab: [users] People · [list] All calls. */
export const CALLS_TAB_ICON: Record<CallsTab, LucideIcon> = { people: Users, calls: List };

/**
 * What the Calls page shows: a tab, or Settings (the phone receptionist's
 * settings for one account, ?view=settings). Settings is remembered as the
 * last tab too, so leaving the page from Settings comes back to Settings.
 */
export type CallsPageView = CallsTab | "settings";
