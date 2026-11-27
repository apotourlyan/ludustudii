#!/usr/bin/env bash
# Runs the Go backend with Air live reload and the Vite dev server side by side
# (make dev). The backend's output also goes to LOG_FILE, appended. Ctrl+C
# stops both: the trap signals the whole process group, also when the script
# ends after both servers have exited. tee ignores INT and TERM, so it keeps
# writing until Air's output ends and the last lines reach LOG_FILE.
#
# Environment: LOG_FILE, FRONTEND_DIR and GO_TOOL (the command that runs a
# backend tool, here air). make dev also exports LOG_FORMAT and APP_API_DOCS
# for the server.
set -euo pipefail

echo "==> Starting local development servers..."
mkdir -p "$(dirname "$LOG_FILE")"
read -ra tool_cmd <<<"$GO_TOOL"
trap 'kill 0' INT TERM EXIT
("${tool_cmd[@]}" air) 2>&1 | (trap '' INT TERM; exec tee -a "$LOG_FILE") &
(cd "$FRONTEND_DIR" && npm run dev) &
wait
