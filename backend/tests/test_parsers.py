"""
test_parsers.py — Unit tests for all four parsers.

Parsers are pure string-in / dict-out functions.  No CVE data is involved.
Tests that exercise unpinned-version handling (wildcard, latest tag, bare name)
allow real network calls to npm/PyPI/Maven for get_latest_version so the test
verifies the full parsing + version-lookup path.

Real package names and versions are used throughout.
"""
import json
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from parsers.npm_parser import parse as parse_npm
from parsers.pypi_parser import parse as parse_pypi
from parsers.maven_parser import parse as parse_maven
from parsers.gradle_parser import parse as parse_gradle
from parsers.lockfile_parser import parse as parse_lockfile


# ── npm parser ────────────────────────────────────────────────────────────────

class TestNpmParser:
    def test_pinned_production_dep(self):
        """Pinned production dep returns exact version and pinned=True."""
        content = json.dumps({"name": "api-server", "version": "2.0.0",
                              "dependencies": {"express": "4.18.2"}})
        result = parse_npm(content)
        dep = next(d for d in result['deps'] if d['name'] == 'express')
        assert dep['version'] == '4.18.2'
        assert dep['pinned'] is True
        assert dep['warning'] is None

    def test_caret_version_stripped(self):
        """^4.18.2 is stripped to 4.18.2; package is still treated as pinned."""
        content = json.dumps({"dependencies": {"express": "^4.18.2"}})
        result = parse_npm(content)
        dep = next(d for d in result['deps'] if d['name'] == 'express')
        assert dep['version'] == '4.18.2'
        assert dep['pinned'] is True

    def test_tilde_version_stripped(self):
        """~7.3.8 is stripped to 7.3.8."""
        content = json.dumps({"dependencies": {"semver": "~7.3.8"}})
        result = parse_npm(content)
        dep = next(d for d in result['deps'] if d['name'] == 'semver')
        assert dep['version'] == '7.3.8'
        assert dep['pinned'] is True

    def test_dev_dependencies_included(self):
        """devDependencies are parsed alongside regular dependencies."""
        content = json.dumps({
            "dependencies": {"express": "4.18.2"},
            "devDependencies": {"jest": "29.5.0"},
        })
        result = parse_npm(content)
        names = [d['name'] for d in result['deps']]
        assert 'express' in names
        assert 'jest' in names

    def test_peer_dependencies_included(self):
        """peerDependencies are included in the parsed result."""
        content = json.dumps({"peerDependencies": {"react": "18.2.0"}})
        result = parse_npm(content)
        assert any(d['name'] == 'react' for d in result['deps'])

    def test_optional_dependencies_not_included(self):
        """optionalDependencies are NOT parsed (only deps, devDeps, peerDeps)."""
        content = json.dumps({
            "dependencies": {"express": "4.18.2"},
            "optionalDependencies": {"fsevents": "2.3.3"},
        })
        result = parse_npm(content)
        assert not any(d['name'] == 'fsevents' for d in result['deps'])

    def test_unpinned_wildcard_fetches_real_latest(self):
        """A wildcard version (*) triggers a live npm registry call.
        The returned version must be a real version string (not 'unknown')
        and pinned must be False."""
        content = json.dumps({"dependencies": {"minimist": "*"}})
        result = parse_npm(content)
        dep = next(d for d in result['deps'] if d['name'] == 'minimist')
        assert dep['pinned'] is False
        assert dep['version'] not in ('*', 'unknown', ''), (
            f"Expected a real version from npm registry but got: {dep['version']}"
        )
        assert dep['warning'] is not None

    def test_project_name_extracted(self):
        """project_name and project_version are taken from the JSON root."""
        content = json.dumps({"name": "invoice-service", "version": "3.1.0",
                              "dependencies": {"uuid": "9.0.0"}})
        result = parse_npm(content)
        assert result['project_name'] == 'invoice-service'
        assert result['project_version'] == '3.1.0'

    def test_empty_dependencies_returns_empty_list(self):
        """package.json with no dependency sections returns an empty dep list."""
        content = json.dumps({"name": "bare-pkg", "version": "1.0.0"})
        result = parse_npm(content)
        assert result['deps'] == []

    def test_malformed_json_raises_value_error(self):
        """Non-JSON content raises ValueError."""
        with pytest.raises(ValueError):
            parse_npm("not json at all {{{")

    def test_scoped_package_name(self):
        """Scoped npm packages (@babel/core) are parsed correctly."""
        content = json.dumps({"dependencies": {"@babel/core": "7.22.0"}})
        result = parse_npm(content)
        assert any(d['name'] == '@babel/core' for d in result['deps'])


