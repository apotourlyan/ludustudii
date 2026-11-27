#!/usr/bin/env bash
# Runs the end-to-end tests (make test-e2e): builds the client app and the
# binary, creates a database for the run, migrates it, runs Playwright's e2e
# project against it and drops it afterwards, also when a step fails.
#
# The database gets a unique name on the server in DB_TEST_CONNECTION, whose
# role may create databases, as for testkit's templates. The EXIT trap, armed
# before the database is created so no interrupt can slip between the two,
# drops it however the script ends: success, a failing step (set -e) or Ctrl+C
# (the INT and TERM traps exit, which runs the EXIT trap). IF EXISTS covers a
# create that never happened; FORCE ends any connection the server left open.
# --forbid-only fails the run on a test.only left behind (ADR 0034).
#
# Arguments: passed on to Playwright (make test-e2e ARGS=...).
# Environment: DB_TEST_CONNECTION (a postgres:// or postgresql:// URL),
# FRONTEND_DIR, GO_TOOL (the command that runs a backend tool, such as goose),
# MIGRATIONS_DIR (relative to the backend module) and MAKE (the make that
# builds the binary; default: make).
set -euo pipefail

# A PostgreSQL URL, split so the run can swap its database: 1 is the scheme
# and host, 3 the database path, 4 the query.
db_url_pattern='^(postgres(ql)?://[^/?#]+)(/[^?#]*)?(\?.*)?$'

[ -x "$FRONTEND_DIR/node_modules/.bin/playwright" ] ||
	{ echo "test-e2e: $FRONTEND_DIR dependencies missing; run 'make fe-deps'" >&2; exit 1; }
[[ ${DB_TEST_CONNECTION-} =~ $db_url_pattern ]] ||
	{ echo "test-e2e: DB_TEST_CONNECTION must be a postgres:// or postgresql:// URL" >&2; exit 1; }
server=${BASH_REMATCH[1]}
query=${BASH_REMATCH[4]}

echo "==> Building the client app..."
(cd "$FRONTEND_DIR" && npm run --silent build)
"${MAKE:-make}" --no-print-directory be-build

read -ra tool_cmd <<<"$GO_TOOL"
name="ludustudii_e2e_$(date -u +%Y%m%d%H%M%S)_$RANDOM"
url="$server/$name$query"
admin() { psql "$DB_TEST_CONNECTION" -X -q -v ON_ERROR_STOP=1 -c "$1"; }
trap 'echo "==> Dropping database $name..."; admin "DROP DATABASE IF EXISTS $name WITH (FORCE)"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
echo "==> Creating database $name..."
admin "CREATE DATABASE $name"
"${tool_cmd[@]}" goose -dir "$MIGRATIONS_DIR" postgres "$url" up
echo "==> Running end-to-end tests..."
cd "$FRONTEND_DIR"
E2E_DB_CONNECTION="$url" npm run --silent test:e2e -- --forbid-only "$@"
