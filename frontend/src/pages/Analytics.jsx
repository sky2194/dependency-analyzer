import React, { useState, useReducer, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import API_BASE from '../config'
import DependencyGraph from '../components/DependencyGraph'
import validateContract from '../utils/validateSnapshot'
import normalizeSnapshot from '../utils/normalizeSnapshot'
import tokens from '../theme/tokens'

const SEV_COLOR = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' }
const SEV_DIM = { CRITICAL: 'var(--red-dim)', HIGH: 'var(--yellow-dim)', MEDIUM: 'var(--blue-dim)', LOW: 'var(--green-dim)' }
const TAB_COLORS = {
  vulns: { bg: 'var(--red-dim)', color: 'var(--red)' },
  'all-pkgs': { bg: 'var(--blue-dim)', color: 'var(--blue)' },
  tree: { bg: 'var(--green-dim)', color: 'var(--green)' },
  fixes: { bg: 'var(--green-dim)', color: 'var(--green)' },
}

const pkgName = v => v?.package_name || v?.package || ''
const pkgVersion = v => v?.installed_version || v?.version || ''
const fixText = v => v?.fix_version ? `Upgrade to v${v.fix_version}` : (v?.fix || 'No fix available')
const installCmd = (v, ecosystem = 'npm') => {
  if (!v?.fix_version) return ''
  if (ecosystem === 'pypi') return `pip install ${pkgName(v)}==${v.fix_version}`
  if (ecosystem === 'maven') return `${pkgName(v)} -> ${v.fix_version}`
  return `npm install ${pkgName(v)}@${v.fix_version}`
}

const initialState = {
  tab: 'vulns', sevFilter: 'ALL', selected: null, vulnExpanded: false,
  viewMode: 'grouped', showDirectOnly: false, expandedPackages: new Set(),
  showAllPackages: false, showTooltip: false,
  deepScanResult: null, deepScanLoading: false, selectedPackage: null
}

function analyticsReducer(state, action) {
  switch (action.type) {
    case 'SET_TAB': return { ...state, tab: action.payload }
    case 'SET_SEV_FILTER': return { ...state, sevFilter: action.payload }
    case 'SET_SELECTED': return { ...state, selected: action.payload }
    case 'TOGGLE_VULN_EXPANDED': return { ...state, vulnExpanded: !state.vulnExpanded }
    case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload }
    case 'TOGGLE_SHOW_DIRECT_ONLY': return { ...state, showDirectOnly: !state.showDirectOnly }
    case 'TOGGLE_PACKAGE_EXPAND':
      const s = new Set(state.expandedPackages)
      s.has(action.payload) ? s.delete(action.payload) : s.add(action.payload)
      return { ...state, expandedPackages: s }
    case 'TOGGLE_SHOW_ALL_PACKAGES': return { ...state, showAllPackages: !state.showAllPackages }
    case 'SET_SHOW_TOOLTIP': return { ...state, showTooltip: action.payload }
    case 'SET_DEEP_SCAN_RESULT': return { ...state, deepScanResult: action.payload }
    case 'SET_DEEP_SCAN_LOADING': return { ...state, deepScanLoading: action.payload }
    case 'SET_SELECTED_PACKAGE': return { ...state, selectedPackage: action.payload }
    default: return state
  }
}

