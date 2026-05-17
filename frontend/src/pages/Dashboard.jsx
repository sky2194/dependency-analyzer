import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ECOSYSTEMS, { detectEcosystem } from '../data/ecosystems'
import FileUpload from '../components/FileUpload'
import Tooltip from '../components/Tooltip'

const SEVS = [
  { level: 'CRITICAL', score: '9–10', color: 'var(--critical)', desc: 'Fix immediately' },
  { level: 'HIGH',     score: '7–8',  color: 'var(--high)', desc: 'Fix this week' },
  { level: 'MEDIUM',   score: '4–6',  color: 'var(--medium)', desc: 'Fix this month' },
  { level: 'LOW',      score: '0–3',  color: 'var(--low)', desc: 'Fix when convenient' },
]

function MediationPanel({ eco }) {
  if (!eco || !eco.mediationExample) return null
  const ex = eco.mediationExample
  return (
    <div className="scanner-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--accent)' }}>
        ⚖️ <Tooltip termKey="mediation">DEPENDENCY MEDIATION</Tooltip>
        <span style={{ marginLeft: 8, fontSize: 10, color: eco.color, fontWeight: 400 }}>{eco.icon} {eco.label} rules</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>{eco.mediationRule}</div>
      <div style={{ background: 'var(--code-bg)', borderRadius: 6, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        <div style={{ color: 'var(--muted)', marginBottom: 8 }}>{ex.package} needed by:</div>
        {Array.isArray(ex.contestants) && ex.contestants.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)', fontSize: 10, whiteSpace: 'nowrap' }}>depth {c.depth}</span>
            <span style={{ color: c.safe ? 'var(--green)' : 'var(--high)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.requester}>{c.requester}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--muted)' }}>{ex.package}@</span>
              <span style={{ color: c.safe ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{c.version}</span>
              <span style={{ fontSize: 10, color: c.safe ? 'var(--green)' : 'var(--red)' }}>{c.safe ? '✓' : '⚠️'}</span>
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
          <span style={{ color: 'var(--accent2)' }}>Winner: </span>
          <span style={{ color: 'var(--red)', fontWeight: 700 }}>{ex.package}@{ex.winner}</span>
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
      <div className="scanner-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
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
      <div className="scanner-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--accent)' }}>DEPENDENCY TYPES</div>
        {[
          { label: 'Direct', key: 'direct', color: 'var(--green)', desc: "You added this. It's in your config file." },
          { label: 'Transitive', key: 'transitive', color: 'var(--yellow)', desc: 'Pulled in automatically. Most vulnerabilities are found here.' },
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
      <div className="scanner-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--accent)' }}>CVE PATH EXAMPLE</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 2 }}>
          {['my-app', 'express', 'body-parser', 'lodash ⚠️'].map((p, i) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--border)', marginLeft: i * 10 }}>└─</span>}
              <span style={{ marginLeft: i > 0 ? i * 10 : 0, color: p.includes('⚠️') ? 'var(--red)' : 'var(--text)' }}>{p}</span>
              {i === 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>← your app</span>}
              {p.includes('⚠️') && <span style={{ fontSize: 10, color: 'var(--red)' }}>← CVE here</span>}
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
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [file, setFile] = useState('')
  const navigate = useNavigate()
  const [eco, setEco] = useState(lastEco ? (ECOSYSTEMS[lastEco] || ECOSYSTEMS.npm) : ECOSYSTEMS.npm)



  const analyze = async (content, filename) => {   
    setError('')
    const detectedEco = detectEcosystem(filename)
    navigate('/scanning', { state: { code: content, ecosystem: detectedEco?.label?.toLowerCase() || 'npm' } })
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 6, letterSpacing: -0.3 }}>
          Dependency Vulnerability Scanner
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, maxWidth: 600 }}>
          Upload your dependency manifest to scan all direct and transitive packages for known CVEs.
          Results are sourced from <strong style={{color:'var(--text)'}}>NVD</strong> and <strong style={{color:'var(--text)'}}>OSV</strong> — the industry-standard vulnerability databases.
        </p>
      </div>

      {error && <div style={{ background: 'var(--vuln-bg)', border: '1px solid var(--vuln-border)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: 12, marginBottom: 16 }}>⚠️ {error}</div>}
      
      <div className="scanner-layout">
        <FileUpload onAnalyze={analyze} loading={false} onEcosystemChange={setEco} />
        <RightPanel eco={eco} />
      </div>
    </div>
  )
}
