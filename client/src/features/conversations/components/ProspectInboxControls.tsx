// Prospect inbox list state (search, sort, group, filters, the "new chat"
// picker) and its topbar controls. The Outreach inbox page owns the state and
// shares it with InboxPanel, so the PageTopbar controls drive the list.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpDown, Check, Filter, Layers, Linkedin, Mail, MessageSquare, Phone, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpandingSearch, TopbarIconButton } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";
import { PROSPECT_OUTREACH_STATUSES } from "./inboxPanel/constants";

export type ProspectInboxGroup = "date" | "status" | "none";
export type ProspectInboxSort = "newest" | "oldest" | "name_asc" | "name_desc";

export function useProspectInboxFilters() {
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<ProspectInboxGroup>("date");
  const [sortBy, setSortBy] = useState<ProspectInboxSort>("newest");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterChannels, setFilterChannels] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  return { search, setSearch, groupBy, setGroupBy, sortBy, setSortBy, filterStatus, setFilterStatus, filterChannels, setFilterChannels, pickerOpen, setPickerOpen };
}

export type ProspectInboxFilters = ReturnType<typeof useProspectInboxFilters>;

const CHANNELS = [
  { key: "email", Icon: Mail },
  { key: "whatsapp", Icon: MessageSquare },
  { key: "linkedin", Icon: Linkedin },
  { key: "call", Icon: Phone },
] as const;

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const ITEM_ON = "font-semibold text-[color:var(--wine)]";
const MENU_LABEL = "text-[10px] uppercase tracking-widest text-muted-foreground";

/** Search, sort, group, filter and "+" for the PageTopbar `right` slot. */
export function ProspectInboxTopbarControls({ filters: f }: { filters: ProspectInboxFilters }) {
  const { t } = useTranslation("conversations");
  const filterCount = f.filterStatus.length + f.filterChannels.length;

  return (
    <>
      <ExpandingSearch value={f.search} onChange={f.setSearch} placeholder={t("prospectInbox.searchPlaceholder")} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("prospectInbox.sort")} active={f.sortBy !== "newest"}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {(["newest", "oldest", "name_asc", "name_desc"] as const).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => f.setSortBy(opt)} className={cn("text-[12px]", f.sortBy === opt && ITEM_ON)}>
              {t(`inbox.sortLabels.${opt}`)}
              {f.sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("prospectInbox.group")} active={f.groupBy !== "date"}>
            <Layers className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {(["date", "status", "none"] as const).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => f.setGroupBy(opt)} className={cn("text-[12px]", f.groupBy === opt && ITEM_ON)}>
              {t(`inbox.groupLabels.${opt}`)}
              {f.groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={filterCount > 0 ? `${t("prospectInbox.filter")} (${filterCount})` : t("prospectInbox.filter")} active={filterCount > 0}>
            <Filter className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className={MENU_LABEL}>{t("prospectInbox.status")}</DropdownMenuLabel>
          {PROSPECT_OUTREACH_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); f.setFilterStatus((prev) => toggle(prev, s)); }} className="flex items-center gap-2 text-[12px]">
              <span className="flex-1">{t(`prospectInbox.statuses.${s}`, s.replace(/_/g, " "))}</span>
              {f.filterStatus.includes(s) && <Check className="h-3 w-3 shrink-0" style={{ color: "var(--wine)" }} />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className={MENU_LABEL}>{t("prospectInbox.channel")}</DropdownMenuLabel>
          {CHANNELS.map(({ key, Icon }) => (
            <DropdownMenuItem key={key} onClick={(e) => { e.preventDefault(); f.setFilterChannels((prev) => toggle(prev, key)); }} className="flex items-center gap-2 text-[12px]">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1">{t(`prospectInbox.channels.${key}`)}</span>
              {f.filterChannels.includes(key) && <Check className="h-3 w-3 shrink-0" style={{ color: "var(--wine)" }} />}
            </DropdownMenuItem>
          ))}
          {filterCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { f.setFilterStatus([]); f.setFilterChannels([]); }} className="text-[12px] text-muted-foreground">
                {t("prospectInbox.clearFilters")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <TopbarIconButton label={t("inbox.startNewChat")} primary onClick={() => f.setPickerOpen(true)}>
        <Plus className="h-4 w-4 shrink-0" />
      </TopbarIconButton>
    </>
  );
}
