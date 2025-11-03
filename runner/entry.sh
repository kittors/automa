#!/usr/bin/env bash
set -euo pipefail

echo "[entry] NODE=$(node -v)" >&2
echo "[entry] HOST=${HOST:-} PORT=${PORT:-} HEADLESS=${HEADLESS:-} NO_SANDBOX=${NO_SANDBOX:-} PW_DEBUG=${PW_DEBUG:-}" >&2

# Ensure working directory
cd /app/runner 2>/dev/null || true
echo "[entry] CWD=$(pwd)" >&2
if [ ! -f src/server.js ]; then
  echo "[entry] ERROR: src/server.js not found in $(pwd)" >&2
fi

# Start server; if headed, run a background Xvfb and export DISPLAY
if [ "${HEADLESS:-false}" = "false" ]; then
  if ! command -v Xvfb >/dev/null 2>&1; then
    echo "[entry] Xvfb not found; installing..." >&2
    apt-get update -y && apt-get install -y --no-install-recommends xvfb && rm -rf /var/lib/apt/lists/*
  fi
  export DISPLAY=:99
  echo "[entry] launching Xvfb on $DISPLAY" >&2
  (Xvfb ${DISPLAY} -screen 0 1280x720x24 -ac +extension RANDR >/tmp/xvfb.log 2>&1 &)
  sleep 0.3
  echo "[entry] starting node (headed)" >&2
  exec node src/server.js
else
  echo "[entry] starting node (headless)" >&2
  exec node src/server.js
fi
