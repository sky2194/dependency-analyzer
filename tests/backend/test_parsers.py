"""
Parser tests for all 3 ecosystems + lockfile.
Run: pytest tests/backend/test_parsers.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest
from parsers.npm_parser import parse as npm
from parsers.pypi_parser import parse as pypi
from parsers.maven_parser import parse as maven
from parsers.lockfile_parser import parse as lockfile

# ── npm ───────────────────────────────────────────────────────────────────────

NPM = '{"name":"my-app","version":"2.0.0","dependencies":{"express":"^4.17.1","lodash":"4.17.21"},"devDependencies":{"jest":"^29.0.0"}}'

def test_npm_project_name():
    assert npm(NPM)['project_name'] == 'my-app'

def test_npm_project_version():
    assert npm(NPM)['project_version'] == '2.0.0'

def test_npm_caret_stripped():
    deps = {d['name']:d for d in npm(NPM)['deps']}
    assert deps['express']['version'] == '4.17.1', "^ should be stripped, not fetch latest"

def test_npm_pinned_unchanged():
    deps = {d['name']:d for d in npm(NPM)['deps']}
    assert deps['lodash']['version'] == '4.17.21'
    assert deps['lodash']['pinned'] == True

def test_npm_dev_deps_included():
    names = [d['name'] for d in npm(NPM)['deps']]
    assert 'jest' in names

def test_npm_invalid_raises():
    with pytest.raises(ValueError):
        npm("not json {{{")

def test_npm_empty_deps():
    result = npm('{"name":"empty","version":"1.0.0"}')
    assert result['deps'] == []

def test_npm_tilde_stripped():
    data = '{"name":"t","version":"1.0.0","dependencies":{"axios":"~0.21.0"}}'
    deps = {d['name']:d for d in npm(data)['deps']}
    assert deps['axios']['version'] == '0.21.0'

def test_npm_unpinned_gets_warning():
    data = '{"name":"t","version":"1.0.0","dependencies":{"test-pkg":"*"}}'
    deps = {d['name']:d for d in npm(data)['deps']}
    assert deps['test-pkg']['pinned'] == False

# ── pypi ──────────────────────────────────────────────────────────────────────

PYPI = "# comment\nDjango==3.2.0\nrequests>=2.28.0\nnumpy==1.23.4"

def test_pypi_pinned_version():
    deps = {d['name']:d for d in pypi(PYPI)['deps']}
    assert deps['Django']['version'] == '3.2.0'
    assert deps['Django']['pinned'] == True

def test_pypi_gte_operator():
    deps = {d['name']:d for d in pypi(PYPI)['deps']}
    assert deps['requests']['version'] == '2.28.0'

def test_pypi_ignores_comments():
    names = [d['name'] for d in pypi(PYPI)['deps']]
    assert 'comment' not in names

def test_pypi_empty():
    assert pypi("# just comments\n")['deps'] == []

def test_pypi_bare_package_marked_unpinned():
    deps = {d['name']:d for d in pypi("Flask\n")['deps']}
    assert deps['Flask']['pinned'] == False

# ── maven ─────────────────────────────────────────────────────────────────────

MAVEN = """<project>
  <groupId>com.example</groupId><artifactId>my-java-app</artifactId><version>1.5.0</version>
  <dependencies>
    <dependency><groupId>org.springframework</groupId><artifactId>spring-core</artifactId><version>5.3.0</version></dependency>
    <dependency><groupId>junit</groupId><artifactId>junit</artifactId><version>4.13.2</version><scope>test</scope></dependency>
  </dependencies>
</project>"""

def test_maven_project_name():
    assert maven(MAVEN)['project_name'] == 'com.example:my-java-app'

def test_maven_project_version():
    assert maven(MAVEN)['project_version'] == '1.5.0'

def test_maven_dep_version():
    deps = {d['name']:d for d in maven(MAVEN)['deps']}
    assert deps['org.springframework:spring-core']['version'] == '5.3.0'

def test_maven_test_scope_excluded():
    names = [d['name'] for d in maven(MAVEN)['deps']]
    assert 'junit:junit' not in names

def test_maven_invalid_xml_raises():
    with pytest.raises(ValueError):
        maven("<not valid xml")

def test_maven_release_qualifier_handled():
    xml = """<project><groupId>com.example</groupId><artifactId>app</artifactId><version>1.0</version>
    <dependencies><dependency><groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot</artifactId><version>2.3.0.RELEASE</version></dependency></dependencies></project>"""
    deps = {d['name']:d for d in maven(xml)['deps']}
    assert 'org.springframework.boot:spring-boot' in deps
    assert deps['org.springframework.boot:spring-boot']['version'] == '2.3.0.RELEASE'

# ── lockfile ──────────────────────────────────────────────────────────────────

LOCKFILE_V2 = """{
  "name": "my-app",
  "version": "1.0.0",
  "lockfileVersion": 2,
  "packages": {
    "": {"dependencies": {"express": "^4.17.1"}},
    "node_modules/express": {"version": "4.17.1"},
    "node_modules/qs": {"version": "6.5.2"}
  }
}"""

def test_lockfile_project_name():
    assert lockfile(LOCKFILE_V2)['project_name'] == 'my-app'

def test_lockfile_extracts_packages():
    deps = lockfile(LOCKFILE_V2)['deps']
    names = [d['name'] for d in deps]
    assert 'express' in names
    assert 'qs' in names

def test_lockfile_exact_version():
    deps = {d['name']:d for d in lockfile(LOCKFILE_V2)['deps']}
    assert deps['express']['version'] == '4.17.1'
    assert deps['express']['pinned'] == True

def test_lockfile_invalid_json_raises():
    with pytest.raises(ValueError):
        lockfile("not json {{{")
