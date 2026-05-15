#!/bin/bash
# Deletes automation log records older than 30 days.
# Runs nightly at 3 AM via cron.

PGPASSWORD=1234Bananas psql \
  -h 127.0.0.1 -U leadawaker -d nocodb \
  -c "DELETE FROM \"p2mxx34fvbf3ll6\".\"Automation_Logs\" WHERE created_at < NOW() - INTERVAL '3 days';"

echo "[$(date)] Automation logs cleanup complete"
