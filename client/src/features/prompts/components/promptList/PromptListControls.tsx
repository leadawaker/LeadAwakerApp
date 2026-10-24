// Topbar list controls of the Prompt Library: sort, filter and group menus.
import { useTranslation } from "react-i18next";
import { ArrowUpDown, Check, Filter, Layers } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PromptGroupOption, PromptSortOption } from "../../types";

const SORT_TKEYS: Record<PromptSortOption, string> = {
  recent: "sort.mostRecent",
  name_asc: "sort.nameAZ",
  name_desc: "sort.nameZA",
  score_desc: "sort.scoreDesc",
  score_asc: "sort.scoreAsc",
};
const SORT_OPTIONS = Object.keys(SORT_TKEYS) as PromptSortOption[];

const GROUP_TKEYS: Record<PromptGroupOption, string> = {
  none: "group.none",
  status: "labels.status",
  model: "labels.model",
  campaign: "labels.campaign",
  account: "labels.account",
};
const GROUP_OPTIONS: PromptGroupOption[] = ["none", "status", "model", "campaign", "account"];

const STATUS_OPTIONS = ["all", "active", "archived"] as const;
const STATUS_TKEYS: Record<string, string> = { active: "status.active", archived: "status.archived" };

const sectionLabel = "text-[10px] uppercase tracking-widest text-muted-foreground";

export interface PromptListControlsProps {
  sortBy: PromptSortOption;
  onSortByChange: (s: PromptSortOption) => void;
  groupBy: PromptGroupOption;
  onGroupByChange: (g: PromptGroupOption) => void;
  typeFilter: "all" | "voice";
  onTypeFilterChange: (v: "all" | "voice") => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  modelFilter: string;
  onModelFilterChange: (m: string) => void;
  campaignFilter: string;
  onCampaignFilterChange: (c: string) => void;
  accountFilter: string;
  onAccountFilterChange: (a: string) => void;
  availableModels: string[];
  availableCampaigns: { id: number; name: string }[];
  availableAccounts: { id: number; name: string }[];
  isFilterActive: boolean;
  onClearAllFilters: () => void;
}

/** One checkable menu row: wine text and a check mark when it is the current choice. */
function Item({ on, onSelect, children }: { on: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenuItem
      className={cn("text-[12px]", on && "font-semibold text-primary")}
      onClick={(e) => { e.preventDefault(); onSelect(); }}
    >
      <span className="truncate flex-1">{children}</span>
      {on && <Check className="h-3 w-3 ml-1 shrink-0" />}
    </DropdownMenuItem>
  );
}

export function PromptListControls(p: PromptListControlsProps) {
  const { t } = useTranslation("prompts");
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.sortBy")} aria-label={t("toolbar.sortBy")}>
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className={sectionLabel}>{t("toolbar.sortBy")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SORT_OPTIONS.map((opt) => (
            <Item key={opt} on={p.sortBy === opt} onSelect={() => p.onSortByChange(opt)}>{t(SORT_TKEYS[opt])}</Item>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn("la-btn la-btn--soft la-btn--icon", p.isFilterActive && "on")}
            title={t("toolbar.filter")}
            aria-label={t("toolbar.filter")}
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
          {/* Type: the voice agents' prompts (voice_*, eleven_*) vs everything */}
          <DropdownMenuLabel className={sectionLabel}>{t("labels.type")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(["all", "voice"] as const).map((opt) => (
            <Item key={opt} on={p.typeFilter === opt} onSelect={() => p.onTypeFilterChange(opt)}>
              {opt === "all" ? t("toolbar.allTypes") : t("toolbar.voiceAgents")}
            </Item>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className={sectionLabel}>{t("labels.status")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((opt) => (
            <Item key={opt} on={p.statusFilter === opt} onSelect={() => p.onStatusFilterChange(opt)}>
              {opt === "all" ? t("toolbar.allStatuses") : t(STATUS_TKEYS[opt] ?? "status.unknown")}
            </Item>
          ))}
          {p.availableModels.length > 0 && (<>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={sectionLabel}>{t("labels.model")}</DropdownMenuLabel>
            <Item on={p.modelFilter === "all"} onSelect={() => p.onModelFilterChange("all")}>{t("toolbar.allModels")}</Item>
            {p.availableModels.map((m) => (
              <Item key={m} on={p.modelFilter === m} onSelect={() => p.onModelFilterChange(m)}>{m}</Item>
            ))}
          </>)}
          {p.availableCampaigns.length > 0 && (<>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={sectionLabel}>{t("labels.campaign")}</DropdownMenuLabel>
            <Item on={!p.campaignFilter} onSelect={() => p.onCampaignFilterChange("")}>{t("toolbar.allCampaigns")}</Item>
            {p.availableCampaigns.map((c) => (
              <Item
                key={c.id}
                on={p.campaignFilter === String(c.id)}
                onSelect={() => p.onCampaignFilterChange(p.campaignFilter === String(c.id) ? "" : String(c.id))}
              >
                {c.name}
              </Item>
            ))}
          </>)}
          {p.availableAccounts.length > 0 && (<>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={sectionLabel}>{t("labels.account")}</DropdownMenuLabel>
            <Item on={!p.accountFilter} onSelect={() => p.onAccountFilterChange("")}>{t("toolbar.allAccounts")}</Item>
            {p.availableAccounts.map((a) => (
              <Item
                key={a.id}
                on={p.accountFilter === String(a.id)}
                onSelect={() => p.onAccountFilterChange(p.accountFilter === String(a.id) ? "" : String(a.id))}
              >
                {a.name}
              </Item>
            ))}
          </>)}
          {p.isFilterActive && (<>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={p.onClearAllFilters} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
          </>)}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn("la-btn la-btn--soft la-btn--icon", p.groupBy !== "none" && "on")}
            title={t("toolbar.group")}
            aria-label={t("toolbar.group")}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {GROUP_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt}
              onClick={() => p.onGroupByChange(opt)}
              className={cn("text-[12px]", p.groupBy === opt && "font-semibold text-primary")}
            >
              {t(GROUP_TKEYS[opt])}
              {p.groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
