// Reactivation > Channel & schedule and Advanced.
//
// The channel is one choice that writes the three columns the engine reads
// together (2026-10-31): `channel` (what the launcher and bump scheduler send
// on), `channel_mode` and `fallback_channel` (send_service's policy). With
// "WhatsApp, SMS as fallback" a number that is not on WhatsApp gets the message
// by SMS (channel_fallback.py), and so does a cold WhatsApp send that has no
// approved template (send_service._sms_fallback_allowed).
import { useTranslation } from "react-i18next";
import { Clock, Cpu, FlaskConical, GitBranch, MessageCircle, MessageSquareText, Send, Variable } from "lucide-react";
import { EditNumber, EditSelect, EditText, InfoRow } from "@/features/campaigns/components/formFields";
import { MODEL_OPTIONS } from "@/features/prompts/types";
import { FIRST_TOUCH_OPTIONS, USP_OPTIONS, asCampaignLang, optionLabel } from "@/features/campaigns/components/settings/fieldLocale";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ChatCard, SwitchRow, helpStyle, hhmm, useLocalized, type ChatEdit } from "../chat/chatAtoms";
import { useCombo } from "./RxBehaviourKnowledge";

export const CHANNEL_CHOICES = ["whatsapp_sms", "whatsapp", "sms"] as const;
export type ChannelChoice = (typeof CHANNEL_CHOICES)[number];

const CHANNEL_COLUMNS: Record<ChannelChoice, Record<string, string>> = {
  whatsapp_sms: { channel: "whatsapp", channel_mode: "whatsapp_then_sms", fallback_channel: "sms" },
  whatsapp: { channel: "whatsapp", channel_mode: "whatsapp_only", fallback_channel: "sms" },
  sms: { channel: "sms", channel_mode: "sms_only", fallback_channel: "sms" },
};

export function channelChoice(draft: Record<string, unknown>): ChannelChoice {
  if (String(draft.channel || "").toLowerCase() === "sms") return "sms";
  if (String(draft.channel_mode || "").toLowerCase() === "whatsapp_only") return "whatsapp";
  return "whatsapp_sms";
}

