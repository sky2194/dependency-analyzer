import { Page, Route } from '@playwright/test';

/**
 * Network simulation utilities for testing failure conditions
 */

export async function throttleNetwork(page: Page, delay: number = 2000): Promise<void> {
  await page.route('**/api/**', async (route: Route) => {
    await new Promise(resolve => setTimeout(resolve, delay));
    route.continue();
  });
}

export async function simulateNetworkTimeout(page: Page): Promise<void> {
  await page.route('**/api/**', route => {
    route.abort('timedout');
  });
}

export async function simulateNetworkFailure(page: Page): Promise<void> {
  await page.route('**/api/**', route => {
    route.abort('failed');
  });
}

export async function simulatePartialResponse(page: Page): Promise<void> {
  await page.route('**/api/**', async (route: Route) => {
    const response = await route.fetch();
    const body = await response.text();
    // Truncate response to simulate partial data
    const partialBody = body.substring(0, Math.floor(body.length / 2));
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: partialBody,
    });
  });
}

export async function simulateMalformedJSON(page: Page): Promise<void> {
  await page.route('**/api/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{ invalid json }',
    });
  });
}

export async function injectBackendContractDrift(page: Page, driftType: 'missing_summary' | 'string_risk_score' | 'null_grouped' | 'extra_fields' | 'renamed_fields'): Promise<void> {
  await page.route('**/api/scan', async (route: Route) => {
    const response = await route.fetch();
    const originalBody = await response.json();
    
    let modifiedBody = { ...originalBody };
    
    switch (driftType) {
      case 'missing_summary':
        delete modifiedBody.summary;
        break;
      case 'string_risk_score':
        if (modifiedBody.summary) {
          modifiedBody.summary.risk_score = 'invalid' as any;
        }
        break;
      case 'null_grouped':
        modifiedBody.grouped_packages = null as any;
        break;
      case 'extra_fields':
        modifiedBody.legacy_field = 'should not exist';
        modifiedBody.warnings = ['should not exist'];
        break;
      case 'renamed_fields':
        modifiedBody.riskScore = modifiedBody.summary?.risk_score;
        delete modifiedBody.summary;
        break;
    }
    
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(modifiedBody),
    });
  });
}

export async function injectStaleTransactionResponse(page: Page, staleTransactionId: string): Promise<void> {
  await page.route('**/api/scan', async (route: Route) => {
    const response = await route.fetch();
    const originalBody = await response.json();
    
    // Inject stale transaction ID
    const modifiedBody = {
      ...originalBody,
      transaction_id: staleTransactionId,
    };
    
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(modifiedBody),
    });
  });
}

export async function simulateSlowNetwork(page: Page, latency: number): Promise<void> {
  const context = page.context();
  await context.setOffline(false);
  
  await page.route('**/api/**', async (route: Route) => {
    await new Promise(resolve => setTimeout(resolve, latency));
    route.continue();
  });
}

export async function abortRequestMidFlight(page: Page, delay: number = 1000): Promise<void> {
  await page.route('**/api/**', async (route: Route) => {
    setTimeout(() => route.abort(), delay);
  });
}
