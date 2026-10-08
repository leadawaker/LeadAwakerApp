import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Building2, CalendarCheck, UserRound } from "lucide-react";
import { Card, CardLabel } from "@/features/leads/components/cardView/designPrimitives";
import type { VoiceCaller, VoiceCallDetail, VoiceCallListItem } from "../api/voiceCallsApi";
import { formatDateTime, formatDuration } from "../format";
import { CallRecap } from "./CallRecap";
import { OutcomePill, slotLabel } from "./OutcomePill";

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
  display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
  borderRadius: "var(--r-pill)", padding: "4px 11px 4px 9px", color: "var(--ink-soft)", fontSize: 11.5, fontWeight: 600,
  textDecoration: "none", whiteSpace: "nowrap", maxWidth: "100%",
};

function CallRow({ call, active, onClick }: { call: VoiceCallListItem; active: boolean; onClick: () => void }) {
  const { i18n } = useTranslation("voiceCalls");
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="voice-caller-call"
      aria-pressed={active}
      style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 8px", width: "100%", textAlign: "left", border: "none", cursor: "pointer",
        padding: "7px 10px", borderRadius: "var(--r-surface)", fontFamily: "var(--sans)",
        background: active ? "var(--wine-tint)" : "transparent", color: "var(--ink)",
      }}
    >
      <OutcomePill outcome={call.outcome} bookedSlot={call.bookedSlot} bookedIso={call.bookedIso} small />
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", flexShrink: 0 }}>{formatDuration(call.durationSeconds)}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", flexShrink: 0 }}>{formatDateTime(call.startedAt, i18n.language)}</span>
    </button>
  );
}

/** This person's calls (from the callers data, so it stays up while a call loads). */
export function CallerHistory({ ctx }: { ctx: CallerContext }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <Card
      variant="flat"
      headLeft={<CardLabel>{t("callers.calls")}</CardLabel>}
      headRight={<span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--mute-2)" }}>{ctx.calls.length}</span>}
      style={{ borderTop: "1px solid var(--line)" }}
      bodyStyle={{ padding: "8px 10px 10px", gap: 2 }}
    >
      {ctx.calls.map((c) => (
        <CallRow key={c.callId} call={c} active={c.callId === ctx.selectedId} onClick={() => ctx.onSelectCall(c.callId)} />
      ))}
    </Card>
  );
}

function Details({ call, ctx }: { call: VoiceCallDetail; ctx?: CallerContext }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const conclusion = call.conclusion ?? call.summary?.outcome ?? null;
  const caller = ctx?.caller;
  const slot = caller && (caller.bookedSlot || caller.bookedIso) ? slotLabel(caller.bookedIso, caller.bookedSlot, i18n.language) : null;
  const demo = call.scope === "demo";
  const company = caller ? caller.personaCompany : demo ? call.personaCompany || t("persona.universal") : null;
  const niche = !caller && demo ? call.personaNiche : null;
  const meta = [call.language ? call.language.toUpperCase() : null, t("turns", { count: call.turnCount })].filter(Boolean).join(" · ");

  return (
    <Card variant="flat" headLeft={<CardLabel>{t("sections.details")}</CardLabel>} style={{ borderTop: "1px solid var(--line)" }} bodyStyle={{ padding: "14px 16px 18px", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {caller?.leadsId != null && (
          <Link href={`/platform/contacts/${caller.leadsId}`} style={CHIP} data-testid="voice-caller-lead-chip">
            <UserRound className="h-[12px] w-[12px]" style={{ color: "var(--wine)" }} />
            {t("callers.lead")}
          </Link>
        )}
        {slot && (
          <span style={CHIP} data-testid="voice-caller-booking-chip">
            <CalendarCheck className="h-[12px] w-[12px]" style={{ color: "var(--good)" }} />
            {t("callers.booked")}
            <span style={{ fontWeight: 400, color: "var(--mute)" }}>{`· ${slot}`}</span>
          </span>
        )}
        {company && (
          <span style={CHIP}>
            <Building2 className="h-[12px] w-[12px] shrink-0" style={{ color: "var(--wine)" }} />
            {company}
            {niche && <span style={{ fontWeight: 400, color: "var(--mute)" }}>{`· ${niche}`}</span>}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--mute)" }}>{meta}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--mute)", marginBottom: 4 }}>{t("sections.outcome")}</div>
        <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.45, color: conclusion ? "var(--ink)" : "var(--mute)" }}>
          {conclusion || t("noSummary")}
        </p>
      </div>
    </Card>
  );
}

/** Right column: recap, then (Callers view) this person's calls, then the details. */
export function CallSidebar({ call, narrow, caller }: { call: VoiceCallDetail; narrow: boolean; caller?: CallerContext }) {
  return (
    <div
      className="neu-raised"
      data-testid="voice-call-sidebar"
      style={{
        width: narrow ? "auto" : 310, flexShrink: 0, minHeight: 0, borderRadius: "var(--r-card)", background: "var(--card)",
        overflowX: "hidden", overflowY: narrow ? "hidden" : "auto",
      }}
    >
      <CallRecap call={call} />
      {caller && caller.calls.length > 0 && <CallerHistory ctx={caller} />}
      <Details call={call} ctx={caller} />
    </div>
  );
}
