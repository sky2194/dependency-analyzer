import React, { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import API_BASE from '../config'
import DependencyGraph from '../components/DependencyGraph'
import validateContract from '../utils/validateSnapshot'
import normalizeSnapshot from '../utils/normalizeSnapshot'
import tokens from '../theme/tokens'

const SEV_COLOR = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' }
const SEV_DIM = { CRITICAL: 'var(--red-dim)', HIGH: 'var(--yellow-dim)', MEDIUM: 'var(--blue-dim)', LOW: 'var(--green-dim)' }

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
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [vulnPage, setVulnPage] = useState(1)
  const [pkgPage, setPkgPage] = useState(1)
  const [pkgSearch, setPkgSearch] = useState('')
  const exportRef = useRef(null)
  const result = locationState?.result

  useEffect(() => {
    const h = e => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => { setVulnPage(1) }, [sevFilter])

  if (!result) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>No scan result found.</p>
        <button onClick={() => navigate('/scan')} style={{ padding: '10px 20px', background: 'var(--orange)', color: 'var(--white)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>← Run a Scan</button>
      </div>
    )
  }

  const [activeTransactionId] = useState(result.transaction_id)
  let frozenResult, snapshot
  try {
    if (result.transaction_id !== activeTransactionId) throw new Error('STALE TRANSACTION')
    frozenResult = Object.freeze(result)
    validateContract(frozenResult)
    snapshot = normalizeSnapshot(frozenResult)
  } catch (error) {
    return (
      <div style={{ textAlign: 'center', padding: 80, margin: 20, background: 'var(--bg-card)', border: '1px solid var(--critical)', borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚨</div>
        <h2 style={{ color: 'var(--critical)', marginBottom: 12 }}>CONTRACT VIOLATION</h2>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, maxWidth: 500, margin: '0 auto' }}>{error.message}</p>
        <button onClick={() => navigate('/scan')} style={{ marginTop: 20, padding: '10px 20px', background: 'var(--critical)', color: 'var(--white)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>← Return to Scan</button>
      </div>
    )
  }

  const groupedPackages = snapshot.grouped_packages || []
  const vulns = snapshot.vulnerabilities || []
  const summary = snapshot.summary
  const riskScore = summary.risk_score
  const riskLabel = summary.risk_label
  const totalPackages = summary.total_packages
  const directDeps = summary.direct_dependencies
  const transitiveDeps = summary.transitive_dependencies
  const totalVulns = summary.vulnerabilities
  const counts = { CRITICAL: summary.critical, HIGH: summary.high, MEDIUM: summary.medium, LOW: summary.low }

  const filtered = sevFilter === 'ALL' ? vulns : vulns.filter(v => v.severity === sevFilter)
  const selectedVuln = vulns.find(v => v.cve_id === selected)
  const vulnTotal = filtered.length
  const vulnPages = Math.ceil(vulnTotal / PAGE_SIZE)
  const pagedVulns = filtered.slice((vulnPage - 1) * PAGE_SIZE, vulnPage * PAGE_SIZE)

  const filteredPkgs = pkgSearch ? groupedPackages.filter(g => g.package?.toLowerCase().includes(pkgSearch.toLowerCase())) : groupedPackages
  const pkgTotal = filteredPkgs.length
  const pkgPages = Math.ceil(pkgTotal / PAGE_SIZE)
  const pagedPkgs = filteredPkgs.slice((pkgPage - 1) * PAGE_SIZE, pkgPage * PAGE_SIZE)

  const fixes = []
  if (snapshot.fixes && Array.isArray(snapshot.fixes)) {
    const seen = new Set()
    snapshot.fixes.forEach(v => { const p = pkgName(v); if (!seen.has(p)) { seen.add(p); fixes.push(v) } })
  }

  const exportReport = async (type) => {
    try {
      const res = await fetch(`${API_BASE}/api/export/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) })
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `sca-report.${type === 'pdf' ? 'html' : type}`; a.click()
      URL.revokeObjectURL(url); setShowExportMenu(false)
    } catch { }
  }

  const Paginator = ({ page, pages, setPage, total, label }) => {
    if (pages <= 1) return null
    return (
      <div className="a-paginator">
        <span className="a-page-info">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} {label}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="a-page-btn">←</button>
          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            let p; if (pages <= 5) p = i + 1; else if (page <= 3) p = i + 1; else if (page >= pages - 2) p = pages - 4 + i; else p = page - 2 + i
            return <button key={p} onClick={() => setPage(p)} className={`a-page-btn ${page === p ? 'active' : ''}`}>{p}</button>
          })}
          <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page === pages} className="a-page-btn">→</button>
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
              <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 4, background: 'var(--green-dim)', border: '1px solid var(--fix-border)', color: 'var(--green)', verticalAlign: 'middle' }}>● LIVE</span>
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{totalPackages} packages · {directDeps} direct · {transitiveDeps} transitive</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <div ref={exportRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="a-btn">↓ Export</button>
              {showExportMenu && <div className="a-dropdown">{['pdf', 'csv', 'json'].map(t => <div key={t} onClick={() => exportReport(t)} className="a-dropdown-item">{t.toUpperCase()}</div>)}</div>}
            </div>
            <button onClick={() => navigate('/scan')} className="a-btn-primary">New Scan</button>
          </div>
        </div>

        {/* Risk Card */}
        <div className="a-risk-card">
          <div className="a-risk-ring-wrap">
            <div className="a-ring" style={{ background: `conic-gradient(${SEV_COLOR[riskLabel?.toUpperCase()] || 'var(--critical)'} 0% ${riskScore}%, var(--border) ${riskScore}% 100%)` }}>
              <span>{riskScore}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk Score</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: SEV_COLOR[riskLabel?.toUpperCase()] || 'var(--critical)' }}>{riskScore}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/100</span></div>
              <span className="a-risk-label" style={{ background: SEV_DIM[riskLabel?.toUpperCase()] || 'var(--red-dim)', color: SEV_COLOR[riskLabel?.toUpperCase()] || 'var(--critical)' }}>{riskLabel}</span>
            </div>
          </div>
          <div className="a-risk-divider" />
          <div className="a-risk-stats">
            {[{ v: totalVulns, l: 'Vulns', c: totalVulns > 0 ? 'var(--critical)' : 'var(--green)' }, { v: counts.CRITICAL, l: 'Critical', c: 'var(--critical)' }, { v: counts.HIGH, l: 'High', c: 'var(--high)' }, { v: counts.MEDIUM, l: 'Medium', c: 'var(--medium)' }, { v: counts.LOW, l: 'Low', c: 'var(--low)' }].map(({ v, l, c }) => (
              <div key={l} className="a-risk-stat">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="a-tabs">
          {[{ id: 'vulns', label: `Vulnerabilities (${totalVulns})` }, { id: 'all-pkgs', label: `All Packages (${totalPackages})` }, { id: 'tree', label: 'Dep Graph' }, { id: 'fixes', label: `Fixes (${fixes.length})` }].map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)} className={`a-tab ${tab === id ? 'active' : ''}`}>{label}</button>
          ))}
        </div>

        {/* Vulns */}
        {tab === 'vulns' && (<div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
              <button key={s} onClick={() => setSevFilter(s)} className={`a-pill ${sevFilter === s ? 'active' : ''}`}>{s === 'ALL' ? `All (${totalVulns})` : `${s} (${counts[s] || 0})`}</button>
            ))}
          </div>
          {pagedVulns.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No vulnerabilities found</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pagedVulns.map(v => (
                <div key={v.cve_id} onClick={() => setSelected(selected === v.cve_id ? null : v.cve_id)} className={`a-vuln-row ${selected === v.cve_id ? 'selected' : ''}`} style={{ borderLeftColor: SEV_COLOR[v.severity] }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="a-mono-bold">{pkgName(v)}</span>
                    <span className="a-muted-mono">v{pkgVersion(v)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)' }}>{v.cve_id}</span>
                    {v.is_direct !== undefined && <span className={`a-dep-tag ${v.is_direct ? 'direct' : ''}`}>{v.is_direct ? 'DIRECT' : 'TRANSITIVE'}</span>}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: SEV_COLOR[v.severity] }}>CVSS {v.cvss_score}</span>
                    <span className="sev-badge" style={{ background: SEV_DIM[v.severity], color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{v.description?.slice(0, 120)}{v.description?.length > 120 ? '…' : ''}</div>
                  {v.fix_version && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>✓ {fixText(v)}</div>}
                </div>
              ))}
            </div>
          )}
          <Paginator page={vulnPage} pages={vulnPages} setPage={setVulnPage} total={vulnTotal} label="vulnerabilities" />
        </div>)}

        {/* All Packages */}
        {tab === 'all-pkgs' && (<div>
          <input type="text" placeholder="Search packages..." value={pkgSearch} onChange={e => { setPkgSearch(e.target.value); setPkgPage(1) }} className="a-search" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pagedPkgs.map((g, i) => { const has = g.vulnerabilities?.length > 0; return (
              <div key={i} className="a-pkg-row" style={{ borderLeftColor: has ? SEV_COLOR[g.highestSeverity] : 'var(--green)' }}>
                <span className="sev-badge" style={{ background: has ? SEV_DIM[g.highestSeverity] : 'var(--green-dim)', color: has ? SEV_COLOR[g.highestSeverity] : 'var(--green)' }}>{has ? `${g.vulnerabilities.length} CVE${g.vulnerabilities.length > 1 ? 's' : ''}` : '✓'}</span>
                <span className="a-mono-bold">{g.package}</span>
                <span className="a-muted-mono">v{g.version}</span>
              </div>
            )})}
          </div>
          <Paginator page={pkgPage} pages={pkgPages} setPage={setPkgPage} total={pkgTotal} label="packages" />
        </div>)}

        {tab === 'tree' && <DependencyGraph data={snapshot} />}

        {/* Fixes */}
        {tab === 'fixes' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fixes.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No fixes available</div> : fixes.map((v, i) => (
            <div key={v.cve_id} className="a-fix-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div className="a-fix-num">{i + 1}</div>
                <span className="a-mono-bold" style={{ flex: 1 }}>{pkgName(v)}</span>
                <span className="sev-badge" style={{ background: SEV_DIM[v.severity], color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                {v.fix_version && <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>→ v{v.fix_version}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{v.description}</div>
              {v.fix_version && <div className="a-code-block"><span>{installCmd(v, snapshot.ecosystem)}</span><button onClick={() => navigator.clipboard?.writeText(installCmd(v, snapshot.ecosystem))} className="a-copy-btn">Copy</button></div>}
            </div>
          ))}
        </div>)}
      </div>

      {/* Right Panel */}
      <div className="a-right">
        <div className="a-panel">
          <div className="a-panel-hdr"><span>CVE Details</span>{selectedVuln && <><span className="sev-badge" style={{ background: SEV_DIM[selectedVuln.severity], color: SEV_COLOR[selectedVuln.severity] }}>{selectedVuln.severity}</span><span onClick={() => setSelected(null)} style={{ cursor: 'pointer', color: 'var(--text-muted)', marginLeft: 'auto' }}>✕</span></>}</div>
          <div style={{ padding: 14 }}>
            {!selectedVuln ? <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 12 }}><div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>Click a vulnerability</div> : (<div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{pkgName(selectedVuln)}</div>
              <div className="a-muted-mono" style={{ marginBottom: 12 }}>v{pkgVersion(selectedVuln)}</div>
              <div className="a-panel-row"><div className="a-panel-label">CVE ID</div><span style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{selectedVuln.cve_id}</span></div>
              <div className="a-panel-row"><div className="a-panel-label">CVSS</div><span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: SEV_COLOR[selectedVuln.severity] }}>{selectedVuln.cvss_score}</span><div style={{ marginTop: 4, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(selectedVuln.cvss_score / 10) * 100}%`, background: `linear-gradient(90deg,var(--green),var(--high),var(--critical))`, borderRadius: 2 }} /></div></div>
              <div className="a-panel-row"><div className="a-panel-label">Description</div><span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedVuln.description}</span></div>
              {selectedVuln.fix_version && <div style={{ background: 'var(--green-dim)', border: '1px solid var(--fix-border)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}><div className="a-panel-label" style={{ color: 'var(--green)' }}>FIX</div><div className="a-code-block"><span>{installCmd(selectedVuln, snapshot.ecosystem)}</span><button onClick={() => navigator.clipboard?.writeText(installCmd(selectedVuln, snapshot.ecosystem))} className="a-copy-btn">Copy</button></div></div>}
              <div className="a-panel-row"><div className="a-panel-label">References</div>{[`nvd.nist.gov/vuln/detail/${selectedVuln.cve_id}`, `osv.dev/${selectedVuln.cve_id}`].map(r => <a key={r} href={`https://${r}`} target="_blank" rel="noreferrer" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)', padding: '3px 0' }}>↗ {r}</a>)}</div>
            </div>)}
          </div>
        </div>
        <div className="a-panel"><div className="a-panel-hdr"><span>Risk Breakdown</span></div><div style={{ padding: 14 }}>{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}><span style={{ width: 55, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{s}</span><div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${totalVulns > 0 ? ((counts[s] || 0) / totalVulns) * 100 : 0}%`, background: SEV_COLOR[s], borderRadius: 3 }} /></div><span style={{ color: SEV_COLOR[s], fontFamily: 'var(--font-mono)', fontWeight: 700, width: 20, textAlign: 'right' }}>{counts[s] || 0}</span></div>)}</div></div>
        <div className="a-panel"><div className="a-panel-hdr"><span>Scan Info</span></div><div style={{ padding: '10px 14px' }}>{[['Direct', directDeps], ['Transitive', transitiveDeps], ['Total', totalPackages], ['Vulns', totalVulns], ['Source', snapshot.project_name || 'manifest'], ['DBs', 'NVD + OSV']].map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>{l}</span><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{v}</span></div>)}</div></div>
      </div>
    </div>
  )
}