# ── PyPI parser ───────────────────────────────────────────────────────────────

class TestPypiParser:
    def test_pinned_equality_constraint(self):
        """requests==2.28.0 is parsed to version 2.28.0 with type=direct."""
        content = "requests==2.28.0\n"
        result = parse_pypi(content)
        dep = next(d for d in result['deps'] if d['name'] == 'requests')
        assert dep['version'] == '2.28.0'
        assert dep['type'] == 'direct'

    def test_gte_constraint_extracts_floor(self):
        """requests>=2.28.0 → version 2.28.0 (the constraint floor)."""
        content = "requests>=2.28.0\n"
        result = parse_pypi(content)
        dep = next(d for d in result['deps'] if d['name'] == 'requests')
        assert dep['version'] == '2.28.0'

    def test_comment_lines_skipped(self):
        """Lines starting with # are ignored."""
        content = "# production deps\nrequests==2.28.0\n"
        result = parse_pypi(content)
        assert any(d['name'] == 'requests' for d in result['deps'])
        assert not any(d['name'].startswith('#') for d in result['deps'])

    def test_editable_install_skipped(self):
        """Lines starting with - (e.g. -e .) are skipped."""
        content = "requests==2.28.0\n-e .\n"
        result = parse_pypi(content)
        names = [d['name'] for d in result['deps']]
        assert 'requests' in names
        assert 'e' not in names

    def test_extras_syntax_skipped(self):
        """requests[security]==2.28.0 — extras marker breaks the parser regex,
        line is skipped gracefully."""
        content = "certifi==2023.7.22\nrequests[security]==2.28.0\n"
        result = parse_pypi(content)
        names = [d['name'] for d in result['deps']]
        assert 'certifi' in names
        assert 'requests' not in names

    def test_multiple_packages_all_parsed(self):
        """A typical requirements.txt with several pinned packages is parsed fully."""
        content = (
            "flask==2.3.3\n"
            "sqlalchemy==2.0.19\n"
            "psycopg2-binary==2.9.7\n"
            "gunicorn==21.2.0\n"
        )
        result = parse_pypi(content)
        names = [d['name'] for d in result['deps']]
        for pkg in ('flask', 'sqlalchemy', 'psycopg2-binary', 'gunicorn'):
            assert pkg in names

    def test_blank_lines_skipped(self):
        """Blank lines between entries produce no spurious deps."""
        content = "\nflask==2.3.3\n\ncertifi==2023.7.22\n\n"
        result = parse_pypi(content)
        assert len(result['deps']) == 2

    def test_project_name_is_python_app(self):
        """The parser always returns project_name='python-app'."""
        content = "flask==2.3.3\n"
        assert parse_pypi(content)['project_name'] == 'python-app'

    def test_unversioned_package_fetches_real_latest(self):
        """A bare package name triggers a live PyPI call for the latest version."""
        content = "flask==2.3.3\nboto3\n"
        result = parse_pypi(content)
        dep = next((d for d in result['deps'] if d['name'] == 'boto3'), None)
        assert dep is not None
        assert dep['version'] not in ('', '*', None), (
            f"Expected a real version from PyPI but got: {dep['version']}"
        )


# ── Maven parser ──────────────────────────────────────────────────────────────

