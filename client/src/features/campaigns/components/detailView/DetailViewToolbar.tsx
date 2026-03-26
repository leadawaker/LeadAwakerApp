import {
  ChevronLeft,
  Pencil,
  PauseCircle,
  PlayCircle,
  Trash2,
  RefreshCw,
  X,
  Plus,
  ArrowUpDown,
  Filter,
  Layers,
  Check,
  Palette,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Campaign } from "@/types/models";
import { cn } from "@/lib/utils";
import type { CampaignSortBy, CampaignGroupBy } from "../pages/CampaignsPage";
import { SearchPill } from "@/components/ui/search-pill";
import { useCampaignDetail } from "../useCampaignDetail";
import {
  xBase,
  xDefault,
  xActive,
  xSpan,
  DETAIL_SORT_LABEL_KEYS,
  DETAIL_GROUP_LABEL_KEYS,
  DETAIL_STATUS_FILTER_OPTIONS,
  DETAIL_STATUS_HEX,
} from "./constants";
import { DuplicateButton } from "./atoms";

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
  onCreateCampaign?: () => void;
  listSearch?: string;
  onListSearchChange?: (v: string) => void;
  sortBy?: CampaignSortBy;
  onSortByChange?: (v: CampaignSortBy) => void;
  isSortNonDefault?: boolean;
  filterStatus?: string[];
  onToggleFilterStatus?: (s: string) => void;
  filterAccount?: string;
  onFilterAccountChange?: (a: string) => void;
  isFilterActive?: boolean;
  groupBy?: CampaignGroupBy;
  onGroupByChange?: (v: CampaignGroupBy) => void;
  isGroupNonDefault?: boolean;
  availableAccounts?: string[];
  onResetControls?: () => void;
  t: (key: string, fallback?: string) => string;
}

