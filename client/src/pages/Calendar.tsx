import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { createPortal } from "react-dom";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/useIsMobile";
import { CrmShell } from "@/components/crm/CrmShell";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads, useCampaigns } from "@/hooks/useApiData";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw, X, Filter, ArrowUpDown, ArrowUp, ArrowDown, Layers, Check, Plus, Phone, Mail, Grid3X3, Columns3, CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";
import type { Lead as ConversationLead, Interaction } from "@/features/conversations/hooks/useConversationsData";
import { LeadDetailPanel } from "@/features/leads/components/LeadDetailPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { IconBtn } from "@/components/ui/icon-btn";
import { SearchPill } from "@/components/ui/search-pill";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/apiUtils";
import { formatBubbleTime, getHoursInTimezone, getMinutesInTimezone, toLocaleDateStringTz } from "@/features/leads/components/cardView/formatUtils";
import { BookedCallsKpi } from "@/components/crm/BookedCallsKpi";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useLocation } from "wouter";
import { DesktopCalendar } from "@/features/calendar/components/DesktopCalendar";
import { BookAppointmentPopover } from "@/features/calendar/components/BookAppointmentPopover";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const FULL_MONTH_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function formatDate(date: Date, tFn: (key: string) => string) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = tFn(`months.short.${MONTH_KEYS[date.getMonth()]}`);
  const year = date.getFullYear();
  return `${day} ${month} - ${year}`;
}

type ViewMode = "month" | "week" | "day";

type Appointment = {
  id: number;
  lead_name: string;
  campaign_name: string | null;
  date: string;
  formattedDate: string;
  time: string;
  hour: number;
  minutes: number;
  status: string | undefined;
  calendar_link: string;
  no_show: boolean;
  re_scheduled_count: number;
  raw_booked_call_date: string;
  raw_previous_booked_call_date: string | null;
  phone: string | null;
  email: string | null;
  callDurationMinutes: number;
  rawLead: Record<string, any>;
  timezone?: string;
};

// ── View mode tab config (labels resolved inside component via t()) ──────────
const CALENDAR_TAB_DEFS = [
  { id: "month", labelKey: "views.month", icon: Grid3X3 },
  { id: "week",  labelKey: "views.week",  icon: Columns3 },
  { id: "day",   labelKey: "views.day",   icon: CalendarDays },
] as const;

const MOBILE_CALENDAR_TAB_DEFS = [
  { id: "month", labelKey: "views.month", icon: Grid3X3 },
  { id: "week",  labelKey: "views.week",  icon: Columns3 },
  { id: "day",   labelKey: "views.day",   icon: CalendarDays },
] as const;

// ── Appointment date grouping ─────────────────────────────────────────────────
// Returns a stable key (not translated) for grouping; translation happens at render time
type DateGroupKey = "past" | "today" | "tomorrow" | "thisWeek" | "later";

function getApptDateGroup(dateStr: string): DateGroupKey {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "later";
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dDay.getTime() < today.getTime()) return "past";
  if (dDay.getTime() === today.getTime()) return "today";
  if (dDay.getTime() === tomorrow.getTime()) return "tomorrow";
  if (dDay.getTime() < nextWeek.getTime()) return "thisWeek";
  return "later";
}

const DATE_GROUP_ORDER: DateGroupKey[] = ["today", "tomorrow", "thisWeek", "later", "past"];

type ApptSortBy = "time_asc" | "time_desc" | "name_asc" | "name_desc" | "campaign_asc" | "campaign_desc" | "status_asc" | "status_desc";
type ApptGroupBy = "date" | "campaign" | "status" | "none";
type ApptFilterStatus = "no_show" | "rescheduled" | "confirmed";

const APPT_SORT_GROUPS: { key: string; label: string; asc: ApptSortBy; desc: ApptSortBy }[] = [
  { key: "time", label: "sort.time", asc: "time_asc", desc: "time_desc" },
  { key: "name", label: "sort.nameAZ", asc: "name_asc", desc: "name_desc" },
  { key: "campaign", label: "sort.campaign", asc: "campaign_asc", desc: "campaign_desc" },
  { key: "status", label: "sort.status", asc: "status_asc", desc: "status_desc" },
];

const APPT_GROUP_KEYS: Record<ApptGroupBy, string> = {
  date: "group.date",
  campaign: "group.campaign",
  status: "group.status",
  none: "group.none",
};

const APPT_FILTER_KEYS: Record<ApptFilterStatus, string> = {
  no_show: "filter.noShow",
  rescheduled: "filter.rescheduled",
  confirmed: "filter.confirmed",
};

// ════════════════════════════════════════════════════════════════════════════
//  MOBILE CALENDAR — agenda/month experience matching migration/mobile-calendar
//  Self-contained presentation layer driven by the page's real Appointment data.
// ════════════════════════════════════════════════════════════════════════════

// ── Glyphs (kept local; sized for the mobile design) ──────────────────────────
const MCVideoGlyph = ({ s = 15 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="13" height="12" rx="2" /><path d="m22 8-5 4 5 4z" /></svg>;
const MCPhoneGlyph = ({ s = 14 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>;
const MCClockGlyph = ({ s = 11 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const MCReschedGlyph = ({ s = 15 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v4h-4" /></svg>;
const MCArrowGlyph = ({ s = 11 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

type MobileFilter = "all" | "noShow" | "rescheduled" | "attention";

// Derive a display status from the real Appointment fields.
function mcApptStatus(a: Appointment, t: (k: string) => string): { key: string; label: string; color: string; tint: string } {
  if (a.no_show) return { key: "noshow", label: t("mobile.legend.noShow"), color: "var(--stage-lost)", tint: "rgba(162,75,63,0.12)" };
  if (a.re_scheduled_count > 0) return { key: "rescheduled", label: t("mobile.legend.rescheduled"), color: "var(--warn)", tint: "var(--warn-tint)" };
  return { key: "booked", label: t("mobile.legend.booked"), color: "var(--good)", tint: "var(--good-tint)" };
}

function mcInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mcLocalISO(d: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(d);
}

// ── Stage-tinted avatar ───────────────────────────────────────────────────────
function MCAvatar({ a, size = 40, radius }: { a: Appointment; size?: number; radius?: number }) {
  const statusKey = a.no_show ? "Lost" : (a.status || "Contacted");
  const { bg, text } = getLeadStatusAvatarColor(statusKey);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius != null ? radius : Math.round(size * 0.28),
      flexShrink: 0, background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: text, fontFamily: "var(--mono)", fontWeight: 600,
      fontSize: Math.round(size * 0.34), letterSpacing: "0.01em",
      boxShadow: "var(--sh-raised-crisp)",
    }}>{mcInitials(a.lead_name)}</div>
  );
}

// ── Agenda event row (full-width touch card) ──────────────────────────────────
function MCEventRow({ a, onOpen, t }: { a: Appointment; onOpen: (a: Appointment) => void; t: (k: string) => string }) {
  const sm = mcApptStatus(a, t);
  const faded = a.no_show;
  const via = a.phone ? "phone" : "video";
  return (
    <button onClick={() => onOpen(a)} style={{
      width: "100%", textAlign: "left", border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 13, padding: "12px 14px",
      borderRadius: "var(--r-card)", minHeight: 62, borderLeft: `3px solid ${sm.color}`,
      background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)",
      opacity: faded ? 0.7 : 1,
    }} data-testid={`mobile-event-row-${a.id}`}>
      <MCAvatar a={a} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: faded ? "line-through" : "none" }}>{a.lead_name}</div>
        {a.campaign_name && <div style={{ fontSize: 11, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{a.campaign_name}</div>}
        <div className="row" style={{ gap: 9, marginTop: 6 }}>
          <span className="row" style={{ gap: 4, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-soft)" }}>
            <MCClockGlyph />{a.time}
          </span>
          {sm.key !== "booked" && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 7.5, letterSpacing: "0.1em", textTransform: "uppercase", color: sm.color, background: sm.tint, borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>{sm.label}</span>
          )}
        </div>
      </div>
      <span style={{ color: "var(--mute-2)", display: "flex", flexShrink: 0 }}>{via === "phone" ? <MCPhoneGlyph /> : <MCVideoGlyph />}</span>
    </button>
  );
}

// ── Day group header ──────────────────────────────────────────────────────────
function MCDayBar({ d, count, isToday, t }: { d: Date; count: number; isToday: boolean; t: (k: string) => string }) {
  const dow = t(`days.short.${DAY_KEYS[d.getDay()]}`);
  const mon = t(`months.short.${MONTH_KEYS[d.getMonth()]}`);
  return (
    <div className="row" style={{ gap: 9, padding: "15px 2px 7px" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: isToday ? "var(--wine)" : "var(--ink-soft)", fontWeight: 700 }}>
        {dow}, {mon} {d.getDate()}
      </span>
      {isToday && <span style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--paper)", background: "var(--wine)", borderRadius: "var(--r-pill)", padding: "2px 8px", fontWeight: 700 }}>{t("mobile.today")}</span>}
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-pill)", padding: "1px 8px" }}>{count}</span>
      <div className="rule" style={{ flex: 1 }} />
    </div>
  );
}

// ── Month grid (secondary toggle — bird's-eye, tap a day → agenda) ────────────
function MCMonthGrid({ appts, anchorDate, todayStr, onPickDay, t }: {
  appts: Appointment[]; anchorDate: Date; todayStr: string; onPickDay: (iso: string) => void; t: (k: string) => string;
}) {
  const y = anchorDate.getFullYear(), m = anchorDate.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-led
  const gridStart = new Date(y, m, 1 - offset);
  const cells = Array.from({ length: 42 }, (_, i) => { const x = new Date(gridStart); x.setDate(gridStart.getDate() + i); return x; });
  const weeks: Date[][] = [];
  for (let i = 0; i < 6; i++) {
    const wk = cells.slice(i * 7, i * 7 + 7);
    if (wk[0].getMonth() === m || wk[6].getMonth() === m) weeks.push(wk);
  }
  const byDay = (iso: string) => appts.filter((e) => e.date === iso);
  const dowKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 90px" }} data-testid="mobile-month-grid">
      <div className="row" style={{ gap: 9, padding: "0 2px 12px" }}>
        <span className="serif" style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t(`months.full.${FULL_MONTH_KEYS[m]}`)} {y}</span>
        <div className="rule" style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)" }}>{t("mobile.tapDay")}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {dowKeys.map((dk, i) => (
          <div key={i} style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", color: "var(--mute-2)", fontWeight: 700 }}>{t(`days.short.${dk}`).charAt(0)}</div>
        ))}
      </div>
      <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: 6, background: "var(--bg-2)" }}>
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {wk.map((d) => {
              const iso = mcLocalISO(d), inMonth = d.getMonth() === m, isToday = iso === todayStr;
              const items = byDay(iso);
              const has = items.length > 0;
              return (
                <button key={iso} disabled={!has} onClick={() => has && onPickDay(iso)} style={{
                  aspectRatio: "1 / 1.15", border: "none", cursor: has ? "pointer" : "default",
                  borderRadius: "var(--r-surface)", padding: "5px 0 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  background: isToday ? "var(--wine-tint)" : has ? "var(--card)" : "transparent",
                  boxShadow: isToday ? "inset 0 0 0 1.5px var(--wine-glow)" : has ? "var(--sh-raised-crisp)" : "none",
                  opacity: inMonth ? 1 : 0.32,
                }}>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 14, color: isToday ? "var(--wine)" : "var(--ink-soft)", fontWeight: isToday ? 700 : 400 }}>{d.getDate()}</span>
                  <span style={{ display: "flex", gap: 2, alignItems: "center", minHeight: 5 }}>
                    {items.slice(0, 3).map((e) => {
                      const sm = mcApptStatus(e, t);
                      return <span key={e.id} style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: sm.color }} />;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 14, justifyContent: "center", padding: "16px 0 0", flexWrap: "wrap" }}>
        {[["var(--good)", t("mobile.legend.booked")], ["var(--warn)", t("mobile.legend.rescheduled")], ["var(--stage-lost)", t("mobile.legend.noShow")]].map(([c, l]) => (
          <span key={l} className="row" style={{ gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)" }}>{l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Detail sheet field ────────────────────────────────────────────────────────
function MCField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mute-2)" }}>{label}</span>
      <span style={{ fontSize: 13.5, color: "var(--ink)", wordBreak: "break-word" }}>{children}</span>
    </div>
  );
}

// ── Detail bottom-sheet body ──────────────────────────────────────────────────
function MCDetailBody({ a, onClose, onOpenInLead, t }: {
  a: Appointment; onClose: () => void; onOpenInLead: (a: Appointment) => void; t: (k: string) => string;
}) {
  const sm = mcApptStatus(a, t);
  const d = new Date(a.raw_booked_call_date);
  const via = a.phone ? "phone" : "video";
  const dow = t(`days.short.${DAY_KEYS[d.getDay()]}`);
  const mon = t(`months.full.${FULL_MONTH_KEYS[d.getMonth()]}`);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }} data-testid="mobile-detail-sheet">
      {/* hero */}
      <div style={{ flexShrink: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)", padding: "28px 16px 16px" }}>
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: sm.color, background: sm.tint, borderRadius: "var(--r-pill)", padding: "4px 10px", fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.color }} />{sm.label}
          </span>
        </div>
        <div className="row" style={{ gap: 13, alignItems: "center" }}>
          <MCAvatar a={a} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>{a.lead_name}</div>
            {a.campaign_name && <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 3 }}>{a.campaign_name}</div>}
          </div>
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <MCField label={t("mobile.detail.date")}>{dow}<br /><span style={{ color: "var(--mute)", fontSize: 12 }}>{mon} {d.getDate()}, {d.getFullYear()}</span></MCField>
          <MCField label={t("mobile.detail.time")}>
            <span className="row" style={{ gap: 6 }}><MCClockGlyph s={13} />{a.time}</span>
          </MCField>
          <MCField label={t("mobile.detail.via")}>
            <span className="row" style={{ gap: 7 }}>{via === "phone" ? <MCPhoneGlyph s={13} /> : <MCVideoGlyph s={14} />}{via === "phone" ? t("mobile.channel.phone") : t("mobile.channel.video")}</span>
          </MCField>
          <MCField label={t("mobile.detail.status")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: sm.color, background: sm.tint, borderRadius: "var(--r-pill)", padding: "4px 10px", fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.color }} />{sm.label}
            </span>
          </MCField>
        </div>

        {/* contact (when available) */}
        {(a.phone || a.email) && (
          <div>
            <div className="eyebrow eyebrow-sm" style={{ marginBottom: 9 }}>{t("mobile.detail.contact")}</div>
            <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {a.phone && <MCField label={t("mobile.detail.phone")}>{a.phone}</MCField>}
              {a.email && <MCField label={t("mobile.detail.email")}>{a.email}</MCField>}
            </div>
          </div>
        )}

        {/* open in lead */}
        <button onClick={() => onOpenInLead(a)} style={{
          alignSelf: "flex-start", textDecoration: "none", border: "none", background: "transparent", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700,
        }} data-testid="mobile-detail-open-lead">{t("mobile.detail.openInLead")} <MCArrowGlyph /></button>
      </div>

      {/* actions */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--line)", padding: "14px 18px calc(14px + var(--safe-bottom))", display: "flex", gap: 10 }}>
        <a href={via === "phone" && a.phone ? `tel:${a.phone}` : a.calendar_link} target={via === "phone" ? undefined : "_blank"} rel="noreferrer" style={{
          flex: 1, height: 48, borderRadius: "var(--r-surface)", border: "none", cursor: "pointer", textDecoration: "none",
          background: "var(--wine-grad)", boxShadow: "var(--sh-raised-medium)",
          color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
        }} data-testid="mobile-detail-primary">
          {via === "phone" ? <MCPhoneGlyph s={15} /> : <MCVideoGlyph s={16} />}{via === "phone" ? t("mobile.detail.callNow") : t("mobile.detail.joinMeeting")}
        </a>
        <button title={t("mobile.detail.reschedule")} onClick={onClose} style={{
          width: 48, height: 48, borderRadius: "var(--r-surface)", border: "none", cursor: "pointer",
          background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><MCReschedGlyph s={18} /></button>
      </div>
    </div>
  );
}

