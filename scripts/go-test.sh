#!/usr/bin/env bash
# Runs one suite of the backend's Go tests (make test-unit, make
# test-integration) with -race, -count=1 and -shuffle=on, leaving out go test's
# lines for packages without tests:
#   unit         -tags=unit, then again with -tags=unit,apidocs when PKG
#                selects the apidocs package
#   integration  -tags=integration
# With GO_JUNIT=1 (CI), gotestsum runs go test with the same flags, prints its
# output in go test's format, exits with its code and writes the JUnit report
# JUNIT_DIR/go-<name>.xml (go-unit, go-unit-apidocs, go-integration).
# standard-quiet prints go test's package lines but not a failed test's output,
# which the summary after them lists, without the skipped tests. The report
# names packages relative to the module and leaves out those without tests.
#
# Arguments: the suite, unit or integration.
# Environment: BACKEND_DIR, PKG (package patterns, space-separated), RUN (a
# go test -run pattern; blank runs every test), GO_JUNIT and JUNIT_DIR
# (relative to the repository root).
set -euo pipefail

suite=${1-}
case $suite in
	unit | integration) ;;
	*) echo "usage: $0 unit|integration" >&2; exit 2 ;;
esac

reports_dir=$PWD/$JUNIT_DIR
read -ra packages <<<"$PKG"
run=()
[[ $RUN != *[![:space:]]* ]] || run=(-run "$RUN")

# go_test <report name> <go test flags>: go test, or gotestsum on CI.
go_test() {
	local name=$1
	shift
	if [ "${GO_JUNIT-}" = 1 ]; then
		mkdir -p "$reports_dir"
		go tool -modfile=tools/go.mod gotestsum --format standard-quiet \
			--hide-summary skipped --junitfile-hide-empty-pkg \
			--junitfile-testsuite-name relative --junitfile-testcase-classname relative \
			--junitfile "$reports_dir/go-$name.xml" -- "$@"
	else
		go test "$@"
	fi
}

cd "$BACKEND_DIR"
go_test "$suite" -tags="$suite" -race -count=1 -shuffle=on "${run[@]}" "${packages[@]}" 2>&1 |
	{ grep --line-buffered -v '^?' || [ $? -eq 1 ]; }

if [ "$suite" = unit ]; then
	dirs=$(go list -f '{{.Dir}}' "${packages[@]}")
	if printf '%s\n' "$dirs" | grep -Fxq "$PWD/internal/infra/apidocs"; then
		go_test unit-apidocs -tags=unit,apidocs -race -count=1 -shuffle=on "${run[@]}" ./internal/infra/apidocs/
	fi
fi
