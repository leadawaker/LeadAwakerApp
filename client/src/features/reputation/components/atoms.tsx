import React from "react";
import {
  ExternalLink, RotateCcw, Flag, Pencil, Send, MessageSquare,
  MessageCircle, ArrowRight, Clock, Sparkles, Check, Search,
  ArrowUpDown, ChevronDown, Gift, Heart, Briefcase, Zap,
} from "lucide-react";
import type { ReviewStatus, FeedbackStatus, ToneKey } from "../types";
import { repRatingColor } from "../utils";

// ── Lucide re-exports used across the workspace ──────────────────
export const RIconExt = ExternalLink;
export const RIconRefresh = RotateCcw;
export const RIconFlag = Flag;
export const RIconEdit = Pencil;
export const RIconSend = Send;
export const RIconNote = MessageSquare;
export const RIconWA = MessageCircle;
export const RIconSms = MessageSquare;
export const RIconArrow = ArrowRight;
export const RIconClock = Clock;
export const IconSpark = Sparkles;
export const IconCheck = Check;
export const IconSearch = Search;
export const IconSort = ArrowUpDown;
export const IconChev = ChevronDown;
export const IconChats = MessageCircle;
export const IconGift = Gift;
export const TIconApologetic = Heart;
export const TIconConcise = Zap;
export const TIconProfessional = Briefcase;

// Filled-star icon (lucide Star isn't filled by default)
export function RIconStarF({ size = 14, ...p }: { size?: number; [k: string]: unknown }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}>
      <path d="M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 21.5 6.2 20.6l1.1-6.5L2.6 9.5l6.5-1z" />
    </svg>
  );
}

export function TIconGrateful({ size = 14, ...p }: { size?: number; [k: string]: unknown }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 14.3 6.2 16.8l.9-5.3L3.2 7.7l5.4-.8z" />
    </svg>
  );
}

// ── RepStars ─────────────────────────────────────────────────────
export function RepStars({ rating, size = 14, gap = 2 }: { rating: number; size?: number; gap?: number }) {
  const color = repRatingColor(rating);
  return (
    <span style={{ display: "inline-flex", gap, alignItems: "center" }} aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ display: "flex", color: i <= rating ? color : "var(--line-strong)" }}>
          <RIconStarF size={size} />
        </span>
      ))}
    </span>
  );
}

// ── Platform glyph ───────────────────────────────────────────────
export function RepPlatformGlyph({ platform = "google", size = 16, withLabel = false }: { platform?: string; size?: number; withLabel?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: size, height: size, borderRadius: "var(--r-flush)", flexShrink: 0, background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: size * 0.62, color: "var(--wine)" }}>G</span>
      {withLabel && <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--mute)", textTransform: "uppercase" }}>Google</span>}
    </span>
  );
}

// ── Reviewer avatar ──────────────────────────────────────────────
export function RepAvatar({ ini, rating, size = 38, radius }: { ini: string; rating: number; size?: number; radius?: number }) {
  const color = repRatingColor(rating);
  return (
    <div style={{ width: size, height: size, borderRadius: radius != null ? radius : Math.round(size * 0.28), flexShrink: 0, background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "var(--mono)", fontWeight: 600, fontSize: Math.round(size * 0.34), letterSpacing: "0.01em", boxShadow: "var(--sh-raised-crisp)" }}>{ini}</div>
  );
}

// ── Review status pill ───────────────────────────────────────────
export function RepStatusPill({ status, small }: { status: ReviewStatus; small?: boolean }) {
  const map: Record<ReviewStatus, { label: string; fg: string; bg: string }> = {
    needs:   { label: "Needs reply", fg: "var(--wine)",   bg: "var(--wine-tint)" },
    drafted: { label: "Drafted",     fg: "var(--warn)",   bg: "var(--warn-tint)" },
    replied: { label: "Replied",     fg: "var(--good)",   bg: "var(--good-tint)" },
    ignored: { label: "Ignored",     fg: "var(--mute-2)", bg: "var(--bg)" },
  };
  const c = map[status] ?? map.needs;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: small ? 8 : 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: small ? "2px 7px" : "3px 9px", borderRadius: "var(--r-pill)", color: c.fg, background: c.bg, boxShadow: status === "ignored" ? "var(--sh-inset-crisp)" : "none" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.fg }} />{c.label}
    </span>
  );
}

// ── Feedback status pill ─────────────────────────────────────────
export function RepFbStatusPill({ status, small }: { status: FeedbackStatus; small?: boolean }) {
  const map: Record<FeedbackStatus, { label: string; fg: string; bg: string }> = {
    open:     { label: "Open",     fg: "var(--wine)", bg: "var(--wine-tint)" },
    assigned: { label: "Assigned", fg: "var(--warn)", bg: "var(--warn-tint)" },
    resolved: { label: "Resolved", fg: "var(--good)", bg: "var(--good-tint)" },
  };
  const c = map[status] ?? map.open;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: small ? 8 : 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: small ? "2px 7px" : "3px 9px", borderRadius: "var(--r-pill)", color: c.fg, background: c.bg }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.fg }} />{c.label}
    </span>
  );
}

