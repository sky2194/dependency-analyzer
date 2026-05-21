import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES } from '../utils/apiHelpers';
import {
  injectBackendContractDrift,
} from '../utils/mockNetwork';

test.describe('PHASE 4 — Backend Contract Drift Test', () => {
  test('should reject response with missing summary', async ({ page }) => {
    await injectBackendContractDrift(page, 'missing_summary');

    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');

    // Should reject invalid schema
    await page.waitForTimeout(5000);

    // Should show contract error UI
    const errorVisible = await page.locator('text=Contract Error').isVisible().catch(() => false);
    expect(errorVisible).toBeTruthy();
  });

  test('should reject response with string risk_score', async ({ page }) => {
    await injectBackendContractDrift(page, 'string_risk_score');

    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');

    await page.waitForTimeout(5000);

    // Should show contract error UI
    const errorVisible = await page.locator('text=Contract Error').isVisible().catch(() => false);
    expect(errorVisible).toBeTruthy();
  });

  test('should reject response with null grouped_packages', async ({ page }) => {
    await injectBackendContractDrift(page, 'null_grouped');

    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');

    await page.waitForTimeout(5000);

    // Should show contract error UI
    const errorVisible = await page.locator('text=Contract Error').isVisible().catch(() => false);
    expect(errorVisible).toBeTruthy();
  });

  test('should accept response with extra unknown fields', async ({ page }) => {
    await injectBackendContractDrift(page, 'extra_fields');

    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');

    await page.waitForTimeout(5000);

    // Extra fields are forward-compatible — contract should NOT error
    const errorVisible = await page.locator('text=Contract Error').isVisible().catch(() => false);
    expect(errorVisible).toBeFalsy();
  });

  test('should reject response with renamed fields', async ({ page }) => {
    await injectBackendContractDrift(page, 'renamed_fields');

    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');

    await page.waitForTimeout(5000);

    // Should show contract error UI
    const errorVisible = await page.locator('text=Contract Error').isVisible().catch(() => false);
    expect(errorVisible).toBeTruthy();
  });

  test('should not silently normalize invalid schema', async ({ page }) => {
    await injectBackendContractDrift(page, 'missing_summary');

    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');

    await page.waitForTimeout(5000);

    // Should NOT render results with fallback data
    const resultsVisible = await page.locator('text=Vulnerabilities').isVisible().catch(() => false);
    expect(resultsVisible).toBeFalsy();
  });

  test('should trigger error UI on contract violation', async ({ page }) => {
    await injectBackendContractDrift(page, 'string_risk_score');

    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');

    await page.waitForTimeout(5000);

    // Should show contract error with clear message
    const errorVisible = await page.locator('text=Contract Error').isVisible().catch(() => false);
    expect(errorVisible).toBeTruthy();

    // Should have return to scan button
    const returnButtonVisible = await page.locator('text=Back to Scanner').isVisible().catch(() => false);
    expect(returnButtonVisible).toBeTruthy();
  });
});
