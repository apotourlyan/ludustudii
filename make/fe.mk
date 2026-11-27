##@ Frontend
# The client app: its dependencies, generated API types, checks, tests, build
# and the npm dependencies' vulnerability scan.

API_TYPES := $(FRONTEND_DIR)/src/api/schema.gen.ts

.PHONY: fe-deps fe-api-types fe-api-types-check fe-typecheck fe-fmt fe-fmt-check fe-lint

## fe-deps: Installs the locked dependencies of the client app and its generators, and the browser tests' Chromium
# Playwright installs the headless shell in the version the locked
# @playwright/test expects, into PLAYWRIGHT_BROWSERS_PATH (the devcontainer's
# volume) or its default cache; a no-op when that version is there (ADR 0034).
fe-deps:
	cd $(FRONTEND_DIR) && npm ci
	cd $(FRONTEND_DIR) && npx --no-install playwright install chromium --only-shell
	cd $(FRONTEND_TOOLS_DIR) && npm ci

## fe-api-types: Regenerates the client app's API types from the bundled OpenAPI spec
fe-api-types: $(SPEC_BUNDLE)
	@[ -d $(FRONTEND_TOOLS_DIR)/node_modules ] || \
		{ echo "fe-api-types: $(FRONTEND_TOOLS_DIR) dependencies missing; run 'make fe-deps'" >&2; exit 1; }
	cd $(FRONTEND_TOOLS_DIR) && npx --no-install openapi-typescript \
		$(CURDIR)/$(SPEC_BUNDLE) --output $(CURDIR)/$(API_TYPES)

## fe-api-types-check: Fails if regenerating the client app's API types changes them
# Like be-generate-check, it leaves the regenerated file on disk for review.
fe-api-types-check:
	@before=$$({ sha256sum < $(API_TYPES); } 2>/dev/null); \
		$(MAKE) --no-print-directory fe-api-types >/dev/null || exit 1; \
		[ "$$before" = "$$(sha256sum < $(API_TYPES))" ] || \
		{ echo "fe-api-types-check: $(API_TYPES) is stale; run 'make fe-api-types' and commit the regenerated output"; exit 1; }

## fe-typecheck: Type-checks the client app, its Vite config and the browser tests
fe-typecheck:
	@[ -d $(FRONTEND_DIR)/node_modules ] || \
		{ echo "fe-typecheck: $(FRONTEND_DIR) dependencies missing; run 'make fe-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent typecheck

## fe-fmt: Formats the client app with oxfmt
fe-fmt:
	@[ -d $(FRONTEND_DIR)/node_modules ] || \
		{ echo "fe-fmt: $(FRONTEND_DIR) dependencies missing; run 'make fe-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent fmt

## fe-fmt-check: Fails if any file of the client app needs formatting
# oxfmt lists the files it would change.
fe-fmt-check:
	@[ -d $(FRONTEND_DIR)/node_modules ] || \
		{ echo "fe-fmt-check: $(FRONTEND_DIR) dependencies missing; run 'make fe-deps'" >&2; exit 1; }
	@cd $(FRONTEND_DIR) && npm run --silent fmt:check || \
		{ echo "fe-fmt-check: the files above need formatting; run 'make fe-fmt'" >&2; exit 1; }

## fe-lint: Lints the client app with Oxlint, type-aware; warnings and unused disable directives fail
# frontend/oxlint.config.ts turns on type-aware rules, denies warnings and
# reports unused disable directives, so the editor applies the same settings.
# The guard looks for the binaries, not only node_modules, so a checkout
# installed before Oxlint was added also gets the hint.
fe-lint:
	@[ -x $(FRONTEND_DIR)/node_modules/.bin/oxlint ] && [ -x $(FRONTEND_DIR)/node_modules/.bin/tsgolint ] || \
		{ echo "fe-lint: $(FRONTEND_DIR) dependencies missing; run 'make fe-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent lint

.PHONY: fe-test fe-test-unit fe-test-integration

## fe-test: Runs the client app's unit and integration tests
fe-test: fe-test-unit fe-test-integration

## fe-test-unit: Runs the client app's unit tests in Node and its component tests in Chromium, with Vitest
## ---- ARGS passes options to Vitest, for example ARGS='src/shared' or ARGS='--project unit'
# vitest.config.ts has a project per kind of test: *.test.ts in Node and
# *.test.tsx in Chromium's headless shell, the one fe-deps installs
# (ADR 0043). --allowOnly=false fails the run on a test.only left behind,
# as --forbid-only does for Playwright.
fe-test-unit:
	@[ -x $(FRONTEND_DIR)/node_modules/.bin/vitest ] || \
		{ echo "fe-test-unit: $(FRONTEND_DIR) dependencies missing; run 'make fe-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent test:unit -- --allowOnly=false $(ARGS)

## fe-test-integration: Runs the client app's integration tests: the app in Chromium against the fake backend (no Go server or database)
## ---- ARGS passes options to Playwright, for example ARGS='--repeat-each=5' or ARGS='-g conflict'
# playwright.integration.config.ts starts Vite in the mock mode on its own port
# (ADR 0034): the dev server, or, with MOCK_BUILD=1 (CI), a build of the mock
# mode in frontend/dist/mock served by vite preview.
# --forbid-only fails the run on a test.only left behind, which would
# otherwise pass the gate with the other tests skipped.
fe-test-integration:
	@[ -x $(FRONTEND_DIR)/node_modules/.bin/playwright ] || \
		{ echo "fe-test-integration: $(FRONTEND_DIR) dependencies missing; run 'make fe-deps'" >&2; exit 1; }
	cd $(FRONTEND_DIR) && npm run --silent test:integration -- --forbid-only $(ARGS)

.PHONY: fe-build

## fe-build: Installs dependencies and builds Vite static output
fe-build:
	@echo "==> Building frontend bundle..."
	cd $(FRONTEND_DIR) && npm ci && npm run build
	@echo "==> Frontend bundle built successfully."

.PHONY: fe-vuln

## fe-vuln: Audits the npm dependencies of the client app and its generators
## ---- Fails on a moderate advisory in what ships to the browser, and on a high one anywhere
# npm audit reads only the lockfiles, so it doesn't need node_modules. The
# client app's production dependencies ship to the browser, so they fail at
# moderate; its dev dependencies and the generators in frontend/tools only run
# on developer machines and CI, so they fail at high.
fe-vuln:
	cd $(FRONTEND_DIR) && npm audit --omit=dev --audit-level=moderate
	cd $(FRONTEND_DIR) && npm audit --audit-level=high
	cd $(FRONTEND_TOOLS_DIR) && npm audit --audit-level=high
