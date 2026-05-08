import { useState, useMemo } from 'react'

const SEV_COLOR = {
  CRITICAL: 'var(--critical)',
  HIGH:     'var(--high)',
  MEDIUM:   'var(--medium)',
  LOW:      'var(--low)',
}
const SEV_FILL = {
  CRITICAL: 'rgba(255,59,92,0.12)',
  HIGH:     'rgba(255,140,66,0.12)',
  MEDIUM:   'rgba(245,200,66,0.12)',
  LOW:      'rgba(62,207,142,0.12)',
}

function flatten(node, depth = 0, parentName = null, out = []) {
  if (!node) return out
  out.push({
    name: node.name, version: node.version, depth,
    type: node.type || (depth === 0 ? 'root' : depth === 1 ? 'direct' : 'transitive'),
    parent: parentName,
    vulns: node.vulnerabilities || [],
  })
  if (node.dependencies) for (const d of node.dependencies) flatten(d, depth + 1, node.name, out)
  return out
}

function topSeverity(vulns) {
  if (!vulns?.length) return null
  for (const s of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const v = vulns.find(x => (x.severity || '').toUpperCase() === s)
    if (v) return { sev: s, cvss: v.cvss_score, fix: v.fix_version }
  }
  return null
}

const NODE_W = 110
const ROW_H = 110

