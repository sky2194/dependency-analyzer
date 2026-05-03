import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Tooltip from '../components/Tooltip'

const SECTIONS = [
  {
    id: 'sca', icon: '🔍', title: 'What is SCA?',
    content: [
      { type: 'text', text: 'Software Composition Analysis (SCA) is the practice of automatically scanning your project\'s dependencies for known security vulnerabilities.' },
      { type: 'text', text: 'Modern applications use hundreds of open-source packages. Each package can contain security holes — called CVEs. SCA tools check every package you use against databases of known vulnerabilities.' },
      { type: 'callout', color: 'info', text: '💡 Up to 80% of modern application code comes from open-source packages — making SCA one of the highest-impact security practices.' },
    ]
  },
  {
    id: 'cve', icon: '🏷️', title: 'Understanding CVEs',
    content: [
      { type: 'text', text: 'A CVE (Common Vulnerability and Exposure) is a unique identifier for a known security flaw. Format: CVE-YEAR-NUMBER. Example: CVE-2021-44228 is Log4Shell, one of the most severe vulnerabilities ever found.' },
      { type: 'table', headers: ['Field', 'Meaning'], rows: [
        ['CVE ID', 'Unique identifier for the vulnerability'],
        ['CVSS Score', 'Severity rating from 0 (none) to 10 (critical)'],
        ['CWE', 'Category of weakness (e.g. XSS, SQL Injection)'],
        ['Fix Version', 'Minimum version that patches the vulnerability'],
      ]},
      { type: 'callout', color: 'warn', text: '⚠️ Not every CVE affects your app — it depends on whether you call the vulnerable function. This is called reachability.' },
    ]
  },
  {
    id: 'cvss', icon: '📊', title: 'CVSS Scores Explained',
    content: [
      { type: 'text', text: 'CVSS (Common Vulnerability Scoring System) rates vulnerabilities from 0–10 based on how easy they are to exploit and how much damage they can cause.' },
      { type: 'table', headers: ['Score', 'Severity', 'Action'], rows: [
        ['9.0 – 10.0', 'CRITICAL', 'Fix immediately — drop everything'],
        ['7.0 – 8.9',  'HIGH',     'Fix this week — schedule urgent work'],
        ['4.0 – 6.9',  'MEDIUM',   'Fix this month — add to backlog'],
        ['0.1 – 3.9',  'LOW',      'Fix when convenient — low risk'],
      ]},
      { type: 'callout', color: 'ok', text: '✅ CVSS scores can be misleading in isolation — always consider context. A CRITICAL CVE in a dev-only tool is less urgent than a HIGH CVE in your authentication library.' },
    ]
  },
  {
    id: 'deps', icon: '🌳', title: 'Direct vs Transitive Dependencies',
    content: [
      { type: 'text', text: 'When you install a package, it brings along its own dependencies — and those bring their own, and so on. This creates a tree.' },
      { type: 'code', text: 'Your App\n  └── express@4.17.0          (direct — you added this)\n        └── qs@6.7.0           (transitive — express needs it)\n              └── CVE-2022-24999  ← vulnerability here' },
      { type: 'text', text: 'The majority of CVEs come from transitive dependencies — packages you never chose to add. That\'s why scanning the full tree matters.' },
    ]
  },
  {
    id: 'fix', icon: '🛠️', title: 'How to Fix Vulnerabilities',
    content: [
      { type: 'text', text: 'Most vulnerabilities are fixed by upgrading to a patched version. This tool shows you the exact command to run.' },
      { type: 'table', headers: ['Ecosystem', 'Fix command example'], rows: [
        ['npm',   'npm install lodash@4.17.21'],
        ['PyPI',  'pip install Django==3.2.13'],
        ['Maven', 'Update version in pom.xml to 2.13.1'],
      ]},
      { type: 'callout', color: 'warn', text: '⚠️ Always test in a staging environment before applying fixes to production. Upgrading may break peer dependency requirements or change API behaviour.' },
    ]
  },
  {
    id: 'supply-chain', icon: '⛓️', title: 'Supply Chain Attacks',
    content: [
      { type: 'text', text: 'A supply chain attack happens when an attacker compromises an open-source package that thousands of apps depend on. Famous examples: SolarWinds (2020), XZ Utils (2024), event-stream (2018).' },
      { type: 'callout', color: 'critical', text: '🚨 A single compromised package can affect millions of applications worldwide — making supply chain security one of the most important topics in modern software.' },
      { type: 'text', text: 'SCA is your first line of defence — it detects when a package you depend on has a known vulnerability, so you can upgrade before attackers exploit it.' },
    ]
  },
  {
    id: 'sbom', icon: '📋', title: 'SBOMs — Software Bill of Materials',
    content: [
      { type: 'text', text: 'An SBOM is a complete inventory of every component in your software — like a nutrition label for your code. It lists every package, version, and licence.' },
      { type: 'text', text: 'SBOMs are increasingly required by enterprise customers, government contracts (US Executive Order 14028), and security compliance frameworks like SOC2 and ISO 27001.' },
      { type: 'callout', color: 'info', text: '💡 This tool\'s export feature generates a report that can be used as the basis for an SBOM, documenting all your dependencies and their known vulnerabilities.' },
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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
        ← Back
      </button>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
        📚 SCA Concepts
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
        Everything you need to know about dependency security — plain English.
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

      {/* Glossary */}
      <div style={{ marginTop: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📖 Quick Glossary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {['cve','cvss','sca','direct','transitive','mediation','nvd','osv','remediation','patchVersion','cwe','epss','zeroDay','supplyChain','lockfile','semver','sbom','ghsa'].map(key => (
            <div key={key} style={{ fontSize: 12 }}>
              <Tooltip termKey={key}><span style={{ fontWeight: 600, color: 'var(--accent)', cursor: 'help' }}>{key}</span></Tooltip>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
