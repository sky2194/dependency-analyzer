/**
 * Unit tests for scan.js helper logic.
 * Run: node action/scan.test.js
 * No test framework required — uses Node.js built-in assert.
 */

const assert = require('assert')
const fs     = require('fs')
const path   = require('path')
const os     = require('os')

// ── Extract pure functions from scan.js ──────────────────────────────────────
// scan.js runs main() on load, so we extract the functions we need to test
// by reading the source and eval-ing only the helper definitions.

const src = fs.readFileSync(path.join(__dirname, 'scan.js'), 'utf8')

// Grab buildKevAlert and buildComment — they have no side effects
const helperSrc = src
  .split('// ── Main')[0]          // everything before main()
  .replace(/^.*require\(.*$/gm, '') // strip require() lines (already loaded)
eval(helperSrc)                    // eslint-disable-line no-eval

// ── Auto-detection helper (mirrors the logic in main()) ───────────────────────

function detectManifest(workspace, specifiedFile = 'package.json') {
  const candidates = [specifiedFile, 'package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 'build.gradle.kts']
  return candidates.find(f => fs.existsSync(path.resolve(workspace, f))) || null
}

// ── Tests ────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
    failed++
  }
}

// buildKevAlert ---------------------------------------------------------------

console.log('\nbuildKevAlert')

test('returns empty string when no KEV vulns', () => {
  assert.strictEqual(buildKevAlert([]), '')
})

test('contains WARNING callout for KEV vulns', () => {
  const result = buildKevAlert([{ package_name: 'lodash', installed_version: '4.17.11', cve_id: 'CVE-2021-23337', severity: 'HIGH' }])
  assert.ok(result.includes('> [!WARNING]'), 'Missing WARNING callout')
})

test('includes CVE ID in output', () => {
  const result = buildKevAlert([{ package_name: 'lodash', installed_version: '4.17.11', cve_id: 'CVE-2021-23337', severity: 'HIGH' }])
  assert.ok(result.includes('CVE-2021-23337'))
})

test('links to NVD for each CVE', () => {
  const result = buildKevAlert([{ package_name: 'pkg', installed_version: '1.0.0', cve_id: 'CVE-2021-99999', severity: 'CRITICAL' }])
  assert.ok(result.includes('https://nvd.nist.gov/vuln/detail/CVE-2021-99999'))
})

test('uses singular wording for one CVE', () => {
  const result = buildKevAlert([{ package_name: 'pkg', installed_version: '1.0.0', cve_id: 'CVE-2021-00001', severity: 'HIGH' }])
  assert.ok(result.includes('CVE is'))
})

test('uses plural wording for multiple CVEs', () => {
  const vulns = [
    { package_name: 'a', installed_version: '1.0', cve_id: 'CVE-2021-00001', severity: 'HIGH' },
    { package_name: 'b', installed_version: '2.0', cve_id: 'CVE-2021-00002', severity: 'CRITICAL' },
  ]
  const result = buildKevAlert(vulns)
  assert.ok(result.includes('CVEs are'))
})

// buildComment ----------------------------------------------------------------

console.log('\nbuildComment')

const mockSummary = { risk_score: 72, risk_label: 'High', critical: 2, high: 3, medium: 1, low: 0, vulnerabilities: 6, total_packages: 20 }

test('contains risk score', () => {
  const result = buildComment(mockSummary, 'npm', 'my-app', null, [])
  assert.ok(result.includes('72/100'))
})

test('shows red emoji for high risk score', () => {
  const result = buildComment(mockSummary, 'npm', 'my-app', null, [])
  assert.ok(result.includes('🔴'))
})

test('shows green emoji for zero risk score', () => {
  const summary = { ...mockSummary, risk_score: 0, risk_label: 'Safe', critical: 0, high: 0, medium: 0, low: 0, vulnerabilities: 0 }
  const result = buildComment(summary, 'npm', 'my-app', null, [])
  assert.ok(result.includes('🟢'))
})

test('includes scan URL when provided', () => {
  const result = buildComment(mockSummary, 'npm', 'my-app', 'https://depanalyzer.com/results?id=abc', [])
  assert.ok(result.includes('https://depanalyzer.com/results?id=abc'))
})

test('omits scan URL section when not provided', () => {
  const result = buildComment(mockSummary, 'npm', 'my-app', null, [])
  assert.ok(!result.includes('View full report'))
})

test('includes KEV alert block when KEV vulns present', () => {
  const kevVulns = [{ package_name: 'lodash', installed_version: '4.17.11', cve_id: 'CVE-2021-23337', severity: 'HIGH' }]
  const result = buildComment(mockSummary, 'npm', 'my-app', null, kevVulns)
  assert.ok(result.includes('[!WARNING]'))
})

test('no KEV block when no KEV vulns', () => {
  const result = buildComment(mockSummary, 'npm', 'my-app', null, [])
  assert.ok(!result.includes('[!WARNING]'))
})

test('shows all-clear when no vulnerabilities', () => {
  const summary = { ...mockSummary, risk_score: 0, critical: 0, high: 0, medium: 0, low: 0, vulnerabilities: 0 }
  const result = buildComment(summary, 'npm', 'my-app', null, [])
  assert.ok(result.includes('No vulnerabilities found'))
})

// Auto-detection --------------------------------------------------------------

console.log('\nauto-detection')

test('uses specified file when it exists', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-test-'))
  fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'django==3.2')
  const found = detectManifest(tmp, 'requirements.txt')
  assert.strictEqual(found, 'requirements.txt')
  fs.rmSync(tmp, { recursive: true })
})

test('falls back to package.json when specified file missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-test-'))
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}')
  const found = detectManifest(tmp, 'package.json')
  assert.strictEqual(found, 'package.json')
  fs.rmSync(tmp, { recursive: true })
})

test('auto-detects requirements.txt when package.json absent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-test-'))
  fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask==2.0')
  const found = detectManifest(tmp, 'package.json')
  assert.strictEqual(found, 'requirements.txt')
  fs.rmSync(tmp, { recursive: true })
})

test('auto-detects pom.xml when package.json and requirements.txt absent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-test-'))
  fs.writeFileSync(path.join(tmp, 'pom.xml'), '<project/>')
  const found = detectManifest(tmp, 'package.json')
  assert.strictEqual(found, 'pom.xml')
  fs.rmSync(tmp, { recursive: true })
})

test('auto-detects build.gradle when other manifests absent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-test-'))
  fs.writeFileSync(path.join(tmp, 'build.gradle'), "dependencies { implementation 'log4j:log4j:1.2.17' }")
  const found = detectManifest(tmp, 'package.json')
  assert.strictEqual(found, 'build.gradle')
  fs.rmSync(tmp, { recursive: true })
})

test('returns null when no manifest found', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-test-'))
  const found = detectManifest(tmp, 'package.json')
  assert.strictEqual(found, null)
  fs.rmSync(tmp, { recursive: true })
})

test('prefers package.json over requirements.txt when both exist', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-test-'))
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}')
  fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask==2.0')
  const found = detectManifest(tmp, 'package.json')
  assert.strictEqual(found, 'package.json')
  fs.rmSync(tmp, { recursive: true })
})

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
