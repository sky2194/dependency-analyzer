import requests
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import logging

log = logging.getLogger(__name__)

MAVEN_REPO = 'https://repo1.maven.org/maven2'
MAVEN_SEARCH = 'https://search.maven.org/solrsearch/select'
_cache = {}
_cache_lock = Lock()
_CACHE_TTL = 3600
_MAX_CACHE_SIZE = 500

def _fetch_deps(group, artifact, version):
    key = f"{group}:{artifact}:{version}"
    with _cache_lock:
        if key in _cache:
            return _cache[key]
    if version in ('unknown', 'latest', ''):
        return {}
    try:
        path = f"{group.replace('.','/')}/{artifact}/{version}/{artifact}-{version}.pom"
        res = requests.get(f"{MAVEN_REPO}/{path}", timeout=5)
        if res.status_code != 200:
            return {}
        root = ET.fromstring(res.content)
        deps = {}
        for dep in root.iter('dependency'):
            scope = dep.findtext('scope') or 'compile'
            if scope in ('test', 'provided', 'system'):
                continue
            g = dep.findtext('groupId') or ''
            a = dep.findtext('artifactId') or ''
            v = dep.findtext('version') or 'unknown'
            if '${' in v:
                v = 'unknown'
            deps[f"{g}:{a}"] = {'group': g, 'artifact': a, 'version': v}
        with _cache_lock:
            _cache[key] = deps
            # Evict oldest entries if cache exceeds max size
            while len(_cache) >= _MAX_CACHE_SIZE:
                oldest_key = next(iter(_cache))
                del _cache[oldest_key]
        return deps
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout fetching Maven deps for {group}:{artifact}@{version}: {e}")
        return {}
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error fetching Maven deps for {group}:{artifact}@{version}: {e}")
        return {}
    except Exception as e:
        log.error(f"Error fetching Maven deps for {group}:{artifact}@{version}: {e}")
        return {}

def _build_tree(name, version, dep_type, depth, max_depth, visited):
    if depth > max_depth:
        return {'name': name, 'version': version, 'type': dep_type, 'dependencies': [], 'vulnerabilities': []}

    parts = name.split(':')
    group = parts[0] if len(parts) > 1 else name
    artifact = parts[1] if len(parts) > 1 else name

    deps_map = _fetch_deps(group, artifact, version)
    children = []
    child_items = [(n, d['version']) for n, d in deps_map.items() if f"{n}@{d['version']}" not in visited]
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
        winner = min(entries, key=lambda x: (x['depth'], entries.index(x)))
        conflicts.append({
            'package': pkg,
            'requestedBy': [{'requester': e['requester'], 'version': e['version'], 'depth': e['depth'], 'safe': True} for e in entries],
            'selected': winner['version'],
            'loser': next((e['version'] for e in entries if e['version'] != winner['version']), None),
            'reason': f"Maven nearest-depth rule: {winner['requester']} requires {pkg}@{winner['version']} at depth {winner['depth']}.",
            'risk': None
        })
    return conflicts
