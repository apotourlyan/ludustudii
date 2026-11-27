##@ Backend
# The Go server: its embedded placeholders, tests, build, lint, formatting,
# repository checks and the Go tools' vulnerability scan.

BINARY_NAME := ludustudii
SCALAR_SRC := $(FRONTEND_DIR)/node_modules/@scalar/api-reference/dist/browser/standalone.js
MAIN_REL_DIR := ./cmd/server/api
# API_DOCS=1 builds the binary with the API reference; any other value omits it.
API_DOCS_TAGS := $(if $(filter 1,$(API_DOCS)),-tags=apidocs)
PKG ?= ./...
RUN ?=

$(SPA_EMBED_DIR)/index.html:
	@mkdir -p $(SPA_EMBED_DIR)
	@printf '<!doctype html><title>ludustudii (placeholder)</title>\n' > $@

# Gzips the Scalar bundle when frontend dependencies are installed. Without it
# builds with the apidocs tag still compile, and the server starts without the
# API reference. -n leaves the source name and mtime out of the header, so the
# bytes and their ETag only change with the bundle itself.
$(SCALAR_EMBED): $(wildcard $(SCALAR_SRC))
	@if [ -f $(SCALAR_SRC) ]; then gzip -9nc $(SCALAR_SRC) > $@; fi

be-test-unit be-test-integration: $(SPA_EMBED_DIR)/index.html
be-test-unit: $(SCALAR_EMBED)

.PHONY: be-test be-test-unit be-test-integration be-coverage

## be-test: Runs the backend's unit and integration tests
be-test: be-test-unit be-test-integration

## be-test-unit: Runs the backend's unit tests, with the 'unit' build tag
## ---- PKG selects packages; RUN selects test names (defaults: all packages and tests)
## ---- If selected, the apidocs package runs again with the 'apidocs' tag
## ---- GO_JUNIT=1 (CI) also writes JUnit reports to test-results/junit/ (go-unit.xml, go-unit-apidocs.xml)
be-test-unit:
	@echo "==> Running unit tests..."
	@BACKEND_DIR='$(BACKEND_DIR)' PKG='$(PKG)' RUN='$(RUN)' GO_JUNIT='$(GO_JUNIT)' JUNIT_DIR='$(JUNIT_DIR)' \
		scripts/be-test.sh unit

## be-test-integration: Runs the backend's integration tests, with the 'integration' build tag (requires DB_TEST_CONNECTION)
## ---- PKG selects packages; RUN selects test names (defaults: all packages and tests)
## ---- GO_JUNIT=1 (CI) also writes a JUnit report to test-results/junit/go-integration.xml
be-test-integration:
	@echo "==> Running integration tests..."
	@BACKEND_DIR='$(BACKEND_DIR)' PKG='$(PKG)' RUN='$(RUN)' GO_JUNIT='$(GO_JUNIT)' JUNIT_DIR='$(JUNIT_DIR)' \
		scripts/be-test.sh integration

## be-coverage: Runs all backend tests and writes coverage profile and HTML report to backend/coverage/ (requires DB_TEST_CONNECTION)
be-coverage: $(SPA_EMBED_DIR)/index.html $(SCALAR_EMBED)
	@mkdir -p $(BACKEND_DIR)/coverage
	go -C $(BACKEND_DIR) test -tags=unit,integration,apidocs -race -count=1 -coverpkg=./... -coverprofile=coverage/coverage.out ./...
	go -C $(BACKEND_DIR) tool cover -html=coverage/coverage.out -o coverage/coverage.html
	@echo "Serve from the repository root: python3 -m http.server 8000 --directory backend/coverage"

.PHONY: be-build

## be-build: Compiles static Go binary with embedded SPA
## ---- API_DOCS=1 also embeds the API reference (for dev, test and staging builds)
ifeq ($(API_DOCS),1)
be-build: $(SCALAR_EMBED)
endif
be-build:
	@! grep -qs 'ludustudii (placeholder)' $(SPA_EMBED_DIR)/index.html || \
		{ echo "SPA not built: run 'make fe-build' first"; exit 1; }
ifeq ($(API_DOCS),1)
	@[ -s $(SCALAR_EMBED) ] || \
		{ echo "Scalar bundle missing: run 'make fe-build' first"; exit 1; }
endif
	@echo "==> Building Go binary..."
	mkdir -p $(BUILD_DIR)
	cd $(BACKEND_DIR) && CGO_ENABLED=0 go build $(API_DOCS_TAGS) -ldflags="-w -s" -o ../$(BUILD_DIR)/$(BINARY_NAME) $(MAIN_REL_DIR)
	@echo "==> Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

.PHONY: be-lint be-lint-fix be-lint-config-check be-fmt be-fmt-check

## be-lint: Lints the backend and tagged tests with API docs enabled
be-lint: $(SPA_EMBED_DIR)/index.html $(SCALAR_EMBED)
	cd $(BACKEND_DIR) && golangci-lint run

## be-lint-fix: Applies backend lint fixes with API docs enabled
be-lint-fix: $(SPA_EMBED_DIR)/index.html $(SCALAR_EMBED)
	cd $(BACKEND_DIR) && golangci-lint run --fix

## be-lint-config-check: Validates the backend golangci-lint configuration
be-lint-config-check:
	cd $(BACKEND_DIR) && golangci-lint config verify

## be-fmt: Formats the backend with gofumpt and goimports
be-fmt:
	cd $(BACKEND_DIR) && golangci-lint fmt

## be-fmt-check: Fails if any backend file needs formatting
be-fmt-check:
	cd $(BACKEND_DIR) && golangci-lint fmt --diff

.PHONY: be-test-tags-check be-tidy-check be-generate-check

## be-test-tags-check: Fails if a backend test file's name and build tag disagree
be-test-tags-check:
	@BACKEND_DIR='$(BACKEND_DIR)' scripts/be-test-tags-check.sh

## be-tidy-check: Fails if app or tool go.mod/go.sum files are not tidy
be-tidy-check:
	go -C $(BACKEND_DIR) mod tidy -diff
	go -C $(BACKEND_DIR)/tools mod tidy -diff

## be-generate-check: Fails if generation changes tracked backend files
be-generate-check: $(SPA_EMBED_DIR)/index.html
	@BACKEND_DIR='$(BACKEND_DIR)' scripts/be-generate-check.sh

.PHONY: be-tools-vuln

## be-tools-vuln: Checks each Go tool in backend/tools/go.mod for known vulnerabilities
be-tools-vuln:
	@BACKEND_DIR='$(BACKEND_DIR)' scripts/be-tools-vuln.sh
