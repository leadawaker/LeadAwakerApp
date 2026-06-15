import { Tag, Wrench, HelpCircle, ShieldAlert, Users, Clock, MapPin, ClipboardList, Quote, BookOpen, type LucideIcon } from "lucide-react";

export const KB_ICON: Record<string, LucideIcon> = {
  pricing: Tag,
  services: Wrench,
  faq: HelpCircle,
  objections: ShieldAlert,
  team: Users,
  hours: Clock,
  location: MapPin,
  policies: ClipboardList,
  testimonials: Quote,
};

export function kbIcon(category: string): LucideIcon {
  return KB_ICON[category] || BookOpen;
}
