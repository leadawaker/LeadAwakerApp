/**
 * CampaignStageEditor
 *
 * The "Configurations" tab content of CampaignDetailView.
 * Contains: Business & Campaign info, AI Settings (templates, bumps, voice notes),
 * and Behavior (timing, channel, contract, A/B test).
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Zap,
  Bot,
  CheckCircle2,
  XCircle,
  ChevronRight,
  FileText,
  ArrowRight,
  Tag,
  Building2,
  Mic,
  Send,
  Settings2,
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
  Copy,
  Check,
} from "lucide-react";
import type { Campaign } from "@/types/models";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import type { ContractFinancials } from "./useCampaignDetail";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHours(h: number | null | undefined): string {
  if (!h && h !== 0) return "—";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return rem > 0 ? `${d}d ${rem}h` : `${d}d`;
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false, editChild, richText = false, icon: Icon }: {
  label: string; value: React.ReactNode; mono?: boolean; editChild?: React.ReactNode; richText?: boolean; icon?: React.ElementType;
}) {
  const renderValue = () => {
    if (value == null) return <span className="text-[12px] text-foreground">{"—"}</span>;
    if (richText && typeof value === "string") {
      return (
        <div
          className={cn("text-[12px] text-foreground break-words leading-relaxed", mono && "font-mono text-[11px]")}
          style={{ whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{
            __html: value
              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
              .replace(/\*(.*?)\*/g, "<em>$1</em>")
              .replace(/\n/g, "<br/>"),
          }}
        />
      );
    }
    if (typeof value === "string" && value.includes("\n")) {
      return (
        <pre className={cn("text-[12px] text-foreground break-words leading-relaxed font-sans", mono && "font-mono text-[11px]")}>
          {value}
        </pre>
      );
    }
    return (
      <span className={cn("text-[12px] text-foreground break-words", mono && "font-mono text-[11px]")}>
        {value}
      </span>
    );
  };
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      {editChild ?? renderValue()}
    </div>
  );
}

function BoolRow({ label, value, editChild, icon: Icon }: {
  label: string; value: boolean | null | undefined; editChild?: React.ReactNode; icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      {editChild ?? (value
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        : <XCircle className="w-4 h-4 text-foreground/25" />
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 pt-3 mt-1 mb-1 border-t border-white/30">
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{label}</span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation("campaigns");
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const doCopy = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(doCopy).catch(() => {
        const ta = document.createElement("textarea"); ta.value = value; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); doCopy();
      });
    } else {
      const ta = document.createElement("textarea"); ta.value = value; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); doCopy();
    }
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors text-foreground/40 hover:text-foreground shrink-0" title={t("copy")}>
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Editable field helpers ────────────────────────────────────────────────────

function EditText({ value, onChange, placeholder, multiline = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 320) + "px";
  }, [value]);
  if (multiline) {
    return (
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 resize-none outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30 overflow-y-auto"
        style={{ minHeight: "72px", maxHeight: "320px" }}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30"
    />
  );
}

function EditNumber({ value, onChange, placeholder }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30"
    />
  );
}

function EditDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40"
    />
  );
}

function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EditToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        value ? "bg-brand-indigo" : "bg-foreground/20"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
        value ? "translate-x-[18px]" : "translate-x-0"
      )} />
    </button>
  );
}

// Need useRef imported
import { useRef } from "react";

// ── ContractSelect ────────────────────────────────────────────────────────────

function ContractSelect({ value, onChange, accountsId }: {
  value: string; onChange: (v: string) => void; accountsId?: number | null;
}) {
  const [contracts, setContracts] = useState<{ id: number; title: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = accountsId ? `/api/contracts?accountId=${accountsId}` : "/api/contracts";
    apiFetch(url)
      .then((r) => r.json())
      .then((data) => { const list = Array.isArray(data) ? data : data?.list ?? []; setContracts(list); })
      .catch(() => setContracts([]))
      .finally(() => setLoading(false));
  }, [accountsId]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40"
    >
      <option value="">{"—"}</option>
      {contracts.map((c) => (
        <option key={c.id} value={String(c.id)}>{c.title || `Contract #${c.id}`}</option>
      ))}
    </select>
  );
}

// ── CampaignStageEditor (main export) ─────────────────────────────────────────

