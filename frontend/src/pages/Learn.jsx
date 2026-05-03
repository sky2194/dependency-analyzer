import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TERMS from '../data/terms'

const SECTIONS = [
  {
    id: 'pipeline', icon: '🔄', title: 'SCA Pipeline',
    content: [
      { type: 'text', text: 'How dependency scanning fits into CI/CD:' },
      { type: 'diagram', steps: [
        { num: 1, title: 'Code + Dependencies', desc: 'Developer commits package.json / requirements.txt / pom.xml to Git' },
        { num: 2, title: 'Build Process', desc: 'CI runs npm install / pip install / mvn package → resolves all transitive deps → creates artifacts (node_modules, .whl, .jar)' },
        { num: 3, title: 'SBOM Generation', desc: 'Tools like Syft, CycloneDX CLI scan artifacts → extract package names + versions → output SBOM in CycloneDX/SPDX format (JSON/XML)' },
        { num: 4, title: 'Vulnerability Scan', desc: 'Grype/Trivy reads SBOM → queries NVD/OSV for each package@version → matches CVEs' },
        { num: 5, title: 'Report + Gate', desc: 'If CRITICAL CVEs found → fail build OR send alerts. Report includes CVE ID, CVSS score, fix version' },
        { num: 6, title: 'Remediation', desc: 'Developer updates package.json with fixed versions → re-run pipeline' },
      ]},
      { type: 'callout', color: 'info', text: '💡 This tool simulates steps 3-4: you upload package.json, we build the dependency tree (SBOM equivalent) and scan NVD/OSV.' },
    ]
  },
  {
    id: 'sca', icon: '🔍', title: 'What is SCA?',
    content: [
      { type: 'text', text: 'Software Composition Analysis scans your project\'s dependencies for known security vulnerabilities.' },
      { type: 'text', text: 'Modern apps use hundreds of open-source packages. Each can contain security holes (CVEs). SCA tools check every package against vulnerability databases.' },
      { type: 'callout', color: 'info', text: '💡 Up to 80% of modern application code comes from open-source packages.' },
    ]
  },
  {
    id: 'cve', icon: '🏷️', title: 'CVEs',
    content: [
      { type: 'text', text: 'CVE = Common Vulnerability and Exposure. Format: CVE-YEAR-NUMBER. Example: CVE-2021-44228 (Log4Shell).' },
      { type: 'table', headers: ['Field', 'Meaning'], rows: [
        ['CVE ID', 'Unique identifier'],
        ['CVSS Score', 'Severity (0-10)'],
        ['CWE', 'Weakness category'],
        ['Fix Version', 'Patched version'],
      ]},
    ]
  },
  {
    id: 'cvss', icon: '📊', title: 'CVSS Scores',
    content: [
      { type: 'text', text: 'CVSS rates vulnerabilities 0-10 based on exploitability and impact.' },
      { type: 'table', headers: ['Score', 'Severity', 'Action'], rows: [
        ['9.0–10.0', 'CRITICAL', 'Fix immediately'],
        ['7.0–8.9',  'HIGH',     'Fix this week'],
        ['4.0–6.9',  'MEDIUM',   'Fix this month'],
        ['0.1–3.9',  'LOW',      'Fix when convenient'],
      ]},
    ]
  },
  {
    id: 'deps', icon: '🌳', title: 'Direct vs Transitive',
    content: [
      { type: 'text', text: 'Direct = you added it. Transitive = pulled in automatically by your dependencies.' },
      { type: 'code', text: 'Your App\n  └── express@4.17.0 (direct)\n        └── qs@6.7.0 (transitive)\n              └── CVE-2022-24999' },
      { type: 'text', text: 'Most CVEs hide in transitive dependencies you never chose.' },
    ]
  },
  {
    id: 'fix', icon: '🛠️', title: 'How to Fix',
    content: [
      { type: 'text', text: 'Most fixes = upgrade to patched version.' },
      { type: 'table', headers: ['Ecosystem', 'Command'], rows: [
        ['npm',   'npm install lodash@4.17.21'],
        ['PyPI',  'pip install Django==3.2.13'],
        ['Maven', 'Update pom.xml to 2.13.1'],
      ]},
    ]
  },
  {
    id: 'supply-chain', icon: '⛓️', title: 'Supply Chain Attacks',
    content: [
      { type: 'text', text: 'Attacker compromises a popular package → affects millions of apps. Examples: SolarWinds (2020), XZ Utils (2024).' },
      { type: 'callout', color: 'critical', text: '🚨 One compromised package can affect millions of applications worldwide.' },
    ]
  },
  {
    id: 'sbom', icon: '📋', title: 'SBOMs',
    content: [
      { type: 'text', text: 'SBOM = Software Bill of Materials. Complete inventory of every component (like a nutrition label for code).' },
      { type: 'text', text: 'Required by US Executive Order 14028, SOC2, ISO 27001.' },
    ]
  },
]

const COLORS = { info: 'var(--info)', warn: 'var(--accent2)', ok: 'var(--ok)', critical: 'var(--critical)' }
const BG     = { info: '#0d1f3c', warn: 'var(--warn-bg)', ok: 'var(--fix-bg)', critical: 'var(--vuln-bg)' }
const BORDER = { info: '#1e3a5f', warn: 'var(--warn-border)', ok: 'var(--fix-border)', critical: 'var(--vuln-border)' }

export default function Learn() {
  const [active, setActive] = useState('sca')
  const navigate = useNavigate()
  const section  = SECTIONS.find(s => s.id === active)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
        ← Back
      </button>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
        📚 SCA Concepts
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
        Security jargon, decoded.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)} style={{
              textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
              background: active === s.id ? 'var(--surface2)' : 'none',
              border: active === s.id ? '1px solid var(--border)' : '1px solid transparent',
              color: active === s.id ? 'var(--text)' : 'var(--muted)',
              fontSize: 13, fontWeight: active === s.id ? 600 : 400, transition: 'all 0.15s',
            }}>
              {s.icon} {s.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
            {section.icon} {section.title}
          </h2>
          {section.content.map((block, i) => {
            if (block.type === 'text') return (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)', marginBottom: 16 }}>{block.text}</p>
            )
            if (block.type === 'diagram') return (
              <div key={i} style={{ marginBottom: 16 }}>
                {block.steps.map((step, j) => (
                  <div key={j} style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'flex-start' }}>
                    <div style={{ 
                      minWidth: 32, 
                      height: 32, 
                      borderRadius: '50%', 
                      background: 'var(--accent)', 
                      color: '#000', 
                      fontWeight: 700, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: 14,
                      flexShrink: 0
                    }}>
                      {step.num}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{step.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
            if (block.type === 'callout') return (
              <div key={i} style={{ background: BG[block.color], border: `1px solid ${BORDER[block.color]}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.7, color: COLORS[block.color] }}>
                {block.text}
              </div>
            )
            if (block.type === 'code') return (
              <pre key={i} style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.8, marginBottom: 16, overflowX: 'auto', color: 'var(--text)' }}>
                {block.text}
              </pre>
            )
            if (block.type === 'table') return (
              <table key={i} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {block.headers.map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, j) => (
                    <tr key={j} style={{ borderTop: '1px solid var(--border)' }}>
                      {row.map((cell, k) => <td key={k} style={{ padding: '10px 12px', fontFamily: k === 0 ? 'var(--font-mono)' : 'inherit', fontSize: k === 0 ? 12 : 13 }}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
            return null
          })}
        </div>
      </div>
    </div>
  )
}
