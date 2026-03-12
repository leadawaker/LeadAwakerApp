-- Seed 4 default task categories (idempotent - only inserts if not already present)
INSERT INTO "p2mxx34fvbf3ll6"."Task_Categories" ("name", "icon", "color", "sort_order", "is_default")
SELECT 'Business', '💼', '#4F46E5', 1, true
WHERE NOT EXISTS (SELECT 1 FROM "p2mxx34fvbf3ll6"."Task_Categories" WHERE "name" = 'Business');

INSERT INTO "p2mxx34fvbf3ll6"."Task_Categories" ("name", "icon", "color", "sort_order", "is_default")
SELECT 'Personal', '🏠', '#10B981', 2, true
WHERE NOT EXISTS (SELECT 1 FROM "p2mxx34fvbf3ll6"."Task_Categories" WHERE "name" = 'Personal');

INSERT INTO "p2mxx34fvbf3ll6"."Task_Categories" ("name", "icon", "color", "sort_order", "is_default")
SELECT 'App Development', '💻', '#F59E0B', 3, true
WHERE NOT EXISTS (SELECT 1 FROM "p2mxx34fvbf3ll6"."Task_Categories" WHERE "name" = 'App Development');

INSERT INTO "p2mxx34fvbf3ll6"."Task_Categories" ("name", "icon", "color", "sort_order", "is_default")
SELECT 'Outreach', '📣', '#EF4444', 4, true
WHERE NOT EXISTS (SELECT 1 FROM "p2mxx34fvbf3ll6"."Task_Categories" WHERE "name" = 'Outreach');
