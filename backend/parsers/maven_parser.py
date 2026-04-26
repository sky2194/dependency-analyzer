import xmltodict
import requests

MAVEN_SEARCH = 'https://search.maven.org/solrsearch/select'

def get_latest_version(group, artifact):
    try:
        res = requests.get(MAVEN_SEARCH, params={'q': f'g:"{group}" AND a:"{artifact}"', 'rows': 1, 'wt': 'json'}, timeout=5)
        if res.status_code == 200:
            docs = res.json().get('response', {}).get('docs', [])
            if docs:
                return docs[0].get('latestVersion')
    except Exception:
        pass
    return None

def parse(content):
    try:
        data = xmltodict.parse(content)
    except Exception as e:
        raise ValueError(f"Invalid pom.xml: {e}")

    project = data.get('project', data)
    group_id = project.get('groupId', 'com.example')
    artifact_id = project.get('artifactId', 'my-app')
    version = project.get('version', '1.0.0')
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
        if v.startswith('${'):
            v = props.get(v.strip('${}'), '')
        name = f"{g}:{a}"
        pinned = bool(v and '${' not in v)
        warning = None
        if not pinned:
            latest = get_latest_version(g, a)
            v = latest or 'unknown'
            warning = f"No version specified — scanning latest ({v}). Use <dependencyManagement> to pin." if latest else f"Could not resolve {name}."
        deps.append({'name': name, 'version': v, 'pinned': pinned, 'warning': warning})

    return {'project_name': project_name, 'project_version': version, 'deps': deps}
