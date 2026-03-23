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
  real,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// NocoDB schema
const nocodb = pgSchema("p2mxx34fvbf3ll6");


// ─── Accounts ───────────────────────────────────────────────────────────────

export const accounts = nocodb.table("Accounts", {
  id: integer("id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  name: text("name"),
  phone: varchar("phone"),
  ownerEmail: varchar("owner_email"),
  website: text("website"),
  type: text("type"),
  timezone: text("timezone"),
  notes: text("notes"),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioMessagingServiceSid: text("twilio_messaging_service_sid"),
  twilioDefaultFromNumber: varchar("twilio_default_from_number"),
  status: text("status"),
  businessHoursStart: time("business_hours_start"),
  businessHoursEnd: time("business_hours_end"),
  maxDailySends: bigint("max_daily_sends", { mode: "number" }),
  webhookSecret: text("webhook_secret"),
  slug: text("slug"),
  defaultAiName: text("default_ai_name"),
  defaultAiRole: text("default_ai_role"),
  defaultAiStyle: text("default_ai_style"),
  defaultTypoFrequency: text("default_typo_frequency"),
  dataCollectionDisclosure: text("data_collection_disclosure"),
  optOutKeyword: text("opt_out_keyword"),
  preferredTerminology: text("preferred_terminology"),
  serviceCategories: text("service_categories"),
  businessDescription: text("business_description"),
  businessNiche: text("business_niche"),
  logoUrl: text("logo_url"),
  voiceFileData: text("voice_file_data"),
  voiceFileName: varchar("voice_file_name"),
  supportBotConfig: text("support_bot_config"),
  instagramAccessToken: text("instagram_access_token"),
  instagramUserId: text("instagram_user_id"),
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  // Contact 2
  contact2Name: text("contact2_name"),
  contact2Role: text("contact2_role"),
  contact2Email: varchar("contact2_email"),
  contact2Phone: varchar("contact2_phone"),
  contact2Linkedin: text("contact2_linkedin"),
  accountsId: integer("Accounts_id"),
  // Enrichment fields (populated by LinkedIn scraper)
  headline: text("headline"),
  connectionCount: integer("connection_count"),
  followerCount: integer("follower_count"),
  topPost: text("top_post"),
  aiSummary: text("ai_summary"),
  conversationStarters: text("conversation_starters"),
  enrichedAt: timestamp("enriched_at"),
  enrichmentStatus: text("enrichment_status"),
  // Outreach tracking
  outreachStatus: text("outreach_status"),
  firstContactedAt: timestamp("first_contacted_at"),
  lastContactedAt: timestamp("last_contacted_at"),
  followUpCount: integer("follow_up_count"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  contactMethod: text("contact_method"),
  photoUrl: text("photo_url"),
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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

// ─── Automation_Logs ───────────────────────────────────────────────────────────────

export const automationLogs = nocodb.table("Automation_Logs", {
  id: integer("id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
}, (t) => [
  index("automation_logs_accounts_id_idx").on(t.accountsId),
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  ncOrder: numeric("nc_order"),
  name: text("name"),
  status: text("status"),
  accountsId: integer("Accounts_id"),
  description: text("description"),
  website: text("website"),
  n8nWorkflowId: text("n8n_workflow_id"),
  aiPromptTemplate: text("ai_prompt_template"),
  totalCost: numeric("total_cost"),
  bump1Template: text("bump_1_template"),
  bump2Template: text("bump_2_template"),
  bump3Template: text("bump_3_template"),
  bump1DelayHours: bigint("bump_1_delay_hours", { mode: "number" }),
  bump3DelayHours: bigint("bump_3_delay_hours", { mode: "number" }),
  bump2DelayHours: bigint("bump_2_delay_hours", { mode: "number" }),
  messageIntervalMinutes: bigint("message_interval_minutes", { mode: "number" }),
  activeHoursStart: time("active_hours_start"),
  activeHoursEnd: time("active_hours_end"),
  defaultCallDurationMinutes: integer("default_call_duration_minutes"),
  calendarLink: text("calendar_link"),
  dailyLeadLimit: bigint("daily_lead_limit", { mode: "number" }),
  webhookUrl: text("webhook_url"),
  aiModel: text("ai_model"),
  useAiBumps: boolean("use_ai_bumps"),
  maxBumps: bigint("max_bumps", { mode: "number" }),
  stopOnResponse: boolean("stop_on_response"),
  channel: text("channel").default("sms"),
  firstMessageVoiceNote: boolean("first_message_voice_note").default(false),
  bump1VoiceNote: boolean("bump_1_voice_note").default(false),
  bump2VoiceNote: boolean("bump_2_voice_note").default(false),
  bump3VoiceNote: boolean("bump_3_voice_note").default(false),
  aiReplyVoiceNote: boolean("ai_reply_voice_note").default(false),
  ttsVoiceId: text("tts_voice_id"),
  campaignNicheOverride: text("campaign_niche_override"),
  campaignService: text("campaign_service"),
  campaignUsp: text("campaign_usp"),
  targetAudience: text("target_audience"),
  nicheQuestion: text("niche_question"),
  qualificationCriteria: text("qualification_criteria"),
  bookingModeOverride: text("booking_mode_override"),
  calendarLinkOverride: text("calendar_link_override"),
  inquiriesSource: text("inquiries_source"),
  inquiryTimeframe: text("inquiry_timeframe"),
  whatLeadDid: text("what_lead_did"),
  firstMessage: text("First_Message"),
  secondMessage: text("second_message"),
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
  lastMetricsCalculatedAt: timestamp("last_metrics_calculated_at"),
  campaignSticker: text("campaign_sticker"),
  campaignHue: integer("campaign_hue"),
  aiSummary: text("ai_summary"),
  aiSummaryGeneratedAt: timestamp("ai_summary_generated_at"),
  abEnabled: boolean("ab_enabled").default(false),
  abSplitRatio: integer("ab_split_ratio").default(50),
}, (t) => [
  index("campaigns_accounts_id_idx").on(t.accountsId),
]);

export const insertCampaignsSchema = createInsertSchema(campaigns).omit({
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  failedAt: timestamp("failed_at"),
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
}, (t) => [
  index("interactions_leads_id_idx").on(t.leadsId),
  index("interactions_accounts_id_idx").on(t.accountsId),
  index("interactions_created_at_idx").on(t.createdAt),
  index("interactions_prospect_id_idx").on(t.prospectId),
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


// ─── Leads ───────────────────────────────────────────────────────────────

export const leads = nocodb.table("Leads", {
  id: integer("id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  bookedCallDate: timestamp("booked_call_date"),
  automationStatus: text("automation_status"),
  lastMessageSentAt: timestamp("last_message_sent_at"),
  lastMessageReceivedAt: timestamp("last_message_received_at"),
  messageCountSent: bigint("message_count_sent", { mode: "number" }),
  messageCountReceived: bigint("message_count_received", { mode: "number" }),
  aiMemory: json("ai_memory"),
  bump1SentAt: timestamp("bump_1_sent_at"),
  bump2SentAt: timestamp("bump_2_sent_at"),
  bump3SentAt: timestamp("bump_3_sent_at"),
  firstMessageSentAt: timestamp("first_message_sent_at"),
  nextActionAt: timestamp("next_action_at"),
  currentBumpStage: bigint("current_bump_stage", { mode: "number" }),
  optedOut: boolean("opted_out"),
  aiSentiment: text("ai_sentiment"),
  aiSummary: text("ai_summary"),
  teamMembers: text("team_members"),
  manualTakeover: boolean("manual_takeover"),
  dncReason: text("dnc_reason"),
  priority: text("priority"),
  language: text("language"),
  timeZone: text("time_zone"),
  bookingConfirmedAt: timestamp("booking_confirmed_at_"),
  textCol: text("Text"),
  bookingConfirmationSent: boolean("booking_confirmation_sent"),
  noShow: boolean("no_show"),
  reScheduledCount: bigint("re_scheduled_count", { mode: "number" }),
  callDurationMinutes: integer("call_duration_minutes"),
  whatHasTheLeadDone: text("what_has_the_lead_done"),
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
  aiNotesGeneratedAt: timestamp("ai_notes_generated_at"),
  abVariant: text("ab_variant"),
}, (t) => [
  index("leads_accounts_id_idx").on(t.accountsId),
  index("leads_campaigns_id_idx").on(t.campaignsId),
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  ncOrder: numeric("nc_order"),
  workflow: text("workflow"),
  leadsId: integer("Leads_id"),
  tagsId: integer("Tags_id"),
  createdBy: varchar("created_by"),
  workflowStep: text("workflow_step"),
  removedAt: timestamp("removed_at"),
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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


// ─── Tags ───────────────────────────────────────────────────────────────

export const tags = nocodb.table("Tags", {
  id: integer("id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  lastLoginAt: timestamp("last_login_at"),
  accountsId: integer("Accounts_id"),
  email: varchar("email"),
  passwordHash: text("password_hash"),
  preferences: varchar("preferences"),
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
  createdAt: timestamp("created_at"),
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
  createdAt: timestamp("created_at"),
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  viewedAt: timestamp("viewed_at"),
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
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  signedAt: timestamp("signed_at"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
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
  telegramChatId: text("telegram_chat_id"),
  typeOverrides: json("type_overrides").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
  escalatedAt: timestamp("escalated_at"),
  closedAt: timestamp("closed_at"),
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
  createdAt: timestamp("created_at").defaultNow(),
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
  status: text("status").notNull().default("todo"), // "todo" | "in_progress" | "done" | "cancelled"
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("tasks_account_id_idx").on(t.accountsId),
  index("tasks_assignee_idx").on(t.assignedToUserId),
  index("tasks_status_idx").on(t.status),
  index("tasks_due_date_idx").on(t.dueDate),
  index("tasks_category_id_idx").on(t.categoryId),
  index("tasks_parent_task_id_idx").on(t.parentTaskId),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  model: text("model").notNull().default("claude-sonnet-4-20250514"),
  thinkingLevel: text("thinking_level").notNull().default("medium"),
  permissions: json("permissions").default({}),
  pageAwarenessEnabled: boolean("page_awareness_enabled").notNull().default(true),
  systemPromptId: integer("system_prompt_id"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
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
  lastFullSyncAt: timestamp("last_full_sync_at"),
  oauthTokensEncrypted: text("oauth_tokens_encrypted"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
