import json
import requests

NPM_REGISTRY = 'https://registry.npmjs.org'

def get_latest_version(name):
    try:
        res = requests.get(f"{NPM_REGISTRY}/{name}/latest", timeout=5)
        if res.status_code == 200:
            return res.json().get('version')
    except Exception:
        pass
    return None

def parse(content):
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid package.json: {e}")

    project_name    = data.get('name', 'my-app')
    project_version = data.get('version', '1.0.0')

    deps = {}
    for section in ['dependencies', 'devDependencies', 'peerDependencies']:
        for name, version_str in data.get(section, {}).items():
            # Strip semver operators — ^4.18.2 → 4.18.2, ~2.0.0 → 2.0.0
            clean = version_str.lstrip('^~>=<! ').split(' ')[0].strip()

            # Only truly unpinned: *, x, latest, empty
            truly_unpinned = clean in ('*', 'x', 'latest', '') or not clean[0].isdigit()
            warning = None

            if truly_unpinned:
                latest = get_latest_version(name)
                clean = latest or 'unknown'
                warning = f"No version pinned — scanning latest ({clean}). Pin version: \"{name}\": \"{clean}\""

            deps[name] = {'version': clean, 'pinned': not truly_unpinned, 'warning': warning}

    return {
        'project_name': project_name,
        'project_version': project_version,
        'deps': [{'name': k, 'version': v['version'], 'pinned': v['pinned'], 'warning': v['warning']} for k, v in deps.items()]
    }
