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

def _parse_version(v):
    try:
        return Version('0') if v == '0' else Version(v)
    except InvalidVersion:
        return None

def _is_affected(installed_ver, affected):
    try:
        installed = Version(installed_ver)
    except InvalidVersion:
        return True  # assume affected if unparseable

    for a in affected:
        # Check exact versions list first
        if installed_ver in a.get('versions', []):
            return True
        # Check ranges
        for r in a.get('ranges', []):
            if r.get('type') not in ('SEMVER', 'ECOSYSTEM'):
                continue
            introduced, fixed = None, None
            for event in r.get('events', []):
                if 'introduced' in event:
                    introduced = _parse_version(event['introduced'])
                if 'fixed' in event:
                    fixed = _parse_version(event['fixed'])
            if introduced is not None and installed >= introduced:
                if fixed is None or installed < fixed:
                    return True
    return False

def _get_fix_version(installed_ver, affected):
    """Get correct fix version for the installed version branch."""
    try:
        installed = Version(installed_ver)
    except InvalidVersion:
        return None

    candidates = []
    for a in affected:
        for r in a.get('ranges', []):
            if r.get('type') not in ('SEMVER', 'ECOSYSTEM'):
                continue
            introduced, fixed = None, None
            for event in r.get('events', []):
                if 'introduced' in event:
                    introduced = _parse_version(event['introduced'])
                if 'fixed' in event:
                    fixed = _parse_version(event['fixed'])
            # Range covers our version → this fixed version is relevant
            if introduced is not None and installed >= introduced:
                if fixed and installed < fixed:
                    candidates.append(fixed)

    # Return the smallest fix version that covers our installed version
    return str(min(candidates)) if candidates else None

def _get_severity_cvss(vuln):
    """Extract severity and CVSS from OSV, falling back to database_specific."""
    for sev in vuln.get('severity', []):
        score_str = sev.get('score', '')
        try:
            # CVSS vector string like "CVSS:3.1/AV:N/AC:L/..."
            if score_str.startswith('CVSS'):
                # Extract base score from vector — last number after last /
                parts = score_str.split('/')
                # Try to find numeric score in aliases or database_specific
                pass
            score = float(score_str.split('/')[0]) if '/' not in score_str[:10] else None
            if score:
                if score >= 9.0: return 'CRITICAL', score
                if score >= 7.0: return 'HIGH', score
                if score >= 4.0: return 'MEDIUM', score
                return 'LOW', score
        except Exception:
            pass

    # Fallback to database_specific severity
    db = vuln.get('database_specific', {})
    sev = db.get('severity', '').upper()
    if sev in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
        # Map severity to typical CVSS midpoint
        score_map = {'CRITICAL': 9.5, 'HIGH': 7.5, 'MEDIUM': 5.0, 'LOW': 2.0}
        return sev, score_map[sev]

    return 'MEDIUM', 0.0

def format_vuln(vuln, package, version):
    affected = vuln.get('affected', [])

    # Only report if this version is actually affected
    if not _is_affected(version, affected):
        return None

    fix_version = _get_fix_version(version, affected)
    fix = f">= {fix_version}" if fix_version else None

    severity, cvss_score = _get_severity_cvss(vuln)
    aliases = vuln.get('aliases', [])
    cve_id = next((a for a in aliases if a.startswith('CVE-')), vuln.get('id', 'UNKNOWN'))
    summary = vuln.get('summary', '') or vuln.get('details', '')[:200]

    return {
        'cve_id': cve_id,
        'osv_id': vuln.get('id'),
        'package': package,
        'version': version,
        'severity': severity,
        'cvss_score': cvss_score,
        'description': summary,
        'fix_version': fix_version,  # raw version string
        'fix': fix,                  # ">= X.Y.Z" or None
        'osv_url': f"https://osv.dev/vulnerability/{vuln.get('id')}",
        'nvd_url': f"https://nvd.nist.gov/vuln/detail/{cve_id}" if cve_id.startswith('CVE-') else None,
    }
