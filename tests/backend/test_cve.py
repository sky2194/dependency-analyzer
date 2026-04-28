"""
CVE client tests — OSV + NVD integration.
Run: pytest tests/backend/test_cve.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest
from cve.osv_client import query_package, format_vuln, _is_affected, _get_fix_version, _parse_ver

# ── OSV query ─────────────────────────────────────────────────────────────────

def test_osv_returns_list():
    assert isinstance(query_package('lodash', '4.17.11', 'npm'), list)

def test_osv_known_vuln_found():
    result = query_package('lodash', '4.17.11', 'npm')
    assert len(result) > 0, "lodash@4.17.11 should have CVEs"

def test_osv_nonexistent_package_empty():
    result = query_package('totally-fake-xyz-999', '1.0.0', 'npm')
    assert result == []

def test_osv_pypi_ecosystem():
    result = query_package('Django', '3.0.0', 'pypi')
    assert isinstance(result, list)

def test_osv_maven_ecosystem():
    result = query_package('com.fasterxml.jackson.core:jackson-databind', '2.9.8', 'maven')
    assert isinstance(result, list)
    assert len(result) > 0

def test_osv_lockfile_maps_to_npm():
    result = query_package('lodash', '4.17.11', 'lockfile')
    assert isinstance(result, list)

# ── Version filtering ─────────────────────────────────────────────────────────

def test_version_filtering_removes_unaffected():
    """Safe version should return fewer CVEs than vulnerable version."""
    safe = [f for f in [format_vuln(v, 'lodash', '4.17.21') for v in query_package('lodash', '4.17.21', 'npm')] if f]
    vuln = [f for f in [format_vuln(v, 'lodash', '4.17.11') for v in query_package('lodash', '4.17.11', 'npm')] if f]
    assert len(safe) < len(vuln), f"Safe 4.17.21 has {len(safe)} CVEs, vulnerable 4.17.11 has {len(vuln)}"

def test_version_filtering_keeps_affected():
    vulns = query_package('lodash', '4.17.11', 'npm')
    affected = [f for f in [format_vuln(v, 'lodash', '4.17.11') for v in vulns] if f]
    assert len(affected) > 0

def test_django_version_specific_filtering():
    all_vulns = query_package('Django', '3.0.0', 'pypi')
    affected = [f for f in [format_vuln(v, 'Django', '3.0.0') for v in all_vulns] if f]
    assert len(affected) <= len(all_vulns)
    assert len(affected) > 0

# ── Fix version accuracy ───────────────────────────────────────────────────────

def test_fix_version_correct_branch():
    vulns = query_package('lodash', '4.17.11', 'npm')
    for v in vulns:
        f = format_vuln(v, 'lodash', '4.17.11')
        if f and f.get('fix_version'):
            assert _parse_ver(f['fix_version']) > _parse_ver('4.17.11')

def test_django_fix_version_not_older():
    vulns = query_package('Django', '3.0.0', 'pypi')
    for v in vulns:
        f = format_vuln(v, 'Django', '3.0.0')
        if f and f.get('fix_version'):
            assert _parse_ver(f['fix_version']) > _parse_ver('3.0.0'), \
                f"Fix {f['fix_version']} is not newer than 3.0.0"

def test_format_none_for_safe_version():
    safe_count = sum(1 for v in query_package('lodash', '4.17.21', 'npm') if format_vuln(v, 'lodash', '4.17.21'))
    vuln_count = sum(1 for v in query_package('lodash', '4.17.4', 'npm') if format_vuln(v, 'lodash', '4.17.4'))
    assert safe_count < vuln_count, f"Safe 4.17.21 has {safe_count}, vulnerable 4.17.4 has {vuln_count}"

# ── CVSS scores ───────────────────────────────────────────────────────────────

def test_cvss_score_not_zero_for_known_cve():
    vulns = query_package('lodash', '4.17.11', 'npm')
    affected = [f for f in [format_vuln(v, 'lodash', '4.17.11') for v in vulns] if f]
    non_zero = [f for f in affected if f['cvss_score'] > 0]
    assert len(non_zero) > 0

def test_severity_is_valid():
    vulns = query_package('lodash', '4.17.11', 'npm')
    for v in vulns:
        f = format_vuln(v, 'lodash', '4.17.11')
        if f:
            assert f['severity'] in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')

# ── Format output ─────────────────────────────────────────────────────────────

def test_format_has_required_fields():
    vulns = query_package('lodash', '4.17.11', 'npm')
    for v in vulns:
        f = format_vuln(v, 'lodash', '4.17.11')
        if f:
            for field in ['cve_id','package','version','severity','cvss_score','description','fix','fix_version','nvd_url','osv_url']:
                assert field in f, f"Missing: {field}"
            break

# ── Maven version parsing ──────────────────────────────────────────────────────

def test_parse_maven_release_version():
    assert _parse_ver('2.3.0.RELEASE') is not None

def test_parse_standard_semver():
    v = _parse_ver('4.17.11')
    assert v is not None
    assert str(v) == '4.17.11'

# ── NVD enrichment ────────────────────────────────────────────────────────────

def test_nvd_enrichment_improves_cvss():
    from cve.nvd_client import get_cvss
    score, sev = get_cvss('CVE-2021-44228')
    if score is not None:
        assert score > 0
        assert sev in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
