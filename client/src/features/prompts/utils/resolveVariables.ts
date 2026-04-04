// Mirrors backend _helpers.py personalize_message logic
// Resolves {variable} tokens in a template string using campaign + lead + account data

export interface CampaignForPreview {
  id: number;
  name: string;
  aiModel: string;
  agentName?: string | null;
  serviceName?: string | null;
  campaignService?: string | null;
  campaignUsp?: string | null;
  calendarLink?: string | null;
  whatLeadDid?: string | null;
  inquiriesSource?: string | null;
  inquiryTimeframe?: string | null;
  niche?: string | null;
  nicheQuestion?: string | null;
  bookingMode?: string | null;
  // Campaign-level overrides (no account fallback)
  language?: string | null;
  demoClientName?: string | null;
  aiStyleOverride?: string | null;
  description?: string | null;
  aiRole?: string | null;
  typoCount?: number | null;
}

export interface LeadForPreview {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  whatHasTheLeadDone?: string | null;
}

export interface AccountForPreview {
  name?: string | null;
  defaultAiRole?: string | null;
  businessDescription?: string | null;
  defaultAiStyle?: string | null;
  defaultTypoFrequency?: string | null;
  language?: string | null;
  businessNiche?: string | null;
}

function mapTypoFrequency(typoCount: number | null | undefined): string | undefined {
  if (typoCount == null) return undefined;
  const labels = ["None", "Occasional", "Common", "Frequent"];
  return labels[typoCount] || "Frequent";
}

function buildMap(
  campaign?: CampaignForPreview | null,
  lead?: LeadForPreview | null,
  _account?: AccountForPreview | null,
): Record<string, string | undefined | null> {
  return {
    first_name: lead?.firstName,
    last_name: lead?.lastName,
    phone: lead?.phone,
    email: lead?.email,
    agent_name: campaign?.agentName,
    service_name: campaign?.serviceName ?? campaign?.campaignService,
    calendar_link: campaign?.calendarLink,
    campaign_name: campaign?.name,
    usp: campaign?.campaignUsp,
    what_lead_did: campaign?.whatLeadDid,
    inquiries_source: campaign?.inquiriesSource,
    inquiry_timeframe: campaign?.inquiryTimeframe,
    niche_question: campaign?.nicheQuestion,
    booking_mode: campaign?.bookingMode,
    company_name: campaign?.demoClientName,
    niche: campaign?.niche,
    business_description: campaign?.description,
    ai_style: campaign?.aiStyleOverride,
    language: campaign?.language,
    ai_role: campaign?.aiRole,
    typo_frequency: mapTypoFrequency(campaign?.typoCount),
    today_date: new Date().toLocaleDateString(),
  };
}

/** Plain-text resolution — returns resolved string + list of unresolved keys */
export function resolveVariables(
  text: string,
  campaign?: CampaignForPreview | null,
  lead?: LeadForPreview | null,
  account?: AccountForPreview | null,
): { resolved: string; missing: string[] } {
  const VAR_PATTERN = /\{(\w+)\}/g;
  const missing: string[] = [];
  const map = buildMap(campaign, lead, account);

  const resolved = text.replace(VAR_PATTERN, (match, key) => {
    const val = map[key.toLowerCase()];
    if (val) return val;
    missing.push(key);
    return match;
  });

  return { resolved, missing };
}

const MARK = 'class="bg-amber-100 text-amber-800 rounded px-0.5 dark:bg-amber-900/40 dark:text-amber-300"';

/** HTML resolution — all {variable} tokens become <mark> chips (resolved or not) */
export function resolveVariablesHtml(
  text: string,
  campaign?: CampaignForPreview | null,
  lead?: LeadForPreview | null,
  account?: AccountForPreview | null,
): string {
  const map = buildMap(campaign, lead, account);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escaped = esc(text);

  return escaped.replace(/\{(\w+)\}/g, (match, key) => {
    const val = map[key.toLowerCase()];
    const display = val ? esc(val) : match; // use value if resolved, else keep {var}
    return `<mark ${MARK}>${display}</mark>`;
  });
}
