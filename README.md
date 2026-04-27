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
- Python 3.8 or higher (`python3 --version`)
- Node.js 18 or higher (`node --version`)
- npm 8 or higher (`npm --version`)

### Quick Start (Recommended)

```bash
# Clone the repo
git clone https://github.com/sky2194/dependency-analyzer.git
cd dependency-analyzer

# Make start script executable
chmod +x start.sh

# Install dependencies and run everything
./start.sh
```

The application will start on:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### NVD API Key (Optional but Recommended)
Without a key, NVD requests are rate-limited to 5/30s.

```bash
# Get a free key at: https://nvd.nist.gov/developers/request-an-api-key
cp backend/.env.example backend/.env
# Edit backend/.env and add your NVD_API_KEY
```

### Manual Setup (If start.sh fails)

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**Frontend (open new terminal):**
```bash
cd frontend
npm install
npm run dev
```

## Usage

```bash
./start.sh              # Start both frontend + backend
./start.sh backend      # Backend only
./start.sh frontend     # Frontend only
./start.sh stop         # Stop all services
./tests/test.sh         # Run health check
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

## Troubleshooting

### `start.sh` command not found
```bash
chmod +x start.sh
./start.sh
```

### Port 3000 or 5000 already in use
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Find and kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### Python/Node version issues
```bash
# Check versions
python3 --version   # Should be 3.8+
node --version      # Should be 18+
npm --version       # Should be 8+
```

### Dependencies installation fails
```bash
# Clean and reinstall
rm -rf backend/venv frontend/node_modules
./start.sh
```

## Known Limitations

- **Rate limiting is in-memory** — resets on server restart. For production, use Redis-backed rate limiting.
- **Reachability** — CVEs are flagged based on package version, not whether the vulnerable function is actually called in your code.
- **Transitive depth** — npm resolves up to 3 levels deep, PyPI/Maven up to 2 levels. Deeper chains may be missed.

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
