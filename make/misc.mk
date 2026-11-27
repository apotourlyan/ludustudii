##@ Misc
# The repository's own checks: pull request titles and the shell scripts.

.PHONY: pr-title-check pr-title-check-test

# Pull requests are squash-merged, so a title becomes a commit subject on main.
# These are the only copies of the title rules; CI (pr-title.yml) runs the check.
PR_TITLE_TYPES := feat fix refactor test docs build ci dev
# Squash merging appends " (#N)"; 64 keeps the subject within 72 characters
# for pull request numbers up to four digits.
PR_TITLE_MAX := 64

## pr-title-check: Fails if PR_TITLE breaks the pull request title format 'type: summary'
## ---- Usage: PR_TITLE='feat: add decks' make pr-title-check
# The title is read from the environment only, never expanded by make or
# interpolated into the script, because it is untrusted text.
pr-title-check:
	@PR_TITLE_TYPES='$(PR_TITLE_TYPES)' PR_TITLE_MAX='$(PR_TITLE_MAX)' scripts/pr-title-check.sh

## pr-title-check-test: Fails if pr-title-check accepts or rejects a title in its test table unexpectedly
# MAKE_COMMAND rather than MAKE: make runs a line that names $(MAKE) even
# under make -n, so a dry run would run the test table.
pr-title-check-test:
	@MAKE='$(MAKE_COMMAND)' scripts/pr-title-check-test.sh

.PHONY: scripts-lint

## scripts-lint: Lints the shell scripts in scripts/ with ShellCheck
# ShellCheck is pinned in backend/tools/go.mod as a WebAssembly build, which
# opens only files under its working directory. go tool -n builds it and
# prints its path, so it runs from the repository root rather than backend/.
scripts-lint:
	shellcheck=$$($(GO_TOOL) -n shellcheck) && "$$shellcheck" scripts/*.sh
