SHELL := /bin/bash
.SHELLFLAGS := -o pipefail -c

# Variables
BINARY_NAME := ludustudii
FRONTEND_DIR := frontend
# Generators that need TypeScript 5's JavaScript API; the client app uses
# TypeScript 7 (ADR 0031).
FRONTEND_TOOLS_DIR := $(FRONTEND_DIR)/tools
BACKEND_DIR := backend
GO_TOOL := go -C $(BACKEND_DIR) tool -modfile=tools/go.mod
BUILD_DIR := backend/bin
SPA_EMBED_DIR := backend/internal/infra/spa/dist
SCALAR_SRC := $(FRONTEND_DIR)/node_modules/@scalar/api-reference/dist/browser/standalone.js
SCALAR_EMBED := backend/internal/infra/apidocs/dist/assets/scalar.js.gz
SPEC_SRC := $(shell find backend/apispec -name '*.yml')
SPEC_BUNDLE := backend/internal/infra/apidocs/dist/openapi.json
API_TYPES := $(FRONTEND_DIR)/src/api/schema.gen.ts
MAIN_REL_DIR := ./cmd/server/api
# go -C runs migration commands from the backend module.
MIGRATIONS_DIR := migrations
# API_DOCS=1 builds the binary with the API reference; any other value omits it.
API_DOCS_TAGS := $(if $(filter 1,$(API_DOCS)),-tags=apidocs)
LOG_FILE ?= $(BACKEND_DIR)/tmp/app.log
PKG ?= ./...
# A PostgreSQL URL, split so test-e2e can swap its database: 1 is the scheme
# and host, 3 the database path, 4 the query.
E2E_DB_URL_PATTERN := ^(postgres(ql)?://[^/?\#]+)(/[^?\#]*)?(\?.*)?$$
RUN ?=
RUN_FLAG = $(if $(RUN),-run '$(RUN)')
# The suites' JUnit reports for the CI job summaries (test-summary),
# written on CI. The frontend's go to frontend/$(JUNIT_DIR), the backend's
# to $(JUNIT_DIR).
JUNIT_DIR := test-results/junit
# The backend test command, run from backend/: go test, or with GO_JUNIT=1
# (CI) gotestsum, which runs go test with the same flags, prints its output
# in go test's format, exits with its code and writes the JUnit report
# $(JUNIT_DIR)/go-<name>.xml. Usage: $(call go_test,<name>) <go test flags>
go_test = $(if $(filter 1,$(GO_JUNIT)),mkdir -p ../$(JUNIT_DIR) && \
	$(GOTESTSUM) --junitfile ../$(JUNIT_DIR)/go-$(1).xml --,go test)
# standard-quiet prints go test's package lines but not a failed test's
# output, which the summary after them lists, without the skipped tests.
# The report names packages relative to the module and leaves out those
# without tests.
GOTESTSUM := go tool -modfile=tools/go.mod gotestsum --format standard-quiet \
	--hide-summary skipped --junitfile-hide-empty-pkg \
	--junitfile-testsuite-name relative --junitfile-testcase-classname relative
# The single pin for golangci-lint, read by the devcontainer and CI through
# install-golangci-lint and enforced by versions-check.
GOLANGCI_LINT_VERSION := v2.15.0

.DEFAULT_GOAL := help
# Deletes a target whose recipe fails, such as a partly written Scalar bundle.
.DELETE_ON_ERROR:

.PHONY: help
## help: Lists available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## //'

$(SPA_EMBED_DIR)/index.html:
	@mkdir -p $(SPA_EMBED_DIR)
	@printf '<!doctype html><title>ludustudii (placeholder)</title>\n' > $@

# Gzips the Scalar bundle when frontend dependencies are installed. Without it
# builds with the apidocs tag still compile, and the server starts without the
# API reference. -n leaves the source name and mtime out of the header, so the
# bytes and their ETag only change with the bundle itself.
$(SCALAR_EMBED): $(wildcard $(SCALAR_SRC))
	@if [ -f $(SCALAR_SRC) ]; then gzip -9nc $(SCALAR_SRC) > $@; fi

dev test-unit test-integration: $(SPA_EMBED_DIR)/index.html
dev test-unit: $(SCALAR_EMBED)

.PHONY: spec-bundle

## spec-bundle: Regenerates the bundled OpenAPI spec the API reference serves, if a spec file changed
spec-bundle: $(SPEC_BUNDLE)

# bundlespec writes the file only once the spec bundles, so a failed run leaves
# it unchanged and .DELETE_ON_ERROR keeps it.
$(SPEC_BUNDLE): $(SPEC_SRC)
	cd $(BACKEND_DIR) && go generate ./internal/infra/apidocs

.PHONY: frontend-deps api-types api-types-check frontend-typecheck frontend-fmt frontend-fmt-check frontend-lint frontend-unit frontend-test

## frontend-deps: Installs the locked dependencies of the client app and its generators, and the browser tests' Chromium
# Playwright installs the headless shell in the version the locked
# @playwright/test expects, into PLAYWRIGHT_BROWSERS_PATH (the devcontainer's
# volume) or its default cache; a no-op when that version is there (ADR 0034).
frontend-deps:
	cd $(FRONTEND_DIR) && npm ci
	cd $(FRONTEND_DIR) && npx --no-install playwright install chromium --only-shell
	cd $(FRONTEND_TOOLS_DIR) && npm ci

## api-types: Regenerates the client app's API types from the bundled OpenAPI spec
api-types: $(SPEC_BUNDLE)
	@[ -d $(FRONTEND_TOOLS_DIR)/node_modules ] || \
		{ echo "api-types: $(FRONTEND_TOOLS_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	cd $(FRONTEND_TOOLS_DIR) && npx --no-install openapi-typescript \
		$(CURDIR)/$(SPEC_BUNDLE) --output $(CURDIR)/$(API_TYPES)

## api-types-check: Fails if regenerating the client app's API types changes them
# Like generate-check, it leaves the regenerated file on disk for review.
api-types-check:
	@before=$$({ sha256sum < $(API_TYPES); } 2>/dev/null); \
		$(MAKE) --no-print-directory api-types >/dev/null || exit 1; \
		[ "$$before" = "$$(sha256sum < $(API_TYPES))" ] || \
		{ echo "api-types-check: $(API_TYPES) is stale; run 'make api-types' and commit the regenerated output"; exit 1; }

## frontend-typecheck: Type-checks the client app, its Vite config and the browser tests
frontend-typecheck:
	@[ -d $(FRONTEND_DIR)/node_modules ] || \
		{ echo "frontend-typecheck: $(FRONTEND_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent typecheck

## frontend-fmt: Formats the client app with oxfmt
frontend-fmt:
	@[ -d $(FRONTEND_DIR)/node_modules ] || \
		{ echo "frontend-fmt: $(FRONTEND_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent fmt

## frontend-fmt-check: Fails if any file of the client app needs formatting
# oxfmt lists the files it would change.
frontend-fmt-check:
	@[ -d $(FRONTEND_DIR)/node_modules ] || \
		{ echo "frontend-fmt-check: $(FRONTEND_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	@cd $(FRONTEND_DIR) && npm run --silent fmt:check || \
		{ echo "frontend-fmt-check: the files above need formatting; run 'make frontend-fmt'" >&2; exit 1; }

## frontend-lint: Lints the client app with Oxlint, type-aware; warnings and unused disable directives fail
# frontend/oxlint.config.ts turns on type-aware rules, denies warnings and
# reports unused disable directives, so the editor applies the same settings.
# The guard looks for the binaries, not only node_modules, so a checkout
# installed before Oxlint was added also gets the hint.
frontend-lint:
	@[ -x $(FRONTEND_DIR)/node_modules/.bin/oxlint ] && [ -x $(FRONTEND_DIR)/node_modules/.bin/tsgolint ] || \
		{ echo "frontend-lint: $(FRONTEND_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent lint

## frontend-unit: Runs the client app's unit tests in Node and its component tests in Chromium, with Vitest
## ---- ARGS passes options to Vitest, for example ARGS='src/shared' or ARGS='--project unit'
# vitest.config.ts has a project per kind of test: *.test.ts in Node and
# *.test.tsx in Chromium's headless shell, the one frontend-deps installs
# (ADR 0043). --allowOnly=false fails the run on a test.only left behind,
# as --forbid-only does for Playwright.
frontend-unit:
	@[ -x $(FRONTEND_DIR)/node_modules/.bin/vitest ] || \
		{ echo "frontend-unit: $(FRONTEND_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent test:unit -- --allowOnly=false $(ARGS)

## frontend-test: Runs the app tests: the client app in Chromium against the fake backend (no Go server or database)
## ---- ARGS passes options to Playwright, for example ARGS='--repeat-each=5' or ARGS='-g conflict'
# playwright.mock.config.ts starts Vite in the mock mode on its own port (ADR 0034):
# the dev server, or, with MOCK_BUILD=1 (CI), a build of the mock mode in
# frontend/dist/mock served by vite preview.
# --forbid-only fails the run on a test.only left behind, which would
# otherwise pass the gate with the other tests skipped.
frontend-test:
	@[ -x $(FRONTEND_DIR)/node_modules/.bin/playwright ] || \
		{ echo "frontend-test: $(FRONTEND_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent test:mock -- --forbid-only $(ARGS)

.PHONY: dev

## dev: Runs Vite dev server and Go backend (with Air live-reload) concurrently
## ---- Backend output is also appended to LOG_FILE (default: backend/tmp/app.log)
dev: export LOG_FORMAT := json
dev: export APP_API_DOCS ?= true
dev:
	@echo "==> Starting local development servers..."
	@mkdir -p $(dir $(LOG_FILE))
	@trap 'kill 0' INT TERM EXIT; \
		($(GO_TOOL) air) 2>&1 | (trap '' INT TERM; exec tee -a $(LOG_FILE)) & \
		(cd $(FRONTEND_DIR) && npm run dev) & \
		wait

.PHONY: dev-mock

## dev-mock: Runs the Vite dev server with a fake backend in the browser (no Go backend or database)
## ---- Choose seeded data with ?scenario=default|empty|many|failing and add latency with ?delay=<ms>
dev-mock:
	cd $(FRONTEND_DIR) && npm run dev:mock

.PHONY: logs logs-errors logs-req logs-slow logs-stats

# Each target reads LOG_FILE line by line and skips lines that are not JSON
# (Air's own output) with 'fromjson?'.

## logs: Follows LOG_FILE and pretty-prints each JSON log record
logs:
	@tail -F $(LOG_FILE) | jq --unbuffered -R 'fromjson? | .'

## logs-errors: Prints ERROR and WARN records from LOG_FILE
logs-errors:
	@jq -cR 'fromjson? | select(.level == "ERROR" or .level == "WARN")' $(LOG_FILE)

## logs-req: Prints every record for the request with the given ID
## ---- Usage: make logs-req ID=<request id>
logs-req:
	@if [ -z "$(ID)" ]; then echo "Error: ID is required (e.g., make logs-req ID=abc123)"; exit 1; fi
	@jq -cR --arg id "$(ID)" 'fromjson? | select(.request_id == $$id)' $(LOG_FILE)

## logs-slow: Prints "request" records slower than MS milliseconds (default 200)
## ---- Usage: make logs-slow MS=500
logs-slow: MS ?= 200
logs-slow:
	@jq -cR --argjson ms "$(MS)" \
		'fromjson? | select(.msg == "request" and .latency > $$ms * 1000000)' $(LOG_FILE)

## logs-stats: Counts "request" records by status, method and route, most frequent first
logs-stats:
	@jq -nrR '[inputs | fromjson? | select(.msg == "request") | {status, method, route}] | group_by(.) | map({count: length} + .[0]) | sort_by(-.count) | .[] | "\(.count)\t\(.status)\t\(.method)\t\(.route)"' $(LOG_FILE)

.PHONY: test test-unit test-integration coverage test-e2e

## test: Runs both unit and integration tests
test: test-unit test-integration

## test-unit: Runs unit tests with the 'unit' build tag
## ---- PKG selects packages; RUN selects test names (defaults: all packages and tests)
## ---- If selected, the apidocs package runs again with the 'apidocs' tag
## ---- GO_JUNIT=1 (CI) also writes JUnit reports to test-results/junit/ (go-unit.xml, go-unit-apidocs.xml)
test-unit:
	@echo "==> Running unit tests..."
	cd $(BACKEND_DIR) && $(call go_test,unit) -tags=unit -race -count=1 -shuffle=on $(RUN_FLAG) $(PKG) 2>&1 | { grep --line-buffered -v '^?' || [ $$? -eq 1 ]; }
	@cd $(BACKEND_DIR) && packages=$$(go list -f '{{.Dir}}' $(PKG)) && \
		if printf '%s\n' "$$packages" | grep -Fxq "$$PWD/internal/infra/apidocs"; then \
			$(call go_test,unit-apidocs) -tags=unit,apidocs -race -count=1 -shuffle=on $(RUN_FLAG) ./internal/infra/apidocs/; \
		fi

## test-integration: Runs integration tests with the 'integration' build tag
## ---- PKG selects packages; RUN selects test names (defaults: all packages and tests)
## ---- GO_JUNIT=1 (CI) also writes a JUnit report to test-results/junit/go-integration.xml
test-integration:
	@echo "==> Running integration tests..."
	cd $(BACKEND_DIR) && $(call go_test,integration) -tags=integration -race -count=1 -shuffle=on $(RUN_FLAG) $(PKG) 2>&1 | { grep --line-buffered -v '^?' || [ $$? -eq 1 ]; }

## coverage: Runs all backend tests and writes coverage profile and HTML report to backend/coverage/ (requires DB_TEST_CONNECTION)
coverage: $(SPA_EMBED_DIR)/index.html $(SCALAR_EMBED)
	@mkdir -p $(BACKEND_DIR)/coverage
	go -C $(BACKEND_DIR) test -tags=unit,integration,apidocs -race -count=1 -coverpkg=./... -coverprofile=coverage/coverage.out ./...
	go -C $(BACKEND_DIR) tool cover -html=coverage/coverage.out -o coverage/coverage.html
	@echo "Serve from the repository root: python3 -m http.server 8000 --directory backend/coverage"

## test-e2e: Runs the end-to-end tests: the built binary in Chromium, on a database made for the run (requires DB_TEST_CONNECTION)
## ---- Builds the client app and the binary, creates and migrates the database, and drops it afterwards, also when a test fails
## ---- ARGS passes options to Playwright, for example ARGS='--repeat-each=5'
# The database gets a unique name on the server in DB_TEST_CONNECTION, whose
# role may create databases, as for testkit's templates. The EXIT trap,
# armed before the database is created so no interrupt can slip between the
# two, drops it however the shell ends: success, a failing step (set -e) or
# Ctrl+C (the INT and TERM traps exit, which runs the EXIT trap). IF EXISTS
# covers a create that never happened; FORCE ends any connection the server
# left open. --forbid-only fails the run on a test.only left behind (ADR 0034).
test-e2e:
	@[ -x $(FRONTEND_DIR)/node_modules/.bin/playwright ] || \
		{ echo "test-e2e: $(FRONTEND_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	@[[ $${DB_TEST_CONNECTION-} =~ $(E2E_DB_URL_PATTERN) ]] || \
		{ echo "test-e2e: DB_TEST_CONNECTION must be a postgres:// or postgresql:// URL" >&2; exit 1; }
	@echo "==> Building the client app..."
	cd $(FRONTEND_DIR) && npm run --silent build
	$(MAKE) --no-print-directory build-backend
	@set -eu; \
		[[ $$DB_TEST_CONNECTION =~ $(E2E_DB_URL_PATTERN) ]]; \
		name="ludustudii_e2e_$$(date -u +%Y%m%d%H%M%S)_$$RANDOM"; \
		url="$${BASH_REMATCH[1]}/$$name$${BASH_REMATCH[4]}"; \
		admin() { psql "$$DB_TEST_CONNECTION" -X -q -v ON_ERROR_STOP=1 -c "$$1"; }; \
		trap 'echo "==> Dropping database $$name..."; admin "DROP DATABASE IF EXISTS $$name WITH (FORCE)"' EXIT; \
		trap 'exit 130' INT; \
		trap 'exit 143' TERM; \
		echo "==> Creating database $$name..."; \
		admin "CREATE DATABASE $$name"; \
		$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$$url" up; \
		echo "==> Running end-to-end tests..."; \
		cd $(FRONTEND_DIR) && E2E_DB_CONNECTION="$$url" npm run --silent test:e2e -- --forbid-only $(ARGS)

.PHONY: test-summary

## test-summary: Renders the test suites' JUnit reports as Markdown, into GITHUB_STEP_SUMMARY on CI, else to stdout
## ---- The reports are written only on CI: CI=true for Vitest and Playwright, GO_JUNIT=1 for the Go tests
# One section per suite, in make check's order, then the end-to-end tests.
# A missing report (its suite didn't run) is skipped; one that can't be read
# gets a section that says so and fails the target.
test-summary:
	@[ -d $(FRONTEND_TOOLS_DIR)/node_modules ] || \
		{ echo "test-summary: $(FRONTEND_TOOLS_DIR) dependencies missing; run 'make frontend-deps'" >&2; exit 1; }
	@node $(FRONTEND_TOOLS_DIR)/junit-summary.ts \
		'Vitest=$(FRONTEND_DIR)/$(JUNIT_DIR)/vitest.xml' \
		'Playwright app tests=$(FRONTEND_DIR)/$(JUNIT_DIR)/playwright-mock.xml' \
		'Go unit tests=$(JUNIT_DIR)/go-unit.xml' \
		'Go unit tests with the apidocs tag=$(JUNIT_DIR)/go-unit-apidocs.xml' \
		'Go integration tests=$(JUNIT_DIR)/go-integration.xml' \
		'Playwright end-to-end tests=$(FRONTEND_DIR)/$(JUNIT_DIR)/playwright-e2e.xml' \
		>> "$${GITHUB_STEP_SUMMARY:-/dev/stdout}"

.PHONY: build build-frontend build-backend clean

## build: Compiles frontend, outputs assets, and compiles Go binary
build:
	$(MAKE) build-frontend
	$(MAKE) build-backend

## build-frontend: Installs dependencies and builds Vite static output
build-frontend:
	@echo "==> Building frontend bundle..."
	cd $(FRONTEND_DIR) && npm ci && npm run build
	@echo "==> Frontend bundle built successfully."

## build-backend: Compiles static Go binary with embedded SPA
## ---- API_DOCS=1 also embeds the API reference (for dev, test and staging builds)
ifeq ($(API_DOCS),1)
build-backend: $(SCALAR_EMBED)
endif
build-backend:
	@! grep -qs 'ludustudii (placeholder)' $(SPA_EMBED_DIR)/index.html || \
		{ echo "SPA not built: run 'make build-frontend' first"; exit 1; }
ifeq ($(API_DOCS),1)
	@[ -s $(SCALAR_EMBED) ] || \
		{ echo "Scalar bundle missing: run 'make build-frontend' first"; exit 1; }
endif
	@echo "==> Building Go binary..."
	mkdir -p $(BUILD_DIR)
	cd $(BACKEND_DIR) && CGO_ENABLED=0 go build $(API_DOCS_TAGS) -ldflags="-w -s" -o ../$(BUILD_DIR)/$(BINARY_NAME) $(MAIN_REL_DIR)
	@echo "==> Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

## clean: Deletes build outputs and temporary embed files
clean:
	@echo "==> Cleaning artifacts..."
	rm -rf $(BUILD_DIR)
	rm -rf $(BACKEND_DIR)/tmp
	rm -rf $(SPA_EMBED_DIR)
	rm -f $(SCALAR_EMBED)
	@echo "==> Clean complete."

.PHONY: require-db migrate-create migrate-up migrate-down migrate-status

require-db:
	@[ -n "$(DB_CONNECTION)" ] || { echo "Error: DB_CONNECTION is not set"; exit 1; }

migrate-up migrate-down migrate-status psql: require-db

## migrate-create: Creates a new database migration file with the given NAME
## ---- Usage: make migrate-create NAME=migration_name
migrate-create:
	@if [ -z "$(NAME)" ]; then echo "Error: NAME is required (e.g., make migrate-create NAME=add_users)"; exit 1; fi
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) create $(NAME) sql

## migrate-up: Applies all pending database migrations
migrate-up:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" up
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" version

## migrate-down: Rolls back the most recently applied database migration (down by one)
migrate-down:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" down
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" version

## migrate-status: Shows the status of all database migrations
migrate-status:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" status

.PHONY: psql

## psql: Connects to the PostgreSQL database using DB_CONNECTION environment variable
psql:
	@echo "==> Connecting to PostgreSQL..."
	@psql "$(DB_CONNECTION)"

.PHONY: git-diff

## git-diff: Copies the git diff to the system clipboard in a terminal-friendly format
git-diff:
	git diff HEAD | base64 | tr -d '\n' | awk '{print "\033]52;c;" $$0 "\007"}'

.PHONY: check

## check: Runs every gate a change must pass (fast to slow). Agents and CI run this.
# Separate recursive calls preserve order and stop on failure, including with -j.
check:
	$(MAKE) versions-check
	$(MAKE) fmt-check
	$(MAKE) frontend-fmt-check
	$(MAKE) test-tags-check
	$(MAKE) pr-title-check-test
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

.PHONY: versions-check install-golangci-lint

## versions-check: Fails if a tool version disagrees with its single source
# Go: backend/go.mod is the source for the devcontainer's golang: image tag
# (any -variant suffix ignored) and backend/tools/go.mod. golangci-lint: the
# installed binary must match GOLANGCI_LINT_VERSION, compared without a leading v.
# Node: engines.node in frontend/package.json (for example 26.x) is the source
# for the major version of the devcontainer's node feature and the installed node.
versions-check:
	@status=0; \
	go_line() { awk '$$1 == "go" { print $$2; exit }' "$$1"; }; \
	want=$$(go_line $(BACKEND_DIR)/go.mod); \
	tools=$$(go_line $(BACKEND_DIR)/tools/go.mod); \
	if [ "$$tools" != "$$want" ]; then \
		echo "$(BACKEND_DIR)/tools/go.mod: go '$${tools:-none}', want '$$want' (from $(BACKEND_DIR)/go.mod)"; \
		status=1; \
	fi; \
	image=$$(sed -n 's/^[[:space:]]*image:[[:space:]]*golang:\([^[:space:]]*\).*/\1/p' .devcontainer/docker-compose.yml); \
	if [ "$${image%%-*}" != "$$want" ]; then \
		echo ".devcontainer/docker-compose.yml: golang image '$${image:-none}', want '$$want' (from $(BACKEND_DIR)/go.mod)"; \
		status=1; \
	fi; \
	pin='$(GOLANGCI_LINT_VERSION)'; \
	lint=$$(golangci-lint version --short 2>/dev/null); \
	if [ "$${lint#v}" != "$${pin#v}" ]; then \
		echo "golangci-lint: installed '$${lint:-none}', want '$${pin#v}' (GOLANGCI_LINT_VERSION); run 'make install-golangci-lint'"; \
		status=1; \
	fi; \
	engines=$$(sed -n '/"engines"[[:space:]]*:/,/}/s/^[[:space:]]*"node"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' $(FRONTEND_DIR)/package.json); \
	node_want=$${engines%%.*}; \
	if [[ ! $$node_want =~ ^[0-9]+$$ ]]; then \
		echo "$(FRONTEND_DIR)/package.json: engines.node '$${engines:-none}', want a major version such as '26.x'"; \
		exit 1; \
	fi; \
	feature=$$(sed -n '/devcontainers\/features\/node:/,/}/s/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .devcontainer/devcontainer.json); \
	if [ "$${feature%%.*}" != "$$node_want" ]; then \
		echo ".devcontainer/devcontainer.json: node feature version '$${feature:-none}', want major '$$node_want' (from $(FRONTEND_DIR)/package.json engines.node)"; \
		status=1; \
	fi; \
	node=$$(node --version 2>/dev/null); node=$${node#v}; \
	if [ "$${node%%.*}" != "$$node_want" ]; then \
		echo "node: installed '$${node:-none}', want major '$$node_want' (from $(FRONTEND_DIR)/package.json engines.node)"; \
		status=1; \
	fi; \
	exit $$status

## install-golangci-lint: Installs golangci-lint at GOLANGCI_LINT_VERSION into $(go env GOPATH)/bin
# The standalone binary keeps lint tooling out of the backend modules.
install-golangci-lint:
	curl -sSfL "https://raw.githubusercontent.com/golangci/golangci-lint/$(GOLANGCI_LINT_VERSION)/install.sh" \
		| sh -s -- -b "$$(go env GOPATH)/bin" "$(GOLANGCI_LINT_VERSION)"
	"$$(go env GOPATH)/bin/golangci-lint" version

.PHONY: lint lint-fix fmt fmt-check lint-verify

## lint: Lints the backend and tagged tests with API docs enabled
lint: $(SPA_EMBED_DIR)/index.html $(SCALAR_EMBED)
	cd $(BACKEND_DIR) && golangci-lint run

## lint-fix: Applies backend lint fixes with API docs enabled
lint-fix: $(SPA_EMBED_DIR)/index.html $(SCALAR_EMBED)
	cd $(BACKEND_DIR) && golangci-lint run --fix

## fmt: Formats the backend with gofumpt and goimports
fmt:
	cd $(BACKEND_DIR) && golangci-lint fmt

## fmt-check: Fails if any file needs formatting
fmt-check:
	cd $(BACKEND_DIR) && golangci-lint fmt --diff

## lint-verify: Validates the backend golangci-lint configuration
lint-verify:
	cd $(BACKEND_DIR) && golangci-lint config verify

.PHONY: vuln frontend-vuln

## vuln: Checks backend packages and the client app's npm dependencies for known vulnerabilities
# Outside check: both depend on an external vulnerability database (ADR 0020).
vuln: $(SPA_EMBED_DIR)/index.html
	$(GO_TOOL) govulncheck ./...
	$(MAKE) --no-print-directory frontend-vuln

## frontend-vuln: Audits the npm dependencies of the client app and its generators
## ---- Fails on a moderate advisory in what ships to the browser, and on a high one anywhere
# npm audit reads only the lockfiles, so it doesn't need node_modules. The
# client app's production dependencies ship to the browser, so they fail at
# moderate; its dev dependencies and the generators in frontend/tools only run
# on developer machines and CI, so they fail at high.
frontend-vuln:
	cd $(FRONTEND_DIR) && npm audit --omit=dev --audit-level=moderate
	cd $(FRONTEND_DIR) && npm audit --audit-level=high
	cd $(FRONTEND_TOOLS_DIR) && npm audit --audit-level=high

.PHONY: test-tags-check

## test-tags-check: Fails if a backend test file's name and build tag disagree
# *_integration_test.go and api_test.go need exactly //go:build integration;
# every other test file needs exactly //go:build unit. Untracked files count.
test-tags-check:
	@cd $(BACKEND_DIR) && status=0; \
	while IFS= read -r -d '' file; do \
		[ -f "$$file" ] || continue; \
		case "$$file" in \
			*_integration_test.go | api_test.go | */api_test.go) want=integration ;; \
			*) want=unit ;; \
		esac; \
		got=$$(awk '/^\/\/go:build /{ sub(/^\/\/go:build /, ""); print; exit }' "$$file"); \
		if [ "$$got" != "$$want" ]; then \
			echo "$$file: build tag '$${got:-none}', want '$$want'"; \
			status=1; \
		fi; \
	done < <(git ls-files -z --cached --others --exclude-standard -- '*_test.go'); \
	exit $$status

.PHONY: pr-title-check pr-title-check-test

# Pull requests are squash-merged, so a title becomes a commit subject on main.
# These are the only copies of the title rules; CI (pr-title.yml) runs the check.
PR_TITLE_TYPES := feat fix refactor test docs build ci dev
# Squash merging appends " (#N)"; 64 keeps the subject within 72 characters
# for pull request numbers up to four digits.
PR_TITLE_MAX := 64

## pr-title-check: Fails if PR_TITLE breaks the pull request title format 'type: summary'
## ---- Usage: PR_TITLE='feat: add decks' make pr-title-check
# The title is read from the environment only, never expanded by make or
# interpolated into the script, because it is untrusted text.
pr-title-check:
	@title=$${PR_TITLE-}; types='$(PR_TITLE_TYPES)'; max=$(PR_TITLE_MAX); broken=(); \
	format="^($${types// /|}): [^ ]"; \
	if [[ ! $$title =~ $$format ]]; then \
		broken+=("a type, a colon and exactly one space come before the summary (no scope)"); \
	elif [[ ! $${title#*: } =~ ^[a-z0-9] ]]; then \
		broken+=("the summary starts with a lowercase letter or a digit"); \
	fi; \
	[[ $$title != *. ]] || broken+=("no trailing period"); \
	[ $${#title} -le $$max ] || broken+=("at most $$max characters (this title has $${#title})"); \
	if [ $${#broken[@]} -eq 0 ]; then \
		printf 'pr-title-check: ok: %s\n' "$$title"; \
		exit 0; \
	fi; \
	printf 'pr-title-check: invalid title: "%s"\n' "$$title"; \
	printf 'Broken rule: %s\n' "$${broken[@]}"; \
	printf 'Expected format: type: summary (for example "feat: add deck sharing")\n'; \
	printf '  type: one of %s\n' "$${types// /, }"; \
	printf '  summary: starts with a lowercase letter or a digit, no trailing period\n'; \
	printf '  length: at most %s characters, so the " (#N)" squash merging appends fits within 72\n' "$$max"; \
	exit 1

## pr-title-check-test: Fails if pr-title-check accepts or rejects a title in its test table unexpectedly
# Each case is 'want|title'. The two generated titles sit on the length
# boundary: "feat: " plus 58 or 59 digits is 64 or 65 characters.
pr-title-check-test:
	@status=0; \
	cases=( \
		'pass|feat: add deck sharing' \
		'pass|ci: check pull request titles' \
		'pass|fix: 404 for missing decks' \
		"pass|$$(printf 'feat: %058d' 0)" \
		"fail|$$(printf 'feat: %059d' 0)" \
		'fail|' \
		'fail|chore: bump tools' \
		'fail|Feat: add deck sharing' \
		'fail|feat(decks): add sharing' \
		'fail|feat:add deck sharing' \
		'fail|feat:  add deck sharing' \
		'fail|feat: ' \
		'fail|feat: Add deck sharing' \
		'fail|feat: add deck sharing.' \
	); \
	for case in "$${cases[@]}"; do \
		want=$${case%%|*}; title=$${case#*|}; \
		if PR_TITLE=$$title $(MAKE) --no-print-directory pr-title-check >/dev/null 2>&1; then got=pass; else got=fail; fi; \
		if [ "$$got" != "$$want" ]; then \
			printf 'pr-title-check-test: "%s": got %s, want %s\n' "$$title" "$$got" "$$want"; \
			status=1; \
		fi; \
	done; \
	exit $$status

.PHONY: tidy-check generate-check

## tidy-check: Fails if app or tool go.mod/go.sum files are not tidy
tidy-check:
	go -C $(BACKEND_DIR) mod tidy -diff
	go -C $(BACKEND_DIR)/tools mod tidy -diff

## generate-check: Fails if generation changes tracked backend files
generate-check: $(SPA_EMBED_DIR)/index.html
	@cd $(BACKEND_DIR) && snap() { \
		git ls-files -z | while IFS= read -r -d '' file; do \
			[ ! -f "$$file" ] || sha256sum -- "$$file" || return 1; \
		done; \
	}; \
		before=$$(snap) && go generate ./... || exit 1; \
		[ "$$before" = "$$(snap)" ] || \
		{ echo "generate-check: generated files are stale; commit the regenerated output"; exit 1; }
