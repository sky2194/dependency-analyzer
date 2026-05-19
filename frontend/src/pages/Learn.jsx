import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── NAV GROUPS ── */
const NAV = [
  { group: 'Foundations', items: [
    { id: 'sca', icon: '🔍', title: 'What is SCA?' },
    { id: 'deps', icon: '🌳', title: 'Dependency Types' },
    { id: 'cvss', icon: '📊', title: 'CVSS Scoring' },
  ]},
  { group: 'Vulnerabilities', items: [
    { id: 'cve', icon: '🏷️', title: 'CVEs Explained' },
    { id: 'supply-chain', icon: '⛓️', title: 'Supply Chain Security' },
    { id: 'databases', icon: '💾', title: 'Vulnerability Databases' },
  ]},
  { group: 'Remediation', items: [
    { id: 'fix', icon: '🛠️', title: 'Remediation Strategies' },
    { id: 'pipeline', icon: '🔄', title: 'SCA in CI/CD Pipeline' },
  ]},
  { group: 'Compliance', items: [
    { id: 'sbom', icon: '📋', title: 'SBOMs' },
  ]},
]

/* ── CONTENT ── */
const SECTIONS = [
  {
    id: 'sca', icon: '🔍', title: 'What is SCA?',
    subtitle: 'Software Composition Analysis — the foundation of dependency security.',
    content: [
      { type: 'keypoint', label: 'Definition', text: 'Software Composition Analysis (SCA) is a security practice that automatically identifies all open-source libraries in a codebase and checks them against known vulnerability databases.' },
      { type: 'keypoint', label: 'Why it matters', text: 'Modern applications are built on hundreds of third-party packages. Each package is a potential attack surface. SCA tools provide complete visibility into every component being shipped to production.' },
      { type: 'keypoint', label: 'How it works', text: 'SCA tools parse dependency manifests (package.json, requirements.txt, pom.xml), resolve the full dependency tree including all transitive dependencies, then cross-reference each package@version against vulnerability databases like OSV and NVD.' },
      { type: 'callout', color: 'info', text: '📌 Over 75% of modern application code comes from open-source packages — making SCA a critical first line of defence.' },
      { type: 'heading', text: 'Common Ecosystems' },
      { type: 'table', headers: ['Ecosystem', 'Language', 'Manifest File', 'Package Manager'], rows: [
        ['npm', 'JavaScript / Node.js', 'package.json, package-lock.json', 'npm, yarn, pnpm'],
        ['PyPI', 'Python', 'requirements.txt, Pipfile', 'pip, pipenv, poetry'],
        ['Maven', 'Java', 'pom.xml', 'mvn'],
      ]},
    ]
  },
  {
    id: 'deps', icon: '🌳', title: 'Dependency Types',
    subtitle: 'Direct vs transitive — and why it matters for security.',
    content: [
      { type: 'keypoint', label: 'Direct dependency', text: 'A package you explicitly declared in your manifest file. You chose it, you control its version.' },
      { type: 'keypoint', label: 'Transitive dependency', text: 'A package pulled in automatically by one of your dependencies. You never added it, but it ships with your app.' },
      { type: 'keypoint', label: 'Why this matters', text: 'The majority of vulnerabilities (estimated 80%+) are found in transitive dependencies. These hidden risks would never be caught by manual review — only SCA can surface them.' },
      { type: 'table', headers: ['Type', 'Definition', 'Risk Profile'], rows: [
        ['Direct',      'A package you explicitly declared in your manifest file',          'Fully visible — you chose it'],
        ['Transitive',  'A package pulled in automatically by one of your dependencies',   'Hidden — most CVEs live here'],
      ]},
      { type: 'heading', text: 'Real Example: 4-level nesting' },
      { type: 'code', text: 'Your Application (my-app@1.0.0)\n  └── express@4.17.0                    ← direct (you explicitly added)\n        └── body-parser@1.19.0          ← transitive (express depends on it)\n              └── qs@6.7.0              ← transitive (body-parser depends on it)\n                    └── CVE-2022-24999  ← vulnerability found here (CVSS 7.5)' },
      { type: 'text', text: 'In this example, you never explicitly imported qs. But a vulnerability in qs affects your app through three layers of dependencies. Without SCA, you would never know.' },
      { type: 'callout', color: 'warn', text: '⚠️ Why is this hard to fix? A vulnerability deep in the dependency tree requires understanding complex version compatibility. You may need to patch multiple branches or update parent dependencies first.' },
      { type: 'heading', text: 'Ecosystem-Specific Solutions' },
      { type: 'code', text: 'npm (JavaScript): Use "overrides" in package.json to force a specific version\npip (Python): Use constraints file (requirements.txt or pip-tools) to pin versions\nMaven (Java): Use <dependencyManagement> section to lock transitive versions' },
    ]
  },
  {
    id: 'cvss', icon: '📊', title: 'CVSS Scoring',
    subtitle: 'How vulnerability severity is measured and what to do about it.',
    content: [
      { type: 'keypoint', label: 'What is CVSS', text: 'CVSS (Common Vulnerability Scoring System) is an open framework for rating the severity of security vulnerabilities. Scores range from 0–10 across metric groups: Base, Temporal, and Environmental.' },
      { type: 'keypoint', label: 'Base metrics', text: 'Attack vector, attack complexity, privileges required, user interaction, and impact on confidentiality, integrity, and availability.' },
      { type: 'heading', text: 'Severity Ranges' },
      { type: 'severity-scale' },
      { type: 'table', headers: ['Score Range', 'Severity', 'Recommended Action'], rows: [
        ['9.0 – 10.0', 'CRITICAL', 'Patch immediately — treat as an incident'],
        ['7.0 – 8.9',  'HIGH',     'Patch within 7 days'],
        ['4.0 – 6.9',  'MEDIUM',   'Patch within 30 days'],
        ['0.1 – 3.9',  'LOW',      'Patch in next scheduled release'],
        ['0.0',        'NONE',     'Informational — no action required'],
      ]},
      { type: 'callout', color: 'info', text: '📌 CVSS v4.0 was released in 2023, though v3.1 remains widely used. This tool displays CVSS v3.1 scores from the OSV database.' },
    ]
  },
  {
    id: 'cve', icon: '🏷️', title: 'CVEs Explained',
    subtitle: 'Understanding the global vulnerability identification system.',
    content: [
      { type: 'keypoint', label: 'What is a CVE', text: 'CVE (Common Vulnerabilities and Exposures) is a globally standardised identifier for publicly disclosed security vulnerabilities. Each CVE is assigned by MITRE and tracked in the National Vulnerability Database (NVD).' },
      { type: 'keypoint', label: 'Format', text: 'CVE-[YEAR]-[SEQUENCE]. Example: CVE-2021-44228 is the Log4Shell vulnerability discovered in 2021.' },
      { type: 'heading', text: 'CVE Anatomy' },
      { type: 'table', headers: ['Field', 'Description', 'Example'], rows: [
        ['CVE ID',       'Unique global identifier',             'CVE-2021-44228'],
        ['CVSS Score',   'Severity rating (0.0 – 10.0)',         '10.0 (Critical)'],
        ['CWE',          'Weakness category',                    'CWE-502 (Deserialization)'],
        ['Fix Version',  'First version containing the patch',   '2.15.0'],
        ['Published',    'Date the CVE became public',           '2021-12-09'],
      ]},
      { type: 'heading', text: 'Real-World Examples' },
      { type: 'table', headers: ['CVE ID', 'Product', 'Discovered', 'Patched', 'Impact'], rows: [
        ['CVE-2021-44228', 'Apache Log4j (Log4Shell)', 'Dec 9, 2021', 'Dec 10, 2021', 'Widespread enterprise impact, billions in remediation costs, CVSS 10.0'],
        ['CVE-2014-0160', 'OpenSSL (Heartbleed)', 'Apr 7, 2014', 'Apr 7, 2014', '2+ billion devices, CVSS 7.5, memory leak exposing private keys'],
        ['CVE-2022-22965', 'Spring Framework (Spring4Shell)', 'Mar 31, 2022', 'Mar 31, 2022', 'Spring Framework RCE, CVSS 9.8, affected Java web apps'],
        ['CVE-2024-3094', 'XZ Utils (liblzma)', 'Mar 29, 2024', 'Mar 29, 2024', 'Linux backdoor, sophisticated 2-year supply chain campaign'],
      ]},
    ]
  },
  {
    id: 'supply-chain', icon: '⛓️', title: 'Supply Chain Security',
    subtitle: 'When trusted packages become attack vectors.',
    content: [
      { type: 'keypoint', label: 'What is it', text: 'A software supply chain attack occurs when an adversary compromises a component upstream in the development pipeline — a package, build tool, or CI system — so that malicious code is automatically distributed to all downstream consumers.' },
      { type: 'keypoint', label: 'Why it\'s dangerous', text: 'The malicious code arrives via a trusted channel — a legitimate package update — bypassing traditional perimeter defences.' },
      { type: 'heading', text: 'Notable Incidents' },
      { type: 'table', headers: ['Incident', 'Year', 'Vector', 'Impact'], rows: [
        ['SolarWinds Orion', '2020', 'Build system compromise', '18,000 organisations including US government agencies'],
        ['event-stream (npm)', '2018', 'Maintainer account takeover', 'Targeted cryptocurrency wallet theft via transitive dependency'],
        ['ua-parser-js (npm)', '2021', 'Account compromise', 'Cryptominer + credential stealer injected into 8M weekly downloads'],
        ['XZ Utils (liblzma)', '2024', 'Multi-year social engineering', 'Backdoor targeting Linux SSH authentication'],
      ]},
      { type: 'callout', color: 'critical', text: '🚨 The XZ Utils backdoor was nearly undetected — a sophisticated 2-year campaign by a trusted contributor. Only accidental discovery prevented widespread deployment.' },
      { type: 'heading', text: 'Defence Strategies' },
      { type: 'code', text: '1. Pin dependency versions — use lock files (package-lock.json, requirements.txt)\n2. Verify package integrity — check hashes and signatures\n3. Monitor maintainer changes — watch for suspicious new contributors\n4. Use SBOMs — track component provenance\n5. Run SCA continuously — not just at release time' },
    ]
  },
  {
    id: 'databases', icon: '💾', title: 'Vulnerability Databases',
    subtitle: 'Where vulnerability data comes from.',
    content: [
      { type: 'keypoint', label: 'OSV (Open Source Vulnerabilities)', text: 'Maintained by Google and the open-source community. Provides ecosystem-specific version ranges with real-time updates from package registry advisories. Optimized for npm, PyPI, Maven, and other open-source ecosystems.' },
      { type: 'keypoint', label: 'NVD (National Vulnerability Database)', text: 'Maintained by NIST (US Government). Broadest coverage including proprietary software. Standardized CVSS scoring and comprehensive historical records. Updates can lag 3–7 days behind initial disclosure.' },
      { type: 'keypoint', label: 'GHSA (GitHub Security Advisory)', text: 'Integrated directly into GitHub repositories. Automatically detects vulnerable dependencies in repos and generates Dependabot alerts. Real-time updates for GitHub-hosted projects.' },
      { type: 'table', headers: ['Database', 'Maintained By', 'Strengths', 'Update Speed'], rows: [
        ['OSV', 'Google + community', 'Open-source focus, ecosystem-specific ranges', 'Real-time from advisories'],
        ['NVD', 'NIST (US Gov)', 'Broadest coverage, CVSS standardization', 'Daily, can lag 3–7 days'],
        ['GHSA', 'GitHub', 'Integrated with repos, auto-detects', 'Real-time for GitHub ecosystems'],
      ]},
      { type: 'heading', text: 'Why Multiple Databases?' },
      { type: 'text', text: 'Different databases have different strengths. OSV provides faster updates for open-source packages, NVD offers broader coverage, and GHSA integrates directly into development workflows. Enterprise SCA tools often query multiple sources to ensure comprehensive coverage.' },
      { type: 'callout', color: 'info', text: '🔍 Best practice: Use tools that aggregate data from multiple sources rather than relying on a single database. This ensures you catch vulnerabilities that may appear in one database before another.' },
    ]
  },
  {
    id: 'fix', icon: '🛠️', title: 'Remediation Strategies',
    subtitle: 'A systematic approach to fixing vulnerabilities.',
    content: [
      { type: 'keypoint', label: 'Key principle', text: 'The correct remediation depends on severity, location (direct vs transitive), and your ecosystem. Always test patches before deploying.' },
      { type: 'heading', text: 'Step 1: Understand the Vulnerability' },
      { type: 'code', text: '1. Read the CVE details (CVE ID, CVSS score, CWE)\n2. Understand the attack vector (network, local, physical)\n3. Check if it affects your version\n4. Assess if you\'re actually using the vulnerable code path' },
      { type: 'heading', text: 'Step 2: Test the Patch Locally' },
      { type: 'code', text: '1. Create a feature branch: git checkout -b fix/CVE-XXXX\n2. Upgrade the package to patched version\n3. Run your full test suite: npm test (or equivalent)\n4. Test manually in development environment\n5. Check for breaking changes or regressions' },
      { type: 'heading', text: 'Step 3: Common Pitfalls' },
      { type: 'table', headers: ['Problem', 'Cause', 'Solution'], rows: [
        ['Patch breaks app', 'Breaking change in patch', 'Check release notes, pin exact version, test thoroughly'],
        ['Transitive dep conflicts', 'Parent needs different version', 'Use overrides (npm) or dependencyManagement (Maven)'],
        ['Patch not applying', 'Dependency locked in lock file', 'Delete lock file, regenerate with npm ci / pip-compile'],
        ['Security scan still fails', 'Nested dependency not updated', 'Use audit fix, update parent dependencies first'],
      ]},
      { type: 'heading', text: 'Step 4: Ecosystem-Specific Commands' },
      { type: 'table', headers: ['Scenario', 'Action', 'Exact Commands'], rows: [
        ['Direct dep (npm)',        'Upgrade to fix version',           'npm install lodash@4.17.21\nnpm audit fix'],
        ['Direct dep (PyPI)',       'Update requirements + test',       'pip install Django==4.2.14\npip freeze > requirements.txt'],
        ['Direct dep (Maven)',      'Update pom.xml version',           'Edit: <version>2.13.1</version>\nmvn clean install -DskipTests'],
        ['Transitive dep (npm)',    'Use npm overrides',                'In package.json: "overrides": {"qs": "6.11.0"}\nnpm install'],
        ['Transitive dep (PyPI)',   'Use pip constraints',              'In requirements.txt: qs==6.11.0\npip install -r requirements.txt'],
        ['Transitive dep (Maven)',  'Use dependencyManagement',         'In pom.xml: <version>2.13.1</version> in <dependencyManagement>'],
      ]},
      { type: 'heading', text: 'Step 5: Deploy Safely' },
      { type: 'code', text: '1. Push to feature branch, create PR\n2. Deploy to staging environment\n3. Run integration tests + smoke tests\n4. Monitor for 24-48 hours\n5. Deploy to production with gradual rollout\n6. Keep previous version ready to rollback if needed' },
      { type: 'callout', color: 'ok', text: '✅ Always re-run your test suite after upgrading — even patch versions can introduce breaking changes. Monitor production for regressions in the first 48 hours.' },
    ]
  },
  {
    id: 'pipeline', icon: '🔄', title: 'SCA in CI/CD Pipeline',
    subtitle: 'Shift left — catch vulnerabilities before they reach production.',
    content: [
      { type: 'keypoint', label: 'Key principle', text: 'SCA is most effective when embedded directly into CI/CD pipelines. Catching vulnerable dependencies during the build process prevents them from reaching production and reduces remediation costs.' },
      { type: 'keypoint', label: 'Shift-left security', text: 'Identifying vulnerabilities early in the development lifecycle (during commit or pull request) is significantly cheaper than discovering them in production. Automated gates can block deployments with critical vulnerabilities.' },
      { type: 'heading', text: 'Industry-Standard Workflow' },
      { type: 'diagram', steps: [
        { num: 1, title: 'Developer Commits', desc: 'Developer pushes code with dependency manifest (package.json, requirements.txt, pom.xml) to version control.' },
        { num: 2, title: 'Dependency Resolution', desc: 'CI system runs the package manager (npm install, pip install, mvn package) — resolving all direct and transitive dependencies.' },
        { num: 3, title: 'SBOM Generation', desc: 'Tools like Syft or CycloneDX generate a Software Bill of Materials — a machine-readable inventory of every component, version, and license.' },
        { num: 4, title: 'Vulnerability Scan', desc: 'Scanners query vulnerability databases (OSV, NVD, GHSA) to match each package@version against known CVEs.' },
        { num: 5, title: 'Policy Gate', desc: 'If CRITICAL or HIGH CVEs are found, the pipeline fails — blocking the deployment. Teams configure severity thresholds based on risk tolerance.' },
        { num: 6, title: 'Remediation & Re-scan', desc: 'Developer upgrades the affected package, commits the fix, and the pipeline re-runs to verify the vulnerability is resolved.' },
      ]},
      { type: 'heading', text: 'Popular CI/CD Integration Tools' },
      { type: 'table', headers: ['Tool', 'Type', 'Integration'], rows: [
        ['Snyk', 'Commercial SCA', 'GitHub Actions, GitLab CI, Jenkins plugins'],
        ['Dependabot', 'GitHub native', 'Automatic PR generation for vulnerable dependencies'],
        ['Grype + Syft', 'Open-source', 'CLI-based, integrates with any CI system'],
        ['npm audit', 'Built-in', 'Native npm command, runs in any Node.js CI pipeline'],
      ]},
      { type: 'callout', color: 'ok', text: '✅ Best practice: Run SCA on every commit and pull request, not just releases. This catches vulnerabilities before they merge into main branches.' },
    ]
  },
  {
    id: 'sbom', icon: '📋', title: 'SBOMs',
    subtitle: 'Software Bill of Materials — your dependency inventory.',
    content: [
      { type: 'keypoint', label: 'What is an SBOM', text: 'A formally structured, machine-readable inventory of all components in a software product — analogous to an ingredient list on packaged food.' },
      { type: 'keypoint', label: 'What it records', text: 'Component name, version, package URL (purl), licence identifier, supplier, and cryptographic hash. Enables automated vulnerability matching and licence compliance.' },
      { type: 'heading', text: 'Standard Formats' },
      { type: 'table', headers: ['Standard', 'Format', 'Governed by', 'Use Case'], rows: [
        ['CycloneDX', 'JSON / XML',   'OWASP', 'Container scanning, DevSecOps tools, most modern platforms'],
        ['SPDX',      'JSON / RDF',   'Linux Foundation', 'License compliance, enterprise software, open-source projects'],
      ]},
      { type: 'heading', text: 'CycloneDX JSON Example' },
      { type: 'code', text: '{\n  "bomFormat": "CycloneDX",\n  "specVersion": "1.6",\n  "components": [\n    {\n      "type": "library",\n      "name": "express",\n      "version": "4.17.0",\n      "purl": "pkg:npm/express@4.17.0",\n      "licenses": [{"license": {"name": "MIT"}}]\n    }\n  ]\n}' },
      { type: 'heading', text: 'Compliance Requirements' },
      { type: 'table', headers: ['Requirement', 'Year', 'Scope', 'Impact'], rows: [
        ['US EO 14028', '2021', 'Federal contractors, critical infrastructure', 'Mandatory for government contracts'],
        ['SOC2 Type II', 'Ongoing', 'Service organizations, cloud platforms', 'Required for audit compliance'],
        ['ISO 27001', 'Ongoing', 'Information security management', 'Component inventory requirement'],
        ['EU Cyber Resilience Act', '2027', 'CE-marked products in EU', 'Upcoming requirement for European markets'],
      ]},
      { type: 'callout', color: 'info', text: '📌 US Executive Order 14028 mandates SBOMs for software sold to US federal agencies. EU Cyber Resilience Act requires them for CE-marked products from 2027.' },
    ]
  },
]

