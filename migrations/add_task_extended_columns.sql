-- Add new columns to Tasks table: categoryId, parentTaskId, emoji, timeEstimate
ALTER TABLE "p2mxx34fvbf3ll6"."Tasks"
  ADD COLUMN IF NOT EXISTS "category_id" integer REFERENCES "p2mxx34fvbf3ll6"."Task_Categories"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "parent_task_id" integer REFERENCES "p2mxx34fvbf3ll6"."Tasks"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "emoji" text,
  ADD COLUMN IF NOT EXISTS "time_estimate" integer;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "tasks_category_id_idx" ON "p2mxx34fvbf3ll6"."Tasks" ("category_id");
CREATE INDEX IF NOT EXISTS "tasks_parent_task_id_idx" ON "p2mxx34fvbf3ll6"."Tasks" ("parent_task_id");