export function RxSending(p: ChatEdit) {
  const { t } = useTranslation("reactivationSettings");
  const { isOwner } = useWorkspace();
  const { draft, setDraft, canEdit } = p;
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));
  const num = (field: string) => (v: string) => set(field, v === "" ? "" : Number(v));
  const choice = channelChoice(draft);
  const start = hhmm(draft.active_hours_start);
  const end = hhmm(draft.active_hours_end);
  const time = (field: "active_hours_start" | "active_hours_end", value: string) => (
    <input
      type="time" value={value} className="la-input" style={{ maxWidth: 140 }} aria-label={t("sending.hours")} disabled={!canEdit}
      onChange={(e) => set(field, e.target.value)} data-testid={`rx-${field}`}
    />
  );

  return (
    <>
      <ChatCard icon={<Send size={17} />} title={t("sending.channelTitle")} testId="rx-card-channel">
        <p style={helpStyle}>{t("sending.channelHelp")}</p>
        <div role="radiogroup" aria-label={t("sending.channelTitle")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {CHANNEL_CHOICES.map((c) => {
            const on = c === choice;
            return (
              <button
                key={c} type="button" role="radio" aria-checked={on} disabled={!canEdit} data-testid={`rx-channel-${c}`}
                onClick={() => setDraft((d) => ({ ...d, ...CHANNEL_COLUMNS[c] }))}
                className={on ? "neu-inset-crisp" : "neu-raised"}
                style={{
                  textAlign: "left", padding: "14px 16px", borderRadius: "var(--r-button)", cursor: canEdit ? "pointer" : "default",
                  border: on ? "1.5px solid var(--wine)" : "1.5px solid transparent", background: "var(--card)",
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: on ? "var(--wine)" : "var(--ink)" }}>
                  {c === "sms" ? <MessageSquareText size={15} /> : <MessageCircle size={15} />}
                  {t(`sending.channels.${c}.label`)}
                </span>
                <span style={{ fontSize: 12, color: "var(--mute)", lineHeight: 1.45 }}>{t(`sending.channels.${c}.help`)}</span>
              </button>
            );
          })}
        </div>
        {choice !== "whatsapp" && <p style={{ ...helpStyle, margin: "14px 0 0" }}>{t("sending.smsNote")}</p>}
      </ChatCard>

      {choice !== "sms" && (
        <ChatCard icon={<MessageCircle size={17} />} title={t("sending.templateTitle")} testId="rx-card-template">
          <InfoRow
            label={t("sending.template")} value={String(draft.twilio_first_message_template_sid || "") || null} description={t("sending.templateHelp")}
            editChild={canEdit && isOwner ? <EditText value={String(draft.twilio_first_message_template_sid ?? "")} onChange={(v) => set("twilio_first_message_template_sid", v.trim())} placeholder="HX..." /> : undefined}
          />
          <InfoRow
            label={t("sending.vcard")} value={String(draft.vcard_contact_name || "") || null} description={t("sending.vcardHelp")} noBorder
            editChild={canEdit ? <EditText value={String(draft.vcard_contact_name ?? "")} onChange={(v) => set("vcard_contact_name", v)} /> : undefined}
          />
        </ChatCard>
      )}

      <ChatCard icon={<Clock size={17} />} title={t("sending.scheduleTitle")} testId="rx-card-schedule">
        <InfoRow
          label={t("sending.hours")} value={start && end ? t("overview.range", { start, end }) : "09:00 - 17:00"} description={t("sending.hoursHelp")}
          editChild={canEdit ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {time("active_hours_start", start)}
              <span style={{ color: "var(--mute)", fontSize: 13 }}>{t("sending.to")}</span>
              {time("active_hours_end", end)}
            </div>
          ) : undefined}
        />
        <InfoRow
          label={t("sending.dailyLimit")} value={String(draft.daily_lead_limit || 500)} description={t("sending.dailyLimitHelp")}
          editChild={canEdit ? <div style={{ maxWidth: 160 }}><EditNumber value={String(draft.daily_lead_limit ?? "")} onChange={num("daily_lead_limit")} placeholder="500" /></div> : undefined}
        />
        <InfoRow
          label={t("sending.interval")} value={String(draft.message_interval_minutes ?? 1)} description={t("sending.intervalHelp")} noBorder
          editChild={canEdit ? <div style={{ maxWidth: 160 }}><EditNumber value={String(draft.message_interval_minutes ?? "")} onChange={num("message_interval_minutes")} placeholder="1" /></div> : undefined}
        />
      </ChatCard>
    </>
  );
}

const CONVERSATION_MODES = ["", "scoping", "decision"];
const BOOKING_MODES = ["", "Sales Call", "Direct Booking", "Call Agent", "Qualifying"];
const TYPO_COUNTS = ["0", "1", "2", "3"];

