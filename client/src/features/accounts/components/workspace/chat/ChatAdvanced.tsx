// Chat > Advanced (Owner only): the receptionist campaign's engine fields the
// other sections leave out, so they stay editable now that the Campaigns page
// is hidden. Every field here is read by the Python engine (checked against
// the automations repo, 2026-10-22). Left out on purpose: ai_temperature (no
// such column; the conversation temperature comes from the linked prompt) and
// ai_style_override (already edited as Behaviour > Tone). The inputs are the
// campaign settings' own fields; changes land in the shared draft and autosave.
import { useTranslation } from "react-i18next";
import { Cpu, GitBranch, Clock, ShieldCheck, Repeat, HelpCircle } from "lucide-react";
import { EditNumber, EditSelect, EditText, InfoRow } from "@/features/campaigns/components/formFields";
import { AiDisclosureField } from "@/features/campaigns/components/settings/AiDisclosureField";
import { ObjectionPlaybookField } from "@/features/campaigns/components/settings/ObjectionPlaybookField";
import { MODEL_OPTIONS } from "@/features/prompts/types";
import { ChatCard, SwitchRow, helpStyle, useLocalized, type ChatEdit } from "./chatAtoms";

const CONVERSATION_MODES = ["", "scoping", "decision"];
// The values the engine acts on: "Call Agent" turns on the buying-signal alert
// (buying_signal_classifier.py), "Qualifying" skips the booking step
// (conversation/funnel.py). The Campaigns page's "Sales Call" / "Direct
// Booking" only reach the prompt when booking_mode_call is empty, which it is
// not on the receptionist campaigns, so they are offered only when stored.
const BOOKING_MODES = ["", "Call Agent", "Qualifying"];
const TYPO_COUNTS = ["0", "1", "2", "3"];

export function ChatAdvanced(p: ChatEdit) {
  const { t } = useTranslation("chatTab");
  const { campaign, draft, setDraft, canEdit } = p;
  const loc = useLocalized(p);
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));
  const num = (field: string) => (v: string) => set(field, v === "" ? "" : Number(v));

  const model = String(draft.ai_model ?? "");
  // A model typed in elsewhere stays selectable instead of showing as the first option.
  const models = Array.from(new Set(["", model, ...MODEL_OPTIONS]));
  const modelLabels = { "": t("advanced.modelDefault") };
  const mode = String(draft.conversation_mode_override ?? "");
  const modeLabels = Object.fromEntries(CONVERSATION_MODES.map((m) => [m, t(`advanced.conversationModes.${m || "auto"}`)]));
  const booking = String(draft.booking_mode_override ?? "");
  const bookings = Array.from(new Set([...BOOKING_MODES, booking]));
  const bookingLabels: Record<string, string> = {
    "": t("advanced.bookingModes.unset"),
    "Call Agent": t("advanced.bookingModes.callAgent"),
    Qualifying: t("advanced.bookingModes.qualifying"),
  };
  const typos = String(draft.typo_count === "" || draft.typo_count == null ? 1 : draft.typo_count);
  const textDelay = String(draft.message_debounce_seconds ?? "");
  const voiceDelay = String(draft.voice_note_debounce_seconds ?? "");

  return (
    <>
      <ChatCard icon={<Cpu size={17} />} title={t("advanced.modelTitle")} testId="chat-card-model">
        <InfoRow
          label={t("advanced.model")} value={model || t("advanced.modelDefault")} description={t("advanced.modelHelp")}
          editChild={canEdit ? <EditSelect value={model} onChange={(v) => set("ai_model", v)} options={models} labels={modelLabels} /> : undefined}
        />
        <InfoRow
          label={t("advanced.role")} value={loc.get("ai_role") || null} description={t("advanced.roleHelp")} noBorder
          editChild={canEdit ? <EditText value={loc.get("ai_role")} onChange={(v) => loc.set("ai_role", v)} placeholder={t("advanced.rolePlaceholder")} /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<GitBranch size={17} />} title={t("advanced.conversationTitle")} testId="chat-card-conversation">
        <InfoRow
          label={t("advanced.conversationMode")} value={modeLabels[mode] ?? mode} description={t("advanced.conversationModeHelp")}
          editChild={canEdit ? <EditSelect value={mode} onChange={(v) => set("conversation_mode_override", v)} options={CONVERSATION_MODES} labels={modeLabels} /> : undefined}
        />
        <InfoRow
          label={t("advanced.bookingMode")} value={bookingLabels[booking] ?? booking} description={t("advanced.bookingModeHelp")}
          editChild={canEdit ? <EditSelect value={booking} onChange={(v) => set("booking_mode_override", v)} options={bookings} labels={bookingLabels} /> : undefined}
        />
        <InfoRow
          label={t("advanced.typos")} value={typos} description={t("advanced.typosHelp")} noBorder
          editChild={canEdit ? <EditSelect value={typos} onChange={(v) => set("typo_count", Number(v))} options={TYPO_COUNTS} /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<Clock size={17} />} title={t("advanced.timingTitle")} testId="chat-card-timing">
        <InfoRow
          label={t("advanced.textDelay")} value={t("advanced.seconds", { n: textDelay || 10 })} description={t("advanced.textDelayHelp")}
          editChild={canEdit ? <EditNumber value={textDelay} onChange={num("message_debounce_seconds")} placeholder="10" /> : undefined}
        />
        <InfoRow
          label={t("advanced.voiceDelay")} value={t("advanced.seconds", { n: voiceDelay || textDelay || 60 })} description={t("advanced.voiceDelayHelp")} noBorder
          editChild={canEdit ? <EditNumber value={voiceDelay} onChange={num("voice_note_debounce_seconds")} placeholder="60" /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<ShieldCheck size={17} />} title={t("advanced.disclosureTitle")} testId="chat-card-disclosure">
        <AiDisclosureField campaign={campaign} isEditing={canEdit} draft={draft} setDraft={setDraft} />
        <SwitchRow
          checked={!!draft.opt_out_notice} onChange={(v) => set("opt_out_notice", v)} disabled={!canEdit}
          label={t("advanced.optOut")} help={t("advanced.optOutHelp")} testId="chat-optout-switch"
        />
      </ChatCard>

      <ChatCard icon={<Repeat size={17} />} title={t("advanced.bumpsTitle")} testId="chat-card-bumps">
        <p style={helpStyle}>{t("advanced.bumpsHelp")}</p>
        <SwitchRow
          checked={!!draft.use_ai_bumps} onChange={(v) => set("use_ai_bumps", v)} disabled={!canEdit}
          label={t("advanced.aiBumps")} help={t("advanced.aiBumpsHelp")} testId="chat-ai-bumps-switch"
        />
        <SwitchRow
          checked={!!draft.stop_on_response} onChange={(v) => set("stop_on_response", v)} disabled={!canEdit}
          label={t("advanced.stopOnResponse")} help={t("advanced.stopOnResponseHelp")} testId="chat-stop-on-response-switch"
        />
      </ChatCard>

      <ChatCard icon={<HelpCircle size={17} />} title={t("advanced.objectionsTitle")} testId="chat-card-objections">
        <p style={helpStyle}>{t("advanced.objectionsHelp")}</p>
        <ObjectionPlaybookField campaign={campaign} draft={draft} setDraft={setDraft} disabled={!canEdit} />
      </ChatCard>
    </>
  );
}