export function DetailViewToolbar({
  detail,
  campaign,
  activeTab,
  canToggle,
  isActive,
  isAgencyUser,
  gradientTesterOpen,
  onToggleGradientTester,
  onBack,
  onToggleStatus,
  onRefresh,
  onDuplicate,
  onDelete,
  onCreateCampaign,
  listSearch,
  onListSearchChange,
  sortBy,
  onSortByChange,
  isSortNonDefault,
  filterStatus,
  onToggleFilterStatus,
  filterAccount,
  onFilterAccountChange,
  isFilterActive,
  groupBy,
  onGroupByChange,
  isGroupNonDefault,
  availableAccounts,
  onResetControls,
  t,
}: DetailViewToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {onBack && (
        <button onClick={onBack} className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {detail.isEditing ? (
        <>
          <button
            onClick={detail.handleSave}
            disabled={detail.saving || !detail.hasChanges}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-medium transition-colors",
              (detail.hasChanges && !detail.saving)
                ? "bg-brand-indigo text-white hover:opacity-90 transition-opacity"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {detail.saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {detail.saving ? t("toolbar.saving") : t("toolbar.save")}
          </button>
          <button
            onClick={detail.cancelEdit}
            disabled={detail.saving}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
            {t("toolbar.close")}
          </button>
        </>
      ) : (
        <>
          {activeTab === "configurations" && (
            <button onClick={() => detail.startEdit(detail.linkedPrompt)} className={cn(xBase, "hover:max-w-[80px]", xDefault)}>
              <Pencil className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.edit")}</span>
            </button>
          )}

          {onCreateCampaign && (
            <>
              <button onClick={onCreateCampaign} className={cn(xBase, "hover:max-w-[80px]", xDefault)}>
                <Plus className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.add")}</span>
              </button>

              <SearchPill value={listSearch ?? ""} onChange={(v) => onListSearchChange?.(v)} open={true} onOpenChange={() => {}} placeholder="Search campaigns..." />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[100px]", isSortNonDefault ? xActive : xDefault)}>
                    <ArrowUpDown className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.sort")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {(Object.keys(DETAIL_SORT_LABEL_KEYS) as CampaignSortBy[]).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => onSortByChange?.(s)} className={cn("text-[12px]", sortBy === s && "font-semibold text-brand-indigo")}>
                      {t(DETAIL_SORT_LABEL_KEYS[s])}
                      {sortBy === s && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[100px]", isFilterActive ? xActive : xDefault)}>
                    <Filter className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.filter")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("filter.status")}</div>
                  <DropdownMenuSeparator />
                  {DETAIL_STATUS_FILTER_OPTIONS.map((s) => (
                    <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus?.(s); }} className="flex items-center gap-2 text-[12px]">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: DETAIL_STATUS_HEX[s] || "#6B7280" }} />
                      <span className={cn("flex-1", filterStatus?.includes(s) && "font-bold text-brand-indigo")}>{t(`statusLabels.${s}`, s)}</span>
                      {filterStatus?.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                  {(availableAccounts?.length ?? 0) > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("filter.account")}</div>
                      <DropdownMenuItem onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(""); }} className={cn("flex items-center gap-2 text-[12px]", !filterAccount && "font-bold text-brand-indigo")}>
                        <span className="flex-1">{t("filter.allAccounts")}</span>
                        {!filterAccount && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {availableAccounts?.map((a) => (
                        <DropdownMenuItem key={a} onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(filterAccount === a ? "" : a); }} className={cn("flex items-center gap-2 text-[12px]", filterAccount === a && "font-bold text-brand-indigo")}>
                          <span className="flex-1 truncate">{a}</span>
                          {filterAccount === a && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  {isFilterActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-destructive">{t("filter.clearAllFilters")}</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[100px]", isGroupNonDefault ? xActive : xDefault)}>
                    <Layers className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.group")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {(Object.keys(DETAIL_GROUP_LABEL_KEYS) as CampaignGroupBy[]).map((g) => (
                    <DropdownMenuItem key={g} onClick={() => onGroupByChange?.(g)} className={cn("text-[12px]", groupBy === g && "font-semibold text-brand-indigo")}>
                      {t(DETAIL_GROUP_LABEL_KEYS[g])}
                      {groupBy === g && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="ml-auto" />
          {canToggle && (
            <button onClick={() => onToggleStatus(campaign)} className={cn(xBase, isActive ? "hover:max-w-[100px]" : "hover:max-w-[110px]", xDefault)}>
              {isActive
                ? <><PauseCircle className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.pause")}</span></>
                : <><PlayCircle className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.activate")}</span></>
              }
            </button>
          )}
          <button onClick={onRefresh} className={cn(xBase, "hover:max-w-[110px]", xDefault)}>
            <RefreshCw className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.refresh")}</span>
          </button>
          {isAgencyUser && (
            <button onClick={onToggleGradientTester} className={cn(xBase, "hover:max-w-[120px]", gradientTesterOpen ? xActive : xDefault)}>
              <Palette className="h-4 w-4 shrink-0" /><span className={xSpan}>Gradient</span>
            </button>
          )}
          {onDuplicate && <DuplicateButton campaign={campaign} onDuplicate={onDuplicate} t={t} />}
          {onDelete && (detail.deleteConfirm ? (
            <div className="inline-flex items-center gap-1.5 h-9 rounded-full border border-red-300/50 bg-card px-4 text-[12px]">
              <span className="text-foreground/60">{t("confirm.deleteConfirm")}</span>
              <button
                className="h-7 px-3 rounded-full bg-red-600 text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                disabled={detail.deleting}
                onClick={async () => {
                  detail.setDeleting(true);
                  try { await onDelete?.(campaign.id || campaign.Id); }
                  finally { detail.setDeleting(false); detail.setDeleteConfirm(false); }
                }}
              >
                {detail.deleting ? "..." : t("confirm.yes")}
              </button>
              <button className="h-7 px-3 rounded-full text-muted-foreground text-[11px] hover:text-foreground transition-colors" onClick={() => detail.setDeleteConfirm(false)}>{t("confirm.no")}</button>
            </div>
          ) : (
            <button onClick={() => detail.setDeleteConfirm(true)} className={cn(xBase, "hover:max-w-[100px]", "border-black/[0.125] text-red-500 hover:text-red-600")}>
              <Trash2 className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.delete")}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