export function RxAdvanced(p: ChatEdit) {
  const { t } = useTranslation("reactivationSettings");
  const { i18n } = useTranslation();
  const { draft, setDraft, canEdit } = p;
  const loc = useLocalized(p);
  const combo = useCombo(draft, setDraft);
  const uiLang = asCampaignLang(i18n.language);
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));
  const num = (field: string) => (v: string) => set(field, v === "" ? "" : Number(v));

  const model = String(draft.ai_model ?? "");
  const models = Array.from(new Set(["", model, ...MODEL_OPTIONS]));
  const mode = String(draft.conversation_mode_override ?? "");
  const modeLabels = Object.fromEntries(CONVERSATION_MODES.map((m) => [m, t(`advanced.conversationModes.${m || "auto"}`)]));
  const booking = String(draft.booking_mode_override ?? "");
  const bookings = Array.from(new Set([...BOOKING_MODES, booking]));
  const bookingLabels: Record<string, string> = Object.fromEntries(bookings.map((b) => [b, t(`advanced.bookingModes.${b || "unset"}`, b)]));
  const typos = String(draft.typo_count === "" || draft.typo_count == null ? 1 : draft.typo_count);
  const textDelay = String(draft.message_debounce_seconds ?? "");
  const voiceDelay = String(draft.voice_note_debounce_seconds ?? "");

  return (
    <>
      <ChatCard icon={<Cpu size={17} />} title={t("advanced.modelTitle")} testId="rx-card-model">
        <InfoRow
          label={t("advanced.model")} value={model || t("advanced.modelDefault")}
          editChild={canEdit ? <EditSelect value={model} onChange={(v) => set("ai_model", v)} options={models} labels={{ "": t("advanced.modelDefault") }} /> : undefined}
        />
        <InfoRow
          label={t("advanced.role")} value={loc.get("ai_role") || null} description={t("advanced.roleHelp")} noBorder
          editChild={canEdit ? <EditText value={loc.get("ai_role")} onChange={(v) => loc.set("ai_role", v)} /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<GitBranch size={17} />} title={t("advanced.conversationTitle")} testId="rx-card-conversation">
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

      <ChatCard icon={<Clock size={17} />} title={t("advanced.timingTitle")} testId="rx-card-timing">
        <InfoRow
          label={t("advanced.textDelay")} value={t("advanced.seconds", { n: textDelay || 10 })} description={t("advanced.textDelayHelp")}
          editChild={canEdit ? <EditNumber value={textDelay} onChange={num("message_debounce_seconds")} placeholder="10" /> : undefined}
        />
        <InfoRow
          label={t("advanced.voiceDelay")} value={t("advanced.seconds", { n: voiceDelay || textDelay || 60 })} description={t("advanced.voiceDelayHelp")} noBorder
          editChild={canEdit ? <EditNumber value={voiceDelay} onChange={num("voice_note_debounce_seconds")} placeholder="60" /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<FlaskConical size={17} />} title={t("advanced.abTitle")} testId="rx-card-ab">
        <SwitchRow
          checked={!!draft.ab_enabled} onChange={(v) => set("ab_enabled", v)} disabled={!canEdit}
          label={t("advanced.ab")} help={t("advanced.abHelp")} testId="rx-ab"
        />
        {!!draft.ab_enabled && (
          <InfoRow
            label={t("advanced.abSplit")} value={`${draft.ab_split_ratio ?? 50}%`} noBorder
            editChild={canEdit ? <div style={{ maxWidth: 160 }}><EditNumber value={String(draft.ab_split_ratio ?? 50)} onChange={num("ab_split_ratio")} /></div> : undefined}
          />
        )}
      </ChatCard>

      <ChatCard icon={<Variable size={17} />} title={t("advanced.legacyTitle")} testId="rx-card-legacy">
        <p style={helpStyle}>{t("advanced.legacyHelp")}</p>
        <InfoRow
          label={t("advanced.niche")} value={String(draft.niche || "") || null} description={t("advanced.nicheHelp")}
          editChild={canEdit ? <EditText value={String(draft.niche ?? "")} onChange={(v) => set("niche", v.trim())} /> : undefined}
        />
        <InfoRow
          label={t("advanced.nicheQuestion")} value={loc.get("niche_question") || null}
          editChild={canEdit ? <EditText value={loc.get("niche_question")} onChange={(v) => loc.set("niche_question", v)} /> : undefined}
        />
        <InfoRow
          label={t("advanced.firstTouch")} value={optionLabel("first_touch", draft.first_touch, uiLang) || null}
          editChild={canEdit ? combo("first_touch", FIRST_TOUCH_OPTIONS) : undefined}
        />
        <InfoRow
          label={t("advanced.usp")} value={optionLabel("campaign_usp", draft.campaign_usp, uiLang) || null} noBorder
          editChild={canEdit ? combo("campaign_usp", USP_OPTIONS) : undefined}
        />
      </ChatCard>
    </>
  );
}
