import { useState } from 'react'
import StepBanner from './StepBanner'
import Tooltip from './Tooltip'

function Node({ node, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(depth > 1)
  const vuln = node.vulnerabilities?.length > 0
  const hasChildren = node.dependencies?.length > 0

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        onClick={() => hasChildren && setCollapsed(!collapsed)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, marginBottom: 2, background: vuln ? '#2d1515' : 'transparent', border: `1px solid ${vuln ? '#7f1d1d' : 'transparent'}`, cursor: hasChildren ? 'pointer' : 'default', userSelect: 'none' }}
        onMouseEnter={e => { if (hasChildren) e.currentTarget.style.background = vuln ? '#3d2020' : 'var(--surface2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = vuln ? '#2d1515' : 'transparent' }}
      >
        {depth > 0 && <span style={{ color: 'var(--border)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>└─</span>}
        {hasChildren && (
          <span style={{ fontSize: 10, color: 'var(--muted)', width: 12, flexShrink: 0 }}>{collapsed ? '▶' : '▼'}</span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: depth === 0 ? 700 : 400, color: depth === 0 ? 'var(--accent)' : 'var(--text)' }}>{node.name}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>@{node.version}</span>
        {node.type === 'direct' && <span style={{ fontSize: 10, background: '#0f2d1a', color: '#22c55e', border: '1px solid #14532d', borderRadius: 3, padding: '1px 6px' }}><Tooltip termKey="direct">direct</Tooltip></span>}
        {node.type === 'transitive' && <span style={{ fontSize: 10, background: '#2d2009', color: '#f59e0b', border: '1px solid #78350f', borderRadius: 3, padding: '1px 6px' }}><Tooltip termKey="transitive">transitive</Tooltip></span>}
        {hasChildren && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 2 }}>({node.dependencies.length})</span>}
        {vuln
          ? <span style={{ marginLeft: 'auto', fontSize: 11, color: '#ef4444' }}>⚠️ {node.vulnerabilities.length} CVE{node.vulnerabilities.length > 1 ? 's' : ''}</span>
          : depth > 0 && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ok)' }}>✓</span>}
      </div>
      {!collapsed && node.dependencies?.map(c => <Node key={c.name + c.version} node={c} depth={depth + 1} />)}
    </div>
  )
}

export default function DependencyGraph({ data }) {
  const [allExpanded, setAllExpanded] = useState(false)
  if (!data?.graph) return null

  return (
    <div>
      <StepBanner icon="🌳" title="Dependency Graph"
        text={<>Every package — <Tooltip termKey="direct">direct</Tooltip> (you added) and <Tooltip termKey="transitive">transitive</Tooltip> (auto-pulled). Click any node to expand/collapse. ⚠️ = CVEs · ✓ = clean.</>}
      />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 20, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button onClick={() => setAllExpanded(!allExpanded)}
            style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
        <Node key={allExpanded} node={data.graph} />
      </div>

      {data.mediation?.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            ⚖️ <Tooltip termKey="mediation">Dependency Mediation</Tooltip> Decisions
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Where version conflicts existed, one version was selected and the rest silently dropped.</div>
          {data.mediation.map((m, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${m.risk ? '#7f1d1d' : 'var(--border)'}`, borderLeft: `3px solid ${m.risk ? '#ef4444' : 'var(--accent2)'}`, borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{m.package}</span>
                {m.loser && <span style={{ fontSize: 10, background: '#2d1515', color: '#ef4444', border: '1px solid #7f1d1d', borderRadius: 3, padding: '1px 6px' }}>version conflict</span>}
                <span style={{ marginLeft: 'auto', fontSize: 12 }}>selected: <strong style={{ color: m.risk ? '#ef4444' : 'var(--accent2)' }}>{m.selected}</strong></span>
              </div>
              {m.requestedBy?.map((r, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 11, fontFamily: 'var(--font-mono)', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)', width: 52, flexShrink: 0 }}>depth {r.depth}</span>
                  <span style={{ color: '#93c5fd' }}>{r.requester}</span>
                  <span style={{ color: 'var(--muted)' }}>→ {m.package}@</span>
                  <span style={{ color: r.version === m.selected ? (r.safe ? '#22c55e' : '#ef4444') : '#6b7280', fontWeight: 700 }}>{r.version}</span>
                  <span style={{ fontSize: 10, color: r.version === m.selected ? (r.safe ? '#22c55e' : '#ef4444') : '#6b7280' }}>
                    {r.version === m.selected ? (r.safe ? '✓ winner (safe)' : '✓ winner (⚠️ vulnerable!)') : '✗ dropped'}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>📌 {m.reason}</div>
              {m.risk && <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 6, lineHeight: 1.5 }}>⚠️ {m.risk}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
