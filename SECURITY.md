# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (feature/ai-fixes) | ✅ |

## Data Handling

**Your manifest is never stored.**

When you upload a `package.json`, `requirements.txt`, or `pom.xml`:

- The file is parsed in-memory on the backend
- Package names and versions are looked up against the **local PostgreSQL CVE cache** — no data is sent to OSV/NVD unless the package is not in the cache
- No package names, filenames, registry URLs, or version constraints are persisted to any database
- No telemetry, no analytics on package data
- The backend logs only HTTP status codes and aggregate CVE counts for uptime monitoring

**What the database stores:**

The PostgreSQL database stores:

- **CVE intelligence** — vulnerability data sourced from OSV, EPSS, and CISA KEV (public data only)
- **Scan snapshots** — the CVE findings and risk score for a completed scan, stored for **30 days** to power the shareable CI report link (`/results?id=<uuid>`). The raw manifest (package names, versions, file contents) is **never persisted** — only the derived vulnerability results are stored. Snapshots are automatically deleted after 30 days.

## CVE Data Sources

| Source | Data | Refresh |
|--------|------|---------|
| [OSV](https://osv.dev) | 249k+ vulnerabilities (npm, PyPI, Maven) | Delta sync every 5 minutes |
| [EPSS](https://epss.cyentia.com) | Exploit Prediction Scoring System | Daily |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | Known Exploited Vulnerabilities | Daily |
| [NVD](https://nvd.nist.gov) | CVSS score enrichment (fallback only) | On demand |

## Reporting a Vulnerability

If you discover a security vulnerability in DepAnalyzer, please **do not open a public GitHub issue.**

Report it privately by opening an issue marked **"Security"** — we will respond within 48 hours.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within **48 hours** and resolve confirmed vulnerabilities within **14 days**.

## Scope

In scope:
- XSS, injection, authentication bypass on the hosted instance
- Data leakage of user-uploaded manifests
- CVE data integrity (false negatives on known vulnerabilities)
- Database credential exposure

Out of scope:
- Rate limiting bypass (known limitation, mitigated in-memory)
- Self-hosted instances running without TLS

## Health Endpoint

`/api/health` is a public endpoint. By default it returns only:
- `status`, `version`, `osv_synced_at`, `db_connected`

Full details (allowed origins, rate limits, NVD key status, sync timestamps) are only returned when the request includes a valid `X-Internal-Token` header matching the `INTERNAL_TOKEN` environment variable. Generate with `openssl rand -hex 32` and set on both backend and frontend.

## Database Security

- `DATABASE_URL` is stored in `backend/.env` which is gitignored — never committed to the repository
- In production, `DATABASE_URL` is set as an environment variable in the hosting platform — never written to the filesystem
- Neon PostgreSQL enforces TLS (`sslmode=require`) on all connections
- The database stores public CVE intelligence and scan result snapshots (CVE findings only, 30-day TTL) — the raw manifest file is never written to the database
