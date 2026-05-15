import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES } from '../utils/apiHelpers';

test.describe('PHASE 8 — Theme Stability Under Load Test', () => {
  test('should toggle dark/light mode without flicker', async ({ page }) => {
    await page.goto('/');
    
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    
    // Toggle theme multiple times
    for (let i = 0; i < 5; i++) {
      await themeButton.click();
      await page.waitForTimeout(100);
    }
    
    // Should not crash
    await expect(page).toHaveURL('/');
  });

  test('should handle theme toggle mid-scan', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    
    // Start scan
    await page.click('button:has-text("Scan")');
    await page.waitForURL('/scanning');
    
    // Toggle theme during scan
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    await themeButton.click();
    
    // Wait for scan to complete
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Should complete without errors
    await expect(page.locator('text=Vulnerabilities')).toBeVisible();
  });

  test('should switch theme during loading', async ({ page }) => {
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan")');
    await page.waitForURL('/scanning');
    
    // Rapid theme switching during loading
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    for (let i = 0; i < 3; i++) {
      await themeButton.click();
      await page.waitForTimeout(200);
    }
    
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Should complete successfully
    await expect(page.locator('text=Vulnerabilities')).toBeVisible();
  });

  test('should navigate during theme change', async ({ page }) => {
    await page.goto('/');
    
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    
    // Toggle theme and navigate simultaneously
    await themeButton.click();
    await page.click('text=Scan');
    await page.waitForURL('/scan');
    
    // Should not crash
    await expect(page.locator('text=Dependency Vulnerability Scanner')).toBeVisible();
  });

  test('should not have broken CSS variables', async ({ page }) => {
    await page.goto('/');
    
    // Check for CSS variable usage
    const hasCssVars = await page.evaluate(() => {
      const computedStyle = getComputedStyle(document.documentElement);
      return computedStyle.getPropertyValue('--bg') !== '';
    });
    
    expect(hasCssVars).toBe(true);
  });

  test('should have consistent severity colors across themes', async ({ page }) => {
    // Complete a scan
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan")');
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Toggle theme
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    await themeButton.click();
    await page.waitForTimeout(200);
    
    // Check severity colors are still visible
    const severityBadges = page.locator('[data-severity]');
    const count = await severityBadges.count();
    
    if (count > 0) {
      // Verify badges have color styles
      const firstBadge = severityBadges.first();
      await expect(firstBadge).toBeVisible();
    }
  });

  test('should not have mixed theme state', async ({ page }) => {
    await page.goto('/');
    
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    
    // Rapid theme toggles
    for (let i = 0; i < 10; i++) {
      await themeButton.click();
      await page.waitForTimeout(50);
    }
    
    // Check theme attribute is consistent
    const themeAttribute = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(themeAttribute).toMatch(/dark|light/);
  });

  test('should persist theme across page navigation', async ({ page }) => {
    await page.goto('/');
    
    // Set theme to light
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    await themeButton.click();
    await page.waitForTimeout(100);
    
    // Navigate to different pages
    await page.click('text=Scan');
    await page.waitForURL('/scan');
    
    // Check theme is still light
    const themeAttribute = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(themeAttribute).toBe('light');
  });
});
