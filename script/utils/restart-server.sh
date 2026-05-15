#!/bin/bash
# Restart the LeadAwaker dev server (picks up latest code changes)
cd "$(dirname "$0")"
echo "Stopping old server..."
pkill -f "tsx.*server/index.ts" 2>/dev/null && echo "Stopped." || echo "No old server found."
echo "Starting new server..."
nohup node_modules/.bin/tsx watch --env-file=.env server/index.ts > /tmp/leadawaker-server.log 2>&1 &
echo "Server started (PID $!). Logs: tail -f /tmp/leadawaker-server.log"
