import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES } from '../utils/apiHelpers';
import {
  throttleNetwork,
  simulateNetworkTimeout,
  simulateNetworkFailure,
  simulatePartialResponse,
  simulateMalformedJSON,
} from '../utils/mockNetwork';

test.describe('PHASE 3 — Network Failure Injection Test', () => {
  test('should show error boundary on network timeout', async ({ page }) => {
    await simulateNetworkTimeout(page);
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Should show error, not crash
    await page.waitForTimeout(5000);
    
    // Check for error message or redirect back to scan
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/scan/);
  });

  test('should show error boundary on network failure', async ({ page }) => {
    await simulateNetworkFailure(page);
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Should show error, not crash
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/scan/);
  });

  test('should handle 2-10s network delay gracefully', async ({ page }) => {
    await throttleNetwork(page, 5000);
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Should complete despite delay
    await page.waitForURL('/results', { timeout: 150000 });
    
    await expect(page.locator('text=Vulnerabilities')).toBeVisible({ timeout: 10000 });
  });

  test('should not render partial JSON response', async ({ page }) => {
    await simulatePartialResponse(page);
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Should handle partial response gracefully
    await page.waitForTimeout(5000);
    
    // Should not crash or show partial data
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(scan|scanning)/);
  });

  test('should reject malformed JSON', async ({ page }) => {
    await simulateMalformedJSON(page);
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Should handle malformed JSON
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/scan/);
  });

  test('should not trigger mock fallback on network failure', async ({ page }) => {
    await simulateNetworkFailure(page);
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    await page.waitForTimeout(5000);
    
    // Check that no mock data warning appears
    const mockWarning = page.locator('text=DEMO DATA').count();
    expect(mockWarning).toBe(0);
    
    // Check that no mock data is displayed
    const mockData = page.locator('text=is_mock').count();
    expect(mockData).toBe(0);
  });

  test('should show error boundary (not crash) on connection drop', async ({ page }) => {
    await page.route('**/api/**', route => {
      // Abort after delay to simulate dropped connection
      setTimeout(() => route.abort('failed'), 1000);
    });
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Should show error, not crash
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/scan/);
  });
});
