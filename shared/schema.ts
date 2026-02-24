import { sql } from "drizzle-orm";
import {
  pgSchema,
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
  calendarLink: text("calendar_link"),
  dailyLeadLimit: bigint("daily_lead_limit", { mode: "number" }),
  webhookUrl: text("webhook_url"),
  aiModel: text("ai_model"),
  useAiBumps: boolean("use_ai_bumps"),
  maxBumps: bigint("max_bumps", { mode: "number" }),
  stopOnResponse: boolean("stop_on_response"),
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
  agentName: text("agent_name"),
  serviceName: text("service_name"),
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
  lastMetricsCalculatedAt: timestamp("last_metrics_calculated_at"),
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
}, (t) => [
  index("interactions_leads_id_idx").on(t.leadsId),
  index("interactions_accounts_id_idx").on(t.accountsId),
  index("interactions_created_at_idx").on(t.createdAt),
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
  whatHasTheLeadDone: text("what_has_the_lead_done"),
  when: text("when"),
  accountId: bigint("account_id", { mode: "number" }),
  campaignId: bigint("campaign_id", { mode: "number" }),
  accountName: text("account_name"),
  campaignName: text("campaign_name"),
  text2: text("Text_2"),
  leadScore: integer("lead_score"),
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