export default function DependencyGraph({ data }) {
  const [showVulnOnly, setShowVulnOnly] = useState(false)
  const tree = data?.dependency_tree || data?.graph

  const layout = useMemo(() => {
    if (!tree) return null
    const all = flatten(tree)

    const filtered = showVulnOnly
      ? all.filter(n => n.depth === 0 || n.vulns.length > 0 ||
          all.some(c => c.parent === n.name && c.vulns.length > 0))
      : all

    const root = filtered.find(n => n.depth === 0)
    if (!root) return null
    const directs = filtered.filter(n => n.depth === 1)
    const transitives = filtered.filter(n => n.depth >= 2)

    // Direct row
    const directWidth = Math.max(directs.length * NODE_W, 600)

    // Transitives: wrap into rows of max 8 per row
    const TRANS_PER_ROW = 8
    const transRows = Math.max(1, Math.ceil(transitives.length / TRANS_PER_ROW))
    const transWidth = Math.max(Math.min(transitives.length, TRANS_PER_ROW) * NODE_W, 600)

    const W = Math.max(directWidth, transWidth, 800)
    const directY = 130
    const transStartY = directY + ROW_H + 40
    const H = transStartY + transRows * ROW_H + 40
    const rootX = W / 2
    const rootY = 50

    const directGap = directs.length > 1 ? (W - 200) / Math.max(1, directs.length - 1) : 0
    const directStartX = directs.length > 1 ? 100 : rootX
    const placedDirects = directs.map((d, i) => ({
      ...d, x: directStartX + i * directGap, y: directY,
    }))

    // Place transitives in a grid below
    const placedTrans = transitives.map((t, i) => {
      const row = Math.floor(i / TRANS_PER_ROW)
      const col = i % TRANS_PER_ROW
      const inRow = Math.min(transitives.length - row * TRANS_PER_ROW, TRANS_PER_ROW)
      const rowGap = inRow > 1 ? (W - 200) / (inRow - 1) : 0
      const x = inRow > 1 ? 100 + col * rowGap : W / 2
      const y = transStartY + row * ROW_H
      const parent = placedDirects.find(p => p.name === t.parent)
      return {
        ...t, x, y,
        parentX: parent?.x ?? rootX,
        parentY: parent?.y ?? rootY,
      }
    })

    return { root: { ...root, x: rootX, y: rootY }, directs: placedDirects, transitives: placedTrans, W, H }
  }, [tree, showVulnOnly])

  if (!tree || !layout) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 24, textAlign: 'center' }}>No dependency tree available.</div>
  }

  const { root, directs, transitives, W, H } = layout

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setShowVulnOnly(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
            borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12,
            background: showVulnOnly ? 'rgba(255,59,92,0.10)' : 'var(--bg-elevated)',
            border: `1px solid ${showVulnOnly ? 'rgba(255,59,92,0.40)' : 'var(--border)'}`,
            color: showVulnOnly ? 'var(--critical)' : 'var(--text-secondary)',
          }}>
          <span style={{
            width: 12, height: 12, borderRadius: 3, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${showVulnOnly ? 'var(--critical)' : 'var(--text-muted)'}`,
            background: showVulnOnly ? 'var(--critical)' : 'transparent',
            fontSize: 8, color: '#fff',
          }}>{showVulnOnly ? '✓' : ''}</span>
          Show only vulnerable
        </button>
        <div style={{ display: 'flex', gap: 14, marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {[
            ['var(--critical)', 'Critical'],
            ['var(--high)',     'High'],
            ['var(--medium)',   'Medium'],
            ['var(--low)',      'Safe'],
          ].map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16, overflow: 'auto', maxHeight: '70vh',
      }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', minWidth: Math.min(W, 800), fontFamily: 'var(--font-mono)' }}
        >
          {/* root → direct edges */}
          {directs.map((d, i) => (
            <g key={`re-${i}`}>
              <line x1={root.x} y1={root.y + 22} x2={d.x} y2={d.y - 22}
                stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
              <text x={(root.x + d.x) / 2} y={(root.y + d.y) / 2 - 4}
                fontSize="10" fill="var(--text-muted)" textAnchor="middle">direct</text>
            </g>
          ))}

          {/* direct → transitive edges */}
          {transitives.map((t, i) => (
            <g key={`te-${i}`}>
              <line x1={t.parentX} y1={t.parentY + 22}
                x2={t.x} y2={t.y - 22}
                stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
              <text x={(t.parentX + t.x) / 2} y={(t.parentY + t.y) / 2 - 4}
                fontSize="9" fill="var(--text-muted)" textAnchor="middle" opacity="0.8">transitive</text>
            </g>
          ))}

          {/* root */}
          <g>
            <circle cx={root.x} cy={root.y} r="22" fill="rgba(79,142,247,0.10)" stroke="var(--accent)" strokeWidth="1.5" />
            <text x={root.x} y={root.y + 4} fontSize="10" fill="var(--accent)" textAnchor="middle" fontWeight="700">root</text>
            <text x={root.x} y={root.y + 38} fontSize="11" fill="var(--text)" textAnchor="middle" fontWeight="600">{root.name}</text>
          </g>

          {/* nodes */}
          {[...directs, ...transitives].map((n, i) => {
            const sev = topSeverity(n.vulns)
            const col = sev ? SEV_COLOR[sev.sev] : 'var(--low)'
            const fill = sev ? SEV_FILL[sev.sev] : 'rgba(62,207,142,0.06)'
            const isVuln = !!sev
            return (
              <g key={`n-${i}`}>
                {isVuln && (
                  <circle cx={n.x} cy={n.y} r="26" fill={col} opacity="0.18" style={{ filter: 'blur(8px)' }} />
                )}
                <circle cx={n.x} cy={n.y} r="20" fill={fill} stroke={col} strokeWidth="1.5" />
                <text x={n.x} y={n.y + 36} fontSize="11" fill="var(--text)" textAnchor="middle" fontWeight="600">{n.name}</text>
                <text x={n.x} y={n.y + 50} fontSize="10" fill="var(--text-secondary)" textAnchor="middle">{n.version}</text>
                {sev?.cvss && (
                  <g>
                    <rect x={n.x + 12} y={n.y - 32} width="50" height="14" rx="3" fill={col} opacity="0.22" />
                    <text x={n.x + 37} y={n.y - 22} fontSize="9" fill={col} textAnchor="middle" fontWeight="700">CVSS {sev.cvss}</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
