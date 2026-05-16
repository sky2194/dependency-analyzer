import re
import requests
import sys
import os
import logging
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.validation import validate_package_name, validate_version

log = logging.getLogger(__name__)

PYPI = 'https://pypi.org/pypi'

def get_latest_version(name):
    try:
        res = requests.get(f"{PYPI}/{name}/json", timeout=5)
        if res.status_code == 200:
            return res.json()['info']['version']
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
    # Reject content with no recognizable structure
    has_valid_line = any(
        re.match(r'^[A-Za-z][A-Za-z0-9_\-\.]*\s*[=><~!]', line.strip()) or
        re.match(r'^[A-Za-z][A-Za-z0-9_\-\.]+$', line.strip())
        for line in content.splitlines()
        if line.strip() and not line.strip().startswith('#')
    )
    if not has_valid_line:
        raise ValueError("No valid Python package declarations found")
    deps = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('-'):
            continue
        # Reject lines with obvious XSS attempts before matching
        if any(char in line.lower() for char in ['<script', '</script>', 'javascript:', 'onerror', 'onload']):
            continue
        # Reject lines with shell metacharacters
        if any(char in line for char in ['|', '`', '$', ';', '&', '>', '<']):
            continue
        match = re.match(r'^([A-Za-z0-9_\-\.]+)\s*[=><~!]+\s*([A-Za-z0-9_\.\-]+)', line)
        if match:
            name = match.group(1)
            version = match.group(2)
            # Validate package name
            try:
                validate_package_name(name)
            except ValueError:
                # Skip invalid package names
                continue
            # Validate version string
            try:
                validate_version(version)
            except ValueError:
                # Skip invalid versions
                continue
            deps.append({'name': name, 'version': version, 'pinned': True, 'warning': None})
        else:
            bare = re.match(r'^([A-Za-z0-9_\-\.]+)$', line)
            if bare:
                name = bare.group(1)
                # Validate package name
                try:
                    validate_package_name(name)
                except ValueError:
                    # Skip invalid package names
                    continue
                latest = get_latest_version(name)
                deps.append({'name': name, 'version': latest or 'unknown', 'pinned': False,
                    'warning': f"No version pinned — scanning latest ({latest}). Pin: {name}=={latest}" if latest else f"Could not resolve {name}."})
    return {'project_name': 'my-python-app', 'project_version': '1.0.0', 'deps': deps}
