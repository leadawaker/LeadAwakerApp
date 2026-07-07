import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe, MapPin, Building2, Calendar, Clock, Hash, Link,
  MessageCircle, AlertTriangle, BarChart3, DollarSign, CreditCard,
  Eye, Type, Play, Pause, Power, SplitSquareVertical, Radio, Zap,
  Gem, ShieldCheck, Loader2, Mic,
} from "lucide-react";
import {
  EditText, EditNumber, EditDate, EditSelect, EditToggle,
  InfoRow, BoolRow, ContractSelect,
} from "../formFields";
import {
  Select, SelectTrigger, SelectContent, SelectItem,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/apiUtils";
import { resolveNicheIcon } from "@/features/prompts/components/niche/nicheShared";
import { useToast } from "@/hooks/use-toast";

function NicheSelect({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();
  const [niches, setNiches] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    apiFetch("/api/niches")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((data: string[]) => {
        setNiches(Array.isArray(data) ? data : []);
        setStatus("ready");
      })
      .catch(() => {
        setNiches([]);
        setStatus("error");
        toast({ title: t("nicheLoadError"), variant: "destructive" });
      });
  }, [t, toast]);

  const CurIcon = value ? resolveNicheIcon(value, false) : null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="la-input"
        autoFocus={autoFocus}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', gap: 8, boxSizing: 'border-box', width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {status === "loading" && <Loader2 style={{ width: 14, height: 14, flexShrink: 0 }} className="animate-spin" />}
          {CurIcon && <CurIcon style={{ width: 14, height: 14, color: 'var(--wine)', flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || t("selectNichePlaceholder")}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {niches.map((niche) => {
          const Icon = resolveNicheIcon(niche, false);
          return (
            <SelectItem key={niche} value={niche}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon style={{ width: 14, height: 14, color: 'var(--wine)', flexShrink: 0 }} />
                {niche}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

interface BehaviorSectionFieldsProps {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
  isAgency?: boolean;
  contracts?: any[];
  /** Called when niche changes so the parent can load + apply the niche template */
  onNicheChange?: (niche: string) => void;
}

export function BehaviorSectionFields({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField,
  isAgency, contracts,
  onNicheChange,
}: BehaviorSectionFieldsProps) {
  const { t } = useTranslation("campaigns");

  const editFor = (field: string) =>
    onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField(field) } : {};
  const focusFor = (field: string) => ({ autoFocus: focusField === field });

  const languageLabels: Record<string, string> = {
    en: "🇬🇧 English",
    pt: "🇧🇷 Português",
    nl: "🇳🇱 Nederlands",
  };

  // Fields always visible (agency + client)
  const commonFields = (
    <>
      {/* Niche first, then Language — same row */}
      <InfoRow icon={MapPin} label={t("config.niche")} value={campaign.niche}
        {...editFor("niche")}
        editChild={isEditing ? (
          <NicheSelect
            value={String(draft.niche ?? "")}
            onChange={(v) => {
              setDraft(d => ({...d, niche: v}));
              onNicheChange?.(v);
            }}
            {...focusFor("niche")}
          />
        ) : undefined}
      />
      <InfoRow icon={Globe} label={t("config.language")} value={languageLabels[campaign.language] ?? campaign.language}
        {...editFor("language")}
        editChild={isEditing ? <EditSelect value={String(draft.language ?? "")} onChange={(v) => setDraft(d => ({...d, language: v}))} options={["en", "nl", "pt"]} labels={languageLabels} {...focusFor("language")} /> : undefined}
      />

      {/* Positioning dropdown */}
      <InfoRow icon={Gem} label={t("config.positioning")} value={t(`config.positioningOptions.${campaign.positioning || "premium"}`)}
        {...editFor("positioning")}
        editChild={isEditing ? (
          <EditSelect
            value={String(draft.positioning ?? campaign.positioning ?? "premium")}
            onChange={(v) => setDraft(d => ({...d, positioning: v}))}
            options={["premium", "mid_market"]}
            labels={{
              premium: t("config.positioningOptions.premium"),
              mid_market: t("config.positioningOptions.mid_market"),
            }}
            {...focusFor("positioning")}
          />
        ) : undefined}
      />

      {/* Active Hours */}
      <InfoRow icon={Clock} label={t("config.activeHours")} value={`${campaign.active_hours_start || "09:00"} – ${campaign.active_hours_end || "17:00"}`}
        {...editFor("active_hours_start")}
        editChild={isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)' }}>
            <EditText value={String(draft.active_hours_start ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_start: v}))} placeholder="09:00" {...focusFor("active_hours_start")} />
            <span style={{ color: 'var(--mute)' }}>–</span>
            <EditText value={String(draft.active_hours_end ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_end: v}))} placeholder="17:00" {...focusFor("active_hours_end")} />
          </div>
        ) : undefined}
      />

      {/* AI Disclosure + Opt-out Notice — same row */}
      <BoolRow icon={ShieldCheck} label={t("config.aiDisclosure")} value={(draft.ai_disclosure ?? campaign.ai_disclosure) === "on"}
        {...editFor("ai_disclosure")}
        editChild={isEditing ? <EditToggle value={(draft.ai_disclosure ?? campaign.ai_disclosure) === "on"} onChange={(v) => setDraft(d => ({...d, ai_disclosure: v ? "on" : "off"}))} /> : undefined}
      />
      <BoolRow icon={Power} label={t("config.optOutNotice")} value={!!(draft.opt_out_notice ?? campaign.opt_out_notice)}
        {...editFor("opt_out_notice")}
        editChild={isEditing ? <EditToggle value={!!draft.opt_out_notice} onChange={(v) => setDraft(d => ({...d, opt_out_notice: v}))} /> : undefined}
      />
    </>
  );

  // Non-agency users only see the common fields above
  if (!isAgency) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
        {commonFields}
      </div>
    );
  }

  const sectionDivider = (label: string) => (
    <div style={{ gridColumn: '1 / -1', marginTop: 8, marginBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)', opacity: 0.7 }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      {commonFields}

      {/* ── Campaign Setup ── */}
      {sectionDivider("Campaign Setup")}

      <InfoRow icon={Play} label={t("config.status") || "Status"} value={campaign.status}
        {...editFor("status")}
        editChild={isEditing ? <EditSelect value={String(draft.status ?? "")} onChange={(v) => setDraft(d => ({...d, status: v}))} options={["Draft", "Active", "Paused", "Inactive", "Completed"]} {...focusFor("status")} /> : undefined}
      />
      <InfoRow icon={Building2} label={t("config.accountId")} value={campaign.account_name || campaign.account_id}
        {...editFor("account_id")}
        editChild={isEditing ? <EditSelect value={String(draft.account_id ?? "")} onChange={(v) => setDraft(d => ({...d, account_id: v}))} options={[]} {...focusFor("account_id")} /> : undefined}
      />

      <InfoRow icon={Zap} label={t("config.campaignType")} value={t(`config.campaignTypes.${campaign.campaign_type || "reactivation"}`)}
        {...editFor("campaign_type")}
        editChild={isEditing ? <EditSelect value={String(draft.campaign_type ?? "reactivation")} onChange={(v) => setDraft(d => ({...d, campaign_type: v}))} options={["reactivation", "reputation", "speed_to_lead", "missed_call"]} labels={{
          reactivation: t("config.campaignTypes.reactivation"),
          reputation: t("config.campaignTypes.reputation"),
          speed_to_lead: t("config.campaignTypes.speed_to_lead"),
          missed_call: t("config.campaignTypes.missed_call"),
        }} {...focusFor("campaign_type")} /> : undefined}
      />
      <InfoRow icon={Type} label={t("config.type")} value={campaign.type}
        {...editFor("type")}
        editChild={isEditing ? <EditSelect value={String(draft.type ?? "")} onChange={(v) => setDraft(d => ({...d, type: v}))} options={["whatsapp_outbound", "whatsapp_inbound", "email_outbound", "voice_outbound"]} {...focusFor("type")} /> : undefined}
      />

      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MapPin} label={t("config.website")} value={campaign.website}
          {...editFor("website")}
          editChild={isEditing ? <EditText value={String(draft.website ?? "")} onChange={(v) => setDraft(d => ({...d, website: v}))} placeholder="https://…" {...focusFor("website")} /> : undefined}
        />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={Link} label={t("config.calendarLink")} value={campaign.calendar_link_override || campaign.calendar_link}
          {...editFor("calendar_link_override")}
          editChild={isEditing ? <EditText value={String(draft.calendar_link_override ?? "")} onChange={(v) => setDraft(d => ({...d, calendar_link_override: v}))} placeholder="https://calendly.com/…" {...focusFor("calendar_link_override")} /> : undefined}
        />
      </div>

      <BoolRow icon={Eye} label={t("config.isDemo")} value={!!(draft.is_demo ?? campaign.is_demo)}
        {...editFor("is_demo")}
        editChild={isEditing ? <EditToggle value={!!draft.is_demo} onChange={(v) => setDraft(d => ({...d, is_demo: v}))} /> : undefined}
      />

      {/* ── Scheduling ── */}
      {sectionDivider("Scheduling")}

      <InfoRow icon={Calendar} label={t("config.startDate")} value={campaign.start_date}
        {...editFor("start_date")}
        editChild={isEditing ? <EditDate value={String(draft.start_date ?? "")} onChange={(v) => setDraft(d => ({...d, start_date: v}))} {...focusFor("start_date")} /> : undefined}
      />
      <InfoRow icon={Calendar} label={t("config.endDate")} value={campaign.end_date}
        {...editFor("end_date")}
        editChild={isEditing ? <EditDate value={String(draft.end_date ?? "")} onChange={(v) => setDraft(d => ({...d, end_date: v}))} {...focusFor("end_date")} /> : undefined}
      />

      <InfoRow icon={BarChart3} label={t("config.dailyLimit")} value={campaign.daily_lead_limit || 500}
        {...editFor("daily_lead_limit")}
        editChild={isEditing ? <EditNumber value={Number(draft.daily_lead_limit || 500)} onChange={(v) => setDraft(d => ({...d, daily_lead_limit: v === "" ? "" : Number(v)}))} placeholder="500" {...focusFor("daily_lead_limit")} /> : undefined}
      />
      <InfoRow icon={MessageCircle} label={t("config.interval")} value={`${campaign.message_interval_minutes ?? 1} min`}
        description={t("config.intervalHint")}
        {...editFor("message_interval_minutes")}
        editChild={isEditing ? <EditNumber value={Number(draft.message_interval_minutes ?? 1)} onChange={(v) => setDraft(d => ({...d, message_interval_minutes: v}))} {...focusFor("message_interval_minutes")} /> : undefined}
      />

      <InfoRow icon={CreditCard} label={t("config.bookingMode") || "Booking Mode"} value={campaign.booking_mode_override}
        {...editFor("booking_mode_override")}
        editChild={isEditing ? (
          <div className="la-seg la-seg--fill">
            {(["Sales Call", "Direct Booking"] as const).map(mode => (
              <button key={mode} className={`la-seg-btn ${(draft.booking_mode_override ?? campaign.booking_mode_override) === mode ? 'on' : ''}`}
                onClick={() => setDraft(d => ({...d, booking_mode_override: mode}))}
              >{mode}</button>
            ))}
          </div>
        ) : undefined}
      />

      {/* ── Channel ── */}
      {sectionDivider("Channel")}

      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={Radio} label={t("config.channel")} value={campaign.channel}
          {...editFor("channel")}
          editChild={isEditing ? <EditSelect value={String(draft.channel ?? "")} onChange={(v) => setDraft(d => ({...d, channel: v}))} options={["whatsapp", "email", "sms", "voice"]} labels={{ whatsapp: "WhatsApp", email: "Email", sms: "SMS", voice: "Voice" }} {...focusFor("channel")} /> : undefined}
        />
      </div>

      <InfoRow icon={Radio} label={t("config.channelMode")} value={t(`config.channelModes.${campaign.channel_mode || "whatsapp_then_sms"}`)}
        {...editFor("channel_mode")}
        editChild={isEditing ? <EditSelect value={String(draft.channel_mode ?? "whatsapp_then_sms")} onChange={(v) => setDraft(d => ({...d, channel_mode: v}))} options={["whatsapp_only", "whatsapp_then_sms", "sms_first", "sms_only"]} labels={{
          whatsapp_only: t("config.channelModes.whatsapp_only"),
          whatsapp_then_sms: t("config.channelModes.whatsapp_then_sms"),
          sms_first: t("config.channelModes.sms_first"),
          sms_only: t("config.channelModes.sms_only"),
        }} {...focusFor("channel_mode")} /> : undefined}
      />
      <InfoRow icon={Radio} label={t("config.fallbackChannel")} value={t(`config.fallbackChannels.${campaign.fallback_channel || "email"}`)}
        {...editFor("fallback_channel")}
        editChild={isEditing ? <EditSelect value={String(draft.fallback_channel ?? "email")} onChange={(v) => setDraft(d => ({...d, fallback_channel: v}))} options={["email", "sms", "sms_then_email"]} labels={{
          email: t("config.fallbackChannels.email"),
          sms: t("config.fallbackChannels.sms"),
          sms_then_email: t("config.fallbackChannels.sms_then_email"),
        }} {...focusFor("fallback_channel")} /> : undefined}
      />

      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageCircle} label={t("config.coldOpenTemplateSid")} value={campaign.twilio_first_message_template_sid}
          {...editFor("twilio_first_message_template_sid")}
          editChild={isEditing ? <EditText value={String(draft.twilio_first_message_template_sid ?? "")} onChange={(v) => setDraft(d => ({...d, twilio_first_message_template_sid: v}))} placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...focusFor("twilio_first_message_template_sid")} /> : undefined}
        />
      </div>

      {/* ── AI Behavior ── */}
      {sectionDivider("AI Behavior")}

      <BoolRow icon={Pause} label={t("config.stopOnResponse")} value={!!(draft.stop_on_response ?? campaign.stop_on_response)}
        {...editFor("stop_on_response")}
        editChild={isEditing ? <EditToggle value={!!draft.stop_on_response} onChange={(v) => setDraft(d => ({...d, stop_on_response: v}))} /> : undefined}
      />
      <BoolRow icon={Zap} label={t("config.useAiBumps")} value={!!(draft.use_ai_bumps ?? campaign.use_ai_bumps)}
        {...editFor("use_ai_bumps")}
        editChild={isEditing ? <EditToggle value={!!draft.use_ai_bumps} onChange={(v) => setDraft(d => ({...d, use_ai_bumps: v}))} /> : undefined}
      />
      <InfoRow icon={AlertTriangle} label={t("config.maxBumps")} value={campaign.max_bumps}
        {...editFor("max_bumps")}
        editChild={isEditing ? <EditNumber value={Number(draft.max_bumps ?? 4)} onChange={(v) => setDraft(d => ({...d, max_bumps: v}))} {...focusFor("max_bumps")} /> : undefined}
      />
      <InfoRow icon={Hash} label={t("config.typoCount") || "Typo Count"} value={campaign.typo_count ?? 0}
        {...editFor("typo_count")}
        editChild={isEditing ? (
          <div className="la-seg la-seg--pill">
            {[0, 1, 2, 3].map(n => (
              <button key={n} className={`la-seg-btn ${(draft.typo_count ?? campaign.typo_count ?? 0) === n ? 'on' : ''}`}
                onClick={() => setDraft(d => ({...d, typo_count: n}))}
              >{n}</button>
            ))}
          </div>
        ) : undefined}
      />

      <InfoRow icon={Clock} label={t("config.messageDebounce")} value={`${campaign.message_debounce_seconds ?? 10}s`}
        description={t("config.messageDebounceHint")}
        {...editFor("message_debounce_seconds")}
        editChild={isEditing ? <EditNumber value={String(draft.message_debounce_seconds ?? "")} onChange={(v) => setDraft(d => ({...d, message_debounce_seconds: v === "" ? "" : Number(v)}))} placeholder="10" {...focusFor("message_debounce_seconds")} /> : undefined}
      />
      <InfoRow icon={Mic} label={t("config.voiceNoteDebounce")} value={`${campaign.voice_note_debounce_seconds ?? campaign.message_debounce_seconds ?? 60}s`}
        description={t("config.voiceNoteDebounceHint")}
        {...editFor("voice_note_debounce_seconds")}
        editChild={isEditing ? <EditNumber value={String(draft.voice_note_debounce_seconds ?? "")} onChange={(v) => setDraft(d => ({...d, voice_note_debounce_seconds: v === "" ? "" : Number(v)}))} placeholder="60" {...focusFor("voice_note_debounce_seconds")} /> : undefined}
      />

      {/* ── Financials ── */}
      {sectionDivider("Financials")}

      <InfoRow icon={DollarSign} label={t("config.deal")} value={campaign.deal_type || t("config.noneLinked")}
        {...editFor("deal_type")}
        editChild={isEditing ? <EditSelect value={String(draft.deal_type ?? "")} onChange={(v) => setDraft(d => ({...d, deal_type: v}))} options={["retainer", "per_booking", "fixed", "retainer_plus", "sale_closed"]} labels={{
          retainer: t("financials.dealTypes.retainer"),
          per_booking: t("financials.dealTypes.per_booking"),
          fixed: t("financials.dealTypes.fixed"),
          retainer_plus: t("financials.dealTypes.retainer_plus"),
          sale_closed: t("financials.dealTypes.sale_closed"),
        }} {...focusFor("deal_type")} /> : undefined}
      />
      <InfoRow icon={CreditCard} label={t("financials.paymentTrigger")} value={campaign.payment_trigger}
        {...editFor("payment_trigger")}
        editChild={isEditing ? <EditSelect value={String(draft.payment_trigger ?? "")} onChange={(v) => setDraft(d => ({...d, payment_trigger: v}))} options={["booked_call", "sale_closed", "meeting_held"]} labels={{
          booked_call: t("financials.paymentTriggers.booked_call"),
          sale_closed: t("financials.paymentTriggers.sale_closed"),
          meeting_held: t("financials.paymentTriggers.meeting_held"),
        }} {...focusFor("payment_trigger")} /> : undefined}
      />
      <InfoRow icon={DollarSign} label={t("config.valuePerBooking")} value={campaign.value_per_booking}
        {...editFor("value_per_booking")}
        editChild={isEditing ? <EditNumber value={Number(draft.value_per_booking ?? 0)} onChange={(v) => setDraft(d => ({...d, value_per_booking: v}))} {...focusFor("value_per_booking")} /> : undefined}
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={Link} label={t("config.contract")} value={campaign.contract_name || t("config.noneLinked")}
          {...editFor("contract_id")}
          editChild={isEditing ? <ContractSelect value={String(draft.contract_id ?? "")} onChange={(v) => setDraft(d => ({...d, contract_id: v}))} accountsId={campaign.account_id} /> : undefined}
        />
      </div>

      {/* ── A/B Testing ── */}
      {sectionDivider("A/B Testing")}

      <BoolRow icon={SplitSquareVertical} label={t("abTesting.enabled")} value={!!(draft.ab_enabled ?? campaign.ab_enabled)}
        {...editFor("ab_enabled")}
        editChild={isEditing ? <EditToggle value={!!draft.ab_enabled} onChange={(v) => setDraft(d => ({...d, ab_enabled: v}))} /> : undefined}
      />
      {(draft.ab_enabled ?? campaign.ab_enabled) && (
        <InfoRow icon={SplitSquareVertical} label={t("abTesting.splitRatio")} value={`${campaign.ab_split_ratio ?? 50}%`}
          {...editFor("ab_split_ratio")}
          editChild={isEditing ? <EditNumber value={Number(draft.ab_split_ratio ?? 50)} onChange={(v) => setDraft(d => ({...d, ab_split_ratio: v}))} {...focusFor("ab_split_ratio")} /> : undefined}
        />
      )}
    </div>
  );
}
