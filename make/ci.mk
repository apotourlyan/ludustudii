##@ CI and repository checks
# Tool versions, pull request titles, shell scripts, the vulnerability scan,
# the end-to-end tests and CI's test summaries.

# The single pin for golangci-lint, read by the devcontainer and CI through
# install-golangci-lint and enforced by versions-check.
GOLANGCI_LINT_VERSION := v2.15.0

.PHONY: versions-check install-golangci-lint

## versions-check: Fails if a tool version disagrees with its single source
versions-check:
	@BACKEND_DIR='$(BACKEND_DIR)' FRONTEND_DIR='$(FRONTEND_DIR)' GOLANGCI_LINT_VERSION='$(GOLANGCI_LINT_VERSION)' \
		scripts/versions-check.sh

## install-golangci-lint: Installs golangci-lint at GOLANGCI_LINT_VERSION into $(go env GOPATH)/bin
# The standalone binary keeps lint tooling out of the backend modules.
install-golangci-lint:
	curl -sSfL "https://raw.githubusercontent.com/golangci/golangci-lint/$(GOLANGCI_LINT_VERSION)/install.sh" \
		| sh -s -- -b "$$(go env GOPATH)/bin" "$(GOLANGCI_LINT_VERSION)"
	"$$(go env GOPATH)/bin/golangci-lint" version

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

.PHONY: vuln go-tools-vuln frontend-vuln

## vuln: Checks backend packages, the Go tools and the client app's npm dependencies for known vulnerabilities
# Outside check: they depend on an external vulnerability database (ADR 0020).
vuln: $(SPA_EMBED_DIR)/index.html
	$(GO_TOOL) govulncheck ./...
	$(MAKE) --no-print-directory go-tools-vuln
	$(MAKE) --no-print-directory frontend-vuln

## go-tools-vuln: Checks each Go tool in backend/tools/go.mod for known vulnerabilities
go-tools-vuln:
	@BACKEND_DIR='$(BACKEND_DIR)' scripts/go-tools-vuln.sh

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

.PHONY: test-e2e test-summary

## test-e2e: Runs the end-to-end tests: the built binary in Chromium, on a database made for the run (requires DB_TEST_CONNECTION)
## ---- Builds the client app and the binary, creates and migrates the database, and drops it afterwards, also when a test fails
## ---- ARGS passes options to Playwright, for example ARGS='--repeat-each=5'
# ARGS stays unquoted, so the shell splits it into Playwright's arguments.
# MAKE_COMMAND rather than MAKE: make runs a line that names $(MAKE) even
# under make -n, so a dry run would build and run the tests.
test-e2e:
	@MAKE='$(MAKE_COMMAND)' FRONTEND_DIR='$(FRONTEND_DIR)' GO_TOOL='$(GO_TOOL)' MIGRATIONS_DIR='$(MIGRATIONS_DIR)' \
		scripts/test-e2e.sh $(ARGS)

## test-summary: Renders the test suites' JUnit reports as Markdown, into GITHUB_STEP_SUMMARY on CI, else to stdout
## ---- The reports are written only on CI: CI=true for Vitest and Playwright, GO_JUNIT=1 for the Go tests
test-summary:
	@FRONTEND_DIR='$(FRONTEND_DIR)' FRONTEND_TOOLS_DIR='$(FRONTEND_TOOLS_DIR)' JUNIT_DIR='$(JUNIT_DIR)' \
		scripts/test-summary.sh
