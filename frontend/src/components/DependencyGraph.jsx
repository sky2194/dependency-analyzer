import { useState, useMemo, useRef, useCallback, useEffect } from 'react'

const SEV_COLOR = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' }
const SEV_FILL  = { CRITICAL: 'var(--red-dim)',  HIGH: 'var(--yellow-dim)', MEDIUM: 'var(--blue-dim)', LOW: 'var(--green-dim)' }

function flatten(node, depth = 0, parent = null, out = []) {
  if (!node) return out
  out.push({ name: node.name, version: node.version, depth, parent, vulns: Array.isArray(node.vulnerabilities) ? node.vulnerabilities : [] })
  if (Array.isArray(node.dependencies)) for (const d of node.dependencies) flatten(d, depth + 1, node.name, out)
  return out
}

function topSev(vulns) {
  if (!vulns?.length) return null
  for (const s of ['CRITICAL','HIGH','MEDIUM','LOW']) {
    const v = vulns.find(x => (x.severity||'').toUpperCase() === s)
    if (v) return { sev: s, cvss: v.cvss_score, fix: v.fix_version }
  }
  return null
}

function getAncestors(name, all) {
  const result = new Set()
  let cur = name
  for (let i = 0; i < 20; i++) {
    const node = all.find(n => n.name === cur)
    if (!node?.parent) break
    result.add(node.parent)
    cur = node.parent
  }
  return result
}

function getDescendants(name, all) {
  const result = new Set()
  const queue  = [name]
  while (queue.length) {
    const cur = queue.shift()
    all.filter(n => n.parent === cur).forEach(c => { if (!result.has(c.name)) { result.add(c.name); queue.push(c.name) } })
  }
  return result
}

const NODE_R    = 22   // node radius
const H_GAP     = 160  // horizontal gap between nodes
const V_GAP     = 110  // vertical gap between rows
const MAX_PER_ROW = 7  // max transitive nodes per row

