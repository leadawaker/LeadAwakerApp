import React from "react";
import { ChevronLeft, RefreshCw } from "lucide-react";
import type { Campaign } from "@/types/models";
import { useCampaignDetail } from "../useCampaignDetail";

interface DetailViewToolbarProps {
  detail: ReturnType<typeof useCampaignDetail>;
  campaign: Campaign;
  activeTab: "summary" | "configurations";
  isEditing: boolean;
  canToggle: boolean;
  isActive: boolean;
  isAgencyUser: boolean;
  gradientTesterOpen: boolean;
  onToggleGradientTester: () => void;
  onBack?: () => void;
  onToggleStatus: (campaign: Campaign) => void;
  onRefresh?: () => void;
  onDuplicate?: (campaign: Campaign) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  t: any;
  [key: string]: any;
}

export function DetailViewToolbar({
  detail,
  onBack,
  t,
}: DetailViewToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {onBack && (
        <button onClick={onBack} className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-1">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {detail.saving && (
        <span className="inline-flex items-center gap-1.5 h-9 px-2 text-[12px] text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          {t("toolbar.saving")}
        </span>
      )}
    </div>
  );
}