/* ── THEME TOKENS ── */
const COLORS = { info: 'var(--info)', warn: 'var(--accent2)', ok: 'var(--ok)', critical: 'var(--critical)' }
const BG     = { info: 'var(--blue-dim)', warn: 'var(--warn-bg)', ok: 'var(--fix-bg)', critical: 'var(--vuln-bg)' }
const BORDER = { info: 'var(--blue-dim)', warn: 'var(--warn-border)', ok: 'var(--fix-border)', critical: 'var(--vuln-border)' }

const SEV_BARS = [
  { label: 'CRITICAL', range: '9.0–10.0', color: 'var(--critical)', width: '100%' },
  { label: 'HIGH', range: '7.0–8.9', color: 'var(--high)', width: '80%' },
  { label: 'MEDIUM', range: '4.0–6.9', color: 'var(--medium)', width: '55%' },
  { label: 'LOW', range: '0.1–3.9', color: 'var(--low)', width: '30%' },
]

/* ── COMPONENT ── */
export default function Learn() {
  const [active, setActive] = useState('sca')
  const navigate = useNavigate()
  const contentRef = useRef(null)
  const section = SECTIONS.find(s => s.id === active)

  const selectSection = (id) => {
    setActive(id)
    if (contentRef.current) contentRef.current.scrollTop = 0
  }

  /* ── BLOCK RENDERERS ── */
  const renderBlock = (block, i) => {
    if (block.type === 'text') return (
      <p key={i} style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text)', marginBottom: 16 }}>{block.text}</p>
    )
    if (block.type === 'heading') return (
      <h3 key={i} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 28, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{block.text}</h3>
    )
    if (block.type === 'keypoint') return (
      <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ minWidth: 90, fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingTop: 2, fontFamily: 'var(--font-mono)' }}>{block.label}</div>
        <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text)' }}>{block.text}</div>
      </div>
    )
    if (block.type === 'severity-scale') return (
      <div key={i} style={{ marginBottom: 20 }}>
        {SEV_BARS.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ width: 70, fontSize: 11, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.label}</span>
            <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: s.width, height: '100%', background: s.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ width: 60, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{s.range}</span>
          </div>
        ))}
      </div>
    )
    if (block.type === 'diagram') return (
      <div key={i} style={{ marginBottom: 20, position: 'relative', paddingLeft: 20 }}>
        <div style={{ position: 'absolute', left: 15, top: 16, bottom: 16, width: 2, background: 'var(--border)' }} />
        {block.steps.map((step, j) => (
          <div key={j} style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start', position: 'relative' }}>
            <div style={{
              minWidth: 32, height: 32, borderRadius: '50%',
              background: 'var(--accent)', color: 'var(--white)', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, flexShrink: 0, position: 'relative', zIndex: 1
            }}>{step.num}</div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)' }}>{step.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    )
    if (block.type === 'callout') return (
      <div key={i} style={{ background: BG[block.color], border: `1px solid ${BORDER[block.color]}`, borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.7, color: COLORS[block.color] }}>
        {block.text}
      </div>
    )
    if (block.type === 'code') return (
      <pre key={i} style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.9, marginBottom: 16, overflowX: 'auto', color: 'var(--text)' }}>
        {block.text}
      </pre>
    )
    if (block.type === 'table') return (
      <div key={i} style={{ overflowX: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {block.headers.map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{h.toUpperCase()}</th>)}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, j) => (
              <tr key={j} style={{ borderTop: '1px solid var(--border)' }}>
                {row.map((cell, k) => <td key={k} style={{ padding: '10px 14px', fontFamily: k === 0 ? 'var(--font-mono)' : 'inherit', fontSize: k === 0 ? 12 : 13, lineHeight: 1.5, color: 'var(--text)' }}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    return null
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 20, fontFamily: 'var(--font-ui)' }}>
        ← Back
      </button>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
        Security Knowledge Base
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
        Reference guide to SCA concepts, vulnerability scoring, and secure dependency management.
      </p>

      {/* Mobile section picker */}
      <div style={{ display: 'none' }} className="mobile-section-picker">
        <select value={active} onChange={e => selectSection(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', marginBottom: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-ui)' }}>
          {NAV.map(g => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28 }} className="learn-grid">
        {/* Sidebar — grouped + sticky */}
        <div className="learn-sidebar" style={{ position: 'sticky', top: 80, alignSelf: 'start', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          {NAV.map((g, gi) => (
            <div key={g.group} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 14px', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                {g.group}
              </div>
              {g.items.map(s => (
                <button key={s.id} onClick={() => selectSection(s.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: active === s.id ? 'var(--bg-elevated)' : 'transparent',
                  borderLeft: active === s.id ? '2px solid var(--accent)' : '2px solid transparent',
                  border: 'none', borderLeftStyle: 'solid', borderLeftWidth: 2, borderLeftColor: active === s.id ? 'var(--accent)' : 'transparent',
                  color: active === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: active === s.id ? 600 : 400, transition: 'all 0.15s',
                  fontFamily: 'var(--font-ui)',
                }}>
                  {s.icon} {s.title}
                </button>
              ))}
            </div>
          ))}

          {/* Scan CTA */}
          <div style={{ marginTop: 12, padding: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Ready to scan?</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>Apply what you've learned — scan your project now.</div>
            <button onClick={() => navigate('/scan')} style={{
              width: '100%', padding: '8px 0', background: 'var(--accent)', color: 'var(--white)',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>
              Start Scanning →
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 28px', minHeight: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>{section.icon}</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              {section.title}
            </h2>
          </div>
          {section.subtitle && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>{section.subtitle}</p>
          )}
          <div style={{ width: 40, height: 3, background: 'var(--accent)', borderRadius: 2, marginBottom: 24 }} />

          {section.content.map(renderBlock)}
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
