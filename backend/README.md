# Dependency Analyzer — Backend

## Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run
```bash
python app.py
# Runs on http://localhost:5000
```

## Optional: NVD API Key
Without a key, NVD requests are rate-limited (5 req/30s).
Get a free key: https://nvd.nist.gov/developers/request-an-api-key

```bash
export NVD_API_KEY=your_key_here
python app.py
```

## Endpoints
- POST /api/analyze   — analyze dependency file
- GET  /api/search    — search CVEs by package name
- GET  /api/cve/<id>  — get single CVE detail
- GET  /api/health    — health check