export interface CampaignStageEditorProps {
  campaign: Campaign;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  linkedPrompt: any | null;
  conversationPrompts: any[];
  linkedContract: ContractFinancials | null;
  compact?: boolean;
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
}: CampaignStageEditorProps) {
  const { t } = useTranslation("campaigns");
  const { isAgencyUser } = useWorkspace();
  const [, navigate] = useLocation();

  return (
    <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[3px]", "max-w-[1386px] w-full mr-auto")}>

      {/* Column 1: Business & Campaign Info */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-settings">
        <h3 className="text-[18px] font-semibold font-heading leading-tight text-foreground pb-1">Business & Campaign</h3>

        <SectionHeader label="Business Info" />
        <InfoRow icon={Building2} label={t("config.businessDescription")} value={campaign.description} richText={true}
          editChild={isEditing ? <EditText value={String(draft.description ?? "")} onChange={(v) => setDraft(d => ({...d, description: v}))} multiline placeholder="Business description…" /> : undefined}
        />
        <InfoRow icon={Globe} label={t("config.website")} value={campaign.website || ""}
          editChild={isEditing ? <EditText value={String(draft.website ?? "")} onChange={(v) => setDraft(d => ({...d, website: v}))} placeholder="https://example.com" /> : undefined}
        />
        <InfoRow icon={Link2} label={t("config.calendarLink")} value={campaign.calendar_link_override || campaign.calendar_link}
          editChild={isEditing ? <EditText value={String(draft.calendar_link_override ?? "")} onChange={(v) => setDraft(d => ({...d, calendar_link_override: v}))} placeholder="https://calendly.com/…" /> : undefined}
        />

        <SectionHeader label="Campaign Info" />
        <InfoRow icon={HelpCircle} label={t("config.nicheQuestion")} value={campaign.niche_question}
          editChild={isEditing ? <EditText value={String(draft.niche_question ?? "")} onChange={(v) => setDraft(d => ({...d, niche_question: v}))} placeholder="e.g. Are you still looking for…?" /> : undefined}
        />
        <InfoRow icon={MousePointerClick} label={t("config.whatLeadDid")} value={campaign.what_lead_did} richText={true}
          editChild={isEditing ? <EditText value={String(draft.what_lead_did ?? "")} onChange={(v) => setDraft(d => ({...d, what_lead_did: v}))} multiline placeholder="e.g. Filled out a form, clicked an ad…" /> : undefined}
        />
        <InfoRow icon={MapPin} label={t("config.inquiriesSource")} value={campaign.inquiries_source}
          editChild={isEditing ? <EditText value={String(draft.inquiries_source ?? "")} onChange={(v) => setDraft(d => ({...d, inquiries_source: v}))} placeholder="e.g. Contact form, landing page" /> : undefined}
        />
        <InfoRow icon={Award} label={t("config.usp")} value={campaign.campaign_usp} richText={true}
          editChild={isEditing ? <EditText value={String(draft.campaign_usp ?? "")} onChange={(v) => setDraft(d => ({...d, campaign_usp: v}))} multiline placeholder="What makes this offer unique…" /> : undefined}
        />
      </div>

      {/* Column 2: AI Settings */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-ai">
        <h3 className="text-[18px] font-semibold font-heading leading-tight text-foreground pb-1">{t("config.aiSettings")}</h3>
        <SectionHeader label="Agent" />
        <InfoRow icon={Bot} label={t("config.agent")} value={campaign.agent_name}
          editChild={isEditing ? <EditText value={String(draft.agent_name ?? "")} onChange={(v) => setDraft(d => ({...d, agent_name: v}))} /> : undefined}
        />
        <InfoRow icon={Megaphone} label={t("config.service")} value={campaign.service_name}
          editChild={isEditing ? <EditText value={String(draft.service_name ?? "")} onChange={(v) => setDraft(d => ({...d, service_name: v}))} /> : undefined}
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
            {!isEditing && (campaign.first_message_template || campaign.First_Message) && (
              <CopyButton value={campaign.first_message_template || campaign.First_Message || ""} />
            )}
          </div>
          {isEditing ? (
            <EditText value={String(draft.first_message_template ?? "")} onChange={(v) => setDraft(d => ({...d, first_message_template: v}))} multiline placeholder="Hi {name}, we noticed…" />
          ) : (
            campaign.first_message_template || campaign.First_Message
              ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{campaign.first_message_template || campaign.First_Message}</p>
              : <p className="text-[11px] text-foreground/40 italic">{t("config.noTemplateSet")}</p>
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
            <EditText value={String(draft.second_message ?? "")} onChange={(v) => setDraft(d => ({...d, second_message: v}))} multiline placeholder="Nice! My manager asked me to reach out but I didn't want to spam you. Are you still looking?" />
          ) : (
            campaign.second_message
              ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{campaign.second_message}</p>
              : <p className="text-[11px] text-foreground/40 italic">{t("config.noTemplateSet")}</p>
          )}
        </div>

        {/* Bump 1 */}
        {[1, 2, 3].map((n) => {
          const templateKey = `bump_${n}_template` as keyof Campaign;
          const delayKey = `bump_${n}_delay_hours` as keyof Campaign;
          const templateVal = campaign[templateKey] as string | undefined;
          const delayVal = campaign[delayKey] as number | undefined;
          const draftTemplateKey = `bump_${n}_template`;
          const draftDelayKey = `bump_${n}_delay_hours`;
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
                    <div className="flex items-center gap-1 text-[11px] text-foreground/50">
                      <Clock className="w-3 h-3" />
                      <span>{t("config.delayLabel", { value: formatHours(delayVal) })}</span>
                    </div>
                  )}
                  {!isEditing && templateVal && <CopyButton value={templateVal} />}
                </div>
              </div>
              {isEditing ? (
                <EditText value={String(draft[draftTemplateKey] ?? "")} onChange={(v) => setDraft(d => ({...d, [draftTemplateKey]: v}))} multiline placeholder={`Bump ${n} message…`} />
              ) : (
                templateVal
                  ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{templateVal}</p>
                  : <p className="text-[11px] text-foreground/40 italic">{t("config.noTemplateSet")}</p>
              )}
            </div>
          );
        })}

        <SectionHeader label="Voice Notes" />
        <BoolRow icon={Mic} label={t("config.firstMessageVoiceNote")} value={campaign.first_message_voice_note ?? false}
          editChild={isEditing ? <EditToggle value={Boolean(draft.first_message_voice_note ?? campaign.first_message_voice_note)} onChange={(v) => setDraft(d => ({...d, first_message_voice_note: v}))} /> : undefined}
        />
        <BoolRow icon={Mic} label={t("config.bump1VoiceNote")} value={campaign.bump_1_voice_note ?? false}
          editChild={isEditing ? <EditToggle value={Boolean(draft.bump_1_voice_note ?? campaign.bump_1_voice_note)} onChange={(v) => setDraft(d => ({...d, bump_1_voice_note: v}))} /> : undefined}
        />
        <BoolRow icon={Mic} label={t("config.bump2VoiceNote")} value={campaign.bump_2_voice_note ?? false}
          editChild={isEditing ? <EditToggle value={Boolean(draft.bump_2_voice_note ?? campaign.bump_2_voice_note)} onChange={(v) => setDraft(d => ({...d, bump_2_voice_note: v}))} /> : undefined}
        />
        <BoolRow icon={Mic} label={t("config.bump3VoiceNote")} value={campaign.bump_3_voice_note ?? false}
          editChild={isEditing ? <EditToggle value={Boolean(draft.bump_3_voice_note ?? campaign.bump_3_voice_note)} onChange={(v) => setDraft(d => ({...d, bump_3_voice_note: v}))} /> : undefined}
        />
        <BoolRow icon={Mic} label={t("config.aiReplyVoiceNote")} value={campaign.ai_reply_voice_note ?? false}
          editChild={isEditing ? <EditToggle value={Boolean(draft.ai_reply_voice_note ?? campaign.ai_reply_voice_note)} onChange={(v) => setDraft(d => ({...d, ai_reply_voice_note: v}))} /> : undefined}
        />
        <InfoRow icon={Hash} label={t("config.voiceId")} value={campaign.tts_voice_id || null}
          editChild={isEditing ? <EditText value={String(draft.tts_voice_id ?? "")} onChange={(v) => setDraft(d => ({...d, tts_voice_id: v}))} placeholder="Voice ID" /> : undefined}
        />

        <SectionHeader label={t("config.aiSettings")} />
        <InfoRow icon={Cpu} label={t("config.model")} value={campaign.ai_model || "Default"}
          editChild={isEditing ? <EditSelect value={String(draft.ai_model ?? "")} onChange={(v) => setDraft(d => ({...d, ai_model: v}))} options={["", "gpt-5.4", "gpt-5.4-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "claude-haiku-4-5"]} /> : undefined}
        />
        <InfoRow icon={Thermometer} label={t("config.temperature")} value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : null}
          editChild={isEditing ? <EditNumber value={String(draft.ai_temperature ?? "")} onChange={(v) => setDraft(d => ({...d, ai_temperature: v}))} placeholder="0.7" /> : undefined}
        />
      </div>

      {/* Column 3: Behavior */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto">
        <h3 className="text-[18px] font-semibold font-heading leading-tight text-foreground pb-1">Behavior</h3>

        <SectionHeader label="Campaign Settings" />
        <InfoRow icon={Zap} label={t("columns.status")} value={String(campaign.status || "—")}
          editChild={isEditing ? <EditSelect value={String(draft.status ?? campaign.status ?? "")} onChange={(v) => setDraft(d => ({...d, status: v}))} options={["Active", "Paused", "Draft", "Completed", "Inactive"]} /> : undefined}
        />
        <InfoRow icon={Tag} label={t("config.type")} value={campaign.type}
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
              {(["Call Agent", "Direct Booking", "Qualifying"] as const).map((mode) => (
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
            <span className="text-[12px] text-foreground">{campaign.booking_mode_override || "—"}</span>
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
            <span className="text-[12px] text-foreground">{campaign.typo_count ?? 1}</span>
          )}
        </div>

        <SectionHeader label="Timing" />
        <InfoRow icon={Clock}
          label={t("config.activeHours")}
          value={campaign.active_hours_start || campaign.active_hours_end ? `${campaign.active_hours_start || "—"} → ${campaign.active_hours_end || "—"}` : null}
          editChild={isEditing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <EditText value={String(draft.active_hours_start ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_start: v}))} placeholder="09:00" />
              <span className="text-foreground/40 text-[11px]">→</span>
              <EditText value={String(draft.active_hours_end ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_end: v}))} placeholder="18:00" />
            </div>
          ) : undefined}
        />
        <InfoRow icon={CalendarClock}
          label="Campaign Duration"
          value={campaign.start_date || campaign.end_date ? `${formatDate(campaign.start_date)} → ${formatDate(campaign.end_date)}` : null}
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
            editChild={isEditing ? <EditNumber value={String(draft.daily_lead_limit ?? "")} onChange={(v) => setDraft(d => ({...d, daily_lead_limit: v}))} placeholder="e.g. 50" /> : undefined}
          />
        )}
        <InfoRow icon={Timer} label={t("config.interval")} value={campaign.message_interval_minutes ? `${campaign.message_interval_minutes} min` : null}
          editChild={isEditing ? <EditNumber value={String(draft.message_interval_minutes ?? "")} onChange={(v) => setDraft(d => ({...d, message_interval_minutes: v}))} placeholder="minutes" /> : undefined}
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
          editChild={isEditing ? <EditSelect value={String(draft.channel ?? campaign.channel ?? "whatsapp")} onChange={(v) => setDraft(d => ({...d, channel: v}))} options={["whatsapp", "email", "sms"]} /> : undefined}
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
          editChild={isEditing ? <EditToggle value={Boolean(draft.stop_on_response ?? campaign.stop_on_response)} onChange={(v) => setDraft(d => ({...d, stop_on_response: v}))} /> : undefined}
        />
        <BoolRow icon={Repeat} label={t("config.useAiBumps")} value={campaign.use_ai_bumps}
          editChild={isEditing ? <EditToggle value={Boolean(draft.use_ai_bumps ?? campaign.use_ai_bumps)} onChange={(v) => setDraft(d => ({...d, use_ai_bumps: v}))} /> : undefined}
        />
        <InfoRow icon={Hash} label={t("config.maxBumps")} value={campaign.max_bumps}
          editChild={isEditing ? <EditNumber value={String(draft.max_bumps ?? "")} onChange={(v) => setDraft(d => ({...d, max_bumps: v}))} placeholder="e.g. 3" /> : undefined}
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
            />
          ) : (
            campaign.buying_signal_response
              ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{campaign.buying_signal_response}</p>
              : <p className="text-[11px] text-foreground/40 italic">{t("config.buyingSignalResponseDefault")}</p>
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
          editChild={isEditing ? (
            <EditToggle value={Boolean(draft.ab_enabled ?? campaign.ab_enabled)} onChange={(v) => setDraft(d => ({...d, ab_enabled: v}))} />
          ) : undefined}
        />
        {(isEditing ? draft.ab_enabled : campaign.ab_enabled) && (
          <InfoRow icon={Percent} label={t("abTesting.splitRatio")}
            value={campaign.ab_split_ratio != null ? `${campaign.ab_split_ratio}%` : "50%"}
            editChild={isEditing ? (
              <EditNumber value={String(draft.ab_split_ratio ?? 50)} onChange={(v) => setDraft(d => ({...d, ab_split_ratio: v}))} placeholder="50" />
            ) : undefined}
          />
        )}
      </div>

    </div>
  );
}
