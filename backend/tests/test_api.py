"""
test_api.py — Flask API endpoint tests using real packages and live scanning.

No scan_tree, no RESOLVERS, no OSV calls are mocked.
Real packages with documented CVEs are used:
  npm  : minimist@1.2.5  (CVE-2021-44906)
  PyPI : urllib3@1.26.4  (CVE-2021-33503)
  Maven: log4j:log4j@1.2.17 (CVE-2019-17571)
  lockfile: package-lock.json with minimist@1.2.5

Input validation and rate-limiting tests do not scan real packages so they
remain fast.  The rate-limit ceiling (RATE_LIMIT) is patched only for the
rate-limiting test — no CVE data is involved.
"""
import json
import sys
import os
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ── payload builders ──────────────────────────────────────────────────────────

def _npm(pkg, ver, project='test-project'):
    return {
        "content": json.dumps({
            "name": project, "version": "1.0.0",
            "dependencies": {pkg: ver},
        }),
        "filename": "package.json",
        "project_name": project,
    }

def _pypi(content, project='test-project'):
    return {"content": content, "filename": "requirements.txt",
            "project_name": project}

def _maven(pom_xml, project='test-project'):
    return {"content": pom_xml, "filename": "pom.xml",
            "project_name": project}

def _gradle(build_gradle, project='test-project'):
    return {"content": build_gradle, "filename": "build.gradle",
            "project_name": project}

def _lockfile(lf_json, project='test-project'):
    return {"content": lf_json, "filename": "package-lock.json",
            "project_name": project}

def _scan(client, payload):
    return client.post('/api/scan',
                       data=json.dumps(payload),
                       content_type='application/json')


# ── npm scans ─────────────────────────────────────────────────────────────────

class TestScanNpm:
    def test_minimist_returns_200(self, client):
        """POST /api/scan with minimist@1.2.5 returns HTTP 200."""
        resp = _scan(client, _npm('minimist', '1.2.5'))
        assert resp.status_code == 200, resp.data

    def test_minimist_finds_cve_2021_44906(self, client):
        """Full npm scan with minimist@1.2.5 must return CVE-2021-44906."""
        resp = _scan(client, _npm('minimist', '1.2.5'))
        body = resp.get_json()
        cve_ids = [v['cve_id'] for v in body.get('vulnerabilities', [])]
        assert 'CVE-2021-44906' in cve_ids, (
            f"CVE-2021-44906 missing from npm scan.\nFound: {cve_ids}"
        )

    def test_npm_response_structure(self, client):
        """npm scan response must include project_name, ecosystem, summary, graph."""
        resp = _scan(client, _npm('minimist', '1.2.5'))
        body = resp.get_json()
        for key in ('project_name', 'ecosystem', 'summary', 'vulnerabilities', 'graph'):
            assert key in body, f"Missing key '{key}' in response"

    def test_npm_ecosystem_field(self, client):
        """ecosystem field must be 'npm' for package.json input."""
        resp = _scan(client, _npm('minimist', '1.2.5'))
        assert resp.get_json()['ecosystem'] == 'npm'

    def test_npm_risk_score_nonzero_for_vulnerable_package(self, client):
        """risk_score must be > 0 when a vulnerable package is scanned."""
        resp = _scan(client, _npm('minimist', '1.2.5'))
        assert resp.get_json()['summary']['risk_score'] > 0

    def test_npm_fix_version_provided(self, client):
        """fix_version must be set for CVE-2021-44906 in the scan result."""
        from packaging.version import Version
        resp = _scan(client, _npm('minimist', '1.2.5'))
        body = resp.get_json()
        hit = next((v for v in body['vulnerabilities']
                    if v['cve_id'] == 'CVE-2021-44906'), None)
        assert hit is not None
        assert hit['fix_version'] is not None
        assert Version(hit['fix_version']) >= Version('1.2.6')


# ── PyPI scans ────────────────────────────────────────────────────────────────

class TestScanPypi:
    def test_urllib3_returns_200(self, client):
        """POST /api/scan with urllib3==1.26.4 returns HTTP 200."""
        resp = _scan(client, _pypi("urllib3==1.26.4\n"))
        assert resp.status_code == 200, resp.data

    def test_urllib3_finds_cve_2021_33503(self, client):
        """Full PyPI scan with urllib3@1.26.4 must return CVE-2021-33503."""
        resp = _scan(client, _pypi("urllib3==1.26.4\n"))
        body = resp.get_json()
        cve_ids = [v['cve_id'] for v in body.get('vulnerabilities', [])]
        assert 'CVE-2021-33503' in cve_ids, (
            f"CVE-2021-33503 missing.\nFound: {cve_ids}"
        )

    def test_pypi_ecosystem_field(self, client):
        """ecosystem field must be 'pypi' for requirements.txt input."""
        resp = _scan(client, _pypi("urllib3==1.26.4\n"))
        assert resp.get_json()['ecosystem'] == 'pypi'


# ── Maven scans ───────────────────────────────────────────────────────────────

