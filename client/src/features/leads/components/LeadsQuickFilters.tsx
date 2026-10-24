// Leads page quick filters: a view switch (All / Needs reply / Next appointments)
// and a channel switch (All / Website / WhatsApp / Phone). Desktop: both sit in
// the topbar (LeadsQuickControls), the view switch as one dropdown button. Phones:
// one row under the topbar (LeadsQuickFilters) with a Filter sheet.
// Counts come from the server and cover every lead, not only the loaded page.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users, MessageSquareReply, CalendarClock, Layers, Globe, MessageCircle, Phone, SlidersHorizontal, X, Check, ChevronDown, type LucideIcon,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActiveDot } from "./LeadsTopbarParts";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { MobileDrawerOption, MobileDrawerSubheading } from "@/components/crm/mobile/MobileListHeader";
import { stageHex, stageLabel } from "../lib/leadDisplay";
import type { ChannelFilter, QuickView } from "./leadsTableConfig";

const VIEW_ICONS: Record<QuickView, LucideIcon> = { all: Users, needsReply: MessageSquareReply, upcoming: CalendarClock };
const CHANNEL_ICONS: Record<ChannelFilter, LucideIcon> = { all: Layers, website: Globe, whatsapp: MessageCircle, phone: Phone };

function Seg<K extends string>({
  items, active, onChange, icons, label, counts, testId, shortLabels,
}: {
  items: K[];
  active: K;
  onChange: (k: K) => void;
  icons: Record<K, LucideIcon>;
  label: (k: K) => string;
  counts: Partial<Record<K, number>>;
  testId: string;
  /** Topbar: the labels hide below 1536px (icon + count stay, the label moves to the tooltip). */
  shortLabels?: boolean;
}) {
  return (
    <div className="la-seg shrink-0" role="tablist" data-testid={testId}>
      {items.map((k) => {
        const Icon = icons[k];
        const on = k === active;
        const n = counts[k];
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={on}
            className={`la-seg-btn${on ? " on" : ""}`}
            style={{ padding: "7px 12px", fontSize: 10, letterSpacing: "0.1em", gap: 6 }}
            onClick={() => onChange(k)}
            title={shortLabels ? label(k) : undefined}
            aria-label={shortLabels ? label(k) : undefined}
            data-testid={`${testId}-${k}`}
          >
            <Icon size={13} className="shrink-0" />
            {shortLabels ? <span className="max-2xl:hidden">{label(k)}</span> : label(k)}
            {n !== undefined && (
              <span className="tabular-nums" style={{ color: on ? "var(--wine)" : "var(--mute-2)", fontWeight: 400 }}>{n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A removable chip for an active filter (phone layout). */
function Chip({ icon: Icon, label, onRemove, color }: { icon?: LucideIcon; label: string; onRemove: () => void; color?: string }) {
  return (
    <button type="button" onClick={onRemove} className="shrink-0 inline-flex items-center gap-1.5"
      style={{ height: 32, padding: "0 10px 0 11px", borderRadius: "var(--r-pill)", border: "none", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
      {color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />}
      {Icon && <Icon size={13} style={{ color: "var(--wine)" }} />}
      {label}
      <X size={13} style={{ color: "var(--mute)" }} />
    </button>
  );
}

export function LeadsQuickFilters({
  view, onViewChange, channel, onChannelChange, total, viewCounts, channelCounts, stages, selectedStages, onToggleStage,
}: {
  view: QuickView;
  onViewChange: (v: QuickView) => void;
  channel: ChannelFilter;
  onChannelChange: (c: ChannelFilter) => void;
  /** Total for "All" with the channel filter applied. */
  total: number;
  viewCounts: { needsReply: number; upcoming: number };
  channelCounts: Record<string, number>;
  /** Phones: the Stage section of the filter sheet (Table view). Omitted: no Stage section. */
  stages?: string[];
  selectedStages?: string[];
  onToggleStage?: (stage: string) => void;
}) {
  const { t } = useTranslation("leads");
  const isPhone = useIsMobile(768);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Phones: one compact row (a Filter button + removable chips) instead of two scrolling segment rows.
  if (isPhone) {
    const picked = selectedStages ?? [];
    const activeCount = picked.length + (channel !== "all" ? 1 : 0) + (view !== "all" ? 1 : 0);
    return (
      <>
        <div className="shrink-0 flex items-center gap-2 overflow-x-auto scrollbar-hide" style={{ padding: "9px 12px", borderBottom: "1px solid var(--line)" }} data-testid="leads-quick-filters">
          <button type="button" onClick={() => setSheetOpen(true)} className="shrink-0 inline-flex items-center gap-1.5 la-hit" data-testid="leads-filter-sheet-open"
            style={{ height: 34, padding: "0 13px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: activeCount ? "var(--wine)" : "var(--surface)", color: activeCount ? "var(--on-wine)" : "var(--ink)", boxShadow: "var(--sh-raised-crisp)" }}>
            <SlidersHorizontal size={14} />
            {t("toolbar.filter")}{activeCount ? ` · ${activeCount}` : ""}
          </button>
          {view !== "all" && <Chip icon={VIEW_ICONS[view]} label={t(`quickViews.${view}`)} onRemove={() => onViewChange("all")} />}
          {channel !== "all" && <Chip icon={CHANNEL_ICONS[channel]} label={t(`channelFilter.${channel}`)} onRemove={() => onChannelChange("all")} />}
          {picked.map((s) => <Chip key={s} color={stageHex(s)} label={stageLabel(t, s)} onRemove={() => onToggleStage?.(s)} />)}
          {!activeCount && <span style={{ fontSize: 12.5, color: "var(--mute)", whiteSpace: "nowrap" }}>{t(`quickViews.all`)} · {total}</span>}
        </div>
        <MobileSheet open={sheetOpen} onClose={() => setSheetOpen(false)} fitContent data-testid="leads-filter-sheet">
          <div style={{ padding: "2px 18px calc(18px + var(--safe-bottom))", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            {stages && stages.length > 0 && (
              <>
                <MobileDrawerSubheading>{t("filters.stage")}</MobileDrawerSubheading>
                {stages.map((s) => (
                  <MobileDrawerOption key={s} label={stageLabel(t, s)} selected={picked.includes(s)} onClick={() => onToggleStage?.(s)} />
                ))}
              </>
            )}
            <MobileDrawerSubheading>{t("filters.channel")}</MobileDrawerSubheading>
            {(["all", "website", "whatsapp", "phone"] as ChannelFilter[]).map((c) => (
              <MobileDrawerOption key={c} icon={CHANNEL_ICONS[c]} label={t(`channelFilter.${c}`)} selected={channel === c} onClick={() => onChannelChange(c)} />
            ))}
            <MobileDrawerSubheading>{t("filters.show")}</MobileDrawerSubheading>
            {(["needsReply", "upcoming"] as QuickView[]).map((v) => (
              <MobileDrawerOption key={v} icon={VIEW_ICONS[v]}
                label={`${t(`quickViews.${v}`)} · ${v === "needsReply" ? viewCounts.needsReply : viewCounts.upcoming}`}
                selected={view === v} onClick={() => onViewChange(view === v ? "all" : v)} />
            ))}
          </div>
        </MobileSheet>
      </>
    );
  }

  // Desktop: the controls live in the topbar (LeadsQuickControls).
  return null;
}

/**
 * Desktop topbar controls: the view (All / Needs reply / Next appointments) as one
 * dropdown button with the wine dot when it is not on All, then the channel tabs.
 */
export function LeadsQuickControls({
  view, onViewChange, channel, onChannelChange, total, viewCounts, channelCounts,
}: {
  view: QuickView;
  onViewChange: (v: QuickView) => void;
  channel: ChannelFilter;
  onChannelChange: (c: ChannelFilter) => void;
  total: number;
  viewCounts: { needsReply: number; upcoming: number };
  channelCounts: Record<string, number>;
}) {
  const { t } = useTranslation("leads");
  const isPhone = useIsMobile(768);
  if (isPhone) return null;
  const countOf = (v: QuickView) => (v === "all" ? (view === "all" ? total : undefined) : viewCounts[v]);
  const ViewIcon = VIEW_ICONS[view];
  const current = countOf(view);

  return (
    <>
      <DropdownMenu>
        <div className="shrink-0" style={{ position: "relative" }}>
          <DropdownMenuTrigger asChild>
            <button type="button" className="la-btn la-btn--soft" title={t("filters.show")} data-testid="leads-quick-view" style={{ height: 32, gap: 6 }}>
              <ViewIcon size={13} className="shrink-0" />
              {t(`quickViews.${view}`)}
              {current !== undefined && <span className="tabular-nums" style={{ color: "var(--mute-2)", fontWeight: 400 }}>{current}</span>}
              <ChevronDown size={12} className="shrink-0" />
            </button>
          </DropdownMenuTrigger>
          {view !== "all" && <ActiveDot />}
        </div>
        <DropdownMenuContent align="start" className="w-56 glass-strong border-none">
          {(["all", "needsReply", "upcoming"] as QuickView[]).map((v) => {
            const Icon = VIEW_ICONS[v];
            const n = countOf(v);
            return (
              <DropdownMenuItem key={v} onClick={() => onViewChange(v)} className="flex items-center gap-2 text-[12px]" style={{ fontWeight: view === v ? 600 : 400 }} data-testid={`leads-quick-view-${v}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: view === v ? "var(--wine)" : "var(--mute)" }} />
                <span className="flex-1">{t(`quickViews.${v}`)}</span>
                {n !== undefined && <span className="tabular-nums text-[11px]" style={{ color: "var(--mute-2)" }}>{n}</span>}
                {view === v && <Check className="h-3 w-3 shrink-0" style={{ color: "var(--wine)" }} />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <Seg<ChannelFilter>
        items={["all", "website", "whatsapp", "phone"]}
        active={channel}
        onChange={onChannelChange}
        icons={CHANNEL_ICONS}
        label={(k) => t(`channelFilter.${k}`)}
        counts={{ website: channelCounts.website, whatsapp: channelCounts.whatsapp, phone: channelCounts.phone }}
        testId="leads-channel-filter"
        shortLabels
      />
    </>
  );
}
