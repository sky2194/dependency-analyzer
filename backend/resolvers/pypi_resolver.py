import requests
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import logging

log = logging.getLogger(__name__)

PYPI = 'https://pypi.org/pypi'
_cache = {}
_cache_lock = Lock()
_CACHE_TTL = 3600
_MAX_CACHE_SIZE = 500

def _fetch_deps(name, version):
    key = f"{name}@{version}"
    with _cache_lock:
        if key in _cache:
            return _cache[key]
    try:
        url = f"{PYPI}/{name}/{version}/json" if version not in ('latest', 'unknown') else f"{PYPI}/{name}/json"
        res = requests.get(url, timeout=5)
        if res.status_code != 200:
            return {}
        requires = res.json().get('info', {}).get('requires_dist') or []
        deps = {}
        for req in requires:
            if 'extra ==' in req:
                continue
            match = re.match(r'^([A-Za-z0-9_\-\.]+)\s*(?:\(([^)]+)\))?', req)
            if not match:
                continue
            dep_name = match.group(1)
            ver_str = match.group(2) or ''
            ver_match = re.search(r'[\d\.]+', ver_str)
            deps[dep_name] = ver_match.group(0) if ver_match else 'latest'
        with _cache_lock:
            _cache[key] = deps
            # Evict oldest entries if cache exceeds max size
            while len(_cache) >= _MAX_CACHE_SIZE:
                oldest_key = next(iter(_cache))
                del _cache[oldest_key]
        return deps
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout fetching PyPI deps for {name}@{version}: {e}")
        return {}
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error fetching PyPI deps for {name}@{version}: {e}")
        return {}
    except Exception as e:
        log.error(f"Error fetching PyPI deps for {name}@{version}: {e}")
        return {}

def _build_tree(name, version, dep_type, depth, max_depth, visited):
    if depth > max_depth:
        return {'name': name, 'version': version, 'type': dep_type, 'dependencies': [], 'vulnerabilities': []}

    deps_map = _fetch_deps(name, version)
    children = []
    child_items = [(n, v) for n, v in deps_map.items() if f"{n}@{v}" not in visited]
    visited = visited | {f"{n}@{v}" for n, v in child_items}

    if child_items:
        with ThreadPoolExecutor(max_workers=8) as ex:
            futures = {ex.submit(_build_tree, n, v, 'transitive', depth+1, max_depth, visited): (n, v) for n, v in child_items}
            for future in as_completed(futures):
                try:
                    children.append(future.result())
                except Exception as e:
                    log.error(f"Error building tree for {n}@{v}: {e}")
                    children.append({'name': n, 'version': v, 'type': 'transitive', 'dependencies': [], 'vulnerabilities': []})

    return {'name': name, 'version': version, 'type': dep_type, 'dependencies': children, 'vulnerabilities': []}

def resolve(direct_deps, max_depth=2):
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
            except Exception as e:
                log.error(f"Error resolving {d['name']}: {e}")
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
        winner = entries[0]
        conflicts.append({
            'package': pkg,
            'requestedBy': [{'requester': e['requester'], 'version': e['version'], 'depth': e['depth'], 'safe': True} for e in entries],
            'selected': winner['version'],
            'loser': entries[1]['version'] if len(entries) > 1 else None,
            'reason': f"pip resolution: {winner['requester']} declared first, version {winner['version']} wins.",
            'risk': None
        })
    return conflicts
