# Expanded Responsive Test Suite

A comprehensive Playwright testing suite for validating responsive layout correctness across all viewport sizes, themes, ecosystems, and browsers.

## Test Structure

```
tests/
├── responsive/
│   ├── 01_mobile_layout.spec.ts           # Mobile viewport validation
│   ├── 02_tablet_layout.spec.ts           # Tablet viewport validation
│   ├── 03_desktop_layout.spec.ts          # Desktop viewport validation
│   ├── 04_theme_switching.spec.ts         # Theme consistency tests
│   ├── 05_navigation_responsive.spec.ts   # Navigation responsiveness
│   ├── 06_modal_overflow.spec.ts          # Modal overflow tests
│   ├── 07_graph_responsive.spec.ts         # Graph responsiveness
│   ├── 08_stress_resize.spec.ts           # Runtime resize chaos tests
│   ├── 09_scan_flow_responsive.spec.ts    # Scan flow across ecosystems
│   └── 10_cross_ecosystem_layout.spec.ts  # Cross-ecosystem layout validation
└── utils/
    ├── viewportHelpers.ts                  # Viewport manipulation utilities
    ├── layoutAssertions.ts                 # Layout integrity assertions
    ├── themeAssertions.ts                  # Theme consistency assertions
    ├── graphAssertions.ts                  # Graph-specific assertions
    └── overflowAssertions.ts               # Overflow detection assertions
```

## Device Matrix

### Mobile
- iPhone SE (375x667)
- iPhone 14 (390x844)
- Pixel 7 (412x915)
- Galaxy S21 (360x800)

### Tablet
- iPad Mini (768x1024)
- iPad Pro (1024x1366)
- Surface Pro (912x1368)

### Desktop
- 1280x720
- 1440x900
- 1920x1080
- Ultrawide (2560x1440)

## Ecosystem Coverage

Tests validate responsive behavior across:
- **npm** - package.json format
- **Maven** - pom.xml format
- **Python** - requirements.txt format
- **Gradle** - build.gradle format
- **Go** - go.mod format

## Browser Matrix

Tests run on:
- Chromium (Chrome)
- Firefox
- WebKit (Safari)

Each responsive test runs on all three browsers to ensure cross-browser compatibility.

## Running Tests

### Run all responsive tests
```bash
cd tests
npx playwright test responsive/ --reporter=html
```

### Run specific test file
```bash
npx playwright test responsive/01_mobile_layout.spec.ts --reporter=list
```

### Run with specific browser
```bash
npx playwright test responsive/ --project=responsive-chromium
```

## Test Coverage

### Phase 1: Mobile Layout (01_mobile_layout.spec.ts)
- No horizontal overflow
- Critical elements visible
- Tappable buttons (44x44 minimum)
- Readable text
- Ecosystem tabs usable
- Textarea input handling
- File upload area handling
- No clipped content
- Viewport width changes

### Phase 2: Tablet Layout (02_tablet_layout.spec.ts)
- Grid layout correctness
- Card wrapping
- Modal centering
- Tab usability
- Sidebar layout stability
- Orientation changes

### Phase 3: Desktop Layout (03_desktop_layout.spec.ts)
- Large screen layouts
- No whitespace gaps
- Graph centering
- Sidebar alignment
- Analytics section alignment
- Ultrawide screen handling

### Phase 4: Theme Switching (04_theme_switching.spec.ts)
- Light/dark toggle
- Runtime switching during scan
- Switching during navigation
- No flicker
- No mixed colors
- Severity color consistency
- Theme persistence

### Phase 5: Navigation Responsiveness (05_navigation_responsive.spec.ts)
- Navigation collapses correctly
- Tappable navigation items
- Navigation clicks
- Button clicks
- Tab navigation
- Mobile hamburger menu
- Back button functionality

### Phase 6: Modal Overflow (06_modal_overflow.spec.ts)
- Modal fully visible
- Scrolling inside modal
- Modal within viewport
- Close button accessible
- Background scroll locking
- Theme switching during modal
- Small mobile screen handling

### Phase 7: Graph Responsiveness (07_graph_responsive.spec.ts)
- Graph scaling on mobile
- No node overlap
- Zoom usability
- Graph bounded
- Theme adaptation
- Container resize
- Graph interaction

### Phase 8: Stress Resize Chaos (08_stress_resize.spec.ts)
- Mobile → tablet → desktop → ultrawide → mobile
- During active scan
- During modal open
- During theme change
- No React crashes
- No layout corruption
- Extreme viewport scenarios

