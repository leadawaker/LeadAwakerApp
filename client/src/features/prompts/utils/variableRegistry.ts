// Every prompt variable the engine fills in, with where its value lives so the
// Variables panel can explain it and save an edit back to that place.
// Descriptions are i18n keys (prompts: vars.desc.<name>), never text here.
// Mirrors automations tools/ai_service.py build_conversation_prompt (prompt_vars)
// and, for a demo Client, src/automations/conversation/prompt_builder.py
// _overlay_demo_niche_onto_campaign. A variable missing here still shows in the
// panel, as "no description yet".

/** Niche_Vocabulary term groups, as the vocabulary API names them. */
export type NicheTermGroup = "projectTerm" | "proposalTerm" | "decisionTerm" | "advisorTerm" | "visitTerm";
/** The same groups as the demo Clients API names them. */
export type ClientTermGroup = "project" | "proposal" | "decision" | "advisor" | "visit";
export type NichePackField = "questionBank" | "badExamples" | "objectionExamples" | "scenarioExamples";
export type ClientTextField =
  | "nicheLabel" | "companyNameTemplate" | "serviceName" | "usp" | "descriptionTemplate" | "kbTemplate"
  | "nicheQuestion" | "scopingLadder" | "openerPhrase" | "firstMessage" | "questionBank" | "objectionExamples";

export type InputKind = "text" | "long" | "int";

/** Where a read-only value comes from (prompts: vars.note.<key>). */
export type ReadOnlyNote =
  | "lead" | "today" | "stats" | "leadStage" | "conversationMode" | "perTurn" | "demoCallback"
  | "openerFlow" | "socialDemo" | "callMode" | "nicheRow" | "demoRun" | "demoContext" | "demoNumber" | "bookingMode"
  // Voice prompts
  | "voiceAgent" | "voiceHandoff" | "voiceFollowup" | "voiceKnowledge" | "voiceDisclosure" | "voiceService"
  | "voiceCity" | "voiceTask" | "voiceDetails" | "voiceYou" | "voiceLanguage" | "voiceNotFilled";

/** A card in Calls > Call settings (the account's Voice settings). */
export type VoiceCardLink = "agent" | "persona" | "knowledge" | "transfer" | "followUp";

export type VarSource =
  /** A Campaigns column, saved with PATCH /api/campaigns/:id. `lang`: an {en,nl} JSON field. */
  | { kind: "campaign"; field: string; lang?: true; input?: InputKind; options?: readonly string[] }
  /** An Accounts column, saved with PATCH /api/accounts/:id. */
  | { kind: "account"; field: string; input?: InputKind; options?: readonly string[] }
  /** A Niche_Vocabulary word group of the campaign's niche (the first word, or the whole list). */
  | { kind: "nicheTerm"; group: NicheTermGroup; list?: true }
  /** A Niche_Vocabulary example pack of the campaign's niche (saved per language slot). */
  | { kind: "nichePack"; field: NichePackField }
  /** A demo Client's text field, saved with PATCH /api/demo/clients/:niche. */
  | { kind: "clientText"; field: ClientTextField; input?: InputKind }
  /** A demo Client's word group. */
  | { kind: "clientTerm"; group: ClientTermGroup; list?: true }
  /** The line's own value, saved with PUT /api/accounts/:id/voice. */
  | { kind: "voiceLine"; field: "companyName" | "description" | "intake" | "extraInstructions"; input?: InputKind }
  /** A structured value with its own editor (VoiceValueEditor), opened from the row. */
  | { kind: "voicePopup"; value: "tone" | "address" | "pronunciation"; home: "profile" | "setup" }
  /** Not editable here: filled from the lead or worked out by the engine. `card`: its editor in Call settings. */
  | { kind: "readonly"; note: ReadOnlyNote; card?: VoiceCardLink };

export interface VarDef {
  /** Where the value lives when previewing as a campaign. */
  source: VarSource;
  /** Where it lives when previewing as a demo Client, when that differs. */
  client?: VarSource;
}

const camp = (field: string, extra: Partial<Extract<VarSource, { kind: "campaign" }>> = {}): VarSource =>
  ({ kind: "campaign", field, ...extra });
const ml = (field: string, input: InputKind = "long"): VarSource => ({ kind: "campaign", field, lang: true, input });
const ro = (note: ReadOnlyNote): VarSource => ({ kind: "readonly", note });
const ctext = (field: ClientTextField, input: InputKind = "long"): VarSource => ({ kind: "clientText", field, input });
const term = (group: NicheTermGroup, cg: ClientTermGroup, list?: true): VarDef => ({
  source: { kind: "nicheTerm", group, ...(list ? { list } : {}) },
  client: { kind: "clientTerm", group: cg, ...(list ? { list } : {}) },
});

