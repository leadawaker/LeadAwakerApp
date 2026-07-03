import type { TFunction } from "i18next";
import { getInitials } from "@/lib/avatarUtils";
import { formatTimeDisplay, parseServiceCategories } from "../accountDetailWidgets/accountFormatters";
import type {
  AccountRow,
  AccountDetail,
  IntegrationField,
  CampaignRowData,
  ContractRowData,
  TeamMemberData,
  MetaChip,
  VoiceSlot,
} from "./types";

const INTAKE_URL = "https://webhooks.leadawaker.com/api/leads/intake";

const s = (v: unknown): string => (v == null ? "" : String(v));

// ── Account → presentation detail ─────────────────────────────────────────────
export function toAccountDetail(a: AccountRow, t: TFunction): AccountDetail {
  const id = a.Id ?? a.id ?? 0;
  const name = s(a.name) || t("detail.unnamedAccount");

  const twilioFields: IntegrationField[] = [
    { key: "twilio_account_sid", label: t("fields.accountSid"), value: s(a.twilio_account_sid), mono: true, copy: true },
    { key: "twilio_auth_token", label: t("fields.authToken"), value: s(a.twilio_auth_token), mono: true, secret: true, copy: true },
    { key: "twilio_messaging_service_sid", label: t("fields.serviceSid"), value: s(a.twilio_messaging_service_sid), mono: true, copy: true },
    { key: "twilio_default_from_number", label: t("fields.fromNumber"), value: s(a.twilio_default_from_number), mono: true, copy: true },
    { key: "webhook_url", label: t("fields.webhookUrl"), value: s(a.webhook_url), mono: true, wrap: true, copy: true },
    { key: "webhook_secret", label: t("fields.apiKeyIntake"), value: s(a.webhook_secret), mono: true, secret: true, copy: true },
    { key: "intake_url", label: t("fields.intakeUrl"), value: INTAKE_URL, mono: true, wrap: true, copy: true },
  ];

  const instagramFields: IntegrationField[] = [
    { key: "instagram_user_id", label: t("fields.userId"), value: s(a.instagram_user_id), mono: true, copy: true },
    { key: "instagram_access_token", label: t("fields.accessToken"), value: s(a.instagram_access_token), mono: true, secret: true, copy: true },
  ];

  const voices: VoiceSlot[] = [
    { lang: "EN", langKey: "en", flag: "🇬🇧", ready: !!a.tts_voice_id_en, voiceId: a.tts_voice_id_en ?? null },
    { lang: "NL", langKey: "nl", flag: "🇳🇱", ready: !!a.tts_voice_id_nl, voiceId: a.tts_voice_id_nl ?? null },
  ];

  return {
    id,
    name,
    mono: getInitials(name) || "?",
    logoUrl: s(a.logo_url) || null,
    type: s(a.type),
    niche: s(a.business_niche),
    status: s(a.status),
    contact: {
      email: s(a.owner_email),
      phone: s(a.phone),
      website: s(a.website),
      address: s(a.address),
    },
    schedule: {
      timezone: s(a.timezone),
      language: s(a.language),
      hoursOpen: formatTimeDisplay(s(a.business_hours_start)) || s(a.business_hours_start),
      hoursClose: formatTimeDisplay(s(a.business_hours_end)) || s(a.business_hours_end),
      dailySends: a.max_daily_sends != null ? String(a.max_daily_sends) : "",
      optOut: s(a.opt_out_keyword),
    },
    meta: {
      taxId: s(a.tax_id),
      description: s(a.business_description),
      notes: s(a.notes),
      serviceCategories: parseServiceCategories(a.service_categories),
    },
    twilio: { connected: !!a.twilio_account_sid, fields: twilioFields },
    instagram: { connected: !!a.instagram_user_id, fields: instagramFields },
    voices,
  };
}

