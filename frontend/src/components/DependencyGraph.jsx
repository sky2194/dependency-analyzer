import { useState, useMemo, useRef, useEffect } from 'react'
import StepBanner from './StepBanner'

/* ─────────────────────────────────────────────────────────────────────────
   DEPENDENCY GRAPH — proper SVG node-link visualisation
   Replaces the old indented text tree. Toggle to "Tree" for list view.
   ───────────────────────────────────────────────────────────────────────── */

const NODE_R = 7              // base node radius (was 8x8 dots — now smaller + outline)
const NODE_R_VULN = 9         // slightly larger for vuln nodes
const NODE_R_ROOT = 11

function flattenDeps(deps, depth = 1, parentId = 'root', out = [], edges = []) {
  deps.forEach((d, i) => {
    const id = `${parentId}/${d.name}@${d.version}#${i}`
    out.push({ id, name: d.name, version: d.version, depth, type: d.type,
      vulns: d.vulnerabilities?.length || 0, parentId })
    edges.push({ from: parentId, to: id, vuln: (d.vulnerabilities?.length || 0) > 0 })
    if (d.dependencies?.length) flattenDeps(d.dependencies, depth + 1, id, out, edges)
  })
  return { nodes: out, edges }
}

/* Radial layout — root at center, children in concentric rings */
function computeLayout(nodes, width, height) {
  const cx = width / 2, cy = height / 2
  const ringRadius = (depth) => 80 + (depth - 1) * 110

  // group nodes by depth
  const byDepth = {}
  nodes.forEach(n => { (byDepth[n.depth] = byDepth[n.depth] || []).push(n) })

  // for each depth, distribute around the circle
  const positions = { root: { x: cx, y: cy, depth: 0 } }
  Object.entries(byDepth).forEach(([depth, ring]) => {
    const r = ringRadius(+depth)
    const count = ring.length
    // group siblings near each other by anchoring to parent's angle
    const sorted = [...ring].sort((a, b) => a.parentId.localeCompare(b.parentId))
    sorted.forEach((n, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2
      positions[n.id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, depth: +depth, angle }
    })
  })
  return positions
}

