#!/bin/bash

PROJECT="/Users/saikoutilyayerabtai/Projects/dependency-analyzer"
BACKEND="$PROJECT/backend"
FRONTEND="$PROJECT/frontend"
TESTS="$PROJECT/tests"

GREEN='\033[0;32m' RED='\033[0;31m' YELLOW='\033[1;33m' BOLD='\033[1m' NC='\033[0m'
PASS=0; FAIL=0; WARN=0; SKIP=0

pass() { echo -e "  ${GREEN}✅ $1${NC}"; ((PASS++)); }
fail() { echo -e "  ${RED}❌ $1${NC}"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; ((WARN++)); }
skip() { echo -e "  ⬜ $1"; ((SKIP++)); }
header() { echo -e "\n${BOLD}$1${NC}"; echo "  ─────────────────────────────────────────────"; }

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}   DEPENDENCY ANALYZER — HEALTH CHECK${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Load .env
[ -f "$BACKEND/.env" ] && export $(cat "$BACKEND/.env" | grep -v "^#" | grep -v "^$" | xargs) 2>/dev/null

# ── 1. PROJECT STRUCTURE ─────────────────────────────────────────────────────
header "📁 PROJECT STRUCTURE"
REQUIRED_FILES=(
  "backend/requirements.txt"
  "backend/parsers/npm_parser.py" "backend/parsers/pypi_parser.py"
  "backend/parsers/maven_parser.py" "backend/parsers/lockfile_parser.py"
  "backend/resolvers/npm_resolver.py" "backend/resolvers/pypi_resolver.py"
  "backend/resolvers/maven_resolver.py" "backend/resolvers/lockfile_resolver.py"
  "backend/cve/osv_client.py" "backend/cve/nvd_client.py" "backend/cve/scanner.py"
  "backend/export/pdf_export.py" "backend/export/csv_export.py"
  "frontend/src/App.jsx" "frontend/src/pages/Dashboard.jsx"
  "frontend/src/pages/Results.jsx"
  "frontend/src/components/FileUpload.jsx" "frontend/src/components/VulnerabilityReport.jsx"
  "frontend/src/components/DependencyGraph.jsx" "frontend/src/components/CVEDetail.jsx"
  "frontend/src/components/Tooltip.jsx" "frontend/src/data/terms.js"
  "frontend/package.json" "frontend/vite.config.js"
  "tests/backend/test_parsers.py" "tests/backend/test_cve.py"
  "tests/backend/test_api.py" "tests/backend/test_resolvers.py"
  "start.sh" ".gitignore" "README.md"
)
DEAD_FILES=("frontend/src/pages/Search.jsx" "frontend/src/components/SearchBar.jsx")

for f in "${REQUIRED_FILES[@]}"; do
  [ -f "$PROJECT/$f" ] && pass "$f" || fail "$f MISSING"
done
for f in "${DEAD_FILES[@]}"; do
  [ ! -f "$PROJECT/$f" ] && pass "$f correctly removed" || fail "$f should be deleted (dead code)"
done

# ── 2. ENVIRONMENT ────────────────────────────────────────────────────────────
header "🐍 BACKEND ENVIRONMENT"
[ -d "$BACKEND/venv" ] && pass "virtualenv exists" || fail "virtualenv missing — run: python3 -m venv venv"
for pkg in flask flask_cors requests xmltodict packaging pytest; do
  "$BACKEND/venv/bin/pip" show $pkg > /dev/null 2>&1 && pass "$pkg installed" || fail "$pkg missing — pip install -r requirements.txt"
done
[ -n "$NVD_API_KEY" ] && pass "NVD_API_KEY configured" || warn "NVD_API_KEY not set — CVSS scores may be 0"
[ -f "$BACKEND/.env" ] && pass ".env file exists" || warn ".env missing — copy from .env.example"

# ── 3. UNIT TESTS ─────────────────────────────────────────────────────────────
header "🧪 UNIT TESTS"
cd "$BACKEND" && source venv/bin/activate 2>/dev/null

run_pytest() {
  local name=$1; local file=$2
  OUT=$(python -m pytest "$file" -q --tb=short 2>&1)
  if echo "$OUT" | grep -q "passed"; then
    STATS=$(echo "$OUT" | grep -E "passed|failed|error" | tail -1)
    pass "$name: $STATS"
    if echo "$OUT" | grep -q "failed\|error"; then
      echo "$OUT" | grep "FAILED\|ERROR" | while read l; do echo -e "    ${RED}$l${NC}"; done
    fi
  else
    fail "$name failed"
    echo "$OUT" | tail -10 | while read l; do echo "    $l"; done
  fi
}

run_pytest "Parsers" "$TESTS/backend/test_parsers.py"
run_pytest "Resolvers" "$TESTS/backend/test_resolvers.py"
run_pytest "CVE clients" "$TESTS/backend/test_cve.py"

# ── 4. BACKEND LIVE ───────────────────────────────────────────────────────────
header "🚀 BACKEND SERVER"
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
  HEALTH=$(curl -s http://localhost:5000/api/health)
  pass "Server running"
  echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'     NVD key: {d.get(\"nvd_api_key_configured\")}, Rate limit: {d.get(\"rate_limit\")}')" 2>/dev/null

  run_pytest "API endpoints" "$TESTS/backend/test_api.py"
else
  fail "Backend NOT running on port 5000"
  warn "Start it: ./start.sh backend"
  skip "API tests skipped — backend offline"
fi

# ── 5. CVE DATA SOURCES ───────────────────────────────────────────────────────
header "🔐 CVE DATA SOURCES"
OSV=$(curl -s -X POST https://api.osv.dev/v1/query \
  -H "Content-Type: application/json" \
  -d '{"version":"4.17.11","package":{"name":"lodash","ecosystem":"npm"}}' --max-time 8)
if echo "$OSV" | grep -q '"id"'; then
  COUNT=$(echo "$OSV" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('vulns',[])))" 2>/dev/null)
  pass "OSV.dev reachable — $COUNT CVEs for lodash@4.17.11"
