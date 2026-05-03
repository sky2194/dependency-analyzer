import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TERMS from '../data/terms'

const SECTIONS = [
  {
    id: 'sca', icon: '🔍', title: 'What is SCA?',
    content: [
      { type: 'text', text: 'Software Composition Analysis (SCA) is a security practice that automatically identifies all open-source libraries in your codebase and checks them against known vulnerability databases.' },
      { type: 'text', text: 'Modern applications are built on hundreds of third-party packages. Each package is a potential attack surface. SCA tools give you complete visibility into every component you are shipping.' },
      { type: 'callout', color: 'info', text: '📌 Industry fact: Over 80% of modern application code comes from open-source packages — making SCA a critical first line of defence.' },
    ]
  },
  {
    id: 'pipeline', icon: '🔄', title: 'SCA in CI/CD Pipeline',
    content: [
      { type: 'text', text: 'SCA is most effective when embedded directly into your CI/CD pipeline, shifting security left rather than finding issues in production.' },
      { type: 'diagram', steps: [
        { num: 1, title: 'Developer Commits', desc: 'Developer pushes code with dependency manifest (package.json, requirements.txt, pom.xml) to version control.' },
        { num: 2, title: 'Dependency Resolution', desc: 'CI system runs the package manager (npm install, pip install, mvn package) — resolving all direct and transitive dependencies into a full dependency tree.' },
        { num: 3, title: 'SBOM Generation', desc: 'Tools like Syft or CycloneDX generate a Software Bill of Materials — a machine-readable inventory of every component, version, license, and hash. Output format: CycloneDX JSON or SPDX.' },
        { num: 4, title: 'Vulnerability Scan', desc: 'The SBOM is fed into scanners (Grype, Trivy, Snyk) that query NVD and OSV databases to match each package@version against known CVEs.' },
        { num: 5, title: 'Policy Gate', desc: 'If CRITICAL or HIGH CVEs are found, the pipeline fails — blocking the deployment. Teams configure severity thresholds based on their risk tolerance.' },
        { num: 6, title: 'Remediation & Re-scan', desc: 'Developer upgrades the affected package to the patched version, commits the fix, and the pipeline re-runs to verify the vulnerability is resolved.' },
      ]},
      { type: 'callout', color: 'info', text: '💡 This tool simulates steps 3–4: you upload a manifest file, we resolve the dependency tree and scan NVD + OSV in real time.' },
    ]
  },
  {
    id: 'cve', icon: '🏷️', title: 'CVEs Explained',
    content: [
      { type: 'text', text: 'CVE stands for Common Vulnerabilities and Exposures. It is a globally standardised identifier for publicly disclosed security vulnerabilities. Each CVE is assigned by MITRE and tracked in the National Vulnerability Database (NVD).' },
      { type: 'text', text: 'Format: CVE-[YEAR]-[SEQUENCE]. Example: CVE-2021-44228 is the Log4Shell vulnerability discovered in 2021.' },
      { type: 'table', headers: ['Field', 'Description', 'Example'], rows: [
        ['CVE ID',       'Unique global identifier',             'CVE-2021-44228'],
        ['CVSS Score',   'Severity rating (0.0 – 10.0)',         '10.0 (Critical)'],
        ['CWE',          'Weakness category',                    'CWE-502 (Deserialization)'],
        ['Fix Version',  'First version containing the patch',   '2.15.0'],
        ['Published',    'Date the CVE became public',           '2021-12-09'],
      ]},
    ]
  },
  {
    id: 'cvss', icon: '📊', title: 'CVSS Scoring',
    content: [
      { type: 'text', text: 'CVSS (Common Vulnerability Scoring System) is an open framework for rating the severity of security vulnerabilities. Version 3.1 is the current standard, scoring vulnerabilities on a 0–10 scale across three metric groups: Base, Temporal, and Environmental.' },
      { type: 'text', text: 'Base metrics assess attack vector, attack complexity, privileges required, user interaction, and the impact on confidentiality, integrity, and availability.' },
      { type: 'table', headers: ['Score Range', 'Severity', 'Recommended Action'], rows: [
        ['9.0 – 10.0', 'CRITICAL', 'Patch immediately — treat as an incident'],
        ['7.0 – 8.9',  'HIGH',     'Patch within 7 days'],
        ['4.0 – 6.9',  'MEDIUM',   'Patch within 30 days'],
        ['0.1 – 3.9',  'LOW',      'Patch in next scheduled release'],
        ['0.0',        'NONE',     'Informational — no action required'],
      ]},
    ]
  },
  {
    id: 'deps', icon: '🌳', title: 'Dependency Types',
    content: [
      { type: 'text', text: 'Understanding the difference between direct and transitive dependencies is essential for prioritising remediation efforts.' },
      { type: 'table', headers: ['Type', 'Definition', 'Risk Profile'], rows: [
        ['Direct',      'A package you explicitly declared in your manifest file',          'Fully visible — you chose it'],
        ['Transitive',  'A package pulled in automatically by one of your dependencies',   'Hidden — most CVEs live here'],
      ]},
      { type: 'code', text: 'Your Application\n  └── express@4.17.0            ← direct (you added this)\n        └── body-parser@1.19.0    ← transitive (express needs it)\n              └── qs@6.7.0        ← transitive (body-parser needs it)\n                    └── CVE-2022-24999 (CVSS 7.5)  ← vulnerability' },
      { type: 'callout', color: 'warn', text: '⚠️ In this example, your app never directly imported qs — yet you are exposed to its CVE through three layers of transitive dependencies.' },
    ]
  },
  {
    id: 'fix', icon: '🛠️', title: 'Remediation Strategies',
    content: [
      { type: 'text', text: 'The primary remediation for a CVE is upgrading the affected package to the patched version. However the correct approach depends on whether the vulnerable package is direct or transitive.' },
      { type: 'table', headers: ['Scenario', 'Action', 'Command'], rows: [
        ['Direct dep (npm)',        'Upgrade to fix version',           'npm install lodash@4.17.21'],
        ['Direct dep (PyPI)',       'Upgrade to fix version',           'pip install Django==4.2.14'],
        ['Direct dep (Maven)',      'Update pom.xml version tag',       '<version>2.13.1</version>'],
        ['Transitive dep (npm)',    'Use overrides in package.json',    '"overrides": {"qs": "6.11.0"}'],
        ['Transitive dep (Maven)',  'Use dependencyManagement section', 'Lock version in <dependencyManagement>'],
      ]},
      { type: 'callout', color: 'ok', text: '✅ Always re-run your test suite after upgrading — even patch versions can introduce breaking changes in rare cases.' },
    ]
  },
  {
    id: 'supply-chain', icon: '⛓️', title: 'Supply Chain Security',
    content: [
      { type: 'text', text: 'A software supply chain attack occurs when an adversary compromises a component upstream in the development pipeline — a package, build tool, or CI system — so that malicious code is automatically distributed to all downstream consumers.' },
      { type: 'text', text: 'Notable examples include the SolarWinds Orion compromise (2020), which affected 18,000 organisations including US government agencies, and the XZ Utils backdoor (2024), a sophisticated multi-year campaign targeting Linux distributions.' },
      { type: 'callout', color: 'critical', text: '🚨 Supply chain attacks are particularly dangerous because the malicious code arrives via a trusted channel — a legitimate package update — bypassing traditional perimeter defences.' },
      { type: 'text', text: 'Mitigations include pinning dependency versions, verifying package signatures, using SBOMs to track component provenance, and monitoring for unexpected new package maintainers.' },
    ]
  },
  {
    id: 'sbom', icon: '📋', title: 'SBOMs',
    content: [
      { type: 'text', text: 'An SBOM (Software Bill of Materials) is a formally structured, machine-readable inventory of all components in a software product — analogous to an ingredient list on packaged food.' },
      { type: 'text', text: 'Each entry in an SBOM records: component name, version, package URL (purl), licence identifier, supplier, and cryptographic hash. This enables automated vulnerability matching and licence compliance checking.' },
      { type: 'table', headers: ['Standard', 'Format', 'Governed by'], rows: [
        ['CycloneDX', 'JSON / XML',   'OWASP'],
        ['SPDX',      'JSON / RDF',   'Linux Foundation'],
      ]},
      { type: 'callout', color: 'info', text: '📌 US Executive Order 14028 (2021) mandates SBOMs for software sold to US federal agencies. EU Cyber Resilience Act requires them for CE-marked products from 2027.' },
    ]
  },
]

