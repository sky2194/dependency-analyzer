import json

def parse(content):
    """Parse package-lock.json — exact installed versions, no registry calls needed."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid package-lock.json: {e}")

    project_name = data.get('name', 'my-app')
    project_version = data.get('version', '1.0.0')
    lockfile_version = data.get('lockfileVersion', 1)
    deps = []

    # v2/v3 lockfile uses 'packages'
    if lockfile_version >= 2 and 'packages' in data:
        packages = data['packages']
        root_deps = set(packages.get('', {}).get('dependencies', {}).keys()) | \
                    set(packages.get('', {}).get('devDependencies', {}).keys())
        for path, info in packages.items():
            if not path or path == '':
                continue
            name = path.replace('node_modules/', '').split('node_modules/')[-1]
            version = info.get('version', 'unknown')
            dep_type = 'direct' if name in root_deps else 'transitive'
            deps.append({'name': name, 'version': version, 'pinned': True, 'warning': None, 'type': dep_type})

    # v1 lockfile uses 'dependencies'
    elif 'dependencies' in data:
        root_pkg = data.get('dependencies', {})
        root_direct = set(json.loads(content).get('requires', {}).keys()) if 'requires' in data else set()
        _flatten_v1(root_pkg, deps, root_direct, is_root=True)

    return {'project_name': project_name, 'project_version': project_version, 'deps': deps}

def _flatten_v1(deps_map, result, root_direct, is_root=False):
    for name, info in deps_map.items():
        dep_type = 'direct' if (is_root and name in root_direct) else 'transitive'
        result.append({'name': name, 'version': info.get('version', 'unknown'), 'pinned': True, 'warning': None, 'type': dep_type})
        if 'dependencies' in info:
            _flatten_v1(info['dependencies'], result, root_direct, is_root=False)
