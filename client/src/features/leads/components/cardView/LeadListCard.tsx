// LeadListCard extracted from LeadsCardView.tsx
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Phone, Mail, MessageSquare, Building2, Tag as TagIcon, Pencil, Trash2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { resolveColor } from "@/features/tags/types";
import { getLeadStatusAvatarColor as getStatusAvatarColor } from "@/lib/avatarUtils";

import { PIPELINE_HEX } from "./constants";
import { getLeadId, getFullName, getScore, getStatus, getPhone } from "./leadUtils";
import { formatRelativeTime } from "./formatUtils";
import { ListScoreRing } from "./atoms";

// ── Lead list card ─────────────────────────────────────────────────────────────
const TRAY_WIDTH = 220;
// Scoring/sentiment tags are useful in the detail panel but add noise on compact cards
const CARD_EXCLUDED_TAGS = new Set(["Positive Sentiment", "Negative Sentiment", "Coaching Interest", "Responded"]); // Swipe-left action tray width in px (Feature #41)

export function LeadListCard({
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
}: {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  leadTags: { name: string; color: string }[];
  showContactAlways?: boolean;
  tagsColorful?: boolean;
  hideTags?: boolean;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
  /** Swipe right navigates here — navigates to Chats tab with this lead selected */
  onOpenConversation?: () => void;
  /** Swipe left quick actions (Feature #41) */
  onQuickChangeStatus?: () => void;
  onQuickAddNote?: () => void;
  onQuickDelete?: () => void;
}) {
  const { t } = useTranslation("leads");
  const { isDark } = useTheme();
  const name        = getFullName(lead);
  const status      = getStatus(lead);
  const score       = getScore(lead);
  const phone       = getPhone(lead);
  const email       = lead.email || lead.Email || "";
  const avatarColor = getStatusAvatarColor(status);
  const statusHex   = PIPELINE_HEX[status] || "#6B7280";
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const visibleTags = leadTags.filter(t => !CARD_EXCLUDED_TAGS.has(t.name)).slice(0, 3);
  const cId = Number(lead.Campaigns_id || lead.campaigns_id || lead.campaignsId || 0);
  const campaignName = lead.Campaign || lead.campaign || lead.campaign_name || (cId && campaignsById?.get(cId)?.name) || "";
  const bookedCallDate = lead.booked_call_date || lead.bookedCallDate || null;
  const isPastCall = status === "Booked" && !!bookedCallDate && new Date(bookedCallDate) < new Date();

  // ── Swipe gestures: right → inbox, left → quick actions tray ────────────────
  const cardWrapRef     = useRef<HTMLDivElement>(null);
  const [swipeX, setSwipeX]               = useState(0);   // right swipe (0–90px)
  const [swipeLeft, setSwipeLeft]         = useState(0);   // left swipe  (0–TRAY_WIDTH)
  const [trayOpen, setTrayOpen]           = useState(false);
  const [isReleasing, setIsReleasing]     = useState(false);
  const [isReleasingLeft, setIsReleasingLeft] = useState(false);
  const [leftFlash, setLeftFlash]         = useState(false);
  // Refs so touch handlers see latest values without stale closure
  const trayOpenRef   = useRef(false);
  const swipeLeftRef  = useRef(0);
  const swipeTouchRef = useRef<{
    startX: number; startY: number;
    isHorizontal: boolean | null;
  } | null>(null);

  // Keep refs in sync
  useEffect(() => { trayOpenRef.current  = trayOpen;  }, [trayOpen]);
  useEffect(() => { swipeLeftRef.current = swipeLeft; }, [swipeLeft]);

  // Close tray when clicking outside the card (Feature #41)
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
        // Tray is open — right swipe to close
        if (dx > 0) {
          e.preventDefault();
          const next = Math.max(0, TRAY_WIDTH - dx);
          setSwipeLeft(next);
          swipeLeftRef.current = next;
        }
        return;
      }

      if (dx > 0) {
        // Right swipe → inbox reveal
        e.preventDefault();
        setSwipeX(Math.min(dx * 0.55, 90));
      } else if (dx < 0) {
        // Left swipe → reveal action tray
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
        // Tray was open — decide to close or stay open
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
        // Right swipe end
        const cardWidth = el.offsetWidth || 350;
        setIsReleasing(true);
        setSwipeX(0);
        if (dx >= cardWidth * 0.4 && onOpenConversation) {
          setTimeout(onOpenConversation, 120);
        }
      } else {
        // Left swipe end — snap open or close tray
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

  // Icon opacities
  const inboxIconOpacity = Math.min(swipeX / 45, 1);
  const trayIconOpacity  = Math.min(swipeLeft / (TRAY_WIDTH * 0.5), 1);
  // How many tray buttons: 4 if phone, 3 otherwise
  const trayButtonCount  = phone ? 4 : 3;
  const trayBtnW         = Math.floor(TRAY_WIDTH / trayButtonCount);

  return (
    <div
      ref={cardWrapRef}
      className="relative overflow-hidden rounded-xl max-md:rounded-[1.5rem]"
      data-testid={`swipe-card-${getLeadId(lead)}`}
    >
      {/* Inbox icon revealed behind card as it slides right (Feature #40) */}
      <div
        className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
        style={{ opacity: inboxIconOpacity }}
        aria-hidden="true"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-indigo/15">
          <MessageSquare className="h-4 w-4 text-brand-indigo" />
        </div>
      </div>

      {/* Action tray revealed behind card on left swipe (Feature #41) */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch overflow-hidden"
        style={{ width: TRAY_WIDTH, opacity: trayIconOpacity }}
        aria-hidden={!trayOpen}
      >
        {/* Change Status */}
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
        {/* Add Note */}
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
        {/* Call — only if lead has a phone number */}
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
        {/* Delete */}
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

      {/* Card — translates horizontally on swipe (right → inbox, left → tray) */}
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

        {/* Main layout: [avatar + text] on left, [date + score] column on right */}
        <div className="flex items-stretch gap-2">
          <EntityAvatar
            name={name}
            bgColor={avatarColor.bg}
            textColor={avatarColor.text}
            className={cn("self-start mt-0.5 shrink-0", isPastCall && "opacity-40 grayscale")}
          />

          {/* Left: name + status */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
              {name}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", (status === "New" || status === "Responded" || status === "Multiple Responses") && "animate-status-pulse")} style={{ backgroundColor: statusHex, color: statusHex }} />
              <span className="text-[10px] text-muted-foreground/65 truncate">{t(`kanban.stageLabels.${status.replace(/ /g, "")}`, status)}</span>
            </div>

            {/* Tags + contact — collapses when hideTags, expands on hover */}
            <div className={cn(
              "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
              hideTags
                ? "max-h-0 opacity-0 group-hover/card:max-h-24 group-hover/card:opacity-100"
                : "max-h-24 opacity-100"
            )}>
              {visibleTags.length > 0 && (
                <div className="relative z-10 flex items-center gap-1 flex-wrap mt-1">
                  {visibleTags.map((t) => {
                    const hex = resolveColor(t.color);
                    return (
                      <span
                        key={t.name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={tagsColorful
                          ? { backgroundColor: `${hex}20`, color: hex }
                          : isDark
                            ? { backgroundColor: isActive ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                            : { backgroundColor: isActive ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)", color: "rgba(0,0,0,0.45)" }
                        }
                      >
                        {t.name}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-200 ease-out max-md:hidden",
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

          {/* Right column: date on top, score ring on bottom */}
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

      {/* ── Mobile-only footer: campaign + last activity ── */}
      <div className="lg:hidden px-3 pb-3 pt-0 flex flex-col gap-1.5">
        {campaignName && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
            <span className="inline-flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{campaignName}</span>
            </span>
          </div>
        )}
      </div>

      </div>
    </div>
  );
}

