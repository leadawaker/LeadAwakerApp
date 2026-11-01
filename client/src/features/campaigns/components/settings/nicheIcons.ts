import type { ElementType } from "react";
import {
  UtensilsCrossed, Bath, Layers, Grid3x3, Hammer, Sun, Wind,
  Home, TreePine, DoorOpen, Paintbrush, Bug, Waves, Truck,
  Heart, Sofa, Building2,
} from "lucide-react";

// The curated niche packs' icons (Niche_Vocabulary rows). Anything else, and the
// __default__ fallback row, gets the plain building.
const NICHE_ICONS: Record<string, ElementType> = {
  "Kitchens": UtensilsCrossed,
  "Bathrooms": Bath,
  "Countertops": Layers,
  "Flooring": Grid3x3,
  "General Contracting": Hammer,
  "Solar Panels": Sun,
  "HVAC": Wind,
  "Roofing": Home,
  "Landscaping": TreePine,
  "Windows & Doors": DoorOpen,
  "Painting": Paintbrush,
  "Pest Control": Bug,
  "Pool Installation": Waves,
  "Moving Services": Truck,
  "Wellness": Heart,
  "Interior Design": Sofa,
};

export function resolveNicheIcon(niche: string, isDefault: boolean): ElementType {
  if (isDefault) return Building2;
  return NICHE_ICONS[niche] ?? Building2;
}
