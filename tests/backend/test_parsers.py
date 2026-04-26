"""
Tests for all three dependency file parsers.
Run: pytest tests/backend/test_parsers.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest
from parsers.npm_parser import parse as parse_npm
from parsers.pypi_parser import parse as parse_pypi
from parsers.maven_parser import parse as parse_maven

# ── npm ──────────────────────────────────────────────────────────────────────

NPM_BASIC = '''{
  "name": "my-test-app",
  "version": "2.0.0",
  "dependencies": {
    "express": "^4.17.1",
    "lodash": "4.17.21"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}'''

def test_npm_extracts_project_name():
    result = parse_npm(NPM_BASIC)
    assert result['project_name'] == 'my-test-app'

def test_npm_extracts_project_version():
    result = parse_npm(NPM_BASIC)
    assert result['project_version'] == '2.0.0'

def test_npm_strips_caret_keeps_version():
    result = parse_npm(NPM_BASIC)
    deps = {d['name']: d for d in result['deps']}
    # ^4.17.1 should become 4.17.1, NOT fetch latest
    assert deps['express']['version'] == '4.17.1'

def test_npm_pinned_version_unchanged():
    result = parse_npm(NPM_BASIC)
    deps = {d['name']: d for d in result['deps']}
    assert deps['lodash']['version'] == '4.17.21'
    assert deps['lodash']['pinned'] == True

def test_npm_includes_dev_dependencies():
    result = parse_npm(NPM_BASIC)
    names = [d['name'] for d in result['deps']]
    assert 'jest' in names

def test_npm_invalid_json_raises():
    with pytest.raises(ValueError, match="Invalid package.json"):
        parse_npm("not valid json {{{")

def test_npm_empty_dependencies():
    result = parse_npm('{"name": "empty-app", "version": "1.0.0"}')
    assert result['deps'] == []
    assert result['project_name'] == 'empty-app'

# ── pypi ─────────────────────────────────────────────────────────────────────

PYPI_BASIC = """
# This is a comment
Django==3.2.0
requests>=2.28.0
numpy==1.23.4
"""

def test_pypi_parses_pinned_versions():
    result = parse_pypi(PYPI_BASIC)
    deps = {d['name']: d for d in result['deps']}
    assert deps['Django']['version'] == '3.2.0'
    assert deps['Django']['pinned'] == True

def test_pypi_ignores_comments():
    result = parse_pypi(PYPI_BASIC)
    names = [d['name'] for d in result['deps']]
    assert 'This is a comment' not in names

def test_pypi_parses_gte_operator():
    result = parse_pypi(PYPI_BASIC)
    deps = {d['name']: d for d in result['deps']}
    assert deps['requests']['version'] == '2.28.0'

def test_pypi_empty_content():
    result = parse_pypi("# just comments\n\n")
    assert result['deps'] == []

# ── maven ─────────────────────────────────────────────────────────────────────

MAVEN_BASIC = """<project>
  <groupId>com.example</groupId>
  <artifactId>my-java-app</artifactId>
  <version>1.5.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.0</version>
    </dependency>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>"""

def test_maven_extracts_project_name():
    result = parse_maven(MAVEN_BASIC)
    assert result['project_name'] == 'com.example:my-java-app'

def test_maven_extracts_version():
    result = parse_maven(MAVEN_BASIC)
    assert result['project_version'] == '1.5.0'

def test_maven_parses_dependency_version():
    result = parse_maven(MAVEN_BASIC)
    deps = {d['name']: d for d in result['deps']}
    assert deps['org.springframework:spring-core']['version'] == '5.3.0'

def test_maven_excludes_test_scope():
    result = parse_maven(MAVEN_BASIC)
    names = [d['name'] for d in result['deps']]
    assert 'junit:junit' not in names

def test_maven_invalid_xml_raises():
    with pytest.raises(ValueError, match="Invalid pom.xml"):
        parse_maven("<not valid xml")