export const LANGUAGE_OPTIONS = ["en", "nl", "pt"] as const;
export const POSITIONING_OPTIONS = ["premium", "mid_market"] as const;
export const AI_DISCLOSURE_OPTIONS = ["off", "opener", "second_message"] as const;
export const TYPO_FREQUENCY_OPTIONS = ["None", "Rare", "Occasional", "Common", "Frequent"] as const;

export const VARIABLE_REGISTRY: Record<string, VarDef> = {
  // ── The lead ──
  first_name: { source: ro("lead") },
  lead_name: { source: ro("lead") },
  last_name: { source: ro("lead") },
  phone: { source: ro("lead") },
  email: { source: ro("lead") },
  when: { source: ro("lead") },
  // ── Who the AI is ──
  agent_name: { source: camp("agentName"), client: ro("demoRun") },
  ai_role: { source: ml("aiRole", "text") },
  ai_style: { source: ml("aiStyleOverride", "text"), client: ro("demoRun") },
  typo_frequency: { source: { kind: "account", field: "defaultTypoFrequency", options: TYPO_FREQUENCY_OPTIONS } },
  typo_count: { source: camp("typoCount", { input: "int" }) },
  language: { source: camp("language", { options: LANGUAGE_OPTIONS }) },
  // ── The business ──
  company_name: { source: camp("companyName"), client: ctext("companyNameTemplate", "text") },
  business: { source: camp("companyName"), client: ctext("companyNameTemplate", "text") },
  business_description: { source: ml("description"), client: ctext("descriptionTemplate") },
  campaign_name: { source: camp("name") },
  service: { source: camp("campaignService"), client: ctext("serviceName", "text") },
  service_name: { source: ml("serviceName", "text"), client: ctext("serviceName", "text") },
  usp: { source: ml("campaignUsp"), client: ctext("usp") },
  kb: { source: ml("kb"), client: ctext("kbTemplate") },
  niche: { source: camp("niche"), client: ctext("nicheLabel", "text") },
  niche_question: { source: ml("nicheQuestion"), client: ctext("nicheQuestion") },
  qualification_criteria: { source: camp("qualificationCriteria", { input: "long" }) },
  // ── Booking ──
  calendar_link: { source: camp("calendarLink") },
  // The engine reads Campaigns.booking_mode_call first (true on every campaign), so the
  // Booking mode setting never reaches this variable: an edit here would not stick.
  booking_mode: { source: ro("bookingMode") },
  calling_number: { source: { kind: "account", field: "callingNumber" }, client: ro("demoNumber") },
  call_mode: { source: ro("callMode") },
  // ── What the lead did ──
  what_lead_did: { source: ml("whatLeadDid", "text"), client: ro("demoRun") },
  what_has_the_lead_done: { source: ml("whatLeadDid", "text"), client: ro("demoRun") },
  lead_context: { source: ml("leadContext"), client: ro("demoContext") },
  inquiries_source: { source: camp("inquiriesSource") },
  inquiry_timeframe: { source: ml("inquiryTimeframe", "text"), client: ro("demoRun") },
  first_touch: { source: ml("firstTouch", "text"), client: ro("demoRun") },
  first_message: { source: ml("firstMessage"), client: ctext("firstMessage") },
  // ── Flow tokens the prompt branches on ──
  positioning: { source: camp("positioning", { options: POSITIONING_OPTIONS }) },
  ai_disclosure: { source: camp("aiDisclosure", { options: AI_DISCLOSURE_OPTIONS }) },
  lead_stage: { source: ro("leadStage") },
  conversation_mode: { source: ro("conversationMode") },
  voice_mode: { source: ro("perTurn") },
  voice_live: { source: ro("perTurn") },
  immediate_callback: { source: ro("demoCallback") },
  opener_names_job: { source: ro("openerFlow") },
  decision_opener: { source: ro("openerFlow") },
  quoted_first_reply: { source: ro("openerFlow") },
  disclosure_clause: { source: ro("openerFlow") },
  lead_source: { source: ro("socialDemo") },
  social_context: { source: ro("socialDemo") },
  today_date: { source: ro("today") },
  // ── Niche words (Niche_Vocabulary) ──
  project_term: term("projectTerm", "project"),
  project_term_list: term("projectTerm", "project", true),
  proposal_term: term("proposalTerm", "proposal"),
  proposal_term_list: term("proposalTerm", "proposal", true),
  decision_term: term("decisionTerm", "decision"),
  decision_term_list: term("decisionTerm", "decision", true),
  advisor_term: term("advisorTerm", "advisor"),
  advisor_term_list: term("advisorTerm", "advisor", true),
  visit_term: term("visitTerm", "visit"),
  visit_term_list: term("visitTerm", "visit", true),
  niche_question_bank: { source: { kind: "nichePack", field: "questionBank" }, client: ctext("questionBank") },
  niche_bad_examples: { source: { kind: "nichePack", field: "badExamples" } },
  niche_objection_examples: { source: { kind: "nichePack", field: "objectionExamples" }, client: ctext("objectionExamples") },
  niche_scenario_examples: { source: { kind: "nichePack", field: "scenarioExamples" } },
  niche_scoping_ladder: { source: ro("nicheRow"), client: ctext("scopingLadder") },
  opener_phrase: { source: ro("nicheRow"), client: ctext("openerPhrase", "text") },
  // ── Campaign report snapshot (sample numbers in the preview) ──
  campaignname: { source: ro("stats") },
  campaignstatus: { source: ro("stats") },
  campaigndescription: { source: ro("stats") },
  campaigncreatedat: { source: ro("stats") },
  reportdate: { source: ro("stats") },
  totalleads: { source: ro("stats") },
  pipelinebreakdown: { source: ro("stats") },
  responserate: { source: ro("stats") },
  responded: { source: ro("stats") },
  bookingrate: { source: ro("stats") },
  booked: { source: ro("stats") },
};