// ── Campaign → row ────────────────────────────────────────────────────────────
export function toCampaignRow(c: any): CampaignRowData {
  const id = c.Id ?? c.id ?? 0;
  const name = s(c.name ?? c.campaign_name ?? c.Name) || "Unnamed";
  return {
    id,
    name,
    mono: getInitials(name) || "?",
    channel: s(c.channel) || "WhatsApp",
    status: s(c.status ?? c.Status),
    leads: Number(c.total_leads_targeted ?? c.totalLeadsTargeted ?? c.Leads ?? 0),
    resp: Math.round(Number(c.response_rate_percent ?? c.responseRatePercent ?? 0)),
    contractId: null,
  };
}

// ── Contract → row ────────────────────────────────────────────────────────────
function formatMoney(raw: unknown, currency: unknown): string {
  if (raw == null || raw === "") return "—";
  const n = Number(raw);
  if (Number.isNaN(n)) return s(raw);
  const cur = s(currency).toUpperCase();
  const symbol = cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur === "BRL" ? "R$" : "$";
  return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function toContractRow(k: any): ContractRowData & { campaignId: number | null } {
  const id = k.Id ?? k.id ?? 0;
  const rawStatus = s(k.status ?? k.Status).toLowerCase();
  const status = ["active", "pending", "expired"].includes(rawStatus) ? rawStatus : (rawStatus || "expired");
  const value = formatMoney(
    k.monthly_value ?? k.monthlyValue ?? k.value ?? k.amount ?? k.price ?? k.mrr,
    k.currency ?? k.Currency,
  );
  const renewalRaw = k.renewal_date ?? k.renewalDate ?? k.renews_at ?? k.end_date ?? k.endDate ?? null;
  let renewal = "";
  if (renewalRaw) {
    const d = new Date(renewalRaw);
    renewal = Number.isNaN(d.getTime())
      ? s(renewalRaw)
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  const campaignId = k.campaigns_id ?? k.campaignsId ?? k.Campaigns_id ?? null;
  return {
    id,
    name: s(k.title ?? k.name ?? k.Name) || "—",
    status,
    value,
    renewal,
    campaignId: campaignId != null ? Number(campaignId) : null,
  };
}

// ── User → team member ────────────────────────────────────────────────────────
export function toTeamMember(u: any): TeamMemberData {
  const name = s(u.full_name ?? u.fullName1 ?? u.name ?? u.email ?? u.username) || "—";
  return {
    id: u.id ?? u.Id ?? 0,
    name,
    email: s(u.email),
    role: s(u.role ?? u.Role),
    init: getInitials(name) || "?",
    avatarUrl: s(u.avatarUrl ?? u.avatar_url) || null,
  };
}

// ── Derived identity-card metrics ─────────────────────────────────────────────
export function deriveMetrics(
  campaigns: CampaignRowData[],
  contracts: ContractRowData[],
  team: TeamMemberData[],
  t: TFunction,
): MetaChip[] {
  const respValues = campaigns.map((c) => c.resp).filter((n) => Number.isFinite(n));
  const avgResp = respValues.length
    ? Math.round(respValues.reduce((sum, n) => sum + n, 0) / respValues.length)
    : 0;
  const activeContracts = contracts.filter((c) => c.status === "active").length;
  const owners = team.filter((m) => m.role === "Owner" || m.role === "Admin").length;

  return [
    { key: "campaigns", label: t("metrics.campaigns"), value: campaigns.length, sub: t("metrics.allActive"), accent: "var(--wine)" },
    { key: "response", label: t("metrics.avgResponse"), value: `${avgResp}%`, sub: t("metrics.acrossAll"), accent: "var(--good)" },
    { key: "contracts", label: t("metrics.contracts"), value: contracts.length, sub: t("metrics.nActive", { count: activeContracts }), accent: "var(--stage-contacted)" },
    { key: "team", label: t("metrics.team"), value: team.length, sub: t("metrics.nOwner", { count: owners }), accent: "var(--mute)" },
  ];
}
