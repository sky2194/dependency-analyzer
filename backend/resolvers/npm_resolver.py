import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import time

REGISTRY   = 'https://registry.npmjs.org'
_cache     = {}
_cache_lock = Lock()
_CACHE_TTL  = 3600  # 1 hour

def _fetch_deps(name, version):
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
            _cache[key] = {'data': clean, 'ts': time.time()}
        return clean
    except Exception:
        return {}

def _build_tree(name, version, dep_type, depth, max_depth, visited):
    if depth > max_depth:
        return {'name': name, 'version': version, 'type': dep_type, 'dependencies': [], 'vulnerabilities': []}

    deps_map   = _fetch_deps(name, version)
    child_items = [(n, v) for n, v in deps_map.items() if f"{n}@{v}" not in visited]
    visited    = visited | {f"{n}@{v}" for n, v in child_items}
    children   = []

    if child_items:
        with ThreadPoolExecutor(max_workers=3) as ex:
            futures = {ex.submit(_build_tree, n, v, 'transitive', depth + 1, max_depth, visited): (n, v) for n, v in child_items}
            for future in as_completed(futures):
                try:
                    children.append(future.result())
                except Exception:
                    n, v = futures[future]
                    children.append({'name': n, 'version': v, 'type': 'transitive', 'dependencies': [], 'vulnerabilities': []})

    return {'name': name, 'version': version, 'type': dep_type, 'dependencies': children, 'vulnerabilities': []}

def resolve(direct_deps, max_depth=2):
    graph_deps = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {ex.submit(_build_tree, d['name'], d['version'], 'direct', 1, max_depth, {f"{d['name']}@{d['version']}"}): d for d in direct_deps}
        for future in as_completed(futures):
            try:
                graph_deps.append(future.result())
            except Exception:
                d = futures[future]
                graph_deps.append({'name': d['name'], 'version': d['version'], 'type': 'direct', 'dependencies': [], 'vulnerabilities': []})
    return graph_deps, []
