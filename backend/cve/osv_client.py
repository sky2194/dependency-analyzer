import requests
from packaging.version import Version, InvalidVersion

OSV_URL = 'https://api.osv.dev/v1'
ECOSYSTEM_MAP = {'npm': 'npm', 'pypi': 'PyPI', 'maven': 'Maven', 'lockfile': 'npm', 'npm-lock': 'npm'}

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

def _version_in_range(installed_ver, ranges):
    """Check if installed version falls within any affected range."""
    try:
        installed = Version(installed_ver)
    except InvalidVersion:
        return True  # can't parse, assume affected

    for r in ranges:
        r_type = r.get('type', '')
        if r_type not in ('SEMVER', 'ECOSYSTEM'):
            continue
        introduced = None
        fixed = None
        for event in r.get('events', []):
            if 'introduced' in event:
                try: introduced = Version(event['introduced']) if event['introduced'] != '0' else Version('0')
                except InvalidVersion: pass
            if 'fixed' in event:
                try: fixed = Version(event['fixed'])
                except InvalidVersion: pass
        if introduced is not None and installed >= introduced:
            if fixed is None or installed < fixed:
                return True
    return False

def _get_fix_for_version(installed_ver, affected):
    """Get the correct fix version for the installed version branch."""
    try:
        installed = Version(installed_ver)
    except InvalidVersion:
        return None

    best_fix = None
    for a in affected:
        for r in a.get('ranges', []):
            if r.get('type') not in ('SEMVER', 'ECOSYSTEM'):
                continue
            introduced = None
            fixed = None
            for event in r.get('events', []):
                if 'introduced' in event:
                    try:
                        v = event['introduced']
                        introduced = Version('0') if v == '0' else Version(v)
                    except InvalidVersion:
                        pass
                if 'fixed' in event:
                    try: fixed = Version(event['fixed'])
                    except InvalidVersion: pass

            # This range covers our installed version
            if introduced is not None and installed >= introduced:
                if fixed is None or installed < fixed:
                    if fixed and (best_fix is None or fixed < Version(best_fix)):
                        best_fix = str(fixed)

    return best_fix

def format_vuln(vuln, package, version):
    affected = vuln.get('affected', [])

    # Filter: only include if installed version is actually affected
    is_affected = False
    for a in affected:
        pkg_match = a.get('package', {}).get('name', '').lower() == package.lower()
        if not pkg_match:
            continue
        ranges = a.get('ranges', [])
        versions_list = a.get('versions', [])
        if version in versions_list:
            is_affected = True
            break
        if _version_in_range(version, ranges):
            is_affected = True
            break

    if not is_affected and affected:
        return None  # Not affected at this version

    # Get correct fix version for installed version branch
    fix_version = _get_fix_for_version(version, affected)
    fix = f"Upgrade to >= {fix_version}" if fix_version else "No fix available yet — check OSV for updates."

    severity = _get_severity(vuln)
    cvss = _get_cvss(vuln)
    aliases = vuln.get('aliases', [])
    cve_id = next((a for a in aliases if a.startswith('CVE-')), vuln.get('id', 'UNKNOWN'))
    summary = vuln.get('summary', vuln.get('details', 'No description available.')[:200])

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
