// Full-width desktop top bar for the Leads card view — title, view tabs, bulk
// controls, chats-peek toggle, list-collapse, search, and filter/sort/group menus.
// Extracted from LeadsCardViewMain.tsx to keep that file focused.
import { useState, type ReactNode } from "react";
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
  MoreHorizontal,
  FileText,
  Palette,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewMode } from "./types";
import { ExpandingSearch } from "@/components/crm/primitives";
import { PIPELINE_HEX, ALL_LEAD_FILTER_STAGES } from "./constants";
import type { ConversationType } from "../conversationType";
import { useChatsPresenting } from "../../presenting";
import {
  FilterMenuItems,
  SortMenuItems,
  GroupMenuItems,
  FILTER_MENU_CLASS,
  SORT_MENU_CLASS,
  GROUP_MENU_CLASS,
} from "./LeadsToolbarMenus";

function WineDot() {
  return (
    <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", display: "block", pointerEvents: "none" }} />
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
  searchPlaceholder,
  showTypeControls,
  filterType,
  onToggleFilterType,
  channelTabs,
  scopeSwitch,
  pageTabs,
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
  /** Search placeholder (defaults to "Search leads..."). */
  searchPlaceholder?: string;
  /** Conversations page: adds the Type filter and Group-by-Type. */
  showTypeControls?: boolean;
  filterType: ConversationType[];
  onToggleFilterType: (v: ConversationType) => void;
  /** Chats page: All / Website / WhatsApp inbox tabs, shown in place of the view switcher. */
  channelTabs?: ReactNode;
  /** Chats page: the Live / Demo switch (Owner). */
  scopeSwitch?: ReactNode;
  /** Chats: the "Chat settings" button, in the right cluster after the scope switch. Also turns on the identities item of the "..." menu (Owner). */
  pageTabs?: ReactNode;
}) {
  const { t } = useTranslation("leads");
  const { t: tVoice } = useTranslation("voiceCalls");
  // Chats (Owner): the identities switch lives in the "..." menu.
  const presenting = useChatsPresenting();
  const canPresent = !!pageTabs && presenting.canToggle;
  const [leadDeleteConfirm, setLeadDeleteConfirm] = useState(false);
  const filterMenuProps = {
    showTypeControls, isFilterActive, filterStatus, onToggleFilterStatus, filterTags, onToggleFilterTag,
    filterType, onToggleFilterType, availableAccounts, filterAccount, setFilterAccount,
    availableCampaigns, filterCampaign, setFilterCampaign, allTags,
  };
  return (
    <div className="la-page-header" style={{ gap: 12, padding: "0 17px" }}>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="la-page-title">{title ?? t("page.title")}</span>
        <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>#{leadsCount}</span>
      </div>
      {channelTabs}
      {/* Single-view pages (e.g. Conversations) hide the segmented switcher. */}
      {!channelTabs && !pageTabs && viewTabs.length > 1 && (
        <div className="la-seg la-seg--main shrink-0" role="tablist">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={viewMode === tab.id}
              onClick={() => onViewModeChange(tab.id as ViewMode)}
              className={`la-seg-btn${viewMode === tab.id ? " on" : ""}`}
            >
              {tab.icon && <tab.icon size={14} style={{ flexShrink: 0 }} />}
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {/* ── Inline bulk-selection controls — shown when any leads are selected ── */}
      {selectedLeadIds.size > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
            {t("selection.countSelected", { count: selectedLeadIds.size })}
          </span>
          {/* Change stage dropdown */}
          <DropdownMenu open={bulkStageOpen} onOpenChange={setBulkStageOpen}>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft shrink-0" disabled={bulkBusy}>
                <Pencil size={16} />
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
                <button className="la-btn la-btn--soft shrink-0" disabled={bulkBusy}>
                  <Megaphone size={16} />
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
               
                disabled={bulkBusy}
                onClick={async () => { await handleListBulkDelete(); setBulkDeleteConfirm(false); }}
              >
                {bulkBusy ? "…" : t("common.confirm", "Confirm")}
              </button>
              <button className="la-btn la-btn--soft" onClick={() => setBulkDeleteConfirm(false)}>
                {t("common.cancel", "Cancel")}
              </button>
            </div>
          ) : (
            <button
              className="la-btn la-btn--soft shrink-0"
              style={{ color: "hsl(var(--destructive))" }}
              disabled={bulkBusy}
              onClick={() => setBulkDeleteConfirm(true)}
            >
              <Trash2 size={16} />
              {deleteLabel}
            </button>
          )}
          {/* Clear selection */}
          <button className="la-btn la-btn--soft la-btn--icon shrink-0" onClick={clearLeadSelection} title={t("selection.clearSelection", "Clear selection")}>
            <X size={16} />
          </button>
        </>
      )}

      <div className="flex-1 min-w-0" />
      <div className="shrink-0 flex items-center gap-2">
      <ExpandingSearch value={listSearch} onChange={onListSearchChange} placeholder={searchPlaceholder ?? t("toolbar.searchPlaceholder")} width={180} />

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
        <DropdownMenuContent align="end" className={GROUP_MENU_CLASS}>
          <GroupMenuItems groupBy={groupBy} onGroupByChange={onGroupByChange} showTypeControls={showTypeControls} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Chats: the Live / Tests / Demo scope dropdown, then "Chat settings" right after it. */}
      {scopeSwitch}
      {pageTabs}

      {/* "..." at the far right: New lead, the identities switch (Owner, Chats) and, with a lead
          open (agency), the per-lead actions. Those act on the open lead via window events
          handled in LeadDetailView. */}
      {(onCreateLead || canPresent || showLeadActions) && (
        <DropdownMenu onOpenChange={(o) => { if (!o) setLeadDeleteConfirm(false); }}>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon" title={t("common.more", "More")} aria-label={t("common.more", "More")} data-testid="chats-more-menu">
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {onCreateLead && (
              <DropdownMenuItem onClick={onCreateLead} data-testid="chats-new-lead">
                <Plus className="h-4 w-4 mr-2" />
                {t("detailView.newLead", "New lead")}
              </DropdownMenuItem>
            )}
            {canPresent && (
              <DropdownMenuItem onClick={presenting.toggle} data-testid="chats-presenting-toggle">
                {presenting.masked ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {presenting.masked ? tVoice("presenting.show") : tVoice("presenting.hide")}
              </DropdownMenuItem>
            )}
            {showLeadActions && (
              <>
                {(onCreateLead || canPresent) && <DropdownMenuSeparator />}
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
                  {peekOn ? t("toolbar.hideChats", "Hide conversations") : t("toolbar.showChats", "Show conversations")}
                  {peekOn && <Check className="h-3.5 w-3.5 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    if (!leadDeleteConfirm) { e.preventDefault(); setLeadDeleteConfirm(true); }
                    else { window.dispatchEvent(new CustomEvent("lead-delete")); setLeadDeleteConfirm(false); }
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {leadDeleteConfirm ? t("confirm.yes", "Confirm delete") : t("detailView.deleteLead", "Delete lead")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </div>
    </div>
  );
}
