/**
 * DepAnalyzer GitHub Action — scan.js
 *
 * On every push or PR, reads the dependency manifest, calls the DepAnalyzer
 * API, and posts a full report comment to the PR with a link to the visual
 * report in the app.
 *
 * Never fails the build — purely informational.
 * Uses only Node.js built-ins, no npm install required.
 */

const fs    = require('fs')
const path  = require('path')
const http  = require('http')
const https = require('https')

// ── GitHub Actions helpers ───────────────────────────────────────────────────

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT
  if (file) fs.appendFileSync(file, `${name}=${value}\n`)
}

function notice(msg)  { console.log(`::notice::${msg}`) }
function warning(msg) { console.log(`::warning::${msg}`) }

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method, url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const payload = body ? JSON.stringify(body) : null
    const lib     = parsed.protocol === 'https:' ? https : http
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':   'DepAnalyzer-Action/1.0',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...extraHeaders,
      },
    }
    const req = lib.request(opts, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

// ── PR comment ───────────────────────────────────────────────────────────────

function buildKevAlert(kevVulns) {
  if (!kevVulns.length) return ''

  const rows = kevVulns.map(v => {
    const pkg  = v.package_name || v.package || '?'
    const ver  = v.installed_version || v.version || '?'
    const cve  = v.cve_id || '?'
    const sev  = v.severity || '?'
    const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cve}`
    return `| \`${pkg}\` | \`${ver}\` | [${cve}](${nvdUrl}) | ${sev} |`
  })

  return [
    `> [!WARNING]`,
    `> ### 🚨 CISA KEV Alert — Actively Exploited in the Wild`,
    `>`,
    `> The following ${kevVulns.length === 1 ? 'CVE is' : 'CVEs are'} on the [CISA Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) list.`,
    `> This means real attackers are actively using ${kevVulns.length === 1 ? 'it' : 'them'} against systems right now — not theoretical risk.`,
    `>`,
    `> | Package | Version | CVE | Severity |`,
    `> |---------|---------|-----|----------|`,
    ...rows.map(r => `> ${r}`),
    `>`,
    `> **Upgrade ${kevVulns.length === 1 ? 'this package' : 'these packages'} as soon as possible.**`,
  ].join('\n')
}

function buildComment(summary, ecosystem, projectName, scanUrl, kevVulns = []) {
  const { risk_score, risk_label, critical, high, medium, low, vulnerabilities, total_packages } = summary

  const riskEmoji = risk_score >= 70 ? '🔴' : risk_score >= 40 ? '🟠' : risk_score >= 1 ? '🟡' : '🟢'

  const sevLines = [
    critical > 0 ? `| 🔴 Critical | ${critical} |` : '',
    high     > 0 ? `| 🟠 High     | ${high}     |` : '',
    medium   > 0 ? `| 🟡 Medium   | ${medium}   |` : '',
    low      > 0 ? `| 🟢 Low      | ${low}      |` : '',
  ].filter(Boolean)

  const vulnTable = sevLines.length
    ? `| Severity | Count |\n|----------|-------|\n${sevLines.join('\n')}`
    : '_No vulnerabilities found — all clear!_ ✅'

  const kevAlert = buildKevAlert(kevVulns)

  return [
    `## ${riskEmoji} DepAnalyzer Dependency Scan`,
    ``,
    kevAlert,
    kevAlert ? `` : null,
    `**Project:** \`${projectName}\` &nbsp;·&nbsp; **Ecosystem:** ${ecosystem} &nbsp;·&nbsp; **Packages scanned:** ${total_packages}`,
    ``,
    `**Risk Score: ${risk_score}/100** (${risk_label}) &nbsp;·&nbsp; **Total CVEs:** ${vulnerabilities}`,
    ``,
    vulnTable,
    ``,
    scanUrl
      ? `### 🔍 [View full report →](${scanUrl})\n_Dependency graph, CVE paths, and one-click fix commands_`
      : '',
    ``,
    `<sub>Powered by [DepAnalyzer](https://depanalyzer.com) &nbsp;·&nbsp; Report link expires in 30 days</sub>`,
  ].filter(l => l !== null).join('\n')
}

