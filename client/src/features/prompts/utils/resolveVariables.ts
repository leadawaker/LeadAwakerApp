// Mirrors backend _helpers.py personalize_message logic
// Resolves {variable} tokens in a template string using campaign + lead + account data
import { resolveLang, type Lang } from "@shared/langField";

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
  firstTouch?: string | null;
  inquiriesSource?: string | null;
  inquiryTimeframe?: string | null;
  niche?: string | null;
  nicheQuestion?: string | null;
  bookingMode?: string | null;
  positioning?: string | null;
  aiDisclosure?: string | null;
  // Campaign-level overrides (no account fallback)
  language?: string | null;
  demoClientName?: string | null;
  companyName?: string | null;
  aiStyleOverride?: string | null;
  description?: string | null;
  aiRole?: string | null;
  typoCount?: number | null;
  kb?: string | null;
  accountsId?: number | null;
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

// The prompt needs the full language name (the AI writes in it), not the short
// locale code stored on the campaign. Falls through unknown values unchanged.
function fullLanguageName(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const map: Record<string, string> = {
    en: "English", nl: "Dutch", pt: "Portuguese", "pt-br": "Portuguese",
  };
  return map[raw.toLowerCase()] || raw;
}

function normalizeBookingMode(raw: string | null | undefined): string | null | undefined {
  if (!raw) return raw;
  const lower = raw.toLowerCase().replace(/[\s_]/g, "");
  if (lower === "callagent" || lower === "call") return "call";
  if (lower === "directbooking" || lower === "direct" || lower === "booking") return "direct";
  return raw; // keep as-is for unknown values
}

/** Preview-only knobs: force conditional values and inject per-niche terms the
 *  client can't derive on its own (those live in the Niche_Vocabulary table). */
export interface ResolveOpts {
  /** Overrides for branch variables chosen in the preview (lead_stage, positioning, ai_disclosure). */
  overrides?: Record<string, string>;
  /** Resolved niche terms (project_term, proposal_term, …, and _list variants). */
  nicheTerms?: Record<string, string>;
}

export function buildMap(
  campaign?: CampaignForPreview | null,
  lead?: LeadForPreview | null,
  _account?: AccountForPreview | null,
  lang?: string,
  opts?: ResolveOpts,
): Record<string, string | undefined | null> {
  const l = (lang || campaign?.language || "en") as Lang;
  const rl = (raw: unknown) => resolveLang(raw, l) || undefined;
  return {
    first_name: lead?.firstName,
    last_name: lead?.lastName,
    phone: lead?.phone,
    email: lead?.email,
    agent_name: campaign?.agentName,
    service_name: rl(campaign?.serviceName ?? campaign?.campaignService),
    calendar_link: campaign?.calendarLink,
    campaign_name: campaign?.name,
    usp: rl(campaign?.campaignUsp),
    kb: rl(campaign?.kb),
    what_lead_did: rl(campaign?.whatLeadDid),
    first_touch: rl(campaign?.firstTouch),
    inquiries_source: campaign?.inquiriesSource,
    inquiry_timeframe: rl(campaign?.inquiryTimeframe),
    niche_question: rl(campaign?.nicheQuestion),
    booking_mode: normalizeBookingMode(campaign?.bookingMode),
    company_name: campaign?.companyName || campaign?.demoClientName,
    niche: campaign?.niche,
    business_description: rl(campaign?.description),
    ai_style: rl(campaign?.aiStyleOverride) || "Casual, smooth and pro",
    language: fullLanguageName(campaign?.language) || "English",
    ai_role: rl(campaign?.aiRole) || "sales representative",
    typo_frequency: mapTypoFrequency(campaign?.typoCount) || "Rare",
    today_date: new Date().toLocaleDateString(),
    qualification_criteria: "",
    what_has_the_lead_done: campaign?.whatLeadDid || "",
    when: "",
    service: campaign?.serviceName ?? campaign?.campaignService ?? "",
    // ── Campaign summary snapshot variables (sample values for preview) ──
    // The AI engine fills these with live numbers at runtime; here we show a
    // representative snapshot so the system prompt preview is not empty.
    campaignname: campaign?.name,
    campaignstatus: campaign ? "Active" : undefined,
    campaigndescription: campaign?.description,
    campaigncreatedat: campaign ? new Date().toLocaleDateString() : undefined,
    reportdate: new Date().toLocaleDateString(),
    totalleads: campaign ? "320" : undefined,
    pipelinebreakdown: campaign
      ? "New: 120 · Contacted: 95 · Responded: 60 · Booked: 18"
      : undefined,
    responserate: campaign ? "24%" : undefined,
    responded: campaign ? "76" : undefined,
    bookingrate: campaign ? "6%" : undefined,
    booked: campaign ? "18" : undefined,
    // ── Universal Discovery-Demo vars ──
    // positioning / ai_disclosure come off the campaign; lead_stage is not derived
    // here (the engine derives it at runtime) — the preview supplies it via overrides.
    positioning: campaign?.positioning || "mid_market",
    ai_disclosure: campaign?.aiDisclosure || "off",
    lead_stage: "",
    // Per-niche substitution terms (fetched from the vocabulary API in the preview).
    ...(opts?.nicheTerms ?? {}),
    // Preview overrides win over everything above.
    ...(opts?.overrides ?? {}),
  };
}

