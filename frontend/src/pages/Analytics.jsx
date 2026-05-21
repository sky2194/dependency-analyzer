import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import API_BASE from '../config'
import DependencyGraph from '../components/DependencyGraph'
import validateContract from '../utils/validateSnapshot'
import { generateFixAllScript } from '../utils/fixAll'
import { saveProjectScan } from '../utils/projectStore'
import normalizeSnapshot from '../utils/normalizeSnapshot'

const SEV_COLOR = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' }
const SEV_DIM   = { CRITICAL: 'var(--red-dim)', HIGH: 'var(--yellow-dim)', MEDIUM: 'var(--blue-dim)', LOW: 'var(--green-dim)' }
const SEV_ICON  = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }

// Accessible severity badge — icon + label, never color alone
const SevBadge = ({ sev, style = {} }) => {
  if (!sev) return null
  const s = sev.toUpperCase()
  return (
    <span className="sev-badge" style={{ background: SEV_DIM[s], color: SEV_COLOR[s], display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      <span role="img" aria-hidden="true">{SEV_ICON[s]}</span>
      {s}
    </span>
  )
}

const pkgName = v => v?.package_name || v?.package || ''
const pkgVersion = v => v?.installed_version || v?.version || ''
const fixText = v => v?.fix_version ? `Upgrade to v${v.fix_version}` : (v?.fix || 'No fix available')
const installCmd = (v, eco = 'npm') => {
  if (!v?.fix_version) return ''
  if (eco === 'pypi') return `pip install ${pkgName(v)}==${v.fix_version}`
  if (eco === 'maven') return `${pkgName(v)} -> ${v.fix_version}`
  return `npm install ${pkgName(v)}@${v.fix_version}`
}

const PAGE_SIZE = 20

export default function Analytics() {
  const { state: locationState } = useLocation()
  const navigate = useNavigate()
  const [tab, setTab] = useState('vulns')
  const [sevFilter, setSevFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [copied, setCopied] = useState(null)
  const [pkgPage, setPkgPage] = useState(1)
  const [pkgSearch, setPkgSearch] = useState('')
  const [showRiskModal, setShowRiskModal] = useState(false)
  const exportRef = useRef(null)
  
  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }
  
  const result = locationState?.result


  // Auto-save scan to project history
  useEffect(() => {
    if (result?.summary && result?.project_name) {
      try {
        saveProjectScan(result.project_name, result)
      } catch (error) {
        console.error('Failed to save scan to history:', error)
      }
    }
  }, [result])
  useEffect(() => {
    const h = e => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // exportStatus must be above all conditional returns (React hook rules)
  const [exportStatus, setExportStatus] = useState(null) // 'loading' | 'error' | 'success'

  if (!result) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>No scan result found.</p>
        <button onClick={() => navigate('/scan')} className="a-btn-primary">Go to Scanner</button>
      </div>
    )
  }

  let snapshot
  try {
    validateContract(Object.freeze(result))
    snapshot = normalizeSnapshot(result)
  } catch (error) {
    return (
      <div style={{ textAlign: 'center', padding: 80, margin: 20, background: 'var(--bg-card)', border: '1px solid var(--critical)', borderRadius: 12 }}>
        <h2 style={{ color: 'var(--critical)', marginBottom: 12 }}>Contract Error</h2>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{error.message}</p>
        <button onClick={() => navigate('/scan')} className="a-btn-primary" style={{ marginTop: 16 }}>Back to Scanner</button>
      </div>
    )
  }

  const groupedPackages = snapshot.grouped_packages || []
  const vulns = snapshot.vulnerabilities || []
  const sm = snapshot.summary
  const riskScore = sm.risk_score
  const riskLabel = sm.risk_label
  const totalPkgs = sm.total_packages
  const directDeps = sm.direct_dependencies
  const transitiveDeps = sm.transitive_dependencies
  const totalVulns = sm.vulnerabilities
  const counts = { CRITICAL: sm.critical, HIGH: sm.high, MEDIUM: sm.medium, LOW: sm.low }

  const vulnPackages = (groupedPackages || []).filter(g => g.vulnerabilities && g.vulnerabilities.length > 0)
  const safePackages = (groupedPackages || []).filter(g => !g.vulnerabilities || g.vulnerabilities.length === 0)
  const filteredVulnPkgs = sevFilter === 'ALL' ? vulnPackages : vulnPackages.filter(g => g.vulnerabilities.some(v => v.severity === sevFilter))
  const selectedVuln = vulns.find(v => v.cve_id === selected)

  const searchedPkgs = pkgSearch ? (groupedPackages || []).filter(g => g.package?.toLowerCase().includes(pkgSearch.toLowerCase())) : (groupedPackages || [])
  const pkgPages = Math.ceil(searchedPkgs.length / PAGE_SIZE)
  const pagedPkgs = searchedPkgs.slice((pkgPage - 1) * PAGE_SIZE, pkgPage * PAGE_SIZE)

  const fixes = []
  if (snapshot.fixes && Array.isArray(snapshot.fixes)) {
    const seen = new Set()
    snapshot.fixes.forEach(v => { const p = pkgName(v); if (!seen.has(p)) { seen.add(p); fixes.push(v) } })
  }

  const toggleExpand = pkg => { const n = new Set(expanded); n.has(pkg) ? n.delete(pkg) : n.add(pkg); setExpanded(n) }
  const riskColor = SEV_COLOR[riskLabel?.toUpperCase()] || 'var(--critical)'
  const riskDim = SEV_DIM[riskLabel?.toUpperCase()] || 'var(--red-dim)'

  const exportReport = async (type) => {
    setExportStatus('loading')
    try {
      const res = await fetch(`${API_BASE}/api/export/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) })
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: `sca-report.${type}` }).click()
      URL.revokeObjectURL(url); setShowExportMenu(false); setExportStatus('success')
      setTimeout(() => setExportStatus(null), 2000)
    } catch {
      setExportStatus('error')
      setTimeout(() => setExportStatus(null), 3000)
    }
  }

  const Paginator = ({ page, pages, setPage, total, label }) => {
    if (pages <= 1) return null
    return (
      <div className="a-paginator">
        <span className="a-page-info">{(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total} {label}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="a-page-btn" aria-label="Previous page">Prev</button>
          <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page === pages} className="a-page-btn" aria-label="Next page">Next</button>
        </div>
      </div>
    )
  }

  return (
    <div className="a-layout">
      <div className="a-main">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginBottom: 4 }}>
              Security Report
              <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 4, background: 'var(--green-dim)', border: '1px solid var(--fix-border)', color: 'var(--green)', verticalAlign: 'middle' }}>COMPLETED</span>
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{snapshot.project_name || 'Scanned project'} &middot; {directDeps} direct + {transitiveDeps} transitive dependencies</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
              Scanned <strong style={{ color: 'var(--text)' }}>{directDeps} {directDeps === 1 ? 'package' : 'packages'}</strong> you declared{transitiveDeps > 0 && <>, resolved <strong style={{ color: 'var(--text)' }}>{transitiveDeps} transitive {transitiveDeps === 1 ? 'dependency' : 'dependencies'}</strong> they pull in</>}{vulnPackages.length > 0 ? <> — <strong style={{ color: 'var(--critical)' }}>{vulnPackages.length} {vulnPackages.length === 1 ? 'has' : 'have'} known vulnerabilities</strong></> : <> — <strong style={{ color: 'var(--green)' }}>all clean</strong></>}.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <div ref={exportRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="a-btn" aria-label="Export report">
                {exportStatus === 'loading' ? 'Exporting...' : exportStatus === 'error' ? 'Failed' : exportStatus === 'success' ? 'Done!' : 'Export'}
              </button>
              {showExportMenu && <div className="a-dropdown">{['pdf', 'csv'].map(t => <div key={t} onClick={() => exportReport(t)} className="a-dropdown-item">{t.toUpperCase()}</div>)}</div>}
            </div>
            <button onClick={() => navigate('/scan')} className="a-btn-primary">New Scan</button>
          </div>
        </div>

        {/* Risk Score Modal */}
        {showRiskModal && (() => {
          const critImpact = counts.CRITICAL > 0 ? 40 * (1 - Math.exp(-counts.CRITICAL / 3)) : 0
          const highImpact = counts.HIGH     > 0 ? 30 * (1 - Math.exp(-counts.HIGH     / 5)) : 0
          const medImpact  = counts.MEDIUM   > 0 ? 20 * (1 - Math.exp(-counts.MEDIUM   / 8)) : 0
          const lowImpact  = counts.LOW      > 0 ? 10 * (1 - Math.exp(-counts.LOW      / 10)): 0
          const computedTotal = critImpact + highImpact + medImpact + lowImpact
          const transitiveVuln = sm.vulnerable_transitive_count || 0
          const fixableCount = fixes.length
          const rows = [
            { sev: 'CRITICAL', count: counts.CRITICAL, maxPts: 40, divisor: 3,  impact: critImpact, color: 'var(--critical)' },
            { sev: 'HIGH',     count: counts.HIGH,     maxPts: 30, divisor: 5,  impact: highImpact, color: 'var(--high)' },
            { sev: 'MEDIUM',   count: counts.MEDIUM,   maxPts: 20, divisor: 8,  impact: medImpact,  color: 'var(--medium)' },
            { sev: 'LOW',      count: counts.LOW,      maxPts: 10, divisor: 10, impact: lowImpact,  color: 'var(--low)' },
          ]
          return (
            <div onClick={() => setShowRiskModal(false)} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Risk Score Methodology</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>How your score of <span style={{ color: riskColor, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{riskScore}/100</span> was calculated</div>
                  </div>
                  <button onClick={() => setShowRiskModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
                </div>
                {/* Step 1 */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Step 1 — Severity Contribution</div>
                  {rows.map(({ sev, count, maxPts, impact, color }) => {
                    const pct = Math.round((impact / maxPts) * 100)
                    const isSaturated = pct >= 90
                    return (
                      <div key={sev} style={{ marginBottom: 14 }}>
                        {/* Row header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color, width: 60 }}>{sev}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{count} CVE{count !== 1 ? 's' : ''}</span>
                          <div style={{ flex: 1 }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color }}>{impact.toFixed(1)}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>/ {maxPts} pts</span>
                        </div>
                        {/* Bar */}
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                        </div>
                        {/* Subtext */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                          <span style={{ fontSize: 9, color: isSaturated ? color : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {isSaturated ? `⚠ Nearly maxed out — more ${sev} CVEs won't raise score much` : `${100 - pct}% headroom remaining`}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Combined</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{computedTotal.toFixed(1)} pts</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    ⓘ Each additional CVE of the same severity contributes <em>less</em> than the previous one — so saturated severities (90%+) won't move your score much even with more CVEs.
                  </div>
                </div>
                {/* Step 2 */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Step 2 — Final Score</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 700 }}>min(100, round({computedTotal.toFixed(1)}))</span> = <span style={{ color: riskColor, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{riskScore}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${riskScore}%`, background: riskColor, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: riskColor, whiteSpace: 'nowrap' }}>{riskScore} / 100</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[
                      { range: '0–39',   label: 'Low',      color: 'var(--low)',      dim: 'var(--green-dim)',  min: 0,  max: 39  },
                      { range: '40–69',  label: 'Medium',   color: 'var(--medium)',   dim: 'var(--yellow-dim)', min: 40, max: 69  },
                      { range: '70–89',  label: 'High',     color: 'var(--high)',     dim: 'var(--yellow-dim)', min: 70, max: 89  },
                      { range: '90–100', label: 'Critical', color: 'var(--critical)', dim: 'var(--red-dim)',    min: 90, max: 100 },
                    ].map(({ range, label, color, dim, min, max }) => {
                      const active = riskScore >= min && riskScore <= max
                      return (
                        <div key={label} style={{ flex: 1, padding: '5px 4px', background: active ? dim : 'var(--bg-elevated)', border: `1px solid ${active ? color : 'var(--border)'}`, borderRadius: 5, textAlign: 'center' }}>
                          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color, fontWeight: 700 }}>{range}</div>
                          <div style={{ fontSize: 9, color: active ? color : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>{label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* Step 3 */}
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Step 3 — Context</div>
                  {[
                    { label: 'Transitive vulnerabilities', value: transitiveVuln, note: 'Inherited from your dependencies', color: transitiveVuln > 0 ? 'var(--high)' : 'var(--green)' },
                    { label: 'Fixable packages', value: `${fixableCount} of ${vulnPackages.length}`, note: 'Have a known safe version available', color: fixableCount > 0 ? 'var(--green)' : 'var(--text-muted)' },
                    { label: 'Attack surface', value: `${totalPkgs > 0 ? Math.round((vulnPackages.length / totalPkgs) * 100) : 0}%`, note: 'Of total packages are vulnerable', color: 'var(--text-primary)' },
                  ].map(({ label, value, note, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{note}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color }}>{value}</span>
                    </div>
                  ))}
                  <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    A score of <span style={{ color: riskColor, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{riskScore}/100</span> means <strong style={{ color: 'var(--text-primary)' }}>{riskLabel} risk</strong>. Each additional CVE of the same severity contributes less than the previous — so a project with 50 high CVEs scores lower than you might expect.
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Risk Card */}
        <div className="a-risk-card">
          <div className="a-risk-ring-wrap">
            <div
              onClick={() => setShowRiskModal(true)}
              title="Click to see how this score was calculated"
              style={{ cursor: 'pointer' }}
            >
              <div className="a-ring" style={{ background: `conic-gradient(${riskColor} 0% ${riskScore}%, var(--border) ${riskScore}% 100%)` }}>
                <span style={{ color: riskColor }}>{riskScore}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk Score</div>
              <div data-testid="risk-score" style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: riskColor }}>{riskScore}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/100</span></div>
              <span className="a-risk-label" style={{ background: riskDim, color: riskColor }}>{riskLabel}</span>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 6, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--critical)' }}>Critical</span> ×10 · <span style={{ color: 'var(--high)' }}>High</span> ×7 · <span style={{ color: 'var(--medium)' }}>Medium</span> ×4 · <span style={{ color: 'var(--low)' }}>Low</span> ×1
              </div>
              <button onClick={() => setShowRiskModal(true)} style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textDecoration: 'underline' }}>
                How is this calculated?
              </button>
            </div>
          </div>
          <div className="a-risk-divider" />
          <div className="a-risk-stats">
            {[{ v: totalPkgs, l: 'Packages', c: 'var(--blue)' }, { v: counts.CRITICAL, l: 'Critical', c: 'var(--critical)' }, { v: counts.HIGH, l: 'High', c: 'var(--high)' }, { v: counts.MEDIUM, l: 'Medium', c: 'var(--medium)' }, { v: counts.LOW, l: 'Low', c: 'var(--low)' }].map(({ v, l, c }) => (
              <div key={l} className="a-risk-stat"><div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: c }}>{v}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div></div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="a-tabs">
          {[
            { id: 'vulns', label: `Vulnerable (${vulnPackages.length} packages, ${totalVulns} CVEs)` },
            { id: 'all-pkgs', label: `All Packages (${totalPkgs})` },
            { id: 'tree', label: 'Dependency Graph' },
            { id: 'fixes', label: `Fixes (${fixes.length})` },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)} className={`a-tab ${tab === id ? 'active' : ''}`}>{label}</button>
          ))}
        </div>

        {/* TAB: VULNERABLE — grouped by package */}
        {tab === 'vulns' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sv => (
                <button key={sv} onClick={() => setSevFilter(sv)} className={`a-pill ${sevFilter === sv ? 'active' : ''}`}>
                  {sv === 'ALL'
                    ? `All (${vulnPackages.length})`
                    : <>{SEV_ICON[sv]} {sv} ({counts[sv] || 0})</>
                  }
                </button>
              ))}
            </div>
            {filteredVulnPkgs.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No vulnerabilities found</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredVulnPkgs.map((pkg, idx) => {
                    const isOpen = expanded.has(pkg.package)
                    const cves = sevFilter === 'ALL' ? pkg.vulnerabilities : pkg.vulnerabilities.filter(v => v.severity === sevFilter)
                    const topSev = pkg.highestSeverity || 'HIGH'
                    return (
                      <div key={idx} className="a-pkg-group" style={{ borderLeftColor: SEV_COLOR[topSev] }}>
                        <div className="a-pkg-group-header" onClick={() => toggleExpand(pkg.package)}>
                          <span style={{ color: SEV_COLOR[topSev], fontSize: 12, flexShrink: 0 }}>{isOpen ? '\u25BC' : '\u25B6'}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span className="a-mono-bold">{pkg.package}</span>
                              <span className="a-muted-mono">v{pkg.version}</span>
                              <span className={`a-dep-tag ${pkg.is_direct ? 'direct' : ''}`}>{pkg.is_direct ? 'DIRECT' : 'TRANSITIVE'}</span>
                            </div>
                            {!pkg.is_direct && pkg.vulnerabilities?.[0]?.path && pkg.vulnerabilities[0].path.length > 1 && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                Introduced via <span style={{ color: 'var(--blue)' }}>{pkg.vulnerabilities[0].path.slice(1, -1).join(' \u2192 ')}</span>
                              </div>
                            )}
                          </div>
                          <SevBadge sev={topSev} />
                          <span className="a-muted-mono">{cves.length} CVE{cves.length !== 1 ? 's' : ''}</span>
                          {pkg.recommended_fix && <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>Fix available</span>}
                        </div>
                        {isOpen && (
                          <div className="a-pkg-group-body">
                            {cves.map(v => (
                              <div key={v.cve_id} data-testid="vulnerability-row" onClick={() => setSelected(selected === v.cve_id ? null : v.cve_id)} className={`a-cve-row ${selected === v.cve_id ? 'selected' : ''}`}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)', fontWeight: 600 }}>{v.cve_id}</span>
                                  <span data-severity={v.severity}><SevBadge sev={v.severity} /></span>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: SEV_COLOR[v.severity] }}>CVSS {v.cvss_score}</span>
                                  <span style={{ flex: 1 }} />
                                  {v.fix_version && <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>Fix: v{v.fix_version}</span>}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{v.description?.slice(0, 150)}{v.description?.length > 150 ? '...' : ''}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}

        {/* TAB: ALL PACKAGES */}
        {tab === 'all-pkgs' && (
          <div>
            <input type="text" placeholder="Search packages..." aria-label="Search packages" value={pkgSearch} onChange={e => { setPkgSearch(e.target.value); setPkgPage(1) }} className="a-search" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pagedPkgs.map((g, i) => {
                const has = g.vulnerabilities && g.vulnerabilities.length > 0
                return (
                  <div key={i} className="a-pkg-row" style={{ borderLeftColor: has ? SEV_COLOR[g.highestSeverity] : 'var(--green)' }}>
                    {has
                      ? <SevBadge sev={g.highestSeverity} style={{ fontSize: 10 }} />
                      : <span className="sev-badge" style={{ background: 'var(--green-dim)', color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><span role="img" aria-hidden="true">🟢</span> Secure</span>
                    }
                    <span className="a-mono-bold">{g.package}</span>
                    <span className="a-muted-mono">v{g.version}</span>
                    <span className={`a-dep-tag ${g.is_direct ? 'direct' : ''}`}>{g.is_direct ? 'DIRECT' : 'TRANSITIVE'}</span>
                  </div>
                )
              })}
            </div>
            <Paginator page={pkgPage} pages={pkgPages} setPage={setPkgPage} total={searchedPkgs.length} label="packages" />
          </div>
        )}

        {tab === 'tree' && <DependencyGraph data={snapshot} />}

        {/* TAB: FIX SUGGESTIONS */}
        {tab === 'fixes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fixes.length > 0 && (
              <div style={{ marginBottom: 16, border: '1px solid var(--fix-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--fix-bg)', borderBottom: '1px solid var(--fix-border)' }}>
                  <span style={{ fontSize: 16 }}>🔧</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>Fix All Vulnerabilities</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {fixes.length} {fixes.length === 1 ? 'fix' : 'fixes'} available · Run this command in your project root
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const script = generateFixAllScript(fixes, snapshot.ecosystem)
                      if (script) {
                        navigator.clipboard?.writeText(script)
                        setCopied('fix-all-btn')
                        setTimeout(() => setCopied(null), 2000)
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      background: copied === 'fix-all-btn' ? 'var(--green)' : 'var(--bg-card)',
                      color: copied === 'fix-all-btn' ? 'var(--white)' : 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: 'var(--font-ui)',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {copied === 'fix-all-btn' ? '✓ Copied!' : 'Copy Command'}
                  </button>
                </div>
                {/* Warning */}
                <div style={{ padding: '6px 16px', background: 'var(--warn-bg)', borderBottom: '1px solid var(--warn-border)', fontSize: 11, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠️</span>
                  <span>These are minimum-safe versions. Test in a staging environment before deploying to production — version upgrades may introduce breaking changes.</span>
                </div>
                {/* Terminal block */}
                <div style={{
                  background: 'var(--code-bg)',
                  padding: '14px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.8,
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowX: 'auto',
                  maxHeight: 200,
                  overflowY: 'auto'
                }}>
                  {generateFixAllScript(fixes, snapshot.ecosystem)}
                </div>
              </div>
            )}
            {fixes.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No fixes available</div>
              : fixes.map((v, i) => (
                <div key={v.cve_id || i} className="a-fix-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div className="a-fix-num">{i + 1}</div>
                    <span className="a-mono-bold" style={{ flex: 1 }}>{pkgName(v)}</span>
                    <SevBadge sev={v.severity} />
                    {v.fix_version && <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>v{pkgVersion(v)} &#8594; v{v.fix_version}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{v.description}</div>
                  {v.fix_version && <div className="a-code-block"><span>{installCmd(v, snapshot.ecosystem)}</span><button onClick={() => handleCopy(installCmd(v, snapshot.ecosystem), `fix-${i}`)} className="a-copy-btn">{copied === `fix-${i}` ? '✓ Copied' : 'Copy'}</button></div>}
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className={`a-right ${selected ? "has-selection" : ""}`}>
        <div className="a-panel">
          <div className="a-panel-hdr">
            <span>CVE Details</span>
            {selectedVuln && <SevBadge sev={selectedVuln.severity} />}
            {selectedVuln && <span onClick={() => setSelected(null)} style={{ cursor: 'pointer', color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 14 }} aria-label="Close details">x</span>}
          </div>
          <div style={{ padding: 14 }}>
            {!selectedVuln
              ? <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)', fontSize: 12 }}>Click a CVE to view details</div>
              : <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{pkgName(selectedVuln)}</div>
                  <div className="a-muted-mono" style={{ marginBottom: 12 }}>v{pkgVersion(selectedVuln)}</div>
                  <div className="a-panel-row"><div className="a-panel-label">CVE ID</div><span style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{selectedVuln.cve_id}</span></div>
                  <div className="a-panel-row">
                    <div className="a-panel-label">CVSS</div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: SEV_COLOR[selectedVuln.severity] }}>{selectedVuln.cvss_score}</span>
                    <div style={{ marginTop: 4, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(selectedVuln.cvss_score / 10) * 100}%`, background: `linear-gradient(90deg,var(--green),var(--high),var(--critical))`, borderRadius: 2 }} />
                    </div>
                  </div>
                  <div className="a-panel-row"><div className="a-panel-label">Description</div><span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedVuln.description}</span></div>
                  <div className="a-panel-row">
                    <div className="a-panel-label">Dependency Type</div>
                    <span className={`a-dep-tag ${selectedVuln.is_direct ? 'direct' : ''}`}>{selectedVuln.is_direct ? 'DIRECT' : 'TRANSITIVE'}</span>
                    {selectedVuln.path && selectedVuln.path.length > 2 && (
                      <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                        {selectedVuln.path.map((p, i) => (
                          <span key={i}>
                            {i > 0 && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>{'\u2192'}</span>}
                            <span style={{ color: i === selectedVuln.path.length - 1 ? SEV_COLOR[selectedVuln.severity] : i === 0 ? 'var(--text-muted)' : 'var(--blue)' }}>{p}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedVuln.fix_version && (
                    <div style={{ background: 'var(--green-dim)', border: '1px solid var(--fix-border)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                      <div className="a-panel-label" style={{ color: 'var(--green)' }}>FIX</div>
                      <div className="a-code-block"><span>{installCmd(selectedVuln, snapshot.ecosystem)}</span><button onClick={() => handleCopy(installCmd(selectedVuln, snapshot.ecosystem), 'sidebar')} className="a-copy-btn">{copied === 'sidebar' ? '✓ Copied' : 'Copy'}</button></div>
                    </div>
                  )}
                  <div className="a-panel-row">
                    <div className="a-panel-label">References</div>
                    <a href={`https://nvd.nist.gov/vuln/detail/${selectedVuln.cve_id}`} target="_blank" rel="noreferrer" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)', padding: '3px 0' }}>NVD &#8599;</a>
                    <a href={`https://osv.dev/${selectedVuln.cve_id}`} target="_blank" rel="noreferrer" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)', padding: '3px 0' }}>OSV &#8599;</a>
                  </div>
                </div>
            }
          </div>
        </div>

        <div className="a-panel">
          <div className="a-panel-hdr"><span>Risk Breakdown</span></div>
          <div style={{ padding: 14 }}>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sv => (
              <div key={sv} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 66, color: SEV_COLOR[sv], fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span role="img" aria-hidden="true">{SEV_ICON[sv]}</span>{sv}
                </span>
                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalVulns > 0 ? ((counts[sv] || 0) / totalVulns) * 100 : 0}%`, background: SEV_COLOR[sv], borderRadius: 3 }} />
                </div>
                <span style={{ color: SEV_COLOR[sv], fontFamily: 'var(--font-mono)', fontWeight: 700, width: 20, textAlign: 'right', fontSize: 11 }}>{counts[sv] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="a-panel">
          <div className="a-panel-hdr"><span>Risk Insights</span></div>
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--code-bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>How Risk Score is Calculated</div>
              {/* Severity weight bars */}
              {[
                { label: 'Critical', color: 'var(--critical)', pts: 40, weight: '10 pts each', count: counts.CRITICAL },
                { label: 'High',     color: 'var(--high)',     pts: 30, weight: '7 pts each',  count: counts.HIGH },
                { label: 'Medium',   color: 'var(--medium)',   pts: 20, weight: '4 pts each',  count: counts.MEDIUM },
                { label: 'Low',      color: 'var(--low)',      pts: 10, weight: '1 pt each',   count: counts.LOW },
              ].map(({ label, color, pts, weight, count }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 52, fontSize: 10, color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{label}</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pts}%`, background: color, borderRadius: 2, opacity: 0.85 }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 62, textAlign: 'right' }}>{weight}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color, width: 16, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Score uses <strong style={{ color: 'var(--text-secondary)' }}>diminishing returns</strong> — adding more CVEs increases score but never instantly reaches 100. A score of {riskScore}/100 means your project has significant exposure and should be prioritised.
              </div>
            </div>
            {vulnPackages.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Attack surface</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round((vulnPackages.length / totalPkgs) * 100)}% of packages</span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(vulnPackages.length / totalPkgs) * 100}%`, background: 'var(--critical)', borderRadius: 2 }} />
                </div>
              </div>
            )}
            {(() => { 
              const directVuln = sm.vulnerable_direct_count || 0
              const transitiveVuln = sm.vulnerable_transitive_count || 0
              return (
              <div style={{ marginBottom: 8 }}>
                {directVuln > 0 && <div style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Vulnerable direct deps</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--critical)' }}>{directVuln} of {directDeps}</span></div>}
                {transitiveVuln > 0 && <div style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Vulnerable transitive deps</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--high)' }}>{transitiveVuln} of {transitiveDeps}</span></div>}
                <div style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Fixable vulnerabilities</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)' }}>{fixes.length > 0 ? `${fixes.length} packages` : 'None'}</span></div>
                <div style={{ padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Sources</span><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>OSV</span></div>
              </div>
            )})()}
          </div>
        </div>
      </div>
    </div>
  )
}
