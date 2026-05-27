import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Clock, Bot, Mic, Send, Tag, Cpu, Thermometer, ChevronRight, ChevronLeft, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  formatHours, CopyButton, EditText, EditNumber, EditSelect, InfoRow,
} from "../formFields";
import type { Campaign } from "@/types/models";
import type { ColumnBaseProps } from "./types";

interface CampaignAIColumnProps extends ColumnBaseProps {
  linkedPrompt: any | null;
  conversationPrompts: any[];
  onTogglePromptPanel?: () => void;
}

export function CampaignAIColumn({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField, collapsed, onToggle,
  linkedPrompt, conversationPrompts, onTogglePromptPanel,
}: CampaignAIColumnProps) {
  const { t } = useTranslation("campaigns");
  const { isAgencyUser } = useWorkspace();
  const [, navigate] = useLocation();

  const editFor = (field: string) =>
    onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField(field) } : {};
  const focusFor = (field: string) => ({ autoFocus: focusField === field });
  const clickToEdit = (field: string) =>
    onStartEditField && !isEditing
      ? { onClick: () => onStartEditField(field), className: "cursor-text rounded px-0.5 -mx-0.5 hover:bg-muted/50 transition-colors" }
      : { className: "" };

  if (collapsed) {
    return (
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl flex flex-col items-center pt-4 pb-4 overflow-hidden cursor-pointer group h-full" onClick={onToggle} title="Expand AI Settings">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors text-foreground/50 group-hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mt-3 select-none" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          AI Settings
        </span>
      </div>
    );
  }

  return (
    <div className="@container bg-white/60 dark:bg-white/[0.10] rounded-xl overflow-y-auto h-full" data-testid="campaign-detail-view-ai">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-8 pt-4 md:pt-8 pb-3 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
        <h3 className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("config.aiSettings")}</h3>
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors text-foreground/40 hover:text-foreground -mr-1"
          title="Collapse AI Settings"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 md:px-8 pb-4 md:pb-8">
      <div className="grid grid-cols-1 @sm:grid-cols-2 gap-x-6">

        {/* First Message — full width */}
        <div className="col-span-2 space-y-1.5 py-3 min-h-[3.5rem] border-b border-border/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Send className="w-4 h-4 text-brand-indigo" />
                {t("config.firstMessage")}
              </span>
              {(isEditing || Boolean(draft.first_message_voice_note ?? campaign.first_message_voice_note)) && (
                <button
                  onClick={() => isEditing && setDraft(d => ({...d, first_message_voice_note: !Boolean(d.first_message_voice_note ?? campaign.first_message_voice_note)}))}
                  className={cn("inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium transition-colors",
                    Boolean(draft.first_message_voice_note ?? campaign.first_message_voice_note)
                      ? "bg-brand-indigo/10 text-brand-indigo"
                      : "bg-foreground/5 text-foreground/40"
                  )}
                >
                  <Mic className="w-3 h-3" />
                </button>
              )}
            </div>
            {!isEditing && campaign.First_Message && <CopyButton value={campaign.First_Message || ""} />}
          </div>
          {isEditing ? (
            <EditText value={String(draft.First_Message ?? "")} onChange={(v) => setDraft(d => ({...d, First_Message: v}))} multiline placeholder="Hi {name}, we noticed…" {...focusFor("First_Message")} />
          ) : (
            campaign.First_Message
              ? <p {...clickToEdit("First_Message")} className={cn("text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words", clickToEdit("First_Message").className)}>{campaign.First_Message}</p>
              : <p {...clickToEdit("First_Message")} className={cn("text-[11px] text-foreground/40 italic", clickToEdit("First_Message").className)}>{t("config.noTemplateSet")}</p>
          )}
        </div>

        {/* AI Role — col 1, Voice Reply — col 2 */}
        <InfoRow icon={Tag} label="AI Role" value={campaign.ai_role}
          {...editFor("ai_role")}
          editChild={isEditing ? <EditText value={String(draft.ai_role ?? "")} onChange={(v) => setDraft(d => ({...d, ai_role: v}))} placeholder="e.g. admin, support, specialist" {...focusFor("ai_role")} /> : undefined}
        />

        {/* Voice Reply — col 2, same row as AI Role */}
        <InfoRow icon={Mic} label={t("config.voiceReplyMode")} value={
          (draft.voice_reply_mode ?? campaign.voice_reply_mode ?? "off") === "off" ? t("config.voiceReplyOff")
          : (draft.voice_reply_mode ?? campaign.voice_reply_mode) === "smart" ? t("config.voiceReplySmart")
          : t("config.voiceReplyVoiceReply")
        }
          {...editFor("voice_reply_mode")}
          editChild={isEditing ? <EditSelect value={String(draft.voice_reply_mode ?? "off")} onChange={(v) => setDraft(d => ({...d, voice_reply_mode: v}))} options={["off", "smart", "voice_reply"]} labels={[t("config.voiceReplyOff"), t("config.voiceReplySmart"), t("config.voiceReplyVoiceReply")]} {...focusFor("voice_reply_mode")} /> : undefined}
        />

        {/* Linked Prompt — full width */}
        <div className="col-span-2 space-y-1.5 py-3 min-h-[3.5rem] border-b border-border/20">
          <p className="text-[12px] font-bold uppercase tracking-wider text-foreground">{t("config.promptLinked")}</p>
          {isEditing ? (
            <select
              value={String(draft.prompt_linked_id ?? "")}
              onChange={(e) => setDraft(d => ({ ...d, prompt_linked_id: e.target.value }))}
              className="w-full h-9 rounded-lg bg-white dark:bg-white px-2.5 text-[14px] text-foreground outline-none"
            >
              <option value="">{t("config.noPromptLinked")}</option>
              {conversationPrompts.map((p) => (
                <option key={p.id || p.Id} value={String(p.id || p.Id)}>{p.name}</option>
              ))}
            </select>
          ) : linkedPrompt ? (
            <div
              className="flex items-center gap-2 p-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] cursor-pointer hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
              onClick={() => {
                if (onTogglePromptPanel) {
                  onTogglePromptPanel();
                } else {
                  localStorage.setItem("prompt-library-initial-id", String(linkedPrompt.id || linkedPrompt.Id));
                  navigate(isAgencyUser ? "/agency/prompt-library" : "/subaccount/prompt-library");
                }
              }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-brand-indigo/10 text-brand-indigo flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium flex-1 truncate">{linkedPrompt.name || linkedPrompt.Name}</span>
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium",
                (linkedPrompt.status || linkedPrompt.Status) === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {linkedPrompt.status || linkedPrompt.Status || "unknown"}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-foreground/40 italic">{t("config.noPromptLinked")}</p>
          )}
        </div>

        {/* HR separator — full width */}
        <div className="col-span-2"><hr className="border-border/20" /></div>

        {/* Bumps 1–4 — each full width */}
        {[1, 2, 3, 4].map((n) => {
          const templateKey = `bump_${n}_template` as keyof Campaign;
          const delayKey = `bump_${n}_delay_hours` as keyof Campaign;
          const voiceTemplateKey = `bump_${n}_voice_template` as keyof Campaign;
          const voiceNoteKey = `bump_${n}_voice_note` as keyof Campaign;
          const templateVal = campaign[templateKey] as string | undefined;
          const delayVal = campaign[delayKey] as number | undefined;
          const voiceTemplateVal = campaign[voiceTemplateKey] as string | undefined;
          const voiceNoteOn = Boolean(draft[`bump_${n}_voice_note`] ?? campaign[voiceNoteKey]);
          const draftTemplateKey = `bump_${n}_template`;
          const draftDelayKey = `bump_${n}_delay_hours`;
          const draftVoiceTemplateKey = `bump_${n}_voice_template`;
          return (
            <div key={n} className="col-span-2 space-y-2 py-3 min-h-[3.5rem] border-b border-border/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-foreground">Bump {n}</span>
                  <ChevronRight className="w-3 h-3 text-foreground/30" />
                  {(isEditing || voiceNoteOn) && (
                    <button
                      onClick={() => isEditing && setDraft(d => ({...d, [`bump_${n}_voice_note`]: !voiceNoteOn}))}
                      className={cn("inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium transition-colors",
                        voiceNoteOn ? "bg-brand-indigo/10 text-brand-indigo" : "bg-foreground/5 text-foreground/40"
                      )}
                    >
                      <Mic className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-foreground/50">{t("config.delayHours")}</span>
                      <input
                        type="number"
                        value={String(draft[draftDelayKey] ?? "")}
                        onChange={(e) => setDraft(d => ({...d, [draftDelayKey]: e.target.value === "" ? "" : Number(e.target.value)}))}
                        className="w-14 text-[14px] bg-white dark:bg-white rounded px-1.5 py-0.5 outline-none"
                        placeholder={String(n * 24)}
                      />
                    </div>
                  ) : (
                    <div
                      className={cn("flex items-center gap-1 text-[11px] text-foreground/50", onStartEditField && "cursor-text hover:bg-muted/50 rounded px-0.5 -mx-0.5 transition-colors")}
                      onClick={onStartEditField && !isEditing ? () => onStartEditField(draftDelayKey) : undefined}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{t("config.delayLabel", { value: formatHours(delayVal) })}</span>
                    </div>
                  )}
                  {!isEditing && templateVal && <CopyButton value={templateVal} />}
                </div>
              </div>
              {isEditing ? (
                <EditText value={String(draft[draftTemplateKey] ?? "")} onChange={(v) => setDraft(d => ({...d, [draftTemplateKey]: v}))} multiline placeholder={`Bump ${n} message…`} {...focusFor(draftTemplateKey)} />
              ) : (
                templateVal
                  ? <p {...clickToEdit(draftTemplateKey)} className={cn("text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words", clickToEdit(draftTemplateKey).className)}>{templateVal}</p>
                  : <p {...clickToEdit(draftTemplateKey)} className={cn("text-[11px] text-foreground/40 italic", clickToEdit(draftTemplateKey).className)}>{t("config.noTemplateSet")}</p>
              )}
              {voiceNoteOn && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-brand-indigo" />
                    <span className="text-[12px] font-bold uppercase tracking-wider text-foreground">Bump {n} - Voice</span>
                    {!isEditing && voiceTemplateVal && <CopyButton value={voiceTemplateVal} />}
                  </div>
                  {isEditing ? (
                    <EditText value={String(draft[draftVoiceTemplateKey] ?? "")} onChange={(v) => setDraft(d => ({...d, [draftVoiceTemplateKey]: v}))} multiline placeholder="Hey, [laugh] just wanted to follow up…" {...focusFor(draftVoiceTemplateKey)} />
                  ) : (
                    voiceTemplateVal
                      ? <p {...clickToEdit(draftVoiceTemplateKey)} className={cn("text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words", clickToEdit(draftVoiceTemplateKey).className)}>{voiceTemplateVal}</p>
                      : <p {...clickToEdit(draftVoiceTemplateKey)} className={cn("text-[11px] text-foreground/40 italic", clickToEdit(draftVoiceTemplateKey).className)}>{t("config.noVoiceScriptSet")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Model — col 1, Temperature — col 2 */}
        <InfoRow icon={Cpu} label={t("config.model")} value={campaign.ai_model || "Default"}
          {...editFor("ai_model")}
          editChild={isEditing ? <EditSelect value={String(draft.ai_model ?? "")} onChange={(v) => setDraft(d => ({...d, ai_model: v}))} options={["", "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.3-chat-latest", "gpt-5.3-codex", "gpt-5.2", "gpt-5.2-chat-latest", "gpt-5.2-codex", "gpt-5.2-pro", "gpt-5.1", "gpt-5.1-chat-latest", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "claude-haiku-4-5"]} {...focusFor("ai_model")} /> : undefined}
        />
        <InfoRow icon={Thermometer} label={t("config.temperature")} value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : null}
          {...editFor("ai_temperature")}
          editChild={isEditing ? <EditNumber value={String(draft.ai_temperature ?? "")} onChange={(v) => setDraft(d => ({...d, ai_temperature: v}))} placeholder="0.7" {...focusFor("ai_temperature")} /> : undefined}
        />

        <InfoRow icon={MapPin} label={t("config.inquiriesSource")} value={campaign.inquiries_source}
          {...editFor("inquiries_source")}
          editChild={isEditing ? <EditText value={String(draft.inquiries_source ?? "")} onChange={(v) => setDraft(d => ({...d, inquiries_source: v}))} placeholder="e.g. Contact form, landing page" {...focusFor("inquiries_source")} /> : undefined}
        />

      </div>{/* end grid */}
      </div>{/* end px wrapper */}
    </div>
  );
}
