"""
db_scanner.py — DB-first CVE lookup with live OSV fallback.
raw_osv column was dropped — version matching uses affected_versions list.
"""
import logging
import json
from packaging.version import Version, InvalidVersion

log = logging.getLogger(__name__)

def _parse_ver(v):
    if not v or v == "0":
        return Version("0")
    try:
        return Version(v)
    except InvalidVersion:
        import re
        cleaned = re.sub(r"[._-]?(RELEASE|FINAL|GA|RC\d*|M\d*|SNAPSHOT)$", "", v, flags=re.I)
        try:
            return Version(cleaned)
        except InvalidVersion:
            return None

def _is_version_affected(installed_ver, affected_versions):
    """
    Check if installed version is in the affected list stored at seed time.
    Conservative: if affected_versions is empty, assume affected.
    """
    if not affected_versions:
        return True
    return installed_ver in affected_versions

def query_db(name: str, version: str, ecosystem: str) -> list:
    """
    Query local DB for vulnerabilities affecting name@version.
    Returns list of vuln dicts, or None if DB unavailable (caller falls back to live API).
    """
    eco_map = {
        "npm": "npm", "pypi": "PyPI", "maven": "Maven", "gradle": "Maven",
        "lockfile": "npm", "npm-lock": "npm"
    }
    eco = eco_map.get(ecosystem, ecosystem)

    try:
        from db import get_conn, get_cursor
        with get_conn() as conn:
            with get_cursor(conn) as cur:
                cur.execute("""
                    SELECT osv_id, cve_id, severity, cvss_score, description,
                           fixed_version, osv_url, nvd_url, affected_versions
                    FROM vulnerabilities
                    WHERE ecosystem = %s AND package_name = %s
                """, (eco, name))
                rows = cur.fetchall()
    except Exception as e:
        log.warning(f"DB query failed for {name}@{version}: {e} — falling back to live API")
        return None

    results = []
    for row in rows:
        affected_versions = row["affected_versions"] or []
        if not _is_version_affected(version, affected_versions):
            continue
        results.append({
            "cve_id":      row["cve_id"] or row["osv_id"],
            "source":      "DB",
            "osv_id":      row["osv_id"],
            "package":     name,
            "version":     version,
            "severity":    row["severity"] or "MEDIUM",
            "cvss_score":  round(float(row["cvss_score"] or 0.0), 1),
            "description": row["description"] or "",
            "fix_version": row["fixed_version"],
            "fix":         f">= {row['fixed_version']}" if row["fixed_version"] else None,
            "osv_url":     row["osv_url"],
            "nvd_url":     row["nvd_url"],
        })
    return results
