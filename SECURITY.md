# Security policy

## Reporting a vulnerability

Please don't report security vulnerabilities in public issues, pull
requests or discussions.

Report them privately through GitHub instead:
[Security → Report a vulnerability](https://github.com/apotourlyan/ludustudii/security/advisories/new).
Include what you found, how to reproduce it, and what an attacker could do
with it.

Once the problem is confirmed, it's fixed on `main`, and the advisory is
published after the fix.

## Supported versions

Ludus Studii has no releases yet. Only the current `main` branch receives
security fixes.

## How the project checks itself

- Dependabot alerts for the Go and npm dependencies.
- CodeQL code scanning for Go, TypeScript and the GitHub Actions workflows.
- A daily vulnerability scan (`make vuln`): `govulncheck` for the backend
  and `npm audit` for the client app.
