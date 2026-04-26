from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
from collections import defaultdict
import os, time, hashlib

# ── Load .env ─────────────────────────────────────────────────────────────────
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
from resolvers.npm_resolver import resolve as resolve_npm
from resolvers.pypi_resolver import resolve as resolve_pypi
from resolvers.maven_resolver import resolve as resolve_maven
from cve.scanner import scan_tree
from export.pdf_export import generate_html_report
from export.csv_export import generate_csv
from parsers.lockfile_parser import parse as parse_lockfile
from resolvers.lockfile_resolver import resolve as resolve_lockfile
from cve.osv_client import query_package as osv_query, format_vuln as osv_format  # used in scan_tree

app = Flask(__name__)

# ── CORS — restrict to frontend origin only ───────────────────────────────────
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
CORS(app, origins=ALLOWED_ORIGINS)

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_CONTENT_SIZE  = 512 * 1024   # 512 KB max file size
RATE_LIMIT        = 10            # max requests per window
RATE_WINDOW       = 60            # seconds

# ── Rate limiter (in-memory) ──────────────────────────────────────────────────
_rate_store = defaultdict(list)

def get_client_id():
    """Identify client by IP."""
    return request.headers.get('X-Forwarded-For', request.remote_addr)

def rate_limited(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        client = get_client_id()
        now = time.time()
        # Clean old entries
        _rate_store[client] = [t for t in _rate_store[client] if now - t < RATE_WINDOW]
        if len(_rate_store[client]) >= RATE_LIMIT:
            retry_after = int(RATE_WINDOW - (now - _rate_store[client][0]))
            return jsonify({
                'error': f'Rate limit exceeded. You can make {RATE_LIMIT} requests per {RATE_WINDOW}s. Try again in {retry_after}s.'
            }), 429
        _rate_store[client].append(now)
        return f(*args, **kwargs)
    return decorated

# ── Input validation ──────────────────────────────────────────────────────────
def validate_content(content, filename):
    if not content or not content.strip():
        return 'No content provided', 400
    if len(content.encode('utf-8')) > MAX_CONTENT_SIZE:
        size_kb = len(content.encode('utf-8')) // 1024
        return f'File too large ({size_kb}KB). Maximum allowed size is 512KB.', 413
    # Basic format validation
    ecosystem = detect_ecosystem(filename)
    if ecosystem == 'npm' and not content.strip().startswith('{'):
        return 'Invalid package.json — must be valid JSON starting with {', 400
    if ecosystem == 'maven' and '<' not in content:
        return 'Invalid pom.xml — must be valid XML', 400
    return None, None

# ── CVE deduplication ─────────────────────────────────────────────────────────
def deduplicate_vulns(vulnerabilities):
    """
    Keep only the most specific (deepest path) occurrence of each CVE.
    If lodash appears as both direct and transitive with same CVE,
    keep the one with the longer path (more specific) and merge paths.
    """
    seen = {}  # cve_id+package -> best entry

    for vuln in vulnerabilities:
        key = f"{vuln['cve_id']}:{vuln['package']}"
        if key not in seen:
            seen[key] = vuln
        else:
            existing = seen[key]
            # Keep longer path (more specific/deeper)
            if len(vuln.get('path', [])) > len(existing.get('path', [])):
                # Preserve the shorter path as transitive_path
                vuln['transitive_path'] = existing.get('path')
                seen[key] = vuln
            else:
                # Add current path as transitive_path if not already set
                if not existing.get('transitive_path') and vuln.get('path') != existing.get('path'):
                    existing['transitive_path'] = vuln.get('path')

    return list(seen.values())

def detect_ecosystem(filename):
    if 'package-lock.json' in filename: return 'lockfile'
    if 'package.json' in filename: return 'npm'
    if filename.endswith('.txt') or 'requirements' in filename: return 'pypi'
    if filename.endswith('.xml') or 'pom' in filename: return 'maven'
    return 'npm'

PARSERS   = {'npm': parse_npm, 'pypi': parse_pypi, 'maven': parse_maven, 'lockfile': parse_lockfile}
RESOLVERS = {'npm': resolve_npm, 'pypi': resolve_pypi, 'maven': resolve_maven, 'lockfile': resolve_lockfile}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/api/analyze', methods=['POST'])
@rate_limited
def analyze():
    body     = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Invalid JSON body'}), 400

    content  = body.get('content', '')
    filename = body.get('filename', 'package.json')

    # Input validation
    error, status = validate_content(content, filename)
    if error:
        return jsonify({'error': error}), status

    ecosystem = detect_ecosystem(filename)

    try:
        parsed = PARSERS[ecosystem](content)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    project_name    = parsed.get('project_name', 'my-app')
    project_version = parsed.get('project_version', '1.0.0')
    direct_deps     = parsed.get('deps', [])

    if not direct_deps:
        return jsonify({'error': 'No dependencies found in file'}), 400

    warnings = [d['warning'] for d in direct_deps if d.get('warning')]

    graph_deps, mediation = RESOLVERS[ecosystem](direct_deps)

    # Scan + deduplicate CVEs
    vulnerabilities = scan_tree(graph_deps, ecosystem, project_name)
    vulnerabilities = deduplicate_vulns(vulnerabilities)

    # Sort by severity
    sev_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
    vulnerabilities.sort(key=lambda v: sev_order.get(v.get('severity', 'LOW'), 3))

    total = _count_packages(graph_deps)
    graph = {
        'name': project_name, 'version': project_version,
        'type': 'root', 'dependencies': graph_deps, 'vulnerabilities': []
    }

    return jsonify({
        'ecosystem': ecosystem,
        'project_name': project_name,
        'total_packages': total,
        'graph': graph,
        'mediation': mediation,
        'vulnerabilities': vulnerabilities,
        'warnings': warnings,
        'scan_timestamp': int(time.time()),
    })


@app.route('/api/cve/<cve_id>', methods=['GET'])
def get_cve(cve_id):
    # Validate CVE ID format
    import re
    if not re.match(r'^CVE-\d{4}-\d+$', cve_id):
        return jsonify({'error': 'Invalid CVE ID format'}), 400

    from cve.nvd_client import NVD_URL
    import requests as req
    api_key = os.environ.get('NVD_API_KEY')
    headers = {'apiKey': api_key} if api_key else {}
    try:
        res = req.get(NVD_URL, params={'cveId': cve_id}, headers=headers, timeout=10)
        if res.status_code == 200:
            items = res.json().get('vulnerabilities', [])
            if items:
                return jsonify(items[0]['cve'])
    except Exception:
        pass
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
        'status': 'ok',
        'version': '1.0.0',
        'nvd_api_key_configured': bool(os.environ.get('NVD_API_KEY')),
        'rate_limit': f"{RATE_LIMIT} requests per {RATE_WINDOW}s",
        'max_file_size': f"{MAX_CONTENT_SIZE // 1024}KB",
        'allowed_origins': ALLOWED_ORIGINS,
    })

def _count_packages(deps):
    return len(deps) + sum(_count_packages(d.get('dependencies', [])) for d in deps)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
