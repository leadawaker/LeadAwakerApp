// LeadListCard extracted from LeadsCardView.tsx
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useDeleteAction } from "@/hooks/useDeleteAction";
import { Phone, Mail, MessageSquare, Tag as TagIcon, Pencil, Trash2, Check } from "lucide-react";

import { PIPELINE_HEX } from "./constants";
import { getLeadId, getFullName, getInitials, getScore, getStatus, getPhone, getLastMessage, getLastMessageSender, getUnreadCount } from "./leadUtils";
import { formatRelativeTime } from "./formatUtils";
import { ScoreArcDonut } from "./atoms";

// ── Lead list card ─────────────────────────────────────────────────────────────
const TRAY_WIDTH = 220;

export function LeadListCard({
  lead,
  isActive,
  onClick,
  leadTags: _leadTags,
  campaignsById,
  showPeek = false,
  onOpenConversation,
  onQuickChangeStatus,
  onQuickAddNote,
  onQuickDelete,
  selected = false,
  onToggleSelect,
}: {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  leadTags: { name: string; color: string }[];
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
  /** When true, render the lead's last message as a chat-peek bubble under the card (Feature A) */
  showPeek?: boolean;
  /** Swipe right navigates here — navigates to Chats tab with this lead selected */
  onOpenConversation?: () => void;
  /** Swipe left quick actions (Feature #41) */
  onQuickChangeStatus?: () => void;
  onQuickAddNote?: () => void;
  onQuickDelete?: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useTranslation("leads");
  const { label: deleteLabel } = useDeleteAction("lead");
  const name        = getFullName(lead);
  const status      = getStatus(lead);
  const score       = getScore(lead);
  const phone       = getPhone(lead);
  const email       = lead.email || lead.Email || "";
  const statusHex   = PIPELINE_HEX[status] || "#6B7280";
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const cId = Number(lead.Campaigns_id || lead.campaigns_id || lead.campaignsId || 0);
  const campaignName = lead.Campaign || lead.campaign || lead.campaign_name || (cId && campaignsById?.get(cId)?.name) || "";
  const bookedCallDate = lead.booked_call_date || lead.bookedCallDate || null;
  const isPastCall = status === "Booked" && !!bookedCallDate && new Date(bookedCallDate) < new Date();
  const isDemo = (lead.source || lead.Source) === "WhatsApp Demo" ||
    (lead.channel_identifier || lead.channelIdentifier || "").startsWith("wa-demo:");

  // ── Chat peek (Feature A): last message under the row when showPeek is on ──
  const peekText   = getLastMessage(lead);
  const peekSender = getLastMessageSender(lead);   // "" = inbound (from lead), "AI" = outbound
  const peekIsInbound = peekSender === "";

  // ── Unread badge: count of unread inbound messages on the lead's avatar ──
  const unreadCount = getUnreadCount(lead);

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
      className="relative overflow-hidden rounded-[var(--list-card-radius)] max-md:rounded-[var(--list-card-radius-mobile)]"
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
          <span className="text-[10px] font-semibold leading-none">{deleteLabel}</span>
        </button>
      </div>

      {/* Card — translates horizontally on swipe (right → inbox, left → tray) */}
      <div
        className={cn("la-camp-card group/card", isActive && "active", leftFlash && "bg-muted/60")}
        style={{
          alignItems: 'flex-start',
          transform: `translateX(${swipeX - swipeLeft}px)`,
          transition: (isReleasing || isReleasingLeft) ? "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
          zIndex: 1,
        }}
        onClick={trayOpen ? (e: React.MouseEvent) => { e.stopPropagation(); closeTray(); } : onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") { if (trayOpen) closeTray(); else onClick(); } }}
        data-swipe-x={swipeX > 0 ? swipeX : undefined}
      >
        {/* Checkbox — vertically centered against the 36px avatar */}
        <div className="shrink-0 flex items-center" style={{ height: 36 }}>
          <button
            className="flex items-center justify-center rounded-[5px] transition-colors"
            style={{
              width: 18,
              height: 18,
              background: selected ? 'var(--wine)' : 'transparent',
              border: selected ? '1.5px solid var(--wine)' : '1.5px solid var(--line-strong)',
              color: '#FFFFFF',
            }}
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
            aria-label={selected ? "Deselect" : "Select"}
          >
            {selected && <Check className="h-3 w-3" />}
          </button>
        </div>

        {/* Stage-colored avatar (with unread badge) */}
        <div className="shrink-0 relative" style={{ width: 36, height: 36 }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--r-surface)',
              background: statusHex,
              color: '#FFFFFF',
              fontFamily: "'Geist Mono', ui-monospace, monospace",
              fontSize: 14,
              fontWeight: 700,
              opacity: isPastCall ? 0.4 : 1,
            }}
          >
            {getInitials(name)}
          </div>
          {unreadCount > 0 && (
            <span
              className="absolute flex items-center justify-center"
              style={{
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 9999,
                background: 'var(--wine)',
                color: '#FFFFFF',
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1,
                boxShadow: '0 0 0 2px var(--bg)',
              }}
              aria-label={`${unreadCount} unread`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: "var(--ink)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span className="truncate">{name}</span>
            {isDemo && (
              <span className="shrink-0" style={{
                fontSize: 9, fontWeight: 700, color: 'var(--wine)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                lineHeight: 1,
              }}>demo</span>
            )}
          </div>

          {/* Stage + campaign — single line, matches the design leads page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusHex, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t(`kanban.stageLabels.${status.replace(/ /g, "")}`, status)}{campaignName ? ` · ${campaignName}` : ''}
            </span>
          </div>

          {/* Contact info — revealed on hover */}
          <div className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out max-h-24 opacity-100">
            <div className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out max-md:hidden max-h-0 opacity-0 group-hover/card:max-h-12 group-hover/card:opacity-100">
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

        {/* Right column: date + score donut */}
        <div className="shrink-0 flex flex-col items-end gap-1.5" style={{ paddingTop: 1 }}>
          {lastActivity && (
            <span className="text-[10px] tabular-nums leading-none text-muted-foreground/60">
              {formatRelativeTime(lastActivity, t)}
            </span>
          )}
          {score > 0 && <ScoreArcDonut score={score} />}
        </div>

      </div>

      {/* ── Chat peek (Feature A) — single-line last-message snippet under the row ── */}
      {showPeek && peekText && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '0 12px 8px 56px' }}>
          <span
            style={{
              fontFamily: "'Geist Mono', ui-monospace, monospace",
              fontSize: 7.5,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: peekIsInbound ? 'var(--good)' : 'var(--wine)',
              background: peekIsInbound ? 'var(--good-tint)' : 'var(--wine-tint)',
              borderRadius: 'var(--r-pill)',
              padding: '2px 7px',
              flexShrink: 0,
              maxWidth: 78,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {peekIsInbound ? (name.split(/\s+/)[0] || name) : 'AI'}
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--ink-soft)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {peekText}
          </span>
        </div>
      )}

    </div>
  );
}
