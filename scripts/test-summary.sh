#!/usr/bin/env bash
# Renders the test suites' JUnit reports as Markdown (make test-summary): into
# GITHUB_STEP_SUMMARY on CI, else to stdout. One section per suite, in make
# check's order, then the end-to-end tests. A missing report (its suite didn't
# run) is skipped; one that can't be read gets a section that says so and fails
# the script.
#
# Environment: FRONTEND_DIR, FRONTEND_TOOLS_DIR, JUNIT_DIR (the reports'
# folder, under FRONTEND_DIR for the frontend's and under the repository root
# for the backend's) and GITHUB_STEP_SUMMARY (optional).
set -euo pipefail

[ -d "$FRONTEND_TOOLS_DIR/node_modules" ] ||
	{ echo "test-summary: $FRONTEND_TOOLS_DIR dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
node "$FRONTEND_TOOLS_DIR/junit-summary.ts" \
	"Vitest=$FRONTEND_DIR/$JUNIT_DIR/vitest.xml" \
	"Playwright tests (mock back-end)=$FRONTEND_DIR/$JUNIT_DIR/playwright-mock.xml" \
	"Go unit tests=$JUNIT_DIR/go-unit.xml" \
	"Go apidocs tests=$JUNIT_DIR/go-unit-apidocs.xml" \
	"Go integration tests=$JUNIT_DIR/go-integration.xml" \
	"Playwright end-to-end tests=$FRONTEND_DIR/$JUNIT_DIR/playwright-e2e.xml" \
	>> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
