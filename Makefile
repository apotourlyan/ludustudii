SHELL := /bin/bash
.SHELLFLAGS := -o pipefail -c

# The targets live in make/<area>.mk, one file per area, and recipes longer
# than about five lines, or with control flow, in scripts/<name>.sh (README:
# Development → Makefile and scripts). A target is named <area>-<action>, with
# be-, fe-, db-, logs- or ci-; those in proj.mk and misc.mk have no prefix.
# This file keeps the variables more than one area uses and the includes, in
# the order make help lists the areas.

# Shared variables
FRONTEND_DIR := frontend
# Generators that need TypeScript 5's JavaScript API; the client app uses
# TypeScript 7 (ADR 0031).
FRONTEND_TOOLS_DIR := $(FRONTEND_DIR)/tools
BACKEND_DIR := backend
BUILD_DIR := backend/bin
GO_TOOL := go -C $(BACKEND_DIR) tool -modfile=tools/go.mod
SPA_EMBED_DIR := backend/internal/infra/spa/dist
SCALAR_EMBED := backend/internal/infra/apidocs/dist/assets/scalar.js.gz
SPEC_BUNDLE := backend/internal/infra/apidocs/dist/openapi.json
# go -C runs migration commands from the backend module.
MIGRATIONS_DIR := migrations
# The suites' JUnit reports for the CI job summaries (ci-test-summary),
# written on CI. The frontend's go to frontend/$(JUNIT_DIR), the backend's
# to $(JUNIT_DIR).
JUNIT_DIR := test-results/junit
# The backend's log, written by make dev and read by the logs targets.
LOG_FILE ?= $(BACKEND_DIR)/tmp/app.log
# The single pin for golangci-lint, read by the devcontainer and CI through
# ci-lint-install and enforced by versions-check.
GOLANGCI_LINT_VERSION := v2.15.0

.DEFAULT_GOAL := help
# Deletes a target whose recipe fails, such as a partly written Scalar bundle.
.DELETE_ON_ERROR:

include make/be.mk
include make/fe.mk
include make/db.mk
include make/logs.mk
include make/ci.mk
include make/proj.mk
include make/misc.mk
