#!/usr/bin/env bash
# Fails if a tool version disagrees with its single source (make versions-check).
# Go: BACKEND_DIR/go.mod is the source for the devcontainer's golang: image tag
# (any -variant suffix ignored) and BACKEND_DIR/tools/go.mod. golangci-lint: the
# installed binary must match GOLANGCI_LINT_VERSION, compared without a leading v.
# Node: engines.node in FRONTEND_DIR/package.json (for example 26.x) is the
# source for the major version of the devcontainer's node feature and the
# installed node. Every mismatch is reported before the script fails; a
# missing tool or file reads as an empty version.
#
# Environment: BACKEND_DIR, FRONTEND_DIR and GOLANGCI_LINT_VERSION.
set -euo pipefail

status=0
go_line() { awk '$1 == "go" { print $2; exit }' "$1"; }

want=$(go_line "$BACKEND_DIR/go.mod") || true
tools=$(go_line "$BACKEND_DIR/tools/go.mod") || true
if [ "$tools" != "$want" ]; then
	echo "$BACKEND_DIR/tools/go.mod: go '${tools:-none}', want '$want' (from $BACKEND_DIR/go.mod)"
	status=1
fi
image=$(sed -n 's/^[[:space:]]*image:[[:space:]]*golang:\([^[:space:]]*\).*/\1/p' .devcontainer/docker-compose.yml) || true
if [ "${image%%-*}" != "$want" ]; then
	echo ".devcontainer/docker-compose.yml: golang image '${image:-none}', want '$want' (from $BACKEND_DIR/go.mod)"
	status=1
fi

pin=$GOLANGCI_LINT_VERSION
lint=$(golangci-lint version --short 2>/dev/null) || true
if [ "${lint#v}" != "${pin#v}" ]; then
	echo "golangci-lint: installed '${lint:-none}', want '${pin#v}' (GOLANGCI_LINT_VERSION); run 'make ci-lint-install'"
	status=1
fi

engines=$(sed -n '/"engines"[[:space:]]*:/,/}/s/^[[:space:]]*"node"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$FRONTEND_DIR/package.json") || true
node_want=${engines%%.*}
if [[ ! $node_want =~ ^[0-9]+$ ]]; then
	echo "$FRONTEND_DIR/package.json: engines.node '${engines:-none}', want a major version such as '26.x'"
	exit 1
fi
feature=$(sed -n '/devcontainers\/features\/node:/,/}/s/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .devcontainer/devcontainer.json) || true
if [ "${feature%%.*}" != "$node_want" ]; then
	echo ".devcontainer/devcontainer.json: node feature version '${feature:-none}', want major '$node_want' (from $FRONTEND_DIR/package.json engines.node)"
	status=1
fi
node=$(node --version 2>/dev/null) || true
node=${node#v}
if [ "${node%%.*}" != "$node_want" ]; then
	echo "node: installed '${node:-none}', want major '$node_want' (from $FRONTEND_DIR/package.json engines.node)"
	status=1
fi

exit "$status"
