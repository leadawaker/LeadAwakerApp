import { sql } from "drizzle-orm";
import {
  pgSchema,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  date,
  numeric,
  bigint,
  boolean,
  time,
  json,
  jsonb,
  real,
  doublePrecision,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { ProductsByLang } from "./demoProducts";

// NocoDB schema
const nocodb = pgSchema("p2mxx34fvbf3ll6");


// ─── Accounts ───────────────────────────────────────────────────────────────

export const accounts = nocodb.table("Accounts", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  name: text("name"),
  phone: varchar("phone"),
  ownerEmail: varchar("owner_email"),
  website: text("website"),
  type: text("type"),
  timezone: text("timezone").default("Europe/Amsterdam"),
  language: text("language"),
  notes: text("notes"),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioMessagingServiceSid: text("twilio_messaging_service_sid"),
  twilioDefaultFromNumber: varchar("twilio_default_from_number"),
  status: text("status"),
  businessHoursStart: time("business_hours_start"),
  businessHoursEnd: time("business_hours_end"),
  // Days the client is open, 0=Sun...6=Sat (JS Date.getDay() convention). Default Mon-Fri.
  // Feeds resyncCaldiySchedule -> ~/caldiy's per-day Cal.com availability rows.
  openDays: jsonb("open_days").$type<number[]>().default([1, 2, 3, 4, 5]),
  // Hours between "now" and the earliest slot the AI will offer a lead. 0 = no minimum.
  minBookingNoticeHours: integer("min_booking_notice_hours").default(16),
  // Default call length in minutes when neither the lead nor campaign specifies one.
  defaultCallDurationMinutes: integer("default_call_duration_minutes").default(30),
  // Visits (specs/phone-booking-v2): an in-person appointment at the business,
  // its own Cal.diy event type ("visit"), offered by the phone receptionist.
  visitsEnabled: boolean("visits_enabled").notNull().default(false),
  socialEnabled: boolean("social_enabled").notNull().default(false),
  visitTitle: text("visit_title"),
  visitDurationMinutes: integer("visit_duration_minutes").notNull().default(60),
  visitAddress: text("visit_address"),
  maxDailySends: bigint("max_daily_sends", { mode: "number" }),
  webhookSecret: text("webhook_secret"),
  slug: text("slug"),
  defaultAiName: text("default_ai_name"),
  defaultAiRole: text("default_ai_role"),
  // Two-factor policy override for this account: off | admins | everyone, NULL = inherit the global policy.
  require2fa: text("require_2fa"),
  defaultAiStyle: text("default_ai_style"),
  defaultTypoFrequency: text("default_typo_frequency"),
  dataCollectionDisclosure: text("data_collection_disclosure"),
  optOutKeyword: text("opt_out_keyword"),
  preferredTerminology: text("preferred_terminology"),
  serviceCategories: text("service_categories"),
  businessDescription: text("business_description"),
  businessNiche: text("business_niche"),
  pricePerBooking: numeric("price_per_booking"),
  logoUrl: text("logo_url"),
  voiceFileData: text("voice_file_data"),
  voiceFileName: varchar("voice_file_name"),
  ttsVoiceIdEn: text("tts_voice_id_en"),
  ttsVoiceIdPt: text("tts_voice_id_pt"),
  ttsVoiceIdNl: text("tts_voice_id_nl"),
  ttsStyleEn: text("tts_style_en"),
  ttsStyleNl: text("tts_style_nl"),
  supportBotConfig: text("support_bot_config"),
  instagramAccessToken: text("instagram_access_token"),
  instagramUserId: text("instagram_user_id"),
  // Reputation management service (campaign_type='reputation')
  enableReputationManagement: boolean("enable_reputation_management").default(false),
  googleReviewUrl: text("google_review_url"),
  // User id (or channel) that receives negative-feedback alerts.
  reputationAlertTarget: text("reputation_alert_target"),
  // Reputation v2 — public review response (specs/reputation-reviews).
  enableReviewResponse: boolean("enable_review_response").default(false),
  reviewReplyAutoPositive: boolean("review_reply_auto_positive").default(false),
  // Managed messaging provisioning (Twilio subaccount) — see specs/messaging-provisioning.
  // The four twilio_* fields above are populated by provisioning; these track lifecycle + WhatsApp.
  messagingProvisionedAt: timestamp("messaging_provisioned_at", { withTimezone: true }),
  whatsappSenderStatus: text("whatsapp_sender_status"),  // none | pending | approved | rejected
  whatsappSenderSid: text("whatsapp_sender_sid"),
  whatsappDisplayName: text("whatsapp_display_name"),
  // WhatsApp quality/tier monitoring — see specs/whatsapp-quality-tracking. Polled (no Twilio
  // webhook exists for quality changes), inert until whatsapp_sender_sid is populated above.
  whatsappQualityRating: text("whatsapp_quality_rating").default("unknown"),  // green|yellow|red|unknown
  whatsappPreviousQualityRating: text("whatsapp_previous_quality_rating"),
  whatsappMessagingLimit: bigint("whatsapp_messaging_limit", { mode: "number" }),
  whatsappQualityCheckedAt: timestamp("whatsapp_quality_checked_at", { withTimezone: true }),
  // Auto-throttle — see specs/whatsapp-quality-auto-throttle. whatsappLastSyncedMaxDailySends is
  // the last messaging_limit value the poller synced (audit trail / tooltip copy only).
  // whatsappMaxDailySendsIsManual is the explicit "human owns this field" flag — set true on any
  // PATCH that edits maxDailySends, cleared via "Reset to auto-sync". See addendum-manual-override-flag.md.
  whatsappLastSyncedMaxDailySends: bigint("whatsapp_last_synced_max_daily_sends", { mode: "number" }),
  whatsappMaxDailySendsIsManual: boolean("whatsapp_max_daily_sends_is_manual").default(false),
  // Missed-Call Text-Back (Voice service Tier 1/2) — see specs/missed-call-textback.
  // A forwarded missed call → instant WhatsApp text-back from the client's own number → AI chat.
  // missedCallNumber is the provisioned Twilio voice number that receives forwarded calls; it is the
  // number→account routing key for inbound voice webhooks (a call has no AccountSid→CRM map).
  missedCallEnabled: boolean("missed_call_enabled").default(false),
  missedCallNumber: varchar("missed_call_number"),
  missedCallCampaignId: integer("missed_call_campaign_id"),  // the campaign_type='missed_call' campaign
  missedCallGreetingMode: text("missed_call_greeting_mode").default("silent"),  // 'voice' | 'silent'
  missedCallGreetingAudioData: text("missed_call_greeting_audio_data"),  // base64 mp3, served via <Play>
  missedCallGreetingFileName: varchar("missed_call_greeting_file_name"),
  missedCallVoicemailEnabled: boolean("missed_call_voicemail_enabled").default(false),  // Tier 2
  // Inbound WhatsApp: the campaign that answers a message from a number matching
  // no existing lead. Explicit per account, exactly like missedCallCampaignId —
  // a stranger is never routed by guesswork. NULL = keep dropping strangers.
  inboundCampaignId: integer("inbound_campaign_id"),
  // Receptionist channels (engine migrate_receptionist_channels.py): alphanumeric SMS sender (max 11
  // characters, one-way) and the WhatsApp sent after each phone call.
  smsSenderId: text("sms_sender_id"),
  afterCallFollowupEnabled: boolean("after_call_followup_enabled").default(false),
  // Per-account email From-identity — see specs/channel-fallback (task #676 "step 8").
  // Fallback/opener email sends from the client's own domain (deliverability + brand) once their
  // domain is DNS-verified (SPF+DKIM+DMARC). A per-account DKIM keypair is generated server-side;
  // the client publishes the public key. Until verified, email falls back to the shared sender.
  emailFromName: text("email_from_name"),
  emailFromAddress: text("email_from_address"),
  emailSendingDomain: text("email_sending_domain"),          // derived from email_from_address
  emailDomainVerified: boolean("email_domain_verified").default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  emailDkimSelector: text("email_dkim_selector"),
  emailDkimPrivateKey: text("email_dkim_private_key"),        // PKCS1 PEM (secret)
  emailDkimPublicKey: text("email_dkim_public_key"),          // base64 p= value (for display + verify)
  // Booking meeting type — see specs/booking-meeting-types.
  // callingNumber is the advisor's number for BOTH meeting types: who calls,
  // shown to the lead as a vCard contact card right after booking. It is
  // intentionally independent of the connected messaging/chat number — the
  // person who calls is often not the one texting.
  meetingType: text("meeting_type").default("phone_call"),    // phone_call | whatsapp_call
  callingNumber: text("calling_number"),
});

export const insertAccountsSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Accounts = typeof accounts.$inferSelect;
export type InsertAccounts = z.infer<typeof insertAccountsSchema>;


// ─── Prospects ──────────────────────────────────────────────────────────────

export const prospects = nocodb.table("Prospects", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  name: text("name"),
  company: text("company"),
  niche: text("niche"),
  country: text("country"),
  city: text("city"),
  website: text("website"),
  phone: varchar("phone"),
  email: varchar("email"),
  companyLinkedin: text("company_linkedin"),
  source: text("source"),
  status: text("status"),
  priority: text("priority"),
  notes: text("notes"),
  nextAction: text("next_action"),
  action: text("action"),
  contactName: text("contact_name"),
  contactRole: text("contact_role"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  contactLinkedin: text("contact_linkedin"),
  contactManual: boolean("contact_manual").default(false).notNull(),
  // Contact 2
  contact2Name: text("contact2_name"),
  contact2Role: text("contact2_role"),
  contact2Email: varchar("contact2_email"),
  contact2Phone: varchar("contact2_phone"),
  contact2Linkedin: text("contact2_linkedin"),
  contact2Manual: boolean("contact2_manual").default(false).notNull(),
  // Contact 2 enrichment fields
  contact2Headline: text("contact2_headline"),
  contact2PhotoUrl: text("contact2_photo_url"),
  contact2ConnectionCount: integer("contact2_connection_count"),
  contact2FollowerCount: integer("contact2_follower_count"),
  contact2TopPost: text("contact2_top_post"),
  contact2PersonBrief: text("contact2_person_brief"),
  accountsId: integer("Accounts_id"),
  // Enrichment fields (populated by LinkedIn scraper)
  headline: text("headline"),
  connectionCount: integer("connection_count"),
  followerCount: integer("follower_count"),
  topPost: text("top_post"),
  aiSummary: text("ai_summary"),
  conversationStarters: text("conversation_starters"),
  offerIdeas: text("offer_ideas"),
  personBrief: text("person_brief"),
  icebreaker: text("icebreaker"),
  pageSummaries: text("page_summaries"),
  generatedMessages: text("generated_messages"),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  enrichmentStatus: text("enrichment_status"),
  // Company enrichment (AI-generated, separate from contact enrichment)
  companySummary: text("company_summary"),
  companyServices: text("company_services"),
  companyHistory: text("company_history"),
  auditInsights: jsonb("audit_insights"),
  companyEnrichmentStatus: text("company_enrichment_status"),
  companyEnrichedAt: timestamp("company_enriched_at", { withTimezone: true }),
  // Structured top posts for carousel: [{title, date, reactions, url?}]
  topPostData: jsonb("top_post_data"),
  contact2TopPostData: jsonb("contact2_top_post_data"),
  companyTopPostData: jsonb("company_top_post_data"),
  // Outreach tracking
  outreachStatus: text("outreach_status"),
  firstContactedAt: timestamp("first_contacted_at", { withTimezone: true }),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  followUpCount: integer("follow_up_count"),
  nextFollowUpDate: timestamp("next_follow_up_date", { withTimezone: true }),
  contactMethod: text("contact_method"),
  photoUrl: text("photo_url"),
  companyLogoUrl: text("company_logo_url"),
  // Cadence sequence tracking
  sequenceStep: integer("sequence_step").default(1),
  sequenceStartedAt: timestamp("sequence_started_at", { withTimezone: true }),
  nextChannel: text("next_channel"),
});

export const insertProspectsSchema = createInsertSchema(prospects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Prospects = typeof prospects.$inferSelect;
export type InsertProspects = z.infer<typeof insertProspectsSchema>;


// ─── Outreach Templates ──────────────────────────────────────────────────────────
export const outreachTemplates = nocodb.table("OutreachTemplates", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  name: text("name"),
  niche: text("niche"),
  templateType: text("template_type"),
  subject: text("subject"),
  body: text("body"),
  channel: text("channel"),
  language: text("language"),
  accountsId: integer("Accounts_id"),
});

export const insertOutreachTemplatesSchema = createInsertSchema(outreachTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OutreachTemplate = typeof outreachTemplates.$inferSelect;
export type InsertOutreachTemplate = z.infer<typeof insertOutreachTemplatesSchema>;

// ─── Account_Communication_Profile ───────────────────────────────────────────
// One row per account. Captures how the client wants the AI to communicate with
// their leads (onboarding wizard answers). Stored only for now — does not yet
// feed prompt generation or the leads' active_agent persona.

export const accountCommunicationProfile = nocodb.table("Account_Communication_Profile", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  accountsId: integer("Accounts_id"),
  // Single-choice style answers (stored as plain strings, validated by Zod at the route).
  openingStyle: text("opening_style"),       // AI style: personal | project | business
  addressForm: text("address_form"),         // je | u
  statusQuestion: text("status_question"),    // traject | project | besluitvorming
  formality: integer("formality"),           // 1–5
  agentName: text("agent_name"),             // thomas | mark | sophie | lisa
  agentNameCustom: text("agent_name_custom"), // free-text alternative name
  avatarChoice: text("avatar_choice"),        // logo | avatar | avatarLogo
  avatarGender: text("avatar_gender"),         // male | female — portrait gender (for custom names)
  // Structured selections.
  preferredWords: jsonb("preferred_words").$type<{ projectTerm?: string; proposalTerm?: string; decisionTerm?: string }>(),
  perception: jsonb("perception").$type<string[]>(),
  bookingUrl: text("booking_url"),           // calendar / booking link the AI sends to leads
  differentiator: text("differentiator"),    // why customers choose them (newline-separated USP lines)
  // Receptionist onboarding (specs/receptionist-onboarding): which services the
  // client takes, and the per-service answers (handoff, voice, whatsapp, stock).
  // The phone receptionist reads voice, handoff.ringWhen, greeting, pronunciation and
  // afterHours at call start (specs/voice-setup-slots). The rest is stored only.
  services: jsonb("services").$type<string[]>(),
  setup: jsonb("setup").$type<Record<string, unknown>>(),
  // Wizard progress.
  status: text("status"),                    // draft | in_progress | completed
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("account_communication_profile_accounts_id_idx").on(t.accountsId),
]);

