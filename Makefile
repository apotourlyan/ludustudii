SHELL := /bin/bash
.SHELLFLAGS := -o pipefail -c

# The targets live in make/<area>.mk, one file per area, and recipes longer
# than about five lines, or with control flow, in scripts/<name>.sh (README:
# Development → Makefile and scripts). This file keeps the variables more than
# one area uses, help, check and the includes.

# Shared variables
FRONTEND_DIR := frontend
# Generators that need TypeScript 5's JavaScript API; the client app uses
# TypeScript 7 (ADR 0031).
FRONTEND_TOOLS_DIR := $(FRONTEND_DIR)/tools
BACKEND_DIR := backend
GO_TOOL := go -C $(BACKEND_DIR) tool -modfile=tools/go.mod
SPA_EMBED_DIR := backend/internal/infra/spa/dist
SCALAR_EMBED := backend/internal/infra/apidocs/dist/assets/scalar.js.gz
SPEC_BUNDLE := backend/internal/infra/apidocs/dist/openapi.json
# go -C runs migration commands from the backend module.
MIGRATIONS_DIR := migrations
# The suites' JUnit reports for the CI job summaries (test-summary),
# written on CI. The frontend's go to frontend/$(JUNIT_DIR), the backend's
# to $(JUNIT_DIR).
JUNIT_DIR := test-results/junit

.DEFAULT_GOAL := help
# Deletes a target whose recipe fails, such as a partly written Scalar bundle.
.DELETE_ON_ERROR:

##@ General

.PHONY: help
## help: Lists available targets
# Prints each file's targets under its ##@ heading, in include order.
help:
	@awk '/^##@ /{ printf "%s%s (%s)\n", (n++ ? "\n" : ""), substr($$0, 5), FILENAME; next } \
		/^## /{ print "  " substr($$0, 4) }' $(MAKEFILE_LIST)

.PHONY: check

## check: Runs every gate a change must pass (fast to slow). Agents and CI run this.
# Separate recursive calls preserve order and stop on failure, including with -j.
check:
	$(MAKE) versions-check
	$(MAKE) fmt-check
	$(MAKE) frontend-fmt-check
	$(MAKE) test-tags-check
	$(MAKE) pr-title-check-test
	$(MAKE) scripts-lint
	$(MAKE) lint
	$(MAKE) tidy-check
	$(MAKE) generate-check
	$(MAKE) api-types-check
	$(MAKE) frontend-typecheck
	$(MAKE) frontend-lint
	$(MAKE) frontend-unit
	$(MAKE) frontend-test
	$(MAKE) test-unit
	$(MAKE) test-integration

include make/backend.mk
include make/frontend.mk
include make/db.mk
include make/dev.mk
include make/ci.mk
