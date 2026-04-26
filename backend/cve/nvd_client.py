import requests
import os

NVD_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0'

def query_package(name, version):
    """Query NVD for CVEs matching a package name."""
    api_key = os.environ.get('NVD_API_KEY')
    headers = {'apiKey': api_key} if api_key else {}
    try:
        res = requests.get(NVD_URL, params={
            'keywordSearch': name,
            'resultsPerPage': 20,
        }, headers=headers, timeout=10)
        if res.status_code != 200:
            return []
        items = res.json().get('vulnerabilities', [])
        return [format_vuln(item['cve'], name, version) for item in items]
    except Exception:
        return []

def format_vuln(cve, package, version):
    cve_id = cve.get('id', 'UNKNOWN')
    descriptions = cve.get('descriptions', [])
    desc = next((d['value'] for d in descriptions if d['lang'] == 'en'), 'No description.')
    metrics = cve.get('metrics', {})
    cvss_score = 0.0
    severity = 'MEDIUM'
    for key in ['cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']:
        if key in metrics and metrics[key]:
            m = metrics[key][0]
            cvss_score = m.get('cvssData', {}).get('baseScore', 0.0)
            severity = m.get('cvssData', {}).get('baseSeverity', 'MEDIUM').upper()
            break
    return {
        'cve_id': cve_id,
        'package': package,
        'version': version,
        'severity': severity,
        'cvss_score': cvss_score,
        'description': desc[:300],
        'fix': 'Check NVD for fix recommendations.',
        'nvd_url': f"https://nvd.nist.gov/vuln/detail/{cve_id}",
        'osv_url': None,
    }
