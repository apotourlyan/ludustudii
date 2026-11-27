#!/usr/bin/env bash
# Fails if a backend test file's name and build tag disagree (make
# be-test-tags-check). *_integration_test.go and api_test.go need exactly
# //go:build integration; every other test file needs exactly //go:build unit.
# Untracked files count. Every mismatch is reported before the script fails.
#
# Environment: BACKEND_DIR.
set -euo pipefail

cd "$BACKEND_DIR"
status=0
while IFS= read -r -d '' file; do
	[ -f "$file" ] || continue
	case "$file" in
		*_integration_test.go | api_test.go | */api_test.go) want=integration ;;
		*) want=unit ;;
	esac
	got=$(awk '/^\/\/go:build /{ sub(/^\/\/go:build /, ""); print; exit }' "$file")
	if [ "$got" != "$want" ]; then
		echo "$file: build tag '${got:-none}', want '$want'"
		status=1
	fi
done < <(git ls-files -z --cached --others --exclude-standard -- '*_test.go')
exit "$status"
