// LeadListCard extracted from LeadsCardView.tsx
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { LEAD_AVATAR_BG_DARK, LEAD_AVATAR_TEXT_DARK } from "@/lib/avatarUtils";
import { useDeleteAction } from "@/hooks/useDeleteAction";
import { Phone, Mail, MessageSquare, Tag as TagIcon, Pencil, Trash2, Check, Clock, RefreshCw } from "lucide-react";

import { PIPELINE_HEX } from "./constants";
import { getLeadId, getFullName, getInitials, getStatus, getPhone, getLastMessage, getLastMessageSender, getUnreadCount } from "./leadUtils";
import { displayStage, stageHex, stageColorKey, stageLabel, lastContactChannel, lastContactAt } from "../../lib/leadDisplay";
import { ChannelGlyph } from "./ChannelGlyph";
import { getConversationType } from "../conversationType";
import { formatRelativeTime } from "./formatUtils";
import { isDemoLead } from "@/features/leads/demoLead";
import { useWorkspace } from "@/hooks/useWorkspace";
import { NeedsYouMarker, personStageFromKey, StatusPill } from "@/components/crm/status/StatusPill";
import { presentName, presentNumber, presentText, useChatsPresenting } from "../../presenting";

// ── Lead list card ─────────────────────────────────────────────────────────────
const TRAY_WIDTH = 220;

// Inbound-source attribution labels (speed-to-lead). Brand/source names, not
// translatable. Only recognized inbound sources surface a chip, so reactivation
// and imported leads stay visually unchanged.
const SOURCE_LABELS: Record<string, string> = {
  facebook_lead_ads: "Facebook",
  instagram_dm: "Instagram",
  website_form: "Web form",
  gohighlevel: "GoHighLevel",
  hubspot: "HubSpot",
};

