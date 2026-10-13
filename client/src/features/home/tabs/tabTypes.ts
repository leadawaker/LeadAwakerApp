import type { HomeServices, HomeTab } from "@shared/homeTypes";
import type { HomeScope } from "../api/homeApi";

export interface HomeTabProps {
  scope: HomeScope;
  services: HomeServices;
  onOpenTab: (t: HomeTab) => void;
}
