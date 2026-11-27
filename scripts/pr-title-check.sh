#!/usr/bin/env bash
# Fails if PR_TITLE breaks the pull request title format 'type: summary'
# (make pr-title-check): a listed type, no scope, one space after the colon, a
# summary starting with a lowercase letter or a digit, no trailing period, and
# at most PR_TITLE_MAX characters. Lists every broken rule.
#
# Environment: PR_TITLE (the title; unset reads as empty), PR_TITLE_TYPES (the
# allowed types, space-separated) and PR_TITLE_MAX. The title is untrusted
# text: it is read from the environment only and never evaluated.
set -euo pipefail

title=${PR_TITLE-}
types=$PR_TITLE_TYPES
max=$PR_TITLE_MAX
broken=()

format="^(${types// /|}): [^ ]"
if [[ ! $title =~ $format ]]; then
	broken+=("a type, a colon and exactly one space come before the summary (no scope)")
elif [[ ! ${title#*: } =~ ^[a-z0-9] ]]; then
	broken+=("the summary starts with a lowercase letter or a digit")
fi
[[ $title != *. ]] || broken+=("no trailing period")
[ ${#title} -le "$max" ] || broken+=("at most $max characters (this title has ${#title})")

if [ ${#broken[@]} -eq 0 ]; then
	printf 'pr-title-check: ok: %s\n' "$title"
	exit 0
fi
printf 'pr-title-check: invalid title: "%s"\n' "$title"
printf 'Broken rule: %s\n' "${broken[@]}"
printf 'Expected format: type: summary (for example "feat: add deck sharing")\n'
printf '  type: one of %s\n' "${types// /, }"
printf '  summary: starts with a lowercase letter or a digit, no trailing period\n'
printf '  length: at most %s characters, so the " (#N)" squash merging appends fits within 72\n' "$max"
exit 1
