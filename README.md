<div align="center">

<img src="https://img.shields.io/github/stars/sky2194/dependency-analyzer?style=flat-square&logo=github&color=gold" />
<img src="https://img.shields.io/badge/version-2.4.1-blue?style=flat-square" />
<img src="https://img.shields.io/badge/python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/flask-3.1-000000?style=flat-square&logo=flask&logoColor=white" />
<img src="https://img.shields.io/badge/postgresql-17-336791?style=flat-square&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/CVE_cache-249k_vulns-red?style=flat-square" />
<img src="https://img.shields.io/badge/license-AGPL%20v3-brightgreen?style=flat-square" />
<img src="https://img.shields.io/badge/E2E_tests-40_passing-success?style=flat-square&logo=playwright" />

# DepAnalyzer

**Open-source Software Composition Analysis (SCA) tool.**  
Scan your project dependencies for known CVE vulnerabilities — across npm, PyPI, and Maven.

[🌐 depanalyzer.com](https://www.depanalyzer.com) · [📖 Docs](https://www.depanalyzer.com/learn) · [🐛 Report a Bug](https://github.com/sky2194/dependency-analyzer/issues) · [💡 Request a Feature](https://github.com/sky2194/dependency-analyzer/issues)

</div>

---

## Overview

DepAnalyzer parses a dependency manifest, resolves every package in the tree via the ecosystem's public registry, and maps each one against a local PostgreSQL cache of the [OSV](https://osv.dev) vulnerability database — seeded once and kept fresh via delta sync every 5 minutes. Missing CVSS scores are enriched from [NVD](https://nvd.nist.gov). Results are aggregated into a risk score, grouped by package, and rendered in an interactive UI with a live dependency graph.

The local CVE cache (249k+ vulnerabilities across npm, PyPI, and Maven) means scan lookups take milliseconds instead of seconds — no live API round-trips per package.

**Scan workflow:**
1. Parse the uploaded manifest (extract package names and pinned versions)
2. Resolve the full dependency tree via public registry APIs, up to three levels deep
3. Query local PostgreSQL CVE cache (DB-first); fall back to live OSV API on cache miss
4. Enrich missing CVSS scores from NVD where needed
5. Build an immutable, versioned snapshot with a unique transaction ID
6. Validate the snapshot contract on the frontend before rendering
7. Display risk score, CVE list, dependency graph, and per-ecosystem fix commands

Built for developers who want visibility into their supply chain without enterprise tooling overhead.

---

## Features

### Dependency Scanning
- Parses `package.json`, `package-lock.json`, `requirements.txt`, and `pom.xml`
- Resolves direct and transitive dependencies up to three levels deep
- Auto-detects ecosystem from filename **and from pasted content** (JSON → npm, XML → Maven, `pkg==ver` → PyPI)
- PostgreSQL resolver cache — repeat package lookups skip registry API entirely (warm cache: ~5ms vs ~500ms)
- Handles `dependencies`, `devDependencies`, and `peerDependencies` for npm
- No API key required for OSV (primary vulnerability source)

### Vulnerability Analysis
- Dual-source lookup: OSV (primary) + NVD (CVSS enrichment)
- CVSS v3.1 / v3.0 / v2 scoring with severity labels
- **EPSS score** — probability (0–100%) a CVE will be exploited in the wild within 30 days, sourced from the Cyentia Institute and synced daily
- **CISA KEV flag** — marks CVEs confirmed on the [Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) list; these are displayed with a prominent alert and auto-selected in the detail panel
- Vulnerability deduplication and grouping by `package@version`
- CVE path tracking — shows how each vulnerability enters the dependency tree
- Fix version recommendations where published

### Risk Scoring
- Composite score (0–100) using a logarithmic decay model across four severity tiers
- Labels: Secure, Low, Medium, High, Critical
- Priority fix count surfaces Critical and High vulnerabilities first
- Auto-selects the most urgent CVE on load — KEV-confirmed vulnerabilities are prioritised above severity alone

### Dependency Graph
- Interactive SVG graph built without an external graph library
- Zoom (Ctrl+scroll) and pan (drag)
- Filter by severity or switch view mode (all / vulnerable / isolated)
- Direct and transitive nodes rendered with vulnerability indicators

### Export and Reporting
- PDF report via ReportLab: project metadata, risk score, full vulnerability table with fix versions
- CSV export for spreadsheet analysis
- Ecosystem-specific batch fix commands (`npm install`, `pip install -r`, `mvn clean install`)

### Scan History
- localStorage-backed history, grouped by project name
- Stores up to 20 scans per project with timestamps and summary snapshots

### Knowledge Base
- Eight learning sections: SCA, dependency types, CVSS, CVEs, supply chain risks, remediation, CI/CD integration, SBOMs
- Glossary with 25+ plain-English term definitions surfaced via inline tooltips

### System Status Bar
- Live operational strip below the nav bar — visible on all non-landing pages
- Row 1: `SYS · DB · OSV · NVD` status dots + uptime + UTC clock + version
- Row 2: `SYS_READY · TXN · DB · OSV · NVD_POLL` — session transaction ID and sync status
- Toggleable `SYSTEM_LOGS` panel — real-time log entries from health data + live activity (heartbeat, rate limit resets, cache refreshes)
- All status fields wired to real `/api/health` data — no fake indicators

### Theme System
- Dark and light themes toggled via the header control, persisted to localStorage
- CSS custom properties throughout — no hardcoded colors anywhere in the UI
- WCAG AA compliant contrast ratios for severity indicators in both themes

### Responsive Design
- Mobile hamburger navigation
- Adaptive layouts for file upload and results at mobile and desktop viewports
- Cross-browser E2E coverage: Chromium, Firefox, and WebKit

### GitHub Action — Automatic Scanning on Every Commit
- Install `sky2194/dependency-analyzer@v1` in any project to scan dependencies on every push and pull request
- Posts a full report comment to the PR — risk score, CVE breakdown, and a deep link to the visual report in the app
- **CISA KEV alert** — if any CVE in the scan is on the CISA Known Exploited Vulnerabilities list, a prominent warning block appears at the top of the PR comment
- Emits `::warning::` annotations for KEV CVEs visible in the GitHub Actions summary panel and PR checks tab
- Never blocks or rejects a PR — informational by default
- Exposes `risk-score`, `scan-url`, `critical`, `high`, and `kev-count` as step outputs for downstream workflow steps (Slack alerts, Jira tickets, etc.)
- Scan results are persisted server-side for 30 days — the "View full report" link opens the full app including dependency graph, CVE paths, and fix commands

---

## Supported Ecosystems

| Ecosystem | Manifest Files | Registry | Mediation Rule |
|-----------|---------------|----------|----------------|
| npm / Node.js | `package.json`, `package-lock.json` | registry.npmjs.org | Nearest depth wins |
| PyPI / Python | `requirements.txt` | pypi.org/pypi | First matching version |
| Maven / Java | `pom.xml` | search.maven.org | First declaration wins |

---

## Tech Stack

**Backend**

| Package | Version | Role |
|---------|---------|------|
| Flask | 3.0.0 | HTTP framework |
| Gunicorn | 21.2.0 | WSGI server |
| Flask-CORS | 4.0.0 | CORS middleware |
| psycopg2-binary | 2.9.9 | PostgreSQL driver |
| APScheduler | 3.10.4 | Background sync scheduler |
| ReportLab | 4.2.5 | PDF generation |
| requests | 2.31.0 | External API calls |
| xmltodict | 0.13.0 | pom.xml parsing |
| packaging | 23.2 | Version comparison |

**Frontend**

| Package | Version | Role |
|---------|---------|------|
| React | 18.2.0 | UI framework |
| Vite | 5.1.0 | Build tool and dev server |
| React Router DOM | 6.22.0 | Client-side routing |
| Axios | 1.6.0 | HTTP client |

Fonts: Syne (display), DM Sans (body), DM Mono (code) — loaded via Google Fonts.

**Testing**

## Running Tests

### E2E Tests (Playwright)
```bash
cd frontend
npm run test:e2e              # headless
npm run test:e2e:headed       # with browser visible
npm run test:e2e:ui           # interactive UI mode
```

Tests cover 5 areas (41 tests total):
- **Landing** — hero, CTAs, nav links, mobile hamburger
- **Scanner** — tabs, example load, auto-detect, keyboard accessibility
- **Results** — full scan flow, CVE table, filters, graph, export, crash guard
- **History** — load, empty state, delete without crash
- **Knowledge Base** — all sections, mobile picker

### CI Gate (internal)
Every PR to `main` automatically runs the full Playwright + pytest test suite via GitHub Actions.
PRs cannot be merged if any test fails.
Failure artifacts (screenshots, videos) are uploaded for debugging.

### Using DepAnalyzer in your own CI pipeline
Add the following to `.github/workflows/security.yml` in any project to get automatic dependency scanning on every push and PR:

```yaml
name: Dependency Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sky2194/dependency-analyzer@v1
        with:
          manifest-file: package.json   # or requirements.txt / pom.xml
          api-url: https://depanalyzer.com
```

The Action scans your dependencies, posts a PR comment with the full report (including a CISA KEV alert if any actively-exploited CVEs are found), and links directly to the visual report in the app. It never fails the build.

### Backend Tests (pytest)
```bash
cd backend
pytest
pytest --coverage
```

| Tool | Version | Role |
|------|---------|------|
| Playwright | 1.60.0 | E2E and responsive testing |
| pytest | 8.1.0 | Backend unit and integration tests |

---

## Architecture

```
User uploads manifest
        │
        ▼
┌──────────────────────────────────────────┐
│  Flask backend  (app.py)                 │
│                                          │
│  1. Parse                                │
│     npm_parser / pypi_parser /           │
│     maven_parser / lockfile_parser       │
│                                          │
│  2. Resolve  (registry API calls)        │
│     npm_resolver / pypi_resolver /       │
│     maven_resolver / lockfile_resolver   │
│     LRU cache (500 entries, 1h TTL)      │
│     Circuit breaker + retry-backoff      │
│                                          │
│  3. Scan  (cve/scanner.py)               │
│     BFS traversal, up to 8 OSV workers   │
│     DB-first lookup (PostgreSQL cache)   │
│     → live OSV fallback on cache miss    │
│     → NVD CVSS enrichment                │
│     → EPSS score + KEV flag enrichment   │
│     LRU cache (1000 entries, 1h TTL)     │
│                                          │
│  4. Build snapshot                       │
│     transaction_id  (UUID v4)            │
│     snapshot_version: 1                  │
│     status: COMPLETED                    │
│     summary, vulnerabilities, graph      │
└──────────────────┬───────────────────────┘
                   │  JSON response
                   ▼
┌──────────────────────────────────────────┐
│  React frontend                          │
│                                          │
│  validateSnapshot.js                     │
│    Hard contract validation              │
│    Throws on ANY schema violation        │
│    No silent fallbacks or partial renders│
│                                          │
│  Analytics.jsx   — results and CVE list  │
│  DependencyGraph.jsx  — SVG graph        │
│  projectStore.js — localStorage history  │
└──────────────────────────────────────────┘
```

### Transaction Model

Every scan response carries a `transaction_id` (UUID v4) and `snapshot_version: 1`. The frontend validates the full snapshot shape before rendering — any missing field, wrong type, or schema version mismatch throws immediately. Stale transactions from a previous scan are rejected if a new scan starts before the previous one completes.

### Snapshot Contract

```
{
  transaction_id:  uuid-v4 string,
  snapshot_version: 1,
  status:          "COMPLETED",
  ecosystem:       "npm" | "pypi" | "maven",
  project_name:    string,
  summary: {
    risk_score:                  number,   // 0–100
    risk_label:                  string,   // Secure | Low | Medium | High | Critical
    total_packages:              number,
    direct_dependencies:         number,
    transitive_dependencies:     number,
    vulnerabilities:             number,
    critical:                    number,
    high:                        number,
    medium:                      number,
    low:                         number,
    secure_package_count:        number,
    vulnerable_package_count:    number,
    vulnerable_direct_count:     number,
    vulnerable_transitive_count: number,
    priority_fix_count:          number
  },
  grouped_packages:  [...],
  vulnerabilities:   [...],
  graph:             {...},
  dependency_tree:   {...},
  scan_timestamp:    unix timestamp
}
```

### Risk Score Algorithm

Logarithmic decay prevents any single severity tier from saturating the score:

```
score = 40 × (1 − e^(−critical/3))
      + 30 × (1 − e^(−high/5))
      + 20 × (1 − e^(−medium/8))
      + 10 × (1 − e^(−low/10))

Final = min(100, round(score))
```

| Score | Label |
|-------|-------|
| 0 | Secure |
| 1–39 | Low |
| 40–69 | Medium |
| 70–89 | High |
| 90–100 | Critical |

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm 9+

### Quick Start

```bash
git clone https://github.com/sky2194/dependency-analyzer.git
cd dependency-analyzer
chmod +x start.sh
./start.sh start
```

The script creates the Python virtual environment, installs all dependencies, and starts both services.

```
  Backend   → http://localhost:5000
  Frontend  → http://localhost:3000
```

### Start Script Commands

```bash
./start.sh start     # Start both services
./start.sh stop      # Stop both services
./start.sh restart   # Restart both services
./start.sh logs      # Tail backend + frontend logs
```

### Manual Setup

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**Frontend (separate terminal):**
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

**Backend (`backend/.env`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (production) | PostgreSQL connection string. Format: `postgresql://user:pass@host/db?sslmode=require`. Free tier: [neon.tech](https://neon.tech) |
| `NVD_API_KEY` | No | NVD API key. Without it: 5 req/30s. With it: 50 req/30s. Get one at nvd.nist.gov/developers/request-an-api-key |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins. Defaults to permissive in development. |
| `ALLOW_VERCEL_PREVIEWS` | No | Set to `true` to allow `*.vercel.app` preview URLs. |
| `USE_REDIS_RATE_LIMIT` | No | Set to `true` to switch from in-memory to Redis-backed rate limiting. |
| `DISABLE_SCHEDULER` | No | Set to `true` to disable background OSV/EPSS/KEV sync (useful in dev). |
| `INTERNAL_TOKEN` | No | Secret token for `/api/health` full response. Public callers get minimal response. Set same value as `VITE_INTERNAL_TOKEN` on frontend. Generate with `openssl rand -hex 32`. |

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values
```

**Frontend (`frontend/.env`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Production only | Backend base URL. In development, Vite proxies `/api/*` to `localhost:5000` automatically. |
| `VITE_INTERNAL_TOKEN` | No | Matches `INTERNAL_TOKEN` on backend. Allows frontend to receive full `/api/health` response. |

---

## Database Setup (PostgreSQL CVE Cache)

DepAnalyzer uses a local PostgreSQL cache for fast CVE lookups. Without it, scans fall back to live OSV API calls (slower but functional).

### 1. Create a free Neon database

1. Sign up at [neon.tech](https://neon.tech) (free, no credit card)
2. Create a project → name it `depanalyzer`, region US East
3. Copy the connection string:
   ```
   postgresql://user:password@ep-xxx.neon.tech/depanalyzer?sslmode=require
   ```
4. Add it to `backend/.env`:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/depanalyzer?sslmode=require
   ```

### 2. Download OSV data (once)

```bash
curl -L -o /tmp/npm.zip   https://osv-vulnerabilities.storage.googleapis.com/npm/all.zip
curl -L -o /tmp/pypi.zip  https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip
curl -L -o /tmp/maven.zip https://osv-vulnerabilities.storage.googleapis.com/Maven/all.zip
```

### 3. Seed the database (once, ~5-10 min)

```bash
cd backend
python3 sync/seed.py
```

This loads 249k+ vulnerabilities + EPSS scores + CISA KEV entries. Run once — delta sync keeps it fresh automatically.

### 4. That's it

The backend initialises the schema and starts the delta sync scheduler on every restart. OSV data is refreshed every 5 minutes (delta only — not a full re-download).

> **Without `DATABASE_URL`:** scans still work via live OSV API. Expect 10-30s per scan on large manifests vs under 1s with the DB cache.

---

## Usage

1. Open `http://localhost:3000`
2. Select an ecosystem tab (npm, PyPI, or Maven)
3. Upload your manifest file or paste its contents directly
4. Click **Scan & Detect Vulnerabilities**
5. Review the risk score, CVE list, dependency graph, and fix commands
6. Export as PDF or CSV if needed
7. Results are saved automatically to Scan History

---

## Project Structure

```
dependency-analyzer/
├── start.sh                        # Orchestration script (start/stop/restart/logs)
├── LICENSE                         # AGPL v3
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js              # Dev server on :3000, proxy /api/* → :5000
│   ├── vercel.json                 # Vercel deployment config
│   ├── .env.example
│   ├── index.html
│   └── src/
│       ├── App.jsx                 # Root layout, routing, theme toggle, ScanContext
│       ├── index.css               # CSS custom properties, themes, animations
│       ├── pages/
│       │   ├── Landing.jsx         # Home page with hero and feature showcase
│       │   ├── Dashboard.jsx       # Scanner interface with file upload
│       │   ├── Scanning.jsx        # Loading state during active scan
│       │   ├── Analytics.jsx       # Results page (risk score, CVE list, graph)
│       │   ├── History.jsx         # Scan history browser
│       │   └── Learn.jsx           # Knowledge base
│       ├── components/
│       │   ├── DependencyGraph.jsx # SVG interactive dependency graph
│       │   ├── FileUpload.jsx      # Upload, paste textarea, ecosystem selector
│       │   ├── ErrorBoundary.jsx   # React error boundary
│       │   ├── StepBanner.jsx      # Step progress indicator
│       │   └── Tooltip.jsx         # Glossary tooltips
│       ├── utils/
│       │   ├── config.js           # API base URL
│       │   ├── projectStore.js     # localStorage scan history (max 20/project)
│       │   ├── fixAll.js           # Ecosystem-specific batch fix commands
│       │   ├── validateSnapshot.js # Hard contract validation (throws on violation)
│       │   └── normalizeSnapshot.js
│       └── data/
│           ├── ecosystems.js       # Ecosystem definitions and filename detection
│           └── terms.js            # Glossary (25+ terms)
│
├── backend/
│   ├── app.py                      # Flask application, routes, CORS, rate limiter
│   ├── requirements.txt
│   ├── .env.example
│   ├── parsers/
│   │   ├── npm_parser.py           # package.json parser
│   │   ├── pypi_parser.py          # requirements.txt parser
│   │   ├── maven_parser.py         # pom.xml parser
│   │   └── lockfile_parser.py      # package-lock.json parser
│   ├── resolvers/
│   │   ├── npm_resolver.py         # npm registry resolution
│   │   ├── pypi_resolver.py        # PyPI registry resolution
│   │   ├── maven_resolver.py       # Maven Central resolution
│   │   └── lockfile_resolver.py    # Lock file resolution (no registry calls)
│   ├── cve/
│   │   ├── scanner.py              # BFS scan orchestration — DB-first with OSV fallback
│   │   ├── db_scanner.py           # PostgreSQL CVE lookup (version-aware)
│   │   ├── osv_client.py           # OSV API client with circuit breaker (fallback)
│   │   └── nvd_client.py           # NVD API client (CVSS enrichment)
│   ├── sync/
│   │   ├── osv_sync.py             # Delta sync via OSV API every 5 minutes
│   │   ├── epss_kev_sync.py        # EPSS scores + CISA KEV list (daily)
│   │   └── seed.py                 # One-time seed from local OSV ZIP dumps
│   ├── db.py                       # PostgreSQL connection manager + schema
│   ├── exports/
│   │   ├── pdf_export.py           # ReportLab PDF generation
│   │   └── csv_export.py           # CSV export
│   ├── utils/
│   │   ├── validation.py           # Input sanitization (XSS, injection prevention)
│   │   └── circuit_breaker.py      # Three-state circuit breaker
│   └── tests/
│       ├── test_api.py
│       ├── test_parsers.py
│       ├── test_resolvers.py
│       ├── test_dependency_graph.py
│       ├── test_vulnerability_system.py
│       └── test_cve.py
│
└── tests/                          # Playwright E2E tests
    ├── package.json
    ├── playwright.config.ts        # Chromium, Firefox, WebKit; auto-starts Vite
    ├── utils/
    │   ├── apiHelpers.ts           # Mock payloads, scan helpers
    │   ├── transactionValidator.ts # Transaction ID assertions
    │   ├── graphAssertions.ts      # Dependency graph validation
    │   ├── layoutAssertions.ts     # Responsive layout assertions
    │   ├── overflowAssertions.ts   # Overflow/scroll behavior
    │   ├── themeAssertions.ts      # Dark/light theme validation
    │   ├── viewportHelpers.ts      # Mobile/desktop viewport simulation
    │   └── mockNetwork.ts          # Network interception for failure tests
    ├── 01_user_journey.spec.ts
    ├── 02_concurrent_scans.spec.ts
    ├── 03_network_failure.spec.ts
    ├── 04_backend_contract_drift.spec.ts
    ├── 05_transaction_race.spec.ts
    ├── 06_render_stability.spec.ts
    ├── 07_data_integrity.spec.ts
    └── responsive/
        ├── 09_scan_flow_responsive.spec.ts
        └── 10_cross_ecosystem_layout.spec.ts
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scan` | Parse and scan a dependency manifest |
| `POST` | `/api/scan-package` | Scan a single package by name and version |
| `GET` | `/api/scans/<id>` | Retrieve a stored scan snapshot by its transaction ID (used by shareable links from the GitHub Action) |
| `GET` | `/api/cve/<cve_id>` | Fetch details for a specific CVE |
| `POST` | `/api/export/pdf` | Generate a PDF report from a scan snapshot |
| `POST` | `/api/export/csv` | Generate a CSV export of vulnerabilities |
| `GET` | `/api/health` | Health check — returns status, DB connection state, and last OSV/EPSS/KEV sync timestamps |

### POST `/api/scan`

**Request body:**
```json
{
  "content": "<manifest file text>",
  "filename": "package.json",
  "ecosystem": "npm"
}
```

`ecosystem` is optional — auto-detected from `filename` if omitted. Body size is capped at 512KB.

**Response:** full snapshot object matching the contract above.

### POST `/api/scan-package`

**Request body:**
```json
{
  "package": "lodash",
  "version": "4.17.20",
  "ecosystem": "npm"
}
```

Resolves transitive dependencies up to depth 2 and scans the full tree.

---

## Running Tests

**Backend (pytest):**
```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

**E2E (Playwright) — ensure the backend is running first:**
```bash
cd tests
npm install
npx playwright install
npx playwright test                          # all specs, all browsers
npx playwright test 01_user_journey          # single spec
npx playwright test --project=chromium       # single browser
npx playwright test responsive/              # responsive specs only
npx playwright show-report                   # open HTML report
```

**Frontend unit tests:**
```bash
cd frontend
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # with coverage
```

### E2E Test Suites

| Spec | What it covers |
|------|---------------|
| `01_user_journey` | Full scan workflow, page navigation, multi-scan sequencing |
| `02_concurrent_scans` | Race conditions, transaction isolation |
| `03_network_failure` | Timeout handling, network resilience |
| `04_backend_contract_drift` | Snapshot version enforcement, hard contract validation |
| `05_transaction_race` | Stale response blocking, concurrent scan handling |
| `06_render_stability` | Component rendering consistency, data binding |
| `07_data_integrity` | Vulnerability deduplication, package counts, graph validation |
| `09_scan_flow_responsive` | Mobile viewports, file upload interaction |
| `10_cross_ecosystem_layout` | npm / PyPI / Maven form layouts across screen sizes |

---

## Security Model

### Input validation
All package names, versions, and Maven coordinates are validated by regex before any registry API call:
- Package names: `^[@a-zA-Z0-9._\-\/]+$` (blocks XSS and path traversal)
- Versions: semver with operators, `*`, `x`, `latest`
- Maven groupId / artifactId: `^[a-zA-Z0-9._\-]+$` (blocks XML injection)
- Manifest body: capped at 512KB

### Rate limiting
- 20 requests per 60-second window per client IP — applied to all endpoints including `/api/cve`
- In-memory by default; switch to Redis with `USE_REDIS_RATE_LIMIT=true`
- `/api/health` returns minimal public response by default; full details require `X-Internal-Token` header

### Resilience
- **Circuit breaker** — OSV and NVD clients each use a three-state circuit breaker (CLOSED → OPEN after 5 consecutive failures → HALF_OPEN after 30s recovery). Prevents cascade failures when upstream APIs degrade.
- **Retry with backoff** — resolver registry calls use exponential backoff (base 0.5s, max 3s, max 1 retry per call).

### Security headers
Every backend response includes:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### Frontend contract enforcement
`validateSnapshot.js` validates every scan response before the UI renders it. Any missing field, wrong type, or unexpected schema version throws immediately — there are no partial renders or silent data coercions.

---

## Performance and Stability

- **Scan concurrency** — up to 8 OSV workers and 6 NVD workers run in parallel per scan.
- **LRU caching** — resolver results cached for 1 hour (500 entries); CVE results cached for 1 hour (1000 entries). Repeated scans of the same packages avoid redundant registry and OSV calls.
- **Transaction isolation** — each scan carries a UUID transaction ID. The frontend rejects any response whose ID does not match the active scan, preventing stale results from appearing when a new scan starts before the previous one completes.
- **Hard contract validation** — `validateSnapshot.js` throws on any schema violation. There are no fallback values, default-filled fields, or partial renders on malformed data.

---

## Known Limitations

- **Reachability** — CVEs are flagged based on package version, not whether the vulnerable code path is reachable in your application.
- **Transitive depth** — resolves up to three levels for npm and two levels for PyPI and Maven. Very deep trees are not fully traversed.
- **Rate limiting** — in-memory rate limiting resets on server restart. Use Redis (`USE_REDIS_RATE_LIMIT=true`) for persistent enforcement across restarts.
- **No authentication** — the application is stateless. Scan history is stored in the browser's localStorage only.
- **DB version coverage** — the OSV seed captures versions listed in OSV dump files. Packages with only range-based affected entries (no explicit version list) default to conservative match (assumed affected). Live OSV fallback resolves these precisely.

---

## Screenshots

| Page | Preview |
|------|---------|
| Landing | *(placeholder)* |
| Scanner / Dashboard | *(placeholder)* |
| Scan Results / Analytics | *(placeholder)* |
| Dependency Graph | *(placeholder)* |
| Scan History | *(placeholder)* |

---

## Deployment

### Frontend (Vercel)

```bash
cd frontend
npm run build    # outputs to /dist
```

Set `VITE_API_URL` to the backend URL in Vercel environment settings. `vercel.json` rewrites `/api/*` to the backend host.

### Backend (Gunicorn)

```bash
cd backend
source venv/bin/activate
gunicorn app:app --bind 0.0.0.0:5000 --workers 2
```

Set `ALLOWED_ORIGINS` to your frontend domain, `DATABASE_URL` to your Neon connection string, and optionally `NVD_API_KEY` for better NVD rate limits.

**Do not set `DATABASE_URL` in a file on the server.** Set it as an environment variable in your hosting platform dashboard (DigitalOcean → App → Environment Variables, or Render/Railway settings). This keeps your database password off the filesystem.

---

### Auto-deploy hook (optional)

Set up a `post-merge` hook on the server so `git pull` automatically restarts the service:

```bash
cat > /var/www/dependency-analyzer/.git/hooks/post-merge << 'EOF'
#!/bin/bash
cd /var/www/dependency-analyzer
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then exit 0; fi
eval $(grep -E "^Environment=" /etc/systemd/system/dependency-analyzer.service.d/override.conf | sed 's/Environment=//;s/"//g' | xargs -I{} echo export {})
if git diff HEAD@{1} HEAD --name-only | grep -q "requirements.txt"; then
  source backend/venv/bin/activate && pip install -r backend/requirements.txt -q
fi
if git diff HEAD@{1} HEAD --name-only | grep -q "backend/db.py"; then
  cd backend && python3 -c "from db import init_schema; init_schema()" && cd ..
fi
systemctl restart dependency-analyzer
echo "✅ Deploy complete"
EOF
chmod +x /var/www/dependency-analyzer/.git/hooks/post-merge
```

After this, deploying is a single command:
```bash
ssh root@your-server "cd /var/www/dependency-analyzer && git pull origin main"
```

## Troubleshooting

**Port already in use:**
```bash
./start.sh restart
```

**Backend won't start:**
```bash
./start.sh logs             # check backend log output
rm -rf backend/venv         # recreate virtual environment if corrupt
./start.sh start
```

**Frontend won't start:**
```bash
./start.sh logs
rm -rf frontend/node_modules
./start.sh start
```

---

## Contributing

1. Fork the repository and create a branch from `main`.
2. For backend changes, add or update tests in `backend/tests/`.
3. For frontend changes, verify behavior in both dark and light themes and at mobile and desktop viewports.
4. Run the Playwright suite before opening a pull request.
5. Keep the snapshot contract in `validateSnapshot.js` and `app.py` in sync — any field added to the backend response must be reflected in the frontend validation.

---

## License

**GNU Affero General Public License v3.0 (AGPL v3)** — see [LICENSE](LICENSE) for details.

Copyright 2026 Sai Koutilya Yerabati.

DepAnalyzer is free to use, modify, and self-host. If you run a modified version as a network service (SaaS), you must release your source code under AGPL v3. For commercial licensing, contact koutilya99@gmail.com.
