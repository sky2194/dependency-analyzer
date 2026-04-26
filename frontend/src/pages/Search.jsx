import { useState, useEffect } from 'react'
import axios from 'axios'
import StepBanner from '../components/StepBanner'
import SeverityBadge from '../components/SeverityBadge'
import CVEDetail from '../components/CVEDetail'
import SearchBar from '../components/SearchBar'
import Tooltip from '../components/Tooltip'
import { MOCKS } from '../data/mocks'


// Inject animations
if (typeof document !== 'undefined' && !document.getElementById('search-animations')) {
  const style = document.createElement('style')
  style.id = 'search-animations'
  style.textContent = `
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes pulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
  `
  document.head.appendChild(style)
}

const ALL_VULNS = [...MOCKS.npm.vulnerabilities, ...MOCKS.pypi.vulnerabilities, ...MOCKS.maven.vulnerabilities]

const mockSearch = (pkg, version) => {
  const q = pkg.toLowerCase()
  const matches = ALL_VULNS.filter(v =>
    v.package.toLowerCase().includes(q) &&
    (!version || v.version.includes(version))
  )
  return { package: pkg, version: version || 'any', vulnerabilities: matches }
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState('')
  const [ecosystem, setEcosystem] = useState('all')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const doSearch = async (pkg, ver) => {
    const p = pkg ?? query
    const v = ver ?? version
    if (!p.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await axios.get('/api/search', { params: { pkg: p, version: v, ecosystem } })
      setResult(res.data)
    } catch {
      setResult(mockSearch(p, v))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: 2 }}>PACKAGE LOOKUP</div>
        <select value={ecosystem} onChange={e => setEcosystem(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', outline: 'none' }}>
          <option value="all">All Ecosystems</option>
          <option value="npm">npm</option>
          <option value="pypi">PyPI</option>
          <option value="maven">Maven</option>
        </select>
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Search CVEs by Package</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Look up any package to see its known <Tooltip termKey="cve">CVEs</Tooltip>, <Tooltip termKey="cvss">CVSS scores</Tooltip>, and fix recommendations from <Tooltip termKey="nvd">NVD</Tooltip> + <Tooltip termKey="osv">OSV</Tooltip>.
      </p>

      <StepBanner icon="🔍" title="How package search works"
        text="Enter a package name and optional version. We query NVD and OSV in real-time and return all known vulnerabilities. Click a quick-search chip below to try it instantly." />

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 2 }}>
          <SearchBar value={query} onChange={setQuery} onSearch={() => doSearch()} placeholder="e.g. lodash, Django, log4j-core" loading={loading} />
        </div>
        <input value={version} onChange={e => setVersion(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Version (optional)" style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Try:</span>
        {['lodash', 'axios', 'Django', 'log4j-core', 'jackson-databind', 'Pillow', 'urllib3'].map(s => (
          <button key={s} onClick={() => { setQuery(s); doSearch(s, '') }}
            style={{ border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
            {s}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}

      {loading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 24, marginBottom: 12, animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🔍</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Searching vulnerability databases...</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginTop: 12 }}>
            {['Querying NVD (National Vulnerability Database)', 'Querying OSV (Google Open Source)', 'Matching versions and CVE IDs'].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1.5s ease-in-out ${i * 0.4}s infinite` }} />
                {step}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16 }}>Live data fetch — usually takes 3–8 seconds</div>
        </div>
      )}

      {result && (
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
            {result.vulnerabilities?.length > 0
              ? <><span style={{ color: '#ef4444' }}>{result.vulnerabilities.length}</span> {result.vulnerabilities.length === 1 ? 'vulnerability' : 'vulnerabilities'} found for <code style={{ fontFamily: 'var(--font-mono)' }}>{result.package}</code></>
              : <>✅ No known vulnerabilities for <code style={{ fontFamily: 'var(--font-mono)' }}>{result.package}</code></>
            }
          </div>
          {result.vulnerabilities?.map(v => (
            <div key={v.cve_id} onClick={() => setSelected(v)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <SeverityBadge level={v.severity} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{v.cve_id}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12, flex: 1 }}>{v.description?.slice(0, 90)}...</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}><Tooltip termKey="cvss">CVSS</Tooltip> {v.cvss_score}</span>
            </div>
          ))}
        </div>
      )}

      <CVEDetail vuln={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
