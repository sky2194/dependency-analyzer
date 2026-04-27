#!/bin/bash

PROJECT="/Users/saikoutilyayerabtai/Projects/dependency-analyzer"
FRONTEND="$PROJECT/frontend"
BACKEND="$PROJECT/backend"


 echo "Cleaning ports..."
   lsof -ti :5000 | xargs kill -9 2>/dev/null
   lsof -ti :3000 | xargs kill -9 2>/dev/null

   
# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

start_backend() {
  echo -e "${BLUE}Starting backend...${NC}"
  cd "$BACKEND"
  # Load .env if present
  [ -f .env ] && export $(cat .env | grep -v "^#" | xargs)
  if [ ! -d "venv" ]; then
    echo "Creating virtualenv..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt -q
  else
    source venv/bin/activate
  fi
  python app.py &
  BACKEND_PID=$!
  echo -e "${GREEN}✅ Backend running on http://localhost:5000 (PID: $BACKEND_PID)${NC}"
}

start_frontend() {
  echo -e "${BLUE}Starting frontend...${NC}"
  cd "$FRONTEND"
  if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install -q
  fi
  npm run dev &
  FRONTEND_PID=$!
  echo -e "${GREEN}✅ Frontend running on http://localhost:3000 (PID: $FRONTEND_PID)${NC}"
}

stop_all() {
  echo -e "${YELLOW}Stopping all services...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  pkill -f "python app.py" 2>/dev/null
  pkill -f "vite" 2>/dev/null
  echo -e "${GREEN}✅ All services stopped${NC}"
  exit 0
}

case "$1" in
  backend)
    start_backend
    wait $BACKEND_PID
    ;;
  frontend)
    start_frontend
    wait $FRONTEND_PID
    ;;
  stop)
    pkill -f "python app.py" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    echo -e "${GREEN}✅ All services stopped${NC}"
    ;;
  *)
    # Start both
    start_backend
    sleep 2
    start_frontend
    echo ""
    echo -e "${GREEN}🚀 Dependency Analyzer is running!${NC}"
    echo -e "   Frontend: ${BLUE}http://localhost:3000${NC}"
    echo -e "   Backend:  ${BLUE}http://localhost:5000${NC}"
    echo ""
    echo "Press Ctrl+C to stop all services"
    trap stop_all INT
    wait
    ;;
esac
