export default function StepBanner({ icon, title, text }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderLeft: '3px solid var(--info)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#93c5fd', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{text}</div>
      </div>
    </div>
  )
}
