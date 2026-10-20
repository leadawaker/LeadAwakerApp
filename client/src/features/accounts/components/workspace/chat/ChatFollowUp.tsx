// Chat > Follow-up and Chat > Active hours.
//
// The receptionist follow-up (engine receptionist_bump.py) is one line at most,
// only when a WhatsApp chat stopped mid-question. It runs for campaigns with
// bump_mode 'receptionist'; on/off is max_bumps 1/0. bump_mode itself is never
// cleared here: NULL would hand the leads to the reactivation bump ladder.
// The 3 to 20 hour window is fixed in the engine, so it is shown, not edited.
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Clock, ExternalLink, MessageSquareText } from "lucide-react";
import { InfoRow } from "@/features/campaigns/components/formFields";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ChatCard, SwitchRow, helpStyle, hhmm, type ChatEdit } from "./chatAtoms";

/** Prompt_Library row holding the follow-up's instructions (use_case system:receptionist-bump). */
const FOLLOW_UP_PROMPT_ID = 125;

export const isReceptionistBump = (campaign: Record<string, unknown>) =>
  String(campaign.bump_mode ?? "").trim().toLowerCase() === "receptionist";

export const followUpOn = (draft: Record<string, unknown>) => Number(draft.max_bumps ?? 1) >= 1;

export function ChatFollowUp(p: ChatEdit) {
  const { t } = useTranslation("chatTab");
  const { isOwner } = useWorkspace();
  const [, navigate] = useLocation();
  const { campaign, draft, setDraft, canEdit } = p;

  if (!isReceptionistBump(campaign)) {
    return (
      <ChatCard icon={<MessageSquareText size={17} />} title={t("followUp.title")} testId="chat-card-followup">
        <p style={{ ...helpStyle, margin: 0 }}>{t("followUp.notReceptionist")}</p>
      </ChatCard>
    );
  }

  const openPrompt = () => {
    try { localStorage.setItem("prompt-library-initial-id", String(FOLLOW_UP_PROMPT_ID)); } catch { /* the page opens without the row selected */ }
    navigate("/platform/prompt-library");
  };

  return (
    <ChatCard icon={<MessageSquareText size={17} />} title={t("followUp.title")} testId="chat-card-followup">
      <p style={helpStyle}>{t("followUp.help")}</p>
      <SwitchRow
        checked={followUpOn(draft)} onChange={(v) => setDraft((d) => ({ ...d, max_bumps: v ? 1 : 0 }))} disabled={!canEdit}
        label={t("followUp.switch")} help={t("followUp.switchHelp")} testId="chat-followup-switch"
      />
      <InfoRow label={t("followUp.when")} value={t("followUp.whenValue")} description={t("followUp.whenHelp")} />
      <InfoRow label={t("followUp.what")} value={t("followUp.whatValue")} noBorder />
      {isOwner && (
        <button type="button" className="la-btn la-btn--soft" onClick={openPrompt} style={{ marginTop: 8 }} data-testid="chat-followup-prompt">
          {t("followUp.openPrompt", { id: FOLLOW_UP_PROMPT_ID })} <ExternalLink size={13} />
        </button>
      )}
    </ChatCard>
  );
}

export function ChatHours(p: ChatEdit) {
  const { t } = useTranslation("chatTab");
  const { draft, setDraft, canEdit } = p;
  const start = hhmm(draft.active_hours_start);
  const end = hhmm(draft.active_hours_end);
  const input = (field: "active_hours_start" | "active_hours_end", value: string) => (
    <input
      type="time" value={value} className="la-input" style={{ maxWidth: 140 }} aria-label={t(`hours.${field}`)} data-testid={`chat-${field}`}
      onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
    />
  );

  return (
    <ChatCard icon={<Clock size={17} />} title={t("hours.title")} testId="chat-card-hours">
      <p style={helpStyle}>{t("hours.help")}</p>
      <InfoRow
        label={t("hours.label")} value={start && end ? t("hours.range", { start, end }) : t("hours.unset")} noBorder
        editChild={canEdit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {input("active_hours_start", start)}
            <span style={{ color: "var(--mute)", fontSize: 13 }}>{t("hours.to")}</span>
            {input("active_hours_end", end)}
          </div>
        ) : undefined}
      />
    </ChatCard>
  );
}
