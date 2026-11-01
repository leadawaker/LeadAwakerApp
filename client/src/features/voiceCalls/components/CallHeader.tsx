import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { openLead } from "@/lib/leadLink";
import { updateLead } from "@/features/leads/api/leadsApi";
import type { VoiceCallDetail } from "../api/voiceCallsApi";
import { callerStatus } from "../callers";
import { formatDateTime, formatDuration } from "../format";
import { callStatus } from "../status";
import { CallAvatar, callerIni, callerTitle } from "./bits";
import { CallBackButton } from "./CallBackButton";
import type { CallerContext } from "./CallSidebar";
import { HubspotPushButton } from "./HubspotPushButton";
import { OutcomePill } from "./OutcomePill";

/**
 * Opens this lead in its one home (Chats with the lead selected, lib/leadLink),
 * with a way back to Calls on the phone.
 */
export function useOpenLead() {
  const [, setLocation] = useLocation();
  return (leadId: number) => {
    try { localStorage.setItem("leadawaker-returnto", "/platform/voice-calls"); } catch { /* private mode: the page still opens */ }
    openLead(setLocation, leadId);
  };
}

const NAME: React.CSSProperties = {
  fontFamily: "var(--sans)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.15, letterSpacing: "-0.01em",
};

/**
 * The name, editable in place on the People view (the name there is the lead's,
 * so a save shows straight away). Enter or blur saves, Escape cancels.
 */
function CallerName({ title, editId, size }: { title: string; editId: number | null; size: number }) {
  const { t } = useTranslation("voiceCalls");
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (draft == null || editId == null || saving) return;
    const next = draft.trim();
    if (!next || next === title) { setDraft(null); return; }
    const parts = next.split(/\s+/);
    setSaving(true);
    try {
      await updateLead(editId, { first_name: parts[0] || "", last_name: parts.slice(1).join(" ") });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/voice-calls/callers"] }),
        qc.invalidateQueries({ queryKey: ["/api/voice-calls"] }),
      ]);
    } catch { /* the old name stays */ } finally {
      setSaving(false);
      setDraft(null);
    }
  };

  if (draft != null) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setDraft(null); }}
        autoFocus
        disabled={saving}
        aria-label={t("callers.editName")}
        data-testid="voice-call-header-name-input"
        style={{ ...NAME, fontSize: size, width: "100%", minWidth: 0, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", border: "none", borderRadius: "var(--r-button)", padding: "2px 8px", margin: "-2px -8px", outline: "none" }}
      />
    );
  }
  return (
    <span
      onClick={editId != null ? () => setDraft(title) : undefined}
      title={editId != null ? t("callers.editName") : undefined}
      data-testid="voice-call-header-name"
      style={{ ...NAME, fontSize: size, overflowWrap: "anywhere", cursor: editId != null ? "text" : "default" }}
    >
      {title}
    </span>
  );
}

/**
 * The top of the lead panel: avatar (opens the lead), the name, the number under
 * it, when the call was and how long, how it ended, then the caller actions
 * (Callers view).
 */
export function CallHeader({ call, narrow, caller, masked = false }: { call: VoiceCallDetail; narrow: boolean; caller?: CallerContext; masked?: boolean }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const goToLead = useOpenLead();
  const who = caller ? { callerName: caller.caller.name, callerNumber: caller.caller.phone } : call;
  const status = caller ? callerStatus(caller.caller) : callStatus(call);
  const phone = who.callerName && who.callerNumber ? who.callerNumber : null;
  const leadId = caller ? caller.caller.leadsId : call.leadsId;
  // Only the People view shows the lead's own name (All calls shows the name from the
  // call's summary), so only there does an edit show up. Never while presenting.
  const editId = caller && !masked ? caller.caller.leadsId : null;
  const demo = call.scope === "demo";
  const company = caller ? caller.personaCompany : demo ? call.personaCompany || t("persona.universal") : null;
  const niche = !caller && demo ? call.personaNiche : null;

  const avatar = <CallAvatar ini={callerIni(who, t("webCaller"))} status={status} size={56} />;

  const identity = (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 14 }}>
      {leadId != null ? (
        <button
          type="button"
          onClick={() => goToLead(leadId)}
          aria-label={t("callers.openLead")}
          title={t("callers.openLead")}
          data-testid="voice-call-header-avatar"
          style={{ padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 16, flexShrink: 0 }}
        >
          {avatar}
        </button>
      ) : avatar}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, paddingTop: 2 }}>
        <CallerName title={callerTitle(who, t("webCaller"))} editId={editId} size={narrow ? 19 : 21} />
        {phone && (
          <span data-testid="voice-call-header-phone" style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>{phone}</span>
        )}
      </div>
    </div>
  );

  return (
    <div data-testid="voice-call-header" style={{ padding: narrow ? "14px 14px" : "18px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      {caller ? (
        <CallBackButton
          caller={caller.rawCaller}
          before={identity}
          // The HubSpot push is a demo of the CRM handoff: Demo calls only.
          after={caller.isOwner && call.scope === "demo" ? <HubspotPushButton caller={caller.rawCaller} /> : null}
        />
      ) : identity}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", fontVariantNumeric: "tabular-nums" }}>
          <span data-testid="voice-call-header-when" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{formatDateTime(call.startedAt, i18n.language)}</span>
          <span style={{ fontSize: 13, color: "var(--mute)" }}>{formatDuration(call.durationSeconds)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <OutcomePill outcome={call.outcome} bookedSlot={call.bookedSlot} bookedIso={call.bookedIso} />
          {company && (
            <span data-testid="voice-call-header-company" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", minWidth: 0 }}>
              <Building2 className="h-[13px] w-[13px] shrink-0" style={{ color: "var(--wine)" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {company}
                {niche && <span style={{ fontWeight: 400, color: "var(--mute)" }}>{` · ${niche}`}</span>}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