class TestScanMaven:
    LOG4J_POM = """<?xml version="1.0"?>
<project>
  <groupId>com.example</groupId>
  <artifactId>test-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>log4j</groupId>
      <artifactId>log4j</artifactId>
      <version>1.2.17</version>
    </dependency>
  </dependencies>
</project>"""

    def test_log4j_returns_200(self, client):
        """POST /api/scan with log4j@1.2.17 returns HTTP 200."""
        resp = _scan(client, _maven(self.LOG4J_POM))
        assert resp.status_code == 200, resp.data

    def test_log4j_finds_cve_2019_17571(self, client):
        """Full Maven scan with log4j@1.2.17 must return CVE-2019-17571."""
        resp = _scan(client, _maven(self.LOG4J_POM))
        body = resp.get_json()
        cve_ids = [v['cve_id'] for v in body.get('vulnerabilities', [])]
        assert 'CVE-2019-17571' in cve_ids, (
            f"CVE-2019-17571 missing from Maven scan.\nFound: {cve_ids}"
        )

    def test_maven_ecosystem_field(self, client):
        """ecosystem field must be 'maven' for pom.xml input."""
        resp = _scan(client, _maven(self.LOG4J_POM))
        assert resp.get_json()['ecosystem'] == 'maven'


# ── Gradle scans ──────────────────────────────────────────────────────────────

class TestScanGradle:
    LOG4J_GRADLE = """plugins { id 'java' }
dependencies {
  implementation 'log4j:log4j:1.2.17'
}"""

    def test_log4j_returns_200(self, client):
        """POST /api/scan with Gradle log4j@1.2.17 returns HTTP 200."""
        resp = _scan(client, _gradle(self.LOG4J_GRADLE))
        assert resp.status_code == 200, resp.data

    def test_gradle_ecosystem_field(self, client):
        """ecosystem field must be 'gradle' for build.gradle input."""
        resp = _scan(client, _gradle(self.LOG4J_GRADLE))
        assert resp.get_json()['ecosystem'] == 'gradle'

    def test_log4j_finds_maven_cve(self, client):
        """Gradle scan uses Maven coordinates for OSV lookup."""
        resp = _scan(client, _gradle(self.LOG4J_GRADLE))
        body = resp.get_json()
        cve_ids = [v['cve_id'] for v in body.get('vulnerabilities', [])]
        assert 'CVE-2019-17571' in cve_ids, (
            f"CVE-2019-17571 missing from Gradle scan.\nFound: {cve_ids}"
        )


# ── Lockfile scans ────────────────────────────────────────────────────────────

class TestScanLockfile:
    LOCKFILE = json.dumps({
        "name": "test-app",
        "version": "1.0.0",
        "lockfileVersion": 2,
        "packages": {
            "": {"dependencies": {"minimist": "1.2.5"}},
            "node_modules/minimist": {"version": "1.2.5"},
        }
    })

    def test_lockfile_returns_200(self, client):
        """POST /api/scan with a package-lock.json returns HTTP 200."""
        resp = _scan(client, _lockfile(self.LOCKFILE))
        assert resp.status_code == 200, resp.data

    def test_lockfile_finds_cve_2021_44906(self, client):
        """Lockfile scan with minimist@1.2.5 must find CVE-2021-44906."""
        resp = _scan(client, _lockfile(self.LOCKFILE))
        body = resp.get_json()
        cve_ids = [v['cve_id'] for v in body.get('vulnerabilities', [])]
        assert 'CVE-2021-44906' in cve_ids, (
            f"CVE-2021-44906 missing from lockfile scan.\nFound: {cve_ids}"
        )


# ── Input validation (no real scan needed) ────────────────────────────────────

class TestInputValidation:
    def test_missing_content_returns_400(self, client):
        """Request without 'content' field returns HTTP 400."""
        resp = _scan(client, {"filename": "package.json"})
        assert resp.status_code == 400

    def test_unsupported_filename_returns_400(self, client):
        """An unrecognised filename (e.g. Gemfile) returns HTTP 400."""
        resp = _scan(client, {"content": "gem 'rails'", "filename": "Gemfile"})
        assert resp.status_code == 400

    def test_content_too_large_returns_413(self, client):
        """Content exceeding Flask's max_content_length is rejected with HTTP 413."""
        resp = _scan(client, {"content": "x" * (512 * 1024 + 1),
                              "filename": "package.json"})
        assert resp.status_code == 413

    def test_malformed_npm_json_returns_400(self, client):
        """Invalid JSON for package.json returns HTTP 400."""
        resp = _scan(client, {"content": "not valid json {{{",
                              "filename": "package.json"})
        assert resp.status_code == 400


# ── Rate limiting ─────────────────────────────────────────────────────────────

class TestRateLimiting:
    def test_exceeding_rate_limit_returns_429(self, client):
        """After exceeding the rate limit ceiling the endpoint returns HTTP 429.
        RATE_LIMIT is patched to 3 requests so we do not need to send 20 real scans."""
        payload = {
            "content": "not json",
            "filename": "package.json",
        }
        with patch('app.RATE_LIMIT', 3):
            resps = [
                client.post('/api/scan', data=json.dumps(payload),
                            content_type='application/json')
                for _ in range(4)
            ]
        assert 429 in [r.status_code for r in resps]
