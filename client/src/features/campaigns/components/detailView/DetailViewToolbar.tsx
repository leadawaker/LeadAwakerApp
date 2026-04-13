import {
  ChevronLeft,
  Maximize2,
  Minimize2,
  RefreshCw,
  FileText,
  MoreVertical,
  Palette,
  Copy,
  Trash2,
  PauseCircle,
  PlayCircle,
  Link as LinkIcon,
} from "lucide-react";
import type { Campaign } from "@/types/models";
import { cn } from "@/lib/utils";
import { useCampaignDetail } from "../useCampaignDetail";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  leftPanelCollapsed?: boolean;
  onToggleLeftPanel?: () => void;
  promptPanelOpen?: boolean;
  onTogglePromptPanel?: () => void;
  t: any;
  // Legacy props still passed by parent (list controls moved to left panel)
  [key: string]: any;
}

export function DetailViewToolbar({
  detail,
  campaign,
  activeTab,
  isActive,
  isAgencyUser,
  gradientTesterOpen,
  onToggleGradientTester,
  onBack,
  onToggleStatus,
  onRefresh,
  onDuplicate,
  onDelete,
  leftPanelCollapsed,
  onToggleLeftPanel,
  promptPanelOpen,
  onTogglePromptPanel,
  t,
}: DetailViewToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {onBack && (
        <button onClick={onBack} className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <>
          {onToggleLeftPanel && (
            <button
              onClick={onToggleLeftPanel}
              className="hidden md:grid h-9 w-9 rounded-full border border-black/[0.125] place-items-center shrink-0 text-foreground/60 hover:text-foreground transition-colors"
              title={leftPanelCollapsed ? "Show list" : "Hide list"}
            >
              {leftPanelCollapsed ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
          )}

          {onTogglePromptPanel && (
            <button
              onClick={onTogglePromptPanel}
              className={cn("h-9 w-9 rounded-full border grid place-items-center shrink-0 transition-colors", promptPanelOpen ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/60 hover:text-foreground")}
              title="Prompt Editor"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}

          {activeTab === "configurations" && detail.saving && (
            <span className="inline-flex items-center gap-1.5 h-9 px-3 text-[12px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              {t("toolbar.saving")}
            </span>
          )}

          {/* ··· More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 rounded-full border border-black/[0.125] grid place-items-center shrink-0 text-foreground/60 hover:text-foreground transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isAgencyUser && (
                <DropdownMenuItem onClick={onToggleGradientTester} className="flex items-center gap-2 text-[12px]">
                  <Palette className={cn("h-3.5 w-3.5 shrink-0", gradientTesterOpen && "text-indigo-600")} />
                  {gradientTesterOpen ? t("toolbar.hideGradient", "Hide Gradient") : t("toolbar.gradient", "Gradient")}
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(campaign)} className="flex items-center gap-2 text-[12px]">
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  {t("toolbar.duplicate", "Duplicate")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  const cid = campaign.id || campaign.Id;
                  const link = `https://t.me/Demo_Lead_Awaker_bot?start=campaign_${cid}`;
                  navigator.clipboard.writeText(link);
                }}
                className="flex items-center gap-2 text-[12px]"
              >
                <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                {t("toolbar.copyDemoLink", "Copy Demo Link")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onRefresh && (
                <DropdownMenuItem onClick={onRefresh} className="flex items-center gap-2 text-[12px]">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  {t("toolbar.refresh", "Refresh")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onToggleStatus(campaign)} className="flex items-center gap-2 text-[12px]">
                {isActive
                  ? <><PauseCircle className="h-3.5 w-3.5 shrink-0" />{t("toolbar.pause", "Pause")}</>
                  : <><PlayCircle className="h-3.5 w-3.5 shrink-0" />{t("toolbar.activate", "Activate")}</>
                }
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(campaign.id || campaign.Id)}
                    className="flex items-center gap-2 text-[12px] text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    {t("toolbar.delete", "Delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
    </div>
  );
}
