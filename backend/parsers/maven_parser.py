import xmltodict
import requests
import sys
import os
import logging
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.validation import validate_maven_coordinate, validate_version

log = logging.getLogger(__name__)

MAVEN_SEARCH = 'https://search.maven.org/solrsearch/select'

def get_latest_version(group, artifact):
    try:
        res = requests.get(MAVEN_SEARCH, params={'q': f'g:"{group}" AND a:"{artifact}"', 'rows': 1, 'wt': 'json'}, timeout=5)
        if res.status_code == 200:
            docs = res.json().get('response', {}).get('docs', [])
            if docs:
                return docs[0].get('latestVersion')
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout fetching latest version for {group}:{artifact}: {e}")
        return None
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error fetching latest version for {group}:{artifact}: {e}")
        return None
    except Exception as e:
        log.error(f"Error fetching latest version for {group}:{artifact}: {e}")
        return None
    return None

def parse(content):
    # Pre-validate content for XML/script injection before parsing
    # Allow standard XML declaration but block script tags
    content_lower = content.lower()
    if '<script' in content_lower or '</script>' in content_lower:
        raise ValueError("Invalid pom.xml: contains potentially malicious content")
    
    try:
        data = xmltodict.parse(content)
    except Exception as e:
        raise ValueError(f"Invalid pom.xml: {e}")

    project = data.get('project', data)
    group_id = project.get('groupId', 'com.example')
    artifact_id = project.get('artifactId', 'my-app')
    version = project.get('version', '1.0.0')

    # Validate Maven coordinates
    try:
        validate_maven_coordinate(group_id, 'groupId')
    except ValueError:
        raise ValueError(f"Invalid groupId: contains invalid characters")

    try:
        validate_maven_coordinate(artifact_id, 'artifactId')
    except ValueError:
        raise ValueError(f"Invalid artifactId: contains invalid characters")

    project_name = f"{group_id}:{artifact_id}"

    props = {k: v for k, v in project.get('properties', {}).items() if isinstance(v, str)}

    dep_list = project.get('dependencies', {}).get('dependency', [])
    if isinstance(dep_list, dict):
        dep_list = [dep_list]

    deps = []
    for dep in dep_list:
        scope = dep.get('scope', 'compile')
        if scope in ('test', 'provided', 'system'):
            continue
        g = dep.get('groupId', '')
        a = dep.get('artifactId', '')
        v = dep.get('version', '')

        # Validate Maven coordinates
        try:
            validate_maven_coordinate(g, 'groupId')
        except ValueError:
            raise ValueError(f"Invalid dependency groupId: contains invalid characters")

        try:
            validate_maven_coordinate(a, 'artifactId')
        except ValueError:
            raise ValueError(f"Invalid dependency artifactId: contains invalid characters")

        if v.startswith('${'):
            v = props.get(v.strip('${}'), '')

        # Validate version string
        if v and not v.startswith('${'):
            try:
                validate_version(v)
            except ValueError:
                v = 'unknown'

        name = f"{g}:{a}"
        pinned = bool(v and '${' not in v)
        warning = None
        if not pinned:
            latest = get_latest_version(g, a)
            v = latest or 'unknown'
            warning = f"No version specified — scanning latest ({v}). Use <dependencyManagement> to pin." if latest else f"Could not resolve {name}."
        deps.append({'name': name, 'version': v, 'pinned': pinned, 'warning': warning})

    return {'project_name': project_name, 'project_version': version, 'deps': deps}
