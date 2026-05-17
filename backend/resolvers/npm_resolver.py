import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import time
import sys
import os
import logging
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.validation import validate_package_name, validate_version
from utils.circuit_breaker import CircuitBreaker, retry_with_backoff

log = logging.getLogger(__name__)

REGISTRY   = 'https://registry.npmjs.org'
_cache     = {}
_cache_lock = Lock()
_CACHE_TTL  = 3600  # 1 hour
_MAX_CACHE_SIZE = 500

# Circuit breaker for npm registry
npm_circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60, recovery_timeout=30)

@npm_circuit_breaker.call
@retry_with_backoff(max_retries=1, base_delay=0.5, max_delay=3)
def _fetch_deps(name, version):
    # Validate package name and version before making API calls
    try:
        validate_package_name(name)
    except ValueError:
        return {}
    
    try:
        validate_version(version)
    except ValueError:
        return {}
    
    key = f"{name}@{version}"
    with _cache_lock:
        entry = _cache.get(key)
        if entry and time.time() - entry['ts'] < _CACHE_TTL:
            return entry['data']
    try:
        res = requests.get(f"{REGISTRY}/{name}/{version}", timeout=5)
        if res.status_code != 200:
            return {}
        raw = res.json().get('dependencies', {})
        clean = {n: v.lstrip('^~>=<! ').split(' ')[0].strip() or 'latest' for n, v in raw.items()}
        with _cache_lock:
            # Evict oldest entries if adding would exceed max size
            while len(_cache) >= _MAX_CACHE_SIZE:
                oldest_key = min(_cache.keys(), key=lambda k: _cache[k]['ts'])
                del _cache[oldest_key]
            _cache[key] = {'data': clean, 'ts': time.time()}
        return clean
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout fetching npm deps for {name}@{version}: {e}")
        return {}
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error fetching npm deps for {name}@{version}: {e}")
        return {}
    except Exception as e:
        log.error(f"Error fetching npm deps for {name}@{version}: {e}")
        return {}

def _build_tree(name, version, dep_type, depth, max_depth, visited):
    # Validate package name and version
    try:
        validate_package_name(name)
    except ValueError:
        return {'name': name, 'version': version, 'type': dep_type, 'dependencies': [], 'vulnerabilities': []}
    
    try:
        validate_version(version)
    except ValueError:
        return {'name': name, 'version': version, 'type': dep_type, 'dependencies': [], 'vulnerabilities': []}
    
    if depth > max_depth:
        return {'name': name, 'version': version, 'type': dep_type, 'dependencies': [], 'vulnerabilities': []}

    deps_map   = _fetch_deps(name, version)
    child_items = [(n, v) for n, v in deps_map.items() if f"{n}@{v}" not in visited]
    visited    = visited | {f"{n}@{v}" for n, v in child_items}
    children   = []

    if child_items:
        with ThreadPoolExecutor(max_workers=4) as ex:
            futures = {ex.submit(_build_tree, n, v, 'transitive', depth + 1, max_depth, visited): (n, v) for n, v in child_items}
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
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(_build_tree, d['name'], d['version'], 'direct', 1, max_depth, {f"{d['name']}@{d['version']}"}): d for d in direct_deps}
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
            _collect_tree(dep['dependencies'], version_map, depth + 1, dep['name'])

def _resolve_conflicts(version_map):
    conflicts = []
    for pkg, entries in version_map.items():
        versions = list({e['version'] for e in entries})
        if len(versions) < 2:
            continue
        winner = min(entries, key=lambda x: (x['depth'], entries.index(x)))
        loser = next((e for e in entries if e['version'] != winner['version']), None)
        conflicts.append({
            'package': pkg,
            'requestedBy': [{'requester': e['requester'], 'version': e['version'], 'depth': e['depth'], 'safe': True} for e in entries],
            'selected': winner['version'],
            'loser': loser['version'] if loser else None,
            'reason': f"npm nearest-depth rule: {winner['requester']} requires {pkg}@{winner['version']} at depth {winner['depth']}.",
            'risk': None
        })
    return conflicts
