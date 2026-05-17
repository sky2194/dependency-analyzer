import requests
import logging
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.circuit_breaker import CircuitBreaker, retry_with_backoff

log = logging.getLogger(__name__)

NVD_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0'

# Circuit breaker for NVD API
nvd_circuit_breaker = CircuitBreaker(failure_threshold=3, timeout=60, recovery_timeout=60)

@nvd_circuit_breaker.call
@retry_with_backoff(max_retries=1, base_delay=0.5, max_delay=3)
def get_cvss(cve_id):
    """Fetch CVSS score and severity from NVD for a specific CVE."""
    api_key = os.environ.get('NVD_API_KEY')
    headers = {'apiKey': api_key} if api_key else {}
    try:
        res = requests.get(NVD_URL, params={'cveId': cve_id}, headers=headers, timeout=5)
        if res.status_code == 200:
            items = res.json().get('vulnerabilities', [])
            if items:
                metrics = items[0].get('metrics', {})
                cvss_metrics = metrics.get('cvssMetricV31', []) or metrics.get('cvssMetricV30', [])
                if cvss_metrics:
                    cvss_data = cvss_metrics[0].get('cvssData', {})
                    return cvss_data.get('baseScore'), cvss_data.get('baseSeverity')
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout fetching NVD data for {cve_id}: {e}")
        return None, None
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error fetching NVD data for {cve_id}: {e}")
        return None, None
    except Exception as e:
        log.error(f"Error fetching NVD data for {cve_id}: {e}")
        return None, None
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
