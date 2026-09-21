// Full-width desktop top bar for the Leads card view — title, view tabs, bulk
// controls, chats-peek toggle, list-collapse, search, and filter/sort/group menus.
// Extracted from LeadsCardViewMain.tsx to keep that file focused.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Plus,
  X,
  Filter,
  ArrowUpDown,
  Layers,
  MessageSquare,
  Trash2,
  Pencil,
  Megaphone,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
  FileText,
  Palette,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewMode } from "./types";
import { PIPELINE_HEX, ALL_LEAD_FILTER_STAGES } from "./constants";
import type { ConversationType } from "../conversationType";
import {
  FilterMenuItems,
  SortMenuItems,
  GroupMenuItems,
  FILTER_MENU_CLASS,
  SORT_MENU_CLASS,
} from "./LeadsToolbarMenus";

function WineDot() {
  return (
    <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", display: "block", pointerEvents: "none" }} />
  );
}

type ViewTab = { id: string; label: string; icon: any };
type NamedOption = { id: string; name: string };
type TagOption = { name: string; color: string };

export function LeadsDesktopToolbar({
  leadsCount,
  viewTabs,
  viewMode,
  onViewModeChange,
  selectedLeadIds,
  bulkBusy,
  bulkStageOpen,
  setBulkStageOpen,
  handleListBulkStageChange,
  bulkCampaignOpen,
  setBulkCampaignOpen,
  handleListBulkCampaignChange,
  onExport,
  bulkDeleteConfirm,
  setBulkDeleteConfirm,
  handleListBulkDelete,
  clearLeadSelection,
  deleteLabel,
  peekOn,
  setPeekOn,
  isCompact,
  setLeftPanelState,
  listSearch,
  onListSearchChange,
  isFilterActive,
  isSortNonDefault,
  isGroupNonDefault,
  filterStatus,
  onToggleFilterStatus,
  filterTags,
  onToggleFilterTag,
  availableAccounts,
  filterAccount,
  setFilterAccount,
  availableCampaigns,
  filterCampaign,
  setFilterCampaign,
  allTags,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
  onCreateLead,
  showLeadActions,
  title,
  showTypeControls,
  filterType,
  onToggleFilterType,
}: {
  leadsCount: number;
  viewTabs: ViewTab[];
  viewMode: string;
  onViewModeChange: (v: ViewMode) => void;
  selectedLeadIds: Set<number>;
  bulkBusy: boolean;
  bulkStageOpen: boolean;
  setBulkStageOpen: (v: boolean) => void;
  handleListBulkStageChange: (stage: string) => void;
  bulkCampaignOpen: boolean;
  setBulkCampaignOpen: (v: boolean) => void;
  handleListBulkCampaignChange: (campaignId: number) => void;
  onExport: () => void;
  bulkDeleteConfirm: boolean;
  setBulkDeleteConfirm: (v: boolean) => void;
  handleListBulkDelete: () => Promise<void> | void;
  clearLeadSelection: () => void;
  deleteLabel: string;
  peekOn: boolean;
  setPeekOn: (fn: (p: boolean) => boolean) => void;
  isCompact: boolean;
  setLeftPanelState: (v: "full" | "compact" | "hidden") => void;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  isFilterActive: boolean;
  isSortNonDefault: boolean;
  isGroupNonDefault: boolean;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  filterTags: string[];
  onToggleFilterTag: (t: string) => void;
  availableAccounts: NamedOption[];
  filterAccount: string;
  setFilterAccount: (v: string) => void;
  availableCampaigns: NamedOption[];
  filterCampaign: string;
  setFilterCampaign: (v: string) => void;
  allTags: TagOption[];
  sortBy: string;
  onSortByChange: (v: any) => void;
  groupBy: string;
  onGroupByChange: (v: any) => void;
  onCreateLead?: () => void;
  /** When true (agency + a lead is open), show the per-lead "..." actions menu. */
  showLeadActions?: boolean;
  /** Page title (defaults to the Leads title). */
  title?: string;
  /** Conversations page: adds the Type filter and Group-by-Type. */
  showTypeControls?: boolean;
  filterType: ConversationType[];
  onToggleFilterType: (v: ConversationType) => void;
}) {
  const { t } = useTranslation("leads");
  const [leadDeleteConfirm, setLeadDeleteConfirm] = useState(false);
  const filterMenuProps = {
    showTypeControls, isFilterActive, filterStatus, onToggleFilterStatus, filterTags, onToggleFilterTag,
    filterType, onToggleFilterType, availableAccounts, filterAccount, setFilterAccount,
    availableCampaigns, filterCampaign, setFilterCampaign, allTags,
  };
  return (
    <div className="shrink-0 flex items-center gap-3" style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)", paddingLeft: 17, paddingRight: 17 }}>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>{title ?? t("page.title")}</span>
        <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>#{leadsCount}</span>
      </div>
      {/* Single-view pages (e.g. Conversations) hide the segmented switcher. */}
      {viewTabs.length > 1 && (
        <div className="la-seg shrink-0">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onViewModeChange(tab.id as ViewMode)}
              className={`la-seg-btn${viewMode === tab.id ? " on" : ""}`}
              style={{ padding: "8px 13px", fontSize: 10, letterSpacing: "0.12em" }}
            >
              {tab.icon && <span className="flex items-center"><tab.icon size={13} /></span>}
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {/* ── Inline bulk-selection controls — shown when any leads are selected ── */}
      {selectedLeadIds.size > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
            {t("selection.countSelected", { count: selectedLeadIds.size })}
          </span>
          {/* Change stage dropdown */}
          <DropdownMenu open={bulkStageOpen} onOpenChange={setBulkStageOpen}>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft shrink-0" style={{ fontSize: 11 }} disabled={bulkBusy}>
                <Pencil size={12} />
                {t("toolbar.changeStage", "Change stage")}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-44 bg-white">
              {ALL_LEAD_FILTER_STAGES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => { setBulkStageOpen(false); handleListBulkStageChange(s); }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                  {t(`kanban.stageLabels.${s.replace(/ /g, "")}`, s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Assign campaign dropdown */}
          {availableCampaigns.length > 0 && (
            <DropdownMenu open={bulkCampaignOpen} onOpenChange={setBulkCampaignOpen}>
              <DropdownMenuTrigger asChild>
                <button className="la-btn la-btn--soft shrink-0" style={{ fontSize: 11 }} disabled={bulkBusy}>
                  <Megaphone size={12} />
                  {t("toolbar.assignCampaign", "Assign campaign")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-52 max-h-64 overflow-y-auto bg-white">
                {availableCampaigns.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => { setBulkCampaignOpen(false); handleListBulkCampaignChange(Number(c.id)); }}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span className="flex-1 truncate">{c.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Delete with inline confirm */}
          {bulkDeleteConfirm ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                className="la-btn la-btn--wine"
                style={{ fontSize: 11 }}
                disabled={bulkBusy}
                onClick={async () => { await handleListBulkDelete(); setBulkDeleteConfirm(false); }}
              >
                {bulkBusy ? "…" : t("common.confirm", "Confirm")}
              </button>
              <button className="la-btn la-btn--soft" style={{ fontSize: 11 }} onClick={() => setBulkDeleteConfirm(false)}>
                {t("common.cancel", "Cancel")}
              </button>
            </div>
          ) : (
            <button
              className="la-btn la-btn--soft shrink-0"
              style={{ fontSize: 11, color: "#C0392B" }}
              disabled={bulkBusy}
              onClick={() => setBulkDeleteConfirm(true)}
            >
              <Trash2 size={12} />
              {deleteLabel}
            </button>
          )}
          {/* Clear selection */}
          <button className="la-btn la-btn--soft la-btn--icon shrink-0" onClick={clearLeadSelection} title={t("selection.clearSelection", "Clear selection")}>
            <X size={13} />
          </button>
        </>
      )}

      {/* Minimize / expand the list pane (toggles compact rail) */}
      <button
        onClick={() => setLeftPanelState(isCompact ? "full" : "compact")}
        className="la-btn la-btn--soft la-btn--icon"
        title={isCompact ? t("toolbar.expandList", "Expand list") : t("toolbar.minimizeList", "Minimize list")}
      >
        {isCompact ? <PanelLeft size={13} /> : <PanelLeftClose size={13} />}
      </button>
      <div className="flex-1 min-w-0" />
      <div className="shrink-0 flex items-center gap-[5px]">
      {/* Per-lead actions ("...") — relocated here from the lead's header. Acts
          on the open lead via window events handled in LeadDetailView. */}
      {showLeadActions && (
        <DropdownMenu onOpenChange={(o) => { if (!o) setLeadDeleteConfirm(false); }}>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon" title={t("common.more", "More")}>
              <MoreHorizontal size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white">
            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent("lead-export-pdf"))}>
              <FileText className="h-4 w-4 mr-2" />
              {t("detailView.toPdf", "Export PDF")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent("toggle-gradient-tester"))}>
              <Palette className="h-4 w-4 mr-2" />
              {t("detail.gradientTester", "Gradient tester")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                const newPeekState = !peekOn;
                setPeekOn(() => newPeekState);
                if (newPeekState && sortBy !== "latest_message") {
                  onSortByChange("latest_message");
                }
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {peekOn ? t("toolbar.hideChats", "Hide chats") : t("toolbar.showChats", "Show chats")}
              {peekOn && <Check className="h-3.5 w-3.5 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                if (!leadDeleteConfirm) { e.preventDefault(); setLeadDeleteConfirm(true); }
                else { window.dispatchEvent(new CustomEvent("lead-delete")); setLeadDeleteConfirm(false); }
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {leadDeleteConfirm ? t("confirm.yes", "Confirm delete") : t("detailView.deleteLead", "Delete lead")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="relative" style={{ width: 160 }}>
        <input
          value={listSearch}
          onChange={(e) => onListSearchChange(e.target.value)}
          placeholder={t("toolbar.searchPlaceholder")}
          className="la-input"
          style={{ background: "var(--surface)", paddingLeft: 27, paddingTop: 7, paddingBottom: 7, paddingRight: 10, height: 32, fontSize: 11 }}
        />
        <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg>
        </span>
      </div>

      {/* Filter */}
      <DropdownMenu>
        <div style={{ position: "relative" }}>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.filter")}>
              <Filter className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          {isFilterActive && <WineDot />}
        </div>
        <DropdownMenuContent align="end" className={FILTER_MENU_CLASS}>
          <FilterMenuItems {...filterMenuProps} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <div style={{ position: "relative" }}>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.sort")}>
              <ArrowUpDown className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          {isSortNonDefault && <WineDot />}
        </div>
        <DropdownMenuContent align="end" className={SORT_MENU_CLASS}>
          <SortMenuItems sortBy={sortBy} onSortByChange={onSortByChange} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <div style={{ position: "relative" }}>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.group")}>
              <Layers className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          {isGroupNonDefault && <WineDot />}
        </div>
        <DropdownMenuContent align="end" className={SORT_MENU_CLASS}>
          <GroupMenuItems groupBy={groupBy} onGroupByChange={onGroupByChange} showTypeControls={showTypeControls} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* +Add */}
      {onCreateLead && (
        <button onClick={onCreateLead} className="la-btn la-btn--wine la-btn--icon" title={t("toolbar.add")}>
          <Plus className="h-[14px] w-[14px] shrink-0" />
        </button>
      )}
      </div>
    </div>
  );
}
