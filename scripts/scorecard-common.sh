#!/usr/bin/env bash
# Shared helpers for OpenSSF Scorecard scripts (GitHub and GitLab).
# Assisted by: cursor, claude

scorecard_parse_git_remote_url() {
  local REMOTE_URL="${1}"
  local HOST REPO_PATH

  if [[ "${REMOTE_URL}" =~ ^git@([^:]+):(.+)$ ]]; then
    HOST="${BASH_REMATCH[1]}"
    REPO_PATH="${BASH_REMATCH[2]}"
  elif [[ "${REMOTE_URL}" =~ ^https?://([^/]+)/(.+)$ ]]; then
    HOST="${BASH_REMATCH[1]}"
    REPO_PATH="${BASH_REMATCH[2]}"
  elif [[ "${REMOTE_URL}" =~ ^ssh://git@([^/]+)/(.+)$ ]]; then
    HOST="${BASH_REMATCH[1]}"
    REPO_PATH="${BASH_REMATCH[2]}"
  else
    return 1
  fi

  REPO_PATH="${REPO_PATH%.git}"
  printf '%s\n' "${HOST}" "${REPO_PATH}"
}

scorecard_infer_platform_from_repo() {
  local REPO_URI="${1}"

  if [[ "${REPO_URI}" == github.com/* ]]; then
    SCORECARD_PLATFORM=github
  else
    SCORECARD_PLATFORM=gitlab
  fi
  SCORECARD_REPO="${REPO_URI}"
}

scorecard_resolve_repo() {
  local REPO_ROOT="${1}"

  SCORECARD_PLATFORM=""
  SCORECARD_GL_HOST="${GL_HOST:-${SCORECARD_GL_HOST:-}}"

  if [[ -n "${SCORECARD_REPO:-}" ]]; then
    scorecard_infer_platform_from_repo "${SCORECARD_REPO}"
    return 0
  fi

  SCORECARD_REPO=""
  local REMOTE_URL PARSED HOST REPO_PATH
  REMOTE_URL="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null || true)"
  if [[ -z "${REMOTE_URL}" ]]; then
    printf 'scorecard: set SCORECARD_REPO=github.com/owner/repo or gitlab.com/group/project (no origin remote)\n' >&2
    return 1
  fi

  PARSED="$(scorecard_parse_git_remote_url "${REMOTE_URL}")" || {
    printf 'scorecard: could not parse origin remote: %s\n' "${REMOTE_URL}" >&2
    return 1
  }
  HOST="$(printf '%s\n' "${PARSED}" | sed -n '1p')"
  REPO_PATH="$(printf '%s\n' "${PARSED}" | sed -n '2p')"

  if [[ "${HOST}" == "github.com" ]]; then
    SCORECARD_PLATFORM=github
    SCORECARD_REPO="github.com/${REPO_PATH}"
    return 0
  fi

  SCORECARD_PLATFORM=gitlab
  if [[ "${HOST}" == "gitlab.com" ]]; then
    SCORECARD_REPO="gitlab.com/${REPO_PATH}"
    return 0
  fi

  SCORECARD_REPO="${HOST}/${REPO_PATH}"
  return 0
}

scorecard_build_podman_auth_args() {
  SCORECARD_PODMAN_AUTH_ARGS=()
  if [[ -n "${GITHUB_AUTH_TOKEN:-}" ]]; then
    SCORECARD_PODMAN_AUTH_ARGS+=(-e "GITHUB_AUTH_TOKEN=${GITHUB_AUTH_TOKEN}")
  fi
  if [[ -n "${GITLAB_AUTH_TOKEN:-}" ]]; then
    SCORECARD_PODMAN_AUTH_ARGS+=(-e "GITLAB_AUTH_TOKEN=${GITLAB_AUTH_TOKEN}")
  fi
  if [[ -n "${SCORECARD_GL_HOST:-}" ]]; then
    SCORECARD_PODMAN_AUTH_ARGS+=(-e "GL_HOST=${SCORECARD_GL_HOST}")
  fi
}

scorecard_require_remote_auth() {
  case "${SCORECARD_PLATFORM}" in
    github)
      if [[ -z "${GITHUB_AUTH_TOKEN:-}" ]]; then
        printf 'scorecard-local: GITHUB_AUTH_TOKEN is required for %s (fine-grained PAT with contents:read)\n' "${SCORECARD_REPO}" >&2
        exit 1
      fi
      ;;
    gitlab)
      if [[ -z "${GITLAB_AUTH_TOKEN:-}" ]]; then
        printf 'scorecard-local: GITLAB_AUTH_TOKEN is required for %s (read_api, read_user, read_repository)\n' "${SCORECARD_REPO}" >&2
        exit 1
      fi
      ;;
    *)
      printf 'scorecard-local: unknown platform for %s\n' "${SCORECARD_REPO}" >&2
      exit 1
      ;;
  esac
}

scorecard_warn_missing_auth() {
  if [[ -n "${GITHUB_AUTH_TOKEN:-}" || -n "${GITLAB_AUTH_TOKEN:-}" ]]; then
    return 0
  fi
  printf 'scorecard pre-commit: GITHUB_AUTH_TOKEN and GITLAB_AUTH_TOKEN unset — some checks may be incomplete\n' >&2
}