// ── Channel pill ─────────────────────────────────────────────────
export function RepChannelPill({ channel, state }: { channel: string; state: string }) {
  const map: Record<string, { label: string; fg: string }> = {
    ready:    { label: "ready",               fg: "var(--good)" },
    approved: { label: "approved",            fg: "var(--good)" },
    pending:  { label: "pending Meta review", fg: "var(--warn)" },
    rejected: { label: "rejected",            fg: "var(--wine)" },
  };
  const c = map[state] ?? map.pending;
  const Ic = channel.toLowerCase().includes("whats") ? RIconWA : RIconSms;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 11px", borderRadius: "var(--r-pill)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", color: "var(--mute)" }}>
      <span style={{ display: "flex", color: c.fg }}><Ic size={13} /></span>
      <span style={{ color: "var(--ink-soft)" }}>{channel}</span>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: c.fg }} />
      <span style={{ color: c.fg }}>{c.label}</span>
    </span>
  );
}

// ── Summary chip ─────────────────────────────────────────────────
export function RepSummaryChip({ avg, count }: { avg: number; count: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: "var(--r-pill)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
      <span style={{ display: "flex", color: "var(--good)" }}><RIconStarF size={13} /></span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{avg}</span>
      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)" }} />
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)", letterSpacing: "0.04em" }}>{count} reviews</span>
    </span>
  );
}

// ── Language badge ───────────────────────────────────────────────
export function RepLangBadge({ lang }: { lang: string }) {
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute)", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "1px 5px" }}>{lang}</span>
  );
}

// ── Generic card ─────────────────────────────────────────────────
export function RepCard({ headLeft, headRight, children, style, bodyStyle, variant = "raised" }: { headLeft?: React.ReactNode; headRight?: React.ReactNode; children?: React.ReactNode; style?: React.CSSProperties; bodyStyle?: React.CSSProperties; variant?: "raised" | "inset" | "flat" }) {
  const wrapClass = variant === "raised" ? "neu-raised" : "";
  const wrapBg: React.CSSProperties = variant === "raised"
    ? { background: "var(--card)" }
    : variant === "inset"
    ? { background: "var(--bg)", boxShadow: "var(--sh-inset-crisp), inset 0 0 0 1px rgba(0,0,0,0.06)" }
    : { background: "transparent" };
  return (
    <div className={wrapClass} style={{ borderRadius: "var(--r-card)", overflow: "hidden", display: "flex", flexDirection: "column", ...wrapBg, ...style }}>
      {(headLeft || headRight) && (
        <div style={{ height: 50, flexShrink: 0, padding: "0 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>{headLeft}</div>
          {headRight}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", ...bodyStyle }}>{children}</div>
    </div>
  );
}

export function RepLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: color ?? "var(--mute)" }}>{children}</span>;
}

// ── List card (left pane) ────────────────────────────────────────
import type { Review } from "../types";

export function RepListCard({ review, active, onClick, autoPosted }: { review: Review; active: boolean; onClick: () => void; autoPosted?: boolean }) {
  return (
    <div onClick={onClick} style={{ borderRadius: "var(--r-surface)", position: "relative", cursor: "pointer", background: active ? "var(--card)" : "transparent", boxShadow: active ? "var(--sh-raised-medium), inset 0 0 0 1px var(--line-strong)" : "none", transform: active ? "translateX(2px)" : "none", transition: "background 130ms, transform 130ms, box-shadow 130ms" }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "var(--wine-tint)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
      {active && <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, background: "var(--wine)", borderRadius: "0 3px 3px 0" }} />}
      <div style={{ padding: "8px 12px", display: "flex", gap: 10 }}>
        <RepAvatar ini={review.ini} rating={review.rating} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)", fontWeight: active ? 600 : 400, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{review.name}</span>
            <RepStars rating={review.rating} size={11} />
          </div>
          <p style={{ margin: "0 0 5px", fontSize: 12, lineHeight: 1.5, color: "var(--mute)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{review.text}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)", letterSpacing: "0.06em" }}>
              <RepPlatformGlyph size={13} /> · {review.ago}
            </span>
            {autoPosted
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 7px", borderRadius: "var(--r-pill)", color: "var(--wine)", background: "var(--wine-tint)" }}><IconSpark size={9} />Auto-posted</span>
              : <RepStatusPill status={review.status} small={!active} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tone key → icon map ──────────────────────────────────────────
export const TONE_ICONS: Record<ToneKey, React.FC<{ size?: number }>> = {
  apologetic: TIconApologetic,
  grateful: TIconGrateful,
  professional: TIconProfessional,
  concise: TIconConcise,
};
