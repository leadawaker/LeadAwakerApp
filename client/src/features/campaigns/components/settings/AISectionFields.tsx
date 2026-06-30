import { useTranslation } from "react-i18next";
import {
  MessageSquare, Bot, Mic, Link, Zap,
  Thermometer, Radio, MessageCircle, HelpCircle,
} from "lucide-react";
import {
  EditText, EditNumber, EditSelect, EditToggle, InfoRow, CopyButton,
} from "../formFields";
import { MODEL_OPTIONS } from "@/features/prompts/types";
import { asCampaignLang, placeholderFor } from "./fieldLocale";
import { resolveLang } from "@shared/langField";

interface AISectionFieldsProps {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
  conversationPrompts?: any[];
}

export function AISectionFields({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField,
  conversationPrompts = [],
}: AISectionFieldsProps) {
  const { t, i18n } = useTranslation("campaigns");
  // UI language drives display & edit; campaign `language` decides what the engine sends.
  const uiLang = asCampaignLang(i18n.language);

  const displayText = (raw: unknown) => resolveLang(raw, uiLang === "pt" ? "en" : uiLang);

  const onTextChange = (field: string, raw: unknown, text: string) => {
    let current: Record<string, string> = {};
    const s = String(raw ?? "").trim();
    if (s.startsWith("{")) {
      try { current = JSON.parse(s); } catch { /* ok */ }
    } else if (s) {
      current = { en: s, nl: s };
    }
    current[uiLang] = text;
    setDraft(d => ({ ...d, [field]: JSON.stringify(current) }));
  };

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
            value={!!draft[voiceField]}
            onChange={(v) => setDraft(d => ({ ...d, [voiceField]: v }))}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)' }}>
            {t("config.delayLabel", { value: draft[delayField] ?? campaign[delayField] ?? 0 })}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 'var(--space-sm, 8px)', alignItems: 'start' }}>
          <EditNumber
            value={Number(draft[delayField] ?? campaign[delayField] ?? 0)}
            onChange={(v) => setDraft(d => ({ ...d, [delayField]: v }))}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
            <EditText
              value={String(draft[templateField] ?? campaign[templateField] ?? "")}
              onChange={(v) => setDraft(d => ({ ...d, [templateField]: v }))}
              multiline
              minRows={2}
              placeholder={t("config.bumpTemplate", { n }) || `Bump ${n} template…`}
            />
            <CopyButton value={String(draft[templateField] || campaign[templateField] || "")} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare} label={t("config.firstMessage")} value={campaign.first_message_template}
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
                <EditToggle
                  value={!!draft.first_message_voice_note}
                  onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
                />
              </div>
              <EditText
                value={String(draft.First_Message ?? campaign.first_message_template ?? "")}
                onChange={(v) => setDraft(d => ({ ...d, First_Message: v }))}
                multiline
                minRows={3}
                placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
              />
              <CopyButton value={String(draft.First_Message || campaign.first_message_template || "")} />
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>
      <InfoRow icon={Bot} label={t("config.aiRole") || "AI Role"}
        value={displayText(campaign.ai_role)}
        {...editFor("ai_role")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.ai_role ?? campaign.ai_role)}
            onChange={(v) => onTextChange("ai_role", draft.ai_role ?? campaign.ai_role, v)}
            placeholder={placeholderFor("ai_role", uiLang)}
            {...focusFor("ai_role")}
          />
        ) : undefined}
      />
      <InfoRow icon={Mic} label={t("config.voiceReplyMode")} value={campaign.voice_reply_mode || "off"}
        {...editFor("voice_reply_mode")}
        editChild={isEditing ? <EditSelect value={String(draft.voice_reply_mode ?? "")} onChange={(v) => setDraft(d => ({...d, voice_reply_mode: v}))} options={["off", "smart", "voice_reply"]} labels={{ off: t("config.voiceReplyOff"), smart: t("config.voiceReplySmart"), voice_reply: t("config.voiceReplyVoiceReply") }} {...focusFor("voice_reply_mode")} /> : undefined}
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={Link} label={t("config.promptLinked")} value={campaign.prompt_linked_id || t("config.noPromptLinked")}
          {...editFor("prompt_linked_id")}
          editChild={isEditing ? (() => {
            const promptOptions = ["", ...conversationPrompts.map((p) => String(p.id || p.Id))];
            const promptLabels: Record<string, string> = { "": t("config.noPromptLinked") };
            conversationPrompts.forEach((p) => { promptLabels[String(p.id || p.Id)] = p.name; });
            return <EditSelect value={String(draft.prompt_linked_id ?? "")} onChange={(v) => setDraft(d => ({...d, prompt_linked_id: v || null}))} options={promptOptions} labels={promptLabels} {...focusFor("prompt_linked_id")} />;
          })() : undefined}
        />
      </div>

      {[1, 2, 3, 4].map(n => renderBump(n))}

      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageCircle} label={t("config.reengagementBump")} value={campaign.reengagement_bump_template}
          {...editFor("reengagement_bump_template")}
          editChild={isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              <EditText
                value={String(draft.reengagement_bump_template ?? campaign.reengagement_bump_template ?? "")}
                onChange={(v) => setDraft(d => ({ ...d, reengagement_bump_template: v }))}
                multiline
                minRows={2}
                placeholder={t("config.reengagementBumpPlaceholder")}
                {...focusFor("reengagement_bump_template")}
              />
              <span style={{ fontSize: 11, color: 'var(--mute)' }}>{t("config.reengagementBumpHint")}</span>
              <CopyButton value={String(draft.reengagement_bump_template || campaign.reengagement_bump_template || "")} />
            </div>
          ) : undefined}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={HelpCircle} label={t("config.nicheQuestion")}
          value={displayText(campaign.niche_question)}
          {...editFor("niche_question")}
          editChild={isEditing ? (
            <EditText
              value={displayText(draft.niche_question ?? campaign.niche_question)}
              onChange={(v) => onTextChange("niche_question", draft.niche_question ?? campaign.niche_question, v)}
              placeholder={placeholderFor("niche_question", uiLang)}
              {...focusFor("niche_question")}
            />
          ) : undefined}
        />
      </div>
      <InfoRow icon={Zap} label={t("config.model")} value={campaign.ai_model}
        {...editFor("ai_model")}
        editChild={isEditing ? <EditSelect value={String(draft.ai_model ?? "")} onChange={(v) => setDraft(d => ({...d, ai_model: v}))} options={MODEL_OPTIONS} {...focusFor("ai_model")} /> : undefined}
      />
      <InfoRow icon={Thermometer} label={t("config.temperature")} value={campaign.ai_temperature}
        {...editFor("ai_temperature")}
        editChild={isEditing ? <EditNumber value={Number(draft.ai_temperature ?? 0.7)} onChange={(v) => setDraft(d => ({...d, ai_temperature: v}))} {...focusFor("ai_temperature")} /> : undefined}
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={Radio} label={t("config.inquiriesSource")} value={campaign.inquiries_source}
          {...editFor("inquiries_source")}
          editChild={isEditing ? <EditText value={String(draft.inquiries_source ?? "")} onChange={(v) => setDraft(d => ({...d, inquiries_source: v}))} placeholder="e.g. Website form, Facebook ads…" {...focusFor("inquiries_source")} /> : undefined}
        />
      </div>
    </div>
  );
}
