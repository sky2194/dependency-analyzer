const C = {
  CRITICAL: { bg: '#2d1515', color: '#ef4444', border: '#7f1d1d' },
  HIGH:     { bg: '#2d1f0f', color: '#f97316', border: '#7c2d12' },
  MEDIUM:   { bg: '#2d2609', color: '#eab308', border: '#713f12' },
  LOW:      { bg: '#0f1d2d', color: '#3b82f6', border: '#1e3a5f' },
}
export default function SeverityBadge({ level }) {
  const c = C[level] || C.LOW
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
      {level}
    </span>
  )
}
