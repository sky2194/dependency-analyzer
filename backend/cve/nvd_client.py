import requests
import os

NVD_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0'

def get_cvss(cve_id):
    """Fetch CVSS score and severity from NVD for a specific CVE."""
    api_key = os.environ.get('NVD_API_KEY')
    headers = {'apiKey': api_key} if api_key else {}
    try:
        res = requests.get(NVD_URL, params={'cveId': cve_id}, headers=headers, timeout=8)
        if res.status_code != 200:
            return None, None
        items = res.json().get('vulnerabilities', [])
        if not items:
            return None, None
        cve = items[0]['cve']
        metrics = cve.get('metrics', {})
        for key in ['cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']:
            if key in metrics and metrics[key]:
                m = metrics[key][0]
                score = m.get('cvssData', {}).get('baseScore', 0.0)
                sev = m.get('cvssData', {}).get('baseSeverity', '').upper()
                return float(score), sev if sev in ('CRITICAL','HIGH','MEDIUM','LOW') else None
    except Exception:
        pass
    return None, None

def format_vuln(cve_data, package, version):
    cve_id = cve_data.get('id', 'UNKNOWN')
    descriptions = cve_data.get('descriptions', [])
    desc = next((d['value'] for d in descriptions if d['lang'] == 'en'), 'No description.')
    metrics = cve_data.get('metrics', {})
    cvss_score, severity = 0.0, 'MEDIUM'
    for key in ['cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']:
        if key in metrics and metrics[key]:
            m = metrics[key][0]
            cvss_score = float(m.get('cvssData', {}).get('baseScore', 0.0))
            s = m.get('cvssData', {}).get('baseSeverity', '').upper()
            if s in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
                severity = s
            break
    return {
        'cve_id': cve_id, 'package': package, 'version': version,
        'severity': severity, 'cvss_score': cvss_score,
        'description': desc[:300], 'fix': 'Check NVD for fix.',
        'nvd_url': f"https://nvd.nist.gov/vuln/detail/{cve_id}", 'osv_url': None,
    }
