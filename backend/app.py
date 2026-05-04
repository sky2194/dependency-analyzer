from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
from collections import defaultdict
import os, time, logging

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

ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'https://dependency-analyzer-eight.vercel.app,http://localhost:3000').split(',')
CORS(app, origins=ALLOWED_ORIGINS, allow_headers=['Content-Type'], methods=['GET', 'POST', 'OPTIONS'])

MAX_CONTENT_SIZE = 512 * 1024
RATE_LIMIT       = 30
RATE_WINDOW      = 60
MAX_DIRECT_DEPS  = 50

_rate_store = defaultdict(list)

def get_client_id():
    return request.headers.get('X-Forwarded-For', request.remote_addr)

def rate_limited(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        client = get_client_id()
        now = time.time()
        _rate_store[client] = [t for t in _rate_store[client] if now - t < RATE_WINDOW]
        if len(_rate_store[client]) >= RATE_LIMIT:
            retry = int(RATE_WINDOW - (now - _rate_store[client][0]))
            return jsonify({'error': f'Rate limit exceeded. Try again in {retry}s.'}), 429
        _rate_store[client].append(now)
        return f(*args, **kwargs)
    return decorated

def detect_ecosystem(filename):
    if 'package-lock.json' in filename: return 'npm-lock'
    if 'package.json' in filename:      return 'npm'
    if filename.endswith('.txt') or 'requirements' in filename: return 'pypi'
    if filename.endswith('.xml') or 'pom' in filename: return 'maven'
    return 'npm'

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
        key = f"{v['cve_id']}:{v['package']}:{v.get('version','')}"
        if key not in seen:
            seen[key] = v
        else:
            existing = seen[key]
            if len(v.get('path', [])) < len(existing.get('path', [])):
                v['transitive_path'] = existing.get('path')
                seen[key] = v
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

def _count_packages(deps):
    return len(deps) + sum(_count_packages(d.get('dependencies', [])) for d in deps)

PARSERS   = {'npm': parse_npm, 'pypi': parse_pypi, 'maven': parse_maven, 'npm-lock': parse_lockfile}
RESOLVERS = {'npm': resolve_npm, 'pypi': resolve_pypi, 'maven': resolve_maven, 'npm-lock': resolve_lockfile}

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS or '*' in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response

@app.route('/api/analyze', methods=['POST'])
@rate_limited
def analyze():
    if request.content_length and request.content_length > MAX_CONTENT_SIZE * 2:
        return jsonify({'error': 'Request too large (max 512KB)'}), 413

    body = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Invalid JSON body'}), 400

    content  = body.get('content', '')
    filename = body.get('filename', 'package.json')

    error, status = validate_content(content, filename)
    if error:
        return jsonify({'error': error}), status

    ecosystem = detect_ecosystem(filename)

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
        graph_deps, mediation = RESOLVERS[ecosystem](direct_deps)
    except Exception as e:
        log.error(f"Resolver error: {e}")
        return jsonify({'error': 'Failed to resolve dependencies'}), 500

    try:
        vulnerabilities = scan_tree(graph_deps, ecosystem, project_name)
    except Exception as e:
        log.error(f"Scan error: {e}")
        return jsonify({'error': 'Scan failed'}), 500

    vulnerabilities = deduplicate_vulns(vulnerabilities)
    vulnerabilities.sort(key=lambda v: {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}.get(v.get('severity', 'LOW'), 3))

    graph = {'name': project_name, 'version': parsed.get('project_version', '1.0.0'),
             'type': 'root', 'dependencies': graph_deps, 'vulnerabilities': []}

    log.info(f"Scan complete: {project_name} ({ecosystem}) — {len(vulnerabilities)} vulns in {_count_packages(graph_deps)} packages")

    return jsonify({
        'ecosystem': 'npm' if ecosystem == 'npm-lock' else ecosystem,
        'project_name': project_name,
        'total_packages': _count_packages(graph_deps),
        'graph': graph,
        'mediation': mediation,
        'vulnerabilities': vulnerabilities,
        'warnings': warnings,
        'scan_timestamp': int(time.time()),
        'grouped_vulnerabilities': group_vulns_by_package(vulnerabilities),
    })

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
    html = generate_html_report(data)
    return Response(html, mimetype='text/html',
        headers={'Content-Disposition': f'attachment; filename=sca-report-{data.get("project_name","report")}.html'})

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
