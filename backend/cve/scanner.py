from concurrent.futures import ThreadPoolExecutor, as_completed
from .osv_client import query_package as osv_query, format_vuln as osv_format
from .nvd_client import query_package as nvd_query

def scan_package(name, version, ecosystem):
    """Query OSV + NVD concurrently for a single package."""
    results = {}

    def fetch_osv():
        raw = osv_query(name, version, ecosystem)
        results = [osv_format(v, name, version) for v in raw]
        return [r for r in results if r is not None]  # filter non-affected versions

    def fetch_nvd():
        return nvd_query(name, version)

    with ThreadPoolExecutor(max_workers=2) as ex:
        futures = {'osv': ex.submit(fetch_osv), 'nvd': ex.submit(fetch_nvd)}
        for source, future in futures.items():
            try:
                results[source] = future.result()
            except Exception:
                results[source] = []

    # Merge: OSV is primary, NVD fills gaps
    merged = {v['cve_id']: v for v in results['osv']}
    for v in results['nvd']:
        if v['cve_id'] not in merged:
            merged[v['cve_id']] = v
        else:
            # Enrich OSV entry with NVD url if missing
            if not merged[v['cve_id']].get('nvd_url'):
                merged[v['cve_id']]['nvd_url'] = v.get('nvd_url')

    return list(merged.values())

def scan_tree(graph_deps, ecosystem, app_name='my-app'):
    """Recursively scan all nodes in the dependency tree."""
    all_vulns = []
    _scan_node(graph_deps, ecosystem, app_name, [app_name], all_vulns)
    return all_vulns

def _scan_node(deps, ecosystem, app_name, path, all_vulns):
    for dep in deps:
        current_path = path + [dep['name']]
        vulns = scan_package(dep['name'], dep['version'], ecosystem)
        for v in vulns:
            v['path'] = current_path
            v['root_cause'] = _build_root_cause(current_path, dep['type'])
        all_vulns.extend(vulns)
        dep['vulnerabilities'] = [{'cve_id': v['cve_id']} for v in vulns]
        if dep.get('dependencies'):
            _scan_node(dep['dependencies'], ecosystem, app_name, current_path, all_vulns)

def _build_root_cause(path, dep_type):
    if len(path) <= 2:
        return f"{path[-1]} is a direct dependency. The vulnerability is in the package itself."
    chain = ' → '.join(path[1:])
    return f"Introduced via {chain}. {path[1]} is the direct dependency that pulled this in transitively."
