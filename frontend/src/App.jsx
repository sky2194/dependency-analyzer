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
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        .nav-brand {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: 17px;
          color: var(--text);
          margin-right: 20px;
          letter-spacing: -0.3px;
          white-space: nowrap;
          text-decoration: none;
        }
        .nav-brand span { color: var(--accent); }
        @media (max-width: 480px) {
          .nav-brand { font-size: 14px; margin-right: 10px; }
        }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 4, height: 52, position: 'sticky', top: 0, zIndex: 100 }}>

          {/* Brand — plain Link, not NavLink, so it never gets active styling */}
          <Link to="/" className="nav-brand">
            🔐 <span>Dep</span>Analyzer
          </Link>

          {/* Nav tabs */}
          {[
            { to: '/',      label: 'Scanner',        end: true },
            { to: '/learn', label: 'Resource Centre' },
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

          {scanning && (
            <div style={{ marginLeft: 12 }}>
              <ScanStatusBar scanning={scanning} scanProject={scanProject} />
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
