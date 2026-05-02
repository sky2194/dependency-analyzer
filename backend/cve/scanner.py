from concurrent.futures import ThreadPoolExecutor, as_completed
from .osv_client import query_package as osv_query, format_vuln as osv_format
from .nvd_client import get_cvss

# DigitalOcean 1GB RAM - increased from Render free tier limits
MAX_SCAN_WORKERS = 4
MAX_NVD_WORKERS  = 3

def scan_package(name, version, ecosystem):
    try:
        raw = osv_query(name, version, ecosystem)
        vulns = [osv_format(v, name, version) for v in raw]
        vulns = [v for v in vulns if v is not None]

        # Enrich missing CVSS scores from NVD in parallel
        def enrich(v):
            if v['cvss_score'] == 0.0 and v['cve_id'].startswith('CVE-'):
                nvd_score, nvd_sev = get_cvss(v['cve_id'])
                if nvd_score:
                    v['cvss_score'] = nvd_score
                if nvd_sev:
                    v['severity'] = nvd_sev
            return v

        with ThreadPoolExecutor(max_workers=MAX_NVD_WORKERS) as ex:
            vulns = list(ex.map(enrich, vulns))

        return vulns
    except Exception:
        return []

def scan_tree(graph_deps, ecosystem, app_name='my-app'):
    all_vulns = []
    _scan_node(graph_deps, ecosystem, [app_name], all_vulns)
    return all_vulns

def _scan_node(deps, ecosystem, path, all_vulns):
    def scan_dep(dep):
        current_path = path + [dep['name']]
        vulns = scan_package(dep['name'], dep['version'], ecosystem)
        for v in vulns:
            v['path'] = current_path
            v['root_cause'] = _build_root_cause(current_path, dep.get('type', 'transitive'))
        dep['vulnerabilities'] = [{'cve_id': v['cve_id']} for v in vulns]
        return vulns, dep.get('dependencies', []), current_path

    with ThreadPoolExecutor(max_workers=MAX_SCAN_WORKERS) as ex:
        futures = [ex.submit(scan_dep, dep) for dep in deps]
        for future in as_completed(futures):
            try:
                vulns, children, current_path = future.result()
                all_vulns.extend(vulns)
                if children:
                    _scan_node(children, ecosystem, current_path, all_vulns)
            except Exception:
                pass

def _build_root_cause(path, dep_type):
    if len(path) <= 2:
        return f"{path[-1]} is a direct dependency. The vulnerability is in the package itself."
    chain = ' → '.join(path[1:])
    return f"Introduced via {chain}. {path[1]} is the direct dependency that pulled this in transitively."