function GraphView({ data, filter, onSelect }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 540 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hover, setHover] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ x: 0, y: 0 })

  // measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: 540 })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { nodes, edges, positions } = useMemo(() => {
    const { nodes, edges } = flattenDeps(data?.graph?.dependencies || [])
    const positions = computeLayout(nodes, size.w, size.h)
    return { nodes, edges, positions }
  }, [data, size.w, size.h])

  const visibleNodes = filter === 'vuln' ? nodes.filter(n => n.vulns > 0) : nodes
  const visibleIds = new Set(visibleNodes.map(n => n.id))
  visibleIds.add('root')
  const visibleEdges = edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to))

  const colorFor = (n, isHover) => {
    if (n.vulns > 0) return '#ef4444'
    if (n.type === 'transitive') return '#f59e0b'
    return '#22c55e'
  }

  const handleMouseDown = (e) => {
    setIsDragging(true)
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }
  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y })
  }
  const handleMouseUp = () => setIsDragging(false)

  return (
    <div ref={containerRef} style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

      {/* Controls */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'flex', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
        <button onClick={() => setZoom(z => Math.min(z + 0.2, 2.5))} style={btnIcon} title="Zoom in">+</button>
        <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} style={btnIcon} title="Zoom out">−</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={btnIcon} title="Reset">⌂</button>
      </div>

      <svg
        width={size.w} height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{ display: 'block', cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <radialGradient id="rootGlow"><stop offset="0%" stopColor="#e05c2a" stopOpacity="0.35"/><stop offset="100%" stopColor="#e05c2a" stopOpacity="0"/></radialGradient>
          <radialGradient id="vulnGlow"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.3"/><stop offset="100%" stopColor="#ef4444" stopOpacity="0"/></radialGradient>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: 'center' }}>
          {/* Ring guides */}
          {[1, 2, 3].map(d => (
            <circle key={d} cx={size.w/2} cy={size.h/2} r={80 + (d-1)*110}
              fill="none" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.4"/>
          ))}

          {/* Edges */}
          {visibleEdges.map((e, i) => {
            const a = positions[e.from], b = positions[e.to]
            if (!a || !b) return null
            // cubic bezier — more elegant than straight lines
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            return (
              <path key={i}
                d={`M ${a.x},${a.y} Q ${mx},${my} ${b.x},${b.y}`}
                fill="none"
                stroke={e.vuln ? '#ef4444' : 'var(--border)'}
                strokeOpacity={e.vuln ? 0.45 : 0.5}
                strokeWidth={e.vuln ? 1.2 : 0.8}
              />
            )
          })}

          {/* Root */}
          <g>
            <circle cx={size.w/2} cy={size.h/2} r="40" fill="url(#rootGlow)"/>
            <circle cx={size.w/2} cy={size.h/2} r={NODE_R_ROOT}
              fill="var(--bg)" stroke="var(--accent)" strokeWidth="2"/>
            <text x={size.w/2} y={size.h/2 + 26} textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize="11.5" fontWeight="700" fill="var(--text)">
              {data?.project_name || 'project'}
            </text>
            <text x={size.w/2} y={size.h/2 + 40} textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize="10" fill="var(--text-3)">root</text>
          </g>

          {/* Nodes */}
          {visibleNodes.map(n => {
            const p = positions[n.id]
            if (!p) return null
            const isHover = hover === n.id
            const r = n.vulns > 0 ? NODE_R_VULN : NODE_R
            const fill = n.vulns > 0 ? '#ef4444' : n.type === 'transitive' ? '#f59e0b' : '#22c55e'
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect && onSelect(n)}
                style={{ cursor: 'pointer' }}
              >
                {n.vulns > 0 && <circle r="22" fill="url(#vulnGlow)"/>}
                <circle r={r + (isHover ? 3 : 0)}
                  fill={isHover ? fill : 'var(--bg)'}
                  stroke={fill}
                  strokeWidth={isHover ? 2 : 1.5}
                  style={{ transition: 'all 0.15s' }}
                />
                {(isHover || n.depth === 1) && (
                  <g>
                    <text textAnchor="middle" y={r + 14}
                      fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="600"
                      fill={isHover ? 'var(--text)' : 'var(--text-2)'}>
                      {n.name}
                    </text>
                    <text textAnchor="middle" y={r + 26}
                      fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--text-3)">
                      @{n.version}
                    </text>
                  </g>
                )}
                {n.vulns > 0 && (
                  <text textAnchor="middle" y="3.5"
                    fontFamily="var(--font-body)" fontSize="9" fontWeight="700" fill="#fff">
                    {n.vulns}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hover && positions[hover] && (() => {
        const n = visibleNodes.find(x => x.id === hover)
        if (!n) return null
        return (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 2,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 12px', maxWidth: 260,
            pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{n.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>@{n.version}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
              {n.type === 'direct' ? '● Direct dependency' : '○ Transitive dependency'} · depth {n.depth}
            </div>
            {n.vulns > 0 && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2, fontWeight: 600 }}>⚠️ {n.vulns} CVE{n.vulns > 1 ? 's' : ''}</div>}
          </div>
        )
      })()}

      {/* Empty state */}
      {visibleNodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          No matching packages
        </div>
      )}
    </div>
  )
}

