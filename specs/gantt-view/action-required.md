# Action Required: Gantt View

Manual steps that must be completed by a human.

## Before Implementation
- [ ] **Run the migration** - After creating `migrations/add_task_start_date.sql`, execute it against the NocoDB PostgreSQL database on the Pi: `psql -U postgres -d nocodb -f migrations/add_task_start_date.sql`

## During Implementation
No manual steps required.

## After Implementation
- [ ] **Populate start dates** - Existing tasks have no `startDate`. Consider backfilling key tasks with start dates so the Gantt view has data to display on first use.
