import { useState } from 'react'
import Tooltip from './Tooltip'

const SEV_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#3b82f6' }

function Node({ node, depth = 0, showVulnOnly }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.dependencies?.length > 0
  const vulns = node.vulnerabilities || []
  const isVuln = vulns.length > 0
  const topSev = vulns[0]?.severity?.toUpperCase()
  const topCvss = vulns[0]?.cvss_score
  const fixVersion = vulns[0]?.fix_version

  if (showVulnOnly && !isVuln && depth > 0) return null

  const glowColor = SEV_COLOR[topSev] || '#ef4444'

  return (
    <div>
      <div
        onClick={() => hasChildren && setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px',
          marginLeft: depth * 20,
          borderRadius: 6,
          cursor: hasChildren ? 'pointer' : 'default',
          background: isVuln ? 'var(--vuln-bg)' : 'transparent',
          borderLeft: isVuln ? `3px solid ${glowColor}` : '3px solid transparent',
          boxShadow: isVuln ? `0 0 8px ${glowColor}33` : 'none',
          marginBottom: 3, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isVuln) e.currentTarget.style.background = 'var(--surface2)' }}
        onMouseLeave={e => { if (!isVuln) e.currentTarget.style.background = 'transparent' }}
      >
        {depth > 0 && <span style={{ color: 'var(--border)', fontSize: 11 }}>└─</span>}
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: isVuln ? glowColor : depth === 0 ? 'var(--accent)' : hasChildren ? '#f59e0b' : '#22c55e', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: depth === 0 ? 700 : 400 }}>{node.name}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>@{node.version}</span>

        {node.type === 'direct' && (
          <span style={{ fontSize: 10, background: 'var(--fix-bg)', color: '#22c55e', border: '1px solid var(--fix-border)', borderRadius: 3, padding: '1px 6px' }}>
            <Tooltip termKey="direct">direct</Tooltip>
          </span>
        )}
        {node.type === 'transitive' && (
          <span style={{ fontSize: 10, background: 'var(--warn-bg)', color: '#f59e0b', border: '1px solid var(--warn-border)', borderRadius: 3, padding: '1px 6px' }}>
            <Tooltip termKey="transitive">transitive</Tooltip>
          </span>
        )}

        {isVuln && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {topCvss && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: glowColor, background: `${glowColor}22`, border: `1px solid ${glowColor}44`, borderRadius: 3, padding: '1px 6px' }}>
                CVSS {topCvss}
              </span>
            )}
            {fixVersion && (
              <span style={{ fontSize: 10, color: '#22c55e', background: 'var(--fix-bg)', border: '1px solid var(--fix-border)', borderRadius: 3, padding: '1px 6px' }}>
                ✓ Fix {fixVersion}
              </span>
            )}
            <span style={{ fontSize: 11, color: glowColor }}>⚠️ {vulns.length} CVE{vulns.length > 1 ? 's' : ''}</span>
          </div>
        )}
        {!isVuln && depth > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ok)' }}>✓</span>}
        {hasChildren && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: isVuln ? 4 : 0 }}>{expanded ? '▲' : `▼ ${node.dependencies.length}`}</span>}
      </div>

      {expanded && hasChildren && node.dependencies.map((child, i) => (
        <Node key={`${child.name}@${child.version}-${i}`} node={child} depth={depth + 1} showVulnOnly={showVulnOnly} />
      ))}
    </div>
  )
}

export default function DependencyGraph({ data }) {
  const [showVulnOnly, setShowVulnOnly] = useState(false)
  const tree = data?.dependency_tree || data?.graph

  if (!tree) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No dependency tree available.</div>

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => setShowVulnOnly(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            background: showVulnOnly ? 'var(--vuln-bg)' : 'var(--surface2)',
            border: `1px solid ${showVulnOnly ? '#ef4444' : 'var(--border)'}`,
            color: showVulnOnly ? '#ef4444' : 'var(--muted)',
            fontSize: 12, fontFamily: 'var(--font-mono)', transition: 'all 0.2s'
          }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, border: `2px solid ${showVulnOnly ? '#ef4444' : 'var(--muted)'}`, background: showVulnOnly ? '#ef4444' : 'transparent', display: 'inline-block', transition: 'all 0.2s' }} />
          Show only vulnerable packages
        </button>
        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
          {[['#ef4444','Critical'],['#f97316','High'],['#eab308','Medium'],['#22c55e','Safe']].map(([c,l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        <Node node={tree} depth={0} showVulnOnly={showVulnOnly} />
      </div>
    </div>
  )
}