const btnIcon = {
  width: 28, height: 26, background: 'transparent', border: 'none',
  color: 'var(--text-2)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

/* ────────────────────────────────────────
   TREE VIEW (existing list version, kept)
   ──────────────────────────────────────── */
function Node({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.dependencies?.length > 0
  const vulnCount   = node.vulnerabilities?.length || 0
  const isVuln      = vulnCount > 0
  const color       = isVuln ? '#ef4444' : depth === 0 ? 'var(--accent)' : node.type === 'transitive' ? '#f59e0b' : '#22c55e'
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
        {depth > 0 && <span style={{ color: 'var(--border)', fontSize: 11 }}>└─</span>}
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: depth === 0 ? 700 : 500, color: 'var(--text)' }}>{node.name}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-3)' }}>@{node.version}</span>
        {node.type === 'direct' && <span style={{ fontSize: 10, background: 'var(--fix-bg)', color: '#22c55e', border: '1px solid var(--fix-border)', borderRadius: 3, padding: '1px 6px' }}>direct</span>}
        {node.type === 'transitive' && <span style={{ fontSize: 10, background: 'var(--warn-bg)', color: '#f59e0b', border: '1px solid var(--warn-border)', borderRadius: 3, padding: '1px 6px' }}>transitive</span>}
        {isVuln && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>⚠️ {vulnCount} CVE{vulnCount > 1 ? 's' : ''}</span>}
        {!isVuln && depth > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ok)' }}>✓</span>}
        {hasChildren && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: isVuln ? 8 : 0 }}>{expanded ? '▲' : `▼ ${node.dependencies.length}`}</span>}
      </div>
      {expanded && hasChildren && node.dependencies.map((child, i) => (
        <Node key={`${child.name}@${child.version}-${i}`} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function DependencyGraph({ data }) {
  const [view, setView] = useState('graph')  // 'graph' | 'tree'
  const [filter, setFilter] = useState('all') // 'all' | 'vuln'
  const [search, setSearch] = useState('')
  const deps = data?.graph?.dependencies || []
  const filteredTree = search ? deps.filter(d => d.name.toLowerCase().includes(search.toLowerCase())) : deps

  return (
    <div>
      <StepBanner icon="🌳" title="Dependency Tree"
        text="Every package — direct and transitive. Click any node to inspect. Switch between graph and tree views below."
      />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {[{k:'graph',l:'◉ Graph'},{k:'tree',l:'≡ Tree'}].map(o=>(
            <button key={o.k} onClick={() => setView(o.k)} style={{
              padding: '7px 14px', border: 'none', cursor: 'pointer',
              background: view === o.k ? 'var(--surface2)' : 'transparent',
              color: view === o.k ? 'var(--accent)' : 'var(--text-2)',
              fontSize: 12, fontWeight: 600,
              borderRight: o.k === 'graph' ? '1px solid var(--border)' : 'none',
            }}>{o.l}</button>
          ))}
        </div>

        {/* Filter (graph only) */}
        {view === 'graph' && (
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {[{k:'all',l:'All'},{k:'vuln',l:'⚠️ With CVEs'}].map(o=>(
              <button key={o.k} onClick={() => setFilter(o.k)} style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer',
                background: filter === o.k ? 'var(--surface2)' : 'transparent',
                color: filter === o.k ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 12, fontWeight: 600,
                borderRight: o.k === 'all' ? '1px solid var(--border)' : 'none',
              }}>{o.l}</button>
            ))}
          </div>
        )}

        {/* Search (tree only) */}
        {view === 'tree' && (
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter packages…"
            style={{ flex: 1, minWidth: 200, padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 12,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', outline: 'none' }}
          />
        )}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--text-2)', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}/>CVE</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}/>Transitive</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}/>Clean</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}/>Root</span>
        </div>
      </div>

      {/* View */}
      {view === 'graph' ? (
        <GraphView data={data} filter={filter} />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <Node node={{ name: data?.project_name || 'project', version: '—', type: 'root', dependencies: filteredTree, vulnerabilities: [] }} depth={0} />
          {filteredTree.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No packages match "{search}"</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-3)' }}>
        {view === 'graph'
          ? 'Drag to pan · use +/− to zoom · hover any node for details · click to inspect'
          : 'Click any node to expand/collapse its dependencies'}
      </div>
    </div>
  )
}
