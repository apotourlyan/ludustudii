#!/bin/bash
set -e

echo "Installing Go tools..."
# Install the versions tracked by backend/tools/go.mod for editor and PATH access.
go -C backend/tools install \
  github.com/air-verse/air \
  github.com/go-delve/delve/cmd/dlv \
  golang.org/x/tools/cmd/stringer \
  golang.org/x/vuln/cmd/govulncheck \
  github.com/pressly/goose/v3/cmd/goose
# make/ci.mk holds the golangci-lint pin; CI installs it the same way.
make install-golangci-lint
echo "Go tools installed successfully!"

echo "Installing frontend dependencies..."
(cd frontend && npm install)
# The browser tests' Chromium headless shell, in the version the installed
# @playwright/test expects, on the playwright-browsers volume; a no-op when
# that version is already there (ADR 0034).
(cd frontend && npx --no-install playwright install chromium --only-shell)
# Chromium's system libraries, which the golang image lacks, installed with
# apt by Playwright as in CI. They live in the container, so every rebuild
# installs them again (about 15 seconds).
(cd frontend && npx --no-install playwright install-deps chromium)
# The API type generator's package, with its exact pins (ADR 0031).
(cd frontend/tools && npm ci)
echo "Frontend dependencies installed successfully!"

echo "Installing PostgreSQL client..."
apt-get update && apt-get install -y postgresql-client
echo "PostgreSQL client installed successfully!"