// The voice rows' placeholders. They are a separate family: the same name can mean
// something else here, and {agent} or {company} mean other things in chat helper
// prompts. Mirrors automations live_session_config.build_live_session_config,
// greeting_instruction, realtime_voice_routes._fill_persona and client_setup.
// A value stays read-only with a link when its Call settings card runs logic a
// plain write would skip: the name also rewrites the greeting and follows the
// voice, a transfer number moves the line's wiring at Telnyx.
const voice = (note: ReadOnlyNote, card?: VoiceCardLink): VarSource => ({ kind: "readonly", note, ...(card ? { card } : {}) });
const persona = (field: "companyName" | "description", input: InputKind): VarSource => ({ kind: "voiceLine", field, input });

export const VOICE_VARIABLES: Record<string, VarSource> = {
  agent: voice("voiceAgent", "agent"),
  agent_name: voice("voiceAgent", "agent"),
  company: persona("companyName", "text"),
  company_name: persona("companyName", "text"),
  business_line: persona("description", "long"),
  business_description: persona("description", "long"),
  tone: { kind: "voicePopup", value: "tone", home: "setup" },
  address: { kind: "voicePopup", value: "address", home: "profile" },
  pronunciation: { kind: "voicePopup", value: "pronunciation", home: "setup" },
  intake: { kind: "voiceLine", field: "intake", input: "long" },
  client_rules: { kind: "voiceLine", field: "extraInstructions", input: "long" },
  handoff: voice("voiceHandoff", "transfer"),
  followup: voice("voiceFollowup", "followUp"),
  knowledge: voice("voiceKnowledge", "knowledge"),
  language: voice("voiceLanguage", "agent"),
  disclosure: voice("voiceDisclosure"),
  service_name: voice("voiceService"),
  city: voice("voiceCity"),
  you: voice("voiceYou"),
  task_instructions: voice("voiceTask"),
  call_details: voice("voiceDetails"),
  calling_number: voice("voiceNotFilled"),
  call_mode: voice("voiceNotFilled"),
};

export type VariableContextKind = "campaign" | "client" | "voice";

/** The source for one variable in the picked context; undefined for an unknown variable. */
export function variableSource(name: string, contextKind: VariableContextKind): VarSource | undefined {
  if (contextKind === "voice") return VOICE_VARIABLES[name];
  const def = VARIABLE_REGISTRY[name];
  if (!def) return undefined;
  return contextKind === "client" && def.client ? def.client : def.source;
}

/** Every variable name the registry knows, for "Insert another variable". */
export const KNOWN_VARIABLES: readonly string[] = Object.keys(VARIABLE_REGISTRY);
export const KNOWN_VOICE_VARIABLES: readonly string[] = Object.keys(VOICE_VARIABLES);

/** The options a select-type source offers, if any. */
export function sourceOptions(src: VarSource): readonly string[] | undefined {
  return src.kind === "campaign" || src.kind === "account" ? src.options : undefined;
}
