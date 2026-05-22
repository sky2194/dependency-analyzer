import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProjects, getProjectScans, deleteProject } from '../utils/projectStore'

export default function History() {
  const navigate = useNavigate()
  const [projects] = useState(getAllProjects())
  const [expandedProject, setExpandedProject] = useState(null)
  
  const formatDate = (timestamp) => {
    const d = new Date(timestamp)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  
  const getRiskColor = (score) => {
    if (score >= 75) return 'var(--critical)'
    if (score >= 50) return 'var(--high)'
    if (score >= 25) return 'var(--medium)'
    return 'var(--low)'
  }
  
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
        ← Back
      </button>
      
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: -0.4, color: 'var(--text-primary)' }}>
        Scan History
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
        View and compare past scans across all your projects.
      </p>
      
      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No scan history yet</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Run your first scan to start tracking vulnerabilities over time</div>
          <button onClick={() => navigate('/scan')} 
            style={{ padding: '10px 20px', background: 'var(--accent)', color: 'var(--white)', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}>
            Start Scanning
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map(project => {
            const scans = getProjectScans(project.name)
            const isExpanded = expandedProject === project.name
            
            return (
              <div key={project.name} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div onClick={() => setExpandedProject(isExpanded ? null : project.name)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{project.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {project.scanCount} scans · Last: {formatDate(project.lastScan)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: getRiskColor(project.lastRisk) }}>
                        {project.lastRisk}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk</div>
                    </div>
                    <div style={{ fontSize: 18, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                      ▼
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: 16, background: 'var(--bg-elevated)' }}>
                    {scans.map((scan, i) => (
                      <div key={scan.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 8, background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', width: 140 }}>
                          {formatDate(scan.timestamp)}
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: 8, fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{scan.summary.vulnerabilities} CVEs</span>
                          <span style={{ color: 'var(--text-muted)' }}>·</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{scan.packages} packages</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: getRiskColor(scan.summary.risk_score) }}>
                          {scan.summary.risk_score}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