const COLORS = { info: 'var(--info)', warn: 'var(--accent2)', ok: 'var(--ok)', critical: 'var(--critical)' }
const BG     = { info: '#0d1f3c', warn: 'var(--warn-bg)', ok: 'var(--fix-bg)', critical: 'var(--vuln-bg)' }
const BORDER = { info: '#1e3a5f', warn: 'var(--warn-border)', ok: 'var(--fix-border)', critical: 'var(--vuln-border)' }

export default function Learn() {
  const [active, setActive] = useState('sca')
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const section  = SECTIONS.find(s => s.id === active)

  const selectSection = (id) => {
    setActive(id)
    setMenuOpen(false)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
        ← Back
      </button>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
        Security Knowledge Base
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        Reference guide to SCA concepts, vulnerability scoring, and secure dependency management.
      </p>

      {/* Mobile section picker */}
      <div style={{ display: 'none' }} className="mobile-section-picker">
        <select value={active} onChange={e => selectSection(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', marginBottom: 16, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
          {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }} className="learn-grid">
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} className="learn-sidebar">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => selectSection(s.id)} style={{
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 28px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            {section.icon} {section.title}
          </h2>
          <div style={{ width: 40, height: 3, background: 'var(--accent)', borderRadius: 2, marginBottom: 20 }} />

          {section.content.map((block, i) => {
            if (block.type === 'text') return (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text)', marginBottom: 16 }}>{block.text}</p>
            )
            if (block.type === 'diagram') return (
              <div key={i} style={{ marginBottom: 20 }}>
                {block.steps.map((step, j) => (
                  <div key={j} style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                    <div style={{
                      minWidth: 32, height: 32, borderRadius: '50%',
                      background: 'var(--accent)', color: '#000', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, flexShrink: 0
                    }}>{step.num}</div>
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{step.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{step.desc}</div>
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
              <pre key={i} style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.9, marginBottom: 16, overflowX: 'auto', color: 'var(--text)' }}>
                {block.text}
              </pre>
            )
            if (block.type === 'table') return (
              <div key={i} style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {block.headers.map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j} style={{ borderTop: '1px solid var(--border)' }}>
                        {row.map((cell, k) => <td key={k} style={{ padding: '10px 14px', fontFamily: k === 0 ? 'var(--font-mono)' : 'inherit', fontSize: k === 0 ? 12 : 13, lineHeight: 1.5 }}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
            return null
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .learn-grid { grid-template-columns: 1fr !important; }
          .learn-sidebar { display: none !important; }
          .mobile-section-picker { display: block !important; }
        }
      `}</style>
    </div>
  )
}
