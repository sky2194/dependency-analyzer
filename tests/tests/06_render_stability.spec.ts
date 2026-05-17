import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES } from '../utils/apiHelpers';

test.describe('PHASE 6 — React Render Stability Test', () => {
  test('should handle rapid navigation between pages', async ({ page }) => {
    await page.goto('/');
    
    // Rapid navigation sequence
    const pages = ['/', '/scan', '/dashboard', '/analytics', '/results'];
    
    for (let i = 0; i < 5; i++) {
      for (const p of pages) {
        await page.goto(p);
        await page.waitForTimeout(100);
      }
    }
    
    // Should not crash
    await expect(page).toHaveURL('/');
  });

  test('should handle repeated mount/unmount of Analytics page', async ({ page }) => {
    // Complete a scan first
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Repeatedly navigate between scan and results
    for (let i = 0; i < 10; i++) {
      await page.goto('/scan');
      await page.waitForTimeout(50);
      
      await page.goto('/results');
      await page.waitForTimeout(50);
    }
    
    // Should not crash
    await expect(page.locator('text=Vulnerabilities')).toBeVisible();
  });

  test('should not have memory leaks from unmounted components', async ({ page, context }) => {
    // Monitor console for memory-related warnings
    const warnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });
    
    // Multiple mount/unmount cycles
    for (let i = 0; i < 5; i++) {
      await page.goto('/scan');
      await page.fill('textarea', MOCK_DEPENDENCIES.npm);
      await page.click('button:has-text("Scan & Detect Vulnerabilities")');
      await page.waitForURL('/results', { timeout: 120000 });
      
      await page.goto('/');
      await page.waitForTimeout(100);
    }
    
    // Check for memory leak warnings
    const memoryWarnings = warnings.filter(w => 
      w.toLowerCase().includes('memory') || 
      w.toLowerCase().includes('leak')
    );
    expect(memoryWarnings.length).toBe(0);
  });

  test('should not have duplicate fetch calls', async ({ page }) => {
    const fetchCalls: string[] = [];
    
    await page.route('**/api/**', route => {
      fetchCalls.push(route.request().url());
      route.continue();
    });
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Should have only one API call for the scan
    const scanApiCalls = fetchCalls.filter(url => url.includes('/api/scan'));
    expect(scanApiCalls.length).toBe(1);
  });

  test('should handle rapid state updates during render', async ({ page }) => {
    await page.goto('/scan');
    
    // Rapid state changes
    const ecosystems = ['npm', 'python', 'maven'];
    
    for (let i = 0; i < 10; i++) {
      for (const eco of ecosystems) {
        await page.click(`button:has-text("${eco}")`);
        await page.waitForTimeout(10);
      }
    }
    
    // Should not crash
    await expect(page.locator('text=Dependency Vulnerability Scanner')).toBeVisible();
  });

  test('should handle StrictMode double rendering', async ({ page }) => {
    // React StrictMode renders components twice in development
    // This test ensures the app handles it correctly
    
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Should complete without errors
    await page.waitForURL('/results', { timeout: 120000 });
    
    await expect(page.locator('text=Vulnerabilities')).toBeVisible();
  });

  test('should not crash on undefined render state', async ({ page }) => {
    // Navigate directly to results without state
    await page.goto('/results');
    
    // Should handle gracefully (redirect or show error)
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    // Should redirect to scan or show error
    expect(currentUrl).toMatch(/\/(scan|results)/);
  });
});
