# Contributing to GPUCalc

<!-- Assisted by: cursor, claude -->

Thanks for contributing! This guide covers branching, local checks, and code
conventions.

## Branching

- Branch from `main`: `git checkout -b feature/your-feature-name`
- Keep branches short-lived — one feature or fix per branch
- PR target is always `main`
- `main` is protected — never force-push to it

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): description
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`,
`ci`, `build`, `perf`, `revert`. See `.cursor/rules/conventional-commits.mdc`
for the full spec.

## One-time setup: enable pre-commit hooks

This repo's commit hooks run through Red Hat's `rh-multi-pre-commit` (already
installed globally via your git template) rather than Husky, so they don't
conflict with the corporate secret-leak scan. After cloning, run once:

```bash
git config rh-pre-commit.enableLocalConfig true
```

This is a local, per-clone git setting (not committed) — every contributor
needs to run it. Without it, only the global Red Hat leak scan runs; this
repo's own checks (ESLint, `tsc --noEmit`, `detect-secrets`, large-file
checks, GitHub Actions linting, OpenSSF Scorecard) are silently skipped.

You'll also need [`pre-commit`](https://pre-commit.com/#install) and, for the
Scorecard hook, [Podman](https://podman.io/). Scorecard runs on every commit
and can take 1–3 minutes (longer on the first run, while it pulls the
container image); skip it for a single commit with `SKIP=scorecard git
commit` if needed.

**Do not install Husky or anything else that sets `git config
core.hooksPath`** — see `.cursor/rules/security.mdc` for why.

## Before opening a PR

CI runs automatically and must pass. Run the same checks locally:

```bash
npm run type-check   # Must be clean — no TypeScript errors
npm run lint         # Must be clean — no ESLint errors
npm run build        # Must succeed
```

These are also enforced by the pre-commit hooks above, so most issues are
caught before you push.

## Code conventions

1. **GPU math belongs in `lib/gpu-math/`** — never write sizing formulas
   inside React components. Components call lib functions and display the
   results.

2. **PatternFly only** — do not add Tailwind, shadcn/ui, or any other
   component library. PatternFly v6 is the single source of truth for UI
   components.

3. **Red Hat design system** — use the established CSS variables (`--rh-red`,
   `--rh-gray-*`, etc.) and PF spacing tokens. Do not introduce arbitrary hex
   colors.

4. **Sentence case everywhere** — Red Hat brand standard. No title case in
   headings or labels.

5. **Server components by default** — add `"use client"` only when you need
   browser APIs, state, or event handlers.

6. **No `any` types** — TypeScript strict mode is enforced. Define proper
   interfaces in the relevant lib file or component.

7. **No unnecessary comments** — only add a comment when the *why* is
   non-obvious. Well-named identifiers are self-documenting.

## PR checklist

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] New GPU math is in `lib/gpu-math/`, not in a component
- [ ] No new third-party UI libraries added
- [ ] Sentence case used in all UI text
- [ ] Commit messages follow Conventional Commits

## What is deferred (do not add yet)

- Database / Prisma / PostgreSQL
- Authentication / NextAuth.js
- Turborepo / monorepo structure
- Tailwind CSS

These will be added in later phases when there is a real requirement for them.
