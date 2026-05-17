import json
import requests
import sys
import os
import logging
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.validation import validate_package_name, validate_version

log = logging.getLogger(__name__)

NPM_REGISTRY = 'https://registry.npmjs.org'

def get_latest_version(name):
    try:
        res = requests.get(f"{NPM_REGISTRY}/{name}/latest", timeout=5)
        if res.status_code == 200:
            return res.json().get('version')
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout fetching latest version for {name}: {e}")
        return None
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error fetching latest version for {name}: {e}")
        return None
    except Exception as e:
        log.error(f"Error fetching latest version for {name}: {e}")
        return None
    return None

def parse(content):
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid package.json: {e}")

    project_name    = data.get('name', 'my-app')
    project_version = data.get('version', '1.0.0')

    # Validate project name if present
    if project_name:
        try:
            validate_package_name(project_name)
        except ValueError:
            # If project name is invalid, use a safe default
            project_name = 'my-app'

    deps = {}
    for section in ['dependencies', 'devDependencies', 'peerDependencies']:
        for name, version_val in data.get(section, {}).items():
            # Validate package name
            try:
                validate_package_name(name)
            except ValueError as e:
                # Skip invalid package names
                continue

            # Lock-file format puts {"version":"4.17.4",...} as the value
            if isinstance(version_val, dict):
                version_str = version_val.get('version', '')
            else:
                version_str = str(version_val)
            
            # Validate version string if it's not a wildcard
            if version_str and version_str not in ['*', 'x', 'latest', '']:
                try:
                    validate_version(version_str)
                except ValueError:
                    # If version is invalid, skip this dependency
                    continue

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
