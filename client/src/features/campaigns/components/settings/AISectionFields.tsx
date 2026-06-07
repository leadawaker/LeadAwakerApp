import { useTranslation } from "react-i18next";
import {
  MessageSquare, Bot, Mic, Link, Zap,
  Thermometer, Radio, MessageCircle,
} from "lucide-react";
import {
  EditText, EditNumber, EditSelect, EditToggle, InfoRow, CopyButton,
} from "../formFields";

interface AISectionFieldsProps {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
}

export function AISectionFields({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField,
}: AISectionFieldsProps) {
  const { t } = useTranslation("campaigns");

  const editFor = (field: string) =>
    onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField(field) } : {};
  const focusFor = (field: string) => ({ autoFocus: focusField === field });

  const renderBump = (n: number) => {
    const voiceField = `bump_${n}_voice_note`;
    const delayField = `bump_${n}_delay_hours`;
    const templateField = `bump_${n}_template`;
    return (
      <div key={n} style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 'var(--space-md, 12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            {t("config.bumpN", { n }) || `Bump ${n}`}
          </span>
          <EditToggle
            checked={!!draft[voiceField]}
            onChange={(v) => setDraft(d => ({ ...d, [voiceField]: v }))}
            label={t(`config.bump${n}VoiceNote`) || `Voice note`}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)' }}>
            {t("config.delayLabel", { value: draft[delayField] ?? campaign[delayField] ?? 0 })}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 'var(--space-sm, 8px)', alignItems: 'start' }}>
          <EditNumber
            value={Number(draft[delayField] ?? campaign[delayField] ?? 0)}
            onChange={(v) => setDraft(d => ({ ...d, [delayField]: v }))}
            min={0}
            max={168}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
            <EditText
              value={String(draft[templateField] ?? campaign[templateField] ?? "")}
              onChange={(v) => setDraft(d => ({ ...d, [templateField]: v }))}
              multiline
              minRows={2}
              placeholder={t("config.bumpTemplate", { n }) || `Bump ${n} template…`}
            />
            <CopyButton text={String(draft[templateField] || campaign[templateField] || "")} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      <InfoRow icon={MessageSquare} label={t("config.firstMessage")} value={campaign.first_message_template}
        editChild={isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
              <EditToggle
                checked={!!draft.first_message_voice_note}
                onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
                label={t("config.firstMessageVoiceNote")}
              />
            </div>
            <EditText
              value={String(draft.First_Message ?? campaign.first_message_template ?? "")}
              onChange={(v) => setDraft(d => ({ ...d, First_Message: v }))}
              multiline
              minRows={3}
              placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
            />
            <CopyButton text={String(draft.First_Message || campaign.first_message_template || "")} />
          </div>
        ) : undefined}
        gridColumn="full"
        {...editFor("first_message_template")}
      />
      <InfoRow icon={Bot} label={t("config.aiRole") || "AI Role"} value={campaign.ai_role}
        {...editFor("ai_role")}
        editChild={isEditing ? <EditText value={String(draft.ai_role ?? "")} onChange={(v) => setDraft(d => ({...d, ai_role: v}))} placeholder="e.g. Sales representative…" {...focusFor("ai_role")} /> : undefined}
      />
      <InfoRow icon={Mic} label={t("config.voiceReplyMode")} value={campaign.voice_reply_mode || "off"}
        {...editFor("voice_reply_mode")}
        editChild={isEditing ? <EditSelect value={String(draft.voice_reply_mode ?? "")} onChange={(v) => setDraft(d => ({...d, voice_reply_mode: v}))} options={["off", "smart", "voice_reply"]} labels={{ off: t("config.voiceReplyOff"), smart: t("config.voiceReplySmart"), voice_reply: t("config.voiceReplyVoiceReply") }} {...focusFor("voice_reply_mode")} /> : undefined}
      />
      <InfoRow icon={Link} label={t("config.promptLinked")} value={campaign.prompt_linked_id || t("config.noPromptLinked")}
        gridColumn="full"
        {...editFor("prompt_linked_id")}
        editChild={isEditing ? <EditSelect value={String(draft.prompt_linked_id ?? "")} onChange={(v) => setDraft(d => ({...d, prompt_linked_id: v}))} options={[]} {...focusFor("prompt_linked_id")} /> : undefined}
      />

      {[1, 2, 3, 4].map(n => renderBump(n))}

      <InfoRow icon={Zap} label={t("config.model")} value={campaign.ai_model}
        {...editFor("ai_model")}
        editChild={isEditing ? <EditSelect value={String(draft.ai_model ?? "")} onChange={(v) => setDraft(d => ({...d, ai_model: v}))} options={["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "claude-sonnet-4-6"]} {...focusFor("ai_model")} /> : undefined}
      />
      <InfoRow icon={Thermometer} label={t("config.temperature")} value={campaign.ai_temperature}
        {...editFor("ai_temperature")}
        editChild={isEditing ? <EditNumber value={Number(draft.ai_temperature ?? 0.7)} onChange={(v) => setDraft(d => ({...d, ai_temperature: v}))} min={0} max={2} step={0.1} {...focusFor("ai_temperature")} /> : undefined}
      />
      <InfoRow icon={Radio} label={t("config.inquiriesSource")} value={campaign.inquiries_source}
        gridColumn="full"
        {...editFor("inquiries_source")}
        editChild={isEditing ? <EditText value={String(draft.inquiries_source ?? "")} onChange={(v) => setDraft(d => ({...d, inquiries_source: v}))} placeholder="e.g. Website form, Facebook ads…" {...focusFor("inquiries_source")} /> : undefined}
      />
    </div>
  );
}