// ── Reusable bottom sheet (locked transition) ─────────────────────────────────
function MCSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const [render, setRender] = useState(open);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)));
    } else {
      setVis(false);
    }
  }, [open]);
  if (!render) return null;
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 500, background: "rgba(31,26,20,0.32)",
        opacity: vis ? 1 : 0, transition: "opacity 360ms ease", pointerEvents: vis ? "auto" : "none",
      }} />
      <div onTransitionEnd={() => { if (!vis) setRender(false); }} style={{
        position: "fixed", left: 0, right: 0, top: 40, bottom: 0, zIndex: 501,
        transform: vis ? "translateY(0)" : "translateY(100%)", transition: `transform 360ms ${ease}`,
        borderRadius: "var(--r-panel) var(--r-panel) 0 0", overflow: "hidden", boxShadow: "0 -10px 40px rgba(60,45,25,0.20)",
      }}>
        <div onClick={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 26, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 6 }}>
          <span style={{ width: 40, height: 5, borderRadius: "var(--r-pill)", background: "var(--mute-2)", opacity: 0.6 }} />
        </div>
        {children}
      </div>
    </>
  );
}

// ── Mobile calendar orchestrator ──────────────────────────────────────────────
function MobileCalendar({
  appts, anchorDate, setAnchorDate, todayStr, swipeRef,
  fab, onOpenInLead, t,
}: {
  appts: Appointment[];
  anchorDate: Date;
  setAnchorDate: (d: Date) => void;
  todayStr: string;
  swipeRef: React.RefObject<HTMLDivElement | null>;
  fab: React.ReactNode;
  onOpenInLead: (a: Appointment) => void;
  t: (k: string) => string;
}) {
  const [view, setView] = useState<"agenda" | "month">("agenda");
  const [filter, setFilter] = useState<MobileFilter>("all");
  const [sel, setSel] = useState<Appointment | null>(null);
  const [open, setOpen] = useState(false);

  const openEvent = (a: Appointment) => { setSel(a); requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))); };
  const closeEvent = () => setOpen(false);

  const matches = (a: Appointment, f: MobileFilter): boolean => {
    switch (f) {
      case "noShow": return a.no_show;
      case "rescheduled": return a.re_scheduled_count > 0;
      case "attention": return a.no_show || a.re_scheduled_count > 0;
      default: return true;
    }
  };

  // Active Mon–Sun week derived from anchorDate (week nav mutates anchorDate via setAnchorDate)
  const weekMon = useMemo(() => {
    const x = new Date(anchorDate);
    const dow = (x.getDay() + 6) % 7; // 0 = Monday
    x.setDate(x.getDate() - dow);
    x.setHours(0, 0, 0, 0);
    return x;
  }, [anchorDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekMon); d.setDate(weekMon.getDate() + i); return d; }), [weekMon]);
  const weekISO = useMemo(() => new Set(weekDays.map(mcLocalISO)), [weekDays]);
  const weekEnd = weekDays[6];
  const weekLabel = `${t(`months.short.${MONTH_KEYS[weekMon.getMonth()]}`)} ${weekMon.getDate()} – ${weekMon.getMonth() === weekEnd.getMonth() ? "" : t(`months.short.${MONTH_KEYS[weekEnd.getMonth()]}`) + " "}${weekEnd.getDate()}`;

  const weekEvents = useMemo(() => appts.filter((e) => weekISO.has(e.date)), [appts, weekISO]);
  const counts = useMemo(() => ({
    all: weekEvents.length,
    noShow: weekEvents.filter((e) => matches(e, "noShow")).length,
    rescheduled: weekEvents.filter((e) => matches(e, "rescheduled")).length,
    attention: weekEvents.filter((e) => matches(e, "attention")).length,
  }), [weekEvents]);

  const dayGroups = useMemo(() => weekDays.map((d) => {
    const iso = mcLocalISO(d);
    const items = weekEvents.filter((e) => e.date === iso && matches(e, filter))
      .sort((a, b) => new Date(a.raw_booked_call_date).getTime() - new Date(b.raw_booked_call_date).getTime());
    return { d, iso, items };
  }).filter((g) => g.items.length), [weekDays, weekEvents, filter]);

  const stats = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const upcoming = weekEvents.filter((e) => !e.no_show && new Date(e.raw_booked_call_date) >= now).length;
    const attention = weekEvents.filter((e) => e.no_show || e.re_scheduled_count > 0).length;
    return [
      { value: String(weekEvents.length), label: t("mobile.stats.meetings") },
      { value: String(upcoming), label: t("mobile.stats.upcoming") },
      { value: String(attention), label: t("mobile.stats.needsAttention") },
    ];
  }, [weekEvents, t]);

  const shiftWeek = (n: number) => { const x = new Date(weekMon); x.setDate(weekMon.getDate() + n * 7); setAnchorDate(x); };
  const pickDay = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); setAnchorDate(new Date(y, m - 1, d)); setFilter("all"); setView("agenda"); };

  const chips: [MobileFilter, string, number][] = [
    ["all", t("mobile.filters.all"), counts.all],
    ["noShow", t("mobile.filters.noShow"), counts.noShow],
    ["rescheduled", t("mobile.filters.rescheduled"), counts.rescheduled],
    ["attention", t("mobile.filters.attention"), counts.attention],
  ];

  return (
    <div ref={swipeRef} style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }} data-testid="mobile-calendar">
      {/* top bar */}
      <div style={{ flexShrink: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", padding: "12px 18px 14px" }}>
          <span className="serif" style={{ fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em" }}>{t("title")}</span>
          <div className="la-seg">
            {([["agenda", t("mobile.agenda")], ["month", t("mobile.month")]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setView(k)} className={`la-seg-btn${k === view ? " on" : ""}`} data-testid={`mobile-view-${k}`}>{label}</button>
            ))}
          </div>
        </div>
        {view === "agenda" && (
          <div className="row" style={{ justifyContent: "space-between", padding: "0 16px 12px" }}>
            <button onClick={() => shiftWeek(-1)} aria-label={t("navigation.previous")} style={{ width: 38, height: 38, borderRadius: "var(--r-surface)", flexShrink: 0, border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={16} /></button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)" }}>{t("mobile.weekOf")}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>{weekLabel}</div>
            </div>
            <button onClick={() => shiftWeek(1)} aria-label={t("navigation.next")} style={{ width: 38, height: 38, borderRadius: "var(--r-surface)", flexShrink: 0, border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {view === "agenda" ? (
        <>
          {/* stat strip + filter chips */}
          <div style={{ flexShrink: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)", padding: "12px 0 11px" }}>
            <div style={{ display: "flex", gap: 9, overflowX: "auto", padding: "0 16px 11px", scrollbarWidth: "none" }}>
              {stats.map((s, i) => (
                <div key={i} style={{ flexShrink: 0, background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-surface)", padding: "9px 13px", minWidth: 116 }}>
                  <div className="row" style={{ gap: 7, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em", lineHeight: 1 }}>{s.value}</span>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute-2)", marginTop: 5 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
              {chips.map(([k, label, count]) => {
                const on = k === filter;
                return (
                  <button key={k} onClick={() => setFilter(k)} data-testid={`mobile-filter-${k}`} style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
                    background: on ? "var(--wine)" : "var(--surface)", boxShadow: on ? "none" : "var(--sh-raised-crisp)",
                    color: on ? "var(--paper)" : "var(--ink-soft)", fontSize: 12.5, fontWeight: on ? 700 : 500,
                  }}>
                    {label}
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: on ? "var(--paper)" : "var(--mute-2)", background: on ? "rgba(255,255,255,0.18)" : "var(--bg-2)", borderRadius: "var(--r-pill)", padding: "1px 7px" }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* agenda day list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 14px 90px" }} data-testid="mobile-agenda-list">
            {dayGroups.length === 0 ? (
              <div style={{ padding: "70px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{ width: 60, height: 60, borderRadius: "var(--r-card)", background: "var(--surface)", boxShadow: "var(--sh-raised-medium)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)" }}><CalendarDays size={26} /></div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)" }}>{t("mobile.noMeetingsWeek")}</div>
              </div>
            ) : dayGroups.map((g) => (
              <div key={g.iso}>
                <MCDayBar d={g.d} count={g.items.length} isToday={g.iso === todayStr} t={t} />
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {g.items.map((a) => <MCEventRow key={a.id} a={a} onOpen={openEvent} t={t} />)}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <MCMonthGrid appts={appts} anchorDate={anchorDate} todayStr={todayStr} onPickDay={pickDay} t={t} />
      )}

      {/* FAB (book-a-lead trigger, injected by parent) */}
      <div style={{ position: "absolute", right: 18, bottom: 18, zIndex: 10 }}>{fab}</div>

      <MCSheet open={open} onClose={closeEvent}>
        {sel && <MCDetailBody a={sel} onClose={closeEvent} onOpenInLead={(a) => { closeEvent(); onOpenInLead(a); }} t={t} />}
      </MCSheet>
    </div>
  );
}


// ── Draggable Booking Card ────────────────────────────────────────────────────
function DraggableBookingCard({
  appt,
  onClick,
  className,
  style,
  children,
}: {
  appt: Appointment;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booking-${appt.id}`,
    data: { appt },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e as any); } }}
      className={cn(className, isDragging && "opacity-30")}
      style={{ ...style, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
      data-testid={`booking-card-${appt.id}`}
    >
      {children}
    </div>
  );
}

// ── Droppable Day Cell ────────────────────────────────────────────────────────
function DroppableDay({
  dateKey,
  children,
  className,
  onClick,
  onKeyDown,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: {
  dateKey: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-drop-${dateKey}`, data: { dateKey } });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
      className={cn(className, isOver && "ring-2 ring-inset ring-brand-indigo bg-brand-indigo/10")}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}

// ── Droppable Time Slot ───────────────────────────────────────────────────────
function DroppableTimeSlot({
  dateKey,
  hour,
  hourHeight,
  className,
}: {
  dateKey: string;
  hour: number;
  hourHeight: number;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeslot-drop-${dateKey}-${hour}`,
    data: { dateKey, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn("absolute left-0 right-0", className, isOver && "bg-brand-indigo/10")}
      style={{ top: hour * hourHeight, height: hourHeight }}
      data-testid={`timeslot-${dateKey}-${hour}`}
    />
  );
}

// ── Toolbar expand-on-hover button constants ──────────────────────────────────
const xBase = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive = "border-brand-indigo text-brand-indigo";
const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Group header for appointment list ─────────────────────────────────────────
function ApptGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" className="sticky top-0 z-20 bg-white px-3 pt-3 pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">{"\u2013"}</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}


// ── Appointment card (hover-expand, leads-style) ─────────────────────────────
function AppointmentCard({
  appt,
  isActive,
  onSelect,
  onSelectLead,
}: {
  appt: Appointment;
  isActive: boolean;
  onSelect: () => void;
  onSelectLead?: (lead: Record<string, any>) => void;
}) {
  const { t } = useTranslation("calendar");
  const [editingDuration, setEditingDuration] = useState(false);
  const statusKey = appt.no_show ? "Lost" : (appt.status || "Contacted");
  const { bg: avatarBg, text: avatarText } = getLeadStatusAvatarColor(statusKey);

  const handleDurationChange = async (minutes: number) => {
    setEditingDuration(false);
    try {
      await apiFetch(`/api/leads/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_duration_minutes: minutes }),
      });
    } catch {}
  };

  return (
    <div
      className={cn(
        "group/card relative rounded-xl cursor-pointer",
        isActive ? "bg-highlight-selected" : "bg-white hover:bg-white"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      data-testid={`row-appt-${appt.id}`}
    >
      <div className="px-2.5 pt-2.5 pb-2 flex items-start gap-2">
        {/* Avatar */}
        <div
          className="shrink-0"
          data-testid={`appt-avatar-${appt.id}`}
        >
          <EntityAvatar
            name={appt.lead_name}
            bgColor={avatarBg}
            textColor={avatarText}
          />
        </div>

        {/* Name + campaign */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p
            className={cn(
              "text-[16px] font-semibold font-heading leading-tight truncate",
              appt.no_show ? "text-red-600 dark:text-red-400" : "text-foreground"
            )}
            data-testid={`text-appt-name-${appt.id}`}
          >
            {appt.lead_name}
          </p>
          {appt.campaign_name && (
            <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5" data-testid={`text-appt-campaign-${appt.id}`}>
              {appt.campaign_name}
            </p>
          )}
        </div>

        {/* Right column: date / time / duration stacked */}
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          <span className="text-[11px] text-muted-foreground tabular-nums leading-tight" data-testid={`date-${appt.id}`}>
            {appt.formattedDate}
          </span>
          {appt.raw_previous_booked_call_date && appt.re_scheduled_count > 0 && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums leading-tight line-through" data-testid={`prev-time-${appt.id}`}>
              {formatBubbleTime(appt.raw_previous_booked_call_date, appt.timezone)}
            </span>
          )}
          <span className="text-[11px] font-bold tabular-nums leading-tight text-foreground" data-testid={`time-${appt.id}`}>
            {appt.time}
          </span>
          {editingDuration ? (
            <select
              autoFocus
              className="text-[10px] rounded border border-border/40 bg-popover px-1 py-0.5 cursor-pointer"
              defaultValue={appt.callDurationMinutes}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              onBlur={() => setEditingDuration(false)}
              onClick={(e) => e.stopPropagation()}
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{m}m</option>
              ))}
            </select>
          ) : (
            <span
              className="text-[10px] text-muted-foreground/60 cursor-pointer hover:text-foreground tabular-nums"
              onClick={(e) => { e.stopPropagation(); setEditingDuration(true); }}
              title={t("appointment.editDuration")}
              data-testid={`duration-${appt.id}`}
            >
              {appt.callDurationMinutes}m
            </span>
          )}
        </div>
      </div>

      {/* Hover-expand: contact info + rescheduled/no-show labels */}
      <div className="grid grid-rows-[0fr] group-hover/card:grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out">
        <div className="overflow-hidden">
          <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-1.5 border-t border-border/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate">{appt.phone || "\u2014"}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate">{appt.email || "\u2014"}</span>
              </div>
            </div>
            {(appt.re_scheduled_count > 0 || appt.no_show) && (
              <div className="flex items-center gap-2.5">
                {appt.re_scheduled_count > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-amber-600"
                    data-testid={`reschedule-icon-${appt.id}`}
                  >
                    <RefreshCw className="h-3 w-3 shrink-0" />
                    <span className="text-[10px] font-semibold">{t("appointment.rescheduledCount", { count: appt.re_scheduled_count })}</span>
                  </span>
                )}
                {appt.no_show && (
                  <span
                    className="inline-flex items-center gap-1 text-red-500"
                    data-testid={`no-show-icon-${appt.id}`}
                  >
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span className="text-[10px] font-semibold">{t("appointment.noShow")}</span>
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


export default function CalendarPage() {
  const { t } = useTranslation("calendar");

  const CALENDAR_TABS = CALENDAR_TAB_DEFS.map((d) => ({ id: d.id, label: t(d.labelKey), icon: d.icon }));
  const MOBILE_CALENDAR_TABS = MOBILE_CALENDAR_TAB_DEFS.map((d) => ({ id: d.id, label: t(d.labelKey), icon: d.icon }));

  const { currentAccountId, isAgencyUser, accounts } = useWorkspace();
  const { leads, loading: leadsLoading, error: leadsError, refresh: refetchLeads } = useLeads(currentAccountId > 0 ? currentAccountId : undefined);
  const { campaigns } = useCampaigns();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [calendarAccountFilter, setCalendarAccountFilter] = useState<number | "all">(
    isAgencyUser && currentAccountId > 0 ? currentAccountId : "all"
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Appointment | null>(null);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const apptListRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to selected appointment card (§29)
  // useEffect + rAF instead of useLayoutEffect: appointments load async so the
  // auto-select fires after data arrives; rAF ensures the card is fully painted.
  useEffect(() => {
    if (!selectedBooking || !apptListRef.current) return;
    const container = apptListRef.current;
    const run = () => {
      const el = container.querySelector(`[data-appt-id="${selectedBooking.id}"]`) as HTMLElement | null;
      if (!el) return;
      const groupWrapper = el.closest("[data-group-wrapper]");
      const header = groupWrapper?.querySelector("[data-group-header]") as HTMLElement | null;
      const headerHeight = header ? header.offsetHeight : 0;
      const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: cardTop - headerHeight - 3, behavior: "smooth" });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedBooking]);

  // F shortcut: scroll selected appointment into view.
  useFKeyScrollToSelected({
    containerRef: apptListRef,
    selectedId: selectedBooking?.id ?? null,
    getSelector: (id) => `[data-appt-id="${id}"]`,
  });

  const [viewMode, setViewMode] = usePersistedState<ViewMode>(
    "calendar-view-mode",
    "month",
    (v) => ["month", "week", "day"].includes(v as string),
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [apptSortBy, setApptSortBy] = useState<ApptSortBy>("time_desc");
  const [apptGroupBy, setApptGroupBy] = useState<ApptGroupBy>("date");
  const [apptGroupDirection, setApptGroupDirection] = useState<"asc" | "desc">("asc");
  const [apptFilterStatuses, setApptFilterStatuses] = useState<ApptFilterStatus[]>([]);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Lead detail panel state
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [fullProfileLead, setFullProfileLead] = useState<Record<string, any> | null>(null);
  const [selectedLeadTags, setSelectedLeadTags] = useState<{ name: string; color: string }[]>([]);

  // Recent messages for the ContactSidebar
  const [recentMessages, setRecentMessages] = useState<Interaction[]>([]);
  const [recentMessagesLoading, setRecentMessagesLoading] = useState(false);
  const [, goTo] = useLocation();

  // Mobile event popup state
  const [mobileEventPopup, setMobileEventPopup] = useState<Appointment | null>(null);

  // Book popover state
  const [bookPopoverOpen, setBookPopoverOpen] = useState(false);
  const [bookLeadSearch, setBookLeadSearch] = useState("");
  const [bookSelectedLead, setBookSelectedLead] = useState<Record<string, any> | null>(null);
  const [bookDate, setBookDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [bookTime, setBookTime] = useState("10:00");
  const [bookDuration, setBookDuration] = useState(60);
  const [bookSubmitting, setBookSubmitting] = useState(false);

  // Responsive
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1024);
  const isMobile = useIsMobile();
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;
  const isNarrowDesktop = viewportWidth >= 1024 && viewportWidth < 1280;
  const isDesktop = !isMobile && !isTablet;

  // The redesigned desktop calendar offers Week/Month only — coerce the
  // persisted "day" view to "week" so the toggle stays consistent.
  useEffect(() => {
    if (isDesktop && viewMode === "day") setViewMode("week");
  }, [isDesktop, viewMode, setViewMode]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setViewportWidth(w);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // On mobile, month view is the default — no forced override needed

  // DnD state
  const [activeAppt, setActiveAppt] = useState<Appointment | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragToast, setDragToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [dragError, setDragError] = useState<{
    apptId: number | string;
    leadName: string;
    newBookedCallDate: string;
    newRescheduledCount: number;
    previousBookedCallDate: string | null | undefined;
    message: string;
  } | null>(null);
  const [dragRetrying, setDragRetrying] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (viewMode === "week" || viewMode === "day") {
      const id = requestAnimationFrame(() => {
        if (timeGridRef.current) {
          const now = new Date();
          const scrollPos = (now.getHours() * 60 + now.getMinutes()) * (80 / 60);
          timeGridRef.current.scrollTop = Math.max(0, scrollPos - 56 - 2 * 80);
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [viewMode]);

  const todayStr = new Intl.DateTimeFormat("en-CA").format(new Date());

  // Sync local filter when global account switcher changes
  useEffect(() => {
    if (isAgencyUser) {
      setCalendarAccountFilter(currentAccountId > 0 ? currentAccountId : "all");
    }
  }, [currentAccountId, isAgencyUser]);

  const effectiveAccountFilter = isAgencyUser ? calendarAccountFilter : currentAccountId;

  const appts = useMemo((): Appointment[] => {
    if (!leads) return [];
    return leads
      .filter((l: any) => {
        if (!isAgencyUser) {
          return (l.account_id || l.accounts_id) === currentAccountId;
        }
        if (effectiveAccountFilter === "all") return true;
        return (l.account_id || l.accounts_id) === effectiveAccountFilter;
      })
      .filter((l: any) => (campaignId === "all" ? true : (l.campaign_id || l.campaigns_id) === campaignId))
      .filter((l: any) => {
        const callDate = l.booked_call_date || l.booking_confirmed_at || l.bookingConfirmedAt;
        return Boolean(callDate) && (l.conversion_status === "Booked" || l.Conversion_Status === "Booked");
      })
      .map((l: any) => {
        const rawDate = l.booked_call_date || l.booking_confirmed_at || l.bookingConfirmedAt;
        const d = new Date(rawDate as string);
        const firstName = l.first_name || "";
        const lastName = l.last_name || "";
        const fullName = l.full_name || (firstName || lastName ? `${firstName} ${lastName}`.trim() : t("appointment.unknownLead"));
        const aid = l.account_id || l.accounts_id;
        const tz = accounts.find((a: any) => a.id === Number(aid))?.timezone as string | undefined;
        return {
          id: l.id,
          lead_name: fullName,
          campaign_name: l.campaign_name || null,
          date: toLocaleDateStringTz(d, tz),
          formattedDate: formatDate(d, t),
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) }),
          hour: getHoursInTimezone(d, tz),
          minutes: getMinutesInTimezone(d, tz),
          status: l.conversion_status,
          calendar_link: l.calendar_link || "https://cal.example.com/leadawaker",
          no_show: l.no_show === true || l.no_show === "true" || l.no_show === 1,
          re_scheduled_count: Number(l.re_scheduled_count) || 0,
          raw_booked_call_date: (l.booked_call_date || l.booking_confirmed_at || l.bookingConfirmedAt) as string,
          raw_previous_booked_call_date: (l.previous_booked_call_date || l.previousBookedCallDate || null) as string | null,
          phone: l.phone || l.Phone || null,
          email: l.email || l.Email || null,
          callDurationMinutes: Number(l.call_duration_minutes) || 60,
          rawLead: l,
          timezone: tz || undefined,
        };
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [leads, currentAccountId, isAgencyUser, effectiveAccountFilter, campaignId, t, accounts]);

  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  const month = useMemo(() => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1), [anchorDate]);

  const days = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const startDow = first.getDay();
    const gridStart = new Date(year, m, 1 - startDow);

    const out: { date: Date; count: number }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = new Intl.DateTimeFormat("en-CA").format(d);
      const count = appts.filter((a) => a.date === key).length;
      out.push({ date: d, count });
    }
    return out;
  }, [month, appts]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(anchorDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      out.push(d);
    }
    return out;
  }, [anchorDate]);

  const appointmentsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return appts.filter((a) => a.date === selectedDate);
  }, [selectedDate, appts]);

  // Filtered + sorted appointments for left panel
  const sortedAppts = useMemo(() => {
    let source = selectedDate ? appointmentsForSelectedDate : appts;

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      source = source.filter((a) =>
        a.lead_name.toLowerCase().includes(q) ||
        (a.campaign_name || "").toLowerCase().includes(q)
      );
    }

    // Apply filters
    let filtered = source;
    if (apptFilterStatuses.length > 0) {
      filtered = source.filter((a) => {
        if (apptFilterStatuses.includes("no_show") && a.no_show) return true;
        if (apptFilterStatuses.includes("rescheduled") && a.re_scheduled_count > 0) return true;
        if (apptFilterStatuses.includes("confirmed") && !a.no_show && a.re_scheduled_count === 0) return true;
        return false;
      });
    }

    // Apply sort
    const sorted = [...filtered];
    switch (apptSortBy) {
      case "name_asc":
        sorted.sort((a, b) => a.lead_name.localeCompare(b.lead_name));
        break;
      case "name_desc":
        sorted.sort((a, b) => b.lead_name.localeCompare(a.lead_name));
        break;
      case "campaign_asc":
        sorted.sort((a, b) => (a.campaign_name || "").localeCompare(b.campaign_name || ""));
        break;
      case "campaign_desc":
        sorted.sort((a, b) => (b.campaign_name || "").localeCompare(a.campaign_name || ""));
        break;
      case "status_asc":
        sorted.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
        break;
      case "status_desc":
        sorted.sort((a, b) => (b.status || "").localeCompare(a.status || ""));
        break;
      case "time_asc":
        sorted.sort((a, b) => new Date(a.raw_booked_call_date).getTime() - new Date(b.raw_booked_call_date).getTime());
        break;
      case "time_desc":
      default:
        break; // already sorted by time desc (default)
    }
    return sorted;
  }, [appts, selectedDate, appointmentsForSelectedDate, apptSortBy, apptFilterStatuses, searchQuery]);

  // Grouped appointments for left panel
  const groupedAppts = useMemo(() => {
    if (selectedDate && apptGroupBy === "date") {
      return [{ label: null as string | null, items: sortedAppts }];
    }

    switch (apptGroupBy) {
      case "none":
        return [{ label: null as string | null, items: sortedAppts }];
      case "campaign": {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const key = a.campaign_name || t("filter.noCampaign");
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(a);
        }
        const entries = Array.from(buckets.entries()).map(([label, items]) => ({ label: label as string | null, items }));
        return apptGroupDirection === "desc" ? entries.reverse() : entries;
      }
      case "status": {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const key = a.no_show ? t("appointment.noShow") : (a.status || "Unknown");
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(a);
        }
        const entries = Array.from(buckets.entries()).map(([label, items]) => ({ label: label as string | null, items }));
        return apptGroupDirection === "desc" ? entries.reverse() : entries;
      }
      case "date":
      default: {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const group = getApptDateGroup(a.raw_booked_call_date);
          if (!buckets.has(group)) buckets.set(group, []);
          buckets.get(group)!.push(a);
        }
        const orderedKeys = apptGroupDirection === "desc" ? [...DATE_GROUP_ORDER].reverse() : DATE_GROUP_ORDER;
        const result: { label: string | null; items: Appointment[] }[] = [];
        for (const key of orderedKeys) {
          const items = buckets.get(key);
          if (items && items.length > 0) result.push({ label: t(`dateGroups.${key}`), items });
        }
        return result;
      }
    }
  }, [sortedAppts, selectedDate, apptGroupBy, apptGroupDirection]);

  const totalApptCount = useMemo(() => {
    return sortedAppts.length;
  }, [sortedAppts]);

  // Auto-select first upcoming appointment when nothing is selected
  useEffect(() => {
    if (selectedBooking || sortedAppts.length === 0) return;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const firstUpcoming = sortedAppts.find((a) => new Date(a.raw_booked_call_date) >= now);
    if (firstUpcoming) setSelectedBooking(firstUpcoming);
    else setSelectedBooking(sortedAppts[0]);
  }, [sortedAppts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const { setCrumb } = useBreadcrumb();
  useEffect(() => {
    setCrumb(selectedBooking?.lead_name ?? null);
    return () => setCrumb(null);
  }, [selectedBooking, setCrumb]);

  const bookFilteredLeads = useMemo(() => {
    if (!bookLeadSearch.trim()) return [];
    const q = bookLeadSearch.toLowerCase();
    return (leads || []).filter((l: any) => {
      const name = (l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim() || "").toLowerCase();
      return name.includes(q);
    }).slice(0, 8) as Record<string, any>[];
  }, [leads, bookLeadSearch]);

  const handleDateClick = (dateStr: string) => {
    if (isDragging) return;
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  };

  const navigate = (direction: number) => {
    const next = new Date(anchorDate);
    if (viewMode === "month") {
      next.setMonth(anchorDate.getMonth() + direction);
    } else if (viewMode === "week") {
      next.setDate(anchorDate.getDate() + (direction * 7));
    } else {
      next.setDate(anchorDate.getDate() + direction);
    }
    setAnchorDate(next);
  };

  // ── Swipe gesture: left → next week, right → prev week (mobile only) ───────
  // Mobile uses the agenda/month experience, which is week-scoped off anchorDate.
  const shiftAnchorWeek = useCallback((weeks: number) => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + weeks * 7);
      return next;
    });
  }, []);
  const calendarSwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft:  () => isMobile && shiftAnchorWeek(1),
    onSwipeRight: () => isMobile && shiftAnchorWeek(-1),
    threshold: 60,
    minVelocity: 0.25,
    enabled: isMobile,
  });

  const viewLabel = useMemo(() => {
    if (viewMode === "month") return `${t(`months.full.${FULL_MONTH_KEYS[anchorDate.getMonth()]}`)} ${anchorDate.getFullYear()}`;
    if (viewMode === "week") {
      const start = weekDays[0];
      const end = weekDays[6];
      const sameMonth = start.getMonth() === end.getMonth();
      return sameMonth
        ? `${t(`months.short.${MONTH_KEYS[start.getMonth()]}`)} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`
        : `${t(`months.short.${MONTH_KEYS[start.getMonth()]}`)} ${start.getDate()} - ${t(`months.short.${MONTH_KEYS[end.getMonth()]}`)} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${t(`months.full.${FULL_MONTH_KEYS[anchorDate.getMonth()]}`)} ${anchorDate.getDate()}, ${anchorDate.getFullYear()}`;
  }, [viewMode, anchorDate, weekDays, t]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const HOUR_H = 80;
  const LABEL_W = 56;

  const campaignOptions = useMemo(() => {
    const fromLeads = new Map<number, string>();
    for (const l of (leads || [])) {
      const lead = l as any;
      const accId = lead.account_id || lead.accounts_id;
      if (!isAgencyUser) {
        if (accId !== currentAccountId) continue;
      } else if (effectiveAccountFilter !== "all") {
        if (accId !== effectiveAccountFilter) continue;
      }
      if (!lead.booked_call_date) continue;
      const cid = lead.campaign_id || lead.campaigns_id;
      const cname = lead.campaign_name;
      if (cid && cname) {
        fromLeads.set(Number(cid), cname);
      }
    }

    const fromApi = (campaigns || []).filter((c: any) => {
      if (isAgencyUser && effectiveAccountFilter === "all") return true;
      const targetAccountId = isAgencyUser ? effectiveAccountFilter : currentAccountId;
      const accId = c.account_id || c.accounts_id || c.Accounts_id;
      return !accId || accId === targetAccountId;
    });

    const merged = new Map<number, any>();
    for (const c of fromApi) {
      merged.set(c.id, c);
    }
    for (const [cid, cname] of Array.from(fromLeads)) {
      if (!merged.has(cid)) {
        merged.set(cid, { id: cid, name: cname, status: null });
      }
    }

    return Array.from(merged.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [campaigns, currentAccountId, isAgencyUser, effectiveAccountFilter, leads]);

  const selectedCampaignName = useMemo(() => {
    if (campaignId === "all") return null;
    const found = campaignOptions.find((c: any) => c.id === campaignId);
    return found ? (found as any).name : null;
  }, [campaignId, campaignOptions]);

  const selectedAccountName = useMemo((): string => {
    if (calendarAccountFilter === "all") return t("filter.allAccounts");
    const acc = (accounts || []).find((a: any) => (a.id || a.Id) === calendarAccountFilter);
    return acc ? (String(acc.name || acc.Name || `Account ${calendarAccountFilter}`)) : `Account ${calendarAccountFilter}`;
  }, [calendarAccountFilter, accounts]);

  const handleAccountFilterChange = useCallback((accId: number | "all") => {
    setCalendarAccountFilter(accId);
    setCampaignId("all");
    setSelectedDate(null);
  }, []);

  const handleSelectLead = useCallback(async (lead: Record<string, any>) => {
    setSelectedLead(lead);
    try {
      const resp = await apiFetch(`/api/leads/${lead.id || lead.Id}/tags`);
      if (resp.ok) {
        const tags = await resp.json();
        setSelectedLeadTags(Array.isArray(tags) ? tags : []);
      }
    } catch {
      setSelectedLeadTags([]);
    }
  }, []);

  // Fetch recent messages when a lead is selected (for right panel)
  const activePanelLeadId = selectedBooking?.rawLead?.id ?? selectedBooking?.rawLead?.Id ?? selectedLead?.id ?? selectedLead?.Id ?? null;
  useEffect(() => {
    if (!activePanelLeadId) { setRecentMessages([]); return; }
    let cancelled = false;
    setRecentMessagesLoading(true);
    (async () => {
      try {
        const res = await apiFetch(`/api/interactions?leadId=${activePanelLeadId}`);
        if (!res.ok) { if (!cancelled) setRecentMessages([]); return; }
        const data = await res.json();
        const list: Interaction[] = Array.isArray(data) ? data : data?.list || [];
        const sorted = list.sort((a, b) =>
          (a.created_at ?? a.createdAt ?? "").localeCompare(b.created_at ?? b.createdAt ?? "")
        );
        if (!cancelled) setRecentMessages(sorted.slice(-20));
      } catch {
        if (!cancelled) setRecentMessages([]);
      } finally {
        if (!cancelled) setRecentMessagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activePanelLeadId]);

  // Open the currently-selected meeting's lead (desktop detail "Open in lead").
  const handleOpenInLead = useCallback(() => {
    const lead = selectedBooking?.rawLead;
    const leadId = lead?.id ?? lead?.Id;
    if (leadId == null) return;
    try {
      localStorage.setItem("selected-lead-id", String(leadId));
      localStorage.setItem("leadawaker-returnto", "/platform/calendar");
    } catch { /* storage may be unavailable */ }
    goTo("/platform/contacts");
  }, [selectedBooking, isAgencyUser, goTo]);

  // Update lead handler for ContactSidebar
  const handleCalendarUpdateLead = useCallback(async (leadId: number, patch: Record<string, unknown>) => {
    await apiFetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }, []);

  const handleBookLead = useCallback(async () => {
    if (!bookSelectedLead || !bookDate || !bookTime) return;
    setBookSubmitting(true);
    try {
      const dt = new Date(`${bookDate}T${bookTime}`);
      await apiFetch(`/api/leads/${bookSelectedLead.id || bookSelectedLead.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booked_call_date: dt.toISOString(),
          conversion_status: "Booked",
          call_duration_minutes: bookDuration,
        }),
      });
      refetchLeads();
      setBookPopoverOpen(false);
      setBookSelectedLead(null);
      setBookLeadSearch("");
    } catch {}
    setBookSubmitting(false);
  }, [bookSelectedLead, bookDate, bookTime, bookDuration, refetchLeads]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const appt = event.active.data.current?.appt as Appointment | undefined;
    if (appt) {
      setActiveAppt(appt);
      setIsDragging(true);
      setSelectedBooking(null);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveAppt(null);
    setIsDragging(false);

    const { active, over } = event;
    if (!over) return;

    const appt = active.data.current?.appt as Appointment | undefined;
    if (!appt) return;

    const overData = over.data.current as { dateKey?: string; hour?: number } | undefined;
    const targetDateKey = overData?.dateKey as string | undefined;
    const targetHour = overData?.hour as number | undefined;

    if (!targetDateKey) return;

    const isTimeSlotDrop = targetHour !== undefined;
    const origDate = new Date(appt.raw_booked_call_date);
    // Day cells / time slots use en-CA keys ("YYYY-MM-DD").
    const [yearPart, monthPart, dayPart] = targetDateKey.split("-").map(Number);

    let newDate: Date;
    if (isTimeSlotDrop) {
      newDate = new Date(yearPart, monthPart - 1, dayPart, targetHour, origDate.getMinutes(), origDate.getSeconds());
    } else {
      newDate = new Date(yearPart, monthPart - 1, dayPart, origDate.getHours(), origDate.getMinutes(), origDate.getSeconds());
    }

    if (isNaN(newDate.getTime())) return;

    const sameDate = appt.date === targetDateKey;
    const sameHour = !isTimeSlotDrop || appt.hour === targetHour;
    if (sameDate && sameHour) return;

    const newBookedCallDate = newDate.toISOString();
    const newRescheduledCount = appt.re_scheduled_count + 1;

    try {
      const resp = await apiFetch(`/api/leads/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previous_booked_call_date: appt.raw_booked_call_date,
          booked_call_date: newBookedCallDate,
          re_scheduled_count: newRescheduledCount,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).message || `HTTP ${resp.status}`);
      }

      if (typeof refetchLeads === "function") {
        refetchLeads();
      }

      setDragError((prev) => (prev && prev.apptId === appt.id ? null : prev));

      if (isTimeSlotDrop) {
        const timeStr = newDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(appt.timezone ? { timeZone: appt.timezone } : {}) });
        setDragToast({ message: t("toast.rescheduledToWithTime", { name: appt.lead_name, date: formatDate(newDate, t), time: timeStr }), type: "success" });
      } else {
        setDragToast({ message: t("toast.rescheduledTo", { name: appt.lead_name, date: formatDate(newDate, t) }), type: "success" });
      }
      setTimeout(() => setDragToast(null), 4000);
    } catch (err: any) {
      setDragError({
        apptId: appt.id,
        leadName: appt.lead_name,
        newBookedCallDate,
        newRescheduledCount,
        previousBookedCallDate: appt.raw_booked_call_date,
        message: err.message,
      });
      setDragToast({ message: t("toast.failedToReschedule", { error: err.message }), type: "error" });
      setTimeout(() => setDragToast(null), 5000);
    }
  }, [refetchLeads, t]);

  const retryDragReschedule = useCallback(async () => {
    if (!dragError || dragRetrying) return;
    setDragRetrying(true);
    try {
      const resp = await apiFetch(`/api/leads/${dragError.apptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previous_booked_call_date: dragError.previousBookedCallDate,
          booked_call_date: dragError.newBookedCallDate,
          re_scheduled_count: dragError.newRescheduledCount,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).message || `HTTP ${resp.status}`);
      }
      if (typeof refetchLeads === "function") refetchLeads();
      setDragError(null);
      setDragToast({ message: t("toast.rescheduledTo", { name: dragError.leadName, date: formatDate(new Date(dragError.newBookedCallDate), t) }), type: "success" });
      setTimeout(() => setDragToast(null), 4000);
    } catch (err: any) {
      setDragError((prev) => prev ? { ...prev, message: err.message } : prev);
    } finally {
      setDragRetrying(false);
    }
  }, [dragError, dragRetrying, refetchLeads, t]);

  const handleDragCancel = useCallback(() => {
    setActiveAppt(null);
    setIsDragging(false);
  }, []);

  // ── Error fallback (initial fetch failure) ─────────────────────────────────
  if (leadsError && !leadsLoading && leads.length === 0) {
    return (
      <CrmShell>
        <div className="flex-1 min-h-0 flex items-center justify-center p-8" data-testid="page-calendar-error">
          <div className="max-w-md w-full rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">{t("errors.failedToLoad")}</div>
              <div className="text-xs text-muted-foreground mt-0.5 break-words">{leadsError.message}</div>
              <button
                type="button"
                onClick={() => refetchLeads()}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-indigo text-white text-xs font-semibold hover:brightness-110"
                data-testid="button-retry-leads"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("errors.retry")}
              </button>
            </div>
          </div>
        </div>
      </CrmShell>
    );
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (leadsLoading) {
    return (
      <CrmShell>
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-[3px] p-0" data-testid="page-calendar">
          {/* Left panel */}
          <div className="hidden lg:flex bg-white rounded-lg flex-col overflow-hidden">
            {/* Header */}
            <div className="px-3.5 pt-5 pb-1 flex items-center justify-between shrink-0">
              <Skeleton className="h-5 w-24 rounded bg-primary/10" />
              <Skeleton className="h-4 w-8 rounded bg-primary/10" />
            </div>
            {/* ViewTabBar skeleton */}
            <div className="px-3 pt-1.5 pb-3 flex items-center gap-1.5 shrink-0">
              {[70, 70, 60].map((w, i) => (
                <Skeleton key={i} className="h-9 rounded-full bg-primary/10" style={{ width: w }} />
              ))}
            </div>
            {/* Appointment list */}
            <div className="flex-1 min-h-0 overflow-hidden px-[3px] flex flex-col gap-[3px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5">
                  <Skeleton className="h-9 w-9 rounded-full bg-primary/10 shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-3/4 rounded bg-primary/10" />
                    <Skeleton className="h-3 w-1/2 rounded bg-primary/10" />
                  </div>
                  <Skeleton className="h-3 w-10 rounded bg-primary/10 shrink-0" />
                </div>
              ))}
            </div>
          </div>
          {/* Center panel */}
          <div className="bg-white rounded-lg flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.06] shrink-0">
              <Skeleton className="h-9 w-9 rounded-full bg-primary/10" />
              <Skeleton className="h-5 w-40 rounded bg-primary/10" />
              <Skeleton className="h-9 w-9 rounded-full bg-primary/10" />
              <div className="ml-auto">
                <Skeleton className="h-9 w-20 rounded-full bg-primary/10" />
              </div>
            </div>
            {/* Week header row */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-black/[0.06] shrink-0">
              <div className="h-12" />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-1 h-12 border-l border-black/[0.04]">
                  <Skeleton className="h-3 w-8 rounded bg-primary/10" />
                  <Skeleton className="h-7 w-7 rounded-full bg-primary/10" />
                </div>
              ))}
            </div>
            {/* Time rows */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-black/[0.04]" style={{ height: '52px' }}>
                  <div className="flex items-start justify-end pr-2 pt-1">
                    <Skeleton className="h-3 w-10 rounded bg-primary/10" />
                  </div>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} className="border-l border-black/[0.04]" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CrmShell>
    );
  }

  // ── Mobile: dedicated agenda/month experience (matches migration design) ────
  if (isMobile) {
    const openInLeadFromAppt = (a: Appointment) => {
      const lead = a.rawLead;
      const leadId = lead?.id ?? lead?.Id;
      if (leadId == null) return;
      try {
        localStorage.setItem("selected-lead-id", String(leadId));
        localStorage.setItem("leadawaker-returnto", "/platform/calendar");
      } catch { /* storage may be unavailable */ }
      goTo("/platform/contacts");
    };
    return (
      <CrmShell>
        <div className="flex flex-col h-full overflow-hidden" data-testid="page-calendar">
          <MobileCalendar
            appts={appts}
            anchorDate={anchorDate}
            setAnchorDate={setAnchorDate}
            todayStr={todayStr}
            swipeRef={calendarSwipeRef}
            onOpenInLead={openInLeadFromAppt}
            t={t}
            fab={
              <BookAppointmentPopover
                leads={leads}
                refetchLeads={refetchLeads}
                trigger={
                  <button data-testid="mobile-calendar-fab" style={{
                    height: 52, padding: "0 22px", borderRadius: "var(--r-card)", border: "none", cursor: "pointer",
                    background: "var(--wine-grad)", boxShadow: "var(--sh-raised-medium)",
                    color: "var(--paper)", display: "flex", alignItems: "center", gap: 9,
                    fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  }}>
                    <Plus size={16} />{t("mobile.book")}
                  </button>
                }
              />
            }
          />
          {/* Lead full profile sheet */}
          {fullProfileLead && (
            <LeadDetailPanel
              lead={fullProfileLead}
              open={!!fullProfileLead}
              onClose={() => setFullProfileLead(null)}
            />
          )}
        </div>
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={cn(
          "flex flex-col px-0 py-0 bg-transparent",
          isDesktop ? "h-full overflow-hidden"
            : isMobile || isTablet ? "h-auto overflow-y-auto"
            : "h-full overflow-hidden"
        )} data-testid="page-calendar">
          {isDesktop ? (
            <DesktopCalendar
              t={t}
              appts={appts}
              groupedAppts={groupedAppts}
              weekDays={weekDays}
              days={days}
              month={month}
              todayStr={todayStr}
              viewLabel={viewLabel}
              viewMode={(viewMode === "day" ? "week" : viewMode) as "week" | "month"}
              setViewMode={setViewMode}
              onNavigate={navigate}
              onToday={() => setAnchorDate(new Date())}
              selectedBooking={selectedBooking}
              onSelectBooking={setSelectedBooking}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              searchOpen={searchOpen} setSearchOpen={setSearchOpen}
              apptSortBy={apptSortBy} setApptSortBy={setApptSortBy}
              apptGroupBy={apptGroupBy} setApptGroupBy={setApptGroupBy}
              apptGroupDirection={apptGroupDirection} setApptGroupDirection={setApptGroupDirection}
              apptFilterStatuses={apptFilterStatuses} setApptFilterStatuses={setApptFilterStatuses}
              leads={leads} refetchLeads={refetchLeads}
              recentMessages={recentMessages} recentMessagesLoading={recentMessagesLoading}
              onOpenInLead={handleOpenInLead}
              onCloseDetail={() => setSelectedBooking(null)}
              currentTime={currentTime}
              apptListRef={apptListRef}
            />
          ) : (
          <>
          {/* Hidden legacy header */}
          <div className="flex items-center gap-4 mb-6 shrink-0 hidden">
            <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">{t("title")}</h1>
            <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
          </div>

          <div className={cn(
            "flex-1 min-h-0 gap-[3px]",
            isMobile
              ? "flex flex-col h-full overflow-hidden"
              : isTablet
              ? "flex flex-col overflow-y-auto"
              : isNarrowDesktop
              ? (selectedBooking || selectedLead)
                ? "grid grid-cols-[340px_minmax(0,1fr)] overflow-y-auto"
                : "grid grid-cols-[340px_minmax(0,1fr)]"
              : (selectedBooking || selectedLead)
                ? "grid grid-cols-[340px_minmax(0,1386px)_340px]"
                : "grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1386px)]"
          )} data-testid="layout-calendar">

            {/* ══════════════════════════════════════════════════════════════════
                RIGHT PANEL — Calendar views
               ══════════════════════════════════════════════════════════════════ */}
            <div ref={calendarSwipeRef} className={cn(
              "bg-white overflow-hidden flex flex-col rounded-lg order-1 lg:order-2",
              isMobile && viewMode === "month" ? "h-[55vh] shrink-0" : "",
              isMobile && viewMode === "week" ? "h-[360px] shrink-0" : "",
              isMobile && viewMode === "day" ? "flex-1" : "",
              !isMobile && isTablet ? "min-h-[420px]" : "",
              !isMobile && !isTablet ? "h-full" : ""
            )} data-testid="calendar-main" data-onboarding="calendar-view">

              {/* ── Toolbar ── */}
              <div className="px-4 pt-4 pb-3 flex flex-wrap items-center gap-2 shrink-0 bg-white dark:bg-white border-b border-black/[0.06]">
                {/* Date navigation */}
                <div className="flex items-center gap-1.5">
                  <button
                    className="h-9 w-9 rounded-full border border-black/[0.125] bg-transparent hover:bg-white inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(-1)}
                    title={t("navigation.previous")}
                    aria-label={t("navigation.previous")}
                    data-testid="button-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-lg md:text-2xl font-semibold font-heading text-foreground text-center leading-tight" data-testid="text-view-label">
                    {viewLabel}
                  </div>
                  <button
                    className="h-9 w-9 rounded-full border border-black/[0.125] bg-transparent hover:bg-white inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(1)}
                    title={t("navigation.next")}
                    aria-label={t("navigation.next")}
                    data-testid="button-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Mobile-only view toggle — segmented control (44px tall, brand-indigo active) */}
                <div
                  className="md:hidden flex items-center rounded-xl border border-border/60 overflow-hidden ml-auto shrink-0"
                  data-testid="calendar-view-toggle"
                >
                  {MOBILE_CALENDAR_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setViewMode(tab.id as ViewMode)}
                        style={{ minHeight: "44px" }}
                        className={cn(
                          "flex items-center justify-center gap-1 px-3 text-[12px] font-medium transition-colors",
                          viewMode === tab.id
                            ? "bg-brand-indigo text-white"
                            : "bg-transparent text-muted-foreground hover:bg-white"
                        )}
                        data-testid={`calendar-view-btn-${tab.id}`}
                        aria-pressed={viewMode === tab.id}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-[11px]">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Today button */}
                <button
                  className="h-9 px-3 rounded-full border border-black/[0.125] bg-transparent text-[12px] font-medium hover:bg-white"
                  onClick={() => setAnchorDate(new Date())}
                  data-testid="button-today"
                  aria-label={t("navigation.goToToday")}
                >
                  {t("navigation.today")}
                </button>

                {/* + New appointment */}
                <Popover open={bookPopoverOpen} onOpenChange={setBookPopoverOpen}>
                  <PopoverTrigger asChild>
                    <IconBtn className="!h-9 !w-9" title={t("book.newAppointment")}><Plus className="h-4 w-4" /></IconBtn>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 max-w-[calc(100vw-2rem)] p-0 overflow-hidden" align="end">
                    <div className="px-3 pt-3 pb-2 border-b border-border/30">
                      <h3 className="text-[13px] font-semibold font-heading">{t("book.title")}</h3>
                    </div>
                    <div className="p-3 space-y-2.5">
                      {/* Lead search */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={t("search.searchLeadPlaceholder")}
                          value={bookLeadSearch}
                          onChange={(e) => { setBookLeadSearch(e.target.value); setBookSelectedLead(null); }}
                          className="w-full h-9 px-3 rounded-lg border border-border/55 bg-white text-[12px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                        />
                        {bookLeadSearch && !bookSelectedLead && bookFilteredLeads.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border/55 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {bookFilteredLeads.map((l: any) => (
                              <button
                                key={l.id || l.Id}
                                className="w-full px-3 py-2 text-left text-[12px] hover:bg-white flex items-center gap-2"
                                onClick={() => { setBookSelectedLead(l); setBookLeadSearch(l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim()); }}
                              >
                                <span className="truncate">{l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim() || t("appointment.unknownLead")}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Date */}
                      <div className="flex gap-2">
                        <input type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)}
                          className="flex-1 h-9 px-2 rounded-lg border border-border/55 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
                        <input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)}
                          className="w-24 h-9 px-2 rounded-lg border border-border/55 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
                      </div>
                      {/* Duration */}
                      <select value={bookDuration} onChange={(e) => setBookDuration(Number(e.target.value))}
                        className="w-full h-9 px-2 rounded-lg border border-border/55 bg-white text-[12px] focus:outline-none cursor-pointer">
                        {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{t("appointment.minutes", { count: m })}</option>)}
                      </select>
                      {/* Submit */}
                      <button
                        onClick={handleBookLead}
                        disabled={!bookSelectedLead || !bookDate || bookSubmitting}
                        className="w-full h-9 rounded-full bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {bookSubmitting ? t("book.booking") : t("book.bookAppointment")}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Spacer */}
                <div className="flex-1 min-w-0" />

                {/* Inline Booked Calls KPI */}
                <BookedCallsKpi
                  variant="inline"
                  accountId={isAgencyUser ? (effectiveAccountFilter === "all" ? undefined : effectiveAccountFilter) : currentAccountId}
                />
              </div>

              {/* ── Mobile view toggle (always visible on mobile) ── */}
              <div className="md:hidden flex items-center gap-1 px-3 py-2 shrink-0 border-b border-black/[0.06]" data-testid="calendar-view-toggle">
                {MOBILE_CALENDAR_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = viewMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setViewMode(tab.id as ViewMode)}
                      data-testid={`calendar-view-toggle-${tab.id}`}
                      className={cn(
                        "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors duration-150",
                        "min-h-[44px]",
                        isActive
                          ? "bg-brand-indigo text-white shadow-sm"
                          : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-white"
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Month view ── */}
              {viewMode === "month" && (
                <>
                  <div className="grid grid-cols-7 text-xs text-center font-bold text-muted-foreground bg-muted/30 shrink-0" data-testid="row-dow">
                    {(() => {
                      const todayDow = new Date().getDay(); // 0=Sun
                      return DAY_KEYS.map((dk, i) => (
                        <div key={i} className={cn("px-3 py-3", (i === 0 || i === 6) && "bg-muted/10 opacity-70", i === todayDow && "text-brand-indigo")} data-testid={`dow-${i}`}>{t(`days.short.${dk}`)}</div>
                      ));
                    })()}
                  </div>
                  <div className="flex-1 grid grid-cols-7 overflow-y-auto" data-testid="grid-days">
                    {days.map((d, idx) => {
                      const inMonth = d.date.getMonth() === month.getMonth();
                      const isToday = new Intl.DateTimeFormat("en-CA").format(d.date) === todayStr;
                      const isSelected = selectedDate === new Intl.DateTimeFormat("en-CA").format(d.date);
                      const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                      const dateKey = new Intl.DateTimeFormat("en-CA").format(d.date);
                      return (
                        <DroppableDay
                          key={idx}
                          dateKey={dateKey}
                          onClick={() => handleDateClick(dateKey)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDateClick(dateKey); } }}
                          aria-label={t("selectDate", { date: dateKey })}
                          className={cn(
                            "min-h-[40px] md:min-h-[100px] border-b border-r border-border/30 last:border-r-0 p-1 md:p-2 cursor-pointer hover:bg-muted/30 relative",
                            !inMonth && "bg-muted/5 opacity-40",
                            isWeekend && "bg-stone-200/30",
                            isSelected && "bg-brand-indigo/[0.08] z-10",
                            isToday && !isSelected && "bg-teal-600/5"
                          )}
                          data-testid={`day-${idx}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className={cn(
                              "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                              isToday ? "text-white bg-teal-600" : inMonth ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {d.date.getDate()}
                            </div>
                          </div>
                          {d.count > 0 && (
                            <div className="mt-0.5">
                              {/* Mobile: event indicator dots (tappable) */}
                              <div className="md:hidden flex gap-0.5 justify-center flex-wrap">
                                {appts.filter((a) => a.date === dateKey).slice(0, 3).map((a) => {
                                  const apptDate = new Date(a.raw_booked_call_date);
                                  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                                  const isPast = apptDate < todayStart;
                                  return (
                                    <button
                                      key={a.id}
                                      className={cn(
                                        "w-3 h-3 rounded-full shrink-0 flex items-center justify-center",
                                        isPast ? "bg-muted-foreground/40" : a.no_show ? "bg-red-500" : "bg-brand-indigo"
                                      )}
                                      data-testid={`dot-${a.id}`}
                                      aria-label={`Event: ${a.lead_name} at ${a.time}`}
                                      onClick={(e) => { e.stopPropagation(); setMobileEventPopup(a); }}
                                    />
                                  );
                                })}
                              </div>
                              {/* Desktop: event pills */}
                              <div className="hidden md:block space-y-0.5">
                                {appts.filter((a) => a.date === dateKey).slice(0, 2).map((a, ai) => {
                                  const apptDate = new Date(a.raw_booked_call_date);
                                  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                                  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
                                  const isPast = apptDate < todayStart;
                                  const isApptToday = apptDate >= todayStart && apptDate < todayEnd;
                                  const hoverRing = a.no_show ? "hover:ring-red-400" : isPast ? "hover:ring-muted-foreground/40" : isApptToday ? "hover:ring-teal-400" : "hover:ring-amber-400";
                                  const isFutureAmber = !isPast && !a.no_show && !isApptToday;
                                  const pillColor = isPast
                                    ? "bg-muted/70 text-muted-foreground"
                                    : a.no_show
                                      ? "bg-red-600 text-white"
                                      : isApptToday
                                        ? "bg-teal-600 text-white"
                                        : "bg-yellow-400 text-black";
                                  return (
                                    <DraggableBookingCard
                                      key={a.id}
                                      appt={a}
                                      onClick={(e) => { e.stopPropagation(); if (isMobile) { setMobileEventPopup(a); } else { setSelectedBooking(a); } }}
                                      className={cn("text-left overflow-hidden hover:ring-1 hover:ring-inset animate-pill-pop", hoverRing)}
                                      style={{ animationDelay: `${ai * 60}ms` }}
                                    >
                                      <div className={cn(
                                        "h-9 px-2 rounded-full flex flex-col justify-center overflow-hidden",
                                        pillColor
                                      )}>
                                        <span className={cn("text-[9px] font-bold truncate leading-tight",
                                          isPast ? "text-muted-foreground" : isFutureAmber ? "text-black" : "text-white"
                                        )} data-testid={`booking-lead-name-${a.id}`}>{a.lead_name}</span>
                                        <span className={cn("text-[8px] font-medium tabular-nums leading-tight opacity-80",
                                          isPast ? "text-muted-foreground" : isFutureAmber ? "text-black" : "text-white"
                                        )} data-testid={`booking-time-${a.id}`}>{a.time}</span>
                                      </div>
                                    </DraggableBookingCard>
                                  );
                                })}
                                {d.count > 2 && (
                                  <div className="text-[8px] font-bold text-muted-foreground text-center">{t("appointment.more", { count: d.count - 2 })}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </DroppableDay>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Week / Day time grid ── */}
              {(viewMode === "week" || viewMode === "day") && (() => {
                const gridDays = viewMode === "week" ? weekDays : [anchorDate];
                const totalH = 24 * HOUR_H;
                const isWeekMobile = isMobile && viewMode === "week";
                const weekMinW = isWeekMobile ? `${7 * 52 + LABEL_W}px` : undefined;
                return (
                  <div ref={timeGridRef} className={cn("flex-1 overflow-y-auto", isWeekMobile && "overflow-x-auto")} data-testid="grid-time">

                    {/* Sticky day-header row */}
                    <div
                      className={cn("sticky top-0 z-30 flex shrink-0 bg-white border-b border-border/30", isWeekMobile && "min-w-max")}
                      style={{ height: 56, ...(weekMinW ? { minWidth: weekMinW } : {}) }}
                    >
                      <div className="shrink-0 border-r border-border/20" style={{ width: LABEL_W }} />
                      {gridDays.map((d, i) => {
                        const isToday = new Intl.DateTimeFormat("en-CA").format(d) === todayStr;
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div key={i} className={cn(
                            "flex-1 flex flex-col items-center justify-center border-r border-border/20 last:border-r-0 gap-0.5",
                            isToday && "bg-teal-600/5",
                            isWeekend && "bg-muted/50",
                            isWeekMobile && "min-w-[52px]"
                          )}>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              {t(`days.short.${DAY_KEYS[d.getDay()]}`)}
                            </span>
                            <span className={cn("text-lg font-black leading-none", isToday ? "text-teal-600" : "text-foreground")}>
                              {d.getDate()}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time grid coordinate space */}
                    <div className="relative" style={{ height: totalH, ...(weekMinW ? { minWidth: weekMinW } : {}) }}>
                      {/* Time labels */}
                      {hours.map(h => h > 0 ? (
                        <div
                          key={h}
                          className="absolute text-[10px] font-semibold text-muted-foreground leading-none pointer-events-none select-none"
                          style={{
                            top: h * HOUR_H,
                            width: LABEL_W,
                            transform: "translateY(-50%)",
                            textAlign: "right",
                            paddingRight: 8,
                          }}
                        >
                          {h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                        </div>
                      ) : null)}

                      {/* Vertical separator */}
                      <div
                        className="absolute top-0 bottom-0 border-r border-border/20 pointer-events-none"
                        style={{ left: LABEL_W }}
                      />

                      {/* Day columns */}
                      <div className="absolute top-0 bottom-0 right-0 flex" style={{ left: LABEL_W }}>
                        {gridDays.map((d, i) => {
                          const isToday = new Intl.DateTimeFormat("en-CA").format(d) === todayStr;
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const dateKey = new Intl.DateTimeFormat("en-CA").format(d);
                          return (
                            <div key={i} className={cn(
                              "flex-1 relative border-r border-border/20 last:border-r-0",
                              isWeekend && "bg-stone-200/20",
                              isWeekMobile && "min-w-[52px]",
                              isToday && "bg-teal-600/[0.03]"
                            )}>
                              {/* Gridlines */}
                              {hours.map(h => (
                                <div
                                  key={h}
                                  className="absolute left-0 right-0 border-t border-border/20 pointer-events-none"
                                  style={{ top: h * HOUR_H }}
                                />
                              ))}

                              {/* DnD drop zones */}
                              {hours.map(h => (
                                <DroppableTimeSlot key={h} dateKey={dateKey} hour={h} hourHeight={HOUR_H} />
                              ))}

                              {/* Current time line — always visible across all columns */}
                              <div
                                className="absolute left-0 right-0 z-20 pointer-events-none"
                                style={{ top: (currentTime.getHours() * 60 + currentTime.getMinutes()) * (HOUR_H / 60) }}
                              >
                                <div className={cn("absolute inset-x-0", isToday ? "border-t-2 border-teal-500" : "border-t border-teal-400/25")} />
                                {isToday && <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-teal-500" />}
                              </div>

                              {/* Appointment cards */}
                              {appts.filter(a => a.date === dateKey).map((a, ai) => {
                                const endTotalMin = a.hour * 60 + a.minutes + (a.callDurationMinutes || 60);
                                const eH = Math.floor(endTotalMin / 60) % 24;
                                const eM = endTotalMin % 60;
                                const eAmPm = eH >= 12 ? "PM" : "AM";
                                const eH12 = eH % 12 || 12;
                                const endStr = `${eH12}:${String(eM).padStart(2,"0")} ${eAmPm}`;
                                const apptDate = new Date(a.raw_booked_call_date);
                                const dayStart = new Date(); dayStart.setHours(0,0,0,0);
                                const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
                                const isPast = apptDate < dayStart;
                                const isApptToday = apptDate >= dayStart && apptDate < dayEnd;
                                const cardColor = isPast
                                  ? "bg-muted/70 text-muted-foreground hover:ring-muted-foreground/40"
                                  : a.no_show
                                    ? "bg-red-600 text-white hover:ring-red-400"
                                    : isApptToday
                                      ? "bg-teal-600 text-white hover:ring-teal-400"
                                      : "bg-amber-500 text-white hover:ring-amber-400";
                                return (
                                  <DraggableBookingCard
                                    key={a.id}
                                    appt={a}
                                    onClick={(e) => { e.stopPropagation(); if (isMobile) { setMobileEventPopup(a); } else { setSelectedBooking(a); } }}
                                    className={cn(
                                      "absolute left-1 right-1 px-2 py-1.5 rounded-xl shadow-sm z-10 hover:ring-2 overflow-hidden animate-pill-pop",
                                      cardColor
                                    )}
                                    style={{
                                      top: `${(a.hour * 60 + a.minutes) * (HOUR_H / 60)}px`,
                                      height: `${((a.callDurationMinutes || 60) / 60) * HOUR_H - 4}px`,
                                      animationDelay: `${ai * 60}ms`,
                                    }}
                                  >
                                    <div className="flex items-center gap-1 min-w-0">
                                      <div className={cn("text-[10px] font-bold truncate flex-1", isPast ? "text-muted-foreground" : "text-white")} data-testid={`booking-lead-name-${a.id}`}>{a.lead_name}</div>
                                    </div>
                                    <div className={cn("text-[9px] font-medium", isPast ? "text-muted-foreground/70" : "text-white/80")} data-testid={`booking-time-${a.id}`}>
                                      {a.time} — {endStr}
                                    </div>
                                  </DraggableBookingCard>
                                );
                              })}

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right detail panel — 3rd column (reuses ContactSidebar from Chats) */}
            {(selectedBooking || selectedLead) && (() => {
              const panelLead = (selectedBooking?.rawLead ?? selectedLead) as ConversationLead;
              const panelLeadId = panelLead?.id ?? panelLead?.Id;
              const fakeThread = panelLead ? {
                lead: panelLead,
                msgs: [] as Interaction[],
                last: undefined as Interaction | undefined,
                unread: false,
                unreadCount: 0,
              } : null;
              return (
                <div className={cn(
                  "overflow-hidden flex flex-col lg:order-3 h-full",
                  isNarrowDesktop && "col-span-2 max-h-[400px]",
                  (isMobile || isTablet) && "order-3"
                )}>
                  <ContactSidebar
                    selected={fakeThread}
                    onClose={() => { setSelectedBooking(null); setSelectedLead(null); }}
                    onUpdateLead={handleCalendarUpdateLead}
                    className="flex"
                    recentMessages={recentMessages}
                    recentMessagesLoading={recentMessagesLoading}
                    onViewConversation={() => {
                      // Lead chat now lives on the Leads page (Chats page retired)
                      try {
                        if (panelLeadId) localStorage.setItem("selected-lead-id", String(panelLeadId));
                        localStorage.setItem("leads-view-mode", "list");
                      } catch {}
                      goTo(`/platform/contacts`);
                    }}
                    onNavigateToLead={(_leadId) => goTo(`/platform/contacts`)}
                  />
                </div>
              );
            })()}

            {/* ══════════════════════════════════════════════════════════════════
                LEFT PANEL — My Calendar (appointment list)
               ══════════════════════════════════════════════════════════════════ */}
            <div className={cn(
              "bg-white flex flex-col overflow-hidden rounded-lg order-2 lg:order-1",
              isMobile && viewMode === "month" ? "flex-1 min-h-0" : "",
              isMobile && (viewMode === "week" || viewMode === "day") ? "hidden" : "",
              !isMobile && isTablet ? "min-h-[200px] max-h-[300px]" : "",
              !isMobile && !isTablet ? "h-full" : ""
            )} data-testid="calendar-list">

              {/* ── Panel header ── */}
              <div className="pl-[17px] pr-[3px] pt-3 md:pt-10 pb-3 shrink-0 flex items-center">
                <div className="flex items-center justify-between w-full md:w-[309px] shrink-0">
                  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight" data-testid="text-list-title">
                    {t("title")}
                  </h2>
                  <div className="hidden md:block">
                    <ViewTabBar
                      tabs={CALENDAR_TABS}
                      activeId={viewMode}
                      onTabChange={(id) => setViewMode(id as ViewMode)}
                      variant="segment"
                    />
                  </div>
                </div>
              </div>

              {/* Subtitle */}
              {selectedDate && (
                <div className="px-3.5 pb-1 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                    {selectedDate}
                  </span>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="h-4 w-4 rounded-full hover:bg-white flex items-center justify-center text-muted-foreground"
                    title={t("clearDateFilter")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}


              {/* ── List toolbar: search + sort + filter + group + new ── */}
              <div className="px-2 pb-2 flex items-center gap-1 shrink-0">
                <SearchPill
                  value={searchQuery}
                  onChange={setSearchQuery}
                  open={searchOpen}
                  onOpenChange={setSearchOpen}
                  placeholder={t("search.placeholder")}
                />
                {/* Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(xBase, "hover:max-w-[100px]", apptFilterStatuses.length > 0 ? xActive : xDefault)}>
                      <Filter className="h-4 w-4 shrink-0" />
                      <span className={xSpan}>{t("filter.label")}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {(["no_show", "rescheduled", "confirmed"] as ApptFilterStatus[]).map((opt) => (
                      <DropdownMenuItem
                        key={opt}
                        onClick={(e) => { e.preventDefault(); setApptFilterStatuses((prev) => prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt]); }}
                        className="flex items-center gap-2 text-[12px]"
                      >
                        <span className="flex-1">{t(APPT_FILTER_KEYS[opt])}</span>
                        {apptFilterStatuses.includes(opt) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(xBase, "hover:max-w-[80px]", apptSortBy !== "time_desc" ? xActive : xDefault)}>
                      <ArrowUpDown className="h-4 w-4 shrink-0" />
                      <span className={xSpan}>{t("sort.label")}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {APPT_SORT_GROUPS.map((group) => {
                      const isActive = apptSortBy === group.asc || apptSortBy === group.desc;
                      const activeDir: "asc" | "desc" = apptSortBy === group.asc ? "asc" : "desc";
                      return (
                        <DropdownMenuItem
                          key={group.key}
                          onSelect={(e) => { e.preventDefault(); setApptSortBy(isActive ? apptSortBy : group.desc); }}
                          className="text-[12px] flex items-center gap-2"
                        >
                          <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{t(group.label)}</span>
                          {isActive && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setApptSortBy(group.asc); }}
                                className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                                title={t("a11y.sortAscending")}
                                aria-label={t("a11y.sortAscending")}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setApptSortBy(group.desc); }}
                                className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                                title={t("a11y.sortDescending")}
                                aria-label={t("a11y.sortDescending")}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Group */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(xBase, "hover:max-w-[100px]", apptGroupBy !== "date" ? xActive : xDefault)}>
                      <Layers className="h-4 w-4 shrink-0" />
                      <span className={xSpan}>{t("group.label")}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {(["date", "campaign", "status", "none"] as ApptGroupBy[]).map((opt) => (
                      <DropdownMenuItem
                        key={opt}
                        onSelect={(e) => { e.preventDefault(); setApptGroupBy(opt); }}
                        className="text-[12px] flex items-center gap-2"
                      >
                        <span className={cn("flex-1", apptGroupBy === opt && "font-semibold !text-brand-indigo")}>{t(APPT_GROUP_KEYS[opt])}</span>
                        {apptGroupBy === opt && opt !== "none" && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setApptGroupDirection("asc"); }}
                              className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", apptGroupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                              title={t("a11y.sortAscending")}
                              aria-label={t("a11y.sortAscending")}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setApptGroupDirection("desc"); }}
                              className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", apptGroupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                              title={t("a11y.sortDescending")}
                              aria-label={t("a11y.sortDescending")}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </>
                        )}
                        {apptGroupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* New appointment */}
                <button className={cn(xBase, "hover:max-w-[100px]", xDefault)} onClick={() => setBookPopoverOpen(true)}>
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("book.newAppointment")}</span>
                </button>
              </div>

              {/* ── Appointment list ── */}
              <div ref={apptListRef} className="la-list-area">
                {totalApptCount === 0 ? (
                  <div data-testid="empty-appts">
                    <DataEmptyState variant="calendar" compact />
                  </div>
                ) : (
                  <div className="la-cards">
                    {groupedAppts.map((group, gi) => (
                      <div key={gi} data-group-wrapper className="flex flex-col gap-[3px]">
                        {group.label && (
                          <ApptGroupHeader label={group.label} count={group.items.length} />
                        )}
                        {group.items.map((a, ai) => (
                          <div key={a.id} data-appt-id={a.id} className="animate-card-enter" style={{ animationDelay: `${Math.min(ai, 15) * 30}ms` }}>
                            <AppointmentCard
                              appt={a}
                              isActive={selectedBooking?.id === a.id}
                              onSelect={() => { if (isMobile) { setMobileEventPopup(a); } else { setSelectedBooking(a); } }}
                              onSelectLead={handleSelectLead}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
          )}

          {/* Lead full profile sheet */}
          {fullProfileLead && (
            <LeadDetailPanel
              lead={fullProfileLead}
              open={!!fullProfileLead}
              onClose={() => setFullProfileLead(null)}
            />
          )}

          {/* Drag Overlay */}
          <DragOverlay>
            {activeAppt ? (
              <div
                className={cn(
                  "px-2 py-1.5 rounded-xl shadow-xl opacity-90 min-w-[120px] max-w-[200px]",
                  activeAppt.no_show
                    ? "bg-red-600 text-white"
                    : "bg-[#4F46E5] text-white"
                )}
                data-testid="drag-overlay"
              >
                <div className="text-[10px] font-bold truncate text-white">
                  {activeAppt.lead_name}
                </div>
                <div className="text-[9px] font-medium text-white/80">
                  {activeAppt.time}
                </div>
              </div>
            ) : null}
          </DragOverlay>

          {/* Persistent inline reschedule error (with Retry) */}
          {dragError && (
            <div
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[299] max-w-md w-[calc(100%-2rem)] rounded-lg border border-destructive/30 bg-destructive/5 backdrop-blur px-4 py-3 flex items-start gap-3 shadow-lg"
              data-testid="drag-error-banner"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground">
                  {t("errors.rescheduleFailed")} {dragError.leadName ? `(${dragError.leadName})` : ""}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 break-words">{dragError.message}</div>
              </div>
              <button
                type="button"
                onClick={retryDragReschedule}
                disabled={dragRetrying}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-brand-indigo text-white text-[11px] font-semibold hover:brightness-110 disabled:opacity-60 shrink-0"
                data-testid="button-retry-reschedule"
                aria-label={t("errors.retry")}
              >
                <RefreshCw className={cn("h-3 w-3", dragRetrying && "animate-spin")} />
                {t("errors.retry")}
              </button>
              <button
                type="button"
                onClick={() => setDragError(null)}
                className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white shrink-0"
                aria-label={t("common.close", "Close")}
                data-testid="button-dismiss-drag-error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Toast */}
          {dragToast && (
            <div
              className={cn(
                "fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-full shadow-2xl text-sm font-semibold flex items-center gap-2",
                dragToast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
              )}
              data-testid="drag-toast"
            >
              {dragToast.type === "success" ? (
                <RefreshCw className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {dragToast.message}
            </div>
          )}
        </div>
      </DndContext>

      {/* Mobile Event Popup — floating card shown when tapping a calendar event on mobile */}
      {mobileEventPopup && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center px-4"
          data-testid="mobile-event-popup-backdrop"
          onClick={() => setMobileEventPopup(null)}
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4"
            data-testid="mobile-event-popup"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: lead name (tappable) + close */}
            <div className="flex items-start justify-between gap-2">
              <button
                className="flex items-center gap-3 min-w-0 text-left"
                data-testid="popup-lead-name-btn"
                onClick={() => {
                  const leadId = mobileEventPopup.rawLead?.id ?? mobileEventPopup.rawLead?.Id;
                  setMobileEventPopup(null);
                  try {
                    localStorage.setItem("selected-lead-id", String(leadId));
                    localStorage.setItem("leadawaker-returnto", "/platform/calendar");
                  } catch {}
                  goTo("/platform/contacts");
                }}
              >
                <EntityAvatar
                  name={mobileEventPopup.lead_name}
                  bgColor={getLeadStatusAvatarColor(mobileEventPopup.rawLead?.status || mobileEventPopup.rawLead?.Status || "").bg}
                  textColor={getLeadStatusAvatarColor(mobileEventPopup.rawLead?.status || mobileEventPopup.rawLead?.Status || "").text}
                  size={40}
                />
                <div className="min-w-0">
                  <div className="text-base font-bold text-foreground leading-tight truncate underline-offset-2 hover:underline" data-testid="popup-lead-name">
                    {mobileEventPopup.lead_name}
                  </div>
                  {mobileEventPopup.campaign_name && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5" data-testid="popup-campaign">
                      {mobileEventPopup.campaign_name}
                    </div>
                  )}
                </div>
              </button>
              <button
                className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-white transition-colors"
                onClick={() => setMobileEventPopup(null)}
                aria-label="Close popup"
                data-testid="popup-close-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Details */}
            <div className="flex flex-col gap-2">
              {/* Time */}
              <div className="flex items-center gap-2 text-sm text-foreground">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span data-testid="popup-time">{mobileEventPopup.formattedDate} · {mobileEventPopup.time}</span>
              </div>
              {/* Phone */}
              {mobileEventPopup.phone && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span data-testid="popup-phone">{mobileEventPopup.phone}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                className="flex-1 h-10 rounded-xl bg-brand-indigo text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-brand-indigo/90 transition-colors"
                data-testid="popup-view-lead-btn"
                onClick={() => {
                  const leadId = mobileEventPopup.rawLead?.id ?? mobileEventPopup.rawLead?.Id;
                  setMobileEventPopup(null);
                  try {
                    localStorage.setItem("selected-lead-id", String(leadId));
                    localStorage.setItem("leadawaker-returnto", "/platform/calendar");
                  } catch {}
                  goTo("/platform/contacts");
                }}
              >
                View Lead
              </button>
              <button
                className="h-10 px-4 rounded-xl bg-white text-foreground text-sm font-medium flex items-center justify-center hover:bg-muted/80 transition-colors"
                data-testid="popup-dismiss-btn"
                onClick={() => setMobileEventPopup(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </CrmShell>
  );
}
