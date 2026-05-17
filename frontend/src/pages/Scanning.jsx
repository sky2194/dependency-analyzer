import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import API_BASE from '../config'
import { useScan } from '../App'

const STEPS = [
  { icon: '📄', label: 'Parsing manifest structure' },
  { icon: '🌳', label: 'Resolving transitive dependencies' },
  { icon: '🔗', label: 'Building dependency graph' },
  { icon: '🔍', label: 'Checking vulnerability databases' },
  { icon: '🛡️', label: 'Querying OSV database' },
  { icon: '📊', label: 'Calculating risk score' },
]

export default function Scanning() {
  const { state: locationState } = useLocation()
  const navigate = useNavigate()
  const { setScanning } = useScan()
  const [step, setStep] = useState(0)
  const [scanError, setScanError] = useState(null)
  const abortControllerRef = useRef(null)

  const hasRequiredState = Boolean(locationState?.code && locationState?.ecosystem)

  useEffect(() => {
    if (!hasRequiredState) return

    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()

    if (typeof setScanning === 'function') setScanning(true)

    // Slower step progression — feels more realistic for longer scans
    const interval = setInterval(() => {
      setStep(s => {
        if (s >= STEPS.length - 2) return s // Hold at second-to-last until scan completes
        return s + 1
      })
    }, 1500)

    let scanCompleted = false

    async function performScan() {
      try {
        const res = await axios.post(`${API_BASE}/api/scan`, {
          content: locationState.code,
          ecosystem: locationState.ecosystem,
        }, {
          timeout: 120000,
          signal: abortControllerRef.current.signal
        })

        if (scanCompleted) return
        scanCompleted = true
        clearInterval(interval)
        setStep(STEPS.length - 1)
        setTimeout(() => {
          if (typeof setScanning === 'function') setScanning(false)
          navigate('/results', { state: { result: res.data } })
        }, 600)
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return

        scanCompleted = true
        clearInterval(interval)
        if (typeof setScanning === 'function') setScanning(false)

        const status = err?.response?.status
        let msg = 'Scan failed — please try again'
        if (status === 408) msg = 'Scan timed out — try a smaller file'
        if (status === 413) msg = 'File too large — maximum 512KB'
        if (status === 429) msg = 'Too many requests — wait 60s and try again'
        if (status === 403) msg = 'Request blocked — signature mismatch'

        setScanError(msg)
      }
    }

    performScan()
    return () => {
      clearInterval(interval)
      scanCompleted = true
      if (typeof setScanning === 'function') setScanning(false)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    if (typeof setScanning === 'function') setScanning(false)
    navigate('/scan')
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100)

  // Fallback: user hit /scanning directly
  if (!hasRequiredState) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <div style={{ width: '90%', maxWidth: 420, padding: 32, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No active scan</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            This page only renders during a live scan. Start one from the Scanner.
          </p>
          <button onClick={() => navigate('/scan')} aria-label="Go to scanner" style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--orange)', color: 'var(--white)', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            ← Go to Scanner
          </button>
        </div>
      </div>
    )
  }

  // Error state
  if (scanError) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <div style={{ width: '90%', maxWidth: 420, padding: 32, background: 'var(--bg-card)', border: '1px solid var(--critical)', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--critical)' }}>Scan Failed</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            {scanError}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => navigate('/scan')} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              ← Back
            </button>
            <button onClick={() => { setScanError(null); setStep(0); window.location.reload() }} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--orange)', color: 'var(--white)', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '90%', maxWidth: 480, padding: 'clamp(24px, 5vw, 40px)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 64px var(--overlay-bg)' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Scanning Dependencies</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {locationState?.ecosystem?.toUpperCase() || 'npm'} · Analyzing your project...
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
                  fontSize: 11, fontWeight: 700, color: isPast ? 'var(--white)' : isCurrent ? 'var(--orange)' : 'var(--text-muted)',
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

        <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Scan progress" style={{ background: 'var(--bg-elevated)', borderRadius: 8, height: 4, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height: '100%', background: 'var(--orange)',
            width: `${progress}%`, transition: 'width 0.6s ease', borderRadius: 8
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Step {step + 1} of {STEPS.length}
          </span>
          <button onClick={handleCancel} aria-label="Cancel scan" style={{
            fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', textDecoration: 'underline', padding: 0
          }}>
            Cancel
          </button>
        </div>

      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  )
}
