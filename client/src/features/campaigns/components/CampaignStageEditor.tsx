/**
 * CampaignStageEditor
 *
 * The "Configurations" tab content of CampaignDetailView.
 * Contains: Business & Campaign info, AI Settings (templates, bumps, voice notes),
 * and Behavior (timing, channel, contract, A/B test).
 *
 * Sub-components live in ./formFields/
 */
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Zap,
  Bot,
  ChevronRight,
  FileText,
  Tag,
  Building2,
  Mic,
  Send,
  CalendarClock,
  Globe,
  Link2,
  HelpCircle,
  MousePointerClick,
  MapPin,
  Award,
  MessageSquare,
  Timer,
  Gauge,
  Hash,
  HandCoins,
  StopCircle,
  Repeat,
  Thermometer,
  Cpu,
  FlaskConical,
  Percent,
  Megaphone,
} from "lucide-react";
import type { Campaign } from "@/types/models";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { ContractFinancials } from "./useCampaignDetail";
import {
  formatHours,
  fmtCurrency,
  formatDate,
  CopyButton,
  EditText,
  EditNumber,
  EditDate,
  EditSelect,
  EditToggle,
  InfoRow,
  BoolRow,
  SectionHeader,
} from "./formFields";

export interface CampaignStageEditorProps {
  campaign: Campaign;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  linkedPrompt: any | null;
  conversationPrompts: any[];
  linkedContract: ContractFinancials | null;
  compact?: boolean;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
}

