/**
 * LeadCard.tsx — individual lead card renderer for the list view.
 * Extracted from LeadsCardView.tsx to reduce file size.
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import {
  Phone, Mail, Building2, MessageSquare, AlertTriangle,
  Tag as TagIcon, Pencil, Trash2,
} from "lucide-react";
import { resolveColor } from "@/features/tags/types";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import {
  getLeadId,
  getFullName,
  getStatus,
  getScore,
  ListScoreRing,
  PIPELINE_HEX,
} from "./LeadsCardView";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";

// ── Status colour map (must stay in sync with LeadsCardView) ──────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; badge: string }> = {
  New:                  { bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-400",    dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  Contacted:            { bg: "bg-indigo-500/10",  text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500",  badge: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800" },
  Responded:            { bg: "bg-violet-500/10",  text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500",  badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" },
  "Multiple Responses": { bg: "bg-purple-500/10",  text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
  Qualified:            { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400",dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  Booked:               { bg: "bg-amber-400/15",   text: "text-amber-700 dark:text-amber-400",  dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  Closed:               { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400",dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  Lost:                 { bg: "bg-red-500/10",     text: "text-red-700 dark:text-red-400",      dot: "bg-red-500",     badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  DND:                  { bg: "bg-zinc-500/10",    text: "text-zinc-600 dark:text-zinc-400",    dot: "bg-zinc-500",    badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700" },
};

function getPhone(lead: Record<string, any>): string {
  return lead.phone || lead.Phone || "";
}

function formatRelativeTime(dateStr: string | null | undefined, t: (key: string, opts?: Record<string, any>) => string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    if (diffMs <= 0) return t("relativeTime.justNow");
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return t("relativeTime.justNow");
    if (diffMins < 60) return t("relativeTime.minutesAgo", { count: diffMins });
    const h = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return t("relativeTime.hoursAgo", { count: h });
    if (diffDays === 1) return t("relativeTime.yesterday");
    if (diffDays < 7) return t("relativeTime.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("relativeTime.weeksAgo", { count: Math.floor(diffDays / 7) });
    return t("relativeTime.monthsAgo", { count: Math.floor(diffDays / 30) });
  } catch { return ""; }
}

const TRAY_WIDTH = 220;

export interface LeadCardProps {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  leadTags: { name: string; color: string }[];
  showContactAlways?: boolean;
  tagsColorful?: boolean;
  hideTags?: boolean;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
  onOpenConversation?: () => void;
  onQuickChangeStatus?: () => void;
  onQuickAddNote?: () => void;
  onQuickDelete?: () => void;
}

/**
 * LeadCard — renders a single lead as a card in the list view.
 * Supports touch swipe gestures: right to open conversation, left to reveal quick actions.
 */
