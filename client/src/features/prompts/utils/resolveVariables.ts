// Mirrors the engine's prompt variables (automations tools/ai_service.py
// build_conversation_prompt): resolves {variable} tokens from the campaign, its
// account and a sample lead. Engine-only rules live in ./engineVars.
import { resolveLang, type Lang } from "@shared/langField";
import {
  callModeName, deriveConversationMode, deriveLeadStage, engineToday, languageName, normalizeAiDisclosure,
} from "./engineVars";

export interface CampaignForPreview {
  id: number;
  name: string;
  aiModel: string;
  /** Campaigns.status (Active, Draft, Paused, Archived...). */
  status?: string | null;
  isDemo?: boolean | null;
  /** Campaign whose prompt this one borrows when it has none of its own (engine falls through to it). */
  promptCampaignId?: number | null;
  /** The conversation prompt this campaign picked (Campaigns.prompt_id); the engine reads it first. */
  promptId?: number | null;
  agentName?: string | null;
  serviceName?: string | null;
  campaignService?: string | null;
  campaignUsp?: string | null;
  calendarLink?: string | null;
  firstMessage?: string | null;
  whatLeadDid?: string | null;
  leadContext?: string | null;
  firstTouch?: string | null;
  inquiriesSource?: string | null;
  inquiryTimeframe?: string | null;
  niche?: string | null;
  nicheQuestion?: string | null;
  qualificationCriteria?: string | null;
  bookingMode?: string | null;
  positioning?: string | null;
  aiDisclosure?: string | null;
  conversationModeOverride?: string | null;
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

/** One Campaigns API row (db keys or camelCase) in the preview's shape. */
export function toCampaignForPreview(c: any): CampaignForPreview {
  return {
    id: c.id || c.Id,
    name: c.name || c.Name || `Campaign #${c.id || c.Id}`,
    aiModel: c.aiModel || c.ai_model || "",
    status: c.status ?? null,
    isDemo: c.isDemo ?? c.is_demo ?? null,
    agentName: c.agentName ?? c.agent_name ?? null,
    serviceName: c.serviceName ?? c.service_name ?? null,
    campaignService: c.campaignService ?? c.campaign_service ?? null,
    campaignUsp: c.campaignUsp ?? c.campaign_usp ?? null,
    calendarLink: c.calendarLink ?? c.calendar_link ?? null,
    firstMessage: c.firstMessage ?? c.first_message ?? c.First_Message ?? null,
    whatLeadDid: c.whatLeadDid ?? c.what_lead_did ?? null,
    leadContext: c.leadContext ?? c.lead_context ?? null,
    firstTouch: c.firstTouch ?? c.first_touch ?? null,
    positioning: c.positioning ?? null,
    aiDisclosure: c.aiDisclosure ?? c.ai_disclosure ?? null,
    conversationModeOverride: c.conversationModeOverride ?? c.conversation_mode_override ?? null,
    inquiriesSource: c.inquiriesSource ?? c.inquiries_source ?? null,
    inquiryTimeframe: c.inquiryTimeframe ?? c.inquiry_timeframe ?? null,
    niche: c.niche ?? c.campaignNicheOverride ?? c.campaign_niche_override ?? null,
    nicheQuestion: c.nicheQuestion ?? c.niche_question ?? null,
    qualificationCriteria: c.qualificationCriteria ?? c.qualification_criteria ?? null,
    bookingMode: c.bookingModeOverride ?? c.booking_mode_override ?? null,
    language: c.language ?? null,
    promptCampaignId: c.promptCampaignId ?? c.prompt_campaign_id ?? null,
    promptId: c.promptId ?? c.prompt_id ?? null,
    demoClientName: c.demoClientName ?? c.demo_client_name ?? null,
    companyName: c.companyName ?? c.company_name ?? null,
    aiStyleOverride: c.aiStyleOverride ?? c.ai_style_override ?? null,
    description: c.description ?? null,
    aiRole: c.aiRole ?? c.ai_role ?? null,
    typoCount: c.typoCount ?? c.typo_count ?? null,
    kb: c.kb ?? null,
    accountsId: c.accountsId ?? c.Accounts_id ?? null,
  };
}

export interface LeadForPreview {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  whatHasTheLeadDone?: string | null;
  language?: string | null;
  leadContext?: string | null;
  when?: string | null;
}

export interface AccountForPreview {
  name?: string | null;
  defaultAiName?: string | null;
  defaultAiRole?: string | null;
  businessDescription?: string | null;
  defaultAiStyle?: string | null;
  defaultTypoFrequency?: string | null;
  language?: string | null;
  businessNiche?: string | null;
  callingNumber?: string | null;
  phone?: string | null;
  meetingType?: string | null;
}

/** Generic fallback niche terms used when the selected campaign has no
 *  Niche_Vocabulary row, so the preview never shows raw {project_term} tokens. */
export const DEFAULT_NICHE_TERMS: Record<"en" | "nl", Record<string, string>> = {
  en: {
    project_term: "project", project_term_list: "project",
    advisor_term: "specialist", advisor_term_list: "specialist",
    proposal_term: "proposal", proposal_term_list: "proposal",
    visit_term: "visit", visit_term_list: "visit",
    decision_term: "decision", decision_term_list: "decision",
  },
  nl: {
    project_term: "project", project_term_list: "project",
    advisor_term: "specialist", advisor_term_list: "specialist",
    proposal_term: "voorstel", proposal_term_list: "voorstel",
    visit_term: "bezoek", visit_term_list: "bezoek",
    decision_term: "beslissing", decision_term_list: "beslissing",
  },
};

/** Preview-only knobs: force conditional values and inject per-niche terms the
 *  client can't derive on its own (those live in the Niche_Vocabulary table). */
export interface ResolveOpts {
  /** Branch values chosen in Preview conditions; they win over the resolved ones. */
  overrides?: Record<string, string>;
  /** Resolved niche terms (project_term, proposal_term, …, and _list variants) and packs. */
  nicheTerms?: Record<string, string>;
  /** Values that replace the campaign's own (a demo Client's persona). */
  extra?: Record<string, string | undefined>;
}

export function buildMap(
  campaign?: CampaignForPreview | null,
  lead?: LeadForPreview | null,
  account?: AccountForPreview | null,
  lang?: string,
  opts?: ResolveOpts,
): Record<string, string | undefined | null> {
  const l = (lang || campaign?.language || "en") as Lang;
  const rl = (raw: unknown) => resolveLang(raw, l) || undefined;
  const service = campaign?.campaignService || (campaign ? "our service" : undefined);
  const whatLeadDid = lead?.whatHasTheLeadDone || rl(campaign?.whatLeadDid) || "";
  const leadStage = deriveLeadStage(whatLeadDid);
  const mode = deriveConversationMode(leadStage, campaign?.conversationModeOverride);
  const callingNumber = (account?.callingNumber || account?.phone || "").trim()
    || (campaign?.isDemo ? "06 27458300" : "");
  const map: Record<string, string | undefined | null> = {
    first_name: lead?.firstName,
    lead_name: lead?.firstName,
    last_name: lead?.lastName,
    phone: lead?.phone,
    email: lead?.email,
    when: lead?.when || "",
    agent_name: campaign?.agentName || account?.defaultAiName || (campaign ? "Assistant" : undefined),
    service,
    service_name: rl(campaign?.serviceName) || service,
    calendar_link: campaign?.calendarLink,
    calling_number: callingNumber,
    call_mode: callModeName(account?.meetingType),
    campaign_name: campaign?.name,
    usp: rl(campaign?.campaignUsp),
    kb: rl(campaign?.kb),
    what_lead_did: whatLeadDid,
    what_has_the_lead_done: whatLeadDid,
    lead_context: lead?.leadContext || rl(campaign?.leadContext) || "",
    first_touch: rl(campaign?.firstTouch),
    inquiries_source: campaign?.inquiriesSource,
    inquiry_timeframe: rl(campaign?.inquiryTimeframe),
    niche_question: rl(campaign?.nicheQuestion),
    qualification_criteria: campaign?.qualificationCriteria || "",
    // booking_mode_call wins in the engine and is on for every campaign.
    booking_mode: campaign ? "call" : undefined,
    company_name: campaign?.companyName || campaign?.demoClientName || campaign?.name,
    business: campaign?.companyName || campaign?.demoClientName || campaign?.name,
    niche: campaign?.niche,
    business_description: rl(campaign?.description) || account?.businessDescription || undefined,
    ai_style: rl(campaign?.aiStyleOverride) || account?.defaultAiStyle || "Casual, smooth and pro",
    language: languageName(lead?.language || campaign?.language),
    ai_role: rl(campaign?.aiRole) || account?.defaultAiRole || "sales representative",
    typo_frequency: account?.defaultTypoFrequency || "Rare",
    typo_count: String(campaign?.typoCount || 1),
    today_date: engineToday(),
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
    // ── Flow tokens the prompt branches on ──
    positioning: campaign?.positioning || "premium",
    ai_disclosure: normalizeAiDisclosure(campaign?.aiDisclosure),
    lead_stage: leadStage,
    conversation_mode: mode,
    // Per-turn engine values: a text turn on a normal (non-demo) conversation.
    voice_mode: "off",
    voice_live: "off",
    immediate_callback: campaign?.isDemo ? "on" : "off",
    opener_names_job: "no",
    decision_opener: mode === "decision" ? "unnamed" : "",
    quoted_first_reply: "",
    lead_source: "",
    social_context: "",
    // Per-niche substitution terms (fetched from the vocabulary API in the preview).
    ...(opts?.nicheTerms ?? {}),
    project: opts?.nicheTerms?.project_term ?? campaign?.serviceName ?? campaign?.campaignService ?? undefined,
  };
  // A demo Client's persona replaces the campaign's own values where it has one.
  for (const [k, v] of Object.entries(opts?.extra ?? {})) if (v) map[k] = v;
  if (opts?.extra?.what_lead_did) {
    map.lead_stage = deriveLeadStage(opts.extra.what_lead_did);
    map.conversation_mode = deriveConversationMode(map.lead_stage, campaign?.conversationModeOverride);
  }
  // Preview overrides win over everything above.
  Object.assign(map, opts?.overrides ?? {});

  // {first_message}: the opener template (Campaigns.First_Message, a {en,nl}
  // bilingual field) resolved to the campaign's language, then substituted
  // against this same map, mirroring personalize_message() server-side, so
  // the preview shows the actual sent text instead of a literal token.
  const firstMessageTemplate = opts?.extra?.first_message || rl(campaign?.firstMessage);
  map.first_message = firstMessageTemplate
    ? firstMessageTemplate.replace(/\{(\w+)\}/g, (match, key) => map[key.toLowerCase()] || match)
    : undefined;

  return map;
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

export const MARK = 'class="bg-amber-100 text-amber-800 rounded px-0.5 dark:bg-amber-900/40 dark:text-amber-300"';
const MARK_CLOSE = "</mark>";

/**
 * Split resolved HTML on newlines for per-line rendering, re-opening/closing
 * <mark> tags at each split so a multi-line variable value (e.g. a niche
 * example pack) stays highlighted on every line instead of just the first —
 * a naive .split("\n") cuts straight through the tag pair.
 */
export function splitHtmlPreservingMarks(html: string): string[] {
  const rawLines = html.split("\n");
  // The opening tags still open, kept whole so a re-opened line keeps its data-var.
  let open: string[] = [];
  return rawLines.map((line) => {
    const result = open.join("") + line;
    for (const m of line.matchAll(/<mark [^>]*>|<\/mark>/g)) {
      if (m[0] === MARK_CLOSE) open.pop(); else open.push(m[0]);
    }
    return open.length ? result + MARK_CLOSE.repeat(open.length) : result;
  });
}

// Matches {{#if var == "val"}}content{{else}}alt{{/if}} — no special HTML chars inside the tag syntax
const CONDITIONAL_RE = /\{\{#if\s+(\w+)\s*(==|!=)\s*&quot;([^&]*)&quot;\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
// Same conditional shape but on raw (unescaped) text — used for token counting.
const CONDITIONAL_RE_PLAIN = /\{\{#if\s+(\w+)\s*(==|!=)\s*"([^"]*)"\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

/**
 * Plain-text resolution with conditionals evaluated — the same substitution the
 * HTML preview shows, minus the escaping/<mark> wrapping. Used so the token
 * count matches exactly what's rendered in the preview panel, not the raw
 * unresolved template (which undercounts any {niche_*} pack variable).
 */
export function resolvePreviewPlainText(
  text: string,
  campaign?: CampaignForPreview | null,
  lead?: LeadForPreview | null,
  account?: AccountForPreview | null,
  lang?: string,
  opts?: ResolveOpts,
): string {
  const map = buildMap(campaign, lead, account, lang, opts);
  let out = text.replace(CONDITIONAL_RE_PLAIN, (_match, varName, op, compareVal, ifContent, elseContent) => {
    const actual = String(map[varName.toLowerCase()] ?? "");
    const met = op === "==" ? actual === compareVal : actual !== compareVal;
    if (met) return ifContent;
    if (elseContent != null) return elseContent;
    return "";
  });
  out = out.replace(/\{(\w+)\}/g, (match, key) => {
    const val = map[key.toLowerCase()];
    return val ? String(val) : match;
  });
  return out;
}

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
    // data-var: clicking the value in the preview opens its editor in the Variables panel.
    return `<mark ${MARK} data-var="${key}">${display}</mark>`;
  });

  return html;
}
