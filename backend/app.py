from flask import Flask, request, jsonify, g
from flask_cors import CORS
from functools import wraps
from collections import defaultdict
import os
import sys
import uuid
import logging
import copy
import time

# Ensure backend directory is in Python path for local imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ.setdefault(key.strip(), val.strip())
load_env()

from parsers.npm_parser import parse as parse_npm
from parsers.pypi_parser import parse as parse_pypi
from parsers.maven_parser import parse as parse_maven
from parsers.lockfile_parser import parse as parse_lockfile
from resolvers.npm_resolver import resolve as resolve_npm
from resolvers.pypi_resolver import resolve as resolve_pypi
from resolvers.maven_resolver import resolve as resolve_maven
from resolvers.lockfile_resolver import resolve as resolve_lockfile
from cve.scanner import scan_tree
from export.pdf_export import generate_html_report
from export.csv_export import generate_csv

app = Flask(__name__)

def parse_allowed_origins():
    origins = os.environ.get(
        'ALLOWED_ORIGINS',
        'https://dependency-analyzer-sky2194s-projects.vercel.app,https://dependency-analyzer-eight.vercel.app,http://localhost:3000,http://localhost:5173'
    )
    return [origin.strip().rstrip('/') for origin in origins.split(',') if origin.strip()]

ALLOWED_ORIGINS = parse_allowed_origins()
ALLOW_VERCEL_PREVIEWS = os.environ.get('ALLOW_VERCEL_PREVIEWS', 'true').lower() == 'true'
CORS(app, origins=ALLOWED_ORIGINS, allow_headers=['Content-Type'], methods=['GET', 'POST', 'OPTIONS'])

MAX_CONTENT_SIZE = 512 * 1024
RATE_LIMIT       = 20
RATE_WINDOW      = 60
MAX_DIRECT_DEPS  = 50

# Abstract rate limiter interface
class RateLimiter:
    def __init__(self, use_redis=False):
        self.use_redis = use_redis
        if use_redis:
            try:
                import redis
                self.redis = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379'))
                self.redis.ping()
            except Exception as e:
                log.warning(f"Redis unavailable, falling back to in-memory rate limiting: {e}")
                self.use_redis = False
                self._store = defaultdict(list)
        else:
            self._store = defaultdict(list)
    
    def is_allowed(self, client_id):
        now = time.time()
        if self.use_redis:
            key = f"rate_limit:{client_id}"
            try:
                pipe = self.redis.pipeline()
                pipe.zremrangebyscore(key, 0, now - RATE_WINDOW)
                pipe.zcard(key)
                pipe.zadd(key, {str(now): now})
                pipe.expire(key, RATE_WINDOW)
                results = pipe.execute()
                count = results[1]
                return count < RATE_LIMIT, RATE_LIMIT - count if count >= RATE_LIMIT else None
            except Exception as e:
                log.error(f"Redis rate limit error: {e}")
                return True, None
        else:
            # In-memory fallback
            self._store[client_id] = [t for t in self._store[client_id] if now - t < RATE_WINDOW]
            if len(self._store[client_id]) >= RATE_LIMIT:
                retry = int(RATE_WINDOW - (now - self._store[client_id][0]))
                return False, retry
            self._store[client_id].append(now)
            return True, None

_rate_limiter = RateLimiter(use_redis=os.environ.get('USE_REDIS_RATE_LIMIT', 'false').lower() == 'true')

def get_client_id():
    return request.headers.get('X-Forwarded-For', request.remote_addr)

def is_origin_allowed(origin):
    if not origin:
        return False
    origin = origin.rstrip('/')
    if '*' in ALLOWED_ORIGINS or origin in ALLOWED_ORIGINS:
        return True
    return ALLOW_VERCEL_PREVIEWS and origin.startswith('https://') and origin.endswith('.vercel.app')

