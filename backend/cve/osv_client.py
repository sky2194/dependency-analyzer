import requests
import re
from packaging.version import Version, InvalidVersion
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.circuit_breaker import CircuitBreaker, retry_with_backoff

log = logging.getLogger(__name__)

OSV_URL = 'https://api.osv.dev/v1'
ECOSYSTEM_MAP = {'npm': 'npm', 'pypi': 'PyPI', 'maven': 'Maven', 'lockfile': 'npm', 'npm-lock': 'npm'}

# Circuit breaker for OSV API
osv_circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60, recovery_timeout=30)

@osv_circuit_breaker.call
@retry_with_backoff(max_retries=1, base_delay=0.5, max_delay=3)
def query_package(name, version, ecosystem):
    eco = ECOSYSTEM_MAP.get(ecosystem, 'npm')
    try:
        res = requests.post(f"{OSV_URL}/query", json={
            'version': version,
            'package': {'name': name, 'ecosystem': eco}
        }, timeout=5)
        if res.status_code != 200:
            log.warning(f"OSV API returned {res.status_code} for {name}@{version}")
            return []
        return res.json().get('vulns', [])
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout querying OSV for {name}@{version}: {e}")
        return []
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error querying OSV for {name}@{version}: {e}")
        return []
    except Exception as e:
        log.error(f"Error querying OSV for {name}@{version}: {e}")
        return []

def _parse_ver(v):
    if not v or v == '0':
        return Version('0')
    try:
        return Version(v)
    except InvalidVersion:
        # Handle Maven versions like 2.3.0.RELEASE
        cleaned = re.sub(r'[._-]?(RELEASE|FINAL|GA|RC\d*|M\d*|SNAPSHOT)$', '', v, flags=re.I)
        try:
            return Version(cleaned)
        except InvalidVersion:
            return None

def _is_affected(installed_ver, affected):
    try:
        installed = _parse_ver(installed_ver)
        if not installed:
            return True
    except Exception:
        return True

    for a in affected:
        if installed_ver in a.get('versions', []):
            return True
        for r in a.get('ranges', []):
            if r.get('type') not in ('SEMVER', 'ECOSYSTEM'):
                continue
            introduced = fixed = None
            for ev in r.get('events', []):
                if 'introduced' in ev:
                    introduced = _parse_ver(ev['introduced'])
                if 'fixed' in ev:
                    fixed = _parse_ver(ev['fixed'])
            if introduced is not None and installed >= introduced:
                if fixed is None or installed < fixed:
                    return True
    return False

def _get_fix_version(installed_ver, affected):
    """Get correct fix version matching the installed version branch."""
    installed = _parse_ver(installed_ver)
    if not installed:
        return None

    candidates = []
    for a in affected:
        for r in a.get('ranges', []):
            if r.get('type') not in ('SEMVER', 'ECOSYSTEM'):
                continue
            introduced = fixed = None
            for ev in r.get('events', []):
                if 'introduced' in ev:
                    introduced = _parse_ver(ev['introduced'])
                if 'fixed' in ev:
                    fixed = _parse_ver(ev['fixed'])
            if introduced is not None and installed >= introduced:
                if fixed and installed < fixed:
                    candidates.append(fixed)
                # Also check for exact version matches in affected versions list
                for affected_ver in a.get('versions', []):
                    try:
                        av = _parse_ver(affected_ver)
                        if av and av > installed:
                            candidates.append(av)
                    except InvalidVersion:
                        pass

    if candidates:
        return str(min(candidates))

    # Fallback: find any fixed version mentioned across all ranges
    all_fixed = []
    for a in affected:
        for r in a.get('ranges', []):
            for ev in r.get('events', []):
                if 'fixed' in ev:
                    fv = _parse_ver(ev['fixed'])
                    if fv and fv > installed:
                        all_fixed.append(fv)
    return str(min(all_fixed)) if all_fixed else None

def _extract_cvss_score(score_str):
    """Extract numeric base score from CVSS vector string or plain number."""
    if not score_str:
        return None
    # Plain number: "9.8"
    try:
        return float(score_str)
    except ValueError:
        pass
    # CVSS vector: extract score after last colon in base metrics
    # Some OSV entries embed score as "CVSS:3.1/..." — no numeric score in string
    # Try to find pattern like "/9.8" or "BaseScore:9.8"
    match = re.search(r'(?:BaseScore[:/]|^)(\d+\.\d+)', score_str, re.I)
    if match:
        return float(match.group(1))
    return None

def _get_severity_cvss(vuln):
    # Try OSV severity field
    for sev in vuln.get('severity', []):
        score = _extract_cvss_score(sev.get('score', ''))
        if score is not None:
            if score >= 9.0: return 'CRITICAL', score
            if score >= 7.0: return 'HIGH', score
            if score >= 4.0: return 'MEDIUM', score
            return 'LOW', score

    # Fallback: database_specific severity
    db = vuln.get('database_specific', {})
    sev = db.get('severity', '').upper()
    if sev in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
        score_map = {'CRITICAL': 9.5, 'HIGH': 7.5, 'MEDIUM': 5.0, 'LOW': 2.0}
        return sev, score_map[sev]

    # Fallback: affected severity
    for a in vuln.get('affected', []):
        db2 = a.get('database_specific', {})
        sev2 = db2.get('severity', '').upper()
        if sev2 in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
            score_map = {'CRITICAL': 9.5, 'HIGH': 7.5, 'MEDIUM': 5.0, 'LOW': 2.0}
            return sev2, score_map[sev2]

    return 'MEDIUM', 0.0

def format_vuln(vuln, package, version):
    affected = vuln.get('affected', [])

    if not _is_affected(version, affected):
        return None

    fix_version = _get_fix_version(version, affected)
    severity, cvss_score = _get_severity_cvss(vuln)
    aliases = vuln.get('aliases', [])
    cve_id = next((a for a in aliases if a.startswith('CVE-')), vuln.get('id', 'UNKNOWN'))
    summary = vuln.get('summary', '') or (vuln.get('details', '') or '')[:200]

    return {
        'cve_id': cve_id,
        'source': 'OSV',
        'osv_id': vuln.get('id'),
        'package': package,
        'version': version,
        'severity': severity,
        'cvss_score': round(cvss_score, 1),
        'description': summary,
        'fix_version': fix_version,
        'fix': f">= {fix_version}" if fix_version else None,
        'osv_url': f"https://osv.dev/vulnerability/{vuln.get('id')}",
        'nvd_url': f"https://nvd.nist.gov/vuln/detail/{cve_id}" if cve_id.startswith('CVE-') else None,
    }