/** Plain-text resolution — returns resolved string + list of unresolved keys */
export function resolveVariables(
  text: string,
  campaign?: CampaignForPreview | null,
  lead?: LeadForPreview | null,
  account?: AccountForPreview | null,
  lang?: string,
  opts?: ResolveOpts,
): { resolved: string; missing: string[] } {
  const VAR_PATTERN = /\{(\w+)\}/g;
  const missing: string[] = [];
  const map = buildMap(campaign, lead, account, lang, opts);

  const resolved = text.replace(VAR_PATTERN, (match, key) => {
    const val = map[key.toLowerCase()];
    if (val) return val;
    missing.push(key);
    return match;
  });

  return { resolved, missing };
}

const MARK = 'class="bg-amber-100 text-amber-800 rounded px-0.5 dark:bg-amber-900/40 dark:text-amber-300"';

// Matches {{#if var == "val"}}content{{else}}alt{{/if}} — no special HTML chars inside the tag syntax
const CONDITIONAL_RE = /\{\{#if\s+(\w+)\s*(==|!=)\s*&quot;([^&]*)&quot;\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

/** HTML resolution — all {variable} tokens become <mark> chips, conditionals evaluated */
export function resolveVariablesHtml(
  text: string,
  campaign?: CampaignForPreview | null,
  lead?: LeadForPreview | null,
  account?: AccountForPreview | null,
  lang?: string,
  opts?: ResolveOpts,
): string {
  const map = buildMap(campaign, lead, account, lang, opts);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // 1. Escape everything first
  let html = esc(text);

  // 2. Resolve conditionals: pick the branch that matches the (possibly overridden)
  //    value and inline its content only. The {{#if}}/{{else}}/{{/if}} tags are NOT
  //    shown in the preview — the preview reflects the final resolved output the AI
  //    would receive. (Tag highlighting lives in the editor, not here.)
  html = html.replace(CONDITIONAL_RE, (_match, varName, op, compareVal, ifContent, elseContent) => {
    const actual = String(map[varName.toLowerCase()] ?? "");
    const met = op === "==" ? actual === compareVal : actual !== compareVal;
    if (met) return ifContent;
    if (elseContent != null) return elseContent;
    return "";
  });

  // 3. Resolve {variable} tokens
  html = html.replace(/\{(\w+)\}/g, (match, key) => {
    const val = map[key.toLowerCase()];
    const display = val ? esc(val) : match;
    return `<mark ${MARK}>${display}</mark>`;
  });

  return html;
}
