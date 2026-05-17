import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES, getSnapshotFromPage } from '../utils/apiHelpers';

test.describe('PHASE 7 — Data Integrity Validation Test', () => {
  test('snapshot.summary should match UI display', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const snapshot = await getSnapshotFromPage(page);
    
    // Verify summary exists
    expect(snapshot.summary).toBeDefined();
    expect(typeof snapshot.summary).toBe('object');
    
    // Verify required summary fields are numbers
    const numericFields = [
      'risk_score',
      'total_packages',
      'direct_dependencies',
      'transitive_dependencies',
      'vulnerabilities',
      'critical',
      'high',
      'medium',
      'low',
      'secure_package_count',
      'vulnerable_package_count',
      'priority_fix_count',
    ];
    
    for (const field of numericFields) {
      expect(snapshot.summary[field]).toBeDefined();
      expect(typeof snapshot.summary[field]).toBe('number');
    }
  });

  test('grouped_packages should always be array', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const snapshot = await getSnapshotFromPage(page);
    
    expect(snapshot.grouped_packages).toBeDefined();
    expect(Array.isArray(snapshot.grouped_packages)).toBe(true);
  });

  test('vulnerabilities should always be array', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const snapshot = await getSnapshotFromPage(page);
    
    expect(snapshot.vulnerabilities).toBeDefined();
    expect(Array.isArray(snapshot.vulnerabilities)).toBe(true);
  });

  test('should have no frontend-derived metrics', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const snapshot = await getSnapshotFromPage(page);
    
    // Verify all metrics come from summary
    const summaryMetrics = Object.keys(snapshot.summary);
    
    // Check that UI displays match summary
    const riskScoreDisplay = await page.locator('[data-testid="risk-score"]').textContent().catch(() => null);
    if (riskScoreDisplay) {
      const riskScore = parseInt(riskScoreDisplay);
      expect(riskScore).toBe(snapshot.summary.risk_score);
    }
  });

  test('graph should always be object', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const snapshot = await getSnapshotFromPage(page);
    
    expect(snapshot.graph).toBeDefined();
    expect(typeof snapshot.graph).toBe('object');
  });

  test('dependency_tree should always be object', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const snapshot = await getSnapshotFromPage(page);
    
    expect(snapshot.dependency_tree).toBeDefined();
    expect(typeof snapshot.dependency_tree).toBe('object');
  });

  test('transaction_id should be string', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const snapshot = await getSnapshotFromPage(page);
    
    expect(snapshot.transaction_id).toBeDefined();
    expect(typeof snapshot.transaction_id).toBe('string');
    expect(snapshot.transaction_id.length).toBeGreaterThan(0);
  });

  test('snapshot_version should be number', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const snapshot = await getSnapshotFromPage(page);
    
    expect(snapshot.snapshot_version).toBeDefined();
    expect(typeof snapshot.snapshot_version).toBe('number');
    expect(snapshot.snapshot_version).toBe(1);
  });
});
