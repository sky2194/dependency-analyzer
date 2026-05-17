import { useState, useRef, useEffect } from 'react'
import TERMS from '../data/terms'

export default function Tooltip({ termKey, children }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef()
  const data = TERMS[termKey]

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, 140),
        window.innerWidth - 140
      )
      setPos({ top: rect.top - 8, left })
    }
  }, [show])

  if (!data) return <span>{children}</span>

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow(s => !s)}
        style={{
          borderBottom: '1px dotted var(--muted)',
          cursor: 'help',
          color: 'inherit',
          display: 'inline',
        }}
      >
        {children || data.term}
      </span>

      {show && (
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translate(-50%, -100%)',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
          width: 260,
          zIndex: 9999,
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--text)',
          boxShadow: '0 8px 24px var(--overlay-bg)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: 1, marginBottom: 5, fontWeight: 600 }}>
            {data.term}
          </div>
          {data.plain}
          <div style={{
            position: 'absolute', bottom: -5, left: '50%',
            transform: 'translateX(-50%)',
            width: 10, height: 5,
            background: 'var(--surface2)',
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            borderLeft: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
          }} />
        </div>
      )}
    </>
  )
}
