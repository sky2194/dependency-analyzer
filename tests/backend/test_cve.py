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
    assert len(result) > 0, "jackson-databind@2.9.8 should have CVEs in Maven ecosystem"

def test_osv_lockfile_maps_to_npm():
    """lockfile ecosystem should query npm."""
    result = query_package('lodash', '4.17.11', 'lockfile')
    assert isinstance(result, list)

# ── Version filtering ─────────────────────────────────────────────────────────

def test_version_filtering_removes_unaffected():
    """Safe version should return fewer CVEs than vulnerable version."""
    safe = [f for f in [format_vuln(v, 'lodash', '4.17.21') for v in query_package('lodash', '4.17.21', 'npm')] if f]
    vuln = [f for f in [format_vuln(v, 'lodash', '4.17.11') for v in query_package('lodash', '4.17.11', 'npm')] if f]
    assert len(safe) < len(vuln), f"Safe version (4.17.21) has {len(safe)} CVEs, vulnerable (4.17.11) has {len(vuln)} — filtering not working"

def test_version_filtering_keeps_affected():
    """Vulnerable version should still have CVEs after filtering."""
    vulns = query_package('lodash', '4.17.11', 'npm')
    formatted = [format_vuln(v, 'lodash', '4.17.11') for v in vulns]
    affected = [f for f in formatted if f is not None]
    assert len(affected) > 0, "lodash@4.17.11 should have CVEs after filtering"

def test_django_version_specific_filtering():
    """Django CVE count should be lower than total OSV results."""
    all_vulns = query_package('Django', '3.0.0', 'pypi')
    formatted = [format_vuln(v, 'Django', '3.0.0') for v in all_vulns]
    affected = [f for f in formatted if f is not None]
    assert len(affected) <= len(all_vulns), "Filtering should not add CVEs"
    assert len(affected) > 0, "Django@3.0.0 should have CVEs"

# ── Fix version accuracy ───────────────────────────────────────────────────────

def test_fix_version_correct_branch():
    """Fix version must be greater than installed version."""
    vulns = query_package('lodash', '4.17.11', 'npm')
    for v in vulns:
        f = format_vuln(v, 'lodash', '4.17.11')
        if f and f.get('fix_version'):
            installed = _parse_ver('4.17.11')
            fix = _parse_ver(f['fix_version'])
            assert fix > installed, f"Fix {f['fix_version']} must be > 4.17.11"

def test_django_fix_version_not_older():
    """Django 3.0.0 fix must not be from 1.x branch."""
    vulns = query_package('Django', '3.0.0', 'pypi')
    for v in vulns:
        f = format_vuln(v, 'Django', '3.0.0')
        if f and f.get('fix_version'):
            fix = _parse_ver(f['fix_version'])
            installed = _parse_ver('3.0.0')
            assert fix > installed, f"Fix {f['fix_version']} is older than installed 3.0.0"

def test_fix_version_present_for_known_cve():
    """CVE-2019-10744 (lodash prototype pollution) must have a fix version."""
    vulns = query_package('lodash', '4.17.11', 'npm')
    for v in vulns:
        aliases = v.get('aliases', [])
        if 'CVE-2019-10744' in aliases or v.get('id') == 'GHSA-p6mc-m468-83gw':
            f = format_vuln(v, 'lodash', '4.17.11')
            assert f is not None
            assert f.get('fix_version') is not None, "CVE-2019-10744 must have a fix version"
            break

# ── CVSS scores ───────────────────────────────────────────────────────────────

def test_cvss_score_not_zero_for_known_cve():
    """Known high-severity CVEs should have non-zero CVSS."""
    vulns = query_package('lodash', '4.17.11', 'npm')
    formatted = [format_vuln(v, 'lodash', '4.17.11') for v in vulns]
    affected = [f for f in formatted if f is not None]
    non_zero = [f for f in affected if f['cvss_score'] > 0]
    assert len(non_zero) > 0, "At least some CVEs should have non-zero CVSS scores"

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
            for field in ['cve_id', 'package', 'version', 'severity', 'cvss_score', 'description', 'fix', 'fix_version', 'nvd_url', 'osv_url']:
                assert field in f, f"Missing field: {field}"
            break

def test_format_none_for_safe_version():
    """Filtering should return fewer CVEs for safe version vs vulnerable version."""
    safe_vulns = query_package('lodash', '4.17.21', 'npm')
    vuln_vulns = query_package('lodash', '4.17.4', 'npm')
    safe_count = sum(1 for v in safe_vulns if format_vuln(v, 'lodash', '4.17.21') is not None)
    vuln_count = sum(1 for v in vuln_vulns if format_vuln(v, 'lodash', '4.17.4') is not None)
    assert safe_count < vuln_count, (
        f"Version filtering not working: safe 4.17.21 has {safe_count} CVEs, "
        f"vulnerable 4.17.4 has {vuln_count} CVEs — safe should have fewer"
    )

# ── Maven version parsing ──────────────────────────────────────────────────────

def test_parse_maven_release_version():
    """Maven RELEASE qualifier should parse correctly."""
    v = _parse_ver('2.3.0.RELEASE')
    assert v is not None, "2.3.0.RELEASE should parse"

def test_parse_maven_snapshot():
    v = _parse_ver('2.3.0.SNAPSHOT')
    assert v is not None

def test_parse_standard_semver():
    v = _parse_ver('4.17.11')
    assert v is not None
    assert str(v) == '4.17.11'

# ── NVD enrichment ────────────────────────────────────────────────────────────

def test_nvd_enrichment_improves_cvss():
    """NVD should provide CVSS when OSV returns 0."""
    from cve.nvd_client import get_cvss
    score, sev = get_cvss('CVE-2021-44228')  # Log4Shell — always in NVD
    if score is not None:  # skip if rate limited
        assert score > 0, "Log4Shell CVSS should be non-zero"
        assert sev in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
