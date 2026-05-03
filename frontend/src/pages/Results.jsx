import { useLocation, useNavigate } from 'react-router-dom'
import API_BASE from '../config'
import { useState } from 'react'
import DependencyGraph from '../components/DependencyGraph'
import VulnerabilityReport from '../components/VulnerabilityReport'
import SeverityBadge from '../components/SeverityBadge'
import Tooltip from '../components/Tooltip'
import CompareScans from '../components/CompareScans'

const TABS = ['Dependency Graph', 'Vulnerabilities']
const SEVS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const SEV_COLORS = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' }

function SummaryCard({ value, label, color, onClick, hint }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: 'var(--surface)', border: `1px solid ${hover ? color || 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '14px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', transform: hover ? 'translateY(-2px)' : 'none', boxShadow: hover ? `0 4px 16px ${(color || '#e05c2a')}22` : 'none' }}>
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
      <button onClick={() => navigate('/')} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>← Back to Scanner</button>
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

  const vulns = result.vulnerabilities || []
  const warnings = result.warnings || []
  const counts = SEVS.reduce((a, s) => ({ ...a, [s]: vulns.filter(v => v.severity === s).length }), {})

  const goToGraph = () => setTab(0)
  const goToVulns = (sev = 'ALL') => { setTab(1); setSevFilter(sev) }

  return (
    <div className="page-container-md">

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

      {/* Mock data warning */}
      {result._isMock && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 'var(--radius)', padding: '10px 16px', color: '#f59e0b', fontSize: 13, marginBottom: 16 }}>
          ⚠️ <strong>Demo data shown</strong> — backend not running. Start backend with{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>./start.sh backend</code> for real results.
        </div>
      )}

      {/* Export error */}
      {exportError && (
        <div style={{ background: 'var(--vuln-bg)', border: '1px solid var(--vuln-border)', borderRadius: 'var(--radius)', padding: '10px 16px', color: '#ef4444', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          ⚠️ {exportError}
          <button onClick={() => setExportError('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Unpinned version warnings */}
      {warnings.length > 0 && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--accent2)', marginBottom: 8 }}>
            ⚠️ {warnings.length} unpinned version{warnings.length > 1 ? 's' : ''} detected
          </div>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--warn-text)', marginBottom: 4, lineHeight: 1.5 }}>• {w}</div>
          ))}
        </div>
      )}

      {/* Clickable summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 28 }}>
        <SummaryCard value={result.total_packages} label="Total Packages" color="var(--info)" onClick={goToGraph} hint="View Graph" />
        <SummaryCard value={vulns.length} label="Vulnerabilities" color="var(--critical)" onClick={() => goToVulns('ALL')} hint="View All" />
        {SEVS.map(s => (
          <SummaryCard key={s} value={counts[s]} label={<SeverityBadge level={s} />} color={SEV_COLORS[s]} onClick={() => goToVulns(s)} hint={`Filter ${s}`} />
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ padding: '9px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === i ? 'var(--accent)' : 'transparent'}`, color: tab === i ? 'var(--accent)' : 'var(--muted)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: -1 }}>
            {t} {i === 1 && vulns.length > 0 && <span style={{ background: 'var(--critical)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 4 }}>{vulns.length}</span>}
          </button>
        ))}
      </div>

      {tab === 0 && <DependencyGraph data={result} />}
      {tab === 1 && <VulnerabilityReport data={result} defaultFilter={sevFilter} />}
    </div>
  )
}
