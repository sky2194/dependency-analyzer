"""
CVE client tests — tests OSV and NVD integrations.
Run: pytest tests/backend/test_cve.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest
from cve.osv_client import query_package, format_vuln

def test_osv_query_returns_list():
    result = query_package('lodash', '4.17.11', 'npm')
    assert isinstance(result, list)

def test_osv_known_vulnerable_package():
    """lodash 4.17.11 has known CVEs — OSV should return results."""
    result = query_package('lodash', '4.17.11', 'npm')
    assert len(result) > 0, "Expected CVEs for lodash@4.17.11 but got none"

def test_osv_clean_package_returns_list():
    """A non-existent package should return empty list, not crash."""
    result = query_package('totally-fake-package-xyz-123', '1.0.0', 'npm')
    assert isinstance(result, list)

def test_osv_format_vuln_has_required_fields():
    vulns = query_package('lodash', '4.17.11', 'npm')
    if vulns:
        formatted = format_vuln(vulns[0], 'lodash', '4.17.11')
        for field in ['cve_id', 'package', 'version', 'severity', 'cvss_score', 'description', 'fix']:
            assert field in formatted, f"Missing field: {field}"

def test_osv_severity_is_valid():
    vulns = query_package('lodash', '4.17.11', 'npm')
    if vulns:
        formatted = format_vuln(vulns[0], 'lodash', '4.17.11')
        assert formatted['severity'] in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')

def test_osv_pypi_ecosystem():
    result = query_package('Django', '3.0.0', 'pypi')
    assert isinstance(result, list)

def test_osv_maven_ecosystem():
    result = query_package('log4j:log4j', '1.2.17', 'maven')
    assert isinstance(result, list)
