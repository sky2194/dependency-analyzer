import { useState, useRef, useEffect } from 'react'
import StepBanner from './StepBanner'
import Tooltip from './Tooltip'
import ECOSYSTEMS, { detectEcosystem } from '../data/ecosystems'

// Detect ecosystem from pasted text content
function detectFromContent(text) {
  if (!text || text.trim().length < 10) return null
  const t = text.trim()
  // Maven — XML with groupId/artifactId
  if (t.includes('<groupId>') || t.includes('<artifactId>') || t.includes('<dependencies>'))
    return 'maven'
  // Gradle — dependencies block with Maven coordinates
  if (/dependencies\s*\{/.test(t) && /(implementation|api|compileOnly|runtimeOnly|compile)\s*(\(|\s+)['"][^:'"]+:[^:'"]+:[^'"]+['"]/.test(t))
    return 'gradle'
  // npm — JSON with dependencies/devDependencies/name+version
  try {
    const parsed = JSON.parse(t)
    if (parsed.dependencies || parsed.devDependencies || parsed.peerDependencies ||
        (parsed.name && parsed.version))
      return 'npm'
  } catch (_) {}
  // PyPI — requirements.txt pattern (pkg==version or pkg>=version or just pkg names)
  const lines = t.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
  const pypiPattern = /^[a-zA-Z0-9_\-\.]+\s*(==|>=|<=|~=|!=|>|<|\[)/
  const plainPkg    = /^[a-zA-Z0-9_\-\.]+$/
  const pypiLines   = lines.filter(l => pypiPattern.test(l.trim()) || plainPkg.test(l.trim()))
  if (pypiLines.length > 0 && pypiLines.length >= lines.length * 0.6)
    return 'pypi'
  return null
}

const PLACEHOLDERS = {
  npm: `Paste your package.json here...\n\nExample:\n{\n  "dependencies": {\n    "express": "4.17.1",\n    "lodash": "4.17.21"\n  }\n}`,
  pypi: `Paste your requirements.txt here...\n\nExample:\nDjango==3.2.0\nrequests==2.28.0\nnumpy==1.23.0`,
  maven: `Paste your pom.xml here...\n\nExample:\n<dependencies>\n  <dependency>\n    <groupId>org.springframework</groupId>\n    <artifactId>spring-core</artifactId>\n    <version>5.3.0</version>\n  </dependency>\n</dependencies>`,
  gradle: `Paste your build.gradle here...\n\nExample:\ndependencies {\n  implementation 'org.springframework:spring-core:5.3.0'\n  implementation 'com.fasterxml.jackson.core:jackson-databind:2.9.8'\n}`,
}

export default function FileUpload({ onAnalyze, loading, onEcosystemChange }) {
  const [content, setContent] = useState('')
  const [activeEco, setActiveEco] = useState('npm')
  const [drag, setDrag] = useState(false)
  const ref = useRef()

  useEffect(() => {
    onEcosystemChange?.(ECOSYSTEMS.npm)
  }, [])

  const loadSample = (key) => {
    const e = ECOSYSTEMS[key]
    setActiveEco(key)
    setContent(e.sampleContent)
    onEcosystemChange?.(e)
  }

  const handleFile = f => {
    const e = detectEcosystem(f.name)
    const key = Object.keys(ECOSYSTEMS).find(k => ECOSYSTEMS[k] === e) || 'npm'
    setActiveEco(key)
    onEcosystemChange?.(e)
    const r = new FileReader()
    r.onload = ev => setContent(ev.target.result)
    r.readAsText(f)
  }

  const eco = ECOSYSTEMS[activeEco]

  return (
    <div>
      <StepBanner title="Upload your dependency file"
        text={<>Your <Tooltip termKey="dependency">dependency</Tooltip> file lists every package your project uses. We parse it, build the full <Tooltip termKey="graph">dependency graph</Tooltip> including <Tooltip termKey="transitive">transitive dependencies</Tooltip>, then check each against the <Tooltip termKey="osv">OSV</Tooltip> vulnerability database.</>}
      />

      {/* Ecosystem tabs */}
      <div style={{ display: 'flex', marginBottom: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {Object.entries(ECOSYSTEMS).map(([key, e]) => {
          const active = activeEco === key
          return (
            <button key={key} onClick={() => { setActiveEco(key); setContent(''); onEcosystemChange?.(e) }}
              style={{ flex: 1, padding: '10px 0', border: 'none', borderRight: key !== Object.keys(ECOSYSTEMS).at(-1) ? '1px solid var(--border)' : 'none', background: active ? 'var(--surface2)' : 'var(--surface)', color: active ? e.color : 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, borderBottom: active ? `2px solid ${e.color}` : '2px solid transparent', transition: 'all 0.15s' }}>
              {e.label}
              <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginTop: 2 }}>{e.file}</div>
            </button>
          )
        })}
      </div>

      {/* Drop zone */}
      <div onClick={() => ref.current.click()}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
        aria-label="Upload dependency file — click or drag and drop"
        style={{ border: `2px dashed ${drag ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center', cursor: 'pointer', background: drag ? 'var(--vuln-bg)' : 'var(--surface)', marginBottom: 10, transition: 'all 0.2s' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>Drop file or click to browse</div>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>package.json / package-lock.json · requirements.txt · pom.xml · build.gradle</div>
        <input ref={ref} type="file" hidden accept=".json,.txt,.xml,.gradle,.kts" onChange={e => handleFile(e.target.files[0])} />
      </div>

      {/* Sample button - only for active ecosystem */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Need an example?</span>
        <button onClick={() => loadSample(activeEco)}
          style={{ border: `1px solid ${eco.color}`, background: 'none', color: eco.color, borderRadius: 5, padding: '3px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
          Load {eco.file} example
        </button>
      </div>

      <div style={{ fontSize: 12, color: eco.color, marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        {eco.lang} {content.trim() ? 'detected' : 'selected'}
        {content.trim() && detectFromContent(content) && (
          <span style={{ fontSize: 10, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--fix-border)', borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>
            auto-detected
          </span>
        )}
      </div>

      <textarea
        value={content}
        onChange={e => {
          const val = e.target.value
          setContent(val)
          // Auto-detect ecosystem from pasted content
          const detected = detectFromContent(val)
          if (detected && detected !== activeEco) {
            setActiveEco(detected)
            onEcosystemChange?.(ECOSYSTEMS[detected])
          }
        }}
        rows={10}
        placeholder={PLACEHOLDERS[activeEco]}
        style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', resize: 'vertical', outline: 'none' }}
      />

      {content.trim() && content.length > 512000 && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--vuln-bg)', border: '1px solid var(--vuln-border)', borderRadius: 6, fontSize: 12, color: 'var(--red)' }}>
          File too large ({Math.round(content.length/1024)}KB). Maximum is 512KB.
        </div>
      )}
      <button onClick={() => onAnalyze(content, eco.file)} disabled={!content.trim() || loading || content.length > 512000}
        style={{ marginTop: 14, padding: '11px 28px', background: content.trim() ? 'var(--brand)' : 'var(--border)', color: 'var(--white)', border: 'none', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, cursor: content.trim() ? 'pointer' : 'not-allowed' }}>
        {loading ? 'Scanning...' : 'Scan & Detect Vulnerabilities'}
      </button>
    </div>
  )
}
