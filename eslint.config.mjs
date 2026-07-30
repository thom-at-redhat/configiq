// Assisted by: cursor, claude
//
// Next.js 16 removed the `next lint` command, so `npm run lint` now invokes
// ESLint directly (see package.json). eslint-config-next 16+ only ships
// flat-config exports (no more `next/core-web-vitals` string extends for
// .eslintrc), so this replaces the old .eslintrc.json.
//
// Deliberately NOT importing "eslint-config-next/typescript" here: the old
// .eslintrc.json only ever extended "next/core-web-vitals", not
// "next/typescript" — this project relies on `npm run type-check` (tsc
// --noEmit) for type safety and keeps ESLint scoped to React/Next/a11y
// rules. Adding the typescript-eslint recommended ruleset is a real,
// separate lint-strictness decision (100+ new findings across the
// codebase) that's out of scope for this upgrade.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    // Global ignores — applies repo-wide regardless of which config below
    // matches a file. docs/UI/*.jsx are legacy static-site snippets, not
    // application code; worktrees/ hold other feature branches' checkouts.
    ignores: ["docs/**", "worktrees/**"],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // Carried over from the old .eslintrc.json: this project intentionally
      // tolerates unused vars/imports during active development.
      "no-unused-vars": "off",
      "react/no-unescaped-entities": "error",
    },
  },
];

export default config;
