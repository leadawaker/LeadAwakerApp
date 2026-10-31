// Reactivation > First message and Follow-ups: what the leads receive before
// they reply. The opener reuses the Campaigns page's OpenerField (live preview,
// templates); follow-ups are the engine's bump ladder (bump_scheduler.py):
// max_bumps of them, each bump_N_delay_hours after the previous message.
import { useTranslation } from "react-i18next";
import { MessageSquare, Repeat, Sparkles, CalendarClock } from "lucide-react";
import { EditNumber, EditText, InfoRow } from "@/features/campaigns/components/formFields";
import { AiDisclosureField } from "@/features/campaigns/components/settings/AiDisclosureField";
import { OpenerField } from "@/features/campaigns/components/settings/OpenerField";
import { Switch } from "@/components/ui/switch";
import { ChatCard, SwitchRow, helpStyle, useLocalized, type ChatEdit } from "../chat/chatAtoms";

const MAX_BUMPS = 4;

/** Follow-ups switched on: max_bumps, capped at the four the engine has columns for. */
export const bumpCount = (draft: Record<string, unknown>) => Math.max(0, Math.min(MAX_BUMPS, Number(draft.max_bumps) || 0));

export function RxOpener(p: ChatEdit) {
  const { t } = useTranslation("reactivationSettings");
  const { campaign, draft, setDraft, canEdit } = p;
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));
  return (
    <>
      <ChatCard icon={<MessageSquare size={17} />} title={t("opener.messageTitle")} testId="rx-card-opener">
        <p style={helpStyle}>{t("opener.messageHelp")}</p>
        <AiDisclosureField campaign={campaign} isEditing={canEdit} draft={draft} setDraft={setDraft} />
        <OpenerField campaign={campaign} isEditing={canEdit} draft={draft} setDraft={setDraft} label={t("opener.label")} />
      </ChatCard>
      <ChatCard icon={<Sparkles size={17} />} title={t("opener.extrasTitle")} testId="rx-card-opener-extras">
        <SwitchRow
          checked={!!draft.first_message_voice_note} onChange={(v) => set("first_message_voice_note", v)} disabled={!canEdit}
          label={t("opener.voiceNote")} help={t("opener.voiceNoteHelp")} testId="rx-opener-voice"
        />
        <SwitchRow
          checked={!!draft.opt_out_notice} onChange={(v) => set("opt_out_notice", v)} disabled={!canEdit}
          label={t("opener.optOut")} help={t("opener.optOutHelp")} testId="rx-opener-optout"
        />
      </ChatCard>
    </>
  );
}

export function RxFollowUps(p: ChatEdit) {
  const { t } = useTranslation("reactivationSettings");
  const { draft, setDraft, canEdit } = p;
  const loc = useLocalized(p);
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));
  const count = bumpCount(draft);

  return (
    <>
      <ChatCard icon={<Repeat size={17} />} title={t("followups.countTitle")} testId="rx-card-followups">
        <p style={helpStyle}>{t("followups.countHelp")}</p>
        <div className="la-seg" role="radiogroup" aria-label={t("followups.count")} style={{ alignSelf: "flex-start" }}>
          {Array.from({ length: MAX_BUMPS + 1 }, (_, n) => (
            <button
              key={n} type="button" role="radio" aria-checked={count === n} disabled={!canEdit}
              className={count === n ? "la-seg-btn on" : "la-seg-btn"} onClick={() => set("max_bumps", n)} data-testid={`rx-bumps-${n}`}
            >
              {n === 0 ? t("followups.none") : n}
            </button>
          ))}
        </div>
      </ChatCard>

      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <ChatCard
          key={n} icon={<span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700 }}>{n}</span>}
          title={t("followups.bump", { n })} testId={`rx-card-bump-${n}`}
          action={(
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--mute)" }}>
              {t("followups.voiceNote")}
              <Switch checked={!!draft[`bump_${n}_voice_note`]} onCheckedChange={(v) => set(`bump_${n}_voice_note`, v)} disabled={!canEdit} aria-label={t("followups.voiceNote")} />
            </label>
          )}
        >
          <InfoRow
            label={t("followups.delay")} value={`${draft[`bump_${n}_delay_hours`] || "?"} h`} description={t("followups.delayUnit")}
            editChild={canEdit ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 260 }}>
                <EditNumber value={String(draft[`bump_${n}_delay_hours`] ?? "")} onChange={(v) => set(`bump_${n}_delay_hours`, v === "" ? "" : Number(v))} placeholder="24" />
                <span style={{ fontSize: 12.5, color: "var(--mute)", whiteSpace: "nowrap" }}>h</span>
              </div>
            ) : undefined}
          />
          <InfoRow
            label={t("followups.message")} value={loc.get(`bump_${n}_template`) || null}
            editChild={canEdit ? <EditText value={loc.get(`bump_${n}_template`)} onChange={(v) => loc.set(`bump_${n}_template`, v)} multiline minRows={2} placeholder={t("followups.messagePlaceholder")} /> : undefined}
          />
          <InfoRow
            label={t("followups.angle")} value={String(draft[`bump_${n}_ai_prompt`] || "") || null} noBorder
            editChild={canEdit ? <EditText value={String(draft[`bump_${n}_ai_prompt`] ?? "")} onChange={(v) => set(`bump_${n}_ai_prompt`, v)} multiline minRows={2} placeholder={t("followups.anglePlaceholder")} /> : undefined}
          />
        </ChatCard>
      ))}

      <ChatCard icon={<Sparkles size={17} />} title={t("followups.howTitle")} testId="rx-card-followups-how">
        <SwitchRow
          checked={!!draft.use_ai_bumps} onChange={(v) => set("use_ai_bumps", v)} disabled={!canEdit}
          label={t("followups.aiBumps")} help={t("followups.aiBumpsHelp")} testId="rx-ai-bumps"
        />
        <SwitchRow
          checked={!!draft.stop_on_response} onChange={(v) => set("stop_on_response", v)} disabled={!canEdit}
          label={t("followups.stopOnResponse")} help={t("followups.stopOnResponseHelp")} testId="rx-stop-on-response"
        />
      </ChatCard>

      <ChatCard icon={<CalendarClock size={17} />} title={t("followups.laterTitle")} testId="rx-card-later">
        <p style={helpStyle}>{t("followups.laterHelp")}</p>
        <InfoRow
          label={t("followups.message")} value={String(draft.reengagement_bump_template || "") || null} noBorder
          editChild={canEdit ? <EditText value={String(draft.reengagement_bump_template ?? "")} onChange={(v) => set("reengagement_bump_template", v)} multiline minRows={2} placeholder={t("followups.laterPlaceholder")} /> : undefined}
        />
      </ChatCard>
    </>
  );
}
