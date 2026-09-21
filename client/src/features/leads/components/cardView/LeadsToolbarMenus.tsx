// Menu bodies for the desktop topbar's Filter / Sort / Group controls. Shared by
// the three standalone topbar buttons.
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PIPELINE_HEX } from "./constants";
import { CONVERSATION_TYPES, type ConversationType } from "../conversationType";

type NamedOption = { id: string; name: string };
type TagOption = { name: string; color: string };


// One filter section: a heading with a selected-count badge, then its options.
// Flat on purpose: nested submenus misplace themselves (overlapping their parent)
// when the app is scaled down on narrower desktop windows.
function Section({ label, count, children }: { label: string; count?: number; subClass?: string; children: React.ReactNode }) {
  return (
    <>
      <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground pt-2 pb-0.5">
        {label}{count ? <span className="ml-1.5 text-brand-indigo font-semibold">{count}</span> : null}
      </DropdownMenuLabel>
      {children}
    </>
  );
}

export const FILTER_MENU_CLASS = "w-56 max-h-[420px] overflow-y-auto bg-white";
export const SORT_MENU_CLASS = "w-44 bg-white";

export interface FilterMenuProps {
  showTypeControls?: boolean;
  isFilterActive: boolean;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  filterTags: string[];
  onToggleFilterTag: (t: string) => void;
  filterType: ConversationType[];
  onToggleFilterType: (v: ConversationType) => void;
  availableAccounts: NamedOption[];
  filterAccount: string;
  setFilterAccount: (v: string) => void;
  availableCampaigns: NamedOption[];
  filterCampaign: string;
  setFilterCampaign: (v: string) => void;
  allTags: TagOption[];
}

export function FilterMenuItems({
  showTypeControls, isFilterActive, filterStatus, onToggleFilterStatus, filterTags, onToggleFilterTag,
  filterType, onToggleFilterType, availableAccounts, filterAccount, setFilterAccount,
  availableCampaigns, filterCampaign, setFilterCampaign, allTags,
}: FilterMenuProps) {
  const { t } = useTranslation("leads");
  return (
    <>
      {showTypeControls && (
        <Section label={t("conversationType.label")} count={filterType.length} subClass="w-48">
            {CONVERSATION_TYPES.map((v) => (
              <DropdownMenuItem key={v} onClick={(e) => { e.preventDefault(); onToggleFilterType(v); }} className="flex items-center gap-2 text-[12px]">
                <span className="flex-1">{t(`conversationType.${v}`)}</span>
                {filterType.includes(v) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </Section>
      )}
      <Section label={t("group.status")} count={filterStatus.length} subClass="w-48">
          {["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"].map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
              <span className="flex-1">{s}</span>
              {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}
      </Section>
      {availableAccounts.length > 0 && (
        <Section label={t("detail.fields.account")} count={filterAccount ? 1 : 0} subClass="w-48 max-h-64 overflow-y-auto">
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
          </Section>
      )}
      {availableCampaigns.length > 0 && (
        <Section label={t("detailView.campaign")} count={filterCampaign ? 1 : 0} subClass="w-52 max-h-64 overflow-y-auto">
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
          </Section>
      )}
      {allTags.length > 0 && (
        <Section label={t("detail.sections.tags")} count={filterTags.length} subClass="w-48 max-h-64 overflow-y-auto">
            {allTags.map((tag) => (
              <DropdownMenuItem key={tag.name} onClick={(e) => { e.preventDefault(); onToggleFilterTag(tag.name); }} className="flex items-center gap-2 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 truncate">{tag.name}</span>
                {filterTags.includes(tag.name) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </Section>
      )}
      {isFilterActive && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              filterStatus.forEach((s) => onToggleFilterStatus(s));
              filterTags.forEach((tag) => onToggleFilterTag(tag));
              filterType.forEach((v) => onToggleFilterType(v));
              setFilterAccount("");
              setFilterCampaign("");
            }}
            className="text-[12px] text-muted-foreground"
          >
            {t("toolbar.clearAllFilters", "Clear filters")}
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}

export function SortMenuItems({ sortBy, onSortByChange }: { sortBy: string; onSortByChange: (v: any) => void }) {
  const { t } = useTranslation("leads");
  const labels: Record<string, string> = {
    recent: t("sort.mostRecent"), latest_message: t("sort.latestMessage"), name_asc: t("sort.nameAZ"), name_desc: t("sort.nameZA"),
    score_desc: t("sort.scoreDown"), score_asc: t("sort.scoreUp"),
  };
  return (
    <>
      {(["recent", "latest_message", "name_asc", "name_desc", "score_desc", "score_asc"] as const).map((value) => (
        <DropdownMenuItem key={value} onClick={() => onSortByChange(value)} className={cn("text-[12px]", sortBy === value && "font-semibold text-brand-indigo")}>
          {labels[value]}
          {sortBy === value && <Check className="h-3 w-3 ml-auto" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function GroupMenuItems({ groupBy, onGroupByChange, showTypeControls }: { groupBy: string; onGroupByChange: (v: any) => void; showTypeControls?: boolean }) {
  const { t } = useTranslation("leads");
  const labels: Record<string, string> = {
    date: t("sort.mostRecent"), status: t("group.status"), campaign: t("group.campaign"),
    tag: t("detail.sections.tags"), type: t("conversationType.label"), none: t("group.none"),
  };
  const options = (["date", "status", "campaign", "tag", "type", "none"] as const).filter((v) => v !== "type" || showTypeControls);
  return (
    <>
      {options.map((value) => (
        <DropdownMenuItem key={value} onClick={() => onGroupByChange(value)} className={cn("text-[12px]", groupBy === value && "font-semibold text-brand-indigo")}>
          {labels[value]}
          {groupBy === value && <Check className="h-3 w-3 ml-auto" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}
