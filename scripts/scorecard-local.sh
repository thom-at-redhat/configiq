#!/usr/bin/env bash
# Manual full --repo OpenSSF Scorecard scan (read-only; does not publish).
# Assisted by: cursor, claude
set -o errexit -o nounset -o pipefail

SCORECARD_IMAGE="${SCORECARD_IMAGE:-ghcr.io/ossf/scorecard:v5.5.0}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
OUTPUT_FILE="${REPO_ROOT}/scorecard-local.json"

SCORECARD_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCORECARD_COMMON="${REPO_ROOT}/scripts/scorecard-common.sh"
if [[ ! -f "${SCORECARD_COMMON}" ]]; then
  SCORECARD_COMMON="${SCORECARD_SCRIPT_DIR}/scorecard-common.sh"
fi
# shellcheck source=/dev/null
source "${SCORECARD_COMMON}"

if ! command -v podman >/dev/null 2>&1; then
  printf 'scorecard-local: podman is required (https://podman.io/)\n' >&2
  exit 1
fi

scorecard_resolve_repo "${REPO_ROOT}"
scorecard_require_remote_auth
scorecard_build_podman_auth_args

printf 'Running Scorecard against %s (%s, output: %s)\n' \
  "${SCORECARD_REPO}" "${SCORECARD_PLATFORM}" "${OUTPUT_FILE}"

podman run --rm --user 0 \
  -v "${REPO_ROOT}:/src:z" \
  -w /src \
  "${SCORECARD_PODMAN_AUTH_ARGS[@]}" \
  "${SCORECARD_IMAGE}" \
  --repo="${SCORECARD_REPO}" \
  --format=json \
  --show-details \
  -o /src/scorecard-local.json

printf 'Done. Aggregate score: '
python3 - "${OUTPUT_FILE}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
print(data.get("score", "?"))
PY