export function LeadListCard({
  lead,
  isActive,
  onClick,
  leadTags,
  campaignsById,
  showPeek = false,
  showChannelBadge = false,
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
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null; campaignType?: string | null }>;
  /** When true, render the lead's last message as a chat-peek bubble under the card (Feature A) */
  showPeek?: boolean;
  /** Chats with both channels on: website / WhatsApp badge on the avatar. */
  showChannelBadge?: boolean;
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
  const { isDark } = useTheme();
  const { label: deleteLabel } = useDeleteAction("lead");
  // Presenting (Owner, Chats): the card shows masked names and numbers.
  const { masked }  = useChatsPresenting();
  const name        = presentName(getFullName(lead), masked);
  const status      = getStatus(lead);
  // Receptionist leads show their simpler stage (New inquiry / Answered / Booked / Done).
  const stage       = displayStage(lead);
  // One stage pill per person (receptionist vocabulary) and "Needs you" while a chat waits on a reply.
  const personStage = personStageFromKey(lead.stage_key);
  const needsYou    = !!lead.needs_reply;
  const { isAgencyUser } = useWorkspace();
  const phone       = getPhone(lead);
  const shownPhone  = phone ? presentNumber(phone, masked) : "";
  const email       = lead.email || lead.Email || "";
  const statusHex   = stageHex(stage);
  // Night-mode-friendly avatar: muted dark bg + light initials in dark mode,
  // keeping the solid saturated look untouched in light mode.
  const avatarBg    = isDark ? (LEAD_AVATAR_BG_DARK[stageColorKey(stage)] ?? "#2A2D33") : statusHex;
  const avatarText  = isDark ? (LEAD_AVATAR_TEXT_DARK[stageColorKey(stage)] ?? "#9CA3AF") : "#FFFFFF";
  const lastActivity = lastContactAt(lead);
  const contactChannel = lastContactChannel(lead);
  // Contact-later leads sit at a normal pipeline stage but are frozen until a
  // date the lead themselves named. Without this the card is indistinguishable
  // from an actively-bumped lead. Gated on the tag, not on next_action_at
  // alone: every active lead has a next_action_at (its next bump).
  const isContactLater = (leadTags || []).some((tg) => tg.name === "Contact Later");
  const resumeRaw = lead.next_action_at || lead.nextActionAt || null;
  const resumeDate = isContactLater && resumeRaw
    ? new Date(resumeRaw).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  const cId = Number(lead.Campaigns_id || lead.campaigns_id || lead.campaignsId || 0);
  const campaignName = lead.Campaign || lead.campaign || lead.campaign_name || (cId && campaignsById?.get(cId)?.name) || "";
  const bookedCallDate = lead.booked_call_date || lead.bookedCallDate || null;
  const isPastCall = status === "Booked" && !!bookedCallDate && new Date(bookedCallDate) < new Date();
  const isDemo = isDemoLead(lead);
  // Reactivation chats (conversation type "dbr", minus the speed-to-lead quotes that share the bucket).
  const campaignType = String(lead.campaign_type ?? (cId && campaignsById?.get(cId)?.campaignType) ?? "");
  // Conversation type only: the server's conv type when present, else the client-side derivation.
  const isReactivation = (lead.conversation_type ?? getConversationType(lead, campaignsById)) === "dbr" && campaignType !== "speed_to_lead";
  const sourceRaw   = String(lead.source || lead.Source || "");
  const sourceLabel = isDemo ? "" : (SOURCE_LABELS[sourceRaw] || (sourceRaw.startsWith("zapier:") ? "Zapier" : ""));

  // ── Chat peek (Feature A): last message under the row when showPeek is on ──
  const peekText   = presentText(getLastMessage(lead), getFullName(lead), masked);
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
      // overflow-x-clip: the swipe gesture only needs horizontal clipping. Not overflow-x-hidden,
      // which forces overflow-y to auto and so crops anything that pokes out above or below
      // (button highlights, focus rings). The lift lives in .la-lead-swipe (components.css).
      className={cn("la-lead-swipe relative overflow-x-clip", isActive && "is-active")}
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
          padding: '12px 14px',
          alignItems: 'center',
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
          {/* Stage-colored avatar (click to toggle selection) */}
        {/* 46px on phones/tablet, 40px on desktop (lg+) rows. */}
        <div
          className="shrink-0 relative w-[46px] h-[46px] lg:w-10 lg:h-10"
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
          role="checkbox"
          aria-checked={selected}
          aria-label={selected ? "Deselect" : "Select"}
        >
          <div
            className="flex items-center justify-center w-full h-full text-[16px]"
            style={{
              borderRadius: 13,
              background: selected ? 'var(--card)' : avatarBg,
              color: selected ? 'var(--wine)' : avatarText,
              border: selected ? '2px solid var(--wine)' : 'none',
              boxShadow: 'var(--sh-raised-crisp)',
              fontFamily: "var(--mono)",
              fontWeight: 700,
              opacity: isPastCall ? 0.4 : 1,
            }}
          >
            {selected ? <Check className="h-[18px] w-[18px]" /> : getInitials(name)}
          </div>
          {showChannelBadge && !selected && (lead.chat_channel === "website" || lead.chat_channel === "whatsapp") && (
            <span
              className="absolute flex items-center justify-center"
              data-testid="lead-channel-badge"
              title={t(`leadChannel.${lead.chat_channel}`)}
              style={{ bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9999, background: 'var(--card)', boxShadow: '0 0 0 1.5px var(--bg)' }}
            >
              <ChannelGlyph channel={lead.chat_channel} size={11} />
            </span>
          )}
        </div>

        {/* Body, WhatsApp-like: name | time, then preview (or campaign) | stage tag */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: name + badges | channel + last contact time */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <div className="text-[15.5px] max-md:text-[16px]" style={{
              fontFamily: 'var(--sans)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.005em', lineHeight: 1.25,
              minWidth: 0, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span className="truncate">{name}</span>
              {/* Compact badges, so the name keeps the room: a small DEMO tag and an icon-only Reactivation mark. */}
              {isDemo && (
                <span className="shrink-0" style={{
                  fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, color: 'var(--wine)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1,
                }}>demo</span>
              )}
              {isReactivation && (
                <span
                  className="shrink-0 inline-flex items-center justify-center"
                  data-testid="lead-reactivation-badge"
                  role="img"
                  aria-label={t("conversationType.reactivationBadge")}
                  title={t("conversationType.reactivationBadge")}
                  style={{ width: 18, height: 18, borderRadius: 'var(--r-pill)', color: 'var(--wine)', background: 'var(--wine-tint)', alignSelf: 'center' }}
                >
                  <RefreshCw size={10} strokeWidth={2.4} aria-hidden="true" />
                </span>
              )}
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5" style={{ alignSelf: 'center' }}>
              {contactChannel && (
                <span title={t(`leadChannel.${contactChannel}`)} className="inline-flex"><ChannelGlyph channel={contactChannel} size={12} /></span>
              )}
              {lastActivity && (
                <span className="text-[12px] tabular-nums leading-none" style={{ color: unreadCount > 0 ? 'var(--wine)' : 'var(--mute-2)', fontWeight: unreadCount > 0 ? 700 : 400 }}>
                  {formatRelativeTime(lastActivity, t)}
                </span>
              )}
            </span>
          </div>

          {/* Row 2: last message (chat peek on) or campaign / source / number | stage + unread */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
            <span className="text-[13.5px] max-md:text-[14px] truncate" style={{ flex: 1, minWidth: 0, color: 'var(--mute)', lineHeight: 1.4 }}>
              {showPeek && peekText ? (
                <>
                  {!peekIsInbound && <span style={{ color: 'var(--wine)', fontWeight: 600 }}>{`${t("conversationType.aiPrefix")}: `}</span>}
                  {peekText}
                </>
              ) : (
                <>
                  {!personStage && stageLabel(t, stage)}
                  {isAgencyUser && campaignName ? `${personStage ? '' : ' · '}${campaignName}` : ''}
                  {isAgencyUser && sourceLabel ? `${(campaignName || !personStage) ? ' · ' : ''}${sourceLabel}` : ''}
                  {(personStage && !(isAgencyUser && (campaignName || sourceLabel))) ? shownPhone : ''}
                </>
              )}
            </span>
            <span className="shrink-0 inline-flex items-center" style={{ gap: 6 }}>
              {resumeDate && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0"
                  title={t("tags.resumesOn", { date: resumeDate })}
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  {resumeDate}
                </span>
              )}
              {needsYou && <NeedsYouMarker small />}
              {personStage ? (
                <StatusPill status={personStage} small />
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusHex, flexShrink: 0 }} />
              )}
              {unreadCount > 0 && (
                <span
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    minWidth: 19, height: 19, padding: '0 5px', borderRadius: 9999,
                    background: 'var(--wine)', color: 'var(--on-wine)',
                    fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                  }}
                  aria-label={`${unreadCount} unread`}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
          </div>

          {/* Contact info, revealed on hover (hover-capable desktops only) */}
          <div className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out max-md:hidden max-h-0 opacity-0 group-hover/card:max-h-12 group-hover/card:opacity-100">
            {(phone || email) && (
              <div className="pt-1 flex items-center gap-3 text-[12px]" style={{ color: 'var(--mute-2)' }}>
                {phone && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Phone className="h-3 w-3 shrink-0" />
                    {shownPhone}
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


    </div>
  );
}
