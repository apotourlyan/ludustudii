##@ CI
# Targets only CI runs: installing golangci-lint, which the devcontainer also
# does, and the job summaries of the test suites.

.PHONY: ci-lint-install ci-test-summary

## ci-lint-install: Installs golangci-lint at GOLANGCI_LINT_VERSION into $(go env GOPATH)/bin
# The standalone binary keeps lint tooling out of the backend modules.
ci-lint-install:
	curl -sSfL "https://raw.githubusercontent.com/golangci/golangci-lint/$(GOLANGCI_LINT_VERSION)/install.sh" \
		| sh -s -- -b "$$(go env GOPATH)/bin" "$(GOLANGCI_LINT_VERSION)"
	"$$(go env GOPATH)/bin/golangci-lint" version

## ci-test-summary: Renders the test suites' JUnit reports as Markdown, into GITHUB_STEP_SUMMARY on CI, else to stdout
## ---- The reports are written only on CI: CI=true for Vitest and Playwright, GO_JUNIT=1 for the Go tests
ci-test-summary:
	@FRONTEND_DIR='$(FRONTEND_DIR)' FRONTEND_TOOLS_DIR='$(FRONTEND_TOOLS_DIR)' JUNIT_DIR='$(JUNIT_DIR)' \
		scripts/ci-test-summary.sh
