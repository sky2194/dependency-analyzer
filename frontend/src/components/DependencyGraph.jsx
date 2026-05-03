import { useState } from 'react'
import StepBanner from './StepBanner'

function Node({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.dependencies?.length > 0
  const vulnCount   = node.vulnerabilities?.length || 0
  const isVuln      = vulnCount > 0
  const color       = isVuln ? '#ef4444' : depth === 0 ? 'var(--accent)' : hasChildren ? '#f59e0b' : '#22c55e'
  const indent      = depth * 20

  return (
    <div>
      <div onClick={() => hasChildren && setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginLeft: indent,
          borderRadius: 6, cursor: hasChildren ? 'pointer' : 'default',
          background: isVuln ? 'var(--vuln-bg)' : 'transparent',
          border: isVuln ? '0.5px solid var(--vuln-border)' : '0.5px solid transparent',
          marginBottom: 3, transition: 'background 0.15s' }}
        onMouseEnter={e => { if (!isVuln) e.currentTarget.style.background = 'var(--surface2)' }}
        onMouseLeave={e => { if (!isVuln) e.currentTarget.style.background = 'transparent' }}
      >
        {depth > 0 && <span style={{ color: 'var(--border)', fontSize: 11 }}>{'└─'}</span>}
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: depth === 0 ? 700 : 400 }}>{node.name}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>@{node.version}</span>
        {node.type === 'direct' && (
          <span style={{ fontSize: 10, background: 'var(--fix-bg)', color: '#22c55e', border: '1px solid var(--fix-border)', borderRadius: 3, padding: '1px 6px' }}>
            direct
          </span>
        )}
        {node.type === 'transitive' && (
          <span style={{ fontSize: 10, background: 'var(--warn-bg)', color: '#f59e0b', border: '1px solid var(--warn-border)', borderRadius: 3, padding: '1px 6px' }}>
            transitive
          </span>
        )}
        {isVuln && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#ef4444' }}>⚠️ {vulnCount} CVE{vulnCount > 1 ? 's' : ''}</span>}
        {!isVuln && depth > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ok)' }}>✓</span>}
        {hasChildren && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: isVuln ? 8 : 0 }}>{expanded ? '▲' : `▼ ${node.dependencies.length}`}</span>}
      </div>

      {expanded && hasChildren && node.dependencies.map((child, i) => (
        <Node key={`${child.name}@${child.version}-${i}`} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function DependencyGraph({ data }) {
  const [search, setSearch] = useState('')
  const deps = data?.graph?.dependencies || []

  const filtered = search
    ? deps.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    : deps

  return (
    <div>
      <StepBanner icon="🌳" title="Dependency Tree"
        text={<>Every package — direct and transitive. Click any node to expand/collapse. ⚠️ = CVEs · ✓ = clean.</>}
      />

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Filter packages..."
        style={{ width: '100%', marginBottom: 12, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', outline: 'none' }}
      />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        {/* Root node */}
        <Node node={{ name: data?.project_name || 'project', version: '—', type: 'root', dependencies: filtered, vulnerabilities: [] }} depth={0} />
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No packages match "{search}"</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
        <span><span style={{ color: '#ef4444' }}>●</span> Has CVEs</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> Transitive</span>
        <span><span style={{ color: '#22c55e' }}>●</span> Clean</span>
        <span><span style={{ color: 'var(--accent)' }}>●</span> Root</span>
        <span style={{ marginLeft: 'auto' }}>Click nodes to expand · ▼ = collapsed</span>
      </div>
    </div>
  )
}
