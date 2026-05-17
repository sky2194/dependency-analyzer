from concurrent.futures import ThreadPoolExecutor, as_completed
from .osv_client import query_package as osv_query, format_vuln as osv_format
from .nvd_client import get_cvss
import time
import requests
from collections import deque
import logging

log = logging.getLogger(__name__)

# ============================================================================
# PRIMARY VULNERABILITY SOURCE CONFIGURATION
# ============================================================================
# Currently only OSV is supported as primary source
# NVD is used for CVSS score enrichment when OSV returns 0.0
# PRIMARY_VULN_SOURCE = 'OSV'  # OSV is the only supported primary source currently
# ============================================================================

# DigitalOcean 1GB RAM - optimized for 1CPU/1GB droplet with NVD API key
MAX_SCAN_WORKERS = 8
MAX_NVD_WORKERS  = 6
_CACHE_TTL = 3600
_MAX_CACHE_SIZE = 1000

# LRU cache for scan results with size limit
_scan_cache = {}

def _get_cached_scan(name, version, ecosystem):
    key = f"{ecosystem}:{name}@{version}"
    entry = _scan_cache.get(key)
    if entry and time.time() - entry['ts'] < _CACHE_TTL:
        return entry['data']
    return None

def _set_cached_scan(name, version, ecosystem, data):
    key = f"{ecosystem}:{name}@{version}"
    _scan_cache[key] = {'data': data, 'ts': time.time()}
    # Evict oldest if cache is too large
    if len(_scan_cache) > _MAX_CACHE_SIZE:
        oldest_key = min(_scan_cache.keys(), key=lambda k: _scan_cache[k]['ts'])
        del _scan_cache[oldest_key]

def scan_package(name, version, ecosystem):
    # Check cache first
    cached = _get_cached_scan(name, version, ecosystem)
    if cached:
        return cached

    # ============================================================================
    # PRIMARY VULNERABILITY SOURCE CONFIGURATION
    # ============================================================================
    # To change primary source, swap the blocks below:
    # - Option 1: OSV as primary (current) - faster, no API key needed
    # - Option 2: NVD as primary - requires API key, slower but more comprehensive
    # ============================================================================

    try:
        # OSV as primary source
        raw = osv_query(name, version, ecosystem)
        vulns = [osv_format(v, name, version) for v in raw]
        vulns = [v for v in vulns if v is not None]

        # Enrich missing CVSS scores from NVD
        needs_enrichment = [v for v in vulns if v['cvss_score'] == 0.0 and v['cve_id'].startswith('CVE-')]
        if needs_enrichment:
            def enrich(v):
                nvd_score, nvd_sev = get_cvss(v['cve_id'])
                if nvd_score:
                    v['cvss_score'] = nvd_score
                    v['source'] = 'OSV+NVD'
                if nvd_sev:
                    v['severity'] = nvd_sev
                return v

            with ThreadPoolExecutor(max_workers=MAX_NVD_WORKERS) as ex:
                enriched = list(ex.map(enrich, needs_enrichment))
                for i, v in enumerate(vulns):
                    if v in needs_enrichment:
                        idx = needs_enrichment.index(v)
                        vulns[i] = enriched[idx]

        # Cache the result
        _set_cached_scan(name, version, ecosystem, vulns)

        return vulns
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout scanning {name}@{version}: {e}")
        return []
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error scanning {name}@{version}: {e}")
        return []
    except ValueError as e:
        log.warning(f"Data format error scanning {name}@{version}: {e}")
        return []
    except Exception as e:
        log.error(f"Unexpected error scanning {name}@{version}: {e}")
        return []

def scan_tree(graph_deps, ecosystem, app_name='my-app', max_depth=2):
    """
    Scan dependency tree using queue-based traversal to avoid nested ThreadPoolExecutors.
    This prevents thread exhaustion and ensures bounded concurrency.
    """
    all_vulns = []
    scan_queue = deque()
    
    # Initialize queue with root dependencies
    for dep in graph_deps:
        scan_queue.append((dep, [app_name], 0))
    
    # Process queue with bounded concurrency
    with ThreadPoolExecutor(max_workers=MAX_SCAN_WORKERS) as executor:
        while scan_queue:
            # Batch process current level
            batch = []
            batch_size = min(len(scan_queue), MAX_SCAN_WORKERS)
            for _ in range(batch_size):
                if scan_queue:
                    batch.append(scan_queue.popleft())
            
            # Submit batch to executor
            futures = []
            for dep, path, depth in batch:
                future = executor.submit(_scan_dep, dep, path, depth, max_depth, ecosystem)
                futures.append((future, dep, path))
            
            # Collect results and add children to queue
            for future, dep, path in futures:
                try:
                    vulns, children, current_path = future.result()
                    all_vulns.extend(vulns)
                    # Add children to queue for next level
                    for child in children:
                        scan_queue.append((child, current_path, depth + 1))
                except requests.exceptions.RequestException as e:
                    log.warning(f"Network error scanning {dep.get('name')}: {e}")
                except ValueError as e:
                    log.warning(f"Data error scanning {dep.get('name')}: {e}")
                except Exception as e:
                    log.error(f"Error scanning {dep.get('name')}: {e}")
    
    return all_vulns

def _scan_dep(dep, path, depth, max_depth, ecosystem):
    """Scan a single dependency and return vulnerabilities, children, and path."""
    current_path = path + [dep['name']]
    vulns = scan_package(dep['name'], dep['version'], ecosystem)
    for v in vulns:
        v['path'] = current_path
        v['root_cause'] = _build_root_cause(current_path, dep.get('type', 'transitive'))
        v['dependency_type'] = dep.get('type', 'transitive')
        v['is_direct'] = dep.get('type') == 'direct'
    
    # Attach full vuln data for frontend graph
    dep['vulnerabilities'] = [{
        'cve_id': v.get('cve_id'),
        'severity': v.get('severity'),
        'cvss_score': v.get('cvss_score'),
        'fix_version': v.get('fix_version'),
        'source': v.get('source'),
    } for v in vulns]
    
    children = []
    if depth < max_depth:
        children = dep.get('dependencies', [])
    
    return vulns, children, current_path

def _build_root_cause(path, dep_type):
    if len(path) <= 2:
        return f"{path[-1]} is a direct dependency. The vulnerability is in the package itself."
    chain = ' → '.join(path[1:])
    return f"Introduced via {chain}. {path[1]} is the direct dependency that pulled this in transitively."