class TestMavenParser:
    def test_compile_scope_dep_included(self):
        """A compile-scope dep is included in the parsed result."""
        content = """<project>
          <groupId>com.example</groupId><artifactId>demo</artifactId><version>1.0</version>
          <dependencies>
            <dependency>
              <groupId>com.fasterxml.jackson.core</groupId>
              <artifactId>jackson-databind</artifactId>
              <version>2.15.2</version>
              <scope>compile</scope>
            </dependency>
          </dependencies>
        </project>"""
        result = parse_maven(content)
        dep = next(d for d in result['deps'] if 'jackson-databind' in d['name'])
        assert dep['version'] == '2.15.2'
        assert dep['pinned'] is True

    def test_test_scope_excluded(self):
        """Dependencies with scope=test are excluded."""
        content = """<project>
          <groupId>com.example</groupId><artifactId>demo</artifactId><version>1.0</version>
          <dependencies>
            <dependency>
              <groupId>junit</groupId><artifactId>junit</artifactId>
              <version>4.13.2</version><scope>test</scope>
            </dependency>
          </dependencies>
        </project>"""
        assert not parse_maven(content)['deps']

    def test_provided_scope_excluded(self):
        """Dependencies with scope=provided are excluded."""
        content = """<project>
          <groupId>com.example</groupId><artifactId>demo</artifactId><version>1.0</version>
          <dependencies>
            <dependency>
              <groupId>javax.servlet</groupId><artifactId>servlet-api</artifactId>
              <version>2.5</version><scope>provided</scope>
            </dependency>
          </dependencies>
        </project>"""
        assert not parse_maven(content)['deps']

    def test_property_placeholder_resolved_from_properties(self):
        """${spring.version} is resolved from <properties>."""
        content = """<project>
          <groupId>com.example</groupId><artifactId>demo</artifactId><version>1.0</version>
          <properties><spring.version>5.3.25</spring.version></properties>
          <dependencies>
            <dependency>
              <groupId>org.springframework</groupId><artifactId>spring-core</artifactId>
              <version>${spring.version}</version>
            </dependency>
          </dependencies>
        </project>"""
        result = parse_maven(content)
        dep = next(d for d in result['deps'] if 'spring-core' in d['name'])
        assert dep['version'] == '5.3.25'
        assert dep['pinned'] is True

    def test_unresolvable_property_does_not_crash_parser(self):
        """An undeclared ${placeholder} is handled gracefully — the parser either
        resolves the version via Maven Search or falls back to 'unknown', but
        must not raise or skip the dependency entirely."""
        content = """<project>
          <groupId>com.example</groupId><artifactId>demo</artifactId><version>1.0</version>
          <dependencies>
            <dependency>
              <groupId>org.springframework</groupId><artifactId>spring-context</artifactId>
              <version>${undeclared.version}</version>
            </dependency>
          </dependencies>
        </project>"""
        result = parse_maven(content)
        dep = next((d for d in result['deps'] if 'spring-context' in d['name']), None)
        assert dep is not None, (
            "spring-context must appear in results even when version is an unresolvable property"
        )
        assert dep['version'] is not None

    def test_project_name_is_groupid_colon_artifactid(self):
        """project_name is 'groupId:artifactId'."""
        content = """<project>
          <groupId>org.apache.kafka</groupId><artifactId>kafka-clients</artifactId>
          <version>3.5.1</version>
        </project>"""
        assert parse_maven(content)['project_name'] == 'org.apache.kafka:kafka-clients'

    def test_no_dependencies_returns_empty(self):
        """A POM with no <dependencies> block returns an empty dep list."""
        content = """<project>
          <groupId>com.example</groupId><artifactId>minimal</artifactId>
          <version>1.0.0</version>
        </project>"""
        assert parse_maven(content)['deps'] == []

    def test_malformed_xml_raises_value_error(self):
        """Non-XML content raises ValueError."""
        with pytest.raises(ValueError):
            parse_maven("not xml <unclosed>")

    def test_namespace_pom_parsed_by_xmltodict(self):
        """A POM with xmlns attribute is parsed correctly by xmltodict (parser-level)."""
        content = """<?xml version="1.0"?>
        <project xmlns="http://maven.apache.org/POM/4.0.0">
          <groupId>org.springframework</groupId>
          <artifactId>spring-webmvc</artifactId>
          <version>5.3.25</version>
          <dependencies>
            <dependency>
              <groupId>org.springframework</groupId>
              <artifactId>spring-core</artifactId>
              <version>5.3.25</version>
            </dependency>
          </dependencies>
        </project>"""
        result = parse_maven(content)
        assert any('spring-core' in d['name'] for d in result['deps'])


