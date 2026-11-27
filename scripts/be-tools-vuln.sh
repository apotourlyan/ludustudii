#!/usr/bin/env bash
# Checks each Go tool in BACKEND_DIR/tools/go.mod for known vulnerabilities
# (make be-tools-vuln). The tools are the module's tool directives, so a new one
# is scanned without changing this script. One govulncheck run per tool: a
# single run over all of them runs out of memory in the devcontainer. Every
# tool is scanned, and the script fails afterwards if any scan failed.
#
# Environment: BACKEND_DIR.
set -euo pipefail

if ! { cd "$BACKEND_DIR/tools" && tools=$(go list tool) && [ -n "$tools" ]; }; then
	echo "be-tools-vuln: no tools listed in $BACKEND_DIR/tools/go.mod" >&2
	exit 1
fi
status=0
for tool in $tools; do
	echo "==> govulncheck $tool"
	go tool govulncheck "$tool" || status=1
done
exit "$status"
