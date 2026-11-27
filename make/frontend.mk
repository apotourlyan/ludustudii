##@ Frontend
# The client app: its dependencies, generated API types, checks, tests and build.

API_TYPES := $(FRONTEND_DIR)/src/api/schema.gen.ts

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

.PHONY: build-frontend

## build-frontend: Installs dependencies and builds Vite static output
build-frontend:
	@echo "==> Building frontend bundle..."
	cd $(FRONTEND_DIR) && npm ci && npm run build
	@echo "==> Frontend bundle built successfully."
