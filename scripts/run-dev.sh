#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/my-book-club-api"
UI_DIR="$ROOT_DIR/my-book-club-ui"
LOG_DIR="$ROOT_DIR/.logs"

API_PORT="${API_PORT:-4000}"
REDIS_PORT="${REDIS_PORT:-6379}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"

mkdir -p "$LOG_DIR"

STARTED_PIDS=()

cleanup() {
  for pid in "${STARTED_PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

reset_frontend_runtime() {
  echo "Resetting Expo / Metro state..."
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true

  if command -v watchman >/dev/null 2>&1; then
    watchman watch-del-all >/dev/null 2>&1 || true
  fi

  sleep 1
}

start_background_if_missing() {
  local name="$1"
  local port="$2"
  local command="$3"
  local log_file="$4"

  if is_port_listening "$port"; then
    echo "$name already running on port $port"
    return
  fi

  echo "Starting $name..."
  (
    cd "$ROOT_DIR"
    eval "$command"
  ) >"$log_file" 2>&1 &

  local pid=$!
  STARTED_PIDS+=("$pid")
  sleep 2

  if is_port_listening "$port"; then
    echo "$name started on port $port"
    return
  fi

  echo "Failed to start $name. Check $log_file"
  exit 1
}

detect_host_ip() {
  if [[ -n "${MYBOOKCLUB_HOST_IP:-}" ]]; then
    echo "$MYBOOKCLUB_HOST_IP"
    return
  fi

  local candidate
  for iface in en0 en1; do
    candidate="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done

  echo "127.0.0.1"
}

HOST_IP="$(detect_host_ip)"

if command -v redis-server >/dev/null 2>&1; then
  start_background_if_missing "Redis" "$REDIS_PORT" "redis-server" "$LOG_DIR/redis.log"
else
  echo "redis-server not found. Skipping Redis startup."
fi

if command -v ollama >/dev/null 2>&1; then
  start_background_if_missing "Ollama" "$OLLAMA_PORT" "ollama serve" "$LOG_DIR/ollama.log"
else
  echo "ollama not found. Skipping Ollama startup."
fi

if is_port_listening "$API_PORT"; then
  echo "API already running on port $API_PORT"
else
  echo "Starting API..."
  (
    cd "$API_DIR"
    npm run dev
  ) >"$LOG_DIR/api.log" 2>&1 &
  STARTED_PIDS+=("$!")
  sleep 3

  if ! is_port_listening "$API_PORT"; then
    echo "Failed to start API. Check $LOG_DIR/api.log"
    exit 1
  fi

  echo "API started on http://$HOST_IP:$API_PORT"
fi

EXPO_START_MODE="${EXPO_START_MODE:-lan}"
EXPO_BUNDLE_REV="$(date +%s)"
APP_TARGET="${APP_TARGET:-ios-simulator}"

reset_frontend_runtime

cd "$UI_DIR"

if [[ "$APP_TARGET" == "phone" ]]; then
  echo "Starting Expo for phone with API base URL http://$HOST_IP:$API_PORT using --$EXPO_START_MODE"
  EXPO_PUBLIC_API_BASE_URL="http://$HOST_IP:$API_PORT" \
  EXPO_PUBLIC_BUNDLE_REV="$EXPO_BUNDLE_REV" \
  npx expo start --go "--$EXPO_START_MODE" -c
else
  echo "Starting Expo in iOS Simulator with API base URL http://127.0.0.1:$API_PORT"
  EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:$API_PORT" \
  EXPO_PUBLIC_BUNDLE_REV="$EXPO_BUNDLE_REV" \
  npx expo start --ios -c
fi