export const insertAccountCommunicationProfileSchema = createInsertSchema(accountCommunicationProfile, {
  formality: z.coerce.number().int().min(1).max(5).nullish(),
  perception: z.array(z.string()).max(3).nullish(),
  preferredWords: z.object({
    projectTerm: z.string().optional(),
    proposalTerm: z.string().optional(),
    decisionTerm: z.string().optional(),
  }).nullish(),
  completedAt: z.coerce.date().nullish(),
  services: z.array(z.enum(["voice", "widget", "whatsapp", "dbr"])).nullish(),
  setup: z.record(z.string(), z.unknown()).nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AccountCommunicationProfile = typeof accountCommunicationProfile.$inferSelect;
export type InsertAccountCommunicationProfile = z.infer<typeof insertAccountCommunicationProfileSchema>;

// ─── Niche_Vocabulary ─────────────────────────────────────────────────────────
// One row per niche (or __default__). Stores the word lists for the preferred-words
// wizard step. Inline-added words persist per niche.
//
// Also the "Clients" library behind the demo persona work: a niche row IS a
// Client, and the company name on it is a default that a single demo can
// override without touching the saved row (specs/demo-persona-library/plan.md).

/** A per-language text slot. Partial: a Client generated in one language has
 *  only that language filled, and every reader falls back (pt → en). */
export type NicheText = { nl?: string; en?: string; pt?: string };

export type SocialPostText = {
  handle: string;
  caption: string;
  keyword: string;
  cta_line: string;
  dm_opener: string;
  offer: string;
  image_prompt: string;
  likes: number;
};
export type SocialPostByLang = Partial<Record<"en" | "nl" | "pt", SocialPostText>>;

export const nicheVocabulary = nocodb.table("Niche_Vocabulary", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  niche: text("niche").notNull(),
  projectTerms: jsonb("project_terms").$type<string[]>().default([]),
  proposalTerms: jsonb("proposal_terms").$type<string[]>().default([]),
  decisionTerms: jsonb("decision_terms").$type<string[]>().default([]),
  // Prompt-critical niche terms (consumed by the conversation prompt, not just
  // the onboarding wizard). advisorTerms = the human expert the AI books a call
  // with (kitchen designer, landscape architect); visitTerms = the first-touch
  // location/context (showroom, site visit).
  advisorTerms: jsonb("advisor_terms").$type<string[]>().default([]),
  visitTerms: jsonb("visit_terms").$type<string[]>().default([]),
  // English counterparts. The columns above hold the Dutch (nl) words; these
  // *_en columns hold the English set. Additive + backward-compatible: callers
  // fall back to the nl columns when an *_en list is empty.
  projectTermsEn: jsonb("project_terms_en").$type<string[]>().default([]),
  proposalTermsEn: jsonb("proposal_terms_en").$type<string[]>().default([]),
  decisionTermsEn: jsonb("decision_terms_en").$type<string[]>().default([]),
  advisorTermsEn: jsonb("advisor_terms_en").$type<string[]>().default([]),
  visitTermsEn: jsonb("visit_terms_en").$type<string[]>().default([]),
  // Business profile templates per niche (bilingual). When a campaign picks
  // this niche, company_name/description/kb pre-fill from these; editing those
  // campaign fields writes them back here for future campaigns.
  companyNameTemplate: jsonb("company_name_template").$type<{ nl: string; en: string }>().default({ nl: "", en: "" }),
  descriptionTemplate: jsonb("description_template").$type<{ nl: string; en: string }>().default({ nl: "", en: "" }),
  kbTemplate: jsonb("kb_template").$type<{ nl: string; en: string }>().default({ nl: "", en: "" }),
  // Per-niche example packs for prompt 93 (v8.7+): vivid few-shot content that
  // keeps the universal skeleton from sounding generic. __default__ row = kitchen
  // content (v8.6's exact examples), the always-rich fallback for any niche
  // whose own pack is still empty.
  questionBank: jsonb("question_bank").$type<{ nl: string; en: string }>().default({ nl: "", en: "" }),
  badExamples: jsonb("bad_examples").$type<{ nl: string; en: string }>().default({ nl: "", en: "" }),
  objectionExamples: jsonb("objection_examples").$type<{ nl: string; en: string }>().default({ nl: "", en: "" }),
  scenarioExamples: jsonb("scenario_examples").$type<{ nl: string; en: string }>().default({ nl: "", en: "" }),
  // Present in the live table since the universal demo landed, but never
  // declared here. Added so the Clients library can read/write them through
  // Drizzle instead of raw SQL.
  scopingLadder: jsonb("scoping_ladder").$type<NicheText>().default({}),
  openerPhrase: jsonb("opener_phrase").$type<NicheText>().default({}),
  // ── Demo persona ("Clients" library, specs/demo-persona-library) ──────────
  // A generated demo persona used to live only on leads.demo_niche and die with
  // the lead. These hold the DURABLE half of it so it can be re-picked. The
  // per-run half (scenario, disclosure, lead name, company override, ai_style,
  // inquiry_timeframe, first_touch) is deliberately NOT stored: it comes from
  // the run strip on campaign 60's AI tab and is re-applied at re-pick time.
  // Short display label ("Solar", "zonne-energie"). The engine reads it as
  // {niche}, so it has to round-trip per language or a re-picked Dutch Client
  // shows an English niche name in the prompt.
  nicheLabel: jsonb("niche_label").$type<NicheText>().default({}),
  serviceName: jsonb("service_name").$type<NicheText>().default({}),
  usp: jsonb("usp").$type<NicheText>().default({}),
  nicheQuestion: jsonb("niche_question").$type<NicheText>().default({}),
  firstMessage: jsonb("first_message").$type<NicheText>().default({}),
  // The two halves of what the prompt reads as {lead_context}. A Client is
  // reused across conversation types, and the variable does two different jobs:
  // in scoping mode it pre-fills the ladder (skip what they already told us),
  // in decision mode it is the quote being reconsidered. One field cannot serve
  // both, so the row holds both and the engine picks by conversation_mode.
  // What they said when they first came in. Ladder pre-fill.
  enquiryContext: jsonb("enquiry_context").$type<NicheText>().default({}),
  // The example quote: total, 2-4 line items, a relative date, optionally the
  // decision-maker's role. Change detection.
  quoteContext: jsonb("quote_context").$type<NicheText>().default({}),
  // The same quote compressed for the OPENER: a naming phrase ("the ten panels
  // and the battery") and its age ("about five months ago"). Stored rather than
  // summarised from quoteContext at send time, because the opener goes out
  // before any model reasons about this row.
  quoteSubject: jsonb("quote_subject").$type<NicheText>().default({}),
  quoteWhen: jsonb("quote_when").$type<NicheText>().default({}),
  // Time reference only, no action ("a few months ago"). Stored rather than
  // re-derived so a re-picked Client reads exactly like a freshly generated one.
  whenLabel: jsonb("when_label").$type<NicheText>().default({}),
  // Portuguese term lists. The columns above cover nl (bare) and en (_en) only,
  // so without these a re-picked Brazilian Client came back speaking Dutch.
  projectTermsPt: jsonb("project_terms_pt").$type<string[]>().default([]),
  proposalTermsPt: jsonb("proposal_terms_pt").$type<string[]>().default([]),
  decisionTermsPt: jsonb("decision_terms_pt").$type<string[]>().default([]),
  advisorTermsPt: jsonb("advisor_terms_pt").$type<string[]>().default([]),
  visitTermsPt: jsonb("visit_terms_pt").$type<string[]>().default([]),
  // Clients-tab card identity (specs/demo-persona-library): grouping + a
  // per-entry emoji, so a 23+ row grid is scannable. Both nullable with no
  // default — an unset Client is "Uncategorized" in the UI, not an error.
  category: text("category"),
  emoji: text("emoji"),
  // Does this niche book a CALL or an on-site visit? Per-niche, so it is part
  // of the persona rather than the run.
  bookingModeCall: boolean("booking_mode_call").default(false),
  // Saved by minting a demo (true), or one of the curated niche packs that the
  // engine merges into REAL campaigns (false)? Only a saved Client may be
  // deleted from the Clients tab. Explicit rather than inferred: every curated
  // row also has a description_template, so content alone cannot tell them
  // apart.
  isDemoClient: boolean("is_demo_client").default(false),
  // Website-scrape provenance + the homepage screenshot used as the backdrop of
  // the widget demo (specs/website-widget phase 5). screenshotPath is a file name
  // inside uploads/site-shots/, served by GET /api/site-shot/:file.
  websiteUrl: text("website_url"),
  screenshotPath: text("screenshot_path"),
  screenshotAt: timestamp("screenshot_at", { withTimezone: true }),
  // Instagram comment-to-DM sales demo (specs/social-reply-demo): a generated
  // post per language (caption, keyword, offer, ...) and its image file, same
  // uploads/site-shots/ convention as screenshotPath.
  socialPost: jsonb("social_post").$type<SocialPostByLang | null>(),
  socialImagePath: text("social_image_path"),
  // Widget demo launcher colour, set by hand on the Demos page. Null = use the
  // colour detected from the screenshot (server/brandColor.ts), else black.
  widgetColor: text("widget_color"),
  // The business's logo for the Instagram and Reputation demos, in place of the
  // initials circle. Same uploads/site-shots/ convention as screenshotPath.
  // logoSource is "site" (fetched from websiteUrl) or "upload" (Demos page);
  // logoEnabled turns it off for every demo of this Client at once. Read live.
  logoPath: text("logo_path"),
  logoSource: text("logo_source"),
  logoEnabled: boolean("logo_enabled").notNull().default(true),
  // Hand-written starter chips for this Client's demo widget, overriding the
  // ones derived from the term lists above. Same {label, text} shape as
  // Widget_Configs.quickReplies. Read live, not through the persona snapshot,
  // so an edit reaches demo links that were already sent.
  quickReplies: jsonb("quick_replies").$type<{ label: string; text: string }[] | null>(),
  // Live voice client (specs/voice-tab): a persona owned by one Account and
  // edited only from that Account's Voice tab. The Demos page lists it
  // read-only (isLive) so a demo edit cannot change a live client. One live
  // persona per account (partial unique index uq_niche_vocabulary_accounts_id,
  // created by the engine migration, not declared here).
  accountsId: integer("accounts_id"),
  isLive: boolean("is_live").notNull().default(false),
  // Demos redesign (script/create-demos-redesign-columns.mjs). Products the
  // business sells, per language ({ en?, nl?, pt? }, each a list of
  // { name, detail, price }, max 20), edited in the persona editor and read by
  // the demo prompts. The stock page URL, city and phone are not per language.
  // Written by the persona editor and the website scan review.
  products: jsonb("products")
    .$type<ProductsByLang>()
    .notNull()
    .default({}),
  stockUrl: text("stock_url"),
  city: text("city"),
  phone: text("phone"),
}, (t) => [
  uniqueIndex("niche_vocabulary_niche_idx").on(t.niche),
]);

export const insertNicheVocabularySchema = createInsertSchema(nicheVocabulary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type NicheVocabulary = typeof nicheVocabulary.$inferSelect;
export type InsertNicheVocabulary = z.infer<typeof insertNicheVocabularySchema>;

// The five editable word groups, in display order. projectTerm/proposalTerm/
// decisionTerm feed both the onboarding wizard and the conversation prompt;
// advisorTerm/visitTerm are prompt-only (the human expert + first-touch context).
export const NICHE_WORD_GROUPS = [
  "projectTerm", "proposalTerm", "decisionTerm", "advisorTerm", "visitTerm",
] as const;
export type NicheWordGroup = (typeof NICHE_WORD_GROUPS)[number];
export type NicheWordGroups = Record<NicheWordGroup, string[]>;
export const EMPTY_NICHE_GROUPS: NicheWordGroups = {
  projectTerm: [], proposalTerm: [], decisionTerm: [], advisorTerm: [], visitTerm: [],
};

// ─── Automation_Logs ───────────────────────────────────────────────────────────────

export const automationLogs = nocodb.table("Automation_Logs", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  workflowName: text("workflow_name"),
  leadsId: integer("Leads_id"),
  campaignsId: integer("Campaigns_id"),
  accountsId: integer("Accounts_id"),
  workflowExecutionId: text("workflow_execution_id"),
  stepName: text("step_name"),
  stepNumber: bigint("step_number", { mode: "number" }),
  status: text("status"),
  errorCode: text("error_code"),
  inputData: text("input_data"),
  outputData: text("output_data"),
  executionTimeMs: bigint("execution_time_ms", { mode: "number" }),
  retryCount: bigint("retry_count", { mode: "number" }),
  metadata: text("metadata"),
  campaignName: text("campaign_name"),
  accountName: text("account_name"),
  leadName: text("lead_name"),
  accountId: bigint("account_id", { mode: "number" }),
  campaignId: bigint("campaign_id", { mode: "number" }),
  leadId: bigint("lead_id", { mode: "number" }),
  skippedReason: text("skipped_reason"),
  isCriticalError: boolean("is_critical_error"),
  // 'action' = one diary line per real automation action (specs/automation-overview).
  // NULL = debug step row (2-day retention).
  kind: text("kind"),
  // Set when Gabriel clears a failure that was already fixed. The row stays in the diary.
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => [
  index("automation_logs_accounts_id_idx").on(t.accountsId),
  index("automation_logs_created_at_idx").on(t.createdAt),
  index("automation_logs_status_idx").on(t.status),
  index("automation_logs_exec_id_idx").on(t.workflowExecutionId),
]);

export const insertAutomation_LogsSchema = createInsertSchema(automationLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Automation_Logs = typeof automationLogs.$inferSelect;
export type InsertAutomation_Logs = z.infer<typeof insertAutomation_LogsSchema>;


// ─── Campaigns ───────────────────────────────────────────────────────────────

export const campaigns = nocodb.table("Campaigns", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  name: text("name"),
  status: text("status"),
  // Service discriminator: reactivation | reputation | speed_to_lead | nurture.
  // Reactivation is the default; the engine routes inbound replies by this value.
  campaignType: text("campaign_type").default("reactivation"),
  // Borrow another campaign's Prompt_Library rows when this one has none of its
  // own, so two campaigns share ONE prompt instead of drifting copies. Read by
  // the engine's get_prompt_for_campaign (campaign 68 -> 67's prompt #108).
  promptCampaignId: integer("prompt_campaign_id"),
  // Reputation: minutes after service_completed_at before the feedback ask is sent.
  reputationDelayMinutes: integer("reputation_delay_minutes"),
  accountsId: integer("Accounts_id"),
  description: text("description"),
  website: text("website"),
  n8nWorkflowId: text("n8n_workflow_id"),
  aiPromptTemplate: text("ai_prompt_template"),
  totalCost: numeric("total_cost"),
  bump1Template: text("bump_1_template").default("Hi {first_name}! Just checking in, I figured you got busy before."),
  bump2Template: text("bump_2_template").default("{first_name}, what's holding you back from {service}?"),
  bump3Template: text("bump_3_template").default("Is it a trust thing?"),
  bump4Template: text("bump_4_template").default("I won't bother you anymore {first_name}. If you ever need to discuss {service}, I will be here for you :)"),
  reengagementBumpTemplate: text("reengagement_bump_template"),
  bump1DelayHours: bigint("bump_1_delay_hours", { mode: "number" }),
  bump3DelayHours: bigint("bump_3_delay_hours", { mode: "number" }),
  bump2DelayHours: bigint("bump_2_delay_hours", { mode: "number" }),
  messageIntervalMinutes: bigint("message_interval_minutes", { mode: "number" }),
  // Inbound reply debounce (seconds) — how long the engine waits after an
  // inbound message before generating one reply for the batch. NULL = engine
  // defaults (10s text / 60s memos). Voice memos check their own column first,
  // then fall back to messageDebounceSeconds, then the 60s default.
  messageDebounceSeconds: integer("message_debounce_seconds"),
  voiceNoteDebounceSeconds: integer("voice_note_debounce_seconds"),
  // Name on the post-booking WhatsApp contact card (vCard). NULL = engine
  // composes "{business name} Advisor/Adviseur" from the account, so it
  // follows company renames; a typed name is shown as-is.
  vcardContactName: text("vcard_contact_name"),
  activeHoursStart: time("active_hours_start"),
  activeHoursEnd: time("active_hours_end"),
  defaultCallDurationMinutes: integer("default_call_duration_minutes"),
  calendarLink: text("calendar_link"),
  dailyLeadLimit: bigint("daily_lead_limit", { mode: "number" }),
  webhookUrl: text("webhook_url"),
  aiModel: text("ai_model"),
  useAiBumps: boolean("use_ai_bumps"),
  maxBumps: bigint("max_bumps", { mode: "number" }).default(4),
  // Reception campaigns hand off on the first "a person please" (engine migrate_receptionist_channels.py).
  handoffOnFirstRequest: boolean("handoff_on_first_request").default(false),
  // 'receptionist' = one AI follow-up only when the lead went quiet mid-question, never Lost.
  // NULL = the normal bump flow (engine scripts/migrate_receptionist_bump_mode.py).
  bumpMode: text("bump_mode"),
  stopOnResponse: boolean("stop_on_response"),
  channel: text("channel").default("sms"),
  // Channel fallback (specs/channel-fallback): primary→fallback delivery routing.
  channelMode: text("channel_mode").default("whatsapp_then_sms"),
  // Default chain: WhatsApp → SMS → nothing. Email fallback is deliberately OFF
  // (2026-07-13, not deliverability-safe from the Pi; see
  // specs/channel-fallback/email-fallback-assessment-2026-07-13.md). To re-enable
  // email as a fallback, set 'sms_then_email' or 'email' per campaign.
  fallbackChannel: text("fallback_channel").default("sms"),
  firstMessageVoiceNote: boolean("first_message_voice_note").default(false),
  bump1VoiceNote: boolean("bump_1_voice_note").default(false),
  bump2VoiceNote: boolean("bump_2_voice_note").default(false),
  bump3VoiceNote: boolean("bump_3_voice_note").default(false),
  bump4VoiceNote: boolean("bump_4_voice_note").default(false),
  bump4DelayHours: bigint("bump_4_delay_hours", { mode: "number" }),
  bump1AiReference: boolean("bump_1_ai_reference").default(false),
  bump2AiReference: boolean("bump_2_ai_reference").default(false),
  bump3AiReference: boolean("bump_3_ai_reference").default(false),
  // Per-bump AI angle override: what generate_ai_bump() should aim for at this
  // stage. Falls back to the engine's hardcoded _STAGE_ANGLES when empty (see
  // docs/superpowers/specs/2026-07-02-bump-system-overhaul-design.md, item 2).
  bump1AiPrompt: text("bump_1_ai_prompt"),
  bump2AiPrompt: text("bump_2_ai_prompt"),
  bump3AiPrompt: text("bump_3_ai_prompt"),
  bump4AiPrompt: text("bump_4_ai_prompt"),
  bump1VoiceTemplate: text("bump_1_voice_template"),
  bump2VoiceTemplate: text("bump_2_voice_template"),
  bump3VoiceTemplate: text("bump_3_voice_template"),
  bump4VoiceTemplate: text("bump_4_voice_template"),
  aiReplyVoiceNote: boolean("ai_reply_voice_note").default(false),
  voiceReplyMode: text("voice_reply_mode").default("off"),
  voiceEngine: text("voice_engine").default("pipeline"),
  ttsVoiceId: text("tts_voice_id"),
  niche: text("niche"),
  campaignService: text("campaign_service"),
  campaignUsp: text("campaign_usp"),
  kb: text("kb"),
  targetAudience: text("target_audience"),
  nicheQuestion: text("niche_question"),
  qualificationCriteria: text("qualification_criteria"),
  bookingModeOverride: text("booking_mode_override"),
  calendarLinkOverride: text("calendar_link_override"),
  inquiriesSource: text("inquiries_source"),
  inquiryTimeframe: text("inquiry_timeframe"),
  whatLeadDid: text("what_lead_did"),
  firstMessage: text("First_Message"),
  // Opener used when conversation_mode resolves to "scoping" (no quote exists
  // yet), so a lead who only ever enquired can be asked to confirm they are the
  // right person instead of being greeted as a known contact. Same {en,nl} JSON
  // shape as First_Message, which stays the universal fallback and the
  // decision-mode opener. Empty on every campaign but 60 — a campaign that
  // never fills it in keeps its single opener and behaves exactly as before.
  firstMessageScoping: text("first_message_scoping"),
  // Opener used when the lead already HAS a quote on file (lead_stage "quoted"
  // or "deciding"). First_Message frames the lead as someone who merely
  // enquired ("you reached out ... is that still on your radar?"), which reads
  // to a quoted lead as though nobody opened their file. This one names the job
  // and how long ago it went out. Same {en,nl} JSON shape. Empty on every
  // campaign but 60; apply_mode_opener falls back to First_Message when unset,
  // so a campaign that never fills it in behaves exactly as before.
  firstMessageQuoted: text("first_message_quoted"),
  // Discovery Demo Trust Kit: up to 3 owner-approved {objection, answer} pairs,
  // injected into the AI's system prompt verbatim-in-substance (see Part 3 of
  // docs/superpowers/specs/2026-07-02-discovery-demo-trust-kit-design.md).
  objectionPlaybook: jsonb("objection_playbook").$type<{ objection: string; answer: string }[]>(),

  agentName: text("agent_name"),
  serviceName: text("service_name"),
  typoCount: integer("typo_count").default(1),
  // Performance metrics (calculated fields on Campaigns table)
  totalLeadsTargeted: integer("total_leads_targeted"),
  totalMessagesSent: integer("total_messages_sent"),
  totalResponsesReceived: integer("total_responses_received"),
  responseRatePercent: numeric("response_rate_percent"),
  bookingsGenerated: integer("bookings_generated"),
  bookingRatePercent: numeric("booking_rate_percent"),
  costPerLead: numeric("cost_per_lead"),
  costPerBooking: numeric("cost_per_booking"),
  roiPercent: numeric("roi_percent"),
  contractId:         integer("contract_id"),
  valuePerBooking:    numeric("value_per_booking"),
  lastMetricsCalculatedAt: timestamp("last_metrics_calculated_at", { withTimezone: true }),
  campaignSticker: text("campaign_sticker"),
  campaignHue: integer("campaign_hue"),
  aiSummary: text("ai_summary"),
  aiSummaryGeneratedAt: timestamp("ai_summary_generated_at", { withTimezone: true }),
  abEnabled: boolean("ab_enabled").default(false),
  abSplitRatio: integer("ab_split_ratio").default(50),
  botToken: text("bot_token"),
  language: text("language"),
  isDemo: boolean("is_demo").default(false),
  optOutNotice: boolean("opt_out_notice").default(false),
  // Whether the account-level Knowledge Base is injected into this campaign's
  // AI prompt. false = campaign runs only on its own kb field (demo campaigns).
  useAccountKb: boolean("use_account_kb").default(true),
  demoClientName: text("demo_client_name"),
  companyName: text("company_name"),
  aiStyleOverride: text("ai_style_override"),
  twilioFirstMessageTemplateSid: text("twilio_first_message_template_sid"),
  twilioBumpTemplateSid: text("twilio_bump_template_sid"),
  firstTouch: text("first_touch"),
  // Market positioning drives premium vs value framing in the prompt (premium |
  // mid_market). Defaults to premium to preserve existing campaign behavior.
  positioning: text("positioning").default("premium"),
  // EU AI Act (Art. 50) disclosure: when "on", the AI states it is a virtual
  // assistant early in the conversation. Defaults to "off" (legacy behavior).
  aiDisclosure: text("ai_disclosure").default("off"),
  // "scoping" | "decision" | null. Forces the conversation flow regardless of
  // the lead's derived stage. Needed by demo campaigns, which must ladder even
  // when their stage would resolve to decision mode.
  conversationModeOverride: text("conversation_mode_override"),
  // Hard cap on balloons per AI reply. Default 1: every extra balloon is a
  // separately billed message, and a ladder runs 8-10 turns.
  maxMessagesPerReply: integer("max_messages_per_reply").default(1),
  // Free-text specifics about what this campaign's leads did, in the lead's own
  // terms ("enquired about 3 windows via the website, no quote sent"). The
  // campaign-level default; Leads.lead_context overrides it per row so an
  // imported client list can carry real quote details. Multilingual {en,nl}
  // JSON like the other campaign copy fields. Distinct from whatLeadDid, which
  // is a dropdown the engine keyword-matches to derive the lead stage: free
  // text there breaks the classifier, which is why this field exists.
  leadContext: text("lead_context"),
}, (t) => [
  index("campaigns_accounts_id_idx").on(t.accountsId),
]);

export const insertCampaignsSchema = createInsertSchema(campaigns, {
  objectionPlaybook: z.array(z.object({
    objection: z.string().max(500),
    answer: z.string().max(500),
  })).max(3).nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Campaigns = typeof campaigns.$inferSelect;
export type InsertCampaigns = z.infer<typeof insertCampaignsSchema>;


// ─── Interactions ───────────────────────────────────────────────────────────────

export const interactions = nocodb.table("Interactions", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  who: text("Who"),
  accountsId: integer("Accounts_id"),
  campaignsId: integer("Campaigns_id"),
  leadsId: integer("Leads_id"),
  type: text("type"),
  direction: text("direction"),
  content: text("Content"),
  status: text("status"),
  twilioMessageSid: text("twilio_message_sid"),
  fromNumber: varchar("from_number"),
  toNumber: varchar("to_number"),
  metadata: json("metadata"),
  aiGenerated: boolean("ai_generated"),
  aiModel: text("ai_model"),
  aiPrompt: text("ai_prompt"),
  aiResponse: text("ai_response"),
  aiPromptTokens: bigint("ai_prompt_tokens", { mode: "number" }),
  aiCompletionTokens: bigint("ai_completion_tokens", { mode: "number" }),
  aiTotalTokens: bigint("ai_total_tokens", { mode: "number" }),
  aiCost: numeric("ai_cost"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  bumpNumber: bigint("bump_number", { mode: "number" }),
  triggeredBy: text("triggered_by"),
  isBump: boolean("is_bump"),
  attachment: text("Attachment"),
  sentimentScore: bigint("sentiment_score", { mode: "number" }),
  usersId: integer("Users_id"),
  accountId: bigint("account_id", { mode: "number" }),
  leadId: bigint("lead_id", { mode: "number" }),
  campaignId: bigint("campaign_id", { mode: "number" }),
  accountName: text("account_name"),
  campaignName: text("campaign_name"),
  leadName: text("lead_name"),
  agentName: text("agent_name"),
  // New fields per database schema
  responseTimeMinutes: integer("response_time_minutes"),
  conversationThreadId: varchar("conversation_thread_id"),
  sentimentDetected: varchar("sentiment_detected"),
  isManualFollowUp: boolean("is_manual_follow_up"),
  prospectId: integer("prospect_id"),
  isRead: boolean("is_read").default(true),
  isTemplate: boolean("is_template").default(false),
  templateSid: text("template_sid"),
  // The transport that carried this message: phone | whatsapp | sms | website | email | other.
  // Engine-owned (tools/channels.py). NULL on rows the backfill could not classify.
  channel: text("channel"),
}, (t) => [
  index("interactions_leads_id_idx").on(t.leadsId),
  index("interactions_accounts_id_idx").on(t.accountsId),
  index("interactions_created_at_idx").on(t.createdAt),
  index("interactions_prospect_id_idx").on(t.prospectId),
  index("interactions_direction_idx").on(t.direction),
]);

export const insertInteractionsSchema = createInsertSchema(interactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Interactions = typeof interactions.$inferSelect;
export type InsertInteractions = z.infer<typeof insertInteractionsSchema>;

// ─── Voice_Calls ───────────────────────────────────────────────────────────────
// One row per AI voice call, written by the automations engine (CallLogger +
// /voice/live/wrap-up). The transcript stays in Interactions under the same
// conversation_thread_id.

export interface VoiceCallSummaryItem {
  intent: string;
  interest: string | null;
  notes: string | null;
}

export interface VoiceCallSummary {
  name: string | null;
  outcome?: string | null;
  items: VoiceCallSummaryItem[];
}

export const voiceCalls = nocodb.table("Voice_Calls", {
  isTest: boolean("is_test").notNull().default(false),
  id: serial("id").primaryKey(),
  callId: text("call_id").notNull(),
  sessionId: text("session_id"),
  accountsId: integer("accounts_id").notNull(),
  campaignsId: integer("campaigns_id"),
  leadsId: integer("leads_id"),
  language: text("language"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  turnCount: integer("turn_count").notNull().default(0),
  summary: jsonb("summary").$type<VoiceCallSummary>(),
  bookedSlot: text("booked_slot"),
  bookedIso: timestamp("booked_iso", { withTimezone: true }),
  // Added by migrate_add_voice_numbers.py (phone door); declared here so Drizzle knows them.
  dialedNumber: text("dialed_number"),
  callerNumber: text("caller_number"),
  voiceNumbersId: integer("voice_numbers_id"),
  // Added by migrate_add_voice_call_persona_outcome.py; the engine stamps them.
  personaCompany: text("persona_company"),
  personaNiche: text("persona_niche"),
  /** booked | callback | transferred | hung_up | other. Null on rows older than the stamp. */
  outcome: text("outcome"),
  // 'none' | 'transferred' | 'failed' (engine migration migrate_voice_tab.py).
  transferOutcome: text("transfer_outcome").notNull().default("none"),
  // Why the call ended (engine migrate_voice_call_end_reason.py): goodbye |
  // caller_hung_up | silence | time_limit | no_greeting | transferred | lost | abandoned.
  // Null on browser calls and rows from before the column.
  endReason: text("end_reason"),
  // sales_pitch | robocall | abuse when the call was screened out (engine migrate_receptionist_channels.py).
  screenedKind: text("screened_kind"),
  // What the call cost and how fast she answered (engine migrate_add_voice_call_cost.py,
  // specs/call-costs). Phone calls only; null on browser calls and older rows.
  usage: jsonb("usage"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 4 }),
  latencyMs: integer("latency_ms"),
  latencyP90Ms: integer("latency_p90_ms"),
  // Staff tests only (script/add-field.ts): per-turn reply delays, tool latencies and cost for the
  // review screen. {turns:[{i,role,at_s,delay_ms,interrupted}], tools:[{name,at_s,latency_ms}],
  // cost:{total,minutes,ai,recap,telephony,estimate}}. Written by the engine's staff_test.py.
  turnMetrics: jsonb("turn_metrics"),
  // Grok calls only: "telnyx:<recording id>", recorded by Telnyx because xAI keeps
  // no recording (engine xai_recording.py, migrate_add_voice_call_recording_ref.py).
  recordingRef: text("recording_ref"),
  // Grok calls only: when Telnyx started recording (engine migrate_add_voice_call_events.py).
  // The call player times transcript bubbles from it; GPT-Live recordings start at started_at.
  recordingStartedAt: timestamp("recording_started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex("uq_voice_calls_call_id").on(t.callId),
  index("idx_voice_calls_started_at").on(t.startedAt),
]);

export type VoiceCall = typeof voiceCalls.$inferSelect;

// ─── Voice_Call_Events ─────────────────────────────────────────────────────────
// One row per tool call or backend delegation in a voice call, written
// fire-and-forget by the engine (tools/db/voice_call_events.py, switch:
// VOICE_TOOL_LOG). Read-only here: the call transcript shows them as chips.
export const voiceCallEvents = nocodb.table("Voice_Call_Events", {
  id: serial("id").primaryKey(),
  callId: text("call_id").notNull(),
  accountsId: integer("accounts_id"),
  /** 'gpt-live' | 'xai' */
  engine: text("engine").notNull(),
  /** 'delegation' | 'tool' | 'refused' */
  kind: text("kind").notNull(),
  toolName: text("tool_name"),
  /** OpenAI call_id of the tool call, or the backend response id. */
  ref: text("ref"),
  args: jsonb("args"),
  result: jsonb("result"),
  status: text("status"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_voice_call_events_call_id").on(t.callId),
]);

export type VoiceCallEvent = typeof voiceCallEvents.$inferSelect;

// ─── Voice_Numbers ─────────────────────────────────────────────────────────────
// One row per phone number the voice receptionist answers. Created and owned by
// the Python engine (scripts/migrate_add_voice_numbers.py); the Account Voice tab
// attaches rows to an account and mirrors agent_name/voice/locale/transfer_number
// onto them (specs/voice-tab). created_at/updated_at are timestamp WITHOUT time
// zone, as the engine created them.
export const voiceNumbers = nocodb.table("Voice_Numbers", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  label: text("label"),
  accountsId: integer("accounts_id"),
  campaignsId: integer("campaigns_id"),
  // Niche_Vocabulary.niche. NULL = demo line. Fallback when personaId is null.
  clientNiche: text("client_niche"),
  locale: text("locale").notNull().default("nl"),
  agentName: text("agent_name"),
  voice: text("voice"),
  aiDisclosure: text("ai_disclosure").notNull().default("on"),
  transferNumber: text("transfer_number"),
  enabled: boolean("enabled").notNull().default(true),
  costOwner: text("cost_owner").notNull().default("client"),
  telnyxPhoneNumberId: text("telnyx_phone_number_id"),
  telnyxRequirementGroupId: text("telnyx_requirement_group_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Niche_Vocabulary.id of the live persona (migrate_voice_tab.py).
  personaId: integer("persona_id"),
  // Accounts.id whose Cal.diy diary this line books in; NULL = the line's own
  // (migrate_add_voice_number_purpose.py in the automations repo).
  diaryAccountsId: integer("diary_accounts_id"),
  // Line purpose (client | demo | test) and, on demo/test lines only, the ElevenLabs pick;
  // engine NULL = GPT Live (migrate_add_voice_number_purpose.py in the automations repo).
  purpose: text("purpose").notNull().default("client"),
  engine: text("engine"),
  engineVoice: text("engine_voice"),
  engineModel: text("engine_model"),
  // The reasoning model behind each engine's voice: "sol" | "terra" | "luna", NULL = Sol (llm_choice.py
  // in the automations repo). Engine-owned table, so added to Postgres by hand, not by add-field.ts.
  liveLlm: text("live_llm"),
  elevenLlm: text("eleven_llm"),
});

export type VoiceNumber = typeof voiceNumbers.$inferSelect;

// ─── Leads ───────────────────────────────────────────────────────────────

export const leads = nocodb.table("Leads", {
  isTest: boolean("is_test").notNull().default(false),
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  firstName: text("first_name"),
  accountsId: integer("Accounts_id"),
  lastName: text("last_name"),
  campaignsId: integer("Campaigns_id"),
  phone: varchar("phone"),
  email: varchar("Email"),
  conversionStatus: text("Conversion_Status"),
  source: text("Source"),
  lastInteractionAt: date("last_interaction_at"),
  notes: text("notes"),
  bookedCallDate: timestamp("booked_call_date", { withTimezone: true }),
  automationStatus: text("automation_status"),
  lastMessageSentAt: timestamp("last_message_sent_at", { withTimezone: true }),
  lastMessageReceivedAt: timestamp("last_message_received_at", { withTimezone: true }),
  messageCountSent: bigint("message_count_sent", { mode: "number" }),
  messageCountReceived: bigint("message_count_received", { mode: "number" }),
  aiMemory: json("ai_memory"),
  bump1SentAt: timestamp("bump_1_sent_at", { withTimezone: true }),
  bump2SentAt: timestamp("bump_2_sent_at", { withTimezone: true }),
  bump3SentAt: timestamp("bump_3_sent_at", { withTimezone: true }),
  bump4SentAt: timestamp("bump_4_sent_at", { withTimezone: true }),
  firstMessageSentAt: timestamp("first_message_sent_at", { withTimezone: true }),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  currentBumpStage: bigint("current_bump_stage", { mode: "number" }),
  // Set when the lead named a booking day but hasn't confirmed a time yet;
  // JSON string {day, offered_slots, timezone, saved_at}. Cleared on booking,
  // after one booking-nudge bump, or when older than 7 days. See
  // bump-system-overhaul design spec, item 6.
  pendingBookingContext: text("pending_booking_context"),
  optedOut: boolean("opted_out"),
  aiSentiment: text("ai_sentiment"),
  aiSummary: text("ai_summary"),
  teamMembers: text("team_members"),
  manualTakeover: boolean("manual_takeover"),
  handoffReason: text("handoff_reason"),
  // One-line summary of this lead's chats, read by the voice AI (engine migrate_receptionist_channels.py).
  chatMemorySummary: text("chat_memory_summary"),
  chatMemorySummaryAt: timestamp("chat_memory_summary_at", { withTimezone: true }),
  dncReason: text("dnc_reason"),
  priority: text("priority"),
  language: text("language"),
  timeZone: text("time_zone"),
  bookingConfirmedAt: timestamp("booking_confirmed_at_", { withTimezone: true }),
  textCol: text("Text"),
  bookingConfirmationSent: boolean("booking_confirmation_sent"),
  noShow: boolean("no_show"),
  noShowReason: text("no_show_reason"),
  noShowReportedAt: timestamp("no_show_reported_at", { withTimezone: true }),
  noShowReportedBy: bigint("no_show_reported_by", { mode: "number" }),
  noShowFollowupStage: integer("no_show_followup_stage"),
  previousBookedCallDate: timestamp("previous_booked_call_date", { withTimezone: true }),
  reScheduledCount: bigint("re_scheduled_count", { mode: "number" }),
  calcomBookingUid: text("calcom_booking_uid"),
  // A second appointment of the other kind beside the one above (a callback
  // next to a showroom visit). Reminders and no-shows stay on the main one.
  sideBookingUid: text("side_booking_uid"),
  sideBookingDate: timestamp("side_booking_date", { withTimezone: true }),
  sideBookingKind: text("side_booking_kind"),
  // The number the caller asked to be called back on, when it is not the one they called from.
  callbackPhone: varchar("callback_phone"),
  billableBooking: boolean("billable_booking"),
  bookingCancelledAt: timestamp("booking_cancelled_at", { withTimezone: true }),
  clientCancelledBooking: boolean("client_cancelled_booking").default(false),
  bookingReminderSentAt: timestamp("booking_reminder_sent_at", { withTimezone: true }),
  bookingReminder24hSentAt: timestamp("booking_reminder_24h_sent_at", { withTimezone: true }),
  bookingReminder1hSentAt: timestamp("booking_reminder_1h_sent_at", { withTimezone: true }),
  bookedAt: timestamp("booked_at", { withTimezone: true }),
  callDurationMinutes: integer("call_duration_minutes"),
  whatHasTheLeadDone: text("what_has_the_lead_done"),
  // Free-text specifics for this lead, imported with the list. In decision mode
  // this is the quote detail the AI can reference by name; in scoping mode it
  // pre-fills ladder slots so the AI skips them. Distinct from
  // whatHasTheLeadDone, which is a constrained dropdown feeding the stage
  // classifier and must never carry free text.
  leadContext: text("lead_context"),
  // Browser demo (/demo/<token>) lifetime restart counter. Survives the
  // interaction wipe a restart performs, which is what actually caps the cost
  // of a demo link that ends up somewhere public.
  demoRestarts: integer("demo_restarts").default(0),
  // True when this demo lead came from a link Gabriel minted (the CRM Share
  // dialog or /api/demo/create-link), false for a public homepage session.
  // The two are otherwise indistinguishable: both carry Source='WhatsApp Demo'
  // and a wa-demo:<hex> channel_identifier. Anything offered only to an invited
  // prospect (restarting as a different scenario, above all) has to gate on
  // this, because a public visitor being offered a restart menu is a stranger
  // being handed the controls.
  demoInvited: boolean("demo_invited").default(false),
  when: text("when"),
  accountId: bigint("account_id", { mode: "number" }),
  campaignId: bigint("campaign_id", { mode: "number" }),
  accountName: text("account_name"),
  campaignName: text("campaign_name"),
  text2: text("Text_2"),
  leadScore: integer("lead_score"),
  engagementScore: integer("engagement_score"),
  activityScore: integer("activity_score"),
  channelIdentifier: text("channel_identifier"),
  aiNotes: text("ai_notes"),
  aiNotesGeneratedAt: timestamp("ai_notes_generated_at", { withTimezone: true }),
  abVariant: text("ab_variant"),
  demoNiche: text("demo_niche"),
  // Demo link revoke marker (script/create-demos-redesign-columns.mjs). Set by
  // the CRM on both rows of a token when the link is re-minted or deleted;
  // every token lookup (CRM and engine) treats a set value as an expired link.
  demoRevokedAt: timestamp("demo_revoked_at", { withTimezone: true }),
  // Reputation: when the customer's service was completed (entry trigger),
  // and when the feedback ask was sent (idempotency gate).
  serviceCompletedAt: timestamp("service_completed_at", { withTimezone: true }),
  reviewRequestSentAt: timestamp("review_request_sent_at", { withTimezone: true }),
  // Reputation conversation: the 1-5 rating the customer gave, and where the
  // conversation landed (link_sent | callback_requested | declined).
  reviewRating: integer("review_rating"),
  reviewOutcome: text("review_outcome"),
  // HubSpot contact pushed from the Voice calls Callers view, so a re-push
  // updates the same contact (scripts/migrate-leads-hubspot-contact-id.mjs).
  hubspotContactId: text("hubspot_contact_id"),
  // When the lead was last pushed: a re-push only notes calls after it.
  hubspotPushedAt: timestamp("hubspot_pushed_at", { withTimezone: true }),
  // The transport this lead is actually reachable on ('whatsapp' | 'sms'),
  // written by the Python engine: after a WhatsApp-undeliverable fallback send
  // succeeds on SMS, and on every Twilio inbound (the channel they replied on).
  // NULL means "use the campaign's channel". Engine-owned: the CRM never writes it.
  resolvedChannel: text("resolved_channel"),
  // The channel that made the current booking: phone | whatsapp | sms | website | booking_page.
  // Engine-owned. Kept on a rebook through the link.
  bookingChannel: text("booking_channel"),
}, (t) => [
  index("leads_accounts_id_idx").on(t.accountsId),
  index("leads_campaigns_id_idx").on(t.campaignsId),
  index("leads_conversion_status_idx").on(t.conversionStatus),
]);

export const insertLeadsSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Leads = typeof leads.$inferSelect;
export type InsertLeads = z.infer<typeof insertLeadsSchema>;


// ─── Leads_Tags ───────────────────────────────────────────────────────────────

export const leadsTags = nocodb.table("Leads_Tags", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  ncOrder: numeric("nc_order"),
  workflow: text("workflow"),
  leadsId: integer("Leads_id"),
  tagsId: integer("Tags_id"),
  createdBy: varchar("created_by"),
  workflowStep: text("workflow_step"),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedBy: text("removed_by"),
  notes: text("notes"),
  appliedBy: text("applied_by"),
  leadId: bigint("lead_id", { mode: "number" }),
  tagId: bigint("tag_id", { mode: "number" }),
  accountId: bigint("account_id", { mode: "number" }),
  leadName: text("lead_name"),
  accountName: text("account_name"),
  tagName: text("tag_name"),
}, (t) => [
  index("leads_tags_leads_id_idx").on(t.leadsId),
  index("leads_tags_tags_id_idx").on(t.tagsId),
]);

export const insertLeads_TagsSchema = createInsertSchema(leadsTags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  ncOrder: true,
});
export type Leads_Tags = typeof leadsTags.$inferSelect;
export type InsertLeads_Tags = z.infer<typeof insertLeads_TagsSchema>;


// ─── Prompt_Library ───────────────────────────────────────────────────────────────

export const promptLibrary = nocodb.table("Prompt_Library", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  name: text("name"),
  accountsId: integer("Accounts_id"),
  campaignsId: integer("Campaigns_id"),
  version: text("version"),
  promptText: text("prompt_text"),
  useCase: text("use_case"),
  model: text("model"),
  temperature: numeric("temperature"),
  maxTokens: bigint("max_tokens", { mode: "number" }),
  systemMessage: text("system_message"),
  status: text("status"),
  performanceScore: text("performance_score"),
  notes: text("notes"),
  abVariant: text("ab_variant"),
  firstMessage: text("first_message"),
  // Prompt Library tab: chat | voice | crm | social | test | reputation.
  category: text("category"),
  // Serves a demo (demo campaigns, demo voice lines); the library can hide these.
  isDemo: boolean("is_demo"),
}, (t) => [
  index("prompt_library_accounts_id_idx").on(t.accountsId),
]);

export const insertPrompt_LibrarySchema = createInsertSchema(promptLibrary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Prompt_Library = typeof promptLibrary.$inferSelect;
export type InsertPrompt_Library = z.infer<typeof insertPrompt_LibrarySchema>;


// ─── Prompt_Versions ──────────────────────────────────────────────────────────

export const promptVersions = nocodb.table("Prompt_Versions", {
  id: integer("id"),
  promptsId: integer("prompts_id"),
  versionNumber: text("version_number"),
  promptText: text("prompt_text"),
  systemMessage: text("system_message"),
  notes: text("notes"),
  label: text("label"),
  savedAt: timestamp("saved_at", { withTimezone: true }),
  savedBy: varchar("saved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }),
}, (t) => [
  index("pv_prompts_id_idx").on(t.promptsId),
]);

export const insertPromptVersionsSchema = createInsertSchema(promptVersions).omit({
  id: true,
  createdAt: true,
});
export type Prompt_Version = typeof promptVersions.$inferSelect;
export type InsertPrompt_Version = z.infer<typeof insertPromptVersionsSchema>;


// ─── Tags ───────────────────────────────────────────────────────────────

export const tags = nocodb.table("Tags", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  name: text("name"),
  slug: text("slug"),
  color: text("color"),
  category: text("category"),
  description: text("description"),
  autoApplied: boolean("auto_applied"),
  accountId: bigint("account_id", { mode: "number" }),
  accountsId: integer("Accounts_id"),
  accountName: text("account_name"),
  campaignId: integer("campaign_id"),
  campaignName: text("campaign_name"),
}, (t) => [
  index("tags_accounts_id_idx").on(t.accountsId),
]);

export const insertTagsSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Tags = typeof tags.$inferSelect;
export type InsertTags = z.infer<typeof insertTagsSchema>;


// ─── Users ───────────────────────────────────────────────────────────────

export const users = nocodb.table("Users", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  fullName1: text("full_name_1"),
  phone: varchar("phone"),
  timezone: text("timezone"),
  role: text("role"),
  status: text("status"),
  avatarUrl: text("avatar_url"),
  n8nWebhookUrl: text("n8n_webhook_url"),
  notificationEmail: boolean("notification_email"),
  notificationSms: boolean("notification_sms"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  accountsId: integer("Accounts_id"),
  email: varchar("email"),
  passwordHash: text("password_hash"),
  preferences: varchar("preferences"),
  encryptedClaudeApiKey: text("encrypted_claude_api_key"),
  // Two-factor authentication (specs/two-factor-auth). The secret is AES-GCM encrypted; never return it.
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  totpLastStep: integer("totp_last_step"),
  email2faEnabledAt: timestamp("email_2fa_enabled_at", { withTimezone: true }),
  twoFactorRequiredSince: timestamp("two_factor_required_since", { withTimezone: true }),
}, (t) => [
  index("users_email_idx").on(t.email),
]);

export const insertUsersSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Users = typeof users.$inferSelect;
export type InsertUsers = z.infer<typeof insertUsersSchema>;


// ─── Lead_Score_History ───────────────────────────────────────────────────────────────

export const leadScoreHistory = nocodb.table("Lead_Score_History", {
  id: integer("id"),
  leadsId: integer("leads_id"),
  scoreDate: date("score_date"),
  leadScore: integer("lead_score"),
  engagementScore: integer("engagement_score"),
  activityScore: integer("activity_score"),
  conversionStatus: varchar("conversion_status"),
  createdAt: timestamp("created_at", { withTimezone: true }),
}, (t) => [
  index("lsh_leads_id_idx").on(t.leadsId),
]);

export const insertLeadScoreHistorySchema = createInsertSchema(leadScoreHistory).omit({
  id: true,
  createdAt: true,
});
export type Lead_Score_History = typeof leadScoreHistory.$inferSelect;
export type InsertLead_Score_History = z.infer<typeof insertLeadScoreHistorySchema>;


// ─── Campaign_Metrics_History ───────────────────────────────────────────────────────────────

export const campaignMetricsHistory = nocodb.table("Campaign_Metrics_History", {
  id: integer("id"),
  campaignsId: integer("campaigns_id"),
  metricDate: date("metric_date"),
  totalLeadsTargeted: integer("total_leads_targeted"),
  totalMessagesSent: integer("total_messages_sent"),
  totalResponsesReceived: integer("total_responses_received"),
  responseRatePercent: numeric("response_rate_percent"),
  bookingsGenerated: integer("bookings_generated"),
  bookingRatePercent: numeric("booking_rate_percent"),
  totalCost: numeric("total_cost"),
  costPerLead: numeric("cost_per_lead"),
  costPerBooking: numeric("cost_per_booking"),
  roiPercent: numeric("roi_percent"),
  createdAt: timestamp("created_at", { withTimezone: true }),
}, (t) => [
  index("cmh_campaigns_id_idx").on(t.campaignsId),
  index("cmh_metric_date_idx").on(t.metricDate),
]);

export const insertCampaignMetricsHistorySchema = createInsertSchema(campaignMetricsHistory).omit({
  id: true,
  createdAt: true,
});
export type Campaign_Metrics_History = typeof campaignMetricsHistory.$inferSelect;
export type InsertCampaign_Metrics_History = z.infer<typeof insertCampaignMetricsHistorySchema>;


// ─── Invoices ───────────────────────────────────────────────────────────────

export const invoices = nocodb.table("Invoices", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  accountsId: integer("Accounts_id"),
  invoiceNumber: varchar("invoice_number"),
  title: text("title"),
  status: text("status"),
  currency: varchar("currency"),
  subtotal: numeric("subtotal"),
  taxPercent: numeric("tax_percent"),
  taxAmount: numeric("tax_amount"),
  discountAmount: numeric("discount_amount"),
  total: numeric("total"),
  lineItems: json("line_items"),
  notes: text("notes"),
  paymentInfo: text("payment_info"),
  issuedDate: date("issued_date"),
  dueDate: date("due_date"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  viewedCount: integer("viewed_count"),
  viewToken: varchar("view_token"),
  accountName: text("account_name"),
}, (t) => [
  index("invoices_accounts_id_idx").on(t.accountsId),
  index("invoices_status_idx").on(t.status),
  index("invoices_view_token_idx").on(t.viewToken),
]);

export const insertInvoicesSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Invoices = typeof invoices.$inferSelect;
export type InsertInvoices = z.infer<typeof insertInvoicesSchema>;


// ─── Contracts ───────────────────────────────────────────────────────────────

export const contracts = nocodb.table("Contracts", {
  id: integer("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  accountsId: integer("Accounts_id"),
  title: text("title"),
  status: text("status"),
  description: text("description"),
  fileData: text("file_data"),
  fileName: varchar("file_name"),
  fileSize: integer("file_size"),
  fileType: varchar("file_type"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  viewedCount: integer("viewed_count"),
  viewToken: varchar("view_token"),
  accountName: text("account_name"),
  dealType:            text("deal_type"),
  paymentTrigger:      text("payment_trigger"),
  valuePerBooking:     numeric("value_per_booking"),
  fixedFeeAmount:      numeric("fixed_fee_amount"),
  depositAmount:       numeric("deposit_amount"),
  monthlyFee:          numeric("monthly_fee"),
  costPassthroughRate: numeric("cost_passthrough_rate"),
  campaignsId:         integer("campaigns_id"),
  currency:            text("currency"),
  language:            text("language"),
  timezone:            text("timezone"),
  invoiceCadence:      text("invoice_cadence"),
  paymentPreset:       text("payment_preset"),
  contractText:        text("contract_text"),
  signerName:          text("signer_name"),
}, (t) => [
  index("contracts_accounts_id_idx").on(t.accountsId),
  index("contracts_view_token_idx").on(t.viewToken),
]);

export const insertContractsSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type Contracts = typeof contracts.$inferSelect;
export type InsertContracts = z.infer<typeof insertContractsSchema>;


// ── Expenses ──────────────────────────────────────────────────────────────────

export const expenses = nocodb.table("Expenses", {
  id: serial("id").primaryKey(),
  date: date("date"),
  year: integer("year"),
  quarter: varchar("quarter", { length: 2 }),
  supplier: varchar("supplier", { length: 200 }),
  country: varchar("country", { length: 2 }),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  description: text("description"),
  currency: varchar("currency", { length: 3 }),
  amountExclVat: numeric("amount_excl_vat"),
  vatRatePct: numeric("vat_rate_pct"),
  vatAmount: numeric("vat_amount"),
  totalAmount: numeric("total_amount"),
  nlBtwDeductible: boolean("nl_btw_deductible").default(false),
  notes: text("notes"),
  pdfPath: varchar("pdf_path", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertExpensesSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Expenses = typeof expenses.$inferSelect;
export type InsertExpenses = z.infer<typeof insertExpensesSchema>;


// ─── Notifications ──────────────────────────────────────────────────────────

export const notifications = nocodb.table("Notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "message" | "takeover" | "booking" | "campaign" | "task" | "system"
  title: text("title").notNull(),
  body: text("body"),
  leadId: integer("lead_id"),
  userId: integer("user_id").notNull(), // recipient
  accountId: integer("account_id"),
  read: boolean("read").notNull().default(false),
  link: text("link"), // URL path to navigate to
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("notifications_user_id_idx").on(t.userId),
  index("notifications_account_id_idx").on(t.accountId),
  index("notifications_created_at_idx").on(t.createdAt),
  index("notifications_read_idx").on(t.read),
]);

export const insertNotificationsSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type Notifications = typeof notifications.$inferSelect;
export type InsertNotifications = z.infer<typeof insertNotificationsSchema>;


// ─── Notification Preferences ───────────────────────────────────────────────

export const notificationPreferences = nocodb.table("Notification_Preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountId: integer("account_id").notNull(),
  telegramEnabled: boolean("telegram_enabled").notNull().default(true),
  webPushEnabled: boolean("web_push_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(false), // opt-in: no email notifications unless the user turns them on
  telegramChatId: text("telegram_chat_id"),
  typeOverrides: json("type_overrides").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;

// ─── Push Subscriptions ─────────────────────────────────────────────────────

export const pushSubscriptions = nocodb.table("Push_Subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountId: integer("account_id").notNull(),
  endpoint: text("endpoint").notNull(),
  subscription: json("subscription").notNull(), // Full PushSubscription JSON
  deviceLabel: text("device_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertPushSubscriptionsSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionsSchema>;

// ─── Support Chat ───────────────────────────────────────────────────────────

export const supportSessions = nocodb.table("Support_Sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: integer("user_id").notNull(),
  accountId: integer("account_id"),
  channel: text("channel").notNull().default("bot"), // "bot" | "founder"
  status: text("status").notNull().default("active"), // "active" | "escalated" | "closed"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (t) => [
  index("support_sessions_user_id_idx").on(t.userId),
  index("support_sessions_session_id_idx").on(t.sessionId),
]);

export const insertSupportSessionSchema = createInsertSchema(supportSessions).omit({
  id: true,
  createdAt: true,
});
export type SupportSession = typeof supportSessions.$inferSelect;
export type InsertSupportSession = z.infer<typeof insertSupportSessionSchema>;

export const supportMessages = nocodb.table("Support_Messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id").notNull(),
  accountId: integer("account_id"),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("support_messages_session_id_idx").on(t.sessionId),
  index("support_messages_created_at_idx").on(t.createdAt),
]);

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
});
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;


// ─── Tasks ──────────────────────────────────────────────────────────────────

export const tasks = nocodb.table("Tasks", {
  id: serial("id").primaryKey(),
  accountsId: integer("Accounts_id").notNull().references(() => accounts.id),
  campaignsId: integer("Campaigns_id").references(() => campaigns.id),
  leadsId: integer("Leads_id").references(() => leads.id),
  assignedToUserId: integer("assigned_to_user_id").references(() => users.id),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // "todo" | "in_progress" | "waiting" | "done" | "cancelled"
  priority: text("priority").notNull().default("medium"), // "low" | "medium" | "high" | "urgent"
  taskType: text("task_type").notNull().default("admin"), // "follow_up" | "call" | "review" | "admin" | "custom"
  dueDate: timestamp("due_date", { withTimezone: true }),
  startDate: timestamp("start_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  reminderAt: timestamp("reminder_at", { withTimezone: true }),
  accountName: text("account_name"),
  campaignName: text("campaign_name"),
  leadName: text("lead_name"),
  assigneeName: text("assignee_name"),
  categoryId: integer("category_id").references(() => taskCategories.id, { onDelete: "set null" }),
  parentTaskId: integer("parent_task_id").references((): any => tasks.id, { onDelete: "set null" }),
  emoji: text("emoji"),
  timeEstimate: integer("time_estimate"), // minutes
  tags: text("tags"), // JSON string array e.g. '["Frontend","Bug"]'
  isArchived: boolean("is_archived").notNull().default(false),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringPeriod: text("recurring_period"), // "daily" | "weekly" | "biweekly" | "monthly"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("tasks_account_id_idx").on(t.accountsId),
  index("tasks_assignee_idx").on(t.assignedToUserId),
  index("tasks_status_idx").on(t.status),
  index("tasks_due_date_idx").on(t.dueDate),
  index("tasks_category_id_idx").on(t.categoryId),
  index("tasks_parent_task_id_idx").on(t.parentTaskId),
  index("tasks_is_archived_idx").on(t.isArchived),
]);

export const insertTaskSchema = createInsertSchema(tasks, {
  // JSON body-parser sends dates as ISO strings — coerce back to Date
  dueDate: z.coerce.date().nullish(),
  startDate: z.coerce.date().nullish(),
  completedAt: z.coerce.date().nullish(),
  reminderAt: z.coerce.date().nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// ─── Task Categories ────────────────────────────────────────────────────────

export const taskCategories = nocodb.table("Task_Categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertTaskCategorySchema = createInsertSchema(taskCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TaskCategory = typeof taskCategories.$inferSelect;
export type InsertTaskCategory = z.infer<typeof insertTaskCategorySchema>;


// ─── Task Subtasks ──────────────────────────────────────────────────────────

export const taskSubtasks = nocodb.table("Task_Subtasks", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("task_subtasks_task_id_idx").on(t.taskId),
]);

export const insertTaskSubtaskSchema = createInsertSchema(taskSubtasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TaskSubtask = typeof taskSubtasks.$inferSelect;
export type InsertTaskSubtask = z.infer<typeof insertTaskSubtaskSchema>;


// ─── Task Comments ───────────────────────────────────────────────────────────
export const taskComments = nocodb.table("Task_Comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: integer("user_id"),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("task_comments_task_id_idx").on(t.taskId),
]);

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({ id: true, createdAt: true });
export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;

// ─── Task Activity ───────────────────────────────────────────────────────────
export const taskActivity = nocodb.table("Task_Activity", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  actorUserId: integer("actor_user_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  field: text("field"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("task_activity_task_id_idx").on(t.taskId),
]);

export const insertTaskActivitySchema = createInsertSchema(taskActivity).omit({ id: true, createdAt: true });
export type TaskActivity = typeof taskActivity.$inferSelect;
export type InsertTaskActivity = z.infer<typeof insertTaskActivitySchema>;

// ─── Task Attachments ────────────────────────────────────────────────────────
export const taskAttachments = nocodb.table("Task_Attachments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("task_attachments_task_id_idx").on(t.taskId),
]);

export const insertTaskAttachmentSchema = createInsertSchema(taskAttachments).omit({ id: true, createdAt: true });
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;


// ─── AI Agents ──────────────────────────────────────────────────────────────

export const aiAgents = nocodb.table("AI_Agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("custom"), // 'code_runner' | 'custom'
  systemPrompt: text("system_prompt"),
  photoUrl: text("photo_url"),
  config: text("config"), // JSON string for extra config
  enabled: boolean("enabled").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  thinkingLevel: text("thinking_level").notNull().default("medium"),
  permissions: json("permissions").default({}),
  pageAwarenessEnabled: boolean("page_awareness_enabled").notNull().default(true),
  systemPromptId: integer("system_prompt_id"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({ id: true, createdAt: true });
export type AiAgent = typeof aiAgents.$inferSelect;
export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;

export const aiSessions = nocodb.table("AI_Sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: integer("user_id").notNull(),
  agentId: integer("agent_id").notNull(),
  title: text("title"),
  cliSessionId: text("cli_session_id"), // unused for now, kept for future --resume support
  status: text("status").notNull().default("active"), // 'active' | 'closed'
  model: text("model"),
  thinkingLevel: text("thinking_level"),
  totalInputTokens: integer("total_input_tokens").notNull().default(0),
  totalOutputTokens: integer("total_output_tokens").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("ai_sessions_user_id_idx").on(t.userId),
  index("ai_sessions_agent_id_idx").on(t.agentId),
  index("ai_sessions_session_id_idx").on(t.sessionId),
]);

export const insertAiSessionSchema = createInsertSchema(aiSessions).omit({ id: true, createdAt: true });
export type AiSession = typeof aiSessions.$inferSelect;
export type InsertAiSession = z.infer<typeof insertAiSessionSchema>;

export const aiMessages = nocodb.table("AI_Messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  subAgentBlocks: text("sub_agent_blocks"), // JSON array of {name, content}
  metadata: json("metadata"),
  attachments: json("attachments"),
  pageContext: json("page_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("ai_messages_session_id_idx").on(t.sessionId),
  index("ai_messages_created_at_idx").on(t.createdAt),
]);

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({ id: true, createdAt: true });
export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;

// ─── AI Files ───────────────────────────────────────────────────────────────

export const aiFiles = nocodb.table("AI_Files", {
  id: serial("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  messageId: integer("message_id"),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  transcription: text("transcription"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("ai_files_conversation_id_idx").on(t.conversationId),
  index("ai_files_message_id_idx").on(t.messageId),
]);

export const insertAiFileSchema = createInsertSchema(aiFiles).omit({ id: true, createdAt: true });
export type AiFile = typeof aiFiles.$inferSelect;
export type InsertAiFile = z.infer<typeof insertAiFileSchema>;

// ─── Gmail Sync State ────────────────────────────────────────────────────────

export const gmailSyncState = nocodb.table("Gmail_Sync_State", {
  id: serial("id").primaryKey(),
  accountEmail: varchar("account_email", { length: 255 }).notNull(),
  lastHistoryId: varchar("last_history_id", { length: 100 }),
  lastFullSyncAt: timestamp("last_full_sync_at", { withTimezone: true }),
  oauthTokensEncrypted: text("oauth_tokens_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("gmail_sync_state_account_email_idx").on(t.accountEmail),
]);

export const insertGmailSyncStateSchema = createInsertSchema(gmailSyncState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GmailSyncState = typeof gmailSyncState.$inferSelect;
export type InsertGmailSyncState = z.infer<typeof insertGmailSyncStateSchema>;

// ─── Calendar Connections ─────────────────────────────────────────────────────
// Per-account external calendar integration. One row per (account, provider).
// Providers: google | outlook (OAuth) · calcom | calendly (API key) · ical (read-only URL).
// Secrets are stored encrypted (AES-256-GCM, see server/calendar/crypto.ts); never
// expose oauthTokensEncrypted / apiKeyEncrypted to the client.

export const calendarConnections = nocodb.table("Calendar_Connections", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  provider: text("provider").notNull(), // google | outlook | calcom | calendly | ical
  status: text("status").default("connected"), // connected | error | disconnected
  // Human-readable identity of the connected calendar (email / username / feed name).
  displayName: text("display_name"),
  calendarId: text("calendar_id"),       // primary calendar id used for event writes
  externalId: text("external_id"),       // calendly user uri / cal.com username, etc.
  timezone: text("timezone"),
  // Secret material (only the field(s) relevant to the provider are set).
  oauthTokensEncrypted: text("oauth_tokens_encrypted"), // google / outlook
  apiKeyEncrypted: text("api_key_encrypted"),           // calcom / calendly · caldiy: login PASSWORD (web UI)
  caldiyApiKeyEncrypted: text("caldiy_api_key_encrypted"), // caldiy: Bearer API key (engine's REST auth)
  // caldiy: the account's default provisioned event type (always slug "30min"
  // today). The self-hosted v2 API has no general event-types lookup endpoint,
  // so the engine can't resolve this by slug at request time — it's captured
  // once at provisioning and reused. Only valid when the campaign's own
  // calendar_link slug matches caldiyEventTypeSlug (see resolve_account_credentials).
  caldiyEventTypeId: integer("caldiy_event_type_id"),
  caldiyEventTypeSlug: text("caldiy_event_type_slug"),
  // caldiy: the account's "visit" event type, when visits are on (provisioning).
  caldiyVisitEventTypeId: integer("caldiy_visit_event_type_id"),
  caldiyVisitEventTypeSlug: text("caldiy_visit_event_type_slug"),
  icalUrl: text("ical_url"),                            // ical read-only feed
  // White-label booking domain (book.clientwebsite.com → Cloudflare Tunnel).
  // Stored on the account's `caldiy` connection row. status: pending | active.
  customDomain: text("custom_domain"),
  customDomainStatus: text("custom_domain_status"),     // pending | active
  lastError: text("last_error"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("calendar_connections_account_id_idx").on(t.accountId),
  uniqueIndex("calendar_connections_account_provider_idx").on(t.accountId, t.provider),
]);

export const insertCalendarConnectionSchema = createInsertSchema(calendarConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type InsertCalendarConnection = z.infer<typeof insertCalendarConnectionSchema>;

// ─── Account Stock Cars ───────────────────────────────────────────────────────
// Written by the Python engine's hourly stock_sync (automations/src/automations/
// stock_sync.py): one row per car a dealer's stock feed listed. `data` is the
// parsed car page (spec table, technical info, options, description), `rdw` the
// RDW open-data record. The phone line's car_details tool reads it.
// sold_suspected_at: RDW ownership change after first_seen (probably sold).

export const accountStockCars = nocodb.table("Account_Stock_Cars", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  kenteken: text("kenteken"),
  data: jsonb("data").notNull().default({}),
  rdw: jsonb("rdw"),
  rdwCheckedAt: timestamp("rdw_checked_at", { withTimezone: true }),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  soldSuspectedAt: timestamp("sold_suspected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("account_stock_cars_accounts_id_idx").on(t.accountsId),
  uniqueIndex("account_stock_cars_account_url_idx").on(t.accountsId, t.url),
]);
export type AccountStockCar = typeof accountStockCars.$inferSelect;

// ─── Account Reviews ──────────────────────────────────────────────────────────
// Reputation v2 — public reviews fetched from Google Business Profile and the
// AI-drafted / human-approved replies posted back. See specs/reputation-reviews.
// One row per (account, external review id); status drives the approval workflow.

export const accountReviews = nocodb.table("Account_Reviews", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  platform: text("platform").default("google"),      // google (trustpilot/facebook later)
  externalReviewId: text("external_review_id"),       // provider review id; unique per account
  authorName: text("author_name"),
  rating: integer("rating"),                          // 1–5 stars
  reviewText: text("review_text"),
  reviewCreatedAt: timestamp("review_created_at", { withTimezone: true }),
  status: text("status").default("new"),              // new | drafted | approved | posted | skipped
  draftReply: text("draft_reply"),
  postedReply: text("posted_reply"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  language: text("language"),                          // en | nl (matches the review)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("account_reviews_accounts_id_idx").on(t.accountsId),
  uniqueIndex("account_reviews_account_external_idx").on(t.accountsId, t.externalReviewId),
]);

export const insertAccountReviewSchema = createInsertSchema(accountReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AccountReview = typeof accountReviews.$inferSelect;
export type InsertAccountReview = z.infer<typeof insertAccountReviewSchema>;

// ─── Calendar Blocks ──────────────────────────────────────────────────────────
// Manual busy blocks entered on the LeadAwaker Calendar page. They layer on top
// of connected-calendar events: a slot is bookable only if it is inside working
// hours AND not covered by a calendar event AND not covered by a manual block.
// See specs/calendar-manual-blocks/.

export const calendarBlocks = nocodb.table("Calendar_Blocks", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").default(false).notNull(),
  label: text("label"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("calendar_blocks_account_starts_idx").on(t.accountId, t.startsAt),
]);

export const insertCalendarBlockSchema = createInsertSchema(calendarBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CalendarBlock = typeof calendarBlocks.$inferSelect;
export type InsertCalendarBlock = z.infer<typeof insertCalendarBlockSchema>;

// ─── Opener Templates ─────────────────────────────────────────────────────────
// The "First Message" opener archetypes shown in the campaign settings
// template picker. One shared global library (not per-account) — English and
// Dutch copy are separate columns so each language can be edited independently.

export const openerTemplates = nocodb.table("Opener_Templates", {
  id: text("id").primaryKey(), // "A".."L"
  sortOrder: integer("sort_order").notNull(),
  // Which conversation type this archetype is written for: "scoping" (no quote
  // yet), "decision" (a quote is on the table), or "both". The picker filters
  // to the type being edited, so a "your quote is still open" opener is never
  // offered for a lead who was never quoted. Same tokens the engine branches on
  // (derive_conversation_mode), not a third vocabulary.
  type: text("type").notNull().default("both"),
  titleEn: text("title_en").notNull(),
  titleNl: text("title_nl").notNull(),
  bodyEn: text("body_en").notNull(),
  bodyNl: text("body_nl").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertOpenerTemplateSchema = createInsertSchema(openerTemplates).omit({
  updatedAt: true,
});
export type OpenerTemplateRow = typeof openerTemplates.$inferSelect;
export type InsertOpenerTemplate = z.infer<typeof insertOpenerTemplateSchema>;

// ─── Website Chat Widget ──────────────────────────────────────────────────────
// One row per installed widget: the public key a client pastes into their site,
// bound to exactly one account + one campaign. See specs/website-widget/.
//
// The key is PUBLIC by design (it ships in the page source of every visitor).
// Security is the domain allowlist plus the caps below, never key secrecy.

export const widgetConfigs = nocodb.table("Widget_Configs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  accountsId: integer("Accounts_id").notNull(),
  // The campaign whose prompt, knowledge base and calendar answer this widget.
  campaignsId: integer("Campaigns_id"),
  publicKey: text("public_key").notNull(),
  name: text("name"),
  enabled: boolean("enabled").default(true),
  // Hostnames allowed to frame the widget, e.g. ["example.com","www.example.com"].
  // Empty = the widget refuses to run anywhere, which is the safe default for a
  // freshly minted key rather than a wildcard.
  allowedDomains: jsonb("allowed_domains").$type<string[]>().default([]),
  greeting: text("greeting"),
  accentColor: text("accent_color").default("#6B2737"),
  // The assistant's orb face. 'metal' ignores accentColor; 'tinted' swirls it,
  // 'solid' paints it flat. Eyes 'auto' pick whatever reads on the orb.
  orbStyle: text("orb_style").default("metal"),   // 'metal' | 'tinted' | 'solid' | gradient: 'sunset' | 'aurora'
  orbEyes: text("orb_eyes").default("auto"),      // 'auto' | 'black' | 'white'
  orbTint: text("orb_tint"),                       // metal only: '#hex' for gold/copper/..., null = silver
  orbFace: text("orb_face").default("eyes"),      // 'eyes' | 'icon' | 'photo' (photo = avatarUrl)
  orbRim: text("orb_rim").default("band"),        // launcher rim: 'band' (white unless coloured) | 'metal' | 'pulse' | 'none'
  orbRimColor: text("orb_rim_color"),             // pulse/band colour, null = white band / soft grey pulse
  orbShadow: text("orb_shadow").default("shadow"), // launcher: 'shadow' | 'none' | 'glow'
  orbShadowColor: text("orb_shadow_color"),       // null = black shadow / grey glow
  bubbleColor: text("bubble_color"),              // visitor bubbles: null = her colour (near-black when she is metal)
  launcherPosition: text("launcher_position").default("right"),  // 'right' | 'left'
  agentName: text("agent_name"),
  avatarUrl: text("avatar_url"),
  language: text("language").default("en"),
  // Starter chips: up to three {label, text} pairs offered above the composer
  // until the visitor's first message. Null (not []) means "derive the usual
  // three from the language defaults", so an untouched widget still gets them.
  quickReplies: jsonb("quick_replies").$type<{ label: string; text: string }[] | null>(),
  // Cost ceilings on a public endpoint. Per visitor, and per key per day.
  maxTurnsPerVisitor: integer("max_turns_per_visitor").default(30),
  maxMessagesPerDay: integer("max_messages_per_day").default(500),
  messagesToday: integer("messages_today").default(0),
  messagesDay: text("messages_day"),  // YYYY-MM-DD stamp the counter belongs to
}, (t) => [
  uniqueIndex("widget_configs_public_key_idx").on(t.publicKey),
]);

export const insertWidgetConfigSchema = createInsertSchema(widgetConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  messagesToday: true,
  messagesDay: true,
});
export type WidgetConfig = typeof widgetConfigs.$inferSelect;
export type InsertWidgetConfig = z.infer<typeof insertWidgetConfigSchema>;

// ─── Receptionist channels ───────────────────────────────────────────────
// Tables owned by the engine migration migrate_receptionist_channels.py
// (specs/receptionist-channels/). Mirrored here for the CRM's reads and writes.

// One Meta Cloud API sender per account. The *_enc columns are sealed with
// server/lib/secretBox.ts and never leave the server.
export const whatsappSenders = nocodb.table("WhatsApp_Senders", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  wabaId: text("waba_id").notNull(),
  phoneNumberId: text("phone_number_id").notNull(),
  displayPhoneNumber: text("display_phone_number"),
  verifiedName: text("verified_name"),
  nameStatus: text("name_status"),
  qualityRating: text("quality_rating"),
  appId: text("app_id").notNull(),
  appSecretEnc: text("app_secret_enc").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  // How the number was connected: app (also on the client's WhatsApp Business
  // app) | new (Cloud API only, registered by us) | null (details pasted by hand).
  onboardingMode: text("onboarding_mode"),
  // The two-step PIN we chose when registering a "new" number. Sealed.
  twoStepPinEnc: text("two_step_pin_enc"),
  // Who the assistant answers: all | new_only (not the owner's own contacts) | off.
  aiScope: text("ai_scope").notNull().default("all"),
  // After the owner replies from the phone, hand back after this many hours (null: only by command).
  resumeAfterHours: integer("resume_after_hours"),
  resumeCommand: text("resume_command").notNull().default("/go"),
  // pending | connected | error | disabled
  status: text("status").notNull().default("pending"),
  lastError: text("last_error"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertWhatsappSenderSchema = createInsertSchema(whatsappSenders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  connectedAt: true,
});
export type WhatsappSender = typeof whatsappSenders.$inferSelect;
export type InsertWhatsappSender = z.infer<typeof insertWhatsappSenderSchema>;

// One row per catalog template and language, per account.
export const whatsappTemplates = nocodb.table("WhatsApp_Templates", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  name: text("name").notNull(),
  language: text("language").notNull(),
  category: text("category"),
  // not_submitted | PENDING | APPROVED | REJECTED | PAUSED | DISABLED
  status: text("status").notNull().default("not_submitted"),
  metaTemplateId: text("meta_template_id"),
  rejectedReason: text("rejected_reason"),
  catalogVersion: integer("catalog_version").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;

// One decision per phone call: was a follow-up sent, and why or why not.
export const callFollowupLog = nocodb.table("Call_Followup_Log", {
  id: serial("id").primaryKey(),
  voiceCallId: integer("voice_call_id").notNull(),
  accountsId: integer("accounts_id").notNull(),
  leadsId: integer("leads_id"),
  decision: text("decision").notNull(),
  reason: text("reason"),
  kind: text("kind"),
  channel: text("channel"),
  providerMessageId: text("provider_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type CallFollowupLog = typeof callFollowupLog.$inferSelect;

// Client recaps and instant alerts (specs/client-recaps): the event ledger.
// The engine owns this table and its migration
// (automations/scripts/migrate_add_client_alert_log.py) and writes every row;
// the CRM only reads it (the /go/:code link). deliveries: one entry per channel
// and recipient, see automations/tools/db/client_alerts.py.
export const clientAlertLog = nocodb.table("Client_Alert_Log", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  leadsId: integer("leads_id"),
  voiceCallId: text("voice_call_id"),
  kind: text("kind").notNull(),             // event | recap | reply | test | notice
  eventType: text("event_type").notNull(),
  dedupKey: text("dedup_key").notNull().unique(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  instant: boolean("instant").notNull().default(false),
  deliveries: jsonb("deliveries").$type<Array<Record<string, unknown>>>().notNull().default([]),
  linkCode: text("link_code").unique(),
  windowStart: timestamp("window_start", { withTimezone: true }),
  windowEnd: timestamp("window_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export type ClientAlertLog = typeof clientAlertLog.$inferSelect;

// Per-service settings for the Demos page's Settings tab, one row per service
// key from client/src/features/demos/services.ts. Free-form jsonb because each
// service needs different knobs and most have none yet; the route validates
// the shape per service. widget: { avatarFile } (a file in uploads/demo-avatars).
export const demoSettings = nocodb.table("Demo_Settings", {
  service: text("service").primaryKey(),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export type DemoSettings = typeof demoSettings.$inferSelect;

// Public website demo (specs/public-website-demo). One row per landing-page
// request, from "awaiting_phone" through verification, build and completion.
// The engine reads and updates these rows directly (same Postgres).
export const publicDemoRequests = nocodb.table("Public_Demo_Requests", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),           // same 16-hex token as the lead's wa-demo:<token>
  status: text("status").notNull().default("awaiting_phone"),
  // awaiting_phone | building | ready | completed | failed
  // | blocked_country | blocked_limit | reconnected
  websiteUrl: text("website_url").notNull(),
  domain: text("domain").notNull(),                  // lowercase host without leading "www."
  language: text("language").notNull(),              // en | nl | pt
  ipHash: text("ip_hash").notNull(),
  userAgent: text("user_agent"),
  country: text("country"),                          // Cloudflare's cf-ipcountry (GB, NL, ...): the homepage demo's voice
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  phone: text("phone"),                              // E.164 once verified
  leadId: integer("lead_id"),
  persona: jsonb("persona"),                         // built site context, reused per domain
  companyName: text("company_name"),
  logo: text("logo"),                                // the site's own icon as a data: URL, shown on the landing page's phone
  reason: text("reason"),                            // failure / block reason, internal only
  estCostEur: numeric("est_cost_eur", { precision: 8, scale: 4 }).notNull().default("0"),
  voiceSessions: integer("voice_sessions").notNull().default(0),
  voiceSeconds: integer("voice_seconds").notNull().default(0),
  chatTurns: integer("chat_turns").notNull().default(0),
  voiceEndedAt: timestamp("voice_ended_at", { withTimezone: true }),
  feedback: text("feedback"),
  followupTaskId: integer("followup_task_id"),
  feedbackSentAt: timestamp("feedback_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("public_demo_requests_domain_idx").on(t.domain, t.readyAt),
  index("public_demo_requests_phone_idx").on(t.phone, t.createdAt),
  index("public_demo_requests_ip_idx").on(t.ipHash, t.createdAt),
  index("public_demo_requests_status_idx").on(t.status),
]);
export type PublicDemoRequest = typeof publicDemoRequests.$inferSelect;

// Instagram connect + scheduled Reels publishing (docs/superpowers/specs/
// 2026-10-19-instagram-connect-and-publishing-design.md). Tokens are sealed
// with server/lib/secretBox.ts and never leave the server.
export const socialConnections = nocodb.table("Social_Connections", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  provider: text("provider").notNull(),                      // "instagram"
  externalUserId: text("external_user_id"),
  appScopedUserId: text("app_scoped_user_id"),               // /me "id"; Meta callbacks may send this one
  username: text("username"),
  profilePictureUrl: text("profile_picture_url"),
  accountType: text("account_type"),
  accessTokenEnc: text("access_token_enc"),                  // seal()ed, never returned to the client
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  tokenRefreshedAt: timestamp("token_refreshed_at", { withTimezone: true }),
  status: text("status").notNull().default("connected"),
  lastError: text("last_error"),
  expiryWarnedAt: timestamp("expiry_warned_at", { withTimezone: true }),
  connectedByUserId: integer("connected_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("social_connections_account_provider").on(t.accountsId, t.provider),
  uniqueIndex("social_connections_external_connected").on(t.provider, t.externalUserId).where(sql`${t.status} <> 'disconnected'`),
]);
export type SocialConnection = typeof socialConnections.$inferSelect;
export type InsertSocialConnection = typeof socialConnections.$inferInsert;

export const socialPosts = nocodb.table("Social_Posts", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  connectionId: integer("connection_id"),
  mediaType: text("media_type").notNull().default("REELS"),
  videoPath: text("video_path"),
  videoPublicId: text("video_public_id"),
  videoExt: text("video_ext"),
  videoDurationS: real("video_duration_s"),
  videoWidth: integer("video_width"),
  videoHeight: integer("video_height"),
  videoBytes: bigint("video_bytes", { mode: "number" }),
  // The Reel cover: a copy of a generated thumbnail (Social_Thumbnails), served publicly at /media/social/cover/<id>.jpg for Meta.
  coverThumbnailId: integer("cover_thumbnail_id"),
  coverPublicId: text("cover_public_id"),
  coverPath: text("cover_path"),
  caption: text("caption").notNull().default(""),
  shareToFeed: boolean("share_to_feed").notNull().default(true),
  isAiGenerated: boolean("is_ai_generated").notNull().default(true),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  approvalStatus: text("approval_status").notNull().default("pending"),
  approvalNote: text("approval_note"),
  approvedByUserId: integer("approved_by_user_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvalWaivedByUserId: integer("approval_waived_by_user_id"),
  approvalWaivedAt: timestamp("approval_waived_at", { withTimezone: true }),
  approvalReminderSentAt: timestamp("approval_reminder_sent_at", { withTimezone: true }),
  status: text("status").notNull().default("scheduled"),
  igContainerId: text("ig_container_id"),
  publishingStartedAt: timestamp("publishing_started_at", { withTimezone: true }),
  igMediaId: text("ig_media_id"),
  permalink: text("permalink"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("social_posts_video_public_id").on(t.videoPublicId),
  index("social_posts_status_scheduled_idx").on(t.status, t.scheduledAt),
  index("social_posts_accounts_id_idx").on(t.accountsId),
]);
export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

// Socials studio (docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md).
// Created by script/create-social-studio-tables.mjs. One settings row per account: the caption style
// and voice guide (agency), "Sobre mim" (agency or the account's Managers), comment-to-DM mode.
export const socialSettings = nocodb.table("Social_Settings", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  captionStyle: text("caption_style").notNull().default(""),
  voiceGuide: text("voice_guide").notNull().default(""),
  aboutMe: text("about_me").notNull().default(""),
  dmMode: text("dm_mode").notNull().default("off"),            // off | dry_run | live (live also needs INSTAGRAM_DM_LIVE=1)
  dmHourlyCap: integer("dm_hourly_cap").notNull().default(20),
  updatedByUserId: integer("updated_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("social_settings_accounts_id").on(t.accountsId),
]);
export type SocialSettings = typeof socialSettings.$inferSelect;

export const socialTopics = nocodb.table("Social_Topics", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  text: text("text").notNull(),
  source: text("source").notNull().default("typed"),           // typed | voice | seed
  status: text("status").notNull().default("new"),             // new | used | dismissed
  scriptId: integer("script_id"),
  tagIds: integer("tag_ids").array().notNull().default(sql`'{}'`), // Social_Tags ids of the same account
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("social_topics_accounts_id_idx").on(t.accountsId),
]);
export type SocialTopic = typeof socialTopics.$inferSelect;
export type InsertSocialTopic = typeof socialTopics.$inferInsert;

export const socialScripts = nocodb.table("Social_Scripts", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("idea"),            // shared/socialStudio.ts SCRIPT_STATUSES
  topicId: integer("topic_id"),
  postId: integer("post_id"),
  videoUploadId: text("video_upload_id"),                      // an upload (server/social/media.ts layout) waiting to be scheduled
  heygenVideoId: text("heygen_video_id"),
  reviewStatus: text("review_status").notNull().default("none"), // none | waiting | ok | changes
  reviewNote: text("review_note"),
  reviewedByUserId: integer("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  seedKey: text("seed_key"),                                   // set by the seed script, so a re-run adds nothing twice
  tagIds: integer("tag_ids").array().notNull().default(sql`'{}'`), // Social_Tags ids of the same account
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("social_scripts_accounts_id_idx").on(t.accountsId),
  uniqueIndex("social_scripts_account_seed_key").on(t.accountsId, t.seedKey).where(sql`${t.seedKey} IS NOT NULL`),
]);
export type SocialScript = typeof socialScripts.$inferSelect;
export type InsertSocialScript = typeof socialScripts.$inferInsert;

/** Tags the account's team makes for ideas and scripts. color is a key of shared/socialStudio.ts TAG_COLORS. */
export const socialTags = nocodb.table("Social_Tags", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  name: text("name").notNull(),                                // 1 to 40 characters, unique per account ignoring case
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("social_tags_account_name").on(t.accountsId, sql`lower(${t.name})`),
]);
export type SocialTag = typeof socialTags.$inferSelect;

/** HeyGen videos already downloaded for an account, so the list can mark them "already used". */
export const socialHeygenPulls = nocodb.table("Social_Heygen_Pulls", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  heygenVideoId: text("heygen_video_id").notNull(),
  scriptId: integer("script_id"),
  uploadId: text("upload_id").notNull(),
  pulledByUserId: integer("pulled_by_user_id"),
  pulledAt: timestamp("pulled_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("social_heygen_pulls_account_video").on(t.accountsId, t.heygenVideoId),
]);
export type SocialHeygenPull = typeof socialHeygenPulls.$inferSelect;

// Thumbnail creator (shared/socialThumbnails.ts, server/social/thumbnailRoutes.ts). Created by
// script/create-social-thumbnail-tables.mjs. Files live under uploads/social-thumbnails/<accountId>/.
/** Reference images an account keeps: a person for the cover (e.g. Mia), a look to copy, an asset to use. */
export const socialThumbnailRefs = nocodb.table("Social_Thumbnail_Refs", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  kind: text("kind").notNull(),                                // shared/socialThumbnails.ts REF_KINDS
  label: text("label").notNull().default(""),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull(),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("social_thumbnail_refs_accounts_id_idx").on(t.accountsId),
]);
export type SocialThumbnailRef = typeof socialThumbnailRefs.$inferSelect;
export type InsertSocialThumbnailRef = typeof socialThumbnailRefs.$inferInsert;

/** A saved recipe: a kind, extra instructions, reference images and a format, picked with one tap. */
export const socialThumbnailStyles = nocodb.table("Social_Thumbnail_Styles", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),                                // THUMB_KINDS
  prompt: text("prompt").notNull().default(""),
  format: text("format").notNull().default("reel"),            // THUMB_FORMATS
  refIds: integer("ref_ids").array().notNull().default(sql`'{}'`),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("social_thumbnail_styles_accounts_id_idx").on(t.accountsId),
]);
export type SocialThumbnailStyle = typeof socialThumbnailStyles.$inferSelect;
export type InsertSocialThumbnailStyle = typeof socialThumbnailStyles.$inferInsert;

/** One generated image. Rows start as generating and become ready (file_path set) or failed (error set). */
export const socialThumbnails = nocodb.table("Social_Thumbnails", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  batchId: text("batch_id").notNull(),                         // the variants of one request share it
  styleId: integer("style_id"),
  scriptId: integer("script_id"),
  postId: integer("post_id"),
  parentId: integer("parent_id"),                              // the thumbnail this one was edited from
  review: text("review"),                                      // THUMB_REVIEWS: null for a first version
  kind: text("kind").notNull(),
  format: text("format").notNull(),
  title: text("title").notNull().default(""),
  prompt: text("prompt").notNull().default(""),                // what the user typed
  fullPrompt: text("full_prompt").notNull().default(""),       // what went to the image model
  refIds: integer("ref_ids").array().notNull().default(sql`'{}'`),
  status: text("status").notNull().default("generating"),      // THUMB_STATUSES
  error: text("error"),
  filePath: text("file_path"),
  model: text("model"),
  starred: boolean("starred").notNull().default(false),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("social_thumbnails_accounts_id_idx").on(t.accountsId, t.createdAt),
]);
export type SocialThumbnail = typeof socialThumbnails.$inferSelect;
export type InsertSocialThumbnail = typeof socialThumbnails.$inferInsert;

// Comment-to-DM (docs/superpowers/specs/2026-10-20-comment-to-dm-design.md). Off by default; a real
// send needs Social_Settings.dm_mode = 'live' AND env INSTAGRAM_DM_LIVE=1 (server/social/igMessaging.ts).
export const socialDmRules = nocodb.table("Social_Dm_Rules", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  postId: integer("post_id"),                                  // a CRM post; null with ig_media_id null = every post
  igMediaId: text("ig_media_id"),
  keyword: text("keyword").notNull(),
  keywordNorm: text("keyword_norm").notNull(),                 // server/social/dmMatch.ts keywordNorm
  firstMessage: text("first_message").notNull(),
  aiFollowUp: boolean("ai_follow_up").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("social_dm_rules_accounts_id_idx").on(t.accountsId),
]);
export type SocialDmRule = typeof socialDmRules.$inferSelect;
export type InsertSocialDmRule = typeof socialDmRules.$inferInsert;

/** One row per webhook comment or message: the unique key is the dedupe (Meta delivers at least once). */
export const socialWebhookEvents = nocodb.table("Social_Webhook_Events", {
  id: serial("id").primaryKey(),
  eventKey: text("event_key").notNull(),                       // comment:<id> | message:<mid>
  field: text("field").notNull(),                              // comments | messages
  accountsId: integer("accounts_id"),
  igUserId: text("ig_user_id"),                                // the commenter / sender (IG-scoped id)
  outcome: text("outcome"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("social_webhook_events_key").on(t.eventKey),
]);
export type SocialWebhookEvent = typeof socialWebhookEvents.$inferSelect;

/** Everything comment-to-DM did or would have done (dry run), shown in the Socials page. */
export const socialDmLog = nocodb.table("Social_Dm_Log", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  ruleId: integer("rule_id"),
  commentId: text("comment_id"),
  igUserId: text("ig_user_id"),
  username: text("username"),
  kind: text("kind").notNull(),                                // private_reply | reply | inbound | opt_out | ai_follow_up
  mode: text("mode").notNull(),                                // dry_run | live
  status: text("status").notNull(),                            // would_send | sent | failed | skipped | received
  reason: text("reason"),
  text: text("text"),
  leadId: integer("lead_id"),
  interactionId: integer("interaction_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("social_dm_log_account_created_idx").on(t.accountsId, t.createdAt),
  // One private reply per comment, ever (Meta allows one; this also stops a double send on a redelivery).
  uniqueIndex("social_dm_log_one_private_reply").on(t.accountsId, t.commentId).where(sql`${t.kind} = 'private_reply'`),
]);
export type SocialDmLogRow = typeof socialDmLog.$inferSelect;
export type InsertSocialDmLog = typeof socialDmLog.$inferInsert;

// Insights (docs/superpowers/specs/2026-10-20-insights-design.md). The account's media as Instagram
// lists them (CRM posts and posts made in the app), and metric snapshots over time.
export const socialInsightMedia = nocodb.table("Social_Insight_Media", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  igMediaId: text("ig_media_id").notNull(),
  mediaType: text("media_type"),
  productType: text("product_type"),                         // REELS | FEED | ...
  permalink: text("permalink"),
  caption: text("caption").notNull().default(""),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  postId: integer("post_id"),                                // the CRM post, when it was published from here
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("social_insight_media_account_media").on(t.accountsId, t.igMediaId),
]);
export type SocialInsightMedia = typeof socialInsightMedia.$inferSelect;

/**
 * One value per account, scope, media, metric and bucket ("YYYY-MM-DDTHH" for a media item's lifetime
 * value at that hour, "YYYY-MM-DD" for a day's account total or the day's follower count). Writing the
 * same bucket again replaces it, so a re-run never duplicates. A metric Meta refused has no value and
 * its reason in skipped_reason.
 */
export const socialInsightSnapshots = nocodb.table("Social_Insight_Snapshots", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  scope: text("scope").notNull(),                            // account | media
  igMediaId: text("ig_media_id").notNull().default(""),      // "" for account rows
  metric: text("metric").notNull(),
  value: doublePrecision("value"),
  skippedReason: text("skipped_reason"),
  bucket: text("bucket").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("social_insight_snapshots_key").on(t.accountsId, t.scope, t.igMediaId, t.metric, t.bucket),
  index("social_insight_snapshots_account_metric_idx").on(t.accountsId, t.metric),
]);
export type SocialInsightSnapshot = typeof socialInsightSnapshots.$inferSelect;
export type InsertSocialInsightSnapshot = typeof socialInsightSnapshots.$inferInsert;

export const socialInsightState = nocodb.table("Social_Insight_State", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  backfilledAt: timestamp("backfilled_at", { withTimezone: true }),
  lastAccountRunAt: timestamp("last_account_run_at", { withTimezone: true }),
  lastError: text("last_error"),
}, (t) => [
  uniqueIndex("social_insight_state_account").on(t.accountsId),
]);
export type SocialInsightState = typeof socialInsightState.$inferSelect;

/** People who wrote a stop word: no automated message reaches them again. */
export const socialDmOptOuts = nocodb.table("Social_Dm_Opt_Outs", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  igUserId: text("ig_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("social_dm_opt_outs_account_user").on(t.accountsId, t.igUserId),
]);

// Daily estimated spend ledger for public demos (Europe/Amsterdam day).
export const publicDemoSpend = nocodb.table("Public_Demo_Spend", {
  day: date("day").primaryKey(),
  estCostEur: numeric("est_cost_eur", { precision: 10, scale: 4 }).notNull().default("0"),
  demosBuilt: integer("demos_built").notNull().default(0),
  budgetAlertSentAt: timestamp("budget_alert_sent_at", { withTimezone: true }),
});

// The public site's own visit counter, read by the Owner-only Traffic page
// (/platform/traffic). One row per page view, sent by client/public/site/visit.js.
// Deliberately anonymous: no IP address, no user agent, no cookie or visitor id.
// "Visits" are the rows with is_entry (the view did not come from another page
// of the site). Sources are classified on read (server/traffic/sources.ts).
export const siteVisits = nocodb.table("Site_Visits", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  path: text("path").notNull(),                     // pathname only, no query string
  lang: text("lang"),                               // the page's language: en | nl | pt
  isEntry: boolean("is_entry").notNull().default(false),
  referrerHost: text("referrer_host"),              // external referrer's hostname, null = none
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  device: text("device"),                           // mobile | tablet | desktop (from viewport width)
  timezone: text("timezone"),                       // browser time zone, e.g. Europe/Amsterdam
}, (t) => [
  index("site_visits_created_idx").on(t.createdAt),
]);
export type SiteVisit = typeof siteVisits.$inferSelect;

// A private link on which a client hands in what a phone carrier needs to
// register a number in their name. The files go straight to Telnyx; only
// their Telnyx ids and names are kept here.
export const numberRequests = nocodb.table("Number_Requests", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  token: text("token").notNull().unique(),
  // open | submitted
  status: text("status").notNull().default("open"),
  details: jsonb("details").$type<Record<string, string>>().notNull().default({}),
  documents: jsonb("documents").$type<NumberRequestDocument[]>().notNull().default([]),
  // What to order once the client submits: an area code ("73"), optionally a
  // number Gabriel picked, and whether the order goes out by itself.
  areaCode: text("area_code"),
  preferredNumber: text("preferred_number"),
  autoOrder: boolean("auto_order").notNull().default(false),
  numberOrder: jsonb("number_order").$type<NumberRequestOrder>(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export interface NumberRequestDocument {
  kind: "kvk" | "id" | "address";
  telnyxDocumentId: string;
  filename: string;
  uploadedAt: string;
}
export interface NumberRequestOrder {
  status: "placing" | "pending" | "success" | "failure";
  phoneNumber: string | null;
  orderId: string | null;
  requirementGroupId: string | null;
  error: string | null;
  checkedAt: string;
}
export type NumberRequest = typeof numberRequests.$inferSelect;

// ─── Demos page prospects ───
// Created by script/create-demos-redesign-columns.mjs. One row of settings per prospect group (the key the
// Demos page already groups links by): who the demo greets, the language, the AI disclosure line and the notes
// the demo prompts carry. Written by the Demos page (create panel and prospect settings), read by demo minting.
export const demoProspects = nocodb.table("Demo_Prospects", {
  id: serial("id").primaryKey(),
  prospectGroup: text("prospect_group").notNull(),
  firstName: text("first_name").notNull(),
  companyName: text("company_name").notNull().default(""),
  clientNiche: text("client_niche").notNull().default(""),
  language: text("language").notNull().default("en"),         // en | nl | pt
  aiDisclosure: text("ai_disclosure").notNull().default(""),
  market: text("market").notNull().default(""),
  notes: text("notes").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("demo_prospects_group_idx").on(t.prospectGroup),
]);
export type DemoProspectRow = typeof demoProspects.$inferSelect;

// ─── Voice review and prompt coach ───
// Created by script/create-voice-review-tables.mjs. Weekly or manual AI reviews of an account's ElevenLabs
// phone calls, the change cards they and the coach chat propose, one draft per prompt row, and the coach chat.
// The Python engine reads Voice_Prompt_Drafts.use_case and draft_text by raw SQL: keep those names.
export const voiceReviews = nocodb.table("Voice_Reviews", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  kind: text("kind").notNull(),                                // weekly | manual
  weekKey: text("week_key"),                                   // null for manual
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("running"),         // running | done | failed
  attempts: integer("attempts").notNull().default(1),
  stats: jsonb("stats").notNull().default({}),
  report: jsonb("report"),
  error: text("error"),
  model: text("model"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("voice_reviews_weekly_week").on(t.accountsId, t.weekKey).where(sql`${t.kind} = 'weekly'`),
  index("voice_reviews_account_created_idx").on(t.accountsId, t.createdAt),
]);
export type VoiceReviewRow = typeof voiceReviews.$inferSelect;

export const voicePromptSuggestions = nocodb.table("Voice_Prompt_Suggestions", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  source: text("source").notNull(),                            // review | chat
  reviewId: integer("review_id"),
  coachMessageId: integer("coach_message_id"),
  promptsId: integer("prompts_id").notNull(),                  // the Prompt_Library row the find/replace applies to
  language: text("language").notNull(),                        // nl | en
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  findText: text("find_text").notNull(),
  replaceText: text("replace_text").notNull(),
  mirrorPromptsId: integer("mirror_prompts_id"),               // the other language's prompt row, when the change applies there too
  mirrorFindText: text("mirror_find_text"),
  mirrorReplaceText: text("mirror_replace_text"),
  evidenceCallIds: text("evidence_call_ids").array().notNull().default(sql`'{}'`),
  status: text("status").notNull().default("proposed"),        // proposed | accepted | rejected | stale | live
  statusNote: text("status_note"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("voice_prompt_suggestions_account_status_idx").on(t.accountsId, t.status),
]);
export type VoicePromptSuggestionRow = typeof voicePromptSuggestions.$inferSelect;

export const voicePromptDrafts = nocodb.table("Voice_Prompt_Drafts", {
  id: serial("id").primaryKey(),
  promptsId: integer("prompts_id").notNull(),
  useCase: text("use_case").notNull(),
  draftText: text("draft_text").notNull(),
  baseText: text("base_text").notNull(),                       // the live text the draft was started from
  acceptedIds: integer("accepted_ids").array().notNull().default(sql`'{}'`), // Voice_Prompt_Suggestions ids applied to the draft
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("voice_prompt_drafts_prompt").on(t.promptsId),
]);
export type VoicePromptDraftRow = typeof voicePromptDrafts.$inferSelect;

export const voiceCoachMessages = nocodb.table("Voice_Coach_Messages", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  role: text("role").notNull(),                                // user | assistant
  content: text("content").notNull(),
  suggestionIds: integer("suggestion_ids").array().notNull().default(sql`'{}'`), // cards the assistant proposed in this message
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("voice_coach_messages_account_created_idx").on(t.accountsId, t.createdAt),
]);
export type VoiceCoachMessageRow = typeof voiceCoachMessages.$inferSelect;

/** Home "Needs attention" rows marked as handled, per account (shared by every user of it). Created by hand with SQL. */
export const homeAttentionDismissed = nocodb.table("Home_Attention_Dismissed", {
  id: serial("id").primaryKey(),
  accountsId: integer("accounts_id").notNull(),
  kind: text("kind").notNull(),                                 // callback | transfer_failed | handoff
  refId: text("ref_id").notNull(),                              // call id, or "<lead id>:<handoff epoch ms>" for handoff
  dismissedByUserId: integer("dismissed_by_user_id"),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("home_attention_dismissed_ref").on(t.accountsId, t.kind, t.refId),
]);
export type HomeAttentionDismissedRow = typeof homeAttentionDismissed.$inferSelect;
