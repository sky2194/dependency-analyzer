import re
import requests

PYPI = 'https://pypi.org/pypi'

def get_latest_version(name):
    try:
        res = requests.get(f"{PYPI}/{name}/json", timeout=5)
        if res.status_code == 200:
            return res.json()['info']['version']
    except Exception:
        pass
    return None

def parse(content):
    deps = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('-'):
            continue
        match = re.match(r'^([A-Za-z0-9_\-\.]+)\s*[=><~!]+\s*([A-Za-z0-9_\.\-]+)', line)
        if match:
            deps.append({'name': match.group(1), 'version': match.group(2), 'pinned': True, 'warning': None})
        else:
            bare = re.match(r'^([A-Za-z0-9_\-\.]+)$', line)
            if bare:
                name = bare.group(1)
                latest = get_latest_version(name)
                deps.append({'name': name, 'version': latest or 'unknown', 'pinned': False,
                    'warning': f"No version pinned — scanning latest ({latest}). Pin: {name}=={latest}" if latest else f"Could not resolve {name}."})
    return {'project_name': 'my-python-app', 'project_version': '1.0.0', 'deps': deps}
