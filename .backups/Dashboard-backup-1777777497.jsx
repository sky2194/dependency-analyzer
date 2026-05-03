import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useScan } from '../App'
import axios from 'axios'
import API_BASE from '../config'
import FileUpload from '../components/FileUpload'
import Tooltip from '../components/Tooltip'
import ECOSYSTEMS, { detectEcosystem } from '../data/ecosystems'
import { MOCKS } from '../data/mocks'

const LOADING_STEPS = [
  'Parsing dependency file...',
  'Resolving transitive dependencies...',
  'Building dependency graph...',
  'Scanning NVD database...',
  'Scanning OSV database...',
  'Calculating CVE paths...',
]

const SEVS = [
  { level: 'CRITICAL', score: '9–10', color: '#ef4444', desc: 'Fix immediately' },
  { level: 'HIGH',     score: '7–8',  color: '#f97316', desc: 'Fix this week' },
  { level: 'MEDIUM',   score: '4–6',  color: '#eab308', desc: 'Fix this month' },
  { level: 'LOW',      score: '0–3',  color: '#3b82f6', desc: 'Fix when convenient' },
]

function MediationPanel({ eco }) {
  if (!eco || !eco.mediationExample) return null
  const ex = eco.mediationExample
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--accent)' }}>
        ⚖️ <Tooltip termKey="mediation">DEPENDENCY MEDIATION</Tooltip>
        <span style={{ marginLeft: 8, fontSize: 10, color: eco.color, fontWeight: 400 }}>{eco.icon} {eco.label} rules</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>{eco.mediationRule}</div>
      <div style={{ background: 'var(--code-bg)', borderRadius: 6, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        <div style={{ color: 'var(--muted)', marginBottom: 8 }}>{ex.package} needed by:</div>
        {ex.contestants.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)', fontSize: 10, whiteSpace: 'nowrap' }}>depth {c.depth}</span>
            <span style={{ color: c.safe ? '#22c55e' : '#f97316', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.requester}>{c.requester}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--muted)' }}>{ex.package}@</span>
              <span style={{ color: c.safe ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{c.version}</span>
              <span style={{ fontSize: 10, color: c.safe ? '#22c55e' : '#ef4444' }}>{c.safe ? '✓' : '⚠️'}</span>
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
          <span style={{ color: 'var(--accent2)' }}>Winner: </span>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>{ex.package}@{ex.winner}</span>
          <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 6 }}>({ex.winReason})</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--vuln-text)', marginTop: 8, lineHeight: 1.5 }}>⚠️ {ex.danger}</div>
      <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 6, lineHeight: 1.5 }}>🛠️ Fix: {eco.mediationFix}</div>
    </div>
  )
}

function RightPanel({ eco }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 68, maxHeight: 'calc(100vh - 90px)', overflowY: 'auto', paddingRight: 4 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--accent)' }}><Tooltip termKey="severity">SEVERITY GUIDE</Tooltip></div>
        {SEVS.map(s => (
          <div key={s.level} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: s.color, width: 60 }}>{s.level}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', width: 36 }}>{s.score}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.desc}</span>
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          Scores are <Tooltip termKey="cvss">CVSS</Tooltip> ratings from <Tooltip termKey="nvd">NVD</Tooltip> + <Tooltip termKey="osv">OSV</Tooltip>.
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--accent)' }}>DEPENDENCY TYPES</div>
        {[
          { label: 'Direct', key: 'direct', color: '#22c55e', desc: "You added this. It's in your config file." },
          { label: 'Transitive', key: 'transitive', color: '#f59e0b', desc: 'Pulled in automatically. Most CVEs hide here.' },
        ].map(d => (
          <div key={d.label} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0, marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: d.color }}><Tooltip termKey={d.key}>{d.label}</Tooltip></div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{d.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <MediationPanel eco={eco} />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--accent)' }}>CVE PATH EXAMPLE</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 2 }}>
          {['my-app', 'express', 'body-parser', 'lodash ⚠️'].map((p, i) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--border)', marginLeft: i * 10 }}>└─</span>}
              <span style={{ marginLeft: i > 0 ? i * 10 : 0, color: p.includes('⚠️') ? '#ef4444' : 'var(--text)' }}>{p}</span>
              {i === 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>← your app</span>}
              {p.includes('⚠️') && <span style={{ fontSize: 10, color: '#ef4444' }}>← CVE here</span>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          <Tooltip termKey="rootCause">Root cause</Tooltip>: express → body-parser → lodash.
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const location = useLocation()
  const lastEco = location.state?.lastEcosystem
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const [eco, setEco] = useState(lastEco ? (ECOSYSTEMS[lastEco] || ECOSYSTEMS.npm) : ECOSYSTEMS.npm)
  const { setScanning, setScanProject } = useScan()
  const navigate = useNavigate()

  const analyze = async (content, filename) => {
    setLoading(true); setScanning(true); setScanProject(filename); setError(''); setLoadingStep(0)
    const detectedEco = detectEcosystem(filename)
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 2000)
    try {
      const res = await axios.post(`${API_BASE}/api/analyze`, { content, filename }, { timeout: 180000 })
      clearInterval(interval)
      setLoading(false); setScanning(false); setScanProject('')
      navigate('/results', { state: { result: res.data } })
    } catch (err) {
      clearInterval(interval)
      setLoading(false); setScanning(false); setScanProject('')
      const status = err?.response?.status
      if (status === 408) { setError('Scan timed out — try a smaller file'); return }
      if (status === 413) { setError('File too large — maximum 512KB'); return }
      if (status === 429) { setError('Too many requests — wait 60s and try again'); return }
      const ecoKey = detectedEco?.label?.toLowerCase() || 'npm'
      const mockResult = MOCKS[ecoKey] || MOCKS.npm
      mockResult._isMock = true
      navigate('/results', { state: { result: mockResult } })
    }
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: 2, marginBottom: 6 }}>SOFTWARE COMPOSITION ANALYSIS</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>
          Scan for <Tooltip termKey="cve">CVEs</Tooltip> across all <Tooltip termKey="direct">direct</Tooltip> + <Tooltip termKey="transitive">transitive dependencies</Tooltip>. Uses NVD + OSV. Supports <Tooltip termKey="npm">npm</Tooltip>, <Tooltip termKey="pypi">PyPI</Tooltip>, <Tooltip termKey="maven">Maven</Tooltip>.
        </p>
      </div>

      {/* Loading overlay — replaces right panel during scan */}
      {loading ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 20, color: 'var(--accent)' }}>⏳ Analyzing dependencies...</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {LOADING_STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${i < loadingStep ? 'var(--ok)' : i === loadingStep ? 'var(--accent)' : 'var(--border)'}`, background: i < loadingStep ? 'var(--ok)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, transition: 'all 0.3s', color: i < loadingStep ? '#fff' : 'var(--accent)' }}>
                  {i < loadingStep ? '✓' : i === loadingStep ? '●' : ''}
                </div>
                <span style={{ color: i < loadingStep ? 'var(--ok)' : i === loadingStep ? 'var(--text)' : 'var(--muted)', transition: 'color 0.3s' }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {error && <div style={{ background: 'var(--vuln-bg)', border: '1px solid var(--vuln-border)', borderRadius: 'var(--radius)', padding: '10px 14px', color: '#ef4444', fontSize: 12, marginBottom: 16 }}>⚠️ {error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
            <FileUpload onAnalyze={analyze} loading={loading} onEcosystemChange={setEco} />
            <RightPanel eco={eco} />
          </div>
        </>
      )}
    </div>
  )
}


