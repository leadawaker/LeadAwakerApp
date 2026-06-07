import { useTranslation } from "react-i18next";
import {
  Globe, MapPin, Building2, Calendar, Clock, Hash, Link,
  MessageCircle, AlertTriangle, BarChart3, DollarSign, CreditCard,
  Eye, Type, Play, Pause, Power, SplitSquareVertical, Radio, Zap,
} from "lucide-react";
import {
  EditText, EditNumber, EditDate, EditSelect, EditToggle,
  InfoRow, BoolRow, ContractSelect,
} from "../formFields";

interface BehaviorSectionFieldsProps {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
  isAgency?: boolean;
  contracts?: any[];
}

export function BehaviorSectionFields({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField,
  isAgency, contracts,
}: BehaviorSectionFieldsProps) {
  const { t } = useTranslation("campaigns");

  const editFor = (field: string) =>
    onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField(field) } : {};
  const focusFor = (field: string) => ({ autoFocus: focusField === field });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>

      {/* Language & Locale */}
      <InfoRow icon={Globe} label={t("config.language")} value={campaign.language}
        {...editFor("language")}
        editChild={isEditing ? <EditSelect value={String(draft.language ?? "")} onChange={(v) => setDraft(d => ({...d, language: v}))} options={["en", "nl", "pt"]} {...focusFor("language")} /> : undefined}
      />
      <InfoRow icon={MapPin} label={t("config.nicheQuestion")} value={campaign.niche}
        {...editFor("niche")}
        editChild={isEditing ? <EditSelect value={String(draft.niche ?? "")} onChange={(v) => setDraft(d => ({...d, niche: v}))} options={["Kitchens", "Bathrooms", "Countertops", "Flooring", "General Contracting", "Solar Panels", "HVAC", "Roofing", "Landscaping", "Windows & Doors", "Painting", "Pest Control", "Pool Installation", "Moving Services"]} {...focusFor("niche")} /> : undefined}
      />
      <InfoRow icon={MapPin} label={t("config.website")} value={campaign.website}
        gridColumn="full"
        {...editFor("website")}
        editChild={isEditing ? <EditText value={String(draft.website ?? "")} onChange={(v) => setDraft(d => ({...d, website: v}))} placeholder="https://…" {...focusFor("website")} /> : undefined}
      />
      <InfoRow icon={Link} label={t("config.calendarLink")} value={campaign.calendar_link_override || campaign.calendar_link}
        gridColumn="full"
        {...editFor("calendar_link_override")}
        editChild={isEditing ? <EditText value={String(draft.calendar_link_override ?? "")} onChange={(v) => setDraft(d => ({...d, calendar_link_override: v}))} placeholder="https://calendly.com/…" {...focusFor("calendar_link_override")} /> : undefined}
      />

      {/* Demo & Account */}
      <BoolRow icon={Eye} label={t("config.isDemo")} value={!!(draft.is_demo ?? campaign.is_demo)}
        {...editFor("is_demo")}
        editChild={isEditing ? <EditToggle checked={!!draft.is_demo} onChange={(v) => setDraft(d => ({...d, is_demo: v}))} /> : undefined}
      />
      {isAgency && (
        <InfoRow icon={Building2} label={t("config.accountId")} value={campaign.account_name || campaign.account_id}
          {...editFor("account_id")}
          editChild={isEditing ? <EditSelect value={String(draft.account_id ?? "")} onChange={(v) => setDraft(d => ({...d, account_id: v}))} options={[]} {...focusFor("account_id")} /> : undefined}
        />
      )}

      {/* Status & Type */}
      <InfoRow icon={Play} label={t("config.status") || "Status"} value={campaign.status}
        {...editFor("status")}
        editChild={isEditing ? <EditSelect value={String(draft.status ?? "")} onChange={(v) => setDraft(d => ({...d, status: v}))} options={["Draft", "Active", "Paused", "Inactive", "Completed"]} {...focusFor("status")} /> : undefined}
      />
      <InfoRow icon={Type} label={t("config.type")} value={campaign.type}
        {...editFor("type")}
        editChild={isEditing ? <EditSelect value={String(draft.type ?? "")} onChange={(v) => setDraft(d => ({...d, type: v}))} options={["whatsapp_outbound", "whatsapp_inbound", "email_outbound", "voice_outbound"]} {...focusFor("type")} /> : undefined}
      />

      {/* Booking Mode — la-seg pill */}
      <InfoRow icon={CreditCard} label={t("config.bookingMode") || "Booking Mode"} value={campaign.booking_mode_override}
        {...editFor("booking_mode_override")}
        editChild={isEditing ? (
          <div className="la-seg la-seg--fill">
            {["auto", "manual", "hybrid"].map(mode => (
              <button key={mode} className={`la-seg-btn ${(draft.booking_mode_override ?? campaign.booking_mode_override) === mode ? 'on' : ''}`}
                onClick={() => setDraft(d => ({...d, booking_mode_override: mode}))}
              >{mode}</button>
            ))}
          </div>
        ) : undefined}
      />

      {/* Typo Count — la-seg pill */}
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

      {/* Start / End Dates */}
      <InfoRow icon={Calendar} label={t("config.startDate")} value={campaign.start_date}
        {...editFor("start_date")}
        editChild={isEditing ? <EditDate value={String(draft.start_date ?? "")} onChange={(v) => setDraft(d => ({...d, start_date: v}))} {...focusFor("start_date")} /> : undefined}
      />
      <InfoRow icon={Calendar} label={t("config.endDate")} value={campaign.end_date}
        {...editFor("end_date")}
        editChild={isEditing ? <EditDate value={String(draft.end_date ?? "")} onChange={(v) => setDraft(d => ({...d, end_date: v}))} {...focusFor("end_date")} /> : undefined}
      />

      {/* Daily Limit & Interval */}
      <InfoRow icon={BarChart3} label={t("config.dailyLimit")} value={campaign.daily_lead_limit}
        {...editFor("daily_lead_limit")}
        editChild={isEditing ? <EditNumber value={Number(draft.daily_lead_limit ?? 0)} onChange={(v) => setDraft(d => ({...d, daily_lead_limit: v}))} min={0} max={500} {...focusFor("daily_lead_limit")} /> : undefined}
      />
      <InfoRow icon={MessageCircle} label={t("config.interval")} value={`${campaign.message_interval_minutes ?? 0} min`}
        {...editFor("message_interval_minutes")}
        editChild={isEditing ? <EditNumber value={Number(draft.message_interval_minutes ?? 0)} onChange={(v) => setDraft(d => ({...d, message_interval_minutes: v}))} min={0} max={120} {...focusFor("message_interval_minutes")} /> : undefined}
      />

      {/* Channel */}
      <InfoRow icon={Radio} label={t("config.channel")} value={campaign.channel}
        gridColumn="full"
        {...editFor("channel")}
        editChild={isEditing ? <EditSelect value={String(draft.channel ?? "")} onChange={(v) => setDraft(d => ({...d, channel: v}))} options={["whatsapp", "email", "voice"]} {...focusFor("channel")} /> : undefined}
      />

      {/* BoolRows */}
      <BoolRow icon={Pause} label={t("config.stopOnResponse")} value={!!(draft.stop_on_response ?? campaign.stop_on_response)}
        {...editFor("stop_on_response")}
        editChild={isEditing ? <EditToggle checked={!!draft.stop_on_response} onChange={(v) => setDraft(d => ({...d, stop_on_response: v}))} /> : undefined}
      />
      <BoolRow icon={Zap} label={t("config.useAiBumps")} value={!!(draft.use_ai_bumps ?? campaign.use_ai_bumps)}
        {...editFor("use_ai_bumps")}
        editChild={isEditing ? <EditToggle checked={!!draft.use_ai_bumps} onChange={(v) => setDraft(d => ({...d, use_ai_bumps: v}))} /> : undefined}
      />
      <InfoRow icon={AlertTriangle} label={t("config.maxBumps")} value={campaign.max_bumps}
        {...editFor("max_bumps")}
        editChild={isEditing ? <EditNumber value={Number(draft.max_bumps ?? 4)} onChange={(v) => setDraft(d => ({...d, max_bumps: v}))} min={0} max={10} {...focusFor("max_bumps")} /> : undefined}
      />

      {/* Deal Info */}
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

      {/* Value Per Booking */}
      <InfoRow icon={DollarSign} label={t("config.valuePerBooking")} value={campaign.value_per_booking}
        {...editFor("value_per_booking")}
        editChild={isEditing ? <EditNumber value={Number(draft.value_per_booking ?? 0)} onChange={(v) => setDraft(d => ({...d, value_per_booking: v}))} min={0} {...focusFor("value_per_booking")} /> : undefined}
      />

      {/* Contract */}
      <InfoRow icon={Link} label={t("config.contract")} value={campaign.contract_name || t("config.noneLinked")}
        gridColumn="full"
        {...editFor("contract_id")}
        editChild={isEditing && contracts ? <ContractSelect value={String(draft.contract_id ?? "")} onChange={(v) => setDraft(d => ({...d, contract_id: v}))} contracts={contracts} /> : undefined}
      />

      {/* Opt-out Notice */}
      <BoolRow icon={Power} label={t("config.optOutNotice")} value={!!(draft.opt_out_notice ?? campaign.opt_out_notice)}
        {...editFor("opt_out_notice")}
        editChild={isEditing ? <EditToggle checked={!!draft.opt_out_notice} onChange={(v) => setDraft(d => ({...d, opt_out_notice: v}))} /> : undefined}
      />

      {/* A/B Testing */}
      <BoolRow icon={SplitSquareVertical} label={t("abTesting.enabled")} value={!!(draft.ab_enabled ?? campaign.ab_enabled)}
        {...editFor("ab_enabled")}
        editChild={isEditing ? <EditToggle checked={!!draft.ab_enabled} onChange={(v) => setDraft(d => ({...d, ab_enabled: v}))} /> : undefined}
      />
      {(draft.ab_enabled ?? campaign.ab_enabled) && (
        <InfoRow icon={SplitSquareVertical} label={t("abTesting.splitRatio")} value={`${campaign.ab_split_ratio ?? 50}%`}
          {...editFor("ab_split_ratio")}
          editChild={isEditing ? <EditNumber value={Number(draft.ab_split_ratio ?? 50)} onChange={(v) => setDraft(d => ({...d, ab_split_ratio: v}))} min={1} max={99} {...focusFor("ab_split_ratio")} /> : undefined}
        />
      )}
    </div>
  );
}
