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
      setPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      })
    }
  }, [show])

  if (!data) return <span>{children}</span>

  return (
    <>
      <span ref={ref} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ 
          borderBottom: '2px dashed var(--accent)', 
          cursor: 'help', 
          fontWeight: 500, 
          display: 'inline',
          transition: 'all 0.2s ease',
          ...(show && {
            textShadow: '0 0 8px var(--accent)',
            borderBottomColor: 'var(--accent)',
            filter: 'brightness(1.3)'
          })
        }}>
        {children || data.term}
      </span>
      {show && (
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translate(-50%, -100%)',
          background: '#1e2333',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
          width: 270,
          zIndex: 9999,
          fontSize: 12,
          lineHeight: 1.5,
          color: '#e8eaf0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: 1, marginBottom: 5 }}>{data.term}</div>
          {data.plain}
          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 6, background: '#1e2333', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
        </div>
      )}
    </>
  )
}