const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root explicitly: this repo lives inside git worktrees
  // (see .cursor/rules/git-worktree-workflow.mdc) nested under the main
  // checkout, and Turbopack's root auto-detection otherwise walks up and
  // picks whichever ancestor directory happens to have a package-lock.json
  // first (e.g. a stray one in $HOME), which is wrong.
  turbopack: {
    root: __dirname,
  },
  transpilePackages: [
    "@patternfly/react-core",
    "@patternfly/react-icons",
    "@patternfly/react-table",
  ],
};

module.exports = nextConfig;
