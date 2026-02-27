#!/bin/bash
# Post-edit TypeScript check hook
# Runs tsc --noEmit after any edit to client/src .ts/.tsx files
# Outputs errors to stderr so Claude sees them and must fix before finishing
#
# To temporarily disable (e.g. during bulk agent runs):
#   touch /tmp/skip-tsc-check
# To re-enable:
#   rm /tmp/skip-tsc-check

if [ -f /tmp/skip-tsc-check ]; then exit 0; fi

input=$(cat)

# Extract file_path from tool input JSON
file=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    fp = d.get('tool_input', {}).get('file_path', '')
    print(fp)
except:
    print('')
" 2>/dev/null || echo "")

# Only check if a client/src TypeScript file was edited
if echo "$file" | grep -qE 'client/src/.*\.(tsx?|ts)$'; then
  cd /config/workspace/LeadAwakerApp
  result=$(npx tsc --noEmit 2>&1)
  exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "TypeScript errors detected — fix these before finishing:" >&2
    echo "$result" >&2
    exit 2
  fi
fi

exit 0
