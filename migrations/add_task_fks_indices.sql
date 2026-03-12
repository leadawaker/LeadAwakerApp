-- Add category_id and parent_task_id columns to Tasks table
ALTER TABLE "p2mxx34fvbf3ll6"."Tasks"
  ADD COLUMN IF NOT EXISTS category_id integer,
  ADD COLUMN IF NOT EXISTS parent_task_id integer;

-- FK: tasks.category_id → task_categories.id (SET NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Tasks_category_id_fkey'
    AND table_schema = 'p2mxx34fvbf3ll6'
  ) THEN
    ALTER TABLE "p2mxx34fvbf3ll6"."Tasks"
      ADD CONSTRAINT "Tasks_category_id_fkey"
      FOREIGN KEY (category_id) REFERENCES "p2mxx34fvbf3ll6"."Task_Categories"(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- FK: tasks.parent_task_id → tasks.id (self-referencing, SET NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Tasks_parent_task_id_fkey'
    AND table_schema = 'p2mxx34fvbf3ll6'
  ) THEN
    ALTER TABLE "p2mxx34fvbf3ll6"."Tasks"
      ADD CONSTRAINT "Tasks_parent_task_id_fkey"
      FOREIGN KEY (parent_task_id) REFERENCES "p2mxx34fvbf3ll6"."Tasks"(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- FK: task_subtasks.task_id → tasks.id already exists, but ensure CASCADE on delete
-- Check current behavior and update if needed
DO $$
BEGIN
  -- Drop existing FK if it doesn't have CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = 'p2mxx34fvbf3ll6'
    AND tc.table_name = 'Task_Subtasks'
    AND tc.constraint_name = 'Task_Subtasks_task_id_fkey'
    AND rc.delete_rule != 'CASCADE'
  ) THEN
    ALTER TABLE "p2mxx34fvbf3ll6"."Task_Subtasks"
      DROP CONSTRAINT "Task_Subtasks_task_id_fkey";
    ALTER TABLE "p2mxx34fvbf3ll6"."Task_Subtasks"
      ADD CONSTRAINT "Task_Subtasks_task_id_fkey"
      FOREIGN KEY (task_id) REFERENCES "p2mxx34fvbf3ll6"."Tasks"(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Index on tasks.category_id for filtering
CREATE INDEX IF NOT EXISTS "tasks_category_id_idx" ON "p2mxx34fvbf3ll6"."Tasks" (category_id);

-- Index on tasks.parent_task_id for hierarchy queries
CREATE INDEX IF NOT EXISTS "tasks_parent_task_id_idx" ON "p2mxx34fvbf3ll6"."Tasks" (parent_task_id);
