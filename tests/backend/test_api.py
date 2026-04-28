"""
API endpoint tests — requires Flask server on port 5000.
Run: pytest tests/backend/test_api.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest, requests, json

import time
BASE = 'http://localhost:5000'

@pytest.fixture(autouse=True)
def rate_limit_delay():
    time.sleep(2)  # prevent rate limiting between tests

def server_running():
    try:
        requests.get(f"{BASE}/api/health", timeout=3)
        return True
    except Exception:
        return False

skip = pytest.mark.skipif(not server_running(), reason="Backend not running on port 5000")

HEADERS = {'X-Test-Bypass': 'true'}
NPM = {"content": '{"name":"test-app","version":"1.0.0","dependencies":{"lodash":"4.17.11"}}', "filename": "package.json"}
PYPI = {"content": "Django==3.0.0\nrequests==2.25.0", "filename": "requirements.txt"}
MAVEN = {"content": """<project><groupId>com.example</groupId><artifactId>test</artifactId><version>1.0.0</version>
    <dependencies><dependency><groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId><version>2.9.8</version></dependency></dependencies></project>""",
    "filename": "pom.xml"}

# ── Health ────────────────────────────────────────────────────────────────────

@skip
def test_health_ok():
    res = requests.get(f"{BASE}/api/health", timeout=5)
    assert res.status_code == 200
    assert res.json()['status'] == 'ok'

@skip
def test_health_shows_config():
    data = requests.get(f"{BASE}/api/health").json()
    assert 'rate_limit' in data
    assert 'max_file_size' in data
    assert 'nvd_api_key_configured' in data

# ── Analyze — structure ───────────────────────────────────────────────────────

@skip
def test_npm_analyze_200():
    assert requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).status_code == 200

@skip
def test_npm_required_fields():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    for f in ['ecosystem','project_name','total_packages','graph','vulnerabilities','mediation','grouped_vulnerabilities','scan_timestamp']:
        assert f in data, f"Missing: {f}"

@skip
def test_npm_correct_project_name():
    assert requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()['project_name'] == 'test-app'

@skip
def test_npm_correct_ecosystem():
    assert requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()['ecosystem'] == 'npm'

@skip
def test_npm_graph_root_name():
    graph = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()['graph']
    assert graph['name'] == 'test-app'
    assert graph['type'] == 'root'

@skip
def test_pypi_analyze_200():
    assert requests.post(f"{BASE}/api/analyze", json=PYPI, timeout=60).status_code == 200

@skip
def test_pypi_ecosystem():
    assert requests.post(f"{BASE}/api/analyze", json=PYPI, timeout=60).json()['ecosystem'] == 'pypi'

@skip
def test_maven_analyze_200():
    assert requests.post(f"{BASE}/api/analyze", json=MAVEN, timeout=60).status_code == 200

@skip
def test_maven_ecosystem():
    assert requests.post(f"{BASE}/api/analyze", json=MAVEN, timeout=60).json()['ecosystem'] == 'maven'

# ── Analyze — vulnerability quality ──────────────────────────────────────────

@skip
def test_vulns_are_list():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    assert isinstance(data['vulnerabilities'], list)

@skip
def test_vulns_sorted_by_severity():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    vulns = data.get('vulnerabilities', [])
    if len(vulns) < 2: return
    order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
    for i in range(len(vulns) - 1):
        a = order.get(vulns[i].get('severity','LOW'), 3)
        b = order.get(vulns[i+1].get('severity','LOW'), 3)
        assert a <= b, f"Severity order wrong: {vulns[i].get('severity')} before {vulns[i+1].get('severity')}"

@skip
def test_vulns_have_fix_version_or_none():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    for v in data.get('vulnerabilities', []):
        assert 'fix_version' in v, f"Missing fix_version in {v.get('cve_id')}"

@skip
def test_vulns_cvss_not_all_zero():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    vulns = data.get('vulnerabilities', [])
    if not vulns: return
    non_zero = [v for v in vulns if v.get('cvss_score', 0) > 0]
    assert len(non_zero) > 0, f"All {len(vulns)} CVEs have CVSS=0. NVD enrichment may be failing."

@skip
def test_no_duplicate_cves():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    vulns = data.get('vulnerabilities', [])
    keys = [f"{v.get('cve_id')}:{v.get('package')}:{v.get('version')}" for v in vulns]
    dupes = set(k for k in keys if keys.count(k) > 1)
    assert len(dupes) == 0, f"Duplicate CVEs: {dupes}"

# ── Grouped vulnerabilities ───────────────────────────────────────────────────

@skip
def test_grouped_vulns_present():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    assert 'grouped_vulnerabilities' in data, f"Missing grouped_vulnerabilities. Keys: {list(data.keys())}"
    assert isinstance(data['grouped_vulnerabilities'], list)

@skip
def test_grouped_has_recommended_fix():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    groups = data.get('grouped_vulnerabilities', [])
    for g in groups:
        for field in ['package','highest_severity','cves','recommended_fix']:
            assert field in g, f"Missing '{field}' in group: {list(g.keys())}"

@skip
def test_grouped_sorted_by_severity():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    groups = data.get('grouped_vulnerabilities', [])
    if len(groups) < 2: return
    order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
    for i in range(len(groups) - 1):
        a = order.get(groups[i].get('highest_severity','LOW'), 3)
        b = order.get(groups[i+1].get('highest_severity','LOW'), 3)
        assert a <= b

# ── Validation & security ─────────────────────────────────────────────────────

@skip
def test_empty_content_400():
    time.sleep(1)
    assert requests.post(f"{BASE}/api/analyze", json={"content":"","filename":"package.json"}, timeout=5).status_code == 400

@skip
def test_invalid_json_400():
    assert requests.post(f"{BASE}/api/analyze", json={"content":"not json {{","filename":"package.json"}, timeout=5).status_code == 400

@skip
def test_oversized_content_413():
    time.sleep(1)
    big = '{"name":"t","dependencies":{' + ','.join([f'"p{i}":"1.0.0"' for i in range(5000)]) + '}}'
    assert requests.post(f"{BASE}/api/analyze", json={"content":big,"filename":"package.json"}, timeout=10).status_code == 413

@skip
def test_invalid_cve_id_400():
    assert requests.get(f"{BASE}/api/cve/NOT-A-CVE", timeout=5).status_code == 400

@skip
def test_has_scan_timestamp():
    data = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    assert 'scan_timestamp' in data, f"Missing scan_timestamp. Keys: {list(data.keys())}"
    assert isinstance(data['scan_timestamp'], int)
    assert data['scan_timestamp'] > 1000000000

# ── Export endpoints ──────────────────────────────────────────────────────────

@skip
def test_export_csv_200():
    time.sleep(2)
    scan = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    res = requests.post(f"{BASE}/api/export/csv", json=scan, timeout=10)
    assert res.status_code == 200
    assert 'text/csv' in res.headers.get('Content-Type', '')

@skip
def test_export_csv_has_headers():
    scan = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    res = requests.post(f"{BASE}/api/export/csv", json=scan, timeout=10)
    assert 'CVE ID' in res.text
    assert 'Severity' in res.text
    assert 'Fix' in res.text

@skip
def test_export_pdf_200():
    scan = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    res = requests.post(f"{BASE}/api/export/pdf", json=scan, timeout=10)
    assert res.status_code == 200
    assert 'text/html' in res.headers.get('Content-Type', '')

@skip
def test_export_pdf_has_content():
    scan = requests.post(f"{BASE}/api/analyze", json=NPM, timeout=60).json()
    res = requests.post(f"{BASE}/api/export/pdf", json=scan, timeout=10)
    assert 'Dependency Analyzer' in res.text
    assert 'Vulnerabilities' in res.text