export function CampaignStageEditor({
  campaign,
  isEditing,
  draft,
  setDraft,
  linkedPrompt,
  conversationPrompts,
  linkedContract,
  compact = false,
  focusField = null,
  onStartEditField,
}: CampaignStageEditorProps) {
  const { t } = useTranslation("campaigns");
  const { isAgencyUser } = useWorkspace();
  const [, navigate] = useLocation();

  // ── Inline editing helpers ───────────────────────────────────────────────────
  // editFor(field) — props to add to InfoRow so clicking the value enters edit mode
  const editFor = (field: string) =>
    onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField(field) } : {};

  // focusFor(field) — props to add to EditText/EditNumber/EditSelect to auto-focus on mount
  const focusFor = (field: string) => ({ autoFocus: focusField === field });

  // directToggle(field, currentValue) — props for BoolRow to toggle immediately in view mode
  const directToggle = (field: string, currentValue: boolean | null | undefined) =>
    onStartEditField && !isEditing
      ? { onDirectToggle: () => { onStartEditField(field); setDraft(d => ({ ...d, [field]: !currentValue })); } }
      : {};

  // clickToEdit — wrapper class + onClick for freeform text sections
  const clickToEdit = (field: string) =>
    onStartEditField && !isEditing
      ? {
          onClick: () => onStartEditField(field),
          className: "cursor-text rounded px-0.5 -mx-0.5 hover:bg-muted/50 transition-colors",
        }
      : { className: "" };

  return (
    <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[3px]", "max-w-[1386px] w-full mr-auto")}>

      {/* Column 1: Business & Campaign Info */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-settings">
        <h3 className="text-[18px] font-semibold font-heading leading-tight text-foreground pb-1">Business & Campaign</h3>

        <SectionHeader label="Business Info" />
        <InfoRow icon={Building2} label={t("config.businessDescription")} value={campaign.description} richText={true}
          {...editFor("description")}
          editChild={isEditing ? <EditText value={String(draft.description ?? "")} onChange={(v) => setDraft(d => ({...d, description: v}))} multiline placeholder="Business description…" {...focusFor("description")} /> : undefined}
        />
        <InfoRow icon={Globe} label={t("config.website")} value={campaign.website || ""}
          {...editFor("website")}
          editChild={isEditing ? <EditText value={String(draft.website ?? "")} onChange={(v) => setDraft(d => ({...d, website: v}))} placeholder="https://example.com" {...focusFor("website")} /> : undefined}
        />
        <InfoRow icon={Link2} label={t("config.calendarLink")} value={campaign.calendar_link_override || campaign.calendar_link}
          {...editFor("calendar_link_override")}
          editChild={isEditing ? <EditText value={String(draft.calendar_link_override ?? "")} onChange={(v) => setDraft(d => ({...d, calendar_link_override: v}))} placeholder="https://calendly.com/…" {...focusFor("calendar_link_override")} /> : undefined}
        />

        <SectionHeader label="Campaign Info" />
        <InfoRow icon={Globe} label={t("config.language")} value={campaign.language}
          {...editFor("language")}
          editChild={isEditing ? <EditSelect value={String(draft.language ?? "")} onChange={(v) => setDraft(d => ({...d, language: v}))} options={["", "English", "Portuguese", "Dutch", "Spanish"]} {...focusFor("language")} /> : undefined}
        />
        {(isEditing ? draft.is_demo : campaign.is_demo) && (
          <InfoRow icon={Building2} label={t("config.demoClientName")} value={campaign.demo_client_name}
            {...editFor("demo_client_name")}
            editChild={isEditing ? <EditText value={String(draft.demo_client_name ?? "")} onChange={(v) => setDraft(d => ({...d, demo_client_name: v}))} placeholder="Client company name…" {...focusFor("demo_client_name")} /> : undefined}
          />
        )}
        <InfoRow icon={HelpCircle} label={t("config.nicheQuestion")} value={campaign.niche_question}
          {...editFor("niche_question")}
          editChild={isEditing ? <EditText value={String(draft.niche_question ?? "")} onChange={(v) => setDraft(d => ({...d, niche_question: v}))} placeholder="e.g. Are you still looking for…?" {...focusFor("niche_question")} /> : undefined}
        />
        <InfoRow icon={MapPin} label={t("config.niche")} value={campaign.niche}
          {...editFor("niche")}
          editChild={isEditing ? <EditText value={String(draft.niche ?? "")} onChange={(v) => setDraft(d => ({...d, niche: v}))} placeholder="e.g. Solar Energy, Real Estate" {...focusFor("niche")} /> : undefined}
        />
        <InfoRow icon={MousePointerClick} label={t("config.whatLeadDid")} value={campaign.what_lead_did} richText={true}
          {...editFor("what_lead_did")}
          editChild={isEditing ? <EditText value={String(draft.what_lead_did ?? "")} onChange={(v) => setDraft(d => ({...d, what_lead_did: v}))} multiline placeholder="e.g. Filled out a form, clicked an ad…" {...focusFor("what_lead_did")} /> : undefined}
        />
        <InfoRow icon={MapPin} label={t("config.inquiriesSource")} value={campaign.inquiries_source}
          {...editFor("inquiries_source")}
          editChild={isEditing ? <EditText value={String(draft.inquiries_source ?? "")} onChange={(v) => setDraft(d => ({...d, inquiries_source: v}))} placeholder="e.g. Contact form, landing page" {...focusFor("inquiries_source")} /> : undefined}
        />
        <InfoRow icon={Clock} label={t("config.inquiryTimeframe")} value={campaign.inquiry_timeframe}
          {...editFor("inquiry_timeframe")}
          editChild={isEditing ? <EditText value={String(draft.inquiry_timeframe ?? "")} onChange={(v) => setDraft(d => ({...d, inquiry_timeframe: v}))} placeholder="e.g. Last 6 months, 2+ years ago" {...focusFor("inquiry_timeframe")} /> : undefined}
        />
        <InfoRow icon={Award} label={t("config.usp")} value={campaign.campaign_usp} richText={true}
          {...editFor("campaign_usp")}
          editChild={isEditing ? <EditText value={String(draft.campaign_usp ?? "")} onChange={(v) => setDraft(d => ({...d, campaign_usp: v}))} multiline placeholder="What makes this offer unique…" {...focusFor("campaign_usp")} /> : undefined}
        />
      </div>

      {/* Column 2: AI Settings */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-ai">
        <h3 className="text-[18px] font-semibold font-heading leading-tight text-foreground pb-1">{t("config.aiSettings")}</h3>
        <SectionHeader label="Agent" />
        <InfoRow icon={Bot} label={t("config.agent")} value={campaign.agent_name}
          {...editFor("agent_name")}
          editChild={isEditing ? <EditText value={String(draft.agent_name ?? "")} onChange={(v) => setDraft(d => ({...d, agent_name: v}))} {...focusFor("agent_name")} /> : undefined}
        />
        <InfoRow icon={Tag} label={t("config.aiRole")} value={campaign.ai_role}
          {...editFor("ai_role")}
          editChild={isEditing ? <EditText value={String(draft.ai_role ?? "")} onChange={(v) => setDraft(d => ({...d, ai_role: v}))} placeholder="e.g. admin, support, specialist" {...focusFor("ai_role")} /> : undefined}
        />
        <InfoRow icon={Megaphone} label={t("config.service")} value={campaign.service_name}
          {...editFor("service_name")}
          editChild={isEditing ? <EditText value={String(draft.service_name ?? "")} onChange={(v) => setDraft(d => ({...d, service_name: v}))} {...focusFor("service_name")} /> : undefined}
        />

        {/* Templates */}
        <SectionHeader label="Templates" />

        {/* Linked Prompt */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">{t("config.promptLinked")}</p>
          {isEditing ? (
            <select
              value={String(draft.prompt_linked_id ?? "")}
              onChange={(e) => setDraft(d => ({ ...d, prompt_linked_id: e.target.value }))}
              className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-brand-indigo/30 transition-colors"
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
                localStorage.setItem("prompt-library-initial-id", String(linkedPrompt.id || linkedPrompt.Id));
                navigate(isAgencyUser ? "/agency/prompt-library" : "/subaccount/prompt-library");
              }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-brand-indigo/10 text-brand-indigo flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium flex-1 truncate">{linkedPrompt.name || linkedPrompt.Name}</span>
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-medium",
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

        <hr className="border-border/20" />

        {/* First message */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("config.firstMessage")}</span>
            {!isEditing && (campaign.First_Message || campaign.First_Message) && (
              <CopyButton value={campaign.First_Message || campaign.First_Message || ""} />
            )}
          </div>
          {isEditing ? (
            <EditText value={String(draft.First_Message ?? "")} onChange={(v) => setDraft(d => ({...d, First_Message: v}))} multiline placeholder="Hi {name}, we noticed…" {...focusFor("first_message_template")} />
          ) : (
            campaign.First_Message || campaign.First_Message
              ? <p {...clickToEdit("first_message_template")} className={cn("text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words", clickToEdit("first_message_template").className)}>{campaign.First_Message || campaign.First_Message}</p>
              : <p {...clickToEdit("first_message_template")} className={cn("text-[11px] text-foreground/40 italic", clickToEdit("first_message_template").className)}>{t("config.noTemplateSet")}</p>
          )}
        </div>

        {/* Second message */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Second Message</span>
            {!isEditing && campaign.second_message && <CopyButton value={campaign.second_message} />}
          </div>
          <p className="text-[10px] text-foreground/40 italic">Auto-sent on first lead reply, before AI takes over</p>
          {isEditing ? (
            <EditText value={String(draft.second_message ?? "")} onChange={(v) => setDraft(d => ({...d, second_message: v}))} multiline placeholder="Nice! My manager asked me to reach out but I didn't want to spam you. Are you still looking?" {...focusFor("second_message")} />
          ) : (
            campaign.second_message
              ? <p {...clickToEdit("second_message")} className={cn("text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words", clickToEdit("second_message").className)}>{campaign.second_message}</p>
              : <p {...clickToEdit("second_message")} className={cn("text-[11px] text-foreground/40 italic", clickToEdit("second_message").className)}>{t("config.noTemplateSet")}</p>
          )}
        </div>

        {/* Bumps 1–3 */}
        {[1, 2, 3].map((n) => {
          const templateKey = `bump_${n}_template` as keyof Campaign;
          const delayKey = `bump_${n}_delay_hours` as keyof Campaign;
          const aiRefKey = `bump_${n}_ai_reference` as keyof Campaign;
          const templateVal = campaign[templateKey] as string | undefined;
          const delayVal = campaign[delayKey] as number | undefined;
          const aiRefVal = campaign[aiRefKey] as boolean | undefined;
          const draftTemplateKey = `bump_${n}_template`;
          const draftDelayKey = `bump_${n}_delay_hours`;
          const draftAiRefKey = `bump_${n}_ai_reference`;
          return (
            <div key={n} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Bump {n}</span>
                  <ChevronRight className="w-3 h-3 text-foreground/30" />
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-foreground/50">{t("config.delayHours")}</span>
                      <input
                        type="number"
                        value={String(draft[draftDelayKey] ?? "")}
                        onChange={(e) => setDraft(d => ({...d, [draftDelayKey]: e.target.value === "" ? "" : Number(e.target.value)}))}
                        className="w-14 text-[11px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none"
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
              <BoolRow icon={Bot} label={t(`config.bump${n}AiReference`)} value={aiRefVal ?? false}
                {...directToggle(draftAiRefKey, Boolean(draft[draftAiRefKey] ?? aiRefVal))}
                editChild={isEditing ? <EditToggle value={Boolean(draft[draftAiRefKey] ?? aiRefVal)} onChange={(v) => setDraft(d => ({...d, [draftAiRefKey]: v}))} /> : undefined}
              />
            </div>
          );
        })}

        <SectionHeader label="Voice Notes" />
        <BoolRow icon={Mic} label={t("config.firstMessageVoiceNote")} value={campaign.first_message_voice_note ?? false}
          {...directToggle("first_message_voice_note", Boolean(draft.first_message_voice_note ?? campaign.first_message_voice_note))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.first_message_voice_note ?? campaign.first_message_voice_note)} onChange={(v) => setDraft(d => ({...d, first_message_voice_note: v}))} /> : undefined}
        />
        <BoolRow icon={Mic} label={t("config.bump1VoiceNote")} value={campaign.bump_1_voice_note ?? false}
          {...directToggle("bump_1_voice_note", Boolean(draft.bump_1_voice_note ?? campaign.bump_1_voice_note))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.bump_1_voice_note ?? campaign.bump_1_voice_note)} onChange={(v) => setDraft(d => ({...d, bump_1_voice_note: v}))} /> : undefined}
        />
        <BoolRow icon={Mic} label={t("config.bump2VoiceNote")} value={campaign.bump_2_voice_note ?? false}
          {...directToggle("bump_2_voice_note", Boolean(draft.bump_2_voice_note ?? campaign.bump_2_voice_note))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.bump_2_voice_note ?? campaign.bump_2_voice_note)} onChange={(v) => setDraft(d => ({...d, bump_2_voice_note: v}))} /> : undefined}
        />
        <BoolRow icon={Mic} label={t("config.bump3VoiceNote")} value={campaign.bump_3_voice_note ?? false}
          {...directToggle("bump_3_voice_note", Boolean(draft.bump_3_voice_note ?? campaign.bump_3_voice_note))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.bump_3_voice_note ?? campaign.bump_3_voice_note)} onChange={(v) => setDraft(d => ({...d, bump_3_voice_note: v}))} /> : undefined}
        />
        <BoolRow icon={Mic} label={t("config.aiReplyVoiceNote")} value={campaign.ai_reply_voice_note ?? false}
          {...directToggle("ai_reply_voice_note", Boolean(draft.ai_reply_voice_note ?? campaign.ai_reply_voice_note))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.ai_reply_voice_note ?? campaign.ai_reply_voice_note)} onChange={(v) => setDraft(d => ({...d, ai_reply_voice_note: v}))} /> : undefined}
        />
        <InfoRow icon={Hash} label={t("config.voiceId")} value={campaign.tts_voice_id || null}
          {...editFor("tts_voice_id")}
          editChild={isEditing ? <EditText value={String(draft.tts_voice_id ?? "")} onChange={(v) => setDraft(d => ({...d, tts_voice_id: v}))} placeholder="Voice ID" {...focusFor("tts_voice_id")} /> : undefined}
        />

        <SectionHeader label={t("config.aiSettings")} />
        <InfoRow icon={Cpu} label={t("config.model")} value={campaign.ai_model || "Default"}
          {...editFor("ai_model")}
          editChild={isEditing ? <EditSelect value={String(draft.ai_model ?? "")} onChange={(v) => setDraft(d => ({...d, ai_model: v}))} options={["", "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.3-chat-latest", "gpt-5.3-codex", "gpt-5.2", "gpt-5.2-chat-latest", "gpt-5.2-codex", "gpt-5.2-pro", "gpt-5.1", "gpt-5.1-chat-latest", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "claude-haiku-4-5"]} {...focusFor("ai_model")} /> : undefined}
        />
        <InfoRow icon={Thermometer} label={t("config.temperature")} value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : null}
          {...editFor("ai_temperature")}
          editChild={isEditing ? <EditNumber value={String(draft.ai_temperature ?? "")} onChange={(v) => setDraft(d => ({...d, ai_temperature: v}))} placeholder="0.7" {...focusFor("ai_temperature")} /> : undefined}
        />
        <InfoRow icon={Bot} label={t("config.aiStyleOverride")} value={campaign.ai_style_override}
          {...editFor("ai_style_override")}
          editChild={isEditing ? <EditText value={String(draft.ai_style_override ?? "")} onChange={(v) => setDraft(d => ({...d, ai_style_override: v}))} multiline placeholder="Custom style instructions for the AI…" {...focusFor("ai_style_override")} /> : undefined}
        />
      </div>

      {/* Column 3: Behavior */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto">
        <h3 className="text-[18px] font-semibold font-heading leading-tight text-foreground pb-1">Behavior</h3>

        <SectionHeader label="Campaign Settings" />
        <InfoRow icon={FileText} label={t("config.campaignName") || "Campaign Name"} value={campaign.name}
          {...editFor("name")}
          editChild={isEditing ? <EditText value={String(draft.name ?? campaign.name ?? "")} onChange={(v) => setDraft(d => ({...d, name: v}))} placeholder="Campaign name…" {...focusFor("name")} /> : undefined}
        />
        {isAgencyUser && (
          <>
            <BoolRow icon={FlaskConical} label={t("config.isDemo")} value={campaign.is_demo ?? false}
              {...directToggle("is_demo", Boolean(draft.is_demo ?? campaign.is_demo))}
              editChild={isEditing ? <EditToggle value={Boolean(draft.is_demo ?? campaign.is_demo)} onChange={(v) => setDraft(d => ({...d, is_demo: v}))} /> : undefined}
            />
            <InfoRow icon={Building2} label={t("config.accountId")} value={campaign.account_name || `Account ${campaign.account_id}`}
              {...editFor("accountsId")}
              editChild={isEditing ? <EditNumber value={Number(draft.accountsId ?? campaign.account_id ?? 1)} onChange={(v) => setDraft(d => ({...d, accountsId: v}))} {...focusFor("accountsId")} /> : undefined}
            />
          </>
        )}
        <InfoRow icon={Zap} label={t("columns.status")} value={String(campaign.status || "—")}
          {...editFor("status")}
          editChild={isEditing ? <EditSelect value={String(draft.status ?? campaign.status ?? "")} onChange={(v) => setDraft(d => ({...d, status: v}))} options={["Active", "Paused", "Draft", "Completed", "Inactive"]} {...focusFor("status")} /> : undefined}
        />
        <InfoRow icon={Tag} label={t("config.type")} value={campaign.type}
          {...editFor("type")}
          editChild={isEditing ? (
            <select
              value={draft.type as string || ""}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Select type —</option>
              <option value="Cold Outreach">Cold Outreach</option>
              <option value="Re-engagement">Re-engagement</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Event">Event</option>
            </select>
          ) : undefined}
        />

        {/* Booking Mode */}
        <div className="flex flex-col gap-0.5 py-2 border-b border-border/20">
          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{t("config.bookingMode")}</span>
          {isEditing ? (
            <div className="flex gap-1 flex-wrap">
              {(["Call Agent", "Direct Booking"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, booking_mode_override: mode }))}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                    draft.booking_mode_override === mode
                      ? "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo"
                      : "border-black/[0.125] bg-transparent text-foreground/60 hover:bg-muted/50"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          ) : (
            <span
              {...(onStartEditField ? { onClick: () => onStartEditField("booking_mode_override") } : {})}
              className={cn("text-[12px] text-foreground", onStartEditField && "cursor-text rounded px-0.5 -mx-0.5 hover:bg-muted/50 transition-colors")}
            >
              {campaign.booking_mode_override || "—"}
            </span>
          )}
        </div>

        {/* Typo Count */}
        <div className="flex flex-col gap-0.5 py-2 border-b border-border/20">
          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">Typos per chat</span>
          {isEditing ? (
            <div className="flex gap-1">
              {([0, 1, 2, 3] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, typo_count: count }))}
                  className={cn(
                    "text-[11px] font-medium w-8 h-7 rounded-full border transition-colors",
                    (draft.typo_count ?? 1) === count
                      ? "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo"
                      : "border-black/[0.125] bg-transparent text-foreground/60 hover:bg-muted/50"
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          ) : (
            <span
              {...(onStartEditField ? { onClick: () => onStartEditField("typo_count") } : {})}
              className={cn("text-[12px] text-foreground", onStartEditField && "cursor-text rounded px-0.5 -mx-0.5 hover:bg-muted/50 transition-colors")}
            >
              {campaign.typo_count ?? 1}
            </span>
          )}
        </div>

        <SectionHeader label="Timing" />
        <InfoRow icon={Clock}
          label={t("config.activeHours")}
          value={campaign.active_hours_start || campaign.active_hours_end ? `${campaign.active_hours_start || "—"} → ${campaign.active_hours_end || "—"}` : null}
          {...editFor("active_hours_start")}
          editChild={isEditing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <EditText value={String(draft.active_hours_start ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_start: v}))} placeholder="09:00" {...focusFor("active_hours_start")} />
              <span className="text-foreground/40 text-[11px]">→</span>
              <EditText value={String(draft.active_hours_end ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_end: v}))} placeholder="18:00" />
            </div>
          ) : undefined}
        />
        <InfoRow icon={CalendarClock}
          label="Campaign Duration"
          value={campaign.start_date || campaign.end_date ? `${formatDate(campaign.start_date)} → ${formatDate(campaign.end_date)}` : null}
          {...editFor("start_date")}
          editChild={isEditing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <EditDate value={String(draft.start_date ?? "")} onChange={(v) => setDraft(d => ({...d, start_date: v}))} />
              <span className="text-foreground/40 text-[11px]">→</span>
              <EditDate value={String(draft.end_date ?? "")} onChange={(v) => setDraft(d => ({...d, end_date: v}))} />
            </div>
          ) : undefined}
        />
        {(isEditing ? draft.channel : campaign.channel) !== "whatsapp" && (
          <InfoRow icon={Gauge} label={t("config.dailyLimit")} value={campaign.daily_lead_limit?.toLocaleString()}
            {...editFor("daily_lead_limit")}
            editChild={isEditing ? <EditNumber value={String(draft.daily_lead_limit ?? "")} onChange={(v) => setDraft(d => ({...d, daily_lead_limit: v}))} placeholder="e.g. 50" {...focusFor("daily_lead_limit")} /> : undefined}
          />
        )}
        <InfoRow icon={Timer} label={t("config.interval")} value={campaign.message_interval_minutes ? `${campaign.message_interval_minutes} min` : null}
          {...editFor("message_interval_minutes")}
          editChild={isEditing ? <EditNumber value={String(draft.message_interval_minutes ?? "")} onChange={(v) => setDraft(d => ({...d, message_interval_minutes: v}))} placeholder="minutes" {...focusFor("message_interval_minutes")} /> : undefined}
        />

        <SectionHeader label="Channel & Outreach" />
        <InfoRow icon={Send}
          label={t("config.channel")}
          value={
            <div className="flex items-center gap-2">
              <img
                src={`/logos/${(
                  ({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[String(campaign.channel || "whatsapp").toLowerCase()] ?? "whatsapp-svgrepo-com"
                )}.svg`}
                alt={campaign.channel || "WhatsApp"}
                className="h-4 w-4 object-contain shrink-0"
              />
              <span className="capitalize">{campaign.channel || "WhatsApp"}</span>
            </div>
          }
          {...editFor("channel")}
          editChild={isEditing ? <EditSelect value={String(draft.channel ?? campaign.channel ?? "whatsapp")} onChange={(v) => setDraft(d => ({...d, channel: v}))} options={["whatsapp", "email", "sms"]} {...focusFor("channel")} /> : undefined}
        />
        {campaign.channel === "whatsapp" && (
          <InfoRow
            label={t("config.whatsappTier")}
            value={(() => {
              const lim = campaign.daily_lead_limit;
              if (!lim || lim > 100000) return "Tier 4 · ∞";
              if (lim > 10000) return "Tier 3 · 100k/day";
              if (lim > 1000) return "Tier 2 · 10k/day";
              return "Tier 1 · 1,000/day";
            })()}
          />
        )}
        <BoolRow icon={StopCircle} label={t("config.stopOnResponse")} value={campaign.stop_on_response}
          {...directToggle("stop_on_response", Boolean(draft.stop_on_response ?? campaign.stop_on_response))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.stop_on_response ?? campaign.stop_on_response)} onChange={(v) => setDraft(d => ({...d, stop_on_response: v}))} /> : undefined}
        />
        <BoolRow icon={Repeat} label={t("config.useAiBumps")} value={campaign.use_ai_bumps}
          {...directToggle("use_ai_bumps", Boolean(draft.use_ai_bumps ?? campaign.use_ai_bumps))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.use_ai_bumps ?? campaign.use_ai_bumps)} onChange={(v) => setDraft(d => ({...d, use_ai_bumps: v}))} /> : undefined}
        />
        <InfoRow icon={Hash} label={t("config.maxBumps")} value={campaign.max_bumps}
          {...editFor("max_bumps")}
          editChild={isEditing ? <EditNumber value={String(draft.max_bumps ?? "")} onChange={(v) => setDraft(d => ({...d, max_bumps: v}))} placeholder="e.g. 3" {...focusFor("max_bumps")} /> : undefined}
        />

        {/* Buying Signal Response */}
        <div className="flex flex-col gap-0.5 py-2 border-b border-border/20 last:border-0">
          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{t("config.buyingSignalResponse")}</span>
          {isEditing ? (
            <EditText
              value={String(draft.buying_signal_response ?? campaign.buying_signal_response ?? "")}
              onChange={(v) => setDraft(d => ({...d, buying_signal_response: v}))}
              multiline
              placeholder={t("config.buyingSignalResponsePlaceholder")}
              {...focusFor("buying_signal_response")}
            />
          ) : (
            campaign.buying_signal_response
              ? <p {...clickToEdit("buying_signal_response")} className={cn("text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words", clickToEdit("buying_signal_response").className)}>{campaign.buying_signal_response}</p>
              : <p {...clickToEdit("buying_signal_response")} className={cn("text-[11px] text-foreground/40 italic", clickToEdit("buying_signal_response").className)}>{t("config.buyingSignalResponseDefault")}</p>
          )}
        </div>

        <SectionHeader label={t("config.contract")} />
        <InfoRow icon={FileText}
          label={t("config.deal")}
          value={linkedContract ? (linkedContract.title || `Contract #${linkedContract.id}`) : t("config.noneLinked")}
        />
        {linkedContract?.deal_type && (
          <InfoRow icon={Tag}
            label={t("financials.dealType")}
            value={(() => {
              const dtBadge: Record<string, { bg: string; text: string }> = {
                retainer:      { bg: "#DBEAFE", text: "#1D4ED8" },
                per_booking:   { bg: "#D1FAE5", text: "#065F46" },
                fixed:         { bg: "#F3F4F6", text: "#374151" },
                retainer_plus: { bg: "#EDE9FE", text: "#5B21B6" },
                sale_closed:   { bg: "#FEF3C7", text: "#92400E" },
              };
              const dtLabels: Record<string, string> = {
                retainer:      t("financials.dealTypes.retainer"),
                per_booking:   t("financials.dealTypes.per_booking"),
                fixed:         t("financials.dealTypes.fixed"),
                retainer_plus: t("financials.dealTypes.retainer_plus"),
                sale_closed:   t("financials.dealTypes.sale_closed"),
              };
              const colors = dtBadge[linkedContract.deal_type!] ?? { bg: "#F3F4F6", text: "#374151" };
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: colors.bg, color: colors.text }}>
                  {dtLabels[linkedContract.deal_type!] ?? linkedContract.deal_type}
                </span>
              );
            })()}
          />
        )}
        {linkedContract?.payment_trigger && (
          <InfoRow icon={HandCoins}
            label={t("financials.paymentTrigger")}
            value={(() => {
              const ptLabels: Record<string, string> = {
                booked_call:  t("financials.paymentTriggers.booked_call"),
                sale_closed:  t("financials.paymentTriggers.sale_closed"),
                meeting_held: t("financials.paymentTriggers.meeting_held"),
              };
              return ptLabels[linkedContract.payment_trigger!] ?? linkedContract.payment_trigger;
            })()}
          />
        )}
        <InfoRow icon={HandCoins}
          label={t("config.valuePerBooking")}
          value={
            linkedContract?.value_per_booking != null
              ? fmtCurrency(Number(linkedContract.value_per_booking))
              : campaign.value_per_booking != null
                ? fmtCurrency(Number(campaign.value_per_booking))
                : null
          }
        />

        <SectionHeader label={t("abTesting.title")} />
        <BoolRow icon={FlaskConical} label={t("abTesting.enabled")} value={campaign.ab_enabled}
          {...directToggle("ab_enabled", Boolean(draft.ab_enabled ?? campaign.ab_enabled))}
          editChild={isEditing ? (
            <EditToggle value={Boolean(draft.ab_enabled ?? campaign.ab_enabled)} onChange={(v) => setDraft(d => ({...d, ab_enabled: v}))} />
          ) : undefined}
        />
        {(isEditing ? draft.ab_enabled : campaign.ab_enabled) && (
          <InfoRow icon={Percent} label={t("abTesting.splitRatio")}
            value={campaign.ab_split_ratio != null ? `${campaign.ab_split_ratio}%` : "50%"}
            {...editFor("ab_split_ratio")}
            editChild={isEditing ? (
              <EditNumber value={String(draft.ab_split_ratio ?? 50)} onChange={(v) => setDraft(d => ({...d, ab_split_ratio: v}))} placeholder="50" {...focusFor("ab_split_ratio")} />
            ) : undefined}
          />
        )}
      </div>

    </div>
  );
}
