#!/bin/bash

PROJECT="/Users/saikoutilyayerabtai/Projects/dependency-analyzer"
BACKEND="$PROJECT/backend"
FRONTEND="$PROJECT/frontend"
TESTS="$PROJECT/tests"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✅ $1${NC}"; ((PASS++)); }
fail() { echo -e "  ${RED}❌ $1${NC}"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; ((WARN++)); }
header() { echo -e "\n${BOLD}$1${NC}"; echo "  $(printf '─%.0s' {1..50})"; }

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}   DEPENDENCY ANALYZER — HEALTH CHECK${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Load .env if present
if [ -f "$BACKEND/.env" ]; then
  export $(cat "$BACKEND/.env" | grep -v "^#" | grep -v "^$" | xargs)
fi

# ── 1. PROJECT STRUCTURE ─────────────────────────────────────────────────────
header "📁 PROJECT STRUCTURE"

for f in "backend/app.py" "backend/requirements.txt" \
          "backend/parsers/npm_parser.py" "backend/parsers/pypi_parser.py" "backend/parsers/maven_parser.py" \
          "backend/resolvers/npm_resolver.py" "backend/cve/osv_client.py" "backend/cve/nvd_client.py" \
          "frontend/src/App.jsx" "frontend/src/pages/Dashboard.jsx" "frontend/src/pages/Results.jsx" \
          "frontend/src/pages/Search.jsx" "frontend/package.json" "frontend/vite.config.js"; do
  if [ -f "$PROJECT/$f" ]; then
    pass "$f exists"
  else
    fail "$f MISSING"
  fi
done

# ── 2. BACKEND ENVIRONMENT ────────────────────────────────────────────────────
header "🐍 BACKEND ENVIRONMENT"

if [ -d "$BACKEND/venv" ]; then
  pass "Virtual environment exists"
else
  fail "Virtual environment missing — run: cd backend && python3 -m venv venv"
fi

if [ -f "$BACKEND/venv/bin/python" ]; then
  PY_VER=$("$BACKEND/venv/bin/python" --version 2>&1)
  pass "Python: $PY_VER"
fi

for pkg in flask flask_cors requests xmltodict packaging pytest; do
  if "$BACKEND/venv/bin/pip" show $pkg > /dev/null 2>&1; then
    pass "$pkg installed"
  else
    fail "$pkg NOT installed — run: pip install -r requirements.txt"
  fi
done

# ── 3. BACKEND UNIT TESTS ─────────────────────────────────────────────────────
header "🧪 UNIT TESTS (Parsers & Logic)"

cd "$BACKEND"
source venv/bin/activate 2>/dev/null

echo "  Running parser tests..."
if python -m pytest "$TESTS/backend/test_parsers.py" -q --tb=no 2>&1 | grep -q "passed"; then
  PARSER_RESULT=$(python -m pytest "$TESTS/backend/test_parsers.py" -q --tb=no 2>&1 | tail -1)
  pass "Parsers: $PARSER_RESULT"
else
  PARSER_RESULT=$(python -m pytest "$TESTS/backend/test_parsers.py" -q --tb=short 2>&1 | tail -5)
  fail "Parser tests failed:\n$PARSER_RESULT"
fi

echo "  Running resolver tests..."
if python -m pytest "$TESTS/backend/test_resolvers.py" -q --tb=no 2>&1 | grep -q "passed"; then
  pass "Resolvers: $(python -m pytest "$TESTS/backend/test_resolvers.py" -q --tb=no 2>&1 | tail -1)"
else
  fail "Resolver tests failed"
fi

# ── 4. BACKEND SERVER ─────────────────────────────────────────────────────────
header "🚀 BACKEND SERVER (live)"

if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
  HEALTH=$(curl -s http://localhost:5000/api/health)
  pass "Server running — $HEALTH"

  # Test analyze endpoint
  echo "  Testing /api/analyze (npm) — this may take 60s..."
  ANALYZE=$(curl -s -X POST http://localhost:5000/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"content":"{\"name\":\"test\",\"dependencies\":{\"lodash\":\"4.17.21\"}}","filename":"package.json"}' \
    --max-time 90)
  if echo "$ANALYZE" | grep -q "ecosystem"; then
    pass "/api/analyze — returned valid response"
  elif [ -z "$ANALYZE" ]; then
    fail "/api/analyze — timed out (resolver fetching transitive deps is slow on first run)"
  else
    fail "/api/analyze — unexpected response: ${ANALYZE:0:200}"
  fi

  # Test search endpoint
  echo "  Testing /api/search..."
  SEARCH=$(curl -s "http://localhost:5000/api/search?pkg=lodash&version=4.17.11" --max-time 15)
  if echo "$SEARCH" | grep -q "vulnerabilities"; then
    pass "/api/search — returned valid response"
  else
    fail "/api/search — unexpected response"
  fi

  # Test NVD API key
  if [ -z "$NVD_API_KEY" ]; then
    warn "NVD_API_KEY not set — NVD requests are rate-limited (5/30s). Get free key: https://nvd.nist.gov/developers/request-an-api-key"
  else
    pass "NVD_API_KEY configured"
  fi

else
  fail "Backend server NOT running on port 5000"
  warn "Start it: cd backend && source venv/bin/activate && python app.py"
fi

# ── 5. CVE CLIENTS ────────────────────────────────────────────────────────────
header "🔐 CVE DATA SOURCES"

echo "  Testing OSV.dev connection..."
OSV=$(curl -s -X POST https://api.osv.dev/v1/query \
  -H "Content-Type: application/json" \
  -d '{"version":"4.17.11","package":{"name":"lodash","ecosystem":"npm"}}' \
  --max-time 10)
if echo "$OSV" | grep -q "vulns\|id"; then
  pass "OSV.dev API reachable and returning data"
else
  fail "OSV.dev API not reachable — check internet connection"
fi

echo "  Testing NVD API connection..."
NVD=$(curl -s "https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=lodash&resultsPerPage=1" --max-time 10)
if echo "$NVD" | grep -q "vulnerabilities\|totalResults"; then
  pass "NVD API reachable"
else
  warn "NVD API slow or rate-limited — consider adding NVD_API_KEY"
fi

# ── 6. FRONTEND ───────────────────────────────────────────────────────────────
header "⚛️  FRONTEND"

cd "$FRONTEND"

if [ -d "node_modules" ]; then
  pass "node_modules installed"
else
  fail "node_modules missing — run: npm install"
fi

echo "  Running build check..."
BUILD=$(npx vite build 2>&1)
if echo "$BUILD" | grep -q "built in"; then
  BUILT_IN=$(echo "$BUILD" | grep "built in" | tail -1)
  pass "Build successful — $BUILT_IN"
else
  fail "Build failed:\n$(echo "$BUILD" | tail -5)"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  pass "Frontend running on http://localhost:3000"
else
  warn "Frontend not running — start: npm run dev"
fi

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
TOTAL=$((PASS + FAIL + WARN))
echo -e "  ${GREEN}${PASS} passed${NC} · ${YELLOW}${WARN} warnings${NC} · ${RED}${FAIL} failed${NC}"

if [ $FAIL -eq 0 ] && [ $WARN -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}Your app is healthy 🟢${NC}"
elif [ $FAIL -eq 0 ]; then
  echo -e "  ${YELLOW}${BOLD}App running with warnings 🟡${NC}"
else
  echo -e "  ${RED}${BOLD}Issues found — check failures above 🔴${NC}"
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Watch mode - re-run every 120 seconds
if [ "$1" == "--watch" ]; then
  SCRIPT_PATH="$PROJECT/tests/test.sh"
  while true; do
    echo -e "${YELLOW}Re-running in 120s... (Ctrl+C to stop)${NC}"
    sleep 120
    clear
    exec bash "$SCRIPT_PATH" --watch
  done
fi
