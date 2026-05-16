import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES, getTransactionIdFromPage } from '../utils/apiHelpers';
import { injectStaleTransactionResponse, throttleNetwork } from '../utils/mockNetwork';

test.describe('PHASE 5 — Transaction Race Condition Test', () => {
  test('scan B should win when scan A returns after scan B', async ({ page }) => {
    // Start scan A
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Immediately start scan B (cancels scan A)
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.python);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Scan B should be rendered
    const transactionId = await getTransactionIdFromPage(page);
    expect(transactionId).toBeTruthy();
  });

  test('should discard stale transaction responses', async ({ page }) => {
    const staleTransactionId = 'stale-tx-12345';
    
    // Inject stale transaction ID
    await injectStaleTransactionResponse(page, staleTransactionId);
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Should reject stale response
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    // Should either show error or redirect
    expect(currentUrl).toMatch(/\/scan/);
  });

  test('should not overwrite state with stale data', async ({ page }) => {
    // First successful scan
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    const firstTransactionId = await getTransactionIdFromPage(page);
    
    // Try to inject stale response
    await page.route('**/api/**', async route => {
      const response = await route.fetch();
      const body = await response.json();
      const modifiedBody = {
        ...body,
        transaction_id: 'stale-response-999',
      };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(modifiedBody),
      });
    });
    
    // Navigate to scan page (no separate analytics route)
    await page.goto('/scan');
    
    // Navigate back to results
    await page.goto('/results');
    
    // Transaction ID should remain the same (not overwritten)
    const currentTransactionId = await getTransactionIdFromPage(page);
    expect(currentTransactionId).toBe(firstTransactionId);
  });

  test('should prevent mixed UI state from concurrent scans', async ({ page }) => {
    // Rapid scan sequence
    const transactionIds: string[] = [];
    
    for (let i = 0; i < 3; i++) {
      await page.goto('/scan');
      await page.fill('textarea', MOCK_DEPENDENCIES.npm);
      await page.click('button:has-text("Scan & Detect Vulnerabilities")');
      await page.waitForURL('/results', { timeout: 120000 });
      const tid = await getTransactionIdFromPage(page);
      transactionIds.push(tid);
    }
    
    // Each scan should have a unique transaction ID
    const uniqueIds = new Set(transactionIds);
    expect(uniqueIds.size).toBe(transactionIds.length);
    
    // Final state should be consistent
    const finalSnapshot = await page.evaluate(() => {
      const state = (window as any).history.state;
      return state?.result;
    });
    
    expect(finalSnapshot).toBeDefined();
    expect(finalSnapshot.transaction_id).toBe(transactionIds[transactionIds.length - 1]);
  });

  test('should handle delayed response from cancelled scan', async ({ page }) => {
    // Add delay to simulate slow response
    await throttleNetwork(page, 3000);
    
    // Start scan
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Cancel by navigating away immediately (during loading overlay)
    await page.goto('/scan');
    
    // Start new scan
    await page.fill('textarea', MOCK_DEPENDENCIES.python);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 150000 });
    
    // Only latest scan should be visible
    const transactionId = await getTransactionIdFromPage(page);
    expect(transactionId).toBeTruthy();
  });
});