export default function Analytics() {
  const { state: locationState } = useLocation()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(analyticsReducer, initialState)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportRef = useRef(null)
  const result = locationState?.result

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!result) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>No scan result found.</p>
        <button onClick={() => navigate('/scan')} style={{ padding: '10px 20px', background: tokens.accent.primary, color: 'var(--white)', border: 'none', borderRadius: tokens.radius.md, cursor: 'pointer', fontFamily: tokens.font.ui, fontWeight: 700 }}>← Run a Scan</button>
      </div>
    )
  }

  const [activeTransactionId] = useState(result.transaction_id)

  let frozenResult, snapshot
  try {
    if (result.transaction_id !== activeTransactionId) throw new Error(`STALE TRANSACTION BLOCKED`)
    frozenResult = Object.freeze(result)
    validateContract(frozenResult)
    snapshot = normalizeSnapshot(frozenResult)
  } catch (error) {
    return (
      <div style={{ textAlign: 'center', padding: 80, background: 'var(--bg-card)', border: '1px solid var(--critical)', borderRadius: 'var(--radius)', margin: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚨</div>
        <h2 style={{ color: 'var(--critical)', marginBottom: 16 }}>CONTRACT VIOLATION</h2>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>{error.message}</p>
        <button onClick={() => navigate('/scan')} style={{ marginTop: 24, padding: '12px 24px', background: 'var(--critical)', color: 'var(--white)', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 700 }}>← Return to Scan</button>
      </div>
    )
  }

  const groupedPackages = snapshot.grouped_packages
  const vulns = snapshot.vulnerabilities
  const summary = snapshot.summary
  const tree = snapshot.dependency_tree || snapshot.graph
  const riskScore = summary.risk_score
  const riskLabel = summary.risk_label
  const totalPackages = summary.total_packages
  const directDeps = summary.direct_dependencies
  const transitiveDeps = summary.transitive_dependencies
  const totalVulns = summary.vulnerabilities
  const counts = { CRITICAL: summary.critical, HIGH: summary.high, MEDIUM: summary.medium, LOW: summary.low }

  const filtered = state.sevFilter === 'ALL' ? vulns : vulns.filter(v => v.severity === state.sevFilter)
  const directOnlyFiltered = state.showDirectOnly ? filtered.filter(v => v.is_direct) : filtered
  const selectedVuln = vulns.find(v => v.cve_id === state.selected)

  // Grouped view: filter to vulnerable packages only when on vulns tab
  const vulnGrouped = Array.isArray(groupedPackages) ? groupedPackages.filter(g => g.vulnerabilities.length > 0) : []

  const fixes = []
  if (snapshot.fixes && Array.isArray(snapshot.fixes)) {
    const seen = new Set()
    snapshot.fixes.forEach(v => {
      const pkg = pkgName(v)
      if (!seen.has(pkg)) { seen.add(pkg); fixes.push(v) }
    })
  }

  const exportReport = async (type) => {
    try {
      const res = await fetch(`${API_BASE}/api/export/${type}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(result) })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `sca-report.${type==='pdf'?'html':type}`; a.click()
      URL.revokeObjectURL(url); setShowExportMenu(false)
    } catch {}
  }

  const handleDeepScan = async (packageName, version, ecosystem) => {
    dispatch({ type: 'SET_SELECTED_PACKAGE', payload: packageName })
    dispatch({ type: 'SET_DEEP_SCAN_LOADING', payload: true })
    try {
      const res = await fetch(`${API_BASE}/api/scan-package`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ package: packageName, version, ecosystem: ecosystem || 'pypi' }) })
      const data = await res.json()
      if (res.ok) dispatch({ type: 'SET_DEEP_SCAN_RESULT', payload: data })
    } catch (err) { console.error('Deep scan failed:', err) }
    finally { dispatch({ type: 'SET_DEEP_SCAN_LOADING', payload: false }) }
  }

  return (
    <div className="analytics-layout">
      {/* MAIN */}
      <div className="analytics-main">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginBottom: 4 }}>
              Security Risk Overview
              <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 4, background: 'var(--green-dim)', border: '1px solid var(--fix-border)', color: 'var(--green)', verticalAlign: 'middle' }}>● LIVE</span>
            </h1>
            <div style={{ fontSize: 12, color: 'var(--critical)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
              <strong>{totalVulns} vulnerabilities</strong> across {totalPackages} packages ({directDeps} direct + {transitiveDeps} transitive)
              {counts.CRITICAL > 0 && <span> — {counts.CRITICAL} critical requires immediate attention</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <div ref={exportRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="analytics-btn">↓ Export</button>
              {showExportMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px var(--overlay-bg)', zIndex: 100, minWidth: 150, overflow: 'hidden' }}>
                  {['pdf','csv','json'].map(t => (
                    <div key={t} onClick={() => exportReport(t)} className="export-item">{t.toUpperCase()} Report</div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => navigate('/scan')} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6, background: 'var(--orange)', color: 'var(--white)', border: 'none', cursor: 'pointer' }}>🔄 New Scan</button>
          </div>
        </div>

        {/* Unified Risk + Stats Card */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {/* Risk Ring */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: `conic-gradient(${SEV_COLOR[riskLabel?.toUpperCase()] || 'var(--critical)'} 0% ${riskScore}%, var(--border) ${riskScore}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: 'var(--bg-card)' }} />
                <span style={{ position: 'relative', zIndex: 1, fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: SEV_COLOR[riskLabel?.toUpperCase()] || 'var(--critical)' }}>{riskScore}</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Score</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: SEV_COLOR[riskLabel?.toUpperCase()] || 'var(--critical)', letterSpacing: -1 }}>{riskScore}<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/100</span></div>
                <div style={{ fontSize: 10, fontWeight: 700, color: SEV_COLOR[riskLabel?.toUpperCase()] || 'var(--critical)', background: SEV_DIM[riskLabel?.toUpperCase()] || 'var(--red-dim)', padding: '1px 7px', borderRadius: 3, fontFamily: 'var(--font-mono)', display: 'inline-block', textTransform: 'capitalize' }}>{riskLabel || 'Unknown'}</div>
              </div>
            </div>
            <div style={{ width: 1, height: 48, background: 'var(--border)', flexShrink: 0 }} className="analytics-divider-v" />
            {/* Stats */}
            <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
              {[
                { v: totalPackages, l: 'Packages', sub: `${directDeps} direct · ${transitiveDeps} transitive`, c: 'var(--blue)' },
                { v: totalVulns, l: 'Vulnerabilities', sub: `${summary.vulnerable_package_count || 0} packages affected`, c: 'var(--high)' },
                { v: counts.CRITICAL, l: 'Critical', sub: counts.CRITICAL > 0 ? 'Requires action' : 'None found', c: 'var(--critical)' },
                { v: counts.HIGH, l: 'High', sub: counts.HIGH > 0 ? 'Review recommended' : 'None found', c: 'var(--high)' },
              ].map(({ v, l, sub, c }) => (
                <div key={l} style={{ minWidth: 80 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{l}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority Fixes */}
        {totalVulns > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Priority Fixes</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4 }}>Auto-prioritized by CVSS</span>
            </div>
            {vulns.filter(v=>v.severity==='CRITICAL'||v.severity==='HIGH').slice(0,3).map(v => (
              <div key={v.cve_id} onClick={() => dispatch({ type: 'SET_SELECTED', payload: v.cve_id })} className="priority-fix-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{pkgName(v)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>v{pkgVersion(v)}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description?.slice(0,80)}...</div>
                </div>
                <span className="sev-badge" style={{ background: SEV_DIM[v.severity], border: `1px solid ${SEV_COLOR[v.severity]}44`, color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: SEV_COLOR[v.severity] }}>CVSS {v.cvss_score}</span>
                {v.fix_version && <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>✓ Fix</span>}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="analytics-tabs">
          {[
            { id: 'vulns', label: 'Vulnerabilities', count: totalVulns },
            { id: 'all-pkgs', label: 'All Packages', count: totalPackages },
            { id: 'tree', label: 'Dep Graph', count: null },
            { id: 'fixes', label: 'Fix Suggestions', count: fixes.length }
          ].map(({ id, label, count }) => (
            <button key={id} onClick={() => dispatch({ type: 'SET_TAB', payload: id })} className={`analytics-tab ${state.tab===id ? 'active' : ''}`}>
              {label}
              {count !== null && <span className="tab-count" style={{ background: TAB_COLORS[id].bg, color: TAB_COLORS[id].color }}>{count}</span>}
            </button>
          ))}
        </div>

        {/* Tab: All Packages */}
        {state.tab === 'all-pkgs' && (
          <div>
            <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              Showing all {totalPackages} packages ({directDeps} direct + {transitiveDeps} transitive)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.isArray(groupedPackages) && groupedPackages.map((group, idx) => {
                const hasVulns = group.vulnerabilities.length > 0
                return (
                  <div key={idx} className="pkg-row" style={{ borderLeft: `3px solid ${hasVulns ? SEV_COLOR[group.highestSeverity] : 'var(--green)'}` }}>
                    <span className="sev-badge" style={{ background: hasVulns ? SEV_DIM[group.highestSeverity] : 'var(--green-dim)', color: hasVulns ? SEV_COLOR[group.highestSeverity] : 'var(--green)' }}>
                      {hasVulns ? group.vulnerabilities.length + ' CVEs' : '✓ Secure'}
                    </span>
                    <span onClick={(e) => { e.stopPropagation(); handleDeepScan(group.package, group.version, snapshot.ecosystem) }} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--blue)', cursor: 'pointer' }}>{group.package}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>v{group.version}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab: Vulnerabilities */}
        {state.tab === 'vulns' && (
          <div>
            {/* Deep scan modals */}
            {state.deepScanResult && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Deep Scan: {state.selectedPackage}</h3>
                    <button onClick={() => dispatch({ type: 'SET_DEEP_SCAN_RESULT', payload: null })} className="analytics-btn">✕</button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                    {state.deepScanResult.total_packages} packages • {state.deepScanResult.vulnerabilities?.length || 0} vulnerabilities
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(state.deepScanResult.vulnerabilities || []).slice(0, 10).map(v => (
                      <div key={v.cve_id} style={{ background: 'var(--bg)', borderLeft: `3px solid ${SEV_COLOR[v.severity]}`, borderRadius: 'var(--radius)', padding: 12, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{v.package}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)' }}>{v.cve_id}</span>
                          <span style={{ flex: 1 }} />
                          <span className="sev-badge" style={{ background: SEV_DIM[v.severity], color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {state.deepScanLoading && (
              <div className="modal-overlay">
                <div className="modal-content" style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Deep scanning {state.selectedPackage}...</div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="filter-toolbar">
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Severity</span>
              {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
                <button key={s} onClick={() => dispatch({ type: 'SET_SEV_FILTER', payload: s })} className={`filter-pill ${state.sevFilter===s ? 'active' : ''}`}>
                  {s}{s!=='ALL' && ` (${counts[s]||0})`}
                </button>
              ))}
              <div className="filter-divider" />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>View</span>
              <button onClick={() => dispatch({ type: 'TOGGLE_SHOW_DIRECT_ONLY' })} className={`filter-pill ${state.showDirectOnly ? 'active' : ''}`}>
                {state.showDirectOnly ? '✓ Direct' : 'Direct Only'}
              </button>
              <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'list' ? 'grouped' : 'list' })} className="filter-pill">
                {state.viewMode === 'list' ? '▦ Grouped' : '☰ List'}
              </button>
              {directOnlyFiltered.length > 5 && (
                <>
                  <div className="filter-divider" />
                  <button onClick={() => dispatch({ type: 'TOGGLE_VULN_EXPANDED' })} className={`filter-pill ${state.vulnExpanded ? 'active' : ''}`}>
                    {state.vulnExpanded ? '▼ Collapse' : `▶ Show All (${directOnlyFiltered.length})`}
                  </button>
                </>
              )}
            </div>

            {/* List View */}
            {state.viewMode === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(state.vulnExpanded ? directOnlyFiltered : directOnlyFiltered.slice(0, 50)).map(v => (
                  <div key={v.cve_id} onClick={() => dispatch({ type: 'SET_SELECTED', payload: state.selected===v.cve_id?null:v.cve_id })} className="vuln-card" style={{ borderLeft: `3px solid ${SEV_COLOR[v.severity]}`, background: state.selected===v.cve_id ? 'var(--orange-dim)' : 'var(--bg-card)', borderColor: state.selected===v.cve_id ? 'var(--orange)' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span onClick={(e) => { e.stopPropagation(); handleDeepScan(pkgName(v), pkgVersion(v), snapshot.ecosystem) }} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--blue)', cursor: 'pointer' }}>{pkgName(v)}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>v{pkgVersion(v)}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)' }}>{v.cve_id}</span>
                      {v.is_direct !== undefined && <span className="dep-badge" style={{ background: v.is_direct ? 'var(--green-dim)' : 'var(--yellow-dim)', border: `1px solid ${v.is_direct ? 'var(--green)' : 'var(--high)'}`, color: v.is_direct ? 'var(--green)' : 'var(--high)' }}>{v.is_direct ? 'DIRECT' : 'TRANSITIVE'}</span>}
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: SEV_COLOR[v.severity] }}>CVSS {v.cvss_score}</span>
                      <span className="sev-badge" style={{ background: SEV_DIM[v.severity], color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{v.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Fix:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600 }}>{fixText(v)}</span>
                      {v.fix_version && <span className="dep-badge" style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--fix-border)' }}>FIX AVAILABLE</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Grouped View */}
            {state.viewMode === 'grouped' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(state.vulnExpanded ? vulnGrouped : vulnGrouped.slice(0, 8)).map((group, idx) => {
                  const isExpanded = state.expandedPackages.has(group.package)
                  return (
                    <div key={idx} style={{ background: 'var(--bg-card)', border: `1px solid ${SEV_COLOR[group.highestSeverity]}44`, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <div onClick={() => dispatch({ type: 'TOGGLE_PACKAGE_EXPAND', payload: group.package })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'pointer', background: SEV_DIM[group.highestSeverity], flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: SEV_COLOR[group.highestSeverity] }}>{isExpanded ? '▼' : '▶'}</span>
                        <span onClick={(e) => { e.stopPropagation(); handleDeepScan(group.package, group.version, snapshot.ecosystem) }} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--blue)', cursor: 'pointer' }}>{group.package}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>v{group.version}</span>
                        <span style={{ flex: 1 }} />
                        <span className="sev-badge" style={{ background: SEV_DIM[group.highestSeverity], color: SEV_COLOR[group.highestSeverity] }}>{group.highestSeverity}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{group.vulnerabilities.length} CVEs</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {group.vulnerabilities.map(v => (
                            <div key={v.cve_id} onClick={() => dispatch({ type: 'SET_SELECTED', payload: v.cve_id })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 10, background: state.selected === v.cve_id ? 'var(--orange-dim)' : 'var(--bg-card)', border: `1px solid ${state.selected === v.cve_id ? 'var(--orange)' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>{v.cve_id}</span>
                              <span className="sev-badge" style={{ background: SEV_DIM[v.severity], color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: SEV_COLOR[v.severity], fontWeight: 700 }}>CVSS {v.cvss_score}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description?.slice(0, 80)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Dependency Graph */}
        {state.tab === 'tree' && <DependencyGraph data={snapshot} />}

        {/* Tab: Fix Suggestions */}
        {state.tab === 'fixes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fixes.map((v, i) => (
              <div key={v.cve_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--orange-dim)', border: '1px solid var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--orange)', flexShrink: 0 }}>{i+1}</div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, flex: 1 }}>{pkgName(v)}</span>
                  <span className="sev-badge" style={{ background: SEV_DIM[v.severity], color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: SEV_COLOR[v.severity] }}>CVSS {v.cvss_score}</span>
                  {v.fix_version && <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>→ v{v.fix_version}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{v.description}</div>
                {v.fix_version && (
                  <div style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{installCmd(v, snapshot.ecosystem)}</span>
                    <button onClick={() => navigator.clipboard?.writeText(installCmd(v, snapshot.ecosystem))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>Copy</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className="analytics-right">
        {/* CVE Detail */}
        <div className="analytics-panel-card">
          <div className="panel-header">
            <span>CVE Details</span>
            {selectedVuln && <span className="sev-badge" style={{ background: SEV_DIM[selectedVuln.severity], color: SEV_COLOR[selectedVuln.severity] }}>{selectedVuln.severity}</span>}
            {selectedVuln && <span onClick={() => dispatch({ type: 'SET_SELECTED', payload: null })} style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, marginLeft: 'auto' }}>✕</span>}
          </div>
          <div style={{ padding: 14 }}>
            {!selectedVuln ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 12, gap: 8 }}>
                <span style={{ fontSize: 24 }}>🔍</span>
                <span>Click a vulnerability to see details</span>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{pkgName(selectedVuln)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>v{pkgVersion(selectedVuln)}</div>
                
                <div className="panel-field">
                  <div className="panel-label">CVE ID</div>
                  <span style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{selectedVuln.cve_id}</span>
                </div>
                <div className="panel-field">
                  <div className="panel-label">CVSS Score</div>
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: SEV_COLOR[selectedVuln.severity] }}>{selectedVuln.cvss_score}</span>
                    <div style={{ marginTop: 4, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(selectedVuln.cvss_score/10)*100}%`, background: `linear-gradient(90deg,var(--green),var(--high),var(--critical))`, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
                <div className="panel-field">
                  <div className="panel-label">Description</div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedVuln.description}</span>
                </div>

                {selectedVuln.fix_version && (
                  <div style={{ background: 'var(--green-dim)', border: '1px solid var(--fix-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 8 }}>
                    <div className="panel-label" style={{ color: 'var(--green)' }}>RECOMMENDED FIX</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)' }}>{fixText(selectedVuln)}</div>
                    <div style={{ marginTop: 8, background: 'var(--code-bg)', borderRadius: 4, padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{installCmd(selectedVuln, snapshot.ecosystem)}</span>
                      <button onClick={() => navigator.clipboard?.writeText(installCmd(selectedVuln, snapshot.ecosystem))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>Copy</button>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 10 }}>
                  <div className="panel-label">REFERENCES</div>
                  {[`nvd.nist.gov/vuln/detail/${selectedVuln.cve_id}`, `osv.dev/${selectedVuln.cve_id}`].map(ref => (
                    <a key={ref} href={`https://${ref}`} target="_blank" rel="noreferrer" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>↗ {ref}</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Risk Breakdown */}
        <div className="analytics-panel-card">
          <div className="panel-header"><span>Risk Breakdown</span></div>
          <div style={{ padding: 14 }}>
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
                <span style={{ width: 55, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{s}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (counts[s]||0) * 25)}%`, background: SEV_COLOR[s], borderRadius: 3 }} />
                </div>
                <span style={{ color: SEV_COLOR[s], fontFamily: 'var(--font-mono)', fontWeight: 700, width: 16, textAlign: 'right' }}>{counts[s]||0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scan Info */}
        <div className="analytics-panel-card">
          <div className="panel-header"><span>Scan Info</span></div>
          <div style={{ padding: '10px 14px' }}>
            {[['Direct',directDeps],['Transitive',transitiveDeps],['Total',totalPackages],['Vulns',totalVulns],['Source',snapshot.project_name||'package.json'],['DBs','NVD + OSV']].map(([l,v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
