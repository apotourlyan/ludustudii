#!/usr/bin/env bash
# Fails if go generate changes tracked backend files (make generate-check). It
# compares checksums of every tracked file under BACKEND_DIR before and after,
# so edits made before the run don't count unless generation changes them. The
# regenerated files stay on disk for review.
#
# Environment: BACKEND_DIR.
set -euo pipefail

cd "$BACKEND_DIR"

# Prints a checksum line for each tracked file that exists.
snap() {
	git ls-files -z | while IFS= read -r -d '' file; do
		[ ! -f "$file" ] || sha256sum -- "$file" || return 1
	done
}

before=$(snap) || exit 1
go generate ./... || exit 1
[ "$before" = "$(snap)" ] ||
	{ echo "generate-check: generated files are stale; commit the regenerated output"; exit 1; }
