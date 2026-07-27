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

## Before opening a PR

CI runs automatically and must pass. Run the same checks locally:

```bash
npm run type-check   # Must be clean — no TypeScript errors
npm run lint         # Must be clean — no ESLint errors
npm run build        # Must succeed
```

Pre-commit hooks (Husky) run lint-staged automatically on `git commit` so
most issues are caught before you push. A `.pre-commit-config.yaml` is also
available for repo-wide checks (secret detection, large files, GitHub Actions
linting) — see `.cursor/rules/security.mdc` for setup if you want to opt in.

## Code conventions

1. **GPU math belongs in `lib/gpu-math/`** — never write sizing formulas
   inside React components. Components call lib functions and display the
   results.

2. **PatternFly only** — do not add Tailwind, shadcn/ui, or any other
   component library. PatternFly v5 is the single source of truth for UI
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
