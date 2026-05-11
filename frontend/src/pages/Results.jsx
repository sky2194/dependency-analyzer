import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import API_BASE from '../config'
import DependencyGraph from '../components/DependencyGraph'
import validateContract from '../utils/validateSnapshot'
import normalizeSnapshot from '../utils/normalizeSnapshot'
import SeverityBadge from '../components/SeverityBadge'
import VulnerabilityReport from '../components/VulnerabilityReport'
import SummaryCard from '../components/SummaryCard'
import Tooltip from '../components/Tooltip'
import CompareScans from '../components/CompareScans'

const TABS = ['Dependency Graph', 'Vulnerabilities']
const SEVS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const SEV_COLORS = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' }

function SummaryCard({ value, label, color, onClick, hint }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: 'var(--surface)', border: `1px solid ${hover ? color || 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '14px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', transform: hover ? 'translateY(-2px)' : 'none', boxShadow: hover ? `0 4px 16px ${color || 'var(--orange)'}22` : 'none' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: color || 'var(--info)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{label}</div>
      {hover && <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 10, color: color || 'var(--accent)', opacity: 0.8 }}>{hint} →</div>}
    </div>
  )
}

export default function Results() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [sevFilter, setSevFilter] = useState('ALL')
  const [exportError, setExportError] = useState('')
  const result = state?.result

  if (!result) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <p style={{ color: 'var(--muted)', marginBottom: 16 }}>No results found.</p>
      <button onClick={() => navigate('/')} style={{ padding: '10px 20px', background: 'var(--accent)', color: 'var(--white)', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>← Back to Scanner</button>
    </div>
  )

  const exportReport = async (type) => {
    try {
      const res = await fetch(`${API_BASE}/api/export/${type}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(result)
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sca-report-${result.project_name}.${type === 'pdf' ? 'html' : 'csv'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch { setExportError('Export failed — is the backend running?') }
  }

  // PHASE 6: TRANSACTION IMMUTABILITY RULE - Block stale transactions
  const [activeTransactionId, setActiveTransactionId] = useState(result.transaction_id)
  
  // PHASE 7: FAIL-LOUD STRATEGY - Contract violations fail hard
  let frozenResult, snapshot
  try {
    if (result.transaction_id !== activeTransactionId) {
      throw new Error(`STALE TRANSACTION BLOCKED - Expected ${activeTransactionId}, got ${result.transaction_id}`)
    }

    // PHASE 4: PURE RENDERING RULE - Freeze snapshot and validate contract
    frozenResult = Object.freeze(result)
    validateContract(frozenResult)
    
    // PHASE 4: STRICT - No normalization fallbacks, pass-through only
    snapshot = normalizeSnapshot(frozenResult)
  } catch (error) {
    // PHASE 7: FAIL-LOUD - Render error boundary, no fallback UI
    return (
      <div style={{ textAlign: 'center', padding: 80, background: 'var(--bg-card)', border: '1px solid var(--red)', borderRadius: 'var(--radius)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚨</div>
        <h2 style={{ color: 'var(--red)', marginBottom: 16 }}>CONTRACT VIOLATION</h2>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
          {error.message}
        </p>
        <button onClick={() => navigate('/scan')} style={{ marginTop: 24, padding: '12px 24px', background: 'var(--red)', color: 'var(--white)', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
          ← Return to Scan
        </button>
      </div>
    )
  }

  const vulns = snapshot.vulnerabilities
  const summary = snapshot.summary
  const counts = {
    CRITICAL: summary.critical,
    HIGH: summary.high,
    MEDIUM: summary.medium,
    LOW: summary.low,
  }

  const goToGraph = () => setTab(0)
  const goToVulns = (sev = 'ALL') => { setTab(1); setSevFilter(sev) }

  return (
    <div className="page-container-md" style={{ overflowX: 'hidden', width: '100%', maxWidth: '100%' }}>

      {/* Header: title left, actions right */}
      <div className="results-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Title — always first on mobile via CSS order */}
        <div className="results-title" style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, marginBottom: 4 }}>
            Scan Results
          </h1>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            <Tooltip termKey="sca">SCA</Tooltip> complete —{' '}
            <strong style={{ color: 'var(--text)' }}>{result.project_name || 'my-app'}</strong>
            {' · '}{result.total_packages} packages{' · '}
            {result.ecosystem?.toUpperCase() || 'NPM'}
          </div>
        </div>

        {/* Actions — right aligned */}
        <div className="results-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => navigate('/', { state: { lastEcosystem: result.ecosystem } })}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
            ← New Scan
          </button>
          <CompareScans current={result} />
          <button onClick={() => exportReport('pdf')}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
            📄 Export PDF
          </button>
          <button onClick={() => exportReport('csv')}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
            📊 Export CSV
          </button>
        </div>
      </div>


      {/* Export error */}
      {exportError && (
        <div style={{ background: 'var(--vuln-bg)', border: '1px solid var(--vuln-border)', borderRadius: 'var(--radius)', padding: '10px 16px', color: 'var(--red)', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          ⚠️ {exportError}
          <button onClick={() => setExportError('')} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Clickable summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 28 }}>
        <SummaryCard value={summary.total_packages} label="Total Packages" color="var(--info)" onClick={goToGraph} hint="View Graph" />
        <SummaryCard value={summary.vulnerabilities} label="Vulnerabilities" color="var(--critical)" onClick={() => goToVulns('ALL')} hint="View Details" />
        {SEVS.map(s => (
          <SummaryCard key={s} value={counts[s]} label={<SeverityBadge level={s} />} color={SEV_COLORS[s]} onClick={() => goToVulns(s)} hint={`Filter ${s}`} />
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ padding: '9px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === i ? 'var(--accent)' : 'transparent'}`, color: tab === i ? 'var(--accent)' : 'var(--muted)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: -1 }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <DependencyGraph data={snapshot} />}
      {tab === 1 && <VulnerabilityReport data={snapshot} defaultFilter={sevFilter} />}
    </div>
  )
}