def rate_limited(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        client = get_client_id()
        allowed, retry_after = _rate_limiter.is_allowed(client)
        if not allowed:
            return jsonify({'error': f'Rate limit exceeded. Try again in {retry_after}s.'}), 429
        return f(*args, **kwargs)
    return decorated

def request_id_middleware(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        g.request_id = request_id
        log.info(f"Request {request_id}: {request.method} {request.path}")
        response = f(*args, **kwargs)
        if hasattr(response, 'headers'):
            response.headers['X-Request-ID'] = request_id
        return response
    return decorated

def detect_ecosystem(filename):
    if 'package-lock.json' in filename: return 'npm-lock'
    if 'package.json' in filename:      return 'npm'
    if filename.endswith('.txt') or 'requirements' in filename: return 'pypi'
    if filename.endswith('.xml') or 'pom' in filename: return 'maven'
    return 'npm'

def filename_for_ecosystem(ecosystem):
    return {
        'npm': 'package.json',
        'npm-lock': 'package-lock.json',
        'pypi': 'requirements.txt',
        'maven': 'pom.xml',
    }.get(ecosystem, 'package.json')

def validate_content(content, filename):
    if not content or not content.strip():
        return 'No content provided', 400
    if len(content.encode('utf-8')) > MAX_CONTENT_SIZE:
        return f'File too large ({len(content.encode())//1024}KB). Max 512KB.', 413
    eco = detect_ecosystem(filename)
    if eco == 'npm' and not content.strip().startswith('{'):
        return 'Invalid package.json — must be valid JSON', 400
    if eco == 'maven' and '<' not in content:
        return 'Invalid pom.xml — must contain XML', 400
    return None, None

def deduplicate_vulns(vulnerabilities):
    seen = {}
    for v in vulnerabilities:
        # Use CVE ID as the unique key (same CVE can affect multiple packages, but we want to track per-package)
        key = f"{v['cve_id'].lower()}:{v['package'].lower()}"
        if key not in seen:
            seen[key] = v
        else:
            existing = seen[key]
            # Keep the entry with the shorter path (closer to root) and merge paths
            if len(v.get('path', [])) < len(existing.get('path', [])):
                v['all_paths'] = [existing.get('path', []), v.get('path', [])]
                seen[key] = v
            else:
                existing['all_paths'] = [v.get('path', []), existing.get('path', [])]
    return list(seen.values())

def group_vulns_by_package(vulnerabilities):
    from packaging.version import Version, InvalidVersion
    sev_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
    groups = {}
    for v in vulnerabilities:
        key = f"{v['package']}@{v['version']}"
        if key not in groups:
            groups[key] = {'package': v['package'], 'version': v['version'], 'cves': [],
                           'highest_severity': 'LOW', 'recommended_fix': None,
                           'path': v.get('path', []), 'root_cause': v.get('root_cause', '')}
        g = groups[key]
        g['cves'].append(v)
        if sev_order.get(v['severity'], 3) < sev_order.get(g['highest_severity'], 3):
            g['highest_severity'] = v['severity']
        fv = v.get('fix_version')
        if fv:
            try:
                if g['recommended_fix'] is None or Version(fv) > Version(g['recommended_fix']):
                    g['recommended_fix'] = fv
            except InvalidVersion:
                pass

    result = sorted(groups.values(), key=lambda g: sev_order.get(g['highest_severity'], 3))
    for g in result:
        g['cves'].sort(key=lambda v: sev_order.get(v['severity'], 3))
    return result


def _build_all_packages(graph_deps, grouped_vulns):
    """Build complete package list with vulnerability info for each package."""
    vuln_map = {}
    for g in grouped_vulns:
        key = f"{g['package']}@{g['version']}"
        vuln_map[key] = g

    # Track which packages are direct (top-level only)
    direct_names = set()
    for dep in graph_deps:
        if dep.get('type') == 'direct':
            direct_names.add(dep.get('name'))

    all_pkgs = []
    visited = set()
    
    def walk(deps, depth=0):
        for dep in deps:
            key = f"{dep.get('name')}@{dep.get('version')}"
            if key in visited:
                continue
            visited.add(key)
            # Only top-level deps (depth 0) can be direct
            is_direct = depth == 0 and dep.get('name') in direct_names
            g = vuln_map.get(key)
            if g:
                all_pkgs.append({
                    'package': g['package'],
                    'version': g['version'],
                    'vulnerabilities': g['cves'],
                    'highestSeverity': g['highest_severity'],
                    'recommended_fix': g['recommended_fix'],
                    'is_direct': is_direct,
                })
            else:
                all_pkgs.append({
                    'package': dep.get('name'),
                    'version': dep.get('version'),
                    'vulnerabilities': [],
                    'highestSeverity': None,
                    'recommended_fix': None,
                    'is_direct': is_direct,
                })
            walk(dep.get('dependencies', []), depth + 1)
    
    walk(graph_deps)
    # Sort: vulnerable first (by severity), then secure
    sev_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, None: 99}
    all_pkgs.sort(key=lambda p: sev_order.get(p['highestSeverity'], 99))
    return all_pkgs

def _count_packages(deps, visited=None):
    """Count packages with cycle detection to prevent infinite recursion."""
    if visited is None:
        visited = set()
    
    count = 0
    for dep in deps:
        dep_key = f"{dep.get('name')}@{dep.get('version')}"
        if dep_key in visited:
            log.warning(f"Cycle detected: {dep_key} already visited")
            continue
        visited.add(dep_key)
        count += 1
        count += _count_packages(dep.get('dependencies', []), visited)
    return count

def add_ui_aliases(vulnerabilities):
    for v in vulnerabilities:
        v.setdefault('package_name', v.get('package'))
        v.setdefault('installed_version', v.get('version'))
        v.setdefault('recommended_fix', v.get('fix_version') or v.get('fix'))
    return vulnerabilities

PARSERS   = {'npm': parse_npm, 'pypi': parse_pypi, 'maven': parse_maven, 'npm-lock': parse_lockfile}
RESOLVERS = {'npm': resolve_npm, 'pypi': resolve_pypi, 'maven': resolve_maven, 'npm-lock': resolve_lockfile}

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin', '')
    if is_origin_allowed(origin):
        response.headers['Access-Control-Allow-Origin'] = origin.rstrip('/')
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Vary'] = 'Origin'
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

def run_analysis(body):
    if request.content_length and request.content_length > MAX_CONTENT_SIZE * 2:
        return jsonify({'error': 'Request too large (max 512KB)'}), 413

    content  = body.get('content', '')
    filename = body.get('filename') or filename_for_ecosystem(body.get('ecosystem', 'npm'))

    error, status = validate_content(content, filename)
    if error:
        return jsonify({'error': error}), status

    ecosystem = detect_ecosystem(filename)

    # Auto-detect npm lock-file shape from content
    if ecosystem == 'npm':
        try:
            import json as _json
            probe = _json.loads(content)
            if 'lockfileVersion' in probe or ('packages' in probe and isinstance(probe['packages'], dict)):
                ecosystem = 'npm-lock'
        except Exception:
            pass

    try:
        parsed = PARSERS[ecosystem](content)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    project_name = parsed.get('project_name', 'my-app')
    direct_deps  = parsed.get('deps', [])

    if not direct_deps:
        return jsonify({'error': 'No dependencies found'}), 400
    if len(direct_deps) > MAX_DIRECT_DEPS:
        return jsonify({'error': f'Too many dependencies (max {MAX_DIRECT_DEPS})'}), 400

    warnings = [d['warning'] for d in direct_deps if d.get('warning')]

    try:
        graph_deps, mediation = RESOLVERS[ecosystem](direct_deps, max_depth=2)
    except Exception as e:
        log.error(f"Resolver error: {e}")
        return jsonify({'error': 'Failed to resolve dependencies'}), 500

    try:
        vulnerabilities = scan_tree(graph_deps, ecosystem, project_name, max_depth=2)
    except Exception as e:
        log.error(f"Scan error: {e}")
        return jsonify({'error': 'Scan failed'}), 500

    vulnerabilities = add_ui_aliases(deduplicate_vulns(vulnerabilities))
    vulnerabilities.sort(key=lambda v: {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}.get(v.get('severity', 'LOW'), 3))

    graph = {'name': project_name, 'version': parsed.get('project_version', '1.0.0'),
             'type': 'root', 'dependencies': graph_deps, 'vulnerabilities': []}

    # Generate transaction_id for session isolation
    transaction_id = str(uuid.uuid4())
    
    # Calculate consistent package count with cycle detection
    total_packages = _count_packages(graph_deps)
    
    # Calculate vulnerability counts for clarity
    grouped_vulns = group_vulns_by_package(vulnerabilities)
    
    log.info(f"Scan complete: {project_name} ({ecosystem}) — {len(vulnerabilities)} raw vulns, {len(grouped_vulns)} grouped in {total_packages} packages")

    # Calculate risk score with logarithmic scaling to prevent capping at 100
    counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
    for v in vulnerabilities:
        sev = v.get('severity', 'LOW')
        if sev in counts:
            counts[sev] += 1
    
    # Use logarithmic scale: more vulns = higher score, but diminishing returns
    import math
    crit_impact = 40 * (1 - math.exp(-counts['CRITICAL'] / 3)) if counts['CRITICAL'] > 0 else 0
    high_impact = 30 * (1 - math.exp(-counts['HIGH'] / 5)) if counts['HIGH'] > 0 else 0
    med_impact = 20 * (1 - math.exp(-counts['MEDIUM'] / 8)) if counts['MEDIUM'] > 0 else 0
    low_impact = 10 * (1 - math.exp(-counts['LOW'] / 10)) if counts['LOW'] > 0 else 0
    
    risk_score = min(100, round(crit_impact + high_impact + med_impact + low_impact))
    
    # Calculate risk label for frontend display
    if risk_score >= 90:
        risk_label = 'Critical'
    elif risk_score >= 70:
        risk_label = 'High'
    elif risk_score >= 40:
        risk_label = 'Medium'
    elif risk_score >= 1:
        risk_label = 'Low'
    else:
        risk_label = 'Secure'

    # Calculate priority fix count (critical + high severity)
    priority_fix_count = counts['CRITICAL'] + counts['HIGH']
    
    # Calculate secure package count
    secure_package_count = total_packages - len(grouped_vulns)
    
    # Calculate vulnerable package count
    vulnerable_package_count = len(grouped_vulns)

    # Calculate vulnerable package counts by type
    all_packages = _build_all_packages(graph_deps, grouped_vulns)
    vulnerable_direct_count = len([p for p in all_packages if p.get('vulnerabilities') and len(p['vulnerabilities']) > 0 and p.get('is_direct')])
    vulnerable_transitive_count = len([p for p in all_packages if p.get('vulnerabilities') and len(p['vulnerabilities']) > 0 and not p.get('is_direct')])

    # Build immutable transaction snapshot with canonical data contract
    scan_result = {
        'transaction_id': transaction_id,
        'snapshot_version': 1,
        'status': 'COMPLETED',
        'ecosystem': 'npm' if ecosystem == 'npm-lock' else ecosystem,
        'project_name': project_name,
        'summary': {
            'risk_score': risk_score,
            'risk_label': risk_label,
            'total_packages': total_packages,
            'direct_dependencies': len([d for d in direct_deps if d.get('type') != 'transitive']),
            'transitive_dependencies': total_packages - len([d for d in direct_deps if d.get('type') != 'transitive']),
            'vulnerabilities': len(vulnerabilities),
            'critical': counts['CRITICAL'],
            'high': counts['HIGH'],
            'medium': counts['MEDIUM'],
            'low': counts['LOW'],
            'secure_package_count': total_packages - len(grouped_vulns),
            'vulnerable_package_count': len(grouped_vulns),
            'vulnerable_direct_count': vulnerable_direct_count,
            'vulnerable_transitive_count': vulnerable_transitive_count,
            'priority_fix_count': counts['CRITICAL'] + counts['HIGH'],
        },
        'grouped_packages': all_packages,
        'fixes': [v for v in vulnerabilities if v.get('fix_version')],
        'vulnerabilities': copy.deepcopy(vulnerabilities),
        'graph': copy.deepcopy(graph),
        'dependency_tree': copy.deepcopy(graph),
        'scan_timestamp': int(time.time()),
    }
    
    return jsonify(copy.deepcopy(scan_result))

@app.route('/api/scan', methods=['POST'])
@rate_limited
def scan():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Invalid JSON body'}), 400
    return run_analysis(body)

@app.route('/api/scan-package', methods=['POST'])
@rate_limited
@request_id_middleware
def scan_package_deep():
    """Deep scan a specific package including its transitive dependencies."""
    body = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Invalid JSON body'}), 400
    
    package_name = body.get('package')
    package_version = body.get('version')
    ecosystem = body.get('ecosystem', 'npm')
    
    if not package_name:
        return jsonify({'error': 'package name required'}), 400
    
    # Validate package name
    try:
        from utils.validation import validate_package_name
        validate_package_name(package_name)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    
    if package_version:
        try:
            from utils.validation import validate_version
            validate_version(package_version)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
    
    try:
        # Build dependency tree with depth=2 to get transitive dependencies
        from resolvers.npm_resolver import resolve as npm_resolve
        from resolvers.pypi_resolver import resolve as pypi_resolve
        from resolvers.maven_resolver import resolve as maven_resolve
        
        RESOLVERS = {'npm': npm_resolve, 'pypi': pypi_resolve, 'maven': maven_resolve}
        
        direct_deps = [{'name': package_name, 'version': package_version or 'latest', 'pinned': bool(package_version)}]
        graph_deps, mediation = RESOLVERS[ecosystem](direct_deps, max_depth=2)
        
        # Scan with depth=2 to include transitive dependencies
        vulnerabilities = scan_tree(graph_deps, ecosystem, package_name, max_depth=2)
        vulnerabilities = add_ui_aliases(deduplicate_vulns(vulnerabilities))
        vulnerabilities.sort(key=lambda v: {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}.get(v.get('severity', 'LOW'), 3))
        
        graph = {'name': package_name, 'version': package_version or 'latest',
                 'type': 'root', 'dependencies': graph_deps, 'vulnerabilities': []}
        
        log.info(f"Deep scan complete: {package_name} ({ecosystem}) — {len(vulnerabilities)} vulns in {_count_packages(graph_deps)} packages")
        
        # Calculate risk score using same logarithmic model as /api/scan
        import math
        counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        for v in vulnerabilities:
            sev = v.get('severity', 'LOW')
            if sev in counts:
                counts[sev] += 1
        crit_impact = 40 * (1 - math.exp(-counts['CRITICAL'] / 3)) if counts['CRITICAL'] > 0 else 0
        high_impact = 30 * (1 - math.exp(-counts['HIGH']     / 5)) if counts['HIGH']     > 0 else 0
        med_impact  = 20 * (1 - math.exp(-counts['MEDIUM']   / 8)) if counts['MEDIUM']   > 0 else 0
        low_impact  = 10 * (1 - math.exp(-counts['LOW']      /10)) if counts['LOW']      > 0 else 0
        risk_score  = min(100, round(crit_impact + high_impact + med_impact + low_impact))
        risk_label  = 'Critical' if risk_score >= 90 else 'High' if risk_score >= 70 else 'Medium' if risk_score >= 40 else 'Low'

        # Build grouped_packages to satisfy frontend contract
        grouped_vulns = group_vulns_by_package(vulnerabilities)
        grouped_packages = []
        for pkg_name_key, pkg_vulns in grouped_vulns.items():
            sevs = [v.get('severity', 'LOW') for v in pkg_vulns]
            highest = next((s for s in ['CRITICAL','HIGH','MEDIUM','LOW'] if s in sevs), 'LOW')
            grouped_packages.append({
                'package': pkg_name_key,
                'version': pkg_vulns[0].get('installed_version', ''),
                'is_direct': True,
                'vulnerabilities': pkg_vulns,
                'highestSeverity': highest,
                'recommended_fix': next((v.get('fix_version') for v in pkg_vulns if v.get('fix_version')), None),
            })

        # Build fixes list
        fixes = []
        seen_fix = set()
        for v in vulnerabilities:
            p = v.get('package_name', v.get('package', ''))
            if v.get('fix_version') and p not in seen_fix:
                seen_fix.add(p)
                fixes.append(v)

        vuln_direct     = len(grouped_vulns)
        vuln_transitive = 0

        return jsonify({
            'transaction_id': str(uuid.uuid4()),
            'snapshot_version': 1,
            'status': 'COMPLETED',
            'ecosystem': ecosystem,
            'project_name': package_name,
            'summary': {
                'risk_score': risk_score,
                'risk_label': risk_label,
                'total_packages': _count_packages(graph_deps),
                'direct_dependencies': len([d for d in direct_deps if d.get('type') != 'transitive']),
                'transitive_dependencies': _count_packages(graph_deps) - len([d for d in direct_deps if d.get('type') != 'transitive']),
                'vulnerabilities': len(vulnerabilities),
                'critical': counts['CRITICAL'],
                'high': counts['HIGH'],
                'medium': counts['MEDIUM'],
                'low': counts['LOW'],
                'secure_package_count': _count_packages(graph_deps) - len(grouped_vulns),
                'vulnerable_package_count': len(grouped_vulns),
                'vulnerable_direct_count': vuln_direct,
                'vulnerable_transitive_count': vuln_transitive,
                'priority_fix_count': counts['CRITICAL'] + counts['HIGH'],
            },
            'grouped_packages': grouped_packages,
            'fixes': fixes,
            'vulnerabilities': vulnerabilities,
            'graph': graph,
            'dependency_tree': graph,
            'scan_timestamp': int(time.time()),
        })
    except Exception as e:
        log.error(f"Deep scan error: {e}")
        return jsonify({'error': f'Deep scan failed: {str(e)}'}), 500

@app.route('/api/cve/<cve_id>', methods=['GET'])
def get_cve(cve_id):
    import re, requests as req
    if not re.match(r'^CVE-\d{4}-\d+$', cve_id):
        return jsonify({'error': 'Invalid CVE ID format'}), 400
    from cve.nvd_client import NVD_URL
    api_key = os.environ.get('NVD_API_KEY')
    headers = {'apiKey': api_key} if api_key else {}
    try:
        res = req.get(NVD_URL, params={'cveId': cve_id}, headers=headers, timeout=10)
        if res.status_code == 200:
            items = res.json().get('vulnerabilities', [])
            if items:
                return jsonify(items[0]['cve'])
    except Exception as e:
        log.error(f"CVE lookup error: {e}")
    return jsonify({'error': 'CVE not found'}), 404

@app.route('/api/export/pdf', methods=['POST'])
@rate_limited
def export_pdf():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    from flask import Response
    from export.pdf_export import generate_pdf_bytes
    try:
        pdf_bytes = generate_pdf_bytes(data)
        filename  = f"sca-report-{data.get('project_name','report')}.pdf"
        return Response(pdf_bytes,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="{filename}"',
                     'Content-Length': len(pdf_bytes)})
    except Exception as e:
        log.error(f"PDF export error: {e}")
        return jsonify({'error': f'PDF generation failed: {str(e)}'}), 500

@app.route('/api/export/csv', methods=['POST'])
@rate_limited
def export_csv():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    from flask import Response
    csv_data = generate_csv(data)
    return Response(csv_data, mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=sca-report-{data.get("project_name","report")}.csv'})

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok', 'version': '1.0.0',
        'nvd_api_key_configured': bool(os.environ.get('NVD_API_KEY')),
        'rate_limit': f"{RATE_LIMIT} requests per {RATE_WINDOW}s",
        'max_file_size': f"{MAX_CONTENT_SIZE // 1024}KB",
        'allowed_origins': ALLOWED_ORIGINS,
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)
