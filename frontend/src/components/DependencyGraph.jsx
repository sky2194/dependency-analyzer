import { useState, useMemo } from 'react'

const SEV_COLOR = {
  CRITICAL: 'var(--critical)', HIGH: 'var(--high)',
  MEDIUM: 'var(--medium)', LOW: 'var(--low)',
}
const SEV_FILL = {
  CRITICAL: 'var(--red-dim)', HIGH: 'var(--yellow-dim)',
  MEDIUM: 'var(--blue-dim)', LOW: 'var(--green-dim)',
}

function flatten(node, depth = 0, parentName = null, out = []) {
  if (!node) return out
  out.push({
    name: node.name, version: node.version, depth,
    type: node.type || (depth === 0 ? 'root' : depth === 1 ? 'direct' : 'transitive'),
    parent: parentName,
    vulns: Array.isArray(node.vulnerabilities) ? node.vulnerabilities : [],
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

const NODE_W = 120
const ROW_H = 120

export default function DependencyGraph({ data }) {
  const [viewMode, setViewMode] = useState('all') // all | vulnerable | direct
  const tree = data?.dependency_tree || data?.graph

  const layout = useMemo(() => {
    if (!tree) return null
    const all = flatten(tree)

    let filtered = all
    if (viewMode === 'vulnerable') {
      filtered = all.filter(n => n.depth === 0 || n.vulns.length > 0 ||
        all.some(c => c.parent === n.name && c.vulns.length > 0))
    } else if (viewMode === 'direct') {
      filtered = all.filter(n => n.depth <= 1)
    }

    const root = filtered.find(n => n.depth === 0)
    if (!root) return null

    const directs = filtered.filter(n => n.depth === 1)
    const transitives = filtered.filter(n => n.depth >= 2)

    // Sort: vulnerable first, then alphabetically
    directs.sort((a, b) => {
      if (a.vulns.length && !b.vulns.length) return -1
      if (!a.vulns.length && b.vulns.length) return 1
      return a.name.localeCompare(b.name)
    })
    transitives.sort((a, b) => {
      if (a.vulns.length && !b.vulns.length) return -1
      if (!a.vulns.length && b.vulns.length) return 1
      return a.name.localeCompare(b.name)
    })

    const directWidth = Math.max(directs.length * NODE_W, 700)
    const TRANS_PER_ROW = 8
    const transRows = Math.max(1, Math.ceil(transitives.length / TRANS_PER_ROW))
    const transWidth = Math.max(Math.min(transitives.length, TRANS_PER_ROW) * NODE_W, 700)

    const W = Math.max(directWidth, transWidth, 900)
    const directY = 140
    const transStartY = directY + ROW_H + 60
    const H = transStartY + transRows * ROW_H + 60
    const rootX = W / 2
    const rootY = 60

    const directGap = directs.length > 1 ? (W - 240) / Math.max(1, directs.length - 1) : 0
    const directStartX = directs.length > 1 ? 120 : rootX
    const placedDirects = directs.map((d, i) => ({
      ...d, x: directStartX + i * directGap, y: directY,
    }))

    const placedTrans = transitives.map((t, i) => {
      const row = Math.floor(i / TRANS_PER_ROW)
      const col = i % TRANS_PER_ROW
      const inRow = Math.min(transitives.length - row * TRANS_PER_ROW, TRANS_PER_ROW)
      const rowGap = inRow > 1 ? (W - 240) / (inRow - 1) : 0
      const x = inRow > 1 ? 120 + col * rowGap : W / 2
      const y = transStartY + row * ROW_H
      const parent = placedDirects.find(p => p.name === t.parent)
      return {
        ...t, x, y,
        parentX: parent?.x ?? rootX,
        parentY: parent?.y ?? rootY,
      }
    })

    const stats = {
      total: filtered.length,
      vulnerable: filtered.filter(n => n.vulns.length > 0).length,
      direct: directs.length,
      transitive: transitives.length,
    }

    return { root: { ...root, x: rootX, y: rootY }, directs: placedDirects, transitives: placedTrans, W, H, stats }
  }, [tree, viewMode])

  if (!tree || !layout) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 24, textAlign: 'center' }}>
      No dependency tree available.
    </div>
  }

  const { root, directs, transitives, W, H, stats } = layout

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
          {[
            { id: 'all', label: 'All Packages', icon: '●' },
            { id: 'vulnerable', label: 'Vulnerable Only', icon: '⚠️' },
            { id: 'direct', label: 'Direct Only', icon: '▲' },
          ].map(mode => (
            <button key={mode.id} onClick={() => setViewMode(mode.id)}
              style={{
                padding: '7px 14px',
                background: viewMode === mode.id ? 'var(--accent)' : 'transparent',
                border: 'none', borderRadius: 6,
                color: viewMode === mode.id ? 'var(--white)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-ui)', transition: 'all 0.2s',
              }}
            >
              {mode.icon} {mode.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          <span>{stats.total} total</span>
          <span style={{ color: 'var(--critical)' }}>{stats.vulnerable} vulnerable</span>
          <span>{stats.direct} direct</span>
          <span>{stats.transitive} transitive</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
        {[
          ['var(--critical)', 'Critical'],
          ['var(--high)', 'High'],
          ['var(--medium)', 'Medium'],
          ['var(--low)', 'Safe'],
        ].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            {l}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>Larger nodes = higher priority</span>
      </div>

      {/* Graph SVG */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, overflow: 'auto', maxHeight: '75vh',
      }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', minWidth: Math.min(W, 900), fontFamily: 'var(--font-mono)' }}
        >
          {/* Edges: root → directs */}
          {directs.map((d, i) => {
            const isVulnPath = d.vulns.length > 0
            return (
              <g key={`re-${i}`}>
                <line
                  x1={root.x} y1={root.y + 26}
                  x2={d.x} y2={d.y - 26}
                  stroke={isVulnPath ? 'var(--critical)' : 'var(--border-mid)'}
                  strokeWidth={isVulnPath ? '2.5' : '1.5'}
                  strokeDasharray={isVulnPath ? '0' : '5 5'}
                  opacity={isVulnPath ? '0.8' : '0.5'}
                />
                <text
                  x={(root.x + d.x) / 2} y={(root.y + d.y) / 2 - 6}
                  fontSize="9" fill="var(--text-muted)" textAnchor="middle" opacity="0.7"
                >
                  direct
                </text>
              </g>
            )
          })}

          {/* Edges: directs → transitives */}
          {transitives.map((t, i) => {
            const isVulnPath = t.vulns.length > 0
            return (
              <g key={`te-${i}`}>
                <line
                  x1={t.parentX} y1={t.parentY + 26}
                  x2={t.x} y2={t.y - 26}
                  stroke={isVulnPath ? 'var(--high)' : 'var(--border-mid)'}
                  strokeWidth={isVulnPath ? '2' : '1'}
                  strokeDasharray="5 5"
                  opacity={isVulnPath ? '0.7' : '0.4'}
                />
              </g>
            )
          })}

          {/* Root node */}
          <g>
            <circle cx={root.x} cy={root.y} r="26" fill="var(--orange-dim)" stroke="var(--accent)" strokeWidth="2" />
            <text x={root.x} y={root.y + 5} fontSize="11" fill="var(--accent)" textAnchor="middle" fontWeight="700">ROOT</text>
            <text x={root.x} y={root.y + 42} fontSize="12" fill="var(--text-primary)" textAnchor="middle" fontWeight="600">{root.name}</text>
          </g>

          {/* Package nodes */}
          {[...directs, ...transitives].map((n, i) => {
            const sev = topSeverity(n.vulns)
            const col = sev ? SEV_COLOR[sev.sev] : 'var(--low)'
            const fill = sev ? SEV_FILL[sev.sev] : 'var(--green-dim)'
            const isVuln = !!sev
            const nodeSize = isVuln ? 24 : n.depth === 1 ? 22 : 20
            const opacity = isVuln ? 1 : n.depth === 1 ? 0.9 : 0.7

            return (
              <g key={`n-${i}`} opacity={opacity}>
                {/* Glow for vulnerable nodes */}
                {isVuln && (
                  <circle cx={n.x} cy={n.y} r={nodeSize + 8} fill={col} opacity="0.15" style={{ filter: 'blur(10px)' }} />
                )}

                {/* Node circle */}
                <circle cx={n.x} cy={n.y} r={nodeSize} fill={fill} stroke={col} strokeWidth={isVuln ? '2.5' : '1.5'} />

                {/* Package name */}
                <text
                  x={n.x} y={n.y + 40}
                  fontSize={isVuln ? '12' : '11'}
                  fill={isVuln ? 'var(--critical)' : 'var(--text-primary)'}
                  textAnchor="middle"
                  fontWeight={isVuln ? '700' : '600'}
                >
                  {n.name}
                </text>

                {/* Version */}
                <text x={n.x} y={n.y + 54} fontSize="10" fill="var(--text-secondary)" textAnchor="middle">{n.version}</text>

                {/* CVSS badge */}
                {sev?.cvss && (
                  <g>
                    <rect x={n.x - 22} y={n.y - nodeSize - 18} width="44" height="15" rx="4" fill={col} opacity="0.25" />
                    <text x={n.x} y={n.y - nodeSize - 7} fontSize="9" fill={col} textAnchor="middle" fontWeight="700">
                      CVSS {sev.cvss}
                    </text>
                  </g>
                )}

                {/* Direct badge */}
                {n.depth === 1 && !isVuln && (
                  <text x={n.x} y={n.y - nodeSize - 8} fontSize="8" fill="var(--accent)" textAnchor="middle" fontWeight="600" opacity="0.8">
                    DIRECT
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
