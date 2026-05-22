from datetime import datetime
from io import BytesIO


def generate_pdf_bytes(data):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.colors import HexColor, white
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                    TableStyle, HRFlowable, PageBreak)
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate

    # ── Data ────────────────────────────────────────────────────────────────
    vulns      = data.get('vulnerabilities', [])
    summary    = data.get('summary', {})
    project    = data.get('project_name', 'Unknown')
    ecosystem  = data.get('ecosystem', '').upper()
    risk_score = summary.get('risk_score', 0)
    risk_label = summary.get('risk_label', 'Low').upper()
    total_pkgs = summary.get('total_packages', 0)
    scanned_at = datetime.now().strftime('%B %d, %Y  %H:%M')

    counts = {s: sum(1 for v in vulns if v.get('severity') == s)
              for s in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']}

    SEV_HEX = {'CRITICAL': 'dc2626', 'HIGH': 'c2410c', 'MEDIUM': '92400e', 'LOW': '15803d'}
    SEV_BG  = {'CRITICAL': 'fef2f2', 'HIGH': 'fff7ed', 'MEDIUM': 'fffbeb', 'LOW': 'f0fdf4'}
    RISK_HEX = SEV_HEX.get(risk_label, 'dc2626')

    # ── Styles ───────────────────────────────────────────────────────────────
    SANS = 'Helvetica'
    MONO = 'Courier'

    def ps(name, **kw):
        return ParagraphStyle(name, **kw)

    title_s   = ps('T',  fontName=SANS+'-Bold',  fontSize=16, textColor=HexColor('#0f172a'))
    sub_s     = ps('S',  fontName=SANS,           fontSize=9,  textColor=HexColor('#6b7280'))
    meta_s    = ps('M',  fontName=SANS,           fontSize=8,  textColor=HexColor('#374151'))
    sec_s     = ps('SC', fontName=SANS+'-Bold',   fontSize=9,  textColor=HexColor('#374151'),
                         spaceBefore=10, spaceAfter=4)
    th_s      = ps('TH', fontName=SANS+'-Bold',   fontSize=8,  textColor=HexColor('#374151'))
    mono_s    = ps('MO', fontName=MONO,           fontSize=8,  textColor=HexColor('#1e293b'),
                         wordWrap='CJK')
    path_s    = ps('PA', fontName=MONO,           fontSize=7,  textColor=HexColor('#9ca3af'),
                         wordWrap='CJK')
    fix_s     = ps('FX', fontName=MONO,           fontSize=8,  textColor=HexColor('#15803d'),
                         wordWrap='CJK')
    foot_s    = ps('FO', fontName=SANS,           fontSize=7,  textColor=HexColor('#9ca3af'),
                         alignment=TA_CENTER)
    risk_s    = ps('RS', fontName=MONO+'-Bold',   fontSize=24, textColor=HexColor("#" + RISK_HEX),
                         alignment=TA_RIGHT)
    risk_sub_s= ps('RL', fontName=SANS,           fontSize=8,  textColor=HexColor('#6b7280'),
                         alignment=TA_RIGHT)

    # ── Document with page numbers ───────────────────────────────────────────
    buf = BytesIO()
    PAGE_W, PAGE_H = A4
    LM = RM = 18*mm
    TM = BM = 16*mm
    W = PAGE_W - LM - RM

    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont(SANS, 7)
        canvas.setFillColor(HexColor('#9ca3af'))
        canvas.drawCentredString(PAGE_W/2, 10*mm,
            f'DepAnalyzer — Powered by OSV   |   {scanned_at}   |   Page {doc.page}')
        canvas.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=LM, rightMargin=RM,
                            topMargin=TM, bottomMargin=BM+6*mm,
                            onFirstPage=add_page_number,
                            onLaterPages=add_page_number)

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    hdr = Table([[
        [Paragraph('Dependency Analyzer', title_s),
         Spacer(1, 2),
         Paragraph('Security Composition Analysis Report', sub_s)],
        [Paragraph(f'{risk_score}/100', risk_s),
         Paragraph(f'RISK SCORE — {risk_label}', risk_sub_s)]
    ]], colWidths=[W*0.65, W*0.35])
    hdr.setStyle(TableStyle([
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(hdr)
    story.append(HRFlowable(width=W, thickness=1.5, color=HexColor('#e2e8f0'), spaceAfter=8))

    # ── Meta strip ───────────────────────────────────────────────────────────
    meta_items = [
        f'<b>Project</b><br/>{project}',
        f'<b>Ecosystem</b><br/>{ecosystem}',
        f'<b>Packages</b><br/>{total_pkgs}',
        f'<b>CVEs Found</b><br/>{len(vulns)}',
        f'<b>Scanned</b><br/>{scanned_at}',
    ]
    meta_tbl = Table([[Paragraph(m, meta_s) for m in meta_items]],
                     colWidths=[W/5]*5)
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), HexColor('#f8fafc')),
        ('BOX',           (0,0), (-1,-1), 0.5, HexColor('#e2e8f0')),
        ('INNERGRID',     (0,0), (-1,-1), 0.3, HexColor('#e2e8f0')),
        ('TOPPADDING',    (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('FONTSIZE',      (0,0), (-1,-1), 8),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 10))

    # ── Severity summary cards ────────────────────────────────────────────────
    sev_cards = [[
        Paragraph(
            f'<font size="22" color="#{SEV_HEX[s]}"><b>{counts[s]}</b></font><br/>'
            f'<font size="7" color="#6b7280">{s}</font>',
            ps(f'C{s}', alignment=TA_CENTER, fontName=MONO+'-Bold'))
        for s in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    ]]
    sev_tbl = Table(sev_cards, colWidths=[W/4]*4)
    sev_tbl.setStyle(TableStyle([
        ('BOX',           (0,0), (0,0), 1, HexColor('#fecaca')),
        ('BOX',           (1,0), (1,0), 1, HexColor('#fed7aa')),
        ('BOX',           (2,0), (2,0), 1, HexColor('#fde68a')),
        ('BOX',           (3,0), (3,0), 1, HexColor('#bbf7d0')),
        ('BACKGROUND',    (0,0), (0,0), HexColor('#fef2f2')),
        ('BACKGROUND',    (1,0), (1,0), HexColor('#fff7ed')),
        ('BACKGROUND',    (2,0), (2,0), HexColor('#fffbeb')),
        ('BACKGROUND',    (3,0), (3,0), HexColor('#f0fdf4')),
        ('TOPPADDING',    (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('INNERGRID',     (0,0), (-1,-1), 0, white),
    ]))
    story.append(sev_tbl)
    story.append(Spacer(1, 12))

    # ── Vulnerability table ───────────────────────────────────────────────────
    story.append(Paragraph(f'Vulnerabilities  ({len(vulns)})', sec_s))
    story.append(HRFlowable(width=W, thickness=0.5, color=HexColor('#e2e8f0'), spaceAfter=5))

    # Column widths - no path column (shown as sub-line in Package cell)
    col_w = [W*0.11, W*0.17, W*0.42, W*0.09, W*0.21]

    def sev_cell(sev):
        """Severity badge as colored text - no wrapping."""
        return Paragraph(
            f'<font color="#{SEV_HEX.get(sev,"6b7280")}"><b>{sev}</b></font>',
            ps(f'SB{sev}', fontName=SANS+'-Bold', fontSize=8, wordWrap='CJK'))

    def pkg_cell(v):
        """Package name + version on line 1, path on line 2."""
        pkg  = v.get('package_name', v.get('package', ''))
        ver  = v.get('installed_version', v.get('version', ''))
        path = ' > '.join(v.get('path', []))
        # Shorten path - remove first node (it's the project)
        parts = v.get('path', [])
        short_path = ' > '.join(parts[1:]) if len(parts) > 1 else path
        return Paragraph(
            f'<font size="8" color="#1e293b"><b>{pkg}</b></font>'
            f'<font size="7" color="#6b7280">  v{ver}</font><br/>'
            f'<font size="6" color="#9ca3af">{short_path}</font>',
            ps('PKG', fontName=MONO, fontSize=8, wordWrap='CJK', leading=10))

    def cvss_cell(v):
        sev  = v.get('severity', 'LOW')
        cvss = v.get('cvss_score')
        if not cvss or cvss == 0:
            return Paragraph('<font color="#9ca3af">N/A</font>',
                             ps('CV0', fontName=MONO, fontSize=8, alignment=TA_CENTER))
        return Paragraph(
            f'<font color="#{SEV_HEX.get(sev,"6b7280")}"><b>{cvss}</b></font>',
            ps('CV', fontName=MONO+'-Bold', fontSize=8, alignment=TA_CENTER))

    def fix_cell(v):
        fix = v.get('fix_version') or v.get('fix') or ''
        if not fix or fix == '—':
            return Paragraph('<font color="#9ca3af">No fix</font>',
                             ps('NF', fontName=SANS, fontSize=8))
        return Paragraph(
            f'<font color="#15803d"><b>{fix}</b></font>',
            ps('FV', fontName=MONO+'-Bold', fontSize=8, wordWrap='CJK'))

    # Header row
    rows = [[
        Paragraph('SEVERITY', th_s),
        Paragraph('CVE ID',   th_s),
        Paragraph('PACKAGE',  th_s),
        Paragraph('CVSS',     ps('TH2', fontName=SANS+'-Bold', fontSize=8,
                                        textColor=HexColor('#374151'), alignment=TA_CENTER)),
        Paragraph('FIX VERSION', th_s),
    ]]

    sorted_vulns = sorted(vulns,
        key=lambda x: ['CRITICAL','HIGH','MEDIUM','LOW'].index(x.get('severity','LOW'))
                      if x.get('severity','LOW') in ['CRITICAL','HIGH','MEDIUM','LOW'] else 4)

    row_styles = []
    for i, v in enumerate(sorted_vulns):
        sev = v.get('severity', 'LOW')
        bg  = SEV_BG.get(sev, 'ffffff')
        row_styles.append(('BACKGROUND', (0, i+1), (-1, i+1), HexColor('#' + bg)))
        rows.append([
            sev_cell(sev),
            Paragraph(v.get('cve_id', ''), mono_s),
            pkg_cell(v),
            cvss_cell(v),
            fix_cell(v),
        ])

    vuln_tbl = Table(rows, colWidths=col_w, repeatRows=1)
    vuln_tbl.setStyle(TableStyle([
        # Header
        ('BACKGROUND',    (0,0), (-1,0), HexColor('#f1f5f9')),
        ('LINEBELOW',     (0,0), (-1,0), 1.5, HexColor('#cbd5e1')),
        # Rows
        ('LINEBELOW',     (0,1), (-1,-1), 0.3, HexColor('#f1f5f9')),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 6),
        ('RIGHTPADDING',  (0,0), (-1,-1), 6),
        # Left accent border on severity column
        ('ROWBACKGROUNDS',(0,0), (-1,-1), [HexColor('#ffffff'), HexColor('#f8fafc')]),
    ] + row_styles))

    story.append(vuln_tbl)
    story.append(Spacer(1, 8))

    doc.build(story)
    return buf.getvalue()


def generate_html_report(data):
    """Kept for import compatibility."""
    return '<html><body>Use /api/export/pdf for PDF.</body></html>'
