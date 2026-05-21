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
        # Reject lines with shell metacharacters (not > or < — valid PEP 440 version specifiers)
        if any(char in line for char in ['|', '`', '$', ';', '&']):
            continue
        match = re.match(r'^([A-Za-z0-9_\-\.]+)\s*[=><~!]+\s*([A-Za-z0-9_\.\-]+)', line)
        if match:
            name, ver = match.groups()
            try:
                validated_name = validate_package_name(name)
                validated_ver = validate_version(ver)
                deps.append({'name': validated_name, 'version': validated_ver, 'type': 'direct'})
            except ValueError:
                continue
        else:
            # No version constraint; optionally fetch latest or skip
            name_only = re.match(r'^([A-Za-z0-9_\-\.]+)$', line)
            if name_only:
                name = name_only.group(1)
                try:
                    validated_name = validate_package_name(name)
                    ver = get_latest_version(name)
                    deps.append({'name': validated_name, 'version': ver or '*', 'type': 'direct'})
                except ValueError:
                    continue
    return {'project_name': 'python-app', 'deps': deps}
