import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Filter, Check, ArrowUpDown, ArrowUp, ArrowDown, Layers, Plus,
  MoreHorizontal, Trash2,
  Building2, Link2, MessagesSquare, MessageCircle, Phone, Zap, BellRing, Megaphone,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageTopbar, TopbarTabs, TopbarIconButton, ExpandingSearch, type TopbarTab } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { myAccountLabelKey } from "@/components/crm/navGates";
import { useClientNavFacts } from "@/components/crm/useClientNavFacts";
import { ACCOUNT_STATUS_HEX } from "@/lib/avatarUtils";
import {
  STATUS_FILTER_OPTIONS, STATUS_I18N_KEY, GROUP_TKEYS,
} from "../listWidgets/accountListConstants";
import type { WorkspaceTab } from "./types";
import type { AccountGroupBy, AccountSortBy } from "../../pages/AccountsPage";

const TAB_ICONS: Record<WorkspaceTab, LucideIcon> = {
  overview: Building2,
  reactivation: Megaphone,
  integrations: Link2,
  communication: MessagesSquare,
  voice: Phone,
  chat: MessageCircle,
  alerts: BellRing,
  automations: Zap,
};

interface Props {
  tab: WorkspaceTab;
  tabs: WorkspaceTab[];
  onTabChange: (t: WorkspaceTab) => void;
  showTabs: boolean;
  count: number;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  isFilterActive: boolean;
  onResetControls: () => void;
  sortBy: AccountSortBy;
  onSortByChange: (v: AccountSortBy) => void;
  isSortNonDefault: boolean;
  groupBy: AccountGroupBy;
  onGroupByChange: (v: AccountGroupBy) => void;
  groupDirection: "asc" | "desc";
  onGroupDirectionChange: (v: "asc" | "desc") => void;
  isGroupNonDefault: boolean;
  onCreate: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

// Small asc/desc arrows inside a sort or group menu item.
function DirButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={cn("p-0.5 rounded hover:bg-muted/60", on ? "text-primary" : "text-foreground/30")}>
      {children}
    </button>
  );
}

export function AccountsTopBar(p: Props) {
  const { t } = useTranslation("accounts");
  const { t: tc } = useTranslation("crm");
  const { isAgencyUser } = useWorkspace();
  const navFacts = useClientNavFacts();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (deleteConfirm) { p.onDelete(); setDeleteConfirm(false); }
    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); }
  };

  const tabItems: TopbarTab<WorkspaceTab>[] = p.tabs.map((k) => ({ id: k, label: t(`workspace.tabs.${k}`), icon: TAB_ICONS[k] }));
  const nameSortActive = p.sortBy === "name_asc" || p.sortBy === "name_desc";
  const nameSortDir = p.sortBy === "name_asc" ? "asc" : "desc";

  // A client has no account list: no search, filter, sort, group, delete or create.
  // The list fold button sits on the list panel header.
  const left = p.showTabs ? (
    <TopbarTabs tabs={tabItems} value={p.tab} onChange={p.onTabChange} testIdPrefix="account-topbar-tab" />
  ) : undefined;

  const right = isAgencyUser ? (
    <>
      <ExpandingSearch value={p.listSearch} onChange={p.onListSearchChange} placeholder={t("page.searchPlaceholder")} testId="accounts-topbar-search" />

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("toolbar.filter")} active={p.isFilterActive}><Filter className="h-4 w-4" /></TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {STATUS_FILTER_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); p.onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ACCOUNT_STATUS_HEX[s] || "var(--mute-2)" }} />
              <span className={cn("flex-1", p.filterStatus.includes(s) && "font-bold text-primary")}>{t(STATUS_I18N_KEY[s] ?? s)}</span>
              {p.filterStatus.includes(s) && <Check className="h-3 w-3 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
          {p.isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={p.onResetControls} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("toolbar.sort")} active={p.isSortNonDefault}><ArrowUpDown className="h-4 w-4" /></TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); p.onSortByChange("recent"); }} className="text-[12px] flex items-center gap-2">
            <span className={cn("flex-1", p.sortBy === "recent" && "font-semibold !text-primary")}>{t("sort.mostRecent")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); p.onSortByChange(nameSortActive ? p.sortBy : "name_desc"); }} className="text-[12px] flex items-center gap-2">
            <span className={cn("flex-1", nameSortActive && "font-semibold !text-primary")}>{t("sort.name")}</span>
            {nameSortActive && (
              <>
                <DirButton on={nameSortDir === "asc"} onClick={() => p.onSortByChange("name_asc")}><ArrowUp className="h-3 w-3" /></DirButton>
                <DirButton on={nameSortDir === "desc"} onClick={() => p.onSortByChange("name_desc")}><ArrowDown className="h-3 w-3" /></DirButton>
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("toolbar.group")} active={p.isGroupNonDefault}><Layers className="h-4 w-4" /></TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {(Object.keys(GROUP_TKEYS) as AccountGroupBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onSelect={(e) => { e.preventDefault(); p.onGroupByChange(opt); }} className="text-[12px] flex items-center gap-2">
              <span className={cn("flex-1", p.groupBy === opt && "font-semibold !text-primary")}>{t(GROUP_TKEYS[opt])}</span>
              {p.groupBy === opt && opt !== "none" && (
                <>
                  <DirButton on={p.groupDirection === "asc"} onClick={() => p.onGroupDirectionChange("asc")}><ArrowUp className="h-3 w-3" /></DirButton>
                  <DirButton on={p.groupDirection === "desc"} onClick={() => p.onGroupDirectionChange("desc")}><ArrowDown className="h-3 w-3" /></DirButton>
                </>
              )}
              {p.groupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Overflow: delete the selected account (click twice to confirm) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("toolbar.moreActions")}><MoreHorizontal className="h-4 w-4" /></TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={!p.hasSelection} className={cn("flex items-center gap-2 text-[12px] text-destructive", deleteConfirm && "font-semibold")}>
            <Trash2 className="h-3.5 w-3.5" />{deleteConfirm ? t("detail.confirm") : t("toolbar.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TopbarIconButton label={t("workspace.createAccount")} primary onClick={p.onCreate}>
        <Plus className="h-4 w-4" />
      </TopbarIconButton>
    </>
  ) : undefined;

  return (
    <PageTopbar
      desktopOnly
      title={isAgencyUser ? t("page.title") : tc(myAccountLabelKey(navFacts))}
      count={isAgencyUser ? p.count : null}
      left={left}
      right={right}
      testId="accounts-topbar"
    />
  );
}
