#!/usr/bin/env bash
set -Eeuo pipefail
export TZ=Asia/Seoul
APP_DIR="${DAILYAPP_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)}"
cd "$APP_DIR"
RUNTIME_CONFIG="${DAILYAPP_RUNTIME_CONFIG:-/home/opc/apps/ops-config/dailyapp.conf}"
if [[ -r "$RUNTIME_CONFIG" ]]; then source "$RUNTIME_CONFIG"; fi
if [[ -n "${NODE_BIN_DIR:-}" ]]; then export PATH="${AI_BIN_DIR:+$AI_BIN_DIR:}$NODE_BIN_DIR:$PATH"; fi
export DAILYAPP_STATE_DIR="${DAILYAPP_STATE_DIR:-$APP_DIR/output}"
NODE_BIN="${NODE_BIN:-node}"
[[ "$($NODE_BIN -p 'process.versions.node.split(".")[0]')" == 24 ]] || { echo 'Node 24 is required' >&2; exit 1; }
if [[ -n "${AI_BIN_DIR:-}" ]]; then
  "$NODE_BIN" ops/verify-ai-runtime.cjs "$AI_BIN_DIR" "${AI_MANIFEST_SHA256:?Pin the reviewed AI runtime}"
  export CODEX_CLI_PATH="$AI_BIN_DIR/codex" CLAUDE_CLI_PATH="$AI_BIN_DIR/claude"
fi
mkdir -p "$DAILYAPP_STATE_DIR"
exec 9>"$DAILYAPP_STATE_DIR/.pipeline.lock"
flock -n 9 || { echo 'Pipeline already running' >&2; exit 75; }
export DAILYAPP_LOCK_HELD=1
exec "$NODE_BIN" scripts/pipeline.js "$@" >> "$DAILYAPP_STATE_DIR/pipeline_$(date +%Y%m%d).log" 2>&1
