##@ Project
# Targets that span the areas: help, the gate, the build, the local servers,
# the vulnerability scan, the end-to-end tests and the repository's own checks.

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
	$(MAKE) be-fmt-check
	$(MAKE) fe-fmt-check
	$(MAKE) be-test-tags-check
	$(MAKE) pr-title-check-test
	$(MAKE) scripts-lint
	$(MAKE) be-lint
	$(MAKE) be-tidy-check
	$(MAKE) be-generate-check
	$(MAKE) fe-api-types-check
	$(MAKE) fe-typecheck
	$(MAKE) fe-lint
	$(MAKE) fe-test-unit
	$(MAKE) fe-test-integration
	$(MAKE) be-test-unit
	$(MAKE) be-test-integration

.PHONY: build clean

## build: Compiles frontend, outputs assets, and compiles Go binary
build:
	$(MAKE) fe-build
	$(MAKE) be-build

## clean: Deletes build outputs and temporary embed files
clean:
	@echo "==> Cleaning artifacts..."
	rm -rf $(BUILD_DIR)
	rm -rf $(BACKEND_DIR)/tmp
	rm -rf $(SPA_EMBED_DIR)
	rm -f $(SCALAR_EMBED)
	@echo "==> Clean complete."

dev: $(SPA_EMBED_DIR)/index.html $(SCALAR_EMBED)

.PHONY: dev dev-mock

## dev: Runs Vite dev server and Go backend (with Air live-reload) concurrently
## ---- Backend output is also appended to LOG_FILE (default: backend/tmp/app.log)
dev: export LOG_FORMAT := json
dev: export APP_API_DOCS ?= true
dev:
	@LOG_FILE='$(LOG_FILE)' FRONTEND_DIR='$(FRONTEND_DIR)' GO_TOOL='$(GO_TOOL)' scripts/dev.sh

## dev-mock: Runs the Vite dev server with a fake backend in the browser (no Go backend or database)
## ---- Choose seeded data with ?scenario=default|empty|many|failing and add latency with ?delay=<ms>
dev-mock:
	cd $(FRONTEND_DIR) && npm run dev:mock

.PHONY: vuln

## vuln: Checks backend packages, the Go tools and the client app's npm dependencies for known vulnerabilities
# Outside check: they depend on an external vulnerability database (ADR 0020).
vuln: $(SPA_EMBED_DIR)/index.html
	$(GO_TOOL) govulncheck ./...
	$(MAKE) --no-print-directory be-tools-vuln
	$(MAKE) --no-print-directory fe-vuln

.PHONY: test-e2e

## test-e2e: Runs the end-to-end tests: the built binary in Chromium, on a database made for the run (requires DB_TEST_CONNECTION)
## ---- Builds the client app and the binary, creates and migrates the database, and drops it afterwards, also when a test fails
## ---- ARGS passes options to Playwright, for example ARGS='--repeat-each=5'
# ARGS stays unquoted, so the shell splits it into Playwright's arguments.
# MAKE_COMMAND rather than MAKE: make runs a line that names $(MAKE) even
# under make -n, so a dry run would build and run the tests.
test-e2e:
	@MAKE='$(MAKE_COMMAND)' FRONTEND_DIR='$(FRONTEND_DIR)' GO_TOOL='$(GO_TOOL)' MIGRATIONS_DIR='$(MIGRATIONS_DIR)' \
		scripts/test-e2e.sh $(ARGS)

.PHONY: versions-check

## versions-check: Fails if a tool version disagrees with its single source
versions-check:
	@BACKEND_DIR='$(BACKEND_DIR)' FRONTEND_DIR='$(FRONTEND_DIR)' GOLANGCI_LINT_VERSION='$(GOLANGCI_LINT_VERSION)' \
		scripts/versions-check.sh

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
	@PR_TITLE_TYPES='$(PR_TITLE_TYPES)' PR_TITLE_MAX='$(PR_TITLE_MAX)' scripts/pr-title-check.sh

## pr-title-check-test: Fails if pr-title-check accepts or rejects a title in its test table unexpectedly
# MAKE_COMMAND rather than MAKE: make runs a line that names $(MAKE) even
# under make -n, so a dry run would run the test table.
pr-title-check-test:
	@MAKE='$(MAKE_COMMAND)' scripts/pr-title-check-test.sh

.PHONY: scripts-lint

## scripts-lint: Lints the shell scripts in scripts/ with ShellCheck
# ShellCheck is pinned in backend/tools/go.mod as a WebAssembly build, which
# opens only files under its working directory. go tool -n builds it and
# prints its path, so it runs from the repository root rather than backend/.
scripts-lint:
	shellcheck=$$($(GO_TOOL) -n shellcheck) && "$$shellcheck" scripts/*.sh

.PHONY: git-diff

## git-diff: Copies the git diff to the system clipboard in a terminal-friendly format
git-diff:
	git diff HEAD | base64 | tr -d '\n' | awk '{print "\033]52;c;" $$0 "\007"}'
