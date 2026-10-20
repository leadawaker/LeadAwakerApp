import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Building2, CalendarCheck, ChevronDown, ChevronUp, UserRound } from "lucide-react";
import { Card, CardLabel } from "@/features/leads/components/cardView/designPrimitives";
import { setPersistedSelection } from "@/hooks/usePersistedSelection";
import type { VoiceCaller, VoiceCallDetail, VoiceCallListItem } from "../api/voiceCallsApi";
import { formatDateTime, formatDurationUnits } from "../format";
import { CallBooking, CallSummaryCard } from "./CallRecap";
import { SOFT_RAISED } from "./bits";
import { OutcomePill, slotLabel } from "./OutcomePill";
import { SIDEBAR_WIDTH } from "./VoiceCallsSkeleton";

/** Callers view only: the person behind the selected call and their other calls. */
export interface CallerContext {
  /** Masked for presenting mode: what is shown. */
  caller: VoiceCaller;
  /** Unmasked: what is dialled and pushed. */
  rawCaller: VoiceCaller;
  isOwner: boolean;
  /** The call being shown, highlighted in the history even while it loads. */
  selectedId: string;
  /** This person's calls, newest first. */
  calls: VoiceCallListItem[];
  onSelectCall: (callId: string) => void;
}

const CHIP: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)",
  borderRadius: "var(--r-pill)", padding: "5px 12px 5px 10px", color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 600,
  textDecoration: "none", whiteSpace: "nowrap", maxWidth: "100%",
};

const HISTORY_SHOWN = 3;

