##@ Backend
# The Go server: its generated files, tests, build, lint and formatting.

BINARY_NAME := ludustudii
BUILD_DIR := backend/bin
SCALAR_SRC := $(FRONTEND_DIR)/node_modules/@scalar/api-reference/dist/browser/standalone.js
SPEC_SRC := $(shell find backend/apispec -name '*.yml')
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

test-unit test-integration: $(SPA_EMBED_DIR)/index.html
test-unit: $(SCALAR_EMBED)

.PHONY: spec-bundle

## spec-bundle: Regenerates the bundled OpenAPI spec the API reference serves, if a spec file changed
spec-bundle: $(SPEC_BUNDLE)

# bundlespec writes the file only once the spec bundles, so a failed run leaves
# it unchanged and .DELETE_ON_ERROR keeps it.
$(SPEC_BUNDLE): $(SPEC_SRC)
	cd $(BACKEND_DIR) && go generate ./internal/infra/apidocs

.PHONY: test test-unit test-integration coverage

## test: Runs both unit and integration tests
test: test-unit test-integration

## test-unit: Runs unit tests with the 'unit' build tag
## ---- PKG selects packages; RUN selects test names (defaults: all packages and tests)
## ---- If selected, the apidocs package runs again with the 'apidocs' tag
## ---- GO_JUNIT=1 (CI) also writes JUnit reports to test-results/junit/ (go-unit.xml, go-unit-apidocs.xml)
test-unit:
	@echo "==> Running unit tests..."
	@BACKEND_DIR='$(BACKEND_DIR)' PKG='$(PKG)' RUN='$(RUN)' GO_JUNIT='$(GO_JUNIT)' JUNIT_DIR='$(JUNIT_DIR)' \
		scripts/go-test.sh unit

## test-integration: Runs integration tests with the 'integration' build tag
## ---- PKG selects packages; RUN selects test names (defaults: all packages and tests)
## ---- GO_JUNIT=1 (CI) also writes a JUnit report to test-results/junit/go-integration.xml
test-integration:
	@echo "==> Running integration tests..."
	@BACKEND_DIR='$(BACKEND_DIR)' PKG='$(PKG)' RUN='$(RUN)' GO_JUNIT='$(GO_JUNIT)' JUNIT_DIR='$(JUNIT_DIR)' \
		scripts/go-test.sh integration

## coverage: Runs all backend tests and writes coverage profile and HTML report to backend/coverage/ (requires DB_TEST_CONNECTION)
coverage: $(SPA_EMBED_DIR)/index.html $(SCALAR_EMBED)
	@mkdir -p $(BACKEND_DIR)/coverage
	go -C $(BACKEND_DIR) test -tags=unit,integration,apidocs -race -count=1 -coverpkg=./... -coverprofile=coverage/coverage.out ./...
	go -C $(BACKEND_DIR) tool cover -html=coverage/coverage.out -o coverage/coverage.html
	@echo "Serve from the repository root: python3 -m http.server 8000 --directory backend/coverage"

.PHONY: build build-backend clean

## build: Compiles frontend, outputs assets, and compiles Go binary
build:
	$(MAKE) build-frontend
	$(MAKE) build-backend

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

.PHONY: test-tags-check tidy-check generate-check

## test-tags-check: Fails if a backend test file's name and build tag disagree
test-tags-check:
	@BACKEND_DIR='$(BACKEND_DIR)' scripts/test-tags-check.sh

## tidy-check: Fails if app or tool go.mod/go.sum files are not tidy
tidy-check:
	go -C $(BACKEND_DIR) mod tidy -diff
	go -C $(BACKEND_DIR)/tools mod tidy -diff

## generate-check: Fails if generation changes tracked backend files
generate-check: $(SPA_EMBED_DIR)/index.html
	@BACKEND_DIR='$(BACKEND_DIR)' scripts/generate-check.sh
