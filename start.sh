#!/usr/bin/env bash

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

cleanup() {
  pkill -f "python app.py" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
}

start_backend() {
  echo -e "${BLUE}Starting backend...${NC}"

  cd "$BACKEND"

  if [ ! -d "venv" ]; then
    python3 -m venv venv
  fi

  source venv/bin/activate

  pip install -r requirements.txt

  python app.py &
}

start_frontend() {
  echo -e "${BLUE}Starting frontend...${NC}"

  cd "$FRONTEND"

  npm install

  npm run dev &
}

build_frontend() {
  echo -e "${BLUE}Building frontend...${NC}"

  cd "$FRONTEND"

  npm install
  npm run build
}

case "$1" in
  build)
    build_frontend
    ;;
  backend)
    start_backend
    wait
    ;;
  frontend)
    start_frontend
    wait
    ;;
  stop)
    cleanup
    echo -e "${GREEN}Stopped all services${NC}"
    ;;
  *)
    cleanup

    start_backend
    sleep 2

    start_frontend

    echo ""
    echo -e "${GREEN}Dependency Analyzer Running${NC}"
    echo -e "Frontend: ${BLUE}http://localhost:3000${NC}"
    echo -e "Backend:  ${BLUE}http://localhost:5000${NC}"
    echo ""

    trap cleanup EXIT INT
    wait
    ;;
esac