#!/usr/bin/env bash
# Fails if make pr-title-check accepts or rejects a title in its test table
# unexpectedly (make pr-title-check-test). It runs the target, not
# pr-title-check.sh, so the table also covers the variables make passes. Each
# case is 'want|title'. The two generated titles sit on the length boundary:
# "feat: " plus 58 or 59 digits is 64 or 65 characters.
#
# Environment: MAKE, the make that runs pr-title-check (default: make).
set -euo pipefail

status=0
cases=(
	'pass|feat: add deck sharing'
	'pass|ci: check pull request titles'
	'pass|fix: 404 for missing decks'
	"pass|$(printf 'feat: %058d' 0)"
	"fail|$(printf 'feat: %059d' 0)"
	'fail|'
	'fail|chore: bump tools'
	'fail|Feat: add deck sharing'
	'fail|feat(decks): add sharing'
	'fail|feat:add deck sharing'
	'fail|feat:  add deck sharing'
	'fail|feat: '
	'fail|feat: Add deck sharing'
	'fail|feat: add deck sharing.'
)
for case in "${cases[@]}"; do
	want=${case%%|*}
	title=${case#*|}
	if PR_TITLE=$title "${MAKE:-make}" --no-print-directory pr-title-check >/dev/null 2>&1; then got=pass; else got=fail; fi
	if [ "$got" != "$want" ]; then
		printf 'pr-title-check-test: "%s": got %s, want %s\n' "$title" "$got" "$want"
		status=1
	fi
done
exit "$status"
