import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import API_BASE from '../config'
import { MOCKS } from '../data/mocks'
import { useScan } from '../App'

const STEPS = [
  { icon: '📄', label: 'Parsing manifest structure' },
  { icon: '🌳', label: 'Resolving transitive dependencies' },
  { icon: '🔗', label: 'Building dependency graph' },
  { icon: '🔍', label: 'Querying NVD database' },
  { icon: '🛡️', label: 'Querying OSV database' },
  { icon: '📊', label: 'Calculating risk score' },
]

export default function Scanning() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { setScanning } = useScan()
  const [step, setStep] = useState(0)

  // Defensive: if hot-reloaded or visited directly, show fallback instead of blank
  const hasRequiredState = Boolean(state?.code && state?.ecosystem)

  useEffect(() => {
    if (!hasRequiredState) return
    if (typeof setScanning === 'function') setScanning(true)

    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, STEPS.length - 1))
    }, 800)

    async function performScan() {
      let result
      try {
        const res = await axios.post(`${API_BASE}/api/scan`, {
          content: state.code,
          ecosystem: state.ecosystem,
        })
        result = res.data
      } catch (err) {
        result = { ...(MOCKS[state.ecosystem] || MOCKS.npm), is_mock: true }
      }
      clearInterval(interval)
      setStep(STEPS.length - 1)
      setTimeout(() => {
        if (typeof setScanning === 'function') setScanning(false)
        navigate('/results', { state: { result } })
      }, 600)
    }

    performScan()
    return () => { clearInterval(interval); if (typeof setScanning === 'function') setScanning(false) }
  }, [])

  const progress = Math.round(((step + 1) / STEPS.length) * 100)

  // Visible fallback if user hits /scanning directly (no scan in flight)
  if (!hasRequiredState) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 420, padding: 32, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No active scan</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            This page only renders during a live scan. Start one from the Scanner.
          </p>
          <button onClick={() => navigate('/scan')} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--orange)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            ← Go to Scanner
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480, padding: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Scanning Dependencies</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {state?.ecosystem?.toUpperCase() || 'npm'} · Analyzing your project...
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {STEPS.map((s, i) => {
            const isPast = i < step
            const isCurrent = i === step
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
                background: isCurrent ? 'var(--bg-elevated)' : 'transparent',
                border: isCurrent ? '1px solid var(--orange)' : '1px solid transparent',
                transition: 'all 0.3s'
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isPast ? 'var(--green)' : isCurrent ? 'var(--orange)' : 'var(--border-light)'}`,
                  background: isPast ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: isPast ? '#000' : isCurrent ? 'var(--orange)' : 'var(--text-muted)',
                  transition: 'all 0.3s'
                }}>
                  {isPast ? '✓' : isCurrent ? '●' : ''}
                </div>
                <span style={{
                  fontSize: 13,
                  color: isPast ? 'var(--green)' : isCurrent ? 'var(--text)' : 'var(--text-muted)',
                  transition: 'color 0.3s'
                }}>
                  {s.icon} {s.label}
                </span>
                {isCurrent && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                    {[0, 1, 2].map(d => (
                      <div key={d} style={{
                        width: 4, height: 4, borderRadius: '50%', background: 'var(--orange)',
                        animation: `bounce 0.8s ease-in-out ${d * 0.15}s infinite`
                      }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, height: 4, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height: '100%', background: 'var(--orange)',
            width: `${progress}%`, transition: 'width 0.6s ease', borderRadius: 8
          }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          Step {step + 1} of {STEPS.length}
        </div>

      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  )
}
