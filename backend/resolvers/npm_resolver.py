import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

REGISTRY = 'https://registry.npmjs.org'
_cache = {}
_cache_lock = Lock()

def _fetch_deps(name, version):
    """Fetch direct dependencies of a single package from npm registry."""
    key = f"{name}@{version}"
    with _cache_lock:
        if key in _cache:
            return _cache[key]
    try:
        res = requests.get(f"{REGISTRY}/{name}/{version}", timeout=5)
        if res.status_code != 200:
            return {}
        deps = res.json().get('dependencies', {})
        clean = {}
        for dep_name, dep_ver in deps.items():
            v = dep_ver.lstrip('^~>=<! ').split(' ')[0].strip()
            if not v or not v[0].isdigit():
                v = 'latest'
            clean[dep_name] = v
        with _cache_lock:
            _cache[key] = clean
        return clean
    except Exception:
        return {}

def _build_tree(name, version, dep_type, depth, max_depth, visited):
    """Build dependency tree node with parallel child fetching."""
    if depth > max_depth:
        return {'name': name, 'version': version, 'type': dep_type, 'dependencies': [], 'vulnerabilities': []}

    deps_map = _fetch_deps(name, version)

    # Fetch all children in parallel
    children = []
    child_items = [(n, v) for n, v in deps_map.items() if f"{n}@{v}" not in visited]

    # Mark all as visited before fetching to prevent circular deps
    visit_keys = {f"{n}@{v}" for n, v in child_items}
    visited = visited | visit_keys

    if child_items:
        with ThreadPoolExecutor(max_workers=10) as ex:
            futures = {ex.submit(_build_tree, n, v, 'transitive', depth+1, max_depth, visited): (n, v) for n, v in child_items}
            for future in as_completed(futures):
                try:
                    children.append(future.result())
                except Exception:
                    n, v = futures[future]
                    children.append({'name': n, 'version': v, 'type': 'transitive', 'dependencies': [], 'vulnerabilities': []})

    return {'name': name, 'version': version, 'type': dep_type, 'dependencies': children, 'vulnerabilities': []}

def resolve(direct_deps, max_depth=3):
    graph_deps = []
    version_map = {}

    with ThreadPoolExecutor(max_workers=5) as ex:
        futures = {
            ex.submit(_build_tree, d['name'], d['version'], 'direct', 1, max_depth, {f"{d['name']}@{d['version']}"}): d
            for d in direct_deps
        }
        for future in as_completed(futures):
            try:
                node = future.result()
                graph_deps.append(node)
                _collect(node['name'], node['version'], 1, 'root', version_map)
                _collect_tree(node.get('dependencies', []), version_map, 2, node['name'])
            except Exception:
                d = futures[future]
                graph_deps.append({'name': d['name'], 'version': d['version'], 'type': 'direct', 'dependencies': [], 'vulnerabilities': []})

    return graph_deps, _resolve_conflicts(version_map)

def _collect(name, version, depth, requester, version_map):
    version_map.setdefault(name, []).append({'version': version, 'depth': depth, 'requester': requester})

def _collect_tree(deps, version_map, depth, parent):
    for dep in deps:
        _collect(dep['name'], dep['version'], depth, parent, version_map)
        if dep.get('dependencies'):
            _collect_tree(dep['dependencies'], version_map, depth+1, dep['name'])

def _resolve_conflicts(version_map):
    conflicts = []
    for pkg, entries in version_map.items():
        versions = list({e['version'] for e in entries})
        if len(versions) < 2:
            continue
        winner = min(entries, key=lambda x: x['depth'])
        conflicts.append({
            'package': pkg,
            'requestedBy': [{'requester': e['requester'], 'version': e['version'], 'depth': e['depth'], 'safe': True} for e in entries],
            'selected': winner['version'],
            'loser': next((e['version'] for e in entries if e['version'] != winner['version']), None),
            'reason': f"npm nearest-depth rule: {winner['requester']} requires {pkg}@{winner['version']} at depth {winner['depth']}.",
            'risk': None
        })
    return conflicts
