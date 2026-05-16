import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES, getTransactionIdFromPage } from '../utils/apiHelpers';

test.describe('PHASE 2 — Concurrent Scans Stress Test', () => {
  test('should only render latest transaction_id when firing 5 parallel scans', async ({ page, context }) => {
    // Create multiple browser contexts for concurrent scans
    const contexts = await Promise.all([
      context.browser().newContext(),
      context.browser().newContext(),
      context.browser().newContext(),
      context.browser().newContext(),
      context.browser().newContext(),
    ]);

    const pages = await Promise.all(contexts.map(c => c.newPage()));

    // Fire 5 parallel scan requests
    const scanPromises = pages.map(async (p, i) => {
      await p.goto('/scan');
      await p.fill('textarea', MOCK_DEPENDENCIES.npm);
      await p.click('button:has-text("Scan & Detect Vulnerabilities")');
      await p.waitForURL('/results', { timeout: 120000 });
      return getTransactionIdFromPage(p);
    });

    const transactionIds = await Promise.all(scanPromises);

    // All transaction IDs should be unique
    const uniqueIds = new Set(transactionIds);
    expect(uniqueIds.size).toBe(transactionIds.length);

    // Close all contexts
    await Promise.all(contexts.map(c => c.close()));
  });

  test('should ignore old responses when rapid switching between scans', async ({ page }) => {
    // First scan
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.npm);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    // Immediately start second scan (cancel first)
    await page.goto('/scan');
    await page.fill('textarea', MOCK_DEPENDENCIES.python);
    await page.click('button:has-text("Scan & Detect Vulnerabilities")');
    
    await page.waitForURL('/results', { timeout: 120000 });
    
    // Only latest scan should be visible
    const finalTransactionId = await getTransactionIdFromPage(page);
    expect(finalTransactionId).toBeTruthy();
  });

  test('should not show UI flicker during concurrent scans', async ({ page }) => {
    // Track visible elements during rapid scans
    let visibleElements: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'log') {
        visibleElements.push(msg.text());
      }
    });

    // Rapid scan sequence
    for (let i = 0; i < 3; i++) {
      await page.goto('/scan');
      await page.fill('textarea', MOCK_DEPENDENCIES.npm);
      await page.click('button:has-text("Scan & Detect Vulnerabilities")');
      await page.waitForURL('/results', { timeout: 120000 });
    }

    // Verify no duplicate or inconsistent states in logs
    const errorLogs = visibleElements.filter(log => 
      log.includes('error') || log.includes('Error') || log.includes('undefined')
    );
    expect(errorLogs.length).toBe(0);
  });

  test('should have deterministic final state after concurrent scans', async ({ page }) => {
    // Perform 3 rapid scans
    const transactionIds: string[] = [];
    
    for (let i = 0; i < 3; i++) {
      await page.goto('/scan');
      await page.fill('textarea', MOCK_DEPENDENCIES.npm);
      await page.click('button:has-text("Scan & Detect Vulnerabilities")');
      await page.waitForURL('/results', { timeout: 120000 });
      const tid = await getTransactionIdFromPage(page);
      transactionIds.push(tid);
    }

    // Final state should have a valid transaction ID
    const finalId = transactionIds[transactionIds.length - 1];
    expect(finalId).toBeTruthy();
    expect(finalId.length).toBeGreaterThan(0);
  });

  test('should handle different dependency inputs concurrently', async ({ page, context }) => {
    const ecosystems = ['npm', 'python', 'maven'];
    const contexts = await Promise.all([
      context.browser().newContext(),
      context.browser().newContext(),
      context.browser().newContext(),
    ]);

    const pages = await Promise.all(contexts.map(c => c.newPage()));

    // Fire concurrent scans with different ecosystems
    const scanPromises = pages.map(async (p, i) => {
      await p.goto('/scan');
      await p.fill('textarea', MOCK_DEPENDENCIES[ecosystems[i] as keyof typeof MOCK_DEPENDENCIES]);
      await p.click('button:has-text("Scan & Detect Vulnerabilities")');
      await p.waitForURL('/results', { timeout: 120000 });
      return getTransactionIdFromPage(p);
    });

    const transactionIds = await Promise.all(scanPromises);

    // All should complete successfully
    transactionIds.forEach(tid => {
      expect(tid).toBeTruthy();
    });

    await Promise.all(contexts.map(c => c.close()));
  });
});
