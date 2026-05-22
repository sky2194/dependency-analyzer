#!/usr/bin/env bash
# Dependency Analyzer — Start Script
# macOS · Linux · Windows (Git Bash / WSL)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_PORT=5000
FRONTEND_PORT=3000
BACKEND_PID_FILE="$ROOT/.backend.pid"
FRONTEND_PID_FILE="$ROOT/.frontend.pid"

# ── Colors (only if terminal) ─────────────────────────────────────────────────
if [ -t 1 ]; then
  GRN='\033[0;32m'; BLU='\033[0;34m'
  RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'
else
  GRN=''; BLU=''; RED=''; DIM=''; NC=''
fi

ok()   { printf "  ${GRN}✓${NC}  %s\n" "$1"; }
info() { printf "  ${BLU}→${NC}  %s\n" "$1"; }
err()  { printf "  ${RED}✗${NC}  %s\n" "$1" >&2; }
dim()  { printf "  ${DIM}%s${NC}\n"    "$1"; }

# ── OS detection ──────────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin*)              OS="mac"     ;;
  Linux*)               OS="linux"   ;;
  CYGWIN*|MINGW*|MSYS*) OS="win"     ;;
  *)                    OS="unknown" ;;
esac

# ── Utilities ─────────────────────────────────────────────────────────────────
has() { command -v "$1" >/dev/null 2>&1; }

# Free a port silently
free_port() {
  local port=$1
  if has lsof; then
    lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
  elif has fuser; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif has netstat; then
    local pid
    pid=$(netstat -ano 2>/dev/null | awk "/:${port}[[:space:]]/{print \$5}" | head -1)
    [ -n "$pid" ] && taskkill //PID "$pid" //F >/dev/null 2>&1 || true
  fi
}

# Wait until port accepts connections (max N seconds)
wait_for_port() {
  local port=$1 max=$2 i=0
  while ! (echo >/dev/tcp/localhost/"$port") 2>/dev/null; do
    sleep 0.5
    i=$((i + 1))
    [ $i -ge $((max * 2)) ] && return 1
  done
  return 0
}

# ── Stop ──────────────────────────────────────────────────────────────────────
stop_services() {
  local stopped=0
  if [ -f "$BACKEND_PID_FILE" ]; then
    kill "$(cat "$BACKEND_PID_FILE")" 2>/dev/null && stopped=1
    rm -f "$BACKEND_PID_FILE"
  fi
  if [ -f "$FRONTEND_PID_FILE" ]; then
    kill "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null && stopped=1
    rm -f "$FRONTEND_PID_FILE"
  fi
  free_port $BACKEND_PORT
  free_port $FRONTEND_PORT
  [ $stopped -eq 1 ] && ok "Services stopped" || dim "Nothing was running"
}

# ── Backend ───────────────────────────────────────────────────────────────────
start_backend() {
  cd "$BACKEND"

  # Detect Python
  local PYTHON
  if   has python3; then PYTHON=python3
  elif has python;  then PYTHON=python
  else err "Python not found — install Python 3.9+"; exit 1; fi

  # Create venv if missing
  if [ ! -d venv ]; then
    info "Creating virtual environment..."
    "$PYTHON" -m venv venv
  fi

  # Activate cross-OS (silent)
  if   [ -f "venv/Scripts/activate" ]; then source venv/Scripts/activate   # Windows
  elif [ -f "venv/bin/activate" ];     then source venv/bin/activate        # macOS / Linux
  else err "Virtual environment broken — delete backend/venv and retry"; exit 1; fi

  # Install deps silently — only show on failure
  local out
  if ! out=$(pip install -q -r requirements.txt 2>&1); then
    err "pip install failed:"; printf '%s\n' "$out"; exit 1
  fi

  # Kill port if already in use, then launch
  free_port $BACKEND_PORT

  # Suppress Python multiprocessing semaphore warnings (macOS system Python noise)
  PYTHONWARNINGS="ignore::UserWarning" python app.py > "$BACKEND/backend.log" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"

  if wait_for_port $BACKEND_PORT 10; then
    ok "Backend   → http://localhost:${BACKEND_PORT}"
  else
    err "Backend failed to start — see backend/backend.log"
    tail -20 "$BACKEND/backend.log"
    exit 1
  fi

  cd "$ROOT"
}

# ── Frontend ──────────────────────────────────────────────────────────────────
start_frontend() {
  cd "$FRONTEND"

  has npm || { err "Node.js / npm not found — install from https://nodejs.org"; exit 1; }

  # Install deps silently — only show on failure
  local out
  if ! out=$(npm install --silent 2>&1); then
    err "npm install failed:"; printf '%s\n' "$out"; exit 1
  fi

  # Kill port if already in use, then launch
  free_port $FRONTEND_PORT
  npm run dev > "$FRONTEND/frontend.log" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"

  if wait_for_port $FRONTEND_PORT 15; then
    ok "Frontend  → http://localhost:${FRONTEND_PORT}"
  else
    err "Frontend failed to start — see frontend/frontend.log"
    tail -20 "$FRONTEND/frontend.log"
    exit 1
  fi

  cd "$ROOT"
}

# ── Open browser ──────────────────────────────────────────────────────────────
open_browser() {
  local url="http://localhost:${FRONTEND_PORT}"
  case "$OS" in
    mac)   open "$url" ;;
    linux) xdg-open "$url" >/dev/null 2>&1 & ;;
    win)   cmd.exe /c start "$url" >/dev/null 2>&1 & ;;
  esac
}

# ── Cleanup on Ctrl+C ─────────────────────────────────────────────────────────
on_exit() { printf "\n"; stop_services; }

# ── Entry point ───────────────────────────────────────────────────────────────
case "${1:-start}" in

  stop)
    stop_services
    ;;

  restart)
    stop_services
    sleep 1
    exec "$0" start
    ;;

  logs)
    printf "\n${BLU}Backend log:${NC}\n"
    tail -50 "$BACKEND/backend.log" 2>/dev/null || dim "No backend log found"
    printf "\n${BLU}Frontend log:${NC}\n"
    tail -50 "$FRONTEND/frontend.log" 2>/dev/null || dim "No frontend log found"
    ;;

  start|*)
    printf "\n"
    info "Starting Dependency Analyzer..."
    printf "\n"

    trap on_exit EXIT INT TERM

    start_backend
    start_frontend

    printf "\n"
    printf "  ${GRN}Dependency Analyzer Running${NC}\n"
    printf "\n"
    printf "  Frontend:  ${BLU}http://localhost:${FRONTEND_PORT}${NC}\n"
    printf "  Backend:   ${BLU}http://localhost:${BACKEND_PORT}${NC}\n"
    printf "\n"
    dim "Ctrl+C to stop  ·  ./start.sh logs for debug output"
    printf "\n"

    open_browser

    wait
    ;;

esac