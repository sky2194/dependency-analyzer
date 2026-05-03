import { useState } from 'react'
import SeverityBadge from './SeverityBadge'

export default function CompareScans({ current }) {
  const [prev, setPrev] = useState(null)
  const [open, setOpen] = useState(false)

  const loadPrev = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = ev => {
      try { setPrev(JSON.parse(ev.target.result)) } catch { alert('Invalid scan file') }
    }
    r.readAsText(file)
  }

  const saveCurrent = () => {
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scan-${current.project_name}-${Date.now()}.json`
    a.click()
  }

  const diff = prev ? computeDiff(prev, current) : null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={saveCurrent}
          style={{ fontSize: 12, padding: '5px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', cursor: 'pointer' }}>
          💾 Save scan
        </button>
        <label style={{ fontSize: 12, padding: '5px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', cursor: 'pointer' }}>
          📂 Compare with previous
          <input type="file" accept=".json" hidden onChange={loadPrev} />
        </label>
        {diff && <button onClick={() => setOpen(o => !o)}
          style={{ fontSize: 12, padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
          {open ? 'Hide' : 'Show'} diff ({diff.added.length} new · {diff.fixed.length} fixed)
        </button>}
      </div>

      {open && diff && (
        <div style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <DiffSection title="🆕 New vulnerabilities" items={diff.added} color="var(--critical)" />
          <DiffSection title="✅ Fixed vulnerabilities" items={diff.fixed} color="var(--ok)" />
          {diff.added.length === 0 && diff.fixed.length === 0 && (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>No changes between scans.</div>
          )}
        </div>
      )}
    </div>
  )
}

function DiffSection({ title, items, color }) {
  if (!items.length) return null
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color, background: 'var(--surface2)' }}>{title}</div>
      {items.map(v => (
        <div key={v.cve_id} style={{ display: 'flex', gap: 12, padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 12, alignItems: 'center' }}>
          <SeverityBadge level={v.severity} />
          <span style={{ fontFamily: 'var(--font-mono)' }}>{v.cve_id}</span>
          <span style={{ color: 'var(--muted)' }}>{v.package}@{v.version}</span>
        </div>
      ))}
    </div>
  )
}

function computeDiff(prev, current) {
  const prevIds = new Set(prev.vulnerabilities?.map(v => `${v.cve_id}:${v.package}`) || [])
  const currIds = new Set(current.vulnerabilities?.map(v => `${v.cve_id}:${v.package}`) || [])
  const added = current.vulnerabilities?.filter(v => !prevIds.has(`${v.cve_id}:${v.package}`)) || []
  const fixed = prev.vulnerabilities?.filter(v => !currIds.has(`${v.cve_id}:${v.package}`)) || []
  return { added, fixed }
}
