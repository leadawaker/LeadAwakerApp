import { ChartColumn, List, Users, type LucideIcon } from "lucide-react";
import type { CallsTab } from "../callers";

/** Icon per Calls page tab: [chart] Stats · [users] People · [list] All calls. */
export const CALLS_TAB_ICON: Record<CallsTab, LucideIcon> = { stats: ChartColumn, people: Users, calls: List };
