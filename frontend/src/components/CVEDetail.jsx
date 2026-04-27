import SeverityBadge from './SeverityBadge'
import Tooltip from './Tooltip'

function PathRow({ label, path, color }) {
  if (!path?.length) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {path.map((p, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ background: i === path.length - 1 ? '#2d1515' : 'var(--surface2)', color: i === path.length - 1 ? color || '#ef4444' : 'var(--text)', padding: '2px 8px', borderRadius: 4 }}>{p}</span>
            {i < path.length - 1 && <span style={{ color: 'var(--muted)' }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function CVEDetail({ vuln, onClose }) {
  if (!vuln) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 620, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <SeverityBadge level={vuln.severity} />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}>{vuln.cve_id}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{vuln.package}@{vuln.version}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent2)' }}>CVSS {vuln.cvss_score}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Description</div>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{vuln.description}</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>🔗 <Tooltip termKey="cvePath">CVE Path</Tooltip></div>
          <PathRow label="Direct path:" path={vuln.path} color="#ef4444" />
          {vuln.transitive_path && (
            <PathRow label="Also reachable via transitive chain:" path={vuln.transitive_path} color="#f97316" />
          )}
        </div>

        <div style={{ background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: 6, padding: '10px 12px', marginBottom: 10, fontSize: 13, lineHeight: 1.6 }}>
          🎯 <strong style={{ color: '#fca5a5' }}><Tooltip termKey="rootCause">Root Cause:</Tooltip></strong>
          <span style={{ color: 'var(--text)', marginLeft: 6 }}>{vuln.root_cause}</span>
        </div>

        <div style={{ background: '#0f2d1a', border: '1px solid #14532d', borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
          🛠️ <strong style={{ color: '#6ee7b7' }}>Fix:</strong>
          <span style={{ color: 'var(--text)', marginLeft: 6 }}>{vuln.fix}</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {vuln.nvd_url && <a href={vuln.nvd_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--info)', textDecoration: 'underline' }}>View on <Tooltip termKey="nvd">NVD</Tooltip> ↗</a>}
          {vuln.osv_url && <a href={vuln.osv_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--info)', textDecoration: 'underline' }}>View on <Tooltip termKey="osv">OSV</Tooltip> ↗</a>}
        </div>

        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
          ⚠️ <strong>Before applying this fix:</strong> Always test in a staging environment first. Check that upgrading doesn't break peer dependency requirements or change API behaviour your code depends on. The safe version shown is the minimum fix — your project may have constraints that require a different approach.
        </div>
      </div>
    </div>
  )
}
