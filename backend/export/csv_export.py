import csv, io

def generate_csv(data):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['CVE ID','Severity','CVSS','Package','Version','Path','Root Cause','Fix','NVD URL','OSV URL'])
    for v in data.get('vulnerabilities', []):
        writer.writerow([v.get('cve_id',''), v.get('severity',''), v.get('cvss_score',''),
            v.get('package',''), v.get('version',''), ' → '.join(v.get('path',[])),
            v.get('root_cause',''), v.get('fix',''), v.get('nvd_url',''), v.get('osv_url','')])
    return output.getvalue()
