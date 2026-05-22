import { BrowserRouter, Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Scanning from './pages/Scanning'
import Analytics from './pages/Analytics'
import Learn from './pages/Learn'
import History from './pages/History'
import Compare from './pages/Compare'
import ErrorBoundary from './components/ErrorBoundary'

export const ScanContext = createContext({ scanning: false, scanProject: '', setScanning: () => {}, setScanProject: () => {} })
export const useScan = () => useContext(ScanContext)

export default function App() {
  const [scanning, setScanning] = useState(false)
  const [scanProject, setScanProject] = useState('')
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    document.documentElement.setAttribute('data-theme', savedTheme)
    return savedTheme
  })
  const location = useLocation()
  const isLanding = location.pathname === '/'

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])


  return (
    <ScanContext.Provider value={{ scanning, setScanning, scanProject, setScanProject }}>
      <ErrorBoundary>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes pulse-node{0%,100%{opacity:0.8}50%{opacity:1}} @keyframes dash{to{stroke-dashoffset:-20}}`}</style>
        <div style={{ minHeight: location.pathname === '/results' ? undefined : '100vh', height: location.pathname === '/results' ? '100vh' : undefined, overflow: location.pathname === '/results' ? 'hidden' : undefined, background: 'var(--bg)' }}>
          {isLanding ? (
            <div style={{ position: 'fixed', top: 19, right: 16, zIndex: 1001 }}>
              <button onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: theme === 'dark' ? 'var(--orange)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.3s', padding: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--white)', position: 'absolute', top: 3, left: theme === 'dark' ? 19 : 3, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
          ) : (
            <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 4, height: 52, position: 'sticky', top: 0, zIndex: 100 }}>
              <NavLink to="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--text)', marginRight: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, background: 'linear-gradient(135deg, var(--orange), var(--accent2))', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--white)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                DepAnalyzer
              </NavLink>
              {[{to:'/scan',label:'Scanner'},{to:'/learn',label:'📖 Knowledge Base'},{to:'/history',label:'📚 History'}].map(({to,label}) => (
                <NavLink key={to} to={to} style={({isActive}) => ({ padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 6, background: isActive ? 'var(--orange-dim)' : 'none', color: isActive ? 'var(--orange)' : 'var(--text-muted)', transition: 'all 0.15s', whiteSpace: 'nowrap' })}>
                  {label}
                </NavLink>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {scanning && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--orange-dim)', border: '1px solid var(--orange)', borderRadius: 6, padding: '4px 10px', color: 'var(--orange)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                    Scanning...
                  </div>
                )}
                <button onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: theme === 'dark' ? 'var(--orange)' : 'var(--border-light)', cursor: 'pointer', position: 'relative', transition: 'background 0.3s', padding: 0, flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--white)', position: 'absolute', top: 3, left: theme === 'dark' ? 19 : 3, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
              </div>
            </nav>
          )}
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/scan" element={<Dashboard />} />
            <Route path="/scanning" element={<Scanning />} />
            <Route path="/results" element={<Analytics />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/history" element={<History />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </ScanContext.Provider>
  )
}