### Phase 9: Scan Flow Responsiveness (09_scan_flow_responsive.spec.ts)
- npm scan flow
- Maven scan flow
- Python scan flow
- Gradle scan flow
- Go scan flow
- Transaction ID preservation
- Theme switch during scan
- Resize during scan input
- Navigation to analytics
- Results page stability
- Page refresh stability

### Phase 10: Cross-Ecosystem Layout (10_cross_ecosystem_layout.spec.ts)
- **NPM**: Large dependency trees render safely
- **Maven**: Long artifact names wrap correctly
- **Python**: Package cards stay aligned
- **Gradle**: Graph nodes remain bounded
- **Go**: Minimal dependency results centered
- Theme consistency across ecosystems
- Button visibility across ecosystems
- Content width constraints
- Ecosystem-specific layout validation

## Assertions

### Layout Integrity
- `assertNoHorizontalOverflow()` - No horizontal scrolling
- `assertElementVisible()` - Element in viewport
- `assertCriticalElementsVisible()` - Key UI elements visible
- `assertMinimumTapTargetSize()` - 44x44 minimum for mobile
- `assertModalCentered()` - Modal properly centered
- `assertGraphBounded()` - Graph within container
- `assertGridLayoutIntegrity()` - Grid layout correct
- `assertNoTextOverflow()` - No text clipping

### Theme Consistency
- `assertThemeApplied()` - Theme tokens correctly set
- `assertNoMixedThemeColors()` - No color mixing
- `assertThemeSwitchNoFlicker()` - Fast theme switching
- `assertSeverityColorsConsistent()` - Severity colors stable
- `assertAllThemeTokensDefined()` - All tokens present

### Graph Assertions
- `assertGraphBounded()` - Graph within container
- `assertGraphValidDimensions()` - Valid dimensions
- `assertGraphNodesVisible()` - Nodes visible
- `assertNoGraphOverflow()` - No overflow
- `assertGraphInteractive()` - Interactive
- `assertGraphValidTransforms()` - No NaN transforms
- `assertNoDetachedNodes()` - No detached nodes
- `assertGraphScalesCorrectly()` - Correct scaling

### Overflow Assertions
- `assertNoBodyHorizontalOverflow()` - No body overflow
- `assertElementNoOverflow()` - Element no overflow
- `assertElementHasOverflow()` - Has overflow handling
- `assertModalNoOverflow()` - Modal no overflow
- `assertTextNotClipped()` - Text not clipped
- `assertContainerHasInternalScroll()` - Internal scroll
- `assertElementFullyVisible()` - Fully visible
- `assertNoClippedCards()` - No clipped cards
- `assertNoHiddenButtons()` - No hidden CTA buttons
- `assertContentMaxWidth()` - Max width constraint
- `assertNoInfiniteWidth()` - No infinite width
- `assertNoInfiniteHeight()` - No infinite height
- `assertBodyScrollLocked()` - Body scroll locked
- `assertBodyScrollUnlocked()` - Body scroll unlocked

## Output Format

The test suite produces a JSON report with the following structure:

```json
{
  "mobile_responsive": "PASS/FAIL",
  "tablet_responsive": "PASS/FAIL",
  "desktop_responsive": "PASS/FAIL",
  "theme_consistency": "PASS/FAIL",
  "navigation_responsiveness": "PASS/FAIL",
  "modal_integrity": "PASS/FAIL",
  "graph_responsiveness": "PASS/FAIL",
  "stress_resize_stability": "PASS/FAIL",
  "scan_flow_stability": "PASS/FAIL",
  "cross_ecosystem_layouts": "PASS/FAIL",
  "overall_verdict": "RESPONSIVE_STABLE / NOT_STABLE"
}
```

## Global Failure Conditions

The suite fails if ANY occur:
- Horizontal scrolling
- Clipped content
- Overlapping text
- Invisible buttons
- Unreadable text
- Modal cutoff
- Graph overflow
- Broken dark mode
- Mixed theme colors
- Runtime resize crash
- Hydration mismatch
- Duplicated UI sections
- Stale scan state after resize/navigation
- Transaction mismatch UI
- Mock/demo leakage
- Broken hooks state

## Zero Manual Verification

This suite is designed to fully automate responsive validation. No human visual inspection is required after running the tests. All assertions are programmatic and deterministic.

## Final Stability Criteria

The system is ONLY considered stable if:
- Every viewport passes
- Every theme pass succeeds
- Every ecosystem renders correctly
- No overflow exists
- No stale state exists
- No graph instability exists
- No responsive crash occurs
- No layout corruption occurs during runtime resize
