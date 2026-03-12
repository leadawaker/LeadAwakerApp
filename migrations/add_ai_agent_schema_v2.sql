-- Expand AI_Agents table with model, thinking, permissions, page awareness, prompt link, created_by
ALTER TABLE "p2mxx34fvbf3ll6"."AI_Agents"
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  ADD COLUMN IF NOT EXISTS thinking_level text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS page_awareness_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS system_prompt_id integer,
  ADD COLUMN IF NOT EXISTS created_by integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Expand AI_Sessions (agent_conversations) with model, thinking, token counts, is_active, updated_at
ALTER TABLE "p2mxx34fvbf3ll6"."AI_Sessions"
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS thinking_level text,
  ADD COLUMN IF NOT EXISTS total_input_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_output_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Expand AI_Messages (agent_messages) with metadata, attachments, page_context
ALTER TABLE "p2mxx34fvbf3ll6"."AI_Messages"
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb,
  ADD COLUMN IF NOT EXISTS page_context jsonb;

-- Create AI_Files table (agent_files)
CREATE TABLE IF NOT EXISTS "p2mxx34fvbf3ll6"."AI_Files" (
  "id" serial PRIMARY KEY,
  "conversation_id" text NOT NULL,
  "message_id" integer,
  "filename" text NOT NULL,
  "mime_type" text,
  "file_path" text NOT NULL,
  "file_size" integer,
  "transcription" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_files_conversation_id_idx" ON "p2mxx34fvbf3ll6"."AI_Files" ("conversation_id");
CREATE INDEX IF NOT EXISTS "ai_files_message_id_idx" ON "p2mxx34fvbf3ll6"."AI_Files" ("message_id");