/** One call of this person as its own tile: "Call 3 · Booked", length, date. */
function CallTile({ call, number, active, onClick }: { call: VoiceCallListItem; number: number; active: boolean; onClick: () => void }) {
  const { t, i18n } = useTranslation("voiceCalls");
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="voice-caller-call"
      aria-pressed={active}
      style={{
        ...SOFT_RAISED,
        display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, width: "100%", textAlign: "left", border: "none", cursor: "pointer",
        padding: "10px 12px", borderRadius: "var(--r-surface)", fontFamily: "var(--sans)", color: "var(--ink)",
        background: active ? "var(--wine-tint)" : "var(--card)",
        boxShadow: active ? "inset 0 0 0 1.5px color-mix(in srgb, var(--wine) 40%, transparent)" : "var(--sh-raised-crisp)",
        transition: "background 130ms, box-shadow 130ms",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <OutcomePill outcome={call.outcome} bookedSlot={call.bookedSlot} bookedIso={call.bookedIso} prefix={t("callers.callNumber", { n: number })} small />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {formatDurationUnits(call.durationSeconds, t)}
        </span>
      </span>
      <span style={{ fontSize: 12, color: "var(--mute)", fontVariantNumeric: "tabular-nums" }}>{formatDateTime(call.startedAt, i18n.language)}</span>
    </button>
  );
}

/**
 * This person's calls (from the callers data, so it stays up while a call
 * loads): the latest three, the rest behind "Show more". Numbered from the
 * oldest, so the latest call has the highest number.
 */
export function CallerHistory({ ctx, divider = true }: { ctx: CallerContext; divider?: boolean }) {
  const { t } = useTranslation("voiceCalls");
  const [all, setAll] = useState(false);
  // An older call that is selected keeps the full list open.
  const open = all || ctx.calls.findIndex((c) => c.callId === ctx.selectedId) >= HISTORY_SHOWN;
  const shown = open ? ctx.calls : ctx.calls.slice(0, HISTORY_SHOWN);
  const hidden = ctx.calls.length - HISTORY_SHOWN;
  const total = ctx.calls.length;
  return (
    <Card
      variant="flat"
      headLeft={<CardLabel>{t("callers.calls")}</CardLabel>}
      headRight={<span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--mute)" }}>{total}</span>}
      style={{ borderTop: divider ? "1px solid var(--line)" : undefined }}
      bodyStyle={{ padding: "12px 14px 14px", gap: 8 }}
    >
      {shown.map((c, i) => (
        <CallTile key={c.callId} call={c} number={total - i} active={c.callId === ctx.selectedId} onClick={() => ctx.onSelectCall(c.callId)} />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          data-testid="voice-caller-calls-more"
          className="la-btn la-btn--soft"
          style={{ ...SOFT_RAISED, alignSelf: "center", marginTop: 4 }}
        >
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {open ? t("callers.showLess") : t("callers.showMore", { count: hidden })}
        </button>
      )}
    </Card>
  );
}

/**
 * Opens the Leads page on this lead, the way the Calendar and the
 * notifications do: preselect it, then go to the list. (A /platform/contacts/:id
 * link never reaches the CRM router: App.tsx only forwards one segment after /platform.)
 */
function useOpenLead() {
  const [, setLocation] = useLocation();
  return (leadId: number) => {
    try {
      setPersistedSelection("selected-lead-id", leadId);
      localStorage.setItem("leadawaker-returnto", "/platform/voice-calls");
    } catch { /* private mode: the page still opens */ }
    setLocation("/platform/contacts");
  };
}

function Details({ call, ctx, divider }: { call: VoiceCallDetail; ctx?: CallerContext; divider: boolean }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const openLead = useOpenLead();
  const caller = ctx?.caller;
  const leadId = caller ? caller.leadsId : call.leadsId;
  const slot = caller && (caller.bookedSlot || caller.bookedIso) ? slotLabel(caller.bookedIso, caller.bookedSlot, i18n.language) : null;
  const demo = call.scope === "demo";
  const company = caller ? caller.personaCompany : demo ? call.personaCompany || t("persona.universal") : null;
  const niche = !caller && demo ? call.personaNiche : null;
  const meta = [call.language ? call.language.toUpperCase() : null, t("turns", { count: call.turnCount })].filter(Boolean).join(" · ");

  return (
    <Card variant="flat" headLeft={<CardLabel>{t("sections.details")}</CardLabel>} style={{ borderTop: divider ? "1px solid var(--line)" : undefined }} bodyStyle={{ padding: "14px 16px 18px", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {leadId != null && (
          <button
            type="button"
            onClick={() => openLead(leadId)}
            className="la-btn la-btn--soft"
            style={SOFT_RAISED}
            title={t("callers.openLead")}
            data-testid="voice-caller-lead-chip"
          >
            <UserRound size={13} style={{ color: "var(--wine)" }} />
            {t("callers.lead")}
          </button>
        )}
        {slot && (
          <span style={CHIP} data-testid="voice-caller-booking-chip">
            <CalendarCheck className="h-[13px] w-[13px]" style={{ color: "var(--good)" }} />
            {t("callers.booked")}
            <span style={{ fontWeight: 400, color: "var(--mute)" }}>{`· ${slot}`}</span>
          </span>
        )}
        {company && (
          <span style={CHIP}>
            <Building2 className="h-[13px] w-[13px] shrink-0" style={{ color: "var(--wine)" }} />
            {company}
            {niche && <span style={{ fontWeight: 400, color: "var(--mute)" }}>{`· ${niche}`}</span>}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.06em", color: "var(--mute)" }}>{meta}</div>
    </Card>
  );
}

/**
 * Left column, like the Chats recap sidebar: the booking, the summary under
 * it, then (Callers view) this person's calls, then the details.
 */
export function CallSidebar({ call, narrow, caller }: { call: VoiceCallDetail; narrow: boolean; caller?: CallerContext }) {
  const booked = !!call.bookedSlot;
  const history = !!caller && caller.calls.length > 0;
  // The summary sits in here now, so on a wide screen the column takes a bit more room.
  const width = narrow ? "auto" : SIDEBAR_WIDTH;
  return (
    <div
      className="neu-raised"
      data-testid="voice-call-sidebar"
      style={{
        width, flexShrink: 0, minHeight: 0, borderRadius: "var(--r-card)", background: "var(--card)",
        overflowX: "hidden", overflowY: narrow ? "hidden" : "auto",
      }}
    >
      <CallBooking call={call} />
      <CallSummaryCard call={call} divider={booked} />
      {caller && history && <CallerHistory ctx={caller} />}
      <Details call={call} ctx={caller} divider />
    </div>
  );
}