export function LeadCard({
  lead,
  isActive,
  onClick,
  leadTags,
  showContactAlways = false,
  tagsColorful = false,
  hideTags = false,
  campaignsById,
  onOpenConversation,
  onQuickChangeStatus,
  onQuickAddNote,
  onQuickDelete,
}: LeadCardProps) {
  const { t } = useTranslation("leads");
  const { isDark } = useTheme();
  const name         = getFullName(lead);
  const status       = getStatus(lead);
  const score        = getScore(lead);
  const phone        = getPhone(lead);
  const email        = lead.email || lead.Email || "";
  const avatarColor  = getLeadStatusAvatarColor(status);
  const statusHex    = PIPELINE_HEX[status] || "#6B7280";
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const visibleTags  = leadTags.slice(0, 3);
  const statusColors = STATUS_COLORS[status] ?? { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-600 border-zinc-200" };
  const cId = Number(lead.Campaigns_id || lead.campaigns_id || lead.campaignsId || 0);
  const campaignName = lead.Campaign || lead.campaign || lead.campaign_name || (cId && campaignsById?.get(cId)?.name) || "";
  const partialPhone = phone ? (phone.length > 9 ? phone.slice(0, 6) + "…" + phone.slice(-3) : phone) : "";
  const bookedCallDate = lead.booked_call_date || lead.bookedCallDate || null;
  const isPastCall = status === "Booked" && !!bookedCallDate && new Date(bookedCallDate) < new Date();

  const cardWrapRef         = useRef<HTMLDivElement>(null);
  const [swipeX, setSwipeX]               = useState(0);
  const [swipeLeft, setSwipeLeft]         = useState(0);
  const [trayOpen, setTrayOpen]           = useState(false);
  const [isReleasing, setIsReleasing]     = useState(false);
  const [isReleasingLeft, setIsReleasingLeft] = useState(false);
  const [leftFlash, setLeftFlash]         = useState(false);
  const trayOpenRef   = useRef(false);
  const swipeLeftRef  = useRef(0);
  const swipeTouchRef = useRef<{
    startX: number; startY: number;
    isHorizontal: boolean | null;
  } | null>(null);

  useEffect(() => { trayOpenRef.current  = trayOpen;  }, [trayOpen]);
  useEffect(() => { swipeLeftRef.current = swipeLeft; }, [swipeLeft]);

  useEffect(() => {
    if (!trayOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const el = cardWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setIsReleasingLeft(true);
        setTrayOpen(false);
        setSwipeLeft(0);
        swipeLeftRef.current  = 0;
        trayOpenRef.current   = false;
      }
    };
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [trayOpen]);

  const closeTray = () => {
    setIsReleasingLeft(true);
    setTrayOpen(false);
    setSwipeLeft(0);
    swipeLeftRef.current = 0;
    trayOpenRef.current  = false;
  };

  useEffect(() => {
    const el = cardWrapRef.current;
    if (!el) return;

    const handleStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      swipeTouchRef.current = { startX: touch.clientX, startY: touch.clientY, isHorizontal: null };
      setIsReleasing(false);
      setIsReleasingLeft(false);
    };

    const handleMove = (e: TouchEvent) => {
      const s = swipeTouchRef.current;
      if (!s) return;
      const touch = e.touches[0];
      const dx    = touch.clientX - s.startX;
      const dy    = touch.clientY - s.startY;

      if (s.isHorizontal === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!s.isHorizontal) return;

      if (trayOpenRef.current) {
        if (dx > 0) {
          e.preventDefault();
          const next = Math.max(0, TRAY_WIDTH - dx);
          setSwipeLeft(next);
          swipeLeftRef.current = next;
        }
        return;
      }

      if (dx > 0) {
        e.preventDefault();
        setSwipeX(Math.min(dx * 0.55, 90));
      } else if (dx < 0) {
        e.preventDefault();
        const next = Math.min(-dx * 0.85, TRAY_WIDTH);
        setSwipeLeft(next);
        swipeLeftRef.current = next;
      }
    };

    const handleEnd = (e: TouchEvent) => {
      const s = swipeTouchRef.current;
      swipeTouchRef.current = null;
      if (!s || s.isHorizontal !== true) return;

      const dx = e.changedTouches[0].clientX - s.startX;

      if (trayOpenRef.current) {
        setIsReleasingLeft(true);
        if (dx > TRAY_WIDTH * 0.3) {
          setTrayOpen(false);
          setSwipeLeft(0);
          swipeLeftRef.current = 0;
          trayOpenRef.current  = false;
        } else {
          setSwipeLeft(TRAY_WIDTH);
          swipeLeftRef.current = TRAY_WIDTH;
        }
        return;
      }

      if (dx > 0) {
        const cardWidth = el.offsetWidth || 350;
        setIsReleasing(true);
        setSwipeX(0);
        if (dx >= cardWidth * 0.4 && onOpenConversation) {
          setTimeout(onOpenConversation, 120);
        }
      } else {
        setIsReleasingLeft(true);
        if (swipeLeftRef.current > TRAY_WIDTH * 0.35) {
          setTrayOpen(true);
          trayOpenRef.current  = true;
          setSwipeLeft(TRAY_WIDTH);
          swipeLeftRef.current = TRAY_WIDTH;
        } else if (dx < -10) {
          setLeftFlash(true);
          setTimeout(() => setLeftFlash(false), 300);
          setSwipeLeft(0);
          swipeLeftRef.current = 0;
        } else {
          setSwipeLeft(0);
          swipeLeftRef.current = 0;
        }
      }
    };

    el.addEventListener("touchstart",  handleStart, { passive: true  });
    el.addEventListener("touchmove",   handleMove,  { passive: false });
    el.addEventListener("touchend",    handleEnd,   { passive: true  });
    el.addEventListener("touchcancel", handleEnd,   { passive: true  });
    return () => {
      el.removeEventListener("touchstart",  handleStart);
      el.removeEventListener("touchmove",   handleMove);
      el.removeEventListener("touchend",    handleEnd);
      el.removeEventListener("touchcancel", handleEnd);
    };
  }, [onOpenConversation]);

  const inboxIconOpacity = Math.min(swipeX / 45, 1);
  const trayIconOpacity  = Math.min(swipeLeft / (TRAY_WIDTH * 0.5), 1);
  const trayButtonCount  = phone ? 4 : 3;
  const trayBtnW         = Math.floor(TRAY_WIDTH / trayButtonCount);

  return (
    <div
      ref={cardWrapRef}
      className="relative overflow-hidden rounded-xl max-md:rounded-[1.5rem]"
      data-testid={`swipe-card-${getLeadId(lead)}`}
    >
      {/* Inbox icon revealed on right swipe */}
      <div
        className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
        style={{ opacity: inboxIconOpacity }}
        aria-hidden="true"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-indigo/15">
          <MessageSquare className="h-4 w-4 text-brand-indigo" />
        </div>
      </div>

      {/* Action tray revealed on left swipe */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch overflow-hidden"
        style={{ width: TRAY_WIDTH, opacity: trayIconOpacity }}
        aria-hidden={!trayOpen}
      >
        <button
          className="flex flex-col items-center justify-center gap-1 bg-brand-indigo text-white min-h-[44px] active:brightness-90"
          style={{ width: trayBtnW }}
          onClick={(e) => { e.stopPropagation(); onQuickChangeStatus?.(); closeTray(); }}
          data-testid="quick-action-change-status"
          aria-label="Change Status"
        >
          <TagIcon className="h-5 w-5" />
          <span className="text-[10px] font-semibold leading-none">Status</span>
        </button>
        <button
          className="flex flex-col items-center justify-center gap-1 bg-amber-500 text-white min-h-[44px] active:brightness-90"
          style={{ width: trayBtnW }}
          onClick={(e) => { e.stopPropagation(); onQuickAddNote?.(); closeTray(); }}
          data-testid="quick-action-add-note"
          aria-label="Add Note"
        >
          <Pencil className="h-5 w-5" />
          <span className="text-[10px] font-semibold leading-none">Note</span>
        </button>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex flex-col items-center justify-center gap-1 bg-emerald-500 text-white min-h-[44px] active:brightness-90"
            style={{ width: trayBtnW }}
            onClick={(e) => { e.stopPropagation(); closeTray(); }}
            data-testid="quick-action-call"
            aria-label="Call"
          >
            <Phone className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-none">Call</span>
          </a>
        )}
        <button
          className="flex flex-col items-center justify-center gap-1 bg-red-500 text-white min-h-[44px] active:brightness-90"
          style={{ width: trayBtnW }}
          onClick={(e) => { e.stopPropagation(); onQuickDelete?.(); closeTray(); }}
          data-testid="quick-action-delete"
          aria-label="Delete Lead"
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[10px] font-semibold leading-none">Delete</span>
        </button>
      </div>

      {/* Card body */}
      <div
        className={cn(
          "relative group/card cursor-pointer transition-colors",
          isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
          leftFlash && "bg-muted/60"
        )}
        style={{
          transform: `translateX(${swipeX - swipeLeft}px)`,
          transition: (isReleasing || isReleasingLeft) ? "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
          zIndex: 1,
        }}
        onClick={trayOpen ? (e) => { e.stopPropagation(); closeTray(); } : onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") { if (trayOpen) closeTray(); else onClick(); } }}
        data-swipe-x={swipeX > 0 ? swipeX : undefined}
      >
        <div className={cn("px-2.5 flex flex-col gap-0.5", hideTags ? "pt-1.5 pb-1" : "pt-2 pb-1.5")}>

          <div className="flex items-stretch gap-2">
            <EntityAvatar
              name={name}
              bgColor={avatarColor.bg}
              textColor={avatarColor.text}
              className={cn("self-start mt-0.5 shrink-0", isPastCall && "opacity-40 grayscale")}
            />

            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
                {name}
              </p>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                <span
                  className={cn("h-1.5 w-1.5 rounded-full shrink-0", (status === "New" || status === "Responded" || status === "Multiple Responses") && "animate-status-pulse")}
                  style={{ backgroundColor: statusHex, color: statusHex }}
                />
                <span className="text-[10px] text-muted-foreground/65 truncate">{t(`kanban.stageLabels.${status.replace(/ /g, "")}`, status)}</span>
              </div>

              <div className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                hideTags
                  ? "max-h-0 opacity-0 group-hover/card:max-h-24 group-hover/card:opacity-100"
                  : "max-h-24 opacity-100"
              )}>
                {visibleTags.length > 0 && (
                  <div className="relative z-10 flex items-center gap-1 flex-wrap mt-1">
                    {visibleTags.map((tg) => {
                      const hex = resolveColor(tg.color);
                      return (
                        <span
                          key={tg.name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={tagsColorful
                            ? { backgroundColor: `${hex}20`, color: hex }
                            : isDark
                              ? { backgroundColor: isActive ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                              : { backgroundColor: isActive ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)", color: "rgba(0,0,0,0.45)" }
                          }
                        >
                          {tg.name}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className={cn(
                  "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                  showContactAlways
                    ? "max-h-12 opacity-100"
                    : "max-h-0 opacity-0 group-hover/card:max-h-12 group-hover/card:opacity-100"
                )}>
                  {(phone || email) && (
                    <div className="pt-1 pb-0.5 flex items-center gap-2.5 text-[10px] text-muted-foreground/70">
                      {phone && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Phone className="h-3 w-3 shrink-0" />
                          {phone}
                        </span>
                      )}
                      {email && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          {email}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(lastActivity || score > 0) && (
              <div className="shrink-0 flex flex-col items-end justify-between">
                {lastActivity && (
                  <span className="text-[10px] tabular-nums leading-none text-muted-foreground/60 pt-0.5">
                    {formatRelativeTime(lastActivity, t)}
                  </span>
                )}
                {score > 0 && (
                  <div className="mt-auto pt-1">
                    <ListScoreRing score={score} status={status} isActive={isActive} lead={lead} />
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Mobile-only footer */}
        <div className="lg:hidden px-3 pb-3 pt-0 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0",
                statusColors.badge
              )}>
                {t(`kanban.stageLabels.${status.replace(/ /g, "")}`, status)}
              </span>
              {isPastCall && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/40 shrink-0">
                  Past
                </span>
              )}
            </div>
            {lastActivity && (
              <span className="text-[11px] tabular-nums text-muted-foreground/60 shrink-0">
                {formatRelativeTime(lastActivity, t)}
              </span>
            )}
          </div>
          {isPastCall && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickChangeStatus?.(); }}
              className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 active:bg-amber-400/30 transition-colors"
              data-testid="past-call-follow-up"
            >
              <AlertTriangle className="h-3 w-3" />
              Follow Up?
            </button>
          )}
          {(partialPhone || campaignName) && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
              {partialPhone && (
                <span className="inline-flex items-center gap-1 shrink-0">
                  <Phone className="h-3 w-3 shrink-0" />
                  {partialPhone}
                </span>
              )}
              {campaignName && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{campaignName}</span>
                </span>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Backward-compat alias (LeadsCardView used to export LeadListCard by this internal name)
export { LeadCard as LeadListCard };
