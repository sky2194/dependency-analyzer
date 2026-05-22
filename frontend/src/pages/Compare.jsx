import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjectScans } from '../utils/projectStore'

export default function Compare() {
  const navigate = useNavigate()
  const [selectedProject, setSelectedProject] = useState(null)
  const [scan1, setScan1] = useState(null)
  const [scan2, setScan2] = useState(null)
  
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
        ← Back
      </button>
      
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: -0.4 }}>
        Compare Scans
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
        Compare two scans to see what changed: new CVEs, fixed vulnerabilities, package updates.
      </p>
      
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, textAlign: 'center' }}>
          🚧 Compare view coming soon
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
          This feature will show side-by-side comparison of:
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            <li>• New vulnerabilities introduced</li>
            <li>• Fixed vulnerabilities</li>
            <li>• Package version changes</li>
            <li>• Net risk score delta</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
