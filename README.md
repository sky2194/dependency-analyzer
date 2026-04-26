# 🔐 Dependency Analyzer

> Software Composition Analysis (SCA) tool that scans your project dependencies for known CVE vulnerabilities — with plain-English explanations for every finding.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

## What it does

- 🌳 Builds a full dependency graph (direct + transitive)
- 🔐 Scans every package against **NVD** + **OSV** vulnerability databases
- ⚖️ Detects and explains **dependency mediation** conflicts
- 🔗 Shows exact **CVE path** from your app to the vulnerable package
- 🎯 Identifies **root cause** of each vulnerability
- 📦 Supports **npm**, **PyPI**, and **Maven** ecosystems

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 18+

### Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/dependency-analyzer.git
cd dependency-analyzer

# Install and run everything
./start.sh
```

Open http://localhost:3000

### NVD API Key (optional but recommended)
Without a key, NVD requests are rate-limited to 5/30s.
Get a free key at: https://nvd.nist.gov/developers/request-an-api-key

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your key
```

### Manual Setup

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Usage

```
./start.sh            # start both frontend + backend
./start.sh backend    # backend only
./start.sh frontend   # frontend only
./start.sh stop       # stop all
./tests/test.sh       # run health check
```

## Project Structure

```
dependency-analyzer/
├── backend/
│   ├── app.py              # Flask API
│   ├── parsers/            # npm / PyPI / Maven file parsers
│   ├── resolvers/          # dependency tree resolution
│   ├── cve/                # NVD + OSV clients
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Dashboard, Results, Search
│   │   └── data/           # terms, ecosystems, mock data
│   └── package.json
└── tests/
    ├── backend/            # pytest test suite
    └── test.sh             # master health check
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Analyze a dependency file |
| GET | `/api/search?pkg=lodash` | Search CVEs by package |
| GET | `/api/cve/<id>` | Get CVE details |
| GET | `/api/health` | Health check |

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
