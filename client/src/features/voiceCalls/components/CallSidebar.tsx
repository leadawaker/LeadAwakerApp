import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Building2, ChevronDown, ChevronUp, UserRound } from "lucide-react";
import { Card, CardLabel } from "@/features/leads/components/cardView/designPrimitives";
import { openLead } from "@/lib/leadLink";
import type { VoiceCaller, VoiceCallDetail, VoiceCallListItem } from "../api/voiceCallsApi";
import { formatDateTime, formatDurationUnits } from "../format";
import { CallBooking, CallSummaryCard } from "./CallRecap";
import { SOFT_RAISED } from "./bits";
import { OutcomePill } from "./OutcomePill";
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

/** One call of this person: "Call 3 · Booked", length, date. Flat until opened, like the list cards. */
function CallTile({ call, number, active, onClick }: { call: VoiceCallListItem; number: number; active: boolean; onClick: () => void }) {
  const { t, i18n } = useTranslation("voiceCalls");
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="voice-caller-call"
      aria-pressed={active}
      className={active ? "la-camp-card active" : "la-camp-card"}
      style={{
        flexDirection: "column", alignItems: "stretch", gap: 6, width: "100%", textAlign: "left", border: "none",
        padding: "10px 12px", fontFamily: "var(--sans)", color: "var(--ink)",
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
      bodyStyle={{ padding: "12px 14px 14px", gap: 3 }}
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
 * Opens this lead in its one home (Chats with the lead selected, lib/leadLink),
 * with a way back to Calls on the phone.
 */
function useOpenLead() {
  const [, setLocation] = useLocation();
  return (leadId: number) => {
    try { localStorage.setItem("leadawaker-returnto", "/platform/voice-calls"); } catch { /* private mode: the page still opens */ }
    openLead(setLocation, leadId);
  };
}

function Details({ call, ctx, divider }: { call: VoiceCallDetail; ctx?: CallerContext; divider: boolean }) {
  const { t } = useTranslation("voiceCalls");
  const openLead = useOpenLead();
  const caller = ctx?.caller;
  const leadId = caller ? caller.leadsId : call.leadsId;
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
 * Left column, like the Chats recap sidebar: (Callers view) this person's calls
 * first, then the booking, the summary under it, then the details.
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
      {caller && history && <CallerHistory ctx={caller} divider={false} />}
      <CallBooking call={call} divider={history} />
      <CallSummaryCard call={call} divider={booked || history} />
      <Details call={call} ctx={caller} divider />
    </div>
  );
}
