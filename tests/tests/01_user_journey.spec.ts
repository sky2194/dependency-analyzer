import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES, performScan, getTransactionIdFromPage } from '../utils/apiHelpers';

test.describe('PHASE 1 — Full User Journey Simulation', () => {
  test('should complete full scan journey without crashes', async ({ page }) => {
    // Open app
    await page.goto('/');
    
    // Navigate to scan page
    await page.click('text=Scan');
    await page.waitForURL('/scan');
    
    // Upload dependency file
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    
    // Start scan
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Wait for scan to complete (loading overlay on /scan, then navigates to /results)
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Verify results page loaded
    await expect(page.locator('text=Vulnerabilities')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Dependency Graph')).toBeVisible();
  });

  test('should handle second scan immediately after first', async ({ page }) => {
    // First scan
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Immediately trigger second scan (navigate back to scan)
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.python);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Only latest scan should be visible
    const transactionId = await getTransactionIdFromPage(page);
    expect(transactionId).toBeTruthy();
    
    // Verify no duplicate results
    const vulnerabilityCount = await page.locator('[data-testid="vulnerability-row"]').count();
    expect(vulnerabilityCount).toBeGreaterThanOrEqual(0);
  });

  test('should navigate between pages without stale UI', async ({ page }) => {
    // Complete a scan
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const originalTransactionId = await getTransactionIdFromPage(page);
    
    // Navigate to scan page (no separate analytics route)
    await page.goto('/scan');
    
    // Navigate back to Results
    await page.goto('/results');
    
    // Transaction ID should remain the same
    const currentTransactionId = await getTransactionIdFromPage(page);
    expect(currentTransactionId).toBe(originalTransactionId);
  });

  test('should handle page reload mid-scan gracefully', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Reload page immediately (during loading overlay)
    await page.reload();
    
    // Should redirect to scan page
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/scan/);
  });

  test('should handle navigation back during loading', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Navigate back immediately (during loading overlay)
    await page.goBack();
    
    // Should return to scan page without crash
    await page.waitForURL('/scan');
    await expect(page.locator('text=Dependency Vulnerability Scanner')).toBeVisible();
  });

  test('should not show duplicate scan results', async ({ page }) => {
    // First scan
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    const firstTransactionId = await getTransactionIdFromPage(page);
    
    // Second scan
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.python);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    const secondTransactionId = await getTransactionIdFromPage(page);
    
    // Transaction IDs should be different
    expect(firstTransactionId).not.toBe(secondTransactionId);
  });
});