else
  fail "OSV.dev not reachable"
fi

NVD=$(curl -s "https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2021-44228" --max-time 8)
if echo "$NVD" | grep -q "CVE-2021-44228"; then
  SCORE=$(echo "$NVD" | python3 -c "import sys,json; d=json.load(sys.stdin); m=d['vulnerabilities'][0]['cve']['metrics']; k=next(iter(m)); print(m[k][0]['cvssData']['baseScore'])" 2>/dev/null)
  pass "NVD reachable — Log4Shell CVSS: $SCORE"
else
  warn "NVD slow or rate-limited"
fi

# ── 6. FRONTEND ───────────────────────────────────────────────────────────────
header "⚛️  FRONTEND"
cd "$FRONTEND"
[ -d "node_modules" ] && pass "node_modules installed" || fail "run: npm install"

BUILD=$(npx vite build 2>&1)
if echo "$BUILD" | grep -q "built in"; then
  pass "Build: $(echo "$BUILD" | grep 'built in' | tail -1 | xargs)"
else
  fail "Build failed"
  echo "$BUILD" | tail -8
fi

curl -s http://localhost:3000 > /dev/null 2>&1 && pass "Frontend running on :3000" || warn "Frontend not running — ./start.sh frontend"

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}${PASS} passed${NC} · ${YELLOW}${WARN} warnings${NC} · ${RED}${FAIL} failed${NC} · ${SKIP} skipped"
if [ $FAIL -eq 0 ] && [ $WARN -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}App is healthy 🟢${NC}"
elif [ $FAIL -eq 0 ]; then
  echo -e "  ${YELLOW}${BOLD}Running with warnings 🟡${NC}"
else
  echo -e "  ${RED}${BOLD}Issues found — fix failures above 🔴${NC}"
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
