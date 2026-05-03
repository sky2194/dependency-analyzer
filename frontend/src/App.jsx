import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Learn from './pages/Learn'
import Results from './pages/Results'

export const ScanContext = createContext({ scanning: false, scanProject: '', setScanning: () => {}, setScanProject: () => {} })
export const useScan = () => useContext(ScanContext)

function ScanStatusBar({ scanning, scanProject }) {
  if (!scanning) return null
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#2d1510', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 12px', color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />
      Scanning {scanProject}...
    </div>
  )
}

export default function App() {
  const [scanning, setScanning] = useState(false)
  const [scanProject, setScanProject] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const navigate = useNavigate()

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [])

  return (
    <ScanContext.Provider value={{ scanning, setScanning, scanProject, setScanProject }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes pulse-border { 0%,100%{box-shadow:0 0 0 0 #e05c2a44} 50%{box-shadow:0 0 0 4px #e05c2a22} }
        .nav-brand { font-family: var(--font-display); font-weight: 900; font-size: 17px; color: var(--text); margin-right: 20px; letter-spacing: -0.3px; white-space: nowrap; }
        .nav-brand span { color: var(--accent); }
        @media (max-width: 480px) {
          .nav-brand { font-size: 14px; margin-right: 10px; }
          .nav-label { display: none; }
        }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 4, height: 52, position: 'sticky', top: 0, zIndex: 100 }}>

          {/* Brand */}
          <NavLink to="/" className="nav-brand">
            🔐 <span>Dep</span>Analyzer
          </NavLink>

          {/* Nav links */}
          {[
            { to: '/',      label: 'Scanner',          end: true },
            { to: '/learn', label: 'Knowledge Base' },
          ].map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              padding: '6px 13px', fontSize: 13, fontWeight: 600, borderRadius: 6,
              background: isActive ? '#2d1510' : 'none',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            })}>
              {label}
            </NavLink>
          ))}

          <ScanStatusBar scanning={scanning} scanProject={scanProject} />

          <button onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 14, color: 'var(--muted)', transition: 'all 0.15s', flexShrink: 0 }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </nav>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/results" element={<Results />} />
          <Route path="/learn" element={<Learn />} />
        </Routes>
      </div>
    </ScanContext.Provider>
  )
}