# ── Gradle parser ─────────────────────────────────────────────────────────────

class TestGradleParser:
    def test_string_notation_dependency_included(self):
        content = """plugins { id 'java' }
        rootProject.name = 'invoice-service'
        version = '2.0.0'
        dependencies {
          implementation 'com.fasterxml.jackson.core:jackson-databind:2.9.8'
        }"""
        result = parse_gradle(content)
        dep = next(d for d in result['deps'] if 'jackson-databind' in d['name'])
        assert result['project_name'] == 'invoice-service'
        assert result['project_version'] == '2.0.0'
        assert dep['name'] == 'com.fasterxml.jackson.core:jackson-databind'
        assert dep['version'] == '2.9.8'
        assert dep['pinned'] is True

    def test_map_notation_dependency_included(self):
        content = """dependencies {
          api group: 'org.springframework', name: 'spring-core', version: '5.3.25'
        }"""
        result = parse_gradle(content)
        dep = next(d for d in result['deps'] if 'spring-core' in d['name'])
        assert dep['name'] == 'org.springframework:spring-core'
        assert dep['version'] == '5.3.25'

    def test_kotlin_notation_dependency_included(self):
        content = '''dependencies {
          implementation("org.springframework:spring-core:5.3.25")
        }'''
        result = parse_gradle(content)
        dep = next(d for d in result['deps'] if 'spring-core' in d['name'])
        assert dep['name'] == 'org.springframework:spring-core'
        assert dep['version'] == '5.3.25'

    def test_test_dependencies_excluded(self):
        content = """dependencies {
          testImplementation 'junit:junit:4.13.2'
        }"""
        assert parse_gradle(content)['deps'] == []

    def test_invalid_coordinate_raises_value_error(self):
        content = """dependencies {
          implementation 'bad<group:artifact:1.0.0'
        }"""
        with pytest.raises(ValueError, match="Invalid build.gradle"):
            parse_gradle(content)


# ── Lockfile parser ───────────────────────────────────────────────────────────

class TestLockfileParser:
    def test_v2_lockfile_packages_key(self):
        """v2 lockfile format (lockfileVersion=2) uses the 'packages' key."""
        lockfile = json.dumps({
            "name": "my-app", "version": "1.0.0", "lockfileVersion": 2,
            "packages": {
                "": {"dependencies": {"express": "4.18.2"}},
                "node_modules/express": {"version": "4.18.2"},
                "node_modules/body-parser": {"version": "1.20.1"},
            }
        })
        result = parse_lockfile(lockfile)
        names = [d['name'] for d in result['deps']]
        assert 'express' in names
        assert 'body-parser' in names

    def test_v2_direct_vs_transitive_classification(self):
        """Packages listed in the root '' dependencies are 'direct'; others 'transitive'."""
        lockfile = json.dumps({
            "name": "my-app", "version": "1.0.0", "lockfileVersion": 2,
            "packages": {
                "": {"dependencies": {"express": "4.18.2"}},
                "node_modules/express": {"version": "4.18.2"},
                "node_modules/body-parser": {"version": "1.20.1"},
            }
        })
        result = parse_lockfile(lockfile)
        expr = next(d for d in result['deps'] if d['name'] == 'express')
        bparser = next(d for d in result['deps'] if d['name'] == 'body-parser')
        assert expr['type'] == 'direct'
        assert bparser['type'] == 'transitive'

    def test_all_lockfile_deps_are_pinned(self):
        """Every entry from a lockfile has pinned=True (exact installed versions)."""
        lockfile = json.dumps({
            "name": "my-app", "version": "1.0.0", "lockfileVersion": 2,
            "packages": {
                "": {},
                "node_modules/chalk": {"version": "5.3.0"},
                "node_modules/commander": {"version": "11.0.0"},
            }
        })
        result = parse_lockfile(lockfile)
        assert all(d['pinned'] is True for d in result['deps'])

    def test_malformed_json_raises_value_error(self):
        """Non-JSON lockfile content raises ValueError."""
        with pytest.raises(ValueError):
            parse_lockfile("this is not json")
