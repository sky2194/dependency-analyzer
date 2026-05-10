# Dependency Analyzer - Playwright Test Suite

## Overview
This Playwright test suite validates the Dependency Analyzer application under real-world failure conditions including:
- Concurrent scans
- Race conditions
- Stale responses
- Backend contract drift
- Network failures
- UI hydration issues
- Transaction mismatches
- Theme switching instability

## Installation

```bash
cd tests
npm install
npx playwright install
```

## Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run in headed mode
npm run test:headed

# Debug mode
npm run test:debug

# View test report
npm run test:report
```

## Test Structure

```
tests/
├── playwright.config.ts          # Playwright configuration
├── package.json                   # Test dependencies
├── utils/
│   ├── apiHelpers.ts             # API request helpers
│   ├── transactionValidator.ts   # Transaction validation utilities
│   └── mockNetwork.ts            # Network simulation utilities
└── tests/
    ├── 01_user_journey.spec.ts          # Full user journey simulation
    ├── 02_concurrent_scans.spec.ts      # Concurrent scan stress test
    ├── 03_network_failure.spec.ts       # Network failure injection
    ├── 04_backend_contract_drift.spec.ts # Backend contract drift test
    ├── 05_transaction_race.spec.ts      # Transaction race condition test
    ├── 06_render_stability.spec.ts      # React render stability test
    ├── 07_data_integrity.spec.ts        # Data integrity validation
    └── 08_theme_consistency.spec.ts     # Theme stability under load
```

## Test Phases

### Phase 1: User Journey
- Completes full scan workflow
- Handles rapid scan switching
- Navigates between pages without stale UI
- Handles page reload mid-scan
- Handles navigation back during loading

### Phase 2: Concurrent Scans
- Fires 5-10 parallel scan requests
- Validates only latest transaction renders
- Ensures old responses are ignored
- Checks for UI flicker
- Validates deterministic final state

### Phase 3: Network Failure
- Simulates 2-10s network delay
- Simulates request timeout
- Simulates partial JSON response
- Simulates aborted request mid-flight
- Validates error boundary rendering

### Phase 4: Backend Contract Drift
- Removes summary field
- Makes risk_score a string
- Sets grouped_packages to null
- Adds unexpected fields
- Renames fields
- Validates frontend rejects invalid schema

### Phase 5: Transaction Race
- Scan A starts, Scan B starts immediately
- Scan A returns after Scan B
- Validates Scan B wins
- Validates Scan A is discarded
- Checks for state overwrite

### Phase 6: Render Stability
- Rapid navigation between pages
- Repeated mount/unmount of Analytics
- Checks for memory leaks
- Validates no duplicate fetches
- Handles rapid state updates

### Phase 7: Data Integrity
- snapshot.summary matches UI display
- grouped_packages always array
- vulnerabilities always array
- No frontend-derived metrics
- Validates all required fields

### Phase 8: Theme Consistency
- Toggle dark/light mode mid-scan
- Switch theme during loading
- Navigate during theme change
- Validates no flicker
- Checks CSS variable usage

## Configuration

The test suite is configured with:
- Parallel execution enabled
- Retries = 0 (strict mode)
- Trace on failure
- Video recording on failure
- Full API logging
- Multiple browser contexts for concurrent tests

## Expected Output

```
✔ Phase 1: User Journey — PASS
✔ Phase 2: Concurrency — PASS
✔ Phase 3: Network Failure — PASS
✔ Phase 4: Contract Drift — PASS
✔ Phase 5: Transaction Safety — PASS
✔ Phase 6: Render Stability — PASS
✔ Phase 7: Data Integrity — PASS
✔ Phase 8: Theme Stability — PASS

FINAL VERDICT: STABLE
```

## Notes

- Tests assume the frontend is running on http://localhost:3000
- Tests assume the backend API is available
- Some tests inject network failures via route interception
- Transaction IDs are validated to prevent stale data rendering
- Error boundaries are validated for contract violations
