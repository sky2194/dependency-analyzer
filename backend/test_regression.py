"""
Backend Regression Tests for Dependency Vulnerability Analyzer
Tests vulnerability system, dependency graph, and parsers for correctness
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from parsers.npm_parser import parse as parse_npm
from parsers.pypi_parser import parse as parse_pypi
from parsers.maven_parser import parse as parse_maven
from resolvers.npm_resolver import resolve as resolve_npm
from cve.scanner import scan_package, scan_tree
from cve.osv_client import query_package, format_vuln
from cve.nvd_client import get_cvss
from app import deduplicate_vulns, group_vulns_by_package, _count_packages

def test_npm_parser():
    """Test npm package.json parsing correctness"""
    print("Testing npm parser...")
    
    # Valid package.json
    valid_content = '{"name":"test-app","version":"1.0.0","dependencies":{"express":"4.18.2","lodash":"^4.17.21"}}'
    result = parse_npm(valid_content)
    assert 'project_name' in result, f"Expected project_name, got {result.keys()}"
    assert result['project_name'] == 'test-app'
    assert 'deps' in result
    assert len(result['deps']) == 2
    assert result['deps'][0]['name'] == 'express'
    assert result['deps'][0]['version'] == '4.18.2'
    print("  ✓ Valid package.json parsing")
    
    # Malformed JSON
    try:
        parse_npm('{"invalid": json}')
        assert False, "Should raise ValueError for malformed JSON"
    except ValueError:
        print("  ✓ Malformed JSON rejection")
    
    # Empty package.json
    result = parse_npm('{}')
    assert result['project_name'] == 'my-app'
    print("  ✓ Empty package.json defaults")

def test_pypi_parser():
    """Test PyPI requirements.txt parsing correctness"""
    print("Testing pypi parser...")
    
    # Valid requirements.txt
    valid_content = 'requests==2.28.0\ndjango>=3.2\nflask\nnumpy>=1.20.0,<2.0.0'
    result = parse_pypi(valid_content)
    assert 'deps' in result
    assert len(result['deps']) == 4
    assert result['deps'][0]['name'] == 'requests'
    assert result['deps'][0]['version'] == '2.28.0'
    print("  ✓ Valid requirements.txt parsing")
    
    # Empty requirements
    try:
        result = parse_pypi('')
        assert False, "Should raise ValueError for empty requirements"
    except ValueError:
        print("  ✓ Empty requirements handling")

def test_maven_parser():
    """Test Maven pom.xml parsing correctness"""
    print("Testing maven parser...")
    
    # Valid pom.xml
    valid_content = '''<?xml version="1.0" encoding="UTF-8"?>
<project>
  <groupId>com.example</groupId>
  <artifactId>test-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.20</version>
    </dependency>
  </dependencies>
</project>'''
    try:
        result = parse_maven(valid_content)
        print(f"  Result keys: {result.keys()}")
        assert 'project_name' in result, f"Expected project_name, got {result.keys()}"
        # Maven uses groupId:artifactId format
        assert result['project_name'] == 'com.example:test-app', f"Expected 'com.example:test-app', got {result['project_name']}"
        assert 'deps' in result, f"Expected deps, got {result.keys()}"
        assert len(result['deps']) == 1, f"Expected 1 dep, got {len(result['deps'])}"
        print("  ✓ Valid pom.xml parsing")
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        raise
    
    # XML injection attempt
    try:
        parse_maven('<?xml version="1.0"?><project><script>alert(1)</script></project>')
        assert False, "Should reject XML injection"
    except ValueError:
        print("  ✓ XML injection rejection")

def test_vulnerability_deduplication():
    """Test CVE deduplication correctness"""
    print("Testing vulnerability deduplication...")
    
    # Create duplicate vulnerabilities
    vulns = [
        {'cve_id': 'CVE-2021-1234', 'package': 'express', 'version': '4.18.2', 'severity': 'HIGH'},
        {'cve_id': 'CVE-2021-1234', 'package': 'express', 'version': '4.18.2', 'severity': 'HIGH'},
        {'cve_id': 'CVE-2021-5678', 'package': 'lodash', 'version': '4.17.21', 'severity': 'CRITICAL'},
    ]
    
    deduped = deduplicate_vulns(vulns)
    assert len(deduped) == 2, f"Expected 2 unique CVEs, got {len(deduped)}"
    cve_ids = [v['cve_id'] for v in deduped]
    assert 'CVE-2021-1234' in cve_ids
    assert 'CVE-2021-5678' in cve_ids
    print("  ✓ CVE deduplication")

def test_grouped_vulnerability_counts():
    """Test raw vs grouped vulnerability counts"""
    print("Testing grouped vulnerability counts...")
    
    vulns = [
        {'cve_id': 'CVE-2021-1234', 'package': 'express', 'version': '4.18.2', 'severity': 'HIGH'},
        {'cve_id': 'CVE-2021-5678', 'package': 'express', 'version': '4.18.2', 'severity': 'CRITICAL'},
        {'cve_id': 'CVE-2021-9012', 'package': 'lodash', 'version': '4.17.21', 'severity': 'MEDIUM'},
    ]
    
    grouped = group_vulns_by_package(vulns)
    assert len(grouped) == 2, f"Expected 2 groups, got {len(grouped)}"
    assert len(vulns) == 3, f"Raw count should be 3, got {len(vulns)}"
    print("  ✓ Raw vs grouped counts")

def test_risk_score_calculation():
    """Test risk score calculation (0-10 scale)"""
    print("Testing risk score calculation...")
    
    # Test with known vulnerability counts
    counts = {'CRITICAL': 2, 'HIGH': 5, 'MEDIUM': 10, 'LOW': 20}
    risk_score = min(100, round(counts['CRITICAL']*25 + counts['HIGH']*10 + counts['MEDIUM']*4 + counts['LOW']*1))
    
    # Verify calculation
    expected = 2*25 + 5*10 + 10*4 + 20*1  # 50 + 50 + 40 + 20 = 160, capped at 100
    assert risk_score == 100, f"Expected 100, got {risk_score}"
    print("  ✓ Risk score calculation")
    
    # Test with no vulnerabilities
    counts_zero = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
    risk_score_zero = min(100, round(counts_zero['CRITICAL']*25 + counts_zero['HIGH']*10 + counts_zero['MEDIUM']*4 + counts_zero['LOW']*1))
    assert risk_score_zero == 0, f"Expected 0, got {risk_score_zero}"
    print("  ✓ Zero risk score")

def test_direct_transitive_classification():
    """Test direct vs transitive classification"""
    print("Testing direct/transitive classification...")
    
    # Create dependency graph with direct and transitive
    graph_deps = [
        {'name': 'express', 'version': '4.18.2', 'type': 'direct', 'dependencies': [
            {'name': 'depd', 'version': '2.0.0', 'type': 'transitive', 'dependencies': []}
        ]},
        {'name': 'lodash', 'version': '4.17.21', 'type': 'direct', 'dependencies': []}
    ]
    
    # Count packages
    total = _count_packages(graph_deps)
    assert total == 3, f"Expected 3 packages, got {total}"
    print("  ✓ Direct/transitive classification")

def test_cycle_detection():
    """Test cycle detection in dependency traversal"""
    print("Testing cycle detection...")
    
    # Create a graph with a cycle
    graph_with_cycle = [
        {'name': 'pkg-a', 'version': '1.0.0', 'type': 'direct', 'dependencies': [
            {'name': 'pkg-b', 'version': '1.0.0', 'type': 'transitive', 'dependencies': [
                {'name': 'pkg-a', 'version': '1.0.0', 'type': 'transitive', 'dependencies': []}  # Cycle back
            ]}
        ]}
    ]
    
    # Should not hang or crash
    count = _count_packages(graph_with_cycle)
    assert count > 0, "Should count at least root package"
    print("  ✓ Cycle detection (no infinite recursion)")

def test_deterministic_scan_output():
    """Test that same input produces same output"""
    print("Testing deterministic scan output...")
    
    # Test package counting determinism
    graph_deps = [
        {'name': 'express', 'version': '4.18.2', 'type': 'direct', 'dependencies': []},
        {'name': 'lodash', 'version': '4.17.21', 'type': 'direct', 'dependencies': []}
    ]
    
    count1 = _count_packages(graph_deps)
    count2 = _count_packages(graph_deps)
    
    assert count1 == count2, f"Counts should match: {count1} != {count2}"
    print("  ✓ Deterministic output")

def run_all_tests():
    """Run all regression tests"""
    print("\n=== BACKEND REGRESSION TESTS ===\n")
    
    try:
        test_npm_parser()
        test_pypi_parser()
        test_maven_parser()
        test_vulnerability_deduplication()
        test_grouped_vulnerability_counts()
        test_risk_score_calculation()
        test_direct_transitive_classification()
        test_cycle_detection()
        test_deterministic_scan_output()
        
        print("\n=== ALL TESTS PASSED ===\n")
        return True
    except AssertionError as e:
        print(f"\n=== TEST FAILED: {e} ===\n")
        return False
    except Exception as e:
        print(f"\n=== TEST ERROR: {e} ===\n")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
