import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { createContext, useContext, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Results from './pages/Results'


export const ScanContext = createContext({ scanning: false, scanProject: '', setScanning: () => {}, setScanProject: () => {} })
export const useScan = () => useContext(ScanContext)

function ScanStatusBar({ scanning, scanProject, navigate }) {
  if (!scanning) return null
  return (
    <button onClick={() => navigate('/')}
      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#2d1510', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--font-mono)', animation: 'pulse-border 2s ease-in-out infinite' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />
      Scanning {scanProject}... click to view progress
    </button>
  )
}

export default function App() {
  const [scanning, setScanning] = useState(false)
  const [scanProject, setScanProject] = useState('')
  const navigate = useNavigate()

  return (
    <ScanContext.Provider value={{ scanning, setScanning, scanProject, setScanProject }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes pulse-border { 0%,100%{box-shadow:0 0 0 0 #e05c2a44} 50%{box-shadow:0 0 0 4px #e05c2a22} }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4, height: 52, position: 'sticky', top: 0, zIndex: 100 }}>
          <NavLink to="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--text)', marginRight: 24, letterSpacing: 0.5 }}>
            🔐 Dependency Analyzer
          </NavLink>
          {[{ to: '/', label: 'Dashboard', end: true }].map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              padding: '6px 14px', fontSize: 13, fontWeight: 600, borderRadius: 6,
              background: isActive ? '#2d1510' : 'none',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              transition: 'all 0.15s',
            })}>
              {label}
            </NavLink>
          ))}
          <ScanStatusBar scanning={scanning} scanProject={scanProject} navigate={navigate} />
        </nav>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/results" element={<Results />} />

        </Routes>
      </div>
    </ScanContext.Provider>
  )
}
