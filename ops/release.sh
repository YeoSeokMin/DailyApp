#!/usr/bin/env bash
# Vendored into each project's ops/. Keep copies identical to operations/release.sh.
set -Eeuo pipefail
umask 077
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/project.sh"
ACTION="${1:-prepare}"
SHA="${2:-}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'A full commit SHA is required' >&2; exit 64; }
[[ "$ACTION" == prepare || "$ACTION" == activate || "$ACTION" == apply || "$ACTION" == rollback ]] || exit 64
CONFIG="${DEPLOY_CONFIG:-/home/opc/apps/ops-config/$APP_ID.conf}"
[[ -r "$CONFIG" ]] || { echo "Missing deployment config: $CONFIG" >&2; exit 78; }
source "$CONFIG"
: "${SOURCE_REPO:?}" "${RELEASE_ROOT:?}" "${APP_ENV_FILE:?}"
if [[ "$APP_KIND" == next || "$APP_KIND" == backend || "$APP_KIND" == docker ]]; then : "${HEALTH_URL:?}"; fi
if [[ "$APP_KIND" == next || "$APP_KIND" == backend ]]; then : "${APP_PORT:?Confirm the listening port from the server inventory}"; fi
[[ "$RELEASE_ROOT" = /* && "$APP_ENV_FILE" = /* && -r "$APP_ENV_FILE" ]] || exit 78
mkdir -p "$RELEASE_ROOT"
RELEASE_ROOT="$(cd "$RELEASE_ROOT" && pwd -P)"
exec 9>"$RELEASE_ROOT/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 75; }
if [[ "$APP_KIND" != docker ]]; then
  : "${NODE_BIN_DIR:?Use a separately installed Node 24 runtime}"
  export PATH="${AI_BIN_DIR:+$AI_BIN_DIR:}$NODE_BIN_DIR:$PATH"
  [[ "$(node -p 'process.versions.node')" == 24.21.0 ]] || { echo 'Node 24.21.0 is required' >&2; exit 78; }
  if [[ "$APP_ID" == helper || "$APP_ID" == aifeed || "$APP_ID" == dailyapp || "$APP_ID" == bitbattle ]]; then
    : "${AI_BIN_DIR:?Pin a reviewed copy of the existing AI guards}"
    node "$SCRIPT_DIR/verify-ai-runtime.cjs" "$AI_BIN_DIR" "${AI_MANIFEST_SHA256:?Pin the reviewed manifest hash}"
    export CODEX_CLI_PATH="$AI_BIN_DIR/codex" CLAUDE_CLI_PATH="$AI_BIN_DIR/claude"
  fi
fi
TARGET="$RELEASE_ROOT/$SHA"

prepare() {
  if [[ -f "$TARGET/.release-ready" ]]; then return; fi
  [[ ! -e "$TARGET" ]] || { echo 'Incomplete target exists; inspect it before retrying' >&2; exit 73; }
  git -C "$SOURCE_REPO" diff --quiet
  git -C "$SOURCE_REPO" diff --cached --quiet
  [[ -z "$(git -C "$SOURCE_REPO" ls-files --others --exclude-standard)" ]] || { echo 'Capture untracked operational code first' >&2; exit 73; }
  git -C "$SOURCE_REPO" fetch --no-tags origin "$SHA"
  [[ "$(git -C "$SOURCE_REPO" rev-parse "$SHA^{commit}")" == "$SHA" ]] || exit 65
  local stage
  stage="$(mktemp -d "$RELEASE_ROOT/.prepare-$SHA-XXXXXX")"
  git clone --no-hardlinks --no-checkout "$SOURCE_REPO" "$stage"
  git -C "$stage" remote set-url origin "$(git -C "$SOURCE_REPO" remote get-url origin)"
  git -C "$stage" checkout --detach "$SHA"
  if [[ "$APP_KIND" == cron ]]; then git -C "$stage" checkout -B main; fi
  ln -s "$APP_ENV_FILE" "$stage/.env"
  if [[ "$APP_ID" == aifeed || "$APP_ID" == helper ]]; then
    : "${SHARED_DATA_DIR:?Copy and back up existing data before cutover}"
    [[ -d "$SHARED_DATA_DIR" && ! -e "$stage/data" ]] || exit 78
    ln -s "$SHARED_DATA_DIR" "$stage/data"
  fi
  # Ignored, server-only prompts/reference files are supplied explicitly from a reviewed directory.
  if [[ -n "${OVERLAY_DIR:-}" ]]; then
    [[ -d "$OVERLAY_DIR" ]] || exit 78
    while IFS= read -r -d '' file; do
      local relative="${file#"$OVERLAY_DIR/"}"
      [[ ! -e "$stage/$relative" ]] || { echo "Overlay would overwrite tracked file: $relative" >&2; exit 73; }
      mkdir -p "$(dirname "$stage/$relative")"
      cp -- "$file" "$stage/$relative"
    done < <(find "$OVERLAY_DIR" -type f -print0)
  fi
  case "$APP_KIND" in
    next) (cd "$stage"; npm ci; npm run build) ;;
    worker|cron) (cd "$stage"; npm ci --omit=dev) ;;
    backend) (cd "$stage/backend"; ln -s "$APP_ENV_FILE" .env; npm ci; npm run build) ;;
    docker) docker build -t "$APP_ID:$SHA" "$stage/backend" ;;
  esac
  printf '%s\n' "$SHA" > "$stage/.release-ready"
  mv -- "$stage" "$TARGET"
}

switch_pointer() {
  ln -s "$1" "$RELEASE_ROOT/.current-$$"
  mv -Tf -- "$RELEASE_ROOT/.current-$$" "$RELEASE_ROOT/current"
}

start_release() {
  local release="$1"
  case "$APP_KIND" in
    docker)
      : "${BAEDANG_NETWORK:?Use the existing Docker network; never create a replacement database}" "${COMPOSE_PROJECT_NAME:?Use the existing Compose project name}"
      export BAEDANG_NETWORK APP_ENV_FILE
      export RELEASE_IMAGE="$APP_ID:$(cat "$release/.release-ready")"
      docker compose -p "$COMPOSE_PROJECT_NAME" -f "$SCRIPT_DIR/compose.release.yml" up -d --no-deps api
      ;;
    cron) : ;; # cron calls RELEASE_ROOT/current/run-pipeline.sh; no pipeline starts during deploy.
    *)
      export APP_RELEASE="$release" APP_KIND APP_ID APP_PORT
      node "$SCRIPT_DIR/pm2-config.cjs" > "$RELEASE_ROOT/process.json" || return
      export PM2_MODULE_PATH="$(dirname "$(dirname "$(readlink -f "$(command -v pm2)")")")"
      node "$SCRIPT_DIR/pm2-apply.cjs" "$RELEASE_ROOT/process.json"
      ;;
  esac
}

healthy() {
  local release="$1"
  if [[ "$APP_KIND" == worker ]]; then
    sleep 3
    pm2 jlist | node "$SCRIPT_DIR/worker-health.cjs" "$APP_ID"
    return
  fi
  if [[ "$APP_KIND" == cron ]]; then node --check "$release/scripts/pipeline.js"; return; fi
  for attempt in {1..20}; do
    if curl --fail --silent --max-time 5 --output /dev/null "$HEALTH_URL"; then return 0; fi
    sleep 2
  done
  return 1
}

if [[ "$ACTION" == prepare || "$ACTION" == apply ]]; then prepare; fi
if [[ "$ACTION" == prepare ]]; then echo "Prepared $APP_ID $SHA"; exit 0; fi
[[ -f "$TARGET/.release-ready" ]] || { echo 'Prepare this commit first' >&2; exit 66; }
PREVIOUS="$(readlink -f "$RELEASE_ROOT/current" || true)"
[[ -n "$PREVIOUS" && -d "$PREVIOUS" ]] || { echo 'Register a verified baseline release before activation' >&2; exit 78; }
if [[ "$APP_ID" == aifeed ]]; then
  [[ "${SQLITE_ROLLBACK_READY:-0}" == 1 ]] || { echo 'Prepare a compatible SQLite rollback baseline first' >&2; exit 78; }
fi
if [[ "$APP_ID" == helper && "$ACTION" != rollback ]]; then
  (cd "$TARGET"; node --env-file="$APP_ENV_FILE" scripts/migrate.mjs)
fi
switch_pointer "$TARGET"
if start_release "$TARGET" && healthy "$TARGET"; then
  if [[ "$APP_KIND" != docker && "$APP_KIND" != cron ]]; then pm2 save; fi
  mkdir -p /home/opc/apps/.deploy-timestamps
  date '+%Y-%m-%d %H:%M:%S' > "/home/opc/apps/.deploy-timestamps/$TIMESTAMP_NAME.txt"
  echo "Activated $APP_ID $SHA"
else
  echo 'Activation failed; restoring the previous release' >&2
  switch_pointer "$PREVIOUS"
  if ! start_release "$PREVIOUS" || ! healthy "$PREVIOUS"; then
    echo 'The previous release also failed its health check; operator intervention is required' >&2
  fi
  exit 1
fi
