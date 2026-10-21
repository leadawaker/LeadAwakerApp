import {
  AudioLines, BookUser, Building2, CalendarDays, Clapperboard, ClipboardList, Home, Megaphone, MessageSquare, Receipt, type LucideIcon,
} from "lucide-react";
import type { AgencyBarKey, ClientNavKey } from "./navGates";

/** One icon per nav page, shared by the nav bar, the bottom bar and the More page. */
export const NAV_ICON: Record<ClientNavKey | AgencyBarKey, LucideIcon> = {
  home: Home,
  calls: AudioLines,
  chats: MessageSquare,
  leads: BookUser,
  calendar: CalendarDays,
  social: Clapperboard,
  myReceptionist: Building2,
  billing: Receipt,
  campaigns: Megaphone,
  tasks: ClipboardList,
};