async function postPrComment(token, repo, prNumber, body) {
  const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`
  const res = await request('POST', url, { body }, {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
  })
  if (res.status !== 201) warning(`PR comment post failed (HTTP ${res.status})`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const manifestFile = process.env.DA_MANIFEST    || 'package.json'
  const apiUrl       = (process.env.DA_API_URL     || 'https://depanalyzer.com').replace(/\/$/, '')
  const token        = process.env.DA_GITHUB_TOKEN
  const repo         = process.env.GITHUB_REPOSITORY
  const eventName    = process.env.GITHUB_EVENT_NAME
  const eventPath    = process.env.GITHUB_EVENT_PATH

  // Read manifest from the user's workspace
  const manifestPath = path.resolve(process.env.GITHUB_WORKSPACE || '.', manifestFile)
  if (!fs.existsSync(manifestPath)) {
    warning(`Manifest not found: ${manifestPath} — skipping scan`)
    return
  }

  const content  = fs.readFileSync(manifestPath, 'utf8')
  const filename = path.basename(manifestFile)

  notice(`DepAnalyzer: scanning ${filename}…`)

  // Call /api/scan
  let scanRes
  try {
    scanRes = await request('POST', `${apiUrl}/api/scan`, { content, filename })
  } catch (e) {
    warning(`DepAnalyzer scan request failed: ${e.message} — skipping`)
    return
  }

  if (scanRes.status !== 200) {
    warning(`DepAnalyzer API returned HTTP ${scanRes.status} — skipping`)
    return
  }

  const result  = scanRes.body
  const summary = result.summary
  const txId    = result.transaction_id
  const scanUrl = txId ? `${apiUrl}/results?id=${txId}` : null

  // Extract KEV-flagged vulnerabilities — deduplicated by CVE ID
  const allVulns  = Array.isArray(result.vulnerabilities) ? result.vulnerabilities : []
  const kevSeen   = new Set()
  const kevVulns  = allVulns.filter(v => {
    if (!v.in_kev || kevSeen.has(v.cve_id)) return false
    kevSeen.add(v.cve_id)
    return true
  })

  // Set outputs for downstream steps
  setOutput('risk_score', String(summary.risk_score))
  setOutput('scan_url',   scanUrl || '')
  setOutput('critical',   String(summary.critical))
  setOutput('high',       String(summary.high))
  setOutput('kev_count',  String(kevVulns.length))

  // Log summary to CI console
  console.log('\n── DepAnalyzer Scan Results ─────────────────────────────')
  console.log(`  Risk score : ${summary.risk_score}/100 (${summary.risk_label})`)
  console.log(`  CVEs found : ${summary.vulnerabilities} (${summary.critical} critical · ${summary.high} high · ${summary.medium} medium · ${summary.low} low)`)
  if (kevVulns.length) console.log(`  KEV (live) : ${kevVulns.length} actively exploited — ${kevVulns.map(v => v.cve_id).join(', ')}`)
  console.log(`  Packages   : ${summary.total_packages}`)
  if (scanUrl) console.log(`  Report     : ${scanUrl}`)
  console.log('─────────────────────────────────────────────────────────\n')

  if (scanUrl) notice(`Full report: ${scanUrl}`)

  // Emit a GitHub Actions warning annotation for each KEV CVE so it shows
  // in the Actions summary and PR checks panel even without opening the comment
  for (const v of kevVulns) {
    const pkg = v.package_name || v.package || 'unknown'
    warning(`CISA KEV: ${v.cve_id} in ${pkg}@${v.installed_version || v.version} — confirmed actively exploited in the wild`)
  }

  // Post PR comment on pull_request events
  if (eventName === 'pull_request' && eventPath && token && repo) {
    try {
      const event    = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
      const prNumber = event?.pull_request?.number
      if (prNumber) {
        const comment = buildComment(summary, result.ecosystem, result.project_name, scanUrl, kevVulns)
        await postPrComment(token, repo, prNumber, comment)
        notice(`PR comment posted to #${prNumber}${kevVulns.length ? ` — ${kevVulns.length} KEV alert(s) included` : ''}`)
      }
    } catch (e) {
      warning(`Could not post PR comment: ${e.message}`)
    }
  }

  // Always exit 0 — scan results are informational, never block the pipeline
}

main().catch(e => { warning(`DepAnalyzer action error: ${e.message}`); process.exit(0) })