export default function DependencyGraph({ data }) {
  const tree = data?.dependency_tree || data?.graph
  const allNodes = useMemo(() => tree ? flatten(tree) : [], [tree])
  const totalNodes = allNodes.length

  // Default to vulnerable-only for large trees
  const [viewMode,     setViewMode]     = useState(totalNodes > 50 ? 'vulnerable' : 'all')
  const [sevFilter,    setSevFilter]    = useState('ALL')
  const [selectedNode, setSelectedNode] = useState(null)
  const [isolatedNode, setIsolatedNode] = useState(null)
  const [zoom,         setZoom]         = useState(1)
  const [pan,          setPan]          = useState({ x: 0, y: 0 })
  const [isPanning,    setIsPanning]    = useState(false)
  const panStart   = useRef(null)
  const containerRef = useRef(null)

  // Zoom via Ctrl+scroll only — normal scroll passes through to page
  const onWheel = useCallback(e => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setZoom(z => Math.min(3, Math.max(0.25, z * (e.deltaY > 0 ? 0.9 : 1.1))))
  }, [])
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return
    setIsPanning(true)
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }, [pan])
  const onMouseMove = useCallback(e => {
    if (!isPanning || !panStart.current) return
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
  }, [isPanning])
  const onMouseUp = useCallback(() => { setIsPanning(false); panStart.current = null }, [])

  // Compute layout
  const layout = useMemo(() => {
    if (!allNodes.length) return null

    // 1. Filter nodes
    let filtered = allNodes
    if (isolatedNode) {
      const desc = getDescendants(isolatedNode, allNodes)
      const anc  = getAncestors(isolatedNode, allNodes)
      filtered = allNodes.filter(n => n.name === isolatedNode || desc.has(n.name) || anc.has(n.name))
    } else if (viewMode === 'vulnerable') {
      const vulnNames = new Set(allNodes.filter(n => n.vulns.length > 0).map(n => n.name))
      filtered = allNodes.filter(n => {
        if (n.depth === 0) return true
        if (vulnNames.has(n.name)) return true
        // include parents of vulnerable nodes up to root
        return allNodes.some(v => vulnNames.has(v.name) && getAncestors(v.name, allNodes).has(n.name))
      })
    } else if (viewMode === 'direct') {
      filtered = allNodes.filter(n => n.depth <= 1)
    }

    if (sevFilter !== 'ALL') {
      filtered = filtered.filter(n => n.depth === 0 || n.vulns.some(v => (v.severity||'').toUpperCase() === sevFilter))
    }

    const root       = filtered.find(n => n.depth === 0)
    if (!root) return null
    const directs    = filtered.filter(n => n.depth === 1).sort((a,b) => (b.vulns.length - a.vulns.length) || a.name.localeCompare(b.name))
    const transitives= filtered.filter(n => n.depth >= 2).sort((a,b) => (b.vulns.length - a.vulns.length) || a.name.localeCompare(b.name))

    // 2. Place nodes
    const dCount  = directs.length
    const W       = Math.max(dCount * H_GAP + 200, 900)
    const rootX   = W / 2
    const rootY   = 60
    const directY = rootY + V_GAP + NODE_R

    const placedDirects = directs.map((d, i) => ({
      ...d,
      x: dCount === 1 ? rootX : 100 + i * ((W - 200) / Math.max(dCount - 1, 1)),
      y: directY,
    }))

    const placedTrans = transitives.map((t, i) => {
      const row    = Math.floor(i / MAX_PER_ROW)
      const col    = i % MAX_PER_ROW
      const inRow  = Math.min(transitives.length - row * MAX_PER_ROW, MAX_PER_ROW)
      const rowW   = Math.min(inRow * H_GAP, W - 200)
      const startX = (W - rowW) / 2 + NODE_R
      const x      = inRow === 1 ? rootX : startX + col * (rowW / Math.max(inRow - 1, 1))
      const y      = directY + V_GAP + row * V_GAP
      const parent = placedDirects.find(p => p.name === t.parent)
      return { ...t, x, y, parentX: parent?.x ?? rootX, parentY: parent?.y ?? directY }
    })

    const tRows = Math.ceil(transitives.length / MAX_PER_ROW)
    const H = directY + (transitives.length ? V_GAP + tRows * V_GAP : 0) + 80

    const stats = {
      total: filtered.length,
      vulnerable: filtered.filter(n => n.vulns.length > 0).length,
      direct: directs.length,
      transitive: transitives.length,
    }

    return { root: { ...root, x: rootX, y: rootY }, directs: placedDirects, transitives: placedTrans, all: filtered, W, H, stats }
  }, [allNodes, viewMode, sevFilter, isolatedNode])

  if (!tree || !layout) return (
    <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center', fontSize: 13 }}>No dependency tree available.</div>
  )

  const { root, directs, transitives, all, W, H, stats } = layout

  // Highlight state
  const highlightedPaths = useMemo(() => {
    if (!selectedNode) return null
    return { anc: getAncestors(selectedNode, all), desc: getDescendants(selectedNode, all) }
  }, [selectedNode, all])

  const isLit    = name => !highlightedPaths || name === selectedNode || highlightedPaths.anc.has(name) || highlightedPaths.desc.has(name)
  const edgeLit  = (a, b) => !highlightedPaths || isLit(a) && isLit(b)

  const selData  = selectedNode ? [...directs, ...transitives, root].find(n => n.name === selectedNode) : null

  const handleClick = (name, e) => {
    e.stopPropagation()
    setSelectedNode(prev => prev === name ? null : name)
  }

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedNode(null); setIsolatedNode(null); setViewMode(totalNodes > 50 ? 'vulnerable' : 'all'); setSevFilter('ALL') }

  const btnStyle = (active, color) => ({
    padding: '5px 11px', border: 'none', borderRadius: 5, cursor: 'pointer',
    fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)', transition: 'all 0.15s',
    background: active ? (color || 'var(--accent)') : 'transparent',
    color: active ? 'var(--white)' : (color || 'var(--text-secondary)'),
  })

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* View */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: 3 }}>
          {[['all','◉ All'],['vulnerable','⚠ Vulnerable'],['direct','▲ Direct']].map(([id,label]) => (
            <button key={id} onClick={() => { setViewMode(id); setSelectedNode(null) }} style={btnStyle(viewMode === id)}>{label}</button>
          ))}
        </div>
        {/* Severity */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: 3 }}>
          {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
            <button key={s} onClick={() => { setSevFilter(s); setSelectedNode(null) }}
              style={btnStyle(sevFilter === s, s === 'ALL' ? null : SEV_COLOR[s])}>
              {s}
            </button>
          ))}
        </div>
        {/* Zoom */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 6px' }}>
          <button onClick={() => setZoom(z => Math.min(3,  z * 1.2))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--text-secondary)', lineHeight:1, padding:'0 2px' }}>+</button>
          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text-muted)', minWidth:36, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.25,z * 0.8))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--text-secondary)', lineHeight:1, padding:'0 2px' }}>−</button>
        </div>
        <button onClick={reset} style={{ padding:'5px 11px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, color:'var(--text-secondary)', cursor:'pointer', fontSize:11, fontFamily:'var(--font-ui)' }}>↺ Reset</button>
        {totalNodes > 50 && viewMode === 'all' && (
          <span style={{ fontSize:11, color:'var(--yellow)', fontFamily:'var(--font-mono)' }}>⚠ {totalNodes} nodes — try Vulnerable view for clarity</span>
        )}
        <div style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
          {stats.total} nodes · <span style={{ color:'var(--critical)' }}>{stats.vulnerable} vulnerable</span> · {stats.direct} direct · {stats.transitive} transitive
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display:'flex', gap:14, marginBottom:10, fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', flexWrap:'wrap', alignItems:'center' }}>
        {[['var(--critical)','Critical'],['var(--high)','High'],['var(--medium)','Medium'],['var(--green)','Safe']].map(([c,l]) => (
          <span key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:9, height:9, borderRadius:'50%', background:c, display:'inline-block' }} />{l}
          </span>
        ))}
        <span style={{ color:'var(--border-mid)' }}>── Vulnerable path &nbsp; - - Safe edge</span>
        <span style={{ marginLeft:'auto' }}>Ctrl+Scroll = zoom · Drag = pan · Click = highlight path</span>
      </div>

      {/* ── Selected node panel ── */}
      {selData && (() => {
        const sev  = topSev(selData.vulns)
        const desc = getDescendants(selData.name, all)
        const anc  = getAncestors(selData.name, all)
        return (
          <div style={{ marginBottom:10, padding:'10px 14px', background:'var(--bg-elevated)', border:`1px solid ${sev ? SEV_COLOR[sev.sev] : 'var(--border)'}`, borderRadius:8, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <span style={{ fontWeight:700, fontSize:13, fontFamily:'var(--font-mono)', color:'var(--text-primary)' }}>{selData.name}</span>
                <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>v{selData.version}</span>
                {sev && <span style={{ fontSize:10, fontWeight:700, color:SEV_COLOR[sev.sev], background:SEV_FILL[sev.sev], padding:'2px 6px', borderRadius:4 }}>{sev.sev} {sev.cvss && `· CVSS ${sev.cvss}`}</span>}
                <span style={{ fontSize:10, color:'var(--text-muted)', background:'var(--bg-card)', padding:'2px 6px', borderRadius:4, border:'1px solid var(--border)' }}>{selData.depth===0?'ROOT':selData.depth===1?'DIRECT':'TRANSITIVE'}</span>
              </div>
              <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--text-muted)' }}>
                {selData.parent && <span>Parent: <span style={{ color:'var(--text-secondary)', fontFamily:'var(--font-mono)' }}>{selData.parent}</span></span>}
                <span>{desc.size} dependents · {anc.size} ancestors</span>
                {sev?.fix && <span>Fix available: <span style={{ color:'var(--green)', fontFamily:'var(--font-mono)' }}>v{sev.fix}</span></span>}
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {!isolatedNode && (
                <button onClick={() => { setIsolatedNode(selData.name) }}
                  style={{ padding:'5px 11px', background:'var(--orange-dim)', border:'1px solid var(--accent)', borderRadius:6, color:'var(--accent)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                  ⬡ Isolate Subtree
                </button>
              )}
              {isolatedNode && (
                <button onClick={() => { setIsolatedNode(null); setSelectedNode(null) }}
                  style={{ padding:'5px 11px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-secondary)', cursor:'pointer', fontSize:11 }}>
                  ✕ Clear Isolation
                </button>
              )}
              <button onClick={() => setSelectedNode(null)} style={{ padding:'5px 9px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>✕</button>
            </div>
          </div>
        )
      })()}

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={() => setSelectedNode(null)}
        style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', height:'62vh', cursor:isPanning?'grabbing':'grab', position:'relative', userSelect:'none' }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width:'100%', height:'100%', transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin:'center center', transition:isPanning?'none':'transform 0.08s ease', fontFamily:'var(--font-mono)' }}
        >
          {/* Root → Directs edges */}
          {directs.map((d,i) => {
            const vuln = d.vulns.length > 0
            const lit  = edgeLit(root.name, d.name)
            return <line key={`re${i}`} x1={root.x} y1={root.y+NODE_R} x2={d.x} y2={d.y-NODE_R}
              stroke={vuln?'var(--critical)':'var(--border-mid)'} strokeWidth={vuln?1.5:1}
              strokeDasharray={vuln?'0':'5 4'} opacity={lit?(vuln?0.85:0.5):0.08} />
          })}

          {/* Directs → Transitives edges */}
          {transitives.map((t,i) => {
            const vuln = t.vulns.length > 0
            const lit  = edgeLit(t.parent, t.name)
            return <line key={`te${i}`} x1={t.parentX} y1={t.parentY+NODE_R} x2={t.x} y2={t.y-NODE_R}
              stroke={vuln?'var(--high)':'var(--border-mid)'} strokeWidth={vuln?1.5:0.8}
              strokeDasharray="5 4" opacity={lit?(vuln?0.75:0.35):0.06} />
          })}

          {/* Root node */}
          <g style={{ cursor:'pointer' }} onClick={e => handleClick(root.name, e)}>
            <circle cx={root.x} cy={root.y} r={NODE_R+4} fill="var(--orange-dim)" stroke="var(--accent)" strokeWidth={selectedNode===root.name?3:2} opacity={isLit(root.name)?1:0.15} />
            <text x={root.x} y={root.y+4} fontSize="10" fill="var(--accent)" textAnchor="middle" fontWeight="700">ROOT</text>
            <text x={root.x} y={root.y+NODE_R+18} fontSize="12" fill="var(--text-primary)" textAnchor="middle" fontWeight="700">{root.name}</text>
            <text x={root.x} y={root.y+NODE_R+30} fontSize="10" fill="var(--text-muted)" textAnchor="middle">{root.version}</text>
          </g>

          {/* All package nodes */}
          {[...directs, ...transitives].map((n, i) => {
            const sev     = topSev(n.vulns)
            const col     = sev ? SEV_COLOR[sev.sev] : 'var(--green)'
            const fill    = sev ? SEV_FILL[sev.sev]  : 'var(--green-dim)'
            const isSel   = n.name === selectedNode
            const lit     = isLit(n.name)
            const r       = sev ? NODE_R + 2 : n.depth === 1 ? NODE_R : NODE_R - 3
            const label   = n.name.length > 12 ? n.name.slice(0, 11) + '…' : n.name

            return (
              <g key={`n${i}`} style={{ cursor:'pointer' }} onClick={e => handleClick(n.name, e)} opacity={lit ? 1 : 0.12}>
                {/* Glow */}
                {sev && lit && <circle cx={n.x} cy={n.y} r={r+10} fill={col} opacity="0.1" style={{ filter:'blur(6px)' }} />}
                {/* Selection ring */}
                {isSel && <circle cx={n.x} cy={n.y} r={r+7} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />}
                {/* Node */}
                <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={isSel?'var(--accent)':col} strokeWidth={sev?2:1.5} />
                {/* CVSS */}
                {sev?.cvss && (
                  <g>
                    <rect x={n.x-20} y={n.y-r-17} width="40" height="13" rx="3" fill={col} opacity="0.2" />
                    <text x={n.x} y={n.y-r-7} fontSize="8" fill={col} textAnchor="middle" fontWeight="700">CVSS {sev.cvss}</text>
                  </g>
                )}
                {/* Direct badge */}
                {n.depth===1 && !sev && <text x={n.x} y={n.y-r-7} fontSize="8" fill="var(--accent)" textAnchor="middle" fontWeight="600" opacity="0.8">DIRECT</text>}
                {/* Label */}
                <text x={n.x} y={n.y+r+14} fontSize={sev?11:10} fill={isSel?'var(--accent)':sev?col:'var(--text-primary)'} textAnchor="middle" fontWeight={sev||isSel?'700':'500'}>{label}</text>
                {/* Version */}
                <text x={n.x} y={n.y+r+25} fontSize="9" fill="var(--text-muted)" textAnchor="middle">{n.version}</text>
              </g>
            )
          })}
        </svg>

        {/* Zoom hint */}
        {zoom !== 1 && <div style={{ position:'absolute', bottom:10, right:14, fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>{Math.round(zoom*100)}%</div>}
        {/* Large tree hint */}
        {viewMode === 'all' && totalNodes > 50 && <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', fontSize:11, color:'var(--yellow)', background:'var(--warn-bg)', border:'1px solid var(--warn-border)', borderRadius:6, padding:'4px 12px', pointerEvents:'none' }}>⚠ {totalNodes} nodes — switch to Vulnerable view for clarity</div>}
      </div>
    </div>
  )
}
