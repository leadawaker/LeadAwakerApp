-- Create Task_Categories table
CREATE TABLE IF NOT EXISTS "p2mxx34fvbf3ll6"."Task_Categories" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "icon" text,
  "color" text,
  "sort_order" integer,
  "is_default" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create Task_Subtasks table with FK to Tasks
CREATE TABLE IF NOT EXISTS "p2mxx34fvbf3ll6"."Task_Subtasks" (
  "id" serial PRIMARY KEY,
  "task_id" integer NOT NULL REFERENCES "p2mxx34fvbf3ll6"."Tasks"("id"),
  "title" text NOT NULL,
  "is_completed" boolean NOT NULL DEFAULT false,
  "sort_order" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Index for efficient lookups by task_id
CREATE INDEX IF NOT EXISTS "task_subtasks_task_id_idx" ON "p2mxx34fvbf3ll6"."Task_Subtasks" ("task_id");
