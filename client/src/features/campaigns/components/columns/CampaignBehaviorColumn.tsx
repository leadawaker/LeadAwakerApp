import { useTranslation } from "react-i18next";
import {
  Clock, Zap, Bot, FileText, Tag, Building2, Send, CalendarClock,
  Globe, MapPin, Timer, Gauge, Hash, HandCoins, StopCircle, Repeat,
  FlaskConical, Percent, ShieldCheck, ChevronRight, ChevronLeft, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { ContractFinancials } from "../useCampaignDetail";
import {
  formatDate, EditText, EditNumber, EditDate, EditSelect, EditToggle,
  InfoRow, BoolRow,
} from "../formFields";
import type { ColumnBaseProps } from "./types";

interface CampaignBehaviorColumnProps extends ColumnBaseProps {
  linkedContract: ContractFinancials | null;
}

export function CampaignBehaviorColumn({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField, collapsed, onToggle,
  linkedContract,
}: CampaignBehaviorColumnProps) {
  const { t } = useTranslation("campaigns");
  const { isAgencyUser } = useWorkspace();

  const editFor = (field: string) =>
    onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField(field) } : {};
  const focusFor = (field: string) => ({ autoFocus: focusField === field });
  const directToggle = (field: string, currentValue: boolean | null | undefined) =>
    onStartEditField && !isEditing
      ? { onDirectToggle: () => { onStartEditField(field); setDraft(d => ({ ...d, [field]: !currentValue })); } }
      : {};

  if (collapsed) {
    return (
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl flex flex-col items-center pt-4 pb-4 overflow-hidden cursor-pointer group h-full" onClick={onToggle} title="Expand Behavior">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors text-foreground/50 group-hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mt-3 select-none" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          Behavior
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-semibold font-heading leading-tight text-foreground">Behavior</h3>
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors text-foreground/40 hover:text-foreground -mr-1"
          title="Collapse Behavior"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6">
        <InfoRow icon={Globe} label={t("config.language")} value={campaign.language}
          {...editFor("language")}
          editChild={isEditing ? <EditSelect value={String(draft.language ?? "")} onChange={(v) => setDraft(d => ({...d, language: v}))} options={["", "English", "Portuguese", "Dutch", "Spanish"]} {...focusFor("language")} /> : undefined}
        />
        <InfoRow icon={MapPin} label="Niche" value={campaign.niche}
          {...editFor("niche")}
          editChild={isEditing ? <EditText value={String(draft.niche ?? "")} onChange={(v) => setDraft(d => ({...d, niche: v}))} placeholder="e.g. Solar Energy, Real Estate" {...focusFor("niche")} /> : undefined}
        />
        <InfoRow icon={Globe} label={t("config.website")} value={campaign.website || ""}
          {...editFor("website")}
          editChild={isEditing ? <EditText value={String(draft.website ?? "")} onChange={(v) => setDraft(d => ({...d, website: v}))} placeholder="https://example.com" {...focusFor("website")} /> : undefined}
        />
        <InfoRow icon={Link2} label={t("config.calendarLink")} value={campaign.calendar_link_override || campaign.calendar_link}
          {...editFor("calendar_link_override")}
          editChild={isEditing ? <EditText value={String(draft.calendar_link_override ?? "")} onChange={(v) => setDraft(d => ({...d, calendar_link_override: v}))} placeholder="https://calendly.com/…" {...focusFor("calendar_link_override")} /> : undefined}
        />

        {isAgencyUser && (
          <>
            <BoolRow icon={FlaskConical} label={t("config.isDemo")} value={campaign.is_demo ?? false}
              {...(onStartEditField && !isEditing ? {
                onDirectToggle: () => {
                  const newVal = !Boolean(draft.is_demo ?? campaign.is_demo);
                  onStartEditField("is_demo");
                  setDraft(d => ({ ...d, is_demo: newVal, ...(newVal ? { prompt_linked_id: "65" } : {}) }));
                }
              } : {})}
              editChild={isEditing ? <EditToggle value={Boolean(draft.is_demo ?? campaign.is_demo)} onChange={(v) => setDraft(d => ({...d, is_demo: v, ...(v ? { prompt_linked_id: "65" } : {})}))} /> : undefined}
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
              className="w-full rounded-md bg-white dark:bg-white px-3 py-1.5 text-[14px] outline-none"
            >
              <option value="">— Select type —</option>
              <option value="Cold Outreach">Cold Outreach</option>
              <option value="Re-engagement">Re-engagement</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Event">Event</option>
            </select>
          ) : undefined}
        />

        <div className="col-span-2 flex flex-col gap-0.5 py-2 border-b border-border/20">
          <span className="text-[12px] font-bold uppercase tracking-wider text-foreground">{t("config.bookingMode")}</span>
          {isEditing ? (
            <div className="flex gap-1 flex-wrap">
              {([["call", "Call Agent"], ["direct", "Direct Booking"]] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setDraft(d => ({ ...d, booking_mode_override: value }))}
                  className={cn("text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                    draft.booking_mode_override === value
                      ? "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo"
                      : "border-black/[0.125] bg-transparent text-foreground/60 hover:bg-muted/50"
                  )}>{label}</button>
              ))}
            </div>
          ) : (
            <span {...(onStartEditField ? { onClick: () => onStartEditField("booking_mode_override") } : {})}
              className={cn("text-[12px] text-foreground", onStartEditField && "cursor-text rounded px-0.5 -mx-0.5 hover:bg-muted/50 transition-colors")}>
              {campaign.booking_mode_override || "—"}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-0.5 py-2 border-b border-border/20">
          <span className="text-[12px] font-bold uppercase tracking-wider text-foreground">Typos per chat</span>
          {isEditing ? (
            <div className="flex gap-1">
              {([0, 1, 2, 3] as const).map((count) => (
                <button key={count} type="button" onClick={() => setDraft(d => ({ ...d, typo_count: count }))}
                  className={cn("text-[11px] font-medium w-8 h-7 rounded-full border transition-colors",
                    (draft.typo_count ?? 1) === count
                      ? "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo"
                      : "border-black/[0.125] bg-transparent text-foreground/60 hover:bg-muted/50"
                  )}>{count}</button>
              ))}
            </div>
          ) : (
            <span {...(onStartEditField ? { onClick: () => onStartEditField("typo_count") } : {})}
              className={cn("text-[12px] text-foreground", onStartEditField && "cursor-text rounded px-0.5 -mx-0.5 hover:bg-muted/50 transition-colors")}>
              {campaign.typo_count ?? 1}
            </span>
          )}
        </div>

        <InfoRow icon={Clock} label={t("config.activeHours")}
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
        <InfoRow icon={CalendarClock} label="Campaign Duration"
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

        <InfoRow icon={Send} label={t("config.channel")}
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
          <InfoRow label={t("config.whatsappTier")}
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

        <InfoRow icon={FileText} label={t("config.deal")}
          value={linkedContract ? (linkedContract.title || `Contract #${linkedContract.id}`) : t("config.noneLinked")}
        />
        {linkedContract?.deal_type && (
          <InfoRow icon={Tag} label={t("financials.dealType")}
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
          <InfoRow icon={HandCoins} label={t("financials.paymentTrigger")}
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
        {/* TODO: value_per_booking InfoRow temporarily removed for tsc */}

        <BoolRow icon={ShieldCheck} label={t("config.optOutNotice")} value={campaign.opt_out_notice ?? false}
          {...directToggle("opt_out_notice", Boolean(draft.opt_out_notice ?? campaign.opt_out_notice))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.opt_out_notice ?? campaign.opt_out_notice)} onChange={(v) => setDraft(d => ({...d, opt_out_notice: v}))} /> : undefined}
        />
        <BoolRow icon={FlaskConical} label={t("abTesting.enabled")} value={campaign.ab_enabled}
          {...directToggle("ab_enabled", Boolean(draft.ab_enabled ?? campaign.ab_enabled))}
          editChild={isEditing ? <EditToggle value={Boolean(draft.ab_enabled ?? campaign.ab_enabled)} onChange={(v) => setDraft(d => ({...d, ab_enabled: v}))} /> : undefined}
        />
        {!!(isEditing ? draft.ab_enabled : campaign.ab_enabled) && (
          <InfoRow icon={Percent} label={t("abTesting.splitRatio")}
            value={campaign.ab_split_ratio != null ? `${campaign.ab_split_ratio}%` : "50%"}
            {...editFor("ab_split_ratio")}
            editChild={isEditing ? <EditNumber value={String(draft.ab_split_ratio ?? 50)} onChange={(v) => setDraft(d => ({...d, ab_split_ratio: v}))} placeholder="50" {...focusFor("ab_split_ratio")} /> : undefined}
          />
        )}
      </div>
    </div>
  );
}
