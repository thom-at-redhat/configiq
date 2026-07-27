# Security policy

<!-- Assisted by: cursor, claude -->

## Supported versions

GPUCalc is a single continuously-deployed web application (see
[README.md](README.md)) — there are no maintained release branches or older
versions receiving security fixes. Only the code currently deployed from
`main` is supported.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report it privately using
[GitHub Security Advisories](https://github.com/thom-at-redhat/gpu-calc-v2/security/advisories/new)
for this repository. This lets us assess and fix the issue before it's
publicly disclosed.

Include as much detail as you can:

- Steps to reproduce, or a proof-of-concept
- The impact you think it has
- Any suggested remediation

We'll acknowledge new reports as soon as we can and follow up once we've
assessed the issue.

## Dependency vulnerabilities

This project runs `npm audit` and an [OpenSSF Scorecard](https://github.com/ossf/scorecard)
scan as part of `pre-commit` (see `.pre-commit-config.yaml` and
`scripts/scorecard-*.sh`) to catch known vulnerabilities in dependencies
before they land on `main`. If you notice a dependency advisory that isn't
being caught, please report it the same way as above, or open a regular
issue if it's not sensitive (e.g. the fix is already public upstream).
