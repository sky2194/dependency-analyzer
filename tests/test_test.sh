#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCRIPT_UNDER_TEST="$REPO_ROOT/tests/test.sh"

fail() {
  echo "FAIL: $*" >&2
  FAIL=$((FAIL + 1))
}

pass() {
  echo "PASS: $*"
  PASS=$((PASS + 1))
}

create_fixture() {
  local root="$1"

  mkdir -p "$root/backend/parsers" "$root/backend/resolvers" "$root/backend/cve" \
           "$root/frontend/src/pages" "$root/tests/backend" "$root/bin"

  cat > "$root/backend/app.py" <<'EOF'
from flask import Flask
app = Flask(__name__)
EOF

  touch "$root/backend/requirements.txt"
  touch "$root/backend/parsers/npm_parser.py"
  touch "$root/backend/parsers/pypi_parser.py"
  touch "$root/backend/parsers/maven_parser.py"
  touch "$root/backend/resolvers/npm_resolver.py"
  touch "$root/backend/cve/osv_client.py"
  touch "$root/backend/cve/nvd_client.py"
  touch "$root/frontend/src/App.jsx"
  touch "$root/frontend/src/pages/Dashboard.jsx"
  touch "$root/frontend/src/pages/Results.jsx"

  cat > "$root/backend/venv/bin/python" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "-m" ]; then
  shift
  exec python -m "$@"
fi
printf "Python 3.11.0\n"
EOF

  cat > "$root/backend/venv/bin/pip" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "show" ]; then
  shift
fi
case "$1" in
  flask|flask_cors|requests|xmltodict|packaging|pytest) exit 0 ;;
  *) exit 1 ;;
esac
EOF

  cat > "$root/backend/venv/bin/activate" <<'EOF'
export PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd):$PATH"
EOF

  chmod +x "$root/backend/venv/bin/python" "$root/backend/venv/bin/pip" "$root/backend/venv/bin/activate"

  cat > "$root/tests/backend/test_parsers.py" <<'EOF'
def test_parser_dummy():
    assert True
EOF

  cat > "$root/tests/backend/test_resolvers.py" <<'EOF'
def test_resolver_dummy():
    assert True
EOF

  cat > "$root/backend/.env" <<'EOF'
NVD_API_KEY=test-key
EOF

  cat > "$root/bin/curl" <<'EOF'
#!/usr/bin/env bash
args="$*"
if [[ "$args" == *"/api/health"* ]]; then
  printf '{"status":"ok","rate_limit":100,"max_file_size":1048576,"allowed_origins":["*"]}'
  exit 0
fi
if [[ "$args" == *"/api/analyze"* ]]; then
  printf '{"ecosystem":"npm","project_name":"test","graph":{"name":"test","type":"root"},"vulnerabilities":[]}'
  exit 0
fi
if [[ "$args" == *"/api/search"* ]]; then
  printf '{"package":"lodash","vulnerabilities":[]}'
  exit 0
fi
if [[ "$args" == *"api.osv.dev"* ]]; then
  printf '{"vulns":[{"id":"OSV-1"}]}'
  exit 0
fi
if [[ "$args" == *"services.nvd.nist.gov"* ]]; then
  printf '{"totalResults":1}'
  exit 0
fi
exit 0
EOF

  cat > "$root/bin/npx" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = "vite" ] && [ "$2" = "build" ]; then
  printf "vite v4.0.0 built in 0.35s\n"
  exit 0
fi
exit 1
EOF

  chmod +x "$root/bin/curl" "$root/bin/npx"
}

prepare_test_script() {
  local root="$1"
  local dest="$root/test.sh"
  perl -pe \
    's|^PROJECT=.*|PROJECT="'"$root"'"|;
     s|^BACKEND=.*|BACKEND="'"$root"'/backend"'"|;
     s|^FRONTEND=.*|FRONTEND="'"$root"'/frontend"'"|
     s|^TESTS=.*|TESTS="'"$root"'/tests"'"|;' \
    "$SCRIPT_UNDER_TEST" > "$dest"
  chmod +x "$dest"
  echo "$dest"
}

run_script_capture() {
  local script="$1"
  local output
  local code
  set +e
  output="$(PATH="$tmp_project/bin:$PATH" bash "$script" 2>&1)"
  code=$?
  set -e
  echo "$code"
  printf '%s\n' "$output"
}

test_syntax() {
  if bash -n "$SCRIPT_UNDER_TEST"; then
    pass "syntax check"
  else
    fail "syntax check"
  fi
}

test_end_to_end() {
  tmp_project="$(mktemp -d)"
  trap 'rm -rf "$tmp_project"' RETURN
  create_fixture "$tmp_project"
  local test_script
  test_script="$(prepare_test_script "$tmp_project")"

  local code output
  code=$(run_script_capture "$test_script")
  output="$(run_script_capture "$test_script" | tail -n +2)"
  if [ "$code" -ne 0 ]; then
    fail "script execution returned non-zero status"
    return
  fi

  if grep -qF 'backend/app.py exists' <<< "$output"; then pass "project structure check"; else fail "project structure check"; fi
  if grep -qF 'Virtual environment exists' <<< "$output"; then pass "backend environment detection"; else fail "backend environment detection"; fi
  if grep -qF 'Server running' <<< "$output"; then pass "backend server health check"; else fail "backend server health check"; fi
  if grep -qF 'Build successful' <<< "$output"; then pass "frontend build check"; else fail "frontend build check"; fi
  if grep -qF 'NVD_API_KEY configured' <<< "$output"; then pass ".env loading and NVD key detection"; else fail ".env loading and NVD key detection"; fi
  if grep -qF 'Your app is healthy' <<< "$output"; then pass "summary healthy status"; else fail "summary healthy status"; fi
}

test_missing_file() {
  tmp_project="$(mktemp -d)"
  trap 'rm -rf "$tmp_project"' RETURN
  create_fixture "$tmp_project"
  rm -f "$tmp_project/frontend/src/App.jsx"
  local test_script
  test_script="$(prepare_test_script "$tmp_project")"

  local code output
  set +e
  output="$(PATH="$tmp_project/bin:$PATH" bash "$test_script" 2>&1)"
  code=$?
  set -e

  if grep -qF 'frontend/src/App.jsx MISSING' <<< "$output"; then
    pass "missing file reported"
  else
    fail "missing file reported"
  fi

  if grep -qF 'Issues found — check failures above' <<< "$output"; then
    pass "summary reports issues for missing file"
  else
    fail "summary reports issues for missing file"
  fi
}

test_syntax
test_end_to_end
test_missing_file

echo ""
echo "RESULT: $PASS passed, $FAIL failed"

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi