CREATE TABLE "p2mxx34fvbf3ll6"."Accounts" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"name" text,
	"phone" varchar,
	"owner_email" varchar,
	"website" text,
	"type" text,
	"timezone" text,
	"notes" text,
	"twilio_account_sid" text,
	"twilio_auth_token" text,
	"twilio_messaging_service_sid" text,
	"twilio_default_from_number" varchar,
	"status" text,
	"business_hours_start" time,
	"business_hours_end" time,
	"max_daily_sends" bigint,
	"webhook_secret" text,
	"slug" text,
	"default_ai_name" text,
	"default_ai_role" text,
	"default_ai_style" text,
	"default_typo_frequency" text,
	"data_collection_disclosure" text,
	"opt_out_keyword" text,
	"preferred_terminology" text,
	"service_categories" text,
	"business_description" text,
	"business_niche" text,
	"logo_url" text,
	"voice_file_data" text,
	"voice_file_name" varchar,
	"support_bot_config" text,
	"instagram_access_token" text,
	"instagram_user_id" text
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."AI_Agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"system_prompt" text,
	"photo_url" text,
	"config" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."AI_Messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sub_agent_blocks" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."AI_Sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"title" text,
	"cli_session_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "AI_Sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Automation_Logs" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"workflow_name" text,
	"Leads_id" integer,
	"Campaigns_id" integer,
	"Accounts_id" integer,
	"workflow_execution_id" text,
	"step_name" text,
	"step_number" bigint,
	"status" text,
	"error_code" text,
	"input_data" text,
	"output_data" text,
	"execution_time_ms" bigint,
	"retry_count" bigint,
	"metadata" text,
	"campaign_name" text,
	"account_name" text,
	"lead_name" text,
	"account_id" bigint,
	"campaign_id" bigint,
	"lead_id" bigint
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Campaign_Metrics_History" (
	"id" integer,
	"campaigns_id" integer,
	"metric_date" date,
	"total_leads_targeted" integer,
	"total_messages_sent" integer,
	"total_responses_received" integer,
	"response_rate_percent" numeric,
	"bookings_generated" integer,
	"booking_rate_percent" numeric,
	"total_cost" numeric,
	"cost_per_lead" numeric,
	"cost_per_booking" numeric,
	"roi_percent" numeric,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Campaigns" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"name" text,
	"status" text,
	"Accounts_id" integer,
	"description" text,
	"website" text,
	"n8n_workflow_id" text,
	"ai_prompt_template" text,
	"total_cost" numeric,
	"bump_1_template" text,
	"bump_2_template" text,
	"bump_3_template" text,
	"bump_1_delay_hours" bigint,
	"bump_3_delay_hours" bigint,
	"bump_2_delay_hours" bigint,
	"message_interval_minutes" bigint,
	"active_hours_start" time,
	"active_hours_end" time,
	"default_call_duration_minutes" integer,
	"calendar_link" text,
	"daily_lead_limit" bigint,
	"webhook_url" text,
	"ai_model" text,
	"use_ai_bumps" boolean,
	"max_bumps" bigint,
	"stop_on_response" boolean,
	"channel" text DEFAULT 'sms',
	"first_message_voice_note" boolean DEFAULT false,
	"bump_1_voice_note" boolean DEFAULT false,
	"bump_2_voice_note" boolean DEFAULT false,
	"bump_3_voice_note" boolean DEFAULT false,
	"ai_reply_voice_note" boolean DEFAULT false,
	"tts_voice_id" text,
	"campaign_niche_override" text,
	"campaign_service" text,
	"campaign_usp" text,
	"target_audience" text,
	"niche_question" text,
	"qualification_criteria" text,
	"booking_mode_override" text,
	"calendar_link_override" text,
	"inquiries_source" text,
	"inquiry_timeframe" text,
	"what_lead_did" text,
	"First_Message" text,
	"second_message" text,
	"agent_name" text,
	"service_name" text,
	"total_leads_targeted" integer,
	"total_messages_sent" integer,
	"total_responses_received" integer,
	"response_rate_percent" numeric,
	"bookings_generated" integer,
	"booking_rate_percent" numeric,
	"cost_per_lead" numeric,
	"cost_per_booking" numeric,
	"roi_percent" numeric,
	"contract_id" integer,
	"value_per_booking" numeric,
	"last_metrics_calculated_at" timestamp,
	"campaign_sticker" text,
	"campaign_hue" integer,
	"ai_summary" text,
	"ai_summary_generated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Contracts" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"Accounts_id" integer,
	"title" text,
	"status" text,
	"description" text,
	"file_data" text,
	"file_name" varchar,
	"file_size" integer,
	"file_type" varchar,
	"start_date" date,
	"end_date" date,
	"signed_at" timestamp,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"viewed_count" integer,
	"view_token" varchar,
	"account_name" text,
	"deal_type" text,
	"payment_trigger" text,
	"value_per_booking" numeric,
	"fixed_fee_amount" numeric,
	"deposit_amount" numeric,
	"monthly_fee" numeric,
	"cost_passthrough_rate" numeric,
	"campaigns_id" integer,
	"currency" text,
	"language" text,
	"timezone" text,
	"invoice_cadence" text,
	"payment_preset" text,
	"contract_text" text,
	"signer_name" text
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date,
	"year" integer,
	"quarter" varchar(2),
	"supplier" varchar(200),
	"country" varchar(2),
	"invoice_number" varchar(100),
	"description" text,
	"currency" varchar(3),
	"amount_excl_vat" numeric,
	"vat_rate_pct" numeric,
	"vat_amount" numeric,
	"total_amount" numeric,
	"nl_btw_deductible" boolean DEFAULT false,
	"notes" text,
	"pdf_path" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Interactions" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"Who" text,
	"Accounts_id" integer,
	"Campaigns_id" integer,
	"Leads_id" integer,
	"type" text,
	"direction" text,
	"Content" text,
	"status" text,
	"twilio_message_sid" text,
	"from_number" varchar,
	"to_number" varchar,
	"metadata" json,
	"ai_generated" boolean,
	"ai_model" text,
	"ai_prompt" text,
	"ai_response" text,
	"ai_prompt_tokens" bigint,
	"ai_completion_tokens" bigint,
	"ai_total_tokens" bigint,
	"ai_cost" numeric,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"failed_at" timestamp,
	"bump_number" bigint,
	"triggered_by" text,
	"is_bump" boolean,
	"Attachment" text,
	"sentiment_score" bigint,
	"Users_id" integer,
	"account_id" bigint,
	"lead_id" bigint,
	"campaign_id" bigint,
	"account_name" text,
	"campaign_name" text,
	"lead_name" text,
	"agent_name" text,
	"response_time_minutes" integer,
	"conversation_thread_id" varchar,
	"sentiment_detected" varchar,
	"is_manual_follow_up" boolean
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Invoices" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"Accounts_id" integer,
	"invoice_number" varchar,
	"title" text,
	"status" text,
	"currency" varchar,
	"subtotal" numeric,
	"tax_percent" numeric,
	"tax_amount" numeric,
	"discount_amount" numeric,
	"total" numeric,
	"line_items" json,
	"notes" text,
	"payment_info" text,
	"issued_date" date,
	"due_date" date,
	"sent_at" timestamp,
	"paid_at" timestamp,
	"viewed_at" timestamp,
	"viewed_count" integer,
	"view_token" varchar,
	"account_name" text
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Lead_Score_History" (
	"id" integer,
	"leads_id" integer,
	"score_date" date,
	"lead_score" integer,
	"engagement_score" integer,
	"activity_score" integer,
	"conversion_status" varchar,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Leads" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"first_name" text,
	"Accounts_id" integer,
	"last_name" text,
	"Campaigns_id" integer,
	"phone" varchar,
	"Email" varchar,
	"Conversion_Status" text,
	"Source" text,
	"last_interaction_at" date,
	"notes" text,
	"booked_call_date" timestamp,
	"automation_status" text,
	"last_message_sent_at" timestamp,
	"last_message_received_at" timestamp,
	"message_count_sent" bigint,
	"message_count_received" bigint,
	"ai_memory" json,
	"bump_1_sent_at" timestamp,
	"bump_2_sent_at" timestamp,
	"bump_3_sent_at" timestamp,
	"first_message_sent_at" timestamp,
	"next_action_at" timestamp,
	"current_bump_stage" bigint,
	"opted_out" boolean,
	"ai_sentiment" text,
	"ai_summary" text,
	"team_members" text,
	"manual_takeover" boolean,
	"dnc_reason" text,
	"priority" text,
	"language" text,
	"time_zone" text,
	"booking_confirmed_at_" timestamp,
	"Text" text,
	"booking_confirmation_sent" boolean,
	"no_show" boolean,
	"re_scheduled_count" bigint,
	"call_duration_minutes" integer,
	"what_has_the_lead_done" text,
	"when" text,
	"account_id" bigint,
	"campaign_id" bigint,
	"account_name" text,
	"campaign_name" text,
	"Text_2" text,
	"lead_score" integer,
	"channel_identifier" text,
	"ai_notes" text,
	"ai_notes_generated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Leads_Tags" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"nc_order" numeric,
	"workflow" text,
	"Leads_id" integer,
	"Tags_id" integer,
	"created_by" varchar,
	"workflow_step" text,
	"removed_at" timestamp,
	"removed_by" text,
	"notes" text,
	"applied_by" text,
	"lead_id" bigint,
	"tag_id" bigint,
	"account_id" bigint,
	"lead_name" text,
	"account_name" text,
	"tag_name" text
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"lead_id" integer,
	"user_id" integer NOT NULL,
	"account_id" integer,
	"read" boolean DEFAULT false NOT NULL,
	"link" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Prompt_Library" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"name" text,
	"Accounts_id" integer,
	"Campaigns_id" integer,
	"version" text,
	"prompt_text" text,
	"use_case" text,
	"model" text,
	"temperature" numeric,
	"max_tokens" bigint,
	"system_message" text,
	"status" text,
	"performance_score" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Support_Messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Support_Sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"escalated_at" timestamp,
	"closed_at" timestamp,
	CONSTRAINT "Support_Sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Tags" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"name" text,
	"slug" text,
	"color" text,
	"category" text,
	"description" text,
	"auto_applied" boolean,
	"account_id" bigint,
	"Accounts_id" integer,
	"account_name" text,
	"campaign_id" integer,
	"campaign_name" text
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"Accounts_id" integer NOT NULL,
	"Campaigns_id" integer,
	"Leads_id" integer,
	"assigned_to_user_id" integer,
	"created_by_user_id" integer,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"task_type" text DEFAULT 'admin' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reminder_at" timestamp with time zone,
	"account_name" text,
	"campaign_name" text,
	"lead_name" text,
	"assignee_name" text,
	"tags" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p2mxx34fvbf3ll6"."Users" (
	"id" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"nc_order" numeric,
	"full_name_1" text,
	"phone" varchar,
	"timezone" text,
	"role" text,
	"status" text,
	"avatar_url" text,
	"n8n_webhook_url" text,
	"notification_email" boolean,
	"notification_sms" boolean,
	"last_login_at" timestamp,
	"Accounts_id" integer,
	"email" varchar,
	"password_hash" text,
	"preferences" varchar
);
--> statement-breakpoint
ALTER TABLE "p2mxx34fvbf3ll6"."Tasks" ADD CONSTRAINT "Tasks_Accounts_id_Accounts_id_fk" FOREIGN KEY ("Accounts_id") REFERENCES "p2mxx34fvbf3ll6"."Accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2mxx34fvbf3ll6"."Tasks" ADD CONSTRAINT "Tasks_Campaigns_id_Campaigns_id_fk" FOREIGN KEY ("Campaigns_id") REFERENCES "p2mxx34fvbf3ll6"."Campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2mxx34fvbf3ll6"."Tasks" ADD CONSTRAINT "Tasks_Leads_id_Leads_id_fk" FOREIGN KEY ("Leads_id") REFERENCES "p2mxx34fvbf3ll6"."Leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2mxx34fvbf3ll6"."Tasks" ADD CONSTRAINT "Tasks_assigned_to_user_id_Users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "p2mxx34fvbf3ll6"."Users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2mxx34fvbf3ll6"."Tasks" ADD CONSTRAINT "Tasks_created_by_user_id_Users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "p2mxx34fvbf3ll6"."Users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_messages_session_id_idx" ON "p2mxx34fvbf3ll6"."AI_Messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_messages_created_at_idx" ON "p2mxx34fvbf3ll6"."AI_Messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_sessions_user_id_idx" ON "p2mxx34fvbf3ll6"."AI_Sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_sessions_agent_id_idx" ON "p2mxx34fvbf3ll6"."AI_Sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "ai_sessions_session_id_idx" ON "p2mxx34fvbf3ll6"."AI_Sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "automation_logs_accounts_id_idx" ON "p2mxx34fvbf3ll6"."Automation_Logs" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "cmh_campaigns_id_idx" ON "p2mxx34fvbf3ll6"."Campaign_Metrics_History" USING btree ("campaigns_id");--> statement-breakpoint
CREATE INDEX "cmh_metric_date_idx" ON "p2mxx34fvbf3ll6"."Campaign_Metrics_History" USING btree ("metric_date");--> statement-breakpoint
CREATE INDEX "campaigns_accounts_id_idx" ON "p2mxx34fvbf3ll6"."Campaigns" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "contracts_accounts_id_idx" ON "p2mxx34fvbf3ll6"."Contracts" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "contracts_view_token_idx" ON "p2mxx34fvbf3ll6"."Contracts" USING btree ("view_token");--> statement-breakpoint
CREATE INDEX "interactions_leads_id_idx" ON "p2mxx34fvbf3ll6"."Interactions" USING btree ("Leads_id");--> statement-breakpoint
CREATE INDEX "interactions_accounts_id_idx" ON "p2mxx34fvbf3ll6"."Interactions" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "interactions_created_at_idx" ON "p2mxx34fvbf3ll6"."Interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoices_accounts_id_idx" ON "p2mxx34fvbf3ll6"."Invoices" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "p2mxx34fvbf3ll6"."Invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_view_token_idx" ON "p2mxx34fvbf3ll6"."Invoices" USING btree ("view_token");--> statement-breakpoint
CREATE INDEX "lsh_leads_id_idx" ON "p2mxx34fvbf3ll6"."Lead_Score_History" USING btree ("leads_id");--> statement-breakpoint
CREATE INDEX "leads_accounts_id_idx" ON "p2mxx34fvbf3ll6"."Leads" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "leads_campaigns_id_idx" ON "p2mxx34fvbf3ll6"."Leads" USING btree ("Campaigns_id");--> statement-breakpoint
CREATE INDEX "leads_tags_leads_id_idx" ON "p2mxx34fvbf3ll6"."Leads_Tags" USING btree ("Leads_id");--> statement-breakpoint
CREATE INDEX "leads_tags_tags_id_idx" ON "p2mxx34fvbf3ll6"."Leads_Tags" USING btree ("Tags_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "p2mxx34fvbf3ll6"."Notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_account_id_idx" ON "p2mxx34fvbf3ll6"."Notifications" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "p2mxx34fvbf3ll6"."Notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "p2mxx34fvbf3ll6"."Notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "prompt_library_accounts_id_idx" ON "p2mxx34fvbf3ll6"."Prompt_Library" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "support_messages_session_id_idx" ON "p2mxx34fvbf3ll6"."Support_Messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "support_messages_created_at_idx" ON "p2mxx34fvbf3ll6"."Support_Messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_sessions_user_id_idx" ON "p2mxx34fvbf3ll6"."Support_Sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_sessions_session_id_idx" ON "p2mxx34fvbf3ll6"."Support_Sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "tags_accounts_id_idx" ON "p2mxx34fvbf3ll6"."Tags" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "tasks_account_id_idx" ON "p2mxx34fvbf3ll6"."Tasks" USING btree ("Accounts_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "p2mxx34fvbf3ll6"."Tasks" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "p2mxx34fvbf3ll6"."Tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "p2mxx34fvbf3ll6"."Tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "p2mxx34fvbf3ll6"."Users" USING btree ("email");