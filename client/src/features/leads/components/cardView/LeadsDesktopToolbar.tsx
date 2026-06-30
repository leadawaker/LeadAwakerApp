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
  Settings,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./types";
import { PIPELINE_HEX, ALL_LEAD_FILTER_STAGES } from "./constants";

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
  toolbarCollapsed,
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
  toolbarCollapsed: boolean;
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
}) {
  const { t } = useTranslation("leads");
  const [leadDeleteConfirm, setLeadDeleteConfirm] = useState(false);
  return (
    <div className="shrink-0 flex items-center gap-3" style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)", paddingLeft: 17, paddingRight: 17 }}>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("page.title")}</span>
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

      {toolbarCollapsed ? (
        /* Collapsed: single ⚙ button with dot when any control is active */
        <div style={{ position: "relative" }}>
          <button className="la-btn la-btn--soft la-btn--icon">
            <Settings size={13} />
          </button>
          {(isFilterActive || isSortNonDefault || isGroupNonDefault) && (
            <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", display: "block", pointerEvents: "none" }} />
          )}
        </div>
      ) : (
        <>
      {/* Filter */}
      <DropdownMenu>
        <div style={{ position: "relative" }}>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon">
              <Filter className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          {isFilterActive && (
            <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", display: "block", pointerEvents: "none" }} />
          )}
        </div>
        <DropdownMenuContent align="start" className="w-52 max-h-[400px] overflow-y-auto bg-white">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
              <span className="flex-1">{t("group.status")}</span>
              {filterStatus.length > 0 && <span className="text-[10px] tabular-nums text-brand-indigo font-semibold">{filterStatus.length}</span>}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"].map((s) => (
                <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                  <span className="flex-1">{s}</span>
                  {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {availableAccounts.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                <span className="flex-1">{t("detail.fields.account")}</span>
                {filterAccount && <span className="text-[10px] text-brand-indigo font-semibold">1</span>}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48 max-h-64 overflow-y-auto">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); setFilterAccount(""); setFilterCampaign(""); }} className={cn("text-[12px]", !filterAccount && "font-semibold text-brand-indigo")}>
                  {t("filters.allAccounts")}
                  {!filterAccount && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableAccounts.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={(e) => { e.preventDefault(); if (filterAccount === a.id) { setFilterAccount(""); } else { setFilterAccount(a.id); setFilterCampaign(""); } }} className={cn("text-[12px]", filterAccount === a.id && "font-semibold text-brand-indigo")}>
                    <span className="flex-1 truncate">{a.name}</span>
                    {filterAccount === a.id && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {availableCampaigns.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                <span className="flex-1">{t("detailView.campaign")}</span>
                {filterCampaign && <span className="text-[10px] text-brand-indigo font-semibold">1</span>}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); setFilterCampaign(""); }} className={cn("text-[12px]", !filterCampaign && "font-semibold text-brand-indigo")}>
                  {t("filters.allCampaigns")}
                  {!filterCampaign && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableCampaigns.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={(e) => { e.preventDefault(); setFilterCampaign(filterCampaign === c.id ? "" : c.id); }} className={cn("text-[12px]", filterCampaign === c.id && "font-semibold text-brand-indigo")}>
                    <span className="flex-1 truncate">{c.name}</span>
                    {filterCampaign === c.id && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {allTags.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                <span className="flex-1">{t("detail.sections.tags")}</span>
                {filterTags.length > 0 && <span className="text-[10px] tabular-nums text-brand-indigo font-semibold">{filterTags.length}</span>}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48 max-h-64 overflow-y-auto">
                {allTags.map((tag) => (
                  <DropdownMenuItem key={tag.name} onClick={(e) => { e.preventDefault(); onToggleFilterTag(tag.name); }} className="flex items-center gap-2 text-[12px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="flex-1 truncate">{tag.name}</span>
                    {filterTags.includes(tag.name) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {(isFilterActive || filterAccount || filterCampaign) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { filterStatus.forEach((s) => onToggleFilterStatus(s)); filterTags.forEach((tag) => onToggleFilterTag(tag)); setFilterAccount(""); setFilterCampaign(""); }} className="text-[12px] text-muted-foreground">
                {t("toolbar.clearAllFilters", "Clear filters")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <div style={{ position: "relative" }}>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon">
              <ArrowUpDown className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          {isSortNonDefault && (
            <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", display: "block", pointerEvents: "none" }} />
          )}
        </div>
        <DropdownMenuContent align="start" className="w-44 bg-white">
          {(["recent", "latest_message", "name_asc", "name_desc", "score_desc", "score_asc"] as const).map((value) => {
            const sortLabels: Record<string, string> = {
              recent: t("sort.mostRecent"), latest_message: t("sort.latestMessage"), name_asc: t("sort.nameAZ"), name_desc: t("sort.nameZA"),
              score_desc: t("sort.scoreDown"), score_asc: t("sort.scoreUp"),
            };
            return (
              <DropdownMenuItem key={value} onClick={() => onSortByChange(value)} className={cn("text-[12px]", sortBy === value && "font-semibold text-brand-indigo")}>
                {sortLabels[value]}
                {sortBy === value && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <div style={{ position: "relative" }}>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon">
              <Layers className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          {isGroupNonDefault && (
            <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", display: "block", pointerEvents: "none" }} />
          )}
        </div>
        <DropdownMenuContent align="start" className="w-44 bg-white">
          {(["date", "status", "campaign", "tag", "none"] as const).map((value) => {
            const groupLabels: Record<string, string> = {
              date: t("sort.mostRecent"), status: t("group.status"), campaign: t("group.campaign"),
              tag: t("detail.sections.tags"), none: t("group.none"),
            };
            return (
              <DropdownMenuItem key={value} onClick={() => onGroupByChange(value)} className={cn("text-[12px]", groupBy === value && "font-semibold text-brand-indigo")}>
                {groupLabels[value]}
                {groupBy === value && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
        </>
      )}

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
