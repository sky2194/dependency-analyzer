import requests

OSV_URL = 'https://api.osv.dev/v1'

ECOSYSTEM_MAP = {'npm': 'npm', 'pypi': 'PyPI', 'maven': 'Maven', 'lockfile': 'npm'}

def query_package(name, version, ecosystem):
    eco = ECOSYSTEM_MAP.get(ecosystem, 'npm')
    try:
        res = requests.post(f"{OSV_URL}/query", json={
            'version': version,
            'package': {'name': name, 'ecosystem': eco}
        }, timeout=8)
        if res.status_code != 200:
            return []
        return res.json().get('vulns', [])
    except Exception:
        return []

def format_vuln(vuln, package, version):
    severity = _get_severity(vuln)
    cvss = _get_cvss(vuln)
    aliases = vuln.get('aliases', [])
    cve_id = next((a for a in aliases if a.startswith('CVE-')), vuln.get('id', 'UNKNOWN'))
    summary = vuln.get('summary', vuln.get('details', 'No description available.')[:200])
    affected = vuln.get('affected', [{}])
    fix_versions = []
    for a in affected:
        for r in a.get('ranges', []):
            for event in r.get('events', []):
                if 'fixed' in event:
                    fix_versions.append(event['fixed'])
    fix = f"Upgrade to >= {fix_versions[0]}" if fix_versions else "Check OSV for fix recommendations."
    return {
        'cve_id': cve_id,
        'osv_id': vuln.get('id'),
        'package': package,
        'version': version,
        'severity': severity,
        'cvss_score': cvss,
        'description': summary,
        'fix': fix,
        'osv_url': f"https://osv.dev/vulnerability/{vuln.get('id')}",
        'nvd_url': f"https://nvd.nist.gov/vuln/detail/{cve_id}" if cve_id != 'UNKNOWN' else None,
    }

def _get_severity(vuln):
    for sev in vuln.get('severity', []):
        score_str = sev.get('score', '')
        try:
            score = float(score_str.split('/')[0]) if '/' in score_str else float(score_str)
            if score >= 9.0: return 'CRITICAL'
            if score >= 7.0: return 'HIGH'
            if score >= 4.0: return 'MEDIUM'
            return 'LOW'
        except Exception:
            pass
    # fallback from database_specific
    db = vuln.get('database_specific', {})
    sev = db.get('severity', '').upper()
    if sev in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
        return sev
    return 'MEDIUM'

def _get_cvss(vuln):
    for sev in vuln.get('severity', []):
        score_str = sev.get('score', '')
        try:
            return float(score_str.split('/')[0]) if '/' in score_str else float(score_str)
        except Exception:
            pass
    return 0.0
