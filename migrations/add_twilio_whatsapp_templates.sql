-- Add Twilio Content Template SIDs for WhatsApp 24h session window support
ALTER TABLE "p2mxx34fvbf3ll6"."Campaigns" ADD COLUMN IF NOT EXISTS twilio_first_message_template_sid text;
ALTER TABLE "p2mxx34fvbf3ll6"."Campaigns" ADD COLUMN IF NOT EXISTS twilio_bump_template_sid text;

ALTER TABLE "p2mxx34fvbf3ll6"."Interactions" ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;
ALTER TABLE "p2mxx34fvbf3ll6"."Interactions" ADD COLUMN IF NOT EXISTS template_sid text;
