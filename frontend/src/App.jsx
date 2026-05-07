import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import Landing from './pages/Landing'
import Scanner from './pages/Scanner'
import Analytics from './pages/Analytics'
import Learn from './pages/Learn'
import Scanning from './pages/Scanning'

export const ScanContext = createContext({ scanning: false, scanProject: '', setScanning: () => {}, setScanProject: () => {} })
export const useScan = () => useContext(ScanContext)

export default function App() {
  const [scanning, setScanning] = useState(false)
  const [scanProject, setScanProject] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const location = useLocation()
  const isLanding = location.pathname === '/'

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [])

  return (
    <ScanContext.Provider value={{ scanning, setScanning, scanProject, setScanProject }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes pulse-node{0%,100%{opacity:0.8}50%{opacity:1}} @keyframes dash{to{stroke-dashoffset:-20}}`}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        {!isLanding && (
          <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4, height: 52, position: 'sticky', top: 0, zIndex: 100 }}>
            <NavLink to="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--text)', marginRight: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, background: 'var(--orange)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🔐</div>
              DepAnalyzer
            </NavLink>
            {[{to:'/scan',label:'Scanner'},{to:'/learn',label:'📖 Knowledge Base'}].map(({to,label}) => (
              <NavLink key={to} to={to} style={({isActive}) => ({ padding: '6px 14px', fontSize: 13, fontWeight: 600, borderRadius: 6, background: isActive ? 'rgba(224,92,42,0.1)' : 'none', color: isActive ? 'var(--orange)' : 'var(--text-muted)', transition: 'all 0.15s' })}>
                {label}
              </NavLink>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {scanning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(224,92,42,0.1)', border: '1px solid rgba(224,92,42,0.3)', borderRadius: 6, padding: '4px 12px', color: 'var(--orange)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                  Scanning {scanProject}...
                </div>
              )}
              <button onClick={toggleTheme} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </nav>
        )}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/scanning" element={<Scanning />} />
          <Route path="/results" element={<Analytics />} />
          <Route path="/learn" element={<Learn />} />
        </Routes>
      </div>
    </ScanContext.Provider>
  )
}
