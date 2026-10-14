import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.validation import validate_maven_coordinate, validate_version

CONFIGURATIONS = {
    "api",
    "implementation",
    "compile",
    "compileOnly",
    "runtimeOnly",
    "runtime",
}

STRING_NOTATION = re.compile(
    r"^\s*(?P<config>[A-Za-z][A-Za-z0-9_]*)\s+['\"](?P<group>[^:'\"]+):(?P<artifact>[^:'\"]+):(?P<version>[^'\"]+)['\"]"
)
KOTLIN_NOTATION = re.compile(
    r"^\s*(?P<config>[A-Za-z][A-Za-z0-9_]*)\s*\(\s*['\"](?P<group>[^:'\"]+):(?P<artifact>[^:'\"]+):(?P<version>[^'\"]+)['\"]\s*\)"
)
MAP_NOTATION = re.compile(
    r"^\s*(?P<config>[A-Za-z][A-Za-z0-9_]*)\s+"
    r"(?:group\s*:\s*['\"](?P<group>[^'\"]+)['\"]\s*,\s*)?"
    r"name\s*:\s*['\"](?P<artifact>[^'\"]+)['\"]\s*,\s*"
    r"version\s*:\s*['\"](?P<version>[^'\"]+)['\"]"
)
ROOT_PROJECT = re.compile(r"^\s*(?:rootProject\.)?name\s*=\s*['\"](?P<name>[^'\"]+)['\"]")
PROJECT_VERSION = re.compile(r"^\s*version\s*=\s*['\"](?P<version>[^'\"]+)['\"]")


def _strip_inline_comment(line):
    in_quote = None
    for i, char in enumerate(line):
        if char in ("'", '"') and (i == 0 or line[i - 1] != "\\"):
            in_quote = None if in_quote == char else char
        if char == "/" and i + 1 < len(line) and line[i + 1] == "/" and not in_quote:
            return line[:i]
    return line


def _clean_version(version):
    return version.strip().lstrip("^~")


def _validate_dep(group, artifact, version):
    try:
        validate_maven_coordinate(group, "group")
        validate_maven_coordinate(artifact, "artifact")
    except ValueError:
        raise ValueError("Invalid build.gradle: dependency contains invalid Maven coordinates")

    clean_version = _clean_version(version)
    try:
        validate_version(clean_version)
    except ValueError:
        clean_version = "unknown"

    return {
        "name": f"{group}:{artifact}",
        "version": clean_version,
        "pinned": clean_version != "unknown",
        "warning": None if clean_version != "unknown" else f"Could not parse version for {group}:{artifact}.",
    }


def parse(content):
    """Parse Gradle Groovy dependencies into Maven coordinates."""
    content_lower = content.lower()
    if "<script" in content_lower or "</script>" in content_lower:
        raise ValueError("Invalid build.gradle: contains potentially malicious content")

    project_name = "gradle-app"
    project_version = "1.0.0"
    deps = []

    for raw_line in content.splitlines():
        line = _strip_inline_comment(raw_line).strip()
        if not line:
            continue

        project_match = ROOT_PROJECT.match(line)
        if project_match:
            project_name = project_match.group("name")
            continue

        version_match = PROJECT_VERSION.match(line)
        if version_match:
            project_version = version_match.group("version")
            continue

        match = STRING_NOTATION.match(line) or KOTLIN_NOTATION.match(line) or MAP_NOTATION.match(line)
        if not match:
            continue

        config = match.group("config")
        if config not in CONFIGURATIONS:
            continue

        group = match.group("group")
        artifact = match.group("artifact")
        version = match.group("version")
        if not group:
            continue

        deps.append(_validate_dep(group, artifact, version))

    return {"project_name": project_name, "project_version": project_version, "deps": deps}
