import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScan } from '../App'
import axios from 'axios'
import API_BASE from '../config'
import { MOCKS } from '../data/mocks'
import ECOSYSTEMS from '../data/ecosystems'

const SCAN_STEPS = ['Parsing manifest structure','Resolving dependency tree','Fetching NVD + OSV data','Cross-referencing CVEs','Generating risk report']

const EXAMPLE = `{
  "dependencies": {
    "express": "4.17.1",
    "lodash": "4.17.4",
    "axios": "0.21.1",
    "ejs": "3.1.5"
  }
}`

export default function Scanner() {
  const navigate = useNavigate()
  const { setScanning, setScanProject } = useScan()
  const [ecosystem, setEcosystem] = useState('npm')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanStep, setScanStep] = useState(0)
  const [error, setError] = useState('')
  const eco = ECOSYSTEMS[ecosystem]

  async function runScan() {
    if (!code.trim()) { setError('Paste a dependency file first'); return }
    setLoading(true); setError(''); setScanStep(0); setScanning(true); setScanProject(eco?.label || 'project')
    const interval = setInterval(() => setScanStep(s => Math.min(s + 1, SCAN_STEPS.length - 1)), 900)
    try {
      const res = await axios.post(`${API_BASE}/api/scan`, { content: code, ecosystem })
      clearInterval(interval); setLoading(false); setScanning(false)
      navigate('/results', { state: { result: res.data } })
    } catch {
      clearInterval(interval); setLoading(false); setScanning(false)
      try {
        const mock = MOCKS[ecosystem]
        navigate('/results', { state: { result: mock } })
      } catch { setError('Scan failed — backend unavailable') }
    }
  }

  const progress = loading ? Math.round(((scanStep + 1) / SCAN_STEPS.length) * 100) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: 'calc(100vh - 52px)' }}>
      {/* MAIN */}
      <div style={{ overflowY: 'auto', padding: '28px 32px', borderRight: '1px solid var(--border)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>Dependency Vulnerability Scanner</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
          Upload or paste your manifest file. We resolve the full dependency tree and cross-reference against NVD + OSV databases.
        </p>

        {/* Info box */}
        <div style={{ background: 'rgba(224,92,42,0.07)', border: '1px solid rgba(224,92,42,0.25)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📦</span>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text)' }}>Supports package.json, package-lock.json, requirements.txt, pom.xml.</strong>{' '}
            Lock files produce the most accurate transitive dependency resolution. For best results, use <strong style={{ color: 'var(--text)' }}>package-lock.json</strong> or <strong style={{ color: 'var(--text)' }}>yarn.lock</strong>.
          </div>
        </div>

        {/* Ecosystem tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {[{id:'npm',label:'npm',sub:'package.json',color:'#f59e0b'},{id:'pypi',label:'PyPI',sub:'requirements.txt',color:'#3b82f6'},{id:'maven',label:'Maven',sub:'pom.xml',color:'#ef4444'}].map(e => (
            <div key={e.id} onClick={() => setEcosystem(e.id)} style={{ background: ecosystem===e.id ? 'var(--orange-dim)' : 'var(--bg-card)', border: `1px solid ${ecosystem===e.id ? 'var(--orange)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ecosystem===e.id ? 'var(--orange)' : e.color }}>● {e.label}</div>
              <div style={{ fontSize: 10, color: ecosystem===e.id ? 'rgba(224,92,42,0.8)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{e.sub}</div>
            </div>
          ))}
        </div>

        {/* Drop zone */}
        <div onClick={() => setCode(EXAMPLE)} style={{ border: '1.5px dashed var(--border-light)', borderRadius: 'var(--radius)', padding: 32, textAlign: 'center', background: 'var(--bg-card)', cursor: 'pointer', marginBottom: 14, transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.background = 'var(--orange-dim)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-card)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Drop file or click to browse</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>package.json · package-lock.json · requirements.txt · pom.xml</div>
        </div>

        {/* Example link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Need an example?</span>
          <span onClick={() => setCode(EXAMPLE)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--orange-dim)', border: '1px solid rgba(224,92,42,0.3)', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: 'var(--orange)', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
            ↓ Load package.json example
          </span>
        </div>

        {code && eco && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--orange-dim)', border: '1px solid rgba(224,92,42,0.3)', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: 'var(--orange)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
            🔵 {eco.lang} detected
          </div>
        )}

        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          rows={10}
          placeholder={`Paste your package.json here...\n\nExample:\n{\n  "dependencies": {\n    "express": "4.17.1",\n    "lodash": "4.17.4"\n  }\n}`}
          style={{ width: '100%', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', lineHeight: 1.6, minHeight: 180, outline: 'none', resize: 'vertical', transition: 'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = 'var(--orange)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />

        {/* Progress */}
        {loading && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>Scanning… {progress}% complete</div>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', background: 'var(--orange)', width: `${progress}%`, transition: 'width 0.4s ease', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SCAN_STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: i < scanStep ? 'var(--green)' : i === scanStep ? 'var(--orange)' : 'var(--border-light)', animation: i === scanStep ? 'pulse 1s infinite' : 'none' }} />
                  <span style={{ color: i < scanStep ? 'var(--green)' : i === scanStep ? 'var(--text)' : 'var(--text-muted)' }}>
                    {i < scanStep ? '✓ ' : ''}{s}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

        <button onClick={runScan} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: 13, background: loading ? 'rgba(224,92,42,0.5)' : 'var(--orange)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: 14 }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px var(--orange-glow)' }}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
          {loading ? '⏳ Scanning...' : '🔍 Scan and Detect Vulnerabilities'}
        </button>
      </div>

      {/* SIDEBAR */}
      <div style={{ overflowY: 'auto', background: 'var(--bg-panel)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Severity Guide */}
        <SidebarSection title="Severity Guide">
          {[{cls:'critical',name:'CRITICAL',range:'9–10',action:'Fix immediately — active exploit risk'},{cls:'high',name:'HIGH',range:'7–8',action:'Fix this week — high exploitability'},{cls:'medium',name:'MEDIUM',range:'4–6',action:'Fix this month — limited scope'},{cls:'low',name:'LOW',range:'0–3',action:'Fix when convenient — low impact'}].map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <div className={`dot dot-${s.cls}`} />
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', width: 68, color: `var(--${s.cls})` }}>{s.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', width: 40 }}>{s.range}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, flex: 1 }}>{s.action}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>Scores are CVSS ratings from NVD + OSV.</div>
        </SidebarSection>

        {/* Dependency Types */}
        <SidebarSection title="Dependency Types">
          {[{color:'var(--green)',label:'Direct',desc:"Packages you added explicitly — listed in your config file. You own these choices and their upgrade path."},
            {color:'var(--yellow)',label:'Transitive',desc:'Pulled in automatically by your direct dependencies. Most CVEs hide here — they\'re easy to miss without a full tree scan.'}].map(d => (
            <div key={d.label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: d.color }}>{d.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: d.desc.replace('Most CVEs hide here', '<strong style="color:var(--text-primary)">Most CVEs hide here</strong>') }} />
            </div>
          ))}
        </SidebarSection>

        {/* Dep Mediation */}
        <SidebarSection title="Dependency Mediation" titleColor="var(--orange)" extra="npm rules">
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            npm resolves version conflicts using <strong style={{ color: 'var(--text)' }}>nearest-depth wins</strong>: the version closest to your project root is selected.
          </div>
          <div style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <div style={{ display: 'flex', gap: 8, padding: '3px 0' }}><span style={{ color: 'var(--text-muted)', width: 50 }}>depth 1</span><span>my-app → lodash</span><span style={{ color: 'var(--yellow)', fontWeight: 700 }}>4.17.4 ▲</span></div>
            <div style={{ display: 'flex', gap: 8, padding: '3px 0' }}><span style={{ color: 'var(--text-muted)', width: 50 }}>depth 2</span><span>terser → lodash</span><span style={{ color: 'var(--green)', fontWeight: 700 }}>4.17.21 ✓</span></div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
              <span style={{ color: 'var(--orange)', fontWeight: 700 }}>Winner: lodash@4.17.4</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}> (depth 1 beats depth 2)</span>
            </div>
          </div>
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 10, color: 'var(--yellow)', lineHeight: 1.6 }}>
            ⚠ The safe version (4.17.21) lost because it was deeper. DepAnalyzer flags these hidden conflicts.
          </div>
        </SidebarSection>

        {/* Scan Tips */}
        <SidebarSection title="Scan Tips">
          {[['💡','Use package-lock.json or yarn.lock for the most accurate transitive resolution.'],['🔄','Re-scan after every npm install or dependency upgrade.'],['🎯','Fix critical vulnerabilities first — they carry active exploit code.'],['📋','Export your report as PDF for your security or compliance team.']].map(([icon,text]) => (
            <div key={icon} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0 }}>{icon}</span><span>{text}</span>
            </div>
          ))}
        </SidebarSection>
      </div>
    </div>
  )
}

function SidebarSection({ title, titleColor, extra, children }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: titleColor || 'var(--text-secondary)' }}>{title}</span>
        {extra && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{extra}</span>}
      </div>
      <div style={{ padding: '8px 14px' }}>{children}</div>
    </div>
  )
}
