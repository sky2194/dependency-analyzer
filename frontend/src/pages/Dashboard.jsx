import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import API_BASE from '../config'
import ECOSYSTEMS, { detectEcosystem } from '../data/ecosystems'
import { useScan } from '../App'
import FileUpload from '../components/FileUpload'
import Tooltip from '../components/Tooltip'

const LOADING_STEPS = [
  'Parsing dependency file...',
  'Resolving transitive dependencies...',
  'Building dependency graph...',
  'Scanning NVD database...',
  'Scanning OSV database...',
  'Calculating CVE paths...',
]

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
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
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
          { label: 'Direct', key: 'direct', color: 'var(--green)', desc: "You added this. It's in your config file." },
          { label: 'Transitive', key: 'transitive', color: 'var(--yellow)', desc: 'Pulled in automatically. Most CVEs hide here.' },
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
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [file, setFile] = useState('')
  const { setScanning, setScanProject } = useScan()
  const navigate = useNavigate()
  const [eco, setEco] = useState(lastEco ? (ECOSYSTEMS[lastEco] || ECOSYSTEMS.npm) : ECOSYSTEMS.npm)

  const loadExample = (type) => {
    const examples = {
      'npm': {
        filename: 'package-lock.json',
        content: JSON.stringify({
          "name": "example-app",
          "version": "1.0.0",
          "lockfileVersion": 2,
          "packages": {
            "node_modules/lodash": {
              "version": "4.17.21",
              "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"
            }
          }
        }, null, 2)
      },
      'pypi': {
        filename: 'requirements.txt',
        content: 'flask==2.0.1\nrequests==2.26.0\njinja2==3.0.1'
      },
      'maven': {
        filename: 'pom.xml',
        content: `<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>example-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.8</version>
    </dependency>
  </dependencies>
</project>`
      }
    }
    
    const example = examples[type] || examples['npm']
    setCode(example.content)
    setFile(example.filename)
    setEco(ECOSYSTEMS[type] || ECOSYSTEMS.npm)
  }

  const analyze = async (content, filename) => {   
    setLoading(true); setScanning(true); setScanProject(filename); setError(''); setLoadingStep(0)
    const detectedEco = detectEcosystem(filename)
    
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 2000)
    try {
      const res = await axios.post(`${API_BASE}/api/scan`, { content, ecosystem: detectedEco?.label?.toLowerCase() || 'npm' }, { timeout: 180000 })
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
      setError('Scan failed — please try again')
    }
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

      {/* Fullscreen loading overlay */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 48px', maxWidth: 520, width: '90%', boxShadow: '0 20px 60px var(--overlay-bg)' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 16, display: 'inline-block', animation: 'spin 2s linear infinite' }}>⚙️</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Scanning Dependencies</h2>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Checking against NVD + OSV databases...</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {LOADING_STEPS.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${i < loadingStep ? 'var(--ok)' : i === loadingStep ? 'var(--accent)' : 'var(--border)'}`, background: i < loadingStep ? 'var(--ok)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, transition: 'all 0.3s', color: i < loadingStep ? 'var(--white)' : 'var(--accent)' }}>
                    {i < loadingStep ? '✓' : i === loadingStep ? '●' : ''}
                  </div>
                  <span style={{ color: i < loadingStep ? 'var(--ok)' : i === loadingStep ? 'var(--text)' : 'var(--muted)', transition: 'color 0.3s' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ background: 'var(--vuln-bg)', border: '1px solid var(--vuln-border)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: 12, marginBottom: 16 }}>⚠️ {error}</div>}
      
      {/* <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => loadExample('npm')} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', color: 'var(--text)', transition: 'all 0.15s' }}>
          📦 Load npm example
        </button>
        <button onClick={() => loadExample('pypi')} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', color: 'var(--text)', transition: 'all 0.15s' }}>
          🐍 Load Python example
        </button>
        <button onClick={() => loadExample('maven')} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', color: 'var(--text)', transition: 'all 0.15s' }}>
          ☕ Maven Dependency Mediation rules
        </button>
      </div> */}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        <FileUpload onAnalyze={analyze} loading={loading} onEcosystemChange={setEco} />
        <RightPanel eco={eco} />
      </div>
    </div>
  )
}
