from datetime import datetime

def generate_html_report(data):
    vulns = data.get('vulnerabilities', [])
    counts = {s: sum(1 for v in vulns if v.get('severity') == s) for s in ['CRITICAL','HIGH','MEDIUM','LOW']}
    sev_colors = {'CRITICAL':'#dc2626','HIGH':'#ea580c','MEDIUM':'#ca8a04','LOW':'#2563eb'}
    vuln_rows = ''.join(f"""<tr>
      <td><span style="color:{sev_colors.get(v.get('severity','LOW'),'#6b7280')};font-weight:700">{v.get('severity','')}</span></td>
      <td style="font-family:monospace">{v.get('cve_id','')}</td>
      <td>{v.get('package','')}@{v.get('version','')}</td>
      <td style="font-size:12px;color:#555">{' → '.join(v.get('path',[]))}</td>
      <td style="font-size:12px">{v.get('fix','')}</td></tr>""" for v in vulns)

    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>SCA Report — {data.get('project_name','')}</title>
<style>body{{font-family:system-ui;margin:40px;color:#111}}h1{{font-size:24px;margin-bottom:4px}}.meta{{color:#666;font-size:13px;margin-bottom:24px}}.summary{{display:flex;gap:16px;margin-bottom:32px}}.card{{border:1px solid #e5e7eb;border-radius:8px;padding:16px 24px;text-align:center}}.card .num{{font-size:32px;font-weight:700}}table{{width:100%;border-collapse:collapse;font-size:13px}}th{{background:#f9fafb;padding:10px;text-align:left;border-bottom:2px solid #e5e7eb}}td{{padding:10px;border-bottom:1px solid #f3f4f6;vertical-align:top}}@media print{{body{{margin:20px}}}}</style>
</head><body>
<h1>🔐 Dependency Analyzer — Scan Report</h1>
<div class="meta">Project: <strong>{data.get('project_name','')}</strong> | Ecosystem: <strong>{data.get('ecosystem','').upper()}</strong> | Packages: <strong>{data.get('total_packages',0)}</strong> | Scanned: <strong>{datetime.now().strftime('%Y-%m-%d %H:%M')}</strong></div>
<div class="summary">
  <div class="card"><div class="num" style="color:#dc2626">{len(vulns)}</div><div>Vulnerabilities</div></div>
  <div class="card"><div class="num" style="color:#dc2626">{counts['CRITICAL']}</div><div>Critical</div></div>
  <div class="card"><div class="num" style="color:#ea580c">{counts['HIGH']}</div><div>High</div></div>
  <div class="card"><div class="num" style="color:#ca8a04">{counts['MEDIUM']}</div><div>Medium</div></div>
  <div class="card"><div class="num" style="color:#2563eb">{counts['LOW']}</div><div>Low</div></div>
</div>
<table><thead><tr><th>Severity</th><th>CVE ID</th><th>Package</th><th>Path</th><th>Fix</th></tr></thead>
<tbody>{vuln_rows}</tbody></table>
</body></html>"""